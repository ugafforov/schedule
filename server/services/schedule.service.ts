import { storage } from "../storage/index";
import { db } from "../db";
import { scheduleEntries, timeSlots, type InsertScheduleEntry, type ScheduleEntry } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { getSubjectComplexity, getMaxHoursPerDay, getSubjectCategory, type SubjectCategory } from "@shared/constants";

const DAYS = [1, 2, 3, 4, 5, 6];
const DAY_NAMES = ["", "Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba"];

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
  if (existing.length === 0) {
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

  // Backfill Saturday slots if missing for backward compatibility
  const hasSaturday = existing.some(s => Number(s.dayOfWeek) === 6);
  if (!hasSaturday) {
    const refDay = existing.find(s => Number(s.dayOfWeek) === 1) ? 1 : existing[0]?.dayOfWeek;
    if (refDay) {
      const refSlots = existing.filter(s => Number(s.dayOfWeek) === refDay);
      const toCreate: any[] = [];
      for (const slot of refSlots) {
        const baseName = slot.name.includes(" ") ? slot.name.split(" ").slice(1).join(" ") : slot.name;
        toCreate.push({
          name: `Shanba ${baseName}`,
          startTime: slot.startTime,
          endTime: slot.endTime,
          dayOfWeek: 6,
          periodNumber: slot.periodNumber,
          isBreak: slot.isBreak,
          isActive: true,
        });
      }
      for (const s of toCreate) {
        await storage.createTimeSlot(s);
      }
      return storage.getTimeSlots();
    }
  }

  return existing;
}

export interface GenerateScheduleOptions {
  classIds?: number[];
  clearExisting?: boolean;
}

const DAY_QUALITY: Record<number, number> = { 2: 10, 3: 10, 4: 9, 1: 7, 5: 6 };
const PERIOD_QUALITY: Record<number, number> = { 2: 10, 3: 10, 4: 10, 1: 7, 5: 7, 6: 5 };

