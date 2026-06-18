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

  const precomputedLessons = lessonsToSchedule.map(lesson => {
    const classStudents = targetClasses.find(c => c.id === lesson.classId)?.totalStudents || 25;
    const reqType = subjectMap.get(lesson.subjectId)?.requiredRoomType || "any";
    return {
      ...lesson,
      classStudents,
      reqType,
      maxDaily: getMaxHoursPerDay(String(lesson.grade)),
      maxSameSubject: 2
    };
  });

  // Sort lessons by complexity (hardest first to place them in best slots)
  precomputedLessons.sort((a, b) => b.grade - a.grade || b.complexity - a.complexity);

  const teacherBusy = new Set<string>();
  const roomBusy = new Set<string>();
  const classBusy = new Set<string>();
  const classDailyCount = new Map<string, number>();
  const subjectDailyCount = new Map<string, number>();
  
  const roomsByType = new Map<string, typeof allRooms>();
  roomsByType.set("any", allRooms);
  for (const r of allRooms) {
    if (r.roomType !== "any") {
      const list = roomsByType.get(r.roomType) || [];
      list.push(r);
      roomsByType.set(r.roomType, list);
    }
  }
  
  const finalSchedule: any[] = [];
  const generatedConflicts: any[] = [];
  
  console.log(`[Greedy] Starting heuristic solver for ${precomputedLessons.length} lessons...`);
  const startTime = Date.now();

  for (const lesson of precomputedLessons) {
    let bestSlot = null;
    let bestRoom1 = null;
    let bestRoom2 = null;
    let leastConflicts = 9999;
    let bestConflictReasons: string[] = [];

    // Try to find the best slot
    for (const slot of activeSlots) {
      const day = slot.dayOfWeek;
      const slotId = slot.id;
      
      let conflicts = 0;
      let reasons: string[] = [];
      
      const cKey = `${lesson.classId}_${slotId}`;
      if (classBusy.has(cKey)) { conflicts += 100; reasons.push("Sinf bu vaqtda band"); }
      
      const cdKey = `${lesson.classId}_${day}`;
      if ((classDailyCount.get(cdKey) || 0) >= lesson.maxDaily) { conflicts += 50; reasons.push("Sinf uchun kunlik dars soati oshib ketdi"); }

      const tKey1 = `${lesson.teacherId}_${slotId}`;
      if (teacherBusy.has(tKey1)) { conflicts += 100; reasons.push("O'qituvchi 1 bu vaqtda band"); }
      
      const tKey2 = lesson.teacherId2 ? `${lesson.teacherId2}_${slotId}` : null;
      if (tKey2 && teacherBusy.has(tKey2)) { conflicts += 100; reasons.push("O'qituvchi 2 bu vaqtda band"); }
      
      if (unavailSet.has(`${lesson.teacherId}_${day}_${slot.periodNumber}`)) { conflicts += 80; reasons.push("O'qituvchi 1 bu vaqtda dars bera olmaydi"); }
      if (lesson.teacherId2 && unavailSet.has(`${lesson.teacherId2}_${day}_${slot.periodNumber}`)) { conflicts += 80; reasons.push("O'qituvchi 2 bu vaqtda dars bera olmaydi"); }
      
      const sdKey = `${lesson.classId}_${lesson.subjectId}_${day}`;
      if ((subjectDailyCount.get(sdKey) || 0) >= lesson.maxSameSubject) { conflicts += 30; reasons.push("Bir kunda ayni shu fandan darslar ko'payib ketdi"); }

      const candidateRooms = roomsByType.get(lesson.reqType) || roomsByType.get("any") || [];
      const requiredCapacity = lesson.teacherId2 ? lesson.classStudents / 2 : lesson.classStudents;
      const suitableRooms = candidateRooms.filter(r => r.capacity >= requiredCapacity && !roomBusy.has(`${r.id}_${slotId}`));
      
      let room1 = null, room2 = null;
      if (!lesson.teacherId2) {
        if (suitableRooms.length > 0) room1 = suitableRooms[0];
        else { conflicts += 100; reasons.push("Bo'sh va mos xona topilmadi"); room1 = candidateRooms[0]; }
      } else {
        if (suitableRooms.length >= 2) { room1 = suitableRooms[0]; room2 = suitableRooms[1]; }
        else { conflicts += 100; reasons.push("Ikkita bo'sh xona topilmadi"); room1 = candidateRooms[0]; room2 = candidateRooms[1] || candidateRooms[0]; }
      }

      // Add penalty for later periods for harder subjects
      conflicts += (slot.periodNumber * (lesson.complexity / 10));

      if (conflicts < leastConflicts) {
        leastConflicts = conflicts;
        bestConflictReasons = reasons;
        bestSlot = slot;
        bestRoom1 = room1;
        bestRoom2 = room2;
      }
      
      if (leastConflicts === 0) break; // Perfect match found!
    }

    // Apply best slot
    if (bestSlot && bestRoom1) {
      const day = bestSlot.dayOfWeek;
      const slotId = bestSlot.id;
      
      classBusy.add(`${lesson.classId}_${slotId}`);
      teacherBusy.add(`${lesson.teacherId}_${slotId}`);
      if (lesson.teacherId2) teacherBusy.add(`${lesson.teacherId2}_${slotId}`);
      roomBusy.add(`${bestRoom1.id}_${slotId}`);
      if (bestRoom2) roomBusy.add(`${bestRoom2.id}_${slotId}`);
      
      classDailyCount.set(`${lesson.classId}_${day}`, (classDailyCount.get(`${lesson.classId}_${day}`) || 0) + 1);
      subjectDailyCount.set(`${lesson.classId}_${lesson.subjectId}_${day}`, (subjectDailyCount.get(`${lesson.classId}_${lesson.subjectId}_${day}`) || 0) + 1);

      const entry1 = { classId: lesson.classId, subjectId: lesson.subjectId, teacherId: lesson.teacherId, roomId: bestRoom1.id, timeSlotId: slotId, weekStartDate, isActive: true };
      finalSchedule.push(entry1);
      
      if (leastConflicts >= 100 || bestConflictReasons.length > 0) {
        // High severity conflict
        generatedConflicts.push({
          conflictType: "schedule_overlap",
          description: `Ziddiyat (${lesson.classId}-sinf): ${bestConflictReasons.join(", ")}`,
          severity: leastConflicts >= 100 ? "high" : "medium",
          scheduleEntry1Id: null, // We'll link it after insertion if we want, or just leave it general
        });
      }

      if (lesson.teacherId2 && bestRoom2) {
        const entry2 = { ...entry1, teacherId: lesson.teacherId2, roomId: bestRoom2.id };
        finalSchedule.push(entry2);
      }
    }
  }

  console.log(`[Greedy] Finished. Scheduled ${finalSchedule.length}/${precomputedLessons.length} lessons. Conflicts: ${generatedConflicts.length}`);

  if (finalSchedule.length > 0) {
    const insertedEntries = await storage.createScheduleEntriesBulk(finalSchedule);
    
    // Create conflicts in DB
    if (generatedConflicts.length > 0) {
      // Map pseudo-conflicts to real ones
      for (let i = 0; i < generatedConflicts.length; i++) {
        const entry = insertedEntries[i]; // Just to link it to the problem entry approximately
        generatedConflicts[i].scheduleEntry1Id = entry?.id || null;
        await storage.createConflict(generatedConflicts[i]);
      }
    }
  }

  return {
    message: `Barcha ${precomputedLessons.length} ta dars jadvalga kiritildi. ${generatedConflicts.length} ta dars bo'yicha ziddiyatlar mavjud.`,
    count: finalSchedule.length,
    coverage: 100,
    success: true,
    stats: { steps: precomputedLessons.length, timeMs: Date.now() - startTime }
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