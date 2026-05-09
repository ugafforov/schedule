import { storage } from "../storage/index";
import { db } from "../db";
import { scheduleEntries, timeSlots } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { getSubjectComplexity, getMaxHoursPerDay, getSubjectCategory, type SubjectCategory } from "@shared/constants";

const DAYS = [1, 2, 3, 4, 5];
const DAY_NAMES = ["", "Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma"];

const DEFAULT_TIME_SLOTS = [
  { period: 1, name: "1-dars", start: "08:00", end: "08:45" },
  { period: 2, name: "2-dars", start: "09:00", end: "09:45" },
  { period: 3, name: "3-dars", start: "10:00", end: "10:45" },
  { period: 4, name: "4-dars", start: "11:00", end: "11:45" },
  { period: 5, name: "5-dars", start: "12:00", end: "12:45" },
  { period: 6, name: "6-dars", start: "13:00", end: "13:45" },
];

export async function ensureTimeSlots() {
  const existing = await storage.getTimeSlots();
  if (existing.length > 0) return existing;

  const toCreate: any[] = [];
  for (const day of DAYS) {
    for (const slot of DEFAULT_TIME_SLOTS) {
      toCreate.push({
        name: `${DAY_NAMES[day]} ${slot.name}`,
        startTime: slot.start,
        endTime: slot.end,
        dayOfWeek: day,
        periodNumber: slot.period,
        isBreak: false,
        isActive: true,
      });
    }
  }
  const created = [];
  for (const s of toCreate) {
    created.push(await storage.createTimeSlot(s));
  }
  return created;
}

export interface GenerateScheduleOptions {
  weekStart: string;
  classIds?: number[];
  clearExisting?: boolean;
}

const DAY_QUALITY: Record<number, number> = { 2: 10, 3: 10, 4: 9, 1: 7, 5: 6 };
const PERIOD_QUALITY: Record<number, number> = { 2: 10, 3: 10, 4: 10, 1: 7, 5: 7, 6: 5 };