export async function generateSchedule(options: GenerateScheduleOptions) {
  const { classIds, clearExisting } = options;

  if (clearExisting) {
    if (classIds?.length) {
      for (const cid of classIds) {
        await storage.clearScheduleForClass(cid);
      }
    } else {
      await storage.deleteAllScheduleEntries();
    }
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
    studyDays?: string;
    weekType: "always" | "surat" | "mahraj";
  }

  const lessonsToSchedule: LessonRequirement[] = [];
  for (const cls of targetClasses) {
    const classSubjectList = allClassSubjects.filter((cs) => cs.classId === cls.id);
    let altCount = 0; // Class-specific counter to alternate between surat and mahraj
    for (const cs of classSubjectList) {
      if (!cs.teacherId) continue;
      const sub = subjectMap.get(cs.subjectId);
      
      const hoursAlways = Math.floor(cs.weeklyHours);
      const hasHalf = (cs.weeklyHours - hoursAlways) >= 0.49;
      
      // 1. Always (har haftalik) darslar
      for (let i = 0; i < hoursAlways; i++) {
        lessonsToSchedule.push({
          id: `${cls.id}_${cs.subjectId}_always_${i}`,
          classId: cls.id,
          subjectId: cs.subjectId,
          teacherId: cs.teacherId,
          teacherId2: cs.teacherId2 || null,
          weeklyHours: cs.weeklyHours,
          complexity: getSubjectComplexity(sub?.name || ""),
          category: getSubjectCategory(sub?.name || ""),
          grade: parseInt(String(cls.grade)),
          studyDays: cls.studyDays || "1,2,3,4,5",
          weekType: "always",
        });
      }
      
      // 2. Juft/Toq haftalik dars (0.5 soat qismi uchun)
      if (hasHalf) {
        const weekType = altCount % 2 === 0 ? "surat" : "mahraj";
        altCount++;
        lessonsToSchedule.push({
          id: `${cls.id}_${cs.subjectId}_alt_${weekType}`,
          classId: cls.id,
          subjectId: cs.subjectId,
          teacherId: cs.teacherId,
          teacherId2: cs.teacherId2 || null,
          weeklyHours: cs.weeklyHours,
          complexity: getSubjectComplexity(sub?.name || ""),
          category: getSubjectCategory(sub?.name || ""),
          grade: parseInt(String(cls.grade)),
          studyDays: cls.studyDays || "1,2,3,4,5",
          weekType,
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

  // Helpers to check and set week-type aware busy states
  function isEntityBusy(
    busySet: Set<string>,
    entityId: number,
    slotId: number,
    weekType: "always" | "surat" | "mahraj"
  ): boolean {
    if (busySet.has(`${entityId}_${slotId}_always`)) return true;
    if (weekType === "always") {
      return busySet.has(`${entityId}_${slotId}_surat`) || busySet.has(`${entityId}_${slotId}_mahraj`);
    }
    return busySet.has(`${entityId}_${slotId}_${weekType}`);
  }

  function markEntityBusy(
    busySet: Set<string>,
    entityId: number,
    slotId: number,
    weekType: "always" | "surat" | "mahraj"
  ) {
    busySet.add(`${entityId}_${slotId}_${weekType}`);
  }
  
  const roomsByType = new Map<string, typeof allRooms>();
  roomsByType.set("any", allRooms);
  for (const r of allRooms) {
    if (r.roomType !== "any") {
      const list = roomsByType.get(r.roomType) || [];
      list.push(r);
      roomsByType.set(r.roomType, list);
    }
  }
  
  const finalSchedule: InsertScheduleEntry[] = [];
  const generatedConflicts: Array<{
    conflictType: string;
    description: string;
    severity: string;
    _key: { classId: number; subjectId: number; teacherId: number; timeSlotId: number; weekType: "always" | "surat" | "mahraj" };
  }> = [];
  const skippedLessons: Array<{ classId: number; subjectId: string; reason: string }> = [];
  let placedLessons = 0;
  
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
      
      // 1. Check if class studies on this day (hard constraint)
      const classStudyDays = lesson.studyDays ? lesson.studyDays.split(",").map(Number) : [1, 2, 3, 4, 5];
      if (!classStudyDays.includes(Number(day))) {
        continue;
      }
      
      // 2. Class busy check (hard constraint)
      if (isEntityBusy(classBusy, lesson.classId, slotId, lesson.weekType)) {
        continue;
      }
      
      // 3. Teacher busy checks (hard constraint)
      if (isEntityBusy(teacherBusy, lesson.teacherId, slotId, lesson.weekType)) {
        continue;
      }
      
      const tKey2 = lesson.teacherId2;
      if (tKey2 && isEntityBusy(teacherBusy, tKey2, slotId, lesson.weekType)) {
        continue;
      }
      
      // 4. Teacher unavailability checks (hard constraint)
      if (unavailSet.has(`${lesson.teacherId}_${day}_${slot.periodNumber}`)) {
        continue;
      }
      if (lesson.teacherId2 && unavailSet.has(`${lesson.teacherId2}_${day}_${slot.periodNumber}`)) {
        continue;
      }
      
      // 5. Room availability check (hard constraint)
      const candidateRooms = roomsByType.get(lesson.reqType) || roomsByType.get("any") || [];
      const requiredCapacity = lesson.teacherId2 ? lesson.classStudents / 2 : lesson.classStudents;
      const suitableRooms = candidateRooms.filter(r => 
        r.capacity >= requiredCapacity && 
        !isEntityBusy(roomBusy, r.id, slotId, lesson.weekType)
      );
      
      let room1 = null, room2 = null;
      if (!lesson.teacherId2) {
        if (suitableRooms.length > 0) {
          room1 = suitableRooms[0];
        } else {
          continue; // No free suitable room
        }
      } else {
        if (suitableRooms.length >= 2) {
          room1 = suitableRooms[0];
          room2 = suitableRooms[1];
        } else {
          continue; // Not enough free suitable rooms for split lesson
        }
      }

      // Calculate soft conflicts (penalties)
      let conflicts = 0;
      let reasons: string[] = [];
      
      const cdKey = `${lesson.classId}_${day}`;
      const loadVal = lesson.weekType === "always" ? 1 : 0.5;
      if ((classDailyCount.get(cdKey) || 0) + loadVal > lesson.maxDaily) { 
        conflicts += 50; 
        reasons.push("Sinf uchun kunlik dars soati oshib ketdi"); 
      }
      
      const sdKey = `${lesson.classId}_${lesson.subjectId}_${day}`;
      if ((subjectDailyCount.get(sdKey) || 0) + loadVal > lesson.maxSameSubject) { 
        conflicts += 30; 
        reasons.push("Bir kunda ayni shu fandan darslar ko'payib ketdi"); 
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
      
      markEntityBusy(classBusy, lesson.classId, slotId, lesson.weekType);
      markEntityBusy(teacherBusy, lesson.teacherId, slotId, lesson.weekType);
      if (lesson.teacherId2) {
        markEntityBusy(teacherBusy, lesson.teacherId2, slotId, lesson.weekType);
      }
      markEntityBusy(roomBusy, bestRoom1.id, slotId, lesson.weekType);
      if (bestRoom2) {
        markEntityBusy(roomBusy, bestRoom2.id, slotId, lesson.weekType);
      }
      
      const loadVal = lesson.weekType === "always" ? 1 : 0.5;
      classDailyCount.set(`${lesson.classId}_${day}`, (classDailyCount.get(`${lesson.classId}_${day}`) || 0) + loadVal);
      subjectDailyCount.set(`${lesson.classId}_${lesson.subjectId}_${day}`, (subjectDailyCount.get(`${lesson.classId}_${lesson.subjectId}_${day}`) || 0) + loadVal);

      const entry1: InsertScheduleEntry = { 
        classId: lesson.classId, 
        subjectId: lesson.subjectId, 
        teacherId: lesson.teacherId, 
        roomId: bestRoom1.id, 
        timeSlotId: slotId, 
        weekType: lesson.weekType, 
        isActive: true 
      };
      finalSchedule.push(entry1);
      placedLessons++;
      
      if (leastConflicts >= 100 || bestConflictReasons.length > 0) {
        generatedConflicts.push({
          conflictType: "schedule_overlap",
          description: `Ziddiyat (${lesson.classId}-sinf): ${bestConflictReasons.join(", ")}`,
          severity: leastConflicts >= 100 ? "high" : "medium",
          _key: { classId: lesson.classId, subjectId: lesson.subjectId, teacherId: lesson.teacherId, timeSlotId: slotId, weekType: lesson.weekType },
        });
      }

      if (lesson.teacherId2 && bestRoom2) {
        const entry2: InsertScheduleEntry = { ...entry1, teacherId: lesson.teacherId2, roomId: bestRoom2.id };
        finalSchedule.push(entry2);
      }
    } else {
      // Joylashtirib bo'lmagan darsni hisobga olish
      skippedLessons.push({
        classId: lesson.classId,
        subjectId: String(lesson.subjectId),
        reason: "Barcha slotlar band yoki mos xona topilmadi",
      });
    }
  }

  console.log(`[Greedy] Finished. Placed ${placedLessons}/${precomputedLessons.length} lessons. Skipped: ${skippedLessons.length}. Conflicts: ${generatedConflicts.length}`);

  if (finalSchedule.length > 0) {
    const insertedEntries = await storage.createScheduleEntriesBulk(finalSchedule);
    
    // Conflict'larni content-matching orqali to'g'ri entry ga bog'lash
    if (generatedConflicts.length > 0) {
      const entryByKey = new Map<string, ScheduleEntry>();
      for (const e of insertedEntries) {
        const key = `${e.classId}_${e.subjectId}_${e.teacherId}_${e.timeSlotId}_${e.weekType}`;
        entryByKey.set(key, e);
      }
      for (const c of generatedConflicts) {
        const key = `${c._key.classId}_${c._key.subjectId}_${c._key.teacherId}_${c._key.timeSlotId}_${c._key.weekType}`;
        const entry = entryByKey.get(key);
        await storage.createConflict({
          conflictType: c.conflictType,
          description: c.description,
          severity: c.severity,
          scheduleEntry1Id: entry?.id ?? null,
        });
      }
    }
  }

  const coverage = precomputedLessons.length > 0
    ? Math.round((placedLessons / precomputedLessons.length) * 100) : 100;

  return {
    message: coverage === 100
      ? `Barcha ${placedLessons} ta dars jadvalga kiritildi. ${generatedConflicts.length} ta dars bo'yicha ziddiyatlar mavjud.`
      : `${placedLessons}/${precomputedLessons.length} ta dars joylashtirildi (${skippedLessons.length} ta o'tkazib yuborildi). ${generatedConflicts.length} ta ziddiyatlar mavjud.`,
    count: finalSchedule.length,
    coverage,
    skipped: skippedLessons,
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