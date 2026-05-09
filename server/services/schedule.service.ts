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
  // Higher grades and higher complexity subjects are harder to place
  lessonsToSchedule.sort((a, b) => b.grade - a.grade || b.complexity - a.complexity);

  const currentSchedule: any[] = [];
  const teacherBusy = new Set<string>();
  const roomBusy = new Set<string>();
  const classBusy = new Set<string>();
  const classDailyCount = new Map<string, number>();
  const subjectDailyCount = new Map<string, number>();

  // Backtracking Solver
  function solve(lessonIdx: number): boolean {
    if (lessonIdx >= lessonsToSchedule.length) return true;

    const lesson = lessonsToSchedule[lessonIdx];
    const maxDaily = getMaxHoursPerDay(String(lesson.grade));

    // Try each available slot
    for (const slot of activeSlots) {
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
      
      // Limit same subject per day
      const maxSameSubject = (lesson.grade >= 5 && lesson.complexity >= 6) ? 2 : 1;
      if ((subjectDailyCount.get(sdKey) || 0) >= maxSameSubject) continue;

      // Find suitable room
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

      // PLACE LESSON
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
      currentSchedule.push(entry);
      if (lesson.teacherId2 && room2) {
        currentSchedule.push({ ...entry, teacherId: lesson.teacherId2, roomId: room2.id });
      }

      // RECURSE
      if (solve(lessonIdx + 1)) return true;

      // BACKTRACK
      currentSchedule.pop();
      if (lesson.teacherId2) currentSchedule.pop();
      classDailyCount.set(cdKey, (classDailyCount.get(cdKey) || 0) - 1);
      subjectDailyCount.set(sdKey, (subjectDailyCount.get(sdKey) || 0) - 1);
      roomBusy.delete(`${room1.id}_${slot.id}`);
      if (room2) roomBusy.delete(`${room2.id}_${slot.id}`);
      teacherBusy.delete(tKey1);
      if (tKey2) teacherBusy.delete(tKey2);
      classBusy.delete(cKey);
    }

    return false; // No solution for this branch
  }

  // Start the search
  const success = solve(0);

  if (currentSchedule.length > 0) {
    await storage.createScheduleEntriesBulk(currentSchedule);
  }

  return {
    message: success 
      ? "Barcha darslar CSP algoritmi orqali 100% muvaffaqiyatli joylashtirildi!" 
      : "Ba'zi darslarni joylashtirib bo'lmadi (ziddiyatlar mavjud).",
    count: currentSchedule.length,
    coverage: Math.round((currentSchedule.length / lessonsToSchedule.length) * 100),
    success
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