export async function generateSchedule(options: GenerateScheduleOptions) {
  const { weekStart, classIds, clearExisting } = options;
  const weekStartDate = new Date(weekStart);

  if (clearExisting) {
    await storage.clearScheduleForWeek(weekStartDate);
    await storage.clearConflicts();
  }

  const slots = await ensureTimeSlots();
  const activeSlots = slots.filter((s) => !s.isBreak);

  const [allClasses, allRooms, allClassSubjects, allSubjects, allUnavailability, allTeachers] =
    await Promise.all([
      storage.getClasses(),
      storage.getRooms(),
      storage.getAllClassSubjects(),
      storage.getSubjects(),
      storage.getAllTeacherUnavailability(),
      storage.getTeachers(),
    ]);

  const targetClasses = classIds?.length
    ? allClasses.filter((c) => classIds.includes(c.id))
    : allClasses;

  if (targetClasses.length === 0) throw new Error("Sinflar mavjud emas.");
  if (allRooms.length === 0) throw new Error("Xonalar mavjud emas.");

  const unavailSet = new Set<string>(
    allUnavailability.map((u) => `${u.teacherId}_${u.dayOfWeek}_${u.periodNumber}`)
  );

  const subjectMap = new Map(allSubjects.map((s) => [s.id, s]));
  
  // CSP: All individual lessons that need to be scheduled
  interface LessonRequirement {
    id: string;
    classId: number;
    subjectId: number;
    teacherId: number;
    teacherId2: number | null;
    weeklyHours: number;
    complexity: number;
    category: SubjectCategory;
    grade: number;
  }

  const lessonsToSchedule: LessonRequirement[] = [];
  for (const cls of targetClasses) {
    const classSubjectList = allClassSubjects.filter((cs) => cs.classId === cls.id);
    for (const cs of classSubjectList) {
      if (!cs.teacherId) continue;
      const sub = subjectMap.get(cs.subjectId);
      const hours = Math.ceil(cs.weeklyHours);
      for (let i = 0; i < hours; i++) {
        lessonsToSchedule.push({
          id: `${cls.id}_${cs.subjectId}_${i}`,
          classId: cls.id,
          subjectId: cs.subjectId,
          teacherId: cs.teacherId,
          teacherId2: cs.teacherId2 || null,
          weeklyHours: cs.weeklyHours,
          complexity: getSubjectComplexity(sub?.name || ""),
          category: getSubjectCategory(sub?.name || ""),
          grade: parseInt(String(cls.grade)),
        });
      }
    }
  }

  // Sort lessons by difficulty (Heuristic: MRV - Most Constrained Variable first)
  lessonsToSchedule.sort((a, b) => b.grade - a.grade || b.complexity - a.complexity);

  const teacherBusy = new Set<string>();
  const roomBusy = new Set<string>();
  const classBusy = new Set<string>();
  const classDailyCount = new Map<string, number>();
  const subjectDailyCount = new Map<string, number>();
  
  // Backtracking State for Iterative Approach
  interface State {
    lessonIdx: number;
    slotIdx: number;
    entries: any[];
  }

  const stack: State[] = [{ lessonIdx: 0, slotIdx: 0, entries: [] }];
  const finalSchedule: any[] = [];
  
  const startTime = Date.now();
  const TIMEOUT_MS = 30000; // 30 seconds limit
  const MAX_STEPS = 500000; // 500k steps safety limit
  let steps = 0;

  console.log(`[CSP] Starting iterative solver for ${lessonsToSchedule.length} lessons...`);

  while (stack.length > 0) {
    steps++;
    if (steps > MAX_STEPS || (Date.now() - startTime) > TIMEOUT_MS) {
      console.warn(`[CSP] Solver limit reached. Steps: ${steps}, Time: ${Date.now() - startTime}ms`);
      break;
    }

    const current = stack[stack.length - 1];
    
    // Base Case: All lessons scheduled
    if (current.lessonIdx >= lessonsToSchedule.length) {
      finalSchedule.push(...current.entries);
      break;
    }

    const lesson = lessonsToSchedule[current.lessonIdx];
    const maxDaily = getMaxHoursPerDay(String(lesson.grade));
    let found = false;

    // Try slots starting from current slotIdx
    for (let i = current.slotIdx; i < activeSlots.length; i++) {
      const slot = activeSlots[i];
      const day = slot.dayOfWeek;
      const cdKey = `${lesson.classId}_${day}`;
      const sdKey = `${lesson.classId}_${lesson.subjectId}_${day}`;
      const tKey1 = `${lesson.teacherId}_${slot.id}`;
      const tKey2 = lesson.teacherId2 ? `${lesson.teacherId2}_${slot.id}` : null;
      const cKey = `${lesson.classId}_${slot.id}`;

      // HARD CONSTRAINTS
      if (classBusy.has(cKey)) continue;
      if (teacherBusy.has(tKey1)) continue;
      if (tKey2 && teacherBusy.has(tKey2)) continue;
      if (unavailSet.has(`${lesson.teacherId}_${day}_${slot.periodNumber}`)) continue;
      if (lesson.teacherId2 && unavailSet.has(`${lesson.teacherId2}_${day}_${slot.periodNumber}`)) continue;
      if ((classDailyCount.get(cdKey) || 0) >= maxDaily) continue;
      
      const maxSameSubject = (lesson.grade >= 5 && lesson.complexity >= 6) ? 2 : 1;
      if ((subjectDailyCount.get(sdKey) || 0) >= maxSameSubject) continue;

      // Room Selection
      const classStudents = targetClasses.find(c => c.id === lesson.classId)?.totalStudents || 25;
      const reqType = subjectMap.get(lesson.subjectId)?.requiredRoomType || "any";
      const availableRooms = allRooms.filter(r => !roomBusy.has(`${r.id}_${slot.id}`));
      
      const room1 = availableRooms.find(r => 
        (reqType === "any" || r.roomType === reqType) && r.capacity >= (lesson.teacherId2 ? classStudents/2 : classStudents)
      );
      if (!room1) continue;

      let room2 = null;
      if (lesson.teacherId2) {
        room2 = availableRooms.find(r => 
          r.id !== room1.id && (reqType === "any" || r.roomType === reqType) && r.capacity >= classStudents/2
        );
        if (!room2) continue;
      }

      // Valid slot found - APPLY
      current.slotIdx = i + 1; // Mark this slot as tried for current lesson
      
      classBusy.add(cKey);
      teacherBusy.add(tKey1);
      if (tKey2) teacherBusy.add(tKey2);
      roomBusy.add(`${room1.id}_${slot.id}`);
      if (room2) roomBusy.add(`${room2.id}_${slot.id}`);
      classDailyCount.set(cdKey, (classDailyCount.get(cdKey) || 0) + 1);
      subjectDailyCount.set(sdKey, (subjectDailyCount.get(sdKey) || 0) + 1);

      const entry = {
        classId: lesson.classId, subjectId: lesson.subjectId, teacherId: lesson.teacherId,
        roomId: room1.id, timeSlotId: slot.id, weekStartDate, isActive: true,
      };
      const entries = [entry];
      if (lesson.teacherId2 && room2) {
        entries.push({ ...entry, teacherId: lesson.teacherId2, roomId: room2.id });
      }

      // Push next lesson to stack
      stack.push({ lessonIdx: current.lessonIdx + 1, slotIdx: 0, entries });
      found = true;
      break;
    }

    if (!found) {
      // BACKTRACK
      const popped = stack.pop();
      if (stack.length > 0) {
        const prev = stack[stack.length - 1];
        const prevLesson = lessonsToSchedule[prev.lessonIdx];
        const prevEntries = popped?.entries || [];
        
        // REVERSE last applied changes
        for (const e of prevEntries) {
          const slot = activeSlots.find(s => s.id === e.timeSlotId)!;
          classBusy.delete(`${e.classId}_${e.timeSlotId}`);
          teacherBusy.delete(`${e.teacherId}_${e.timeSlotId}`);
          roomBusy.delete(`${e.roomId}_${e.timeSlotId}`);
          const cdKey = `${e.classId}_${slot.dayOfWeek}`;
          const sdKey = `${e.classId}_${e.subjectId}_${slot.dayOfWeek}`;
          classDailyCount.set(cdKey, (classDailyCount.get(cdKey) || 1) - 1);
          subjectDailyCount.set(sdKey, (subjectDailyCount.get(sdKey) || 1) - 1);
        }
      }
    }
  }

  const success = finalSchedule.length >= lessonsToSchedule.length;
  console.log(`[CSP] Finished. Success: ${success}, Steps: ${steps}, Time: ${Date.now() - startTime}ms`);

  if (finalSchedule.length > 0) {
    const toCreate = stack.flatMap(s => s.entries);
    await storage.createScheduleEntriesBulk(toCreate);
  }

  return {
    message: success 
      ? "Barcha darslar CSP algoritmi orqali 100% muvaffaqiyatli joylashtirildi!" 
      : `Ba'zi darslarni joylashtirib bo'lmadi. ${finalSchedule.length}/${lessonsToSchedule.length} ta dars tayyor.`,
    count: finalSchedule.length,
    coverage: Math.round((finalSchedule.length / lessonsToSchedule.length) * 100),
    success,
    stats: { steps, timeMs: Date.now() - startTime }
  };
}

export async function saveTimeSlotsFromRows(rowsRaw: any[]) {
  const rows = rowsRaw
    .map((row: any) => ({
      type: row.type === "lunch" ? "lunch" : "lesson",
      periodNumber: Number(row.type === "lesson" ? row.periodNumber : 0),
      startTime: String(row.startTime || "").slice(0, 5),
      endTime: String(row.endTime || "").slice(0, 5),
      meta: row.meta === "evening-lunch" ? "evening-lunch" : "day-lunch",
    }))
    .filter((row: any) => row.startTime && row.endTime);

  if (rows.length === 0) throw new Error("Qatorlar bo'sh bo'lmasligi kerak");

  const toCreate = DAYS.flatMap((day) =>
    rows.map((row) => ({
      name:
        row.type === "lesson"
          ? `${DAY_NAMES[day]} ${row.periodNumber}-dars`
          : row.meta === "evening-lunch"
            ? `${DAY_NAMES[day]} Kechki tushlik`
            : `${DAY_NAMES[day]} Tushlik tanaffusi`,
      startTime: row.startTime,
      endTime: row.endTime,
      dayOfWeek: day,
      periodNumber: row.type === "lesson" ? row.periodNumber : 0,
      isBreak: row.type === "lunch",
      isActive: true,
    }))
  );

  await db.transaction(async (tx) => {
    await tx.update(scheduleEntries).set({ isActive: false }).where(eq(scheduleEntries.isActive, true));
    await tx.update(timeSlots).set({ isActive: false }).where(eq(timeSlots.isActive, true));
    await tx.insert(timeSlots).values(toCreate);
  });

  return storage.getTimeSlots();
}
