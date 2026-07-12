import { storage } from "../storage/index";
import { db } from "../db";
import { scheduleEntries, timeSlots, type InsertScheduleEntry, type ScheduleEntry } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { getSubjectComplexity, getMaxHoursPerDay, getSubjectCategory, type SubjectCategory, getMaxDailyComplexity } from "@shared/constants";
import { DomainError } from "../errors";
import { attemptRelocations, minimizeGaps, type MovablePlacedLesson, type SkippedLessonInput } from "./schedule-optimizer";

const DAYS = [1, 2, 3, 4, 5, 6];
const DAY_NAMES = ["", "Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba"];

// SanPiN tavsiyasi: 2-3-darsdan keyin 20-30 daqiqa tushlik tanaffusi (docs/domain/scheduling-rules.md, 4-bo'lim).
const DEFAULT_TIME_SLOTS = [
  { type: "lesson" as const, period: 1, name: "1-dars", start: "08:00", end: "08:45" },
  { type: "lesson" as const, period: 2, name: "2-dars", start: "09:00", end: "09:45" },
  { type: "lesson" as const, period: 3, name: "3-dars", start: "10:00", end: "10:45" },
  { type: "lunch" as const, period: 0, name: "Tushlik tanaffusi", start: "10:45", end: "11:10" },
  { type: "lesson" as const, period: 4, name: "4-dars", start: "11:10", end: "11:55" },
  { type: "lesson" as const, period: 5, name: "5-dars", start: "12:05", end: "12:50" },
  { type: "lesson" as const, period: 6, name: "6-dars", start: "13:00", end: "13:45" },
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
          periodNumber: slot.type === "lesson" ? slot.period : 0,
          isBreak: slot.type === "lunch",
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

function wouldCreateGap(periodsUsed: Set<number> | undefined, newPeriod: number): boolean {
  if (!periodsUsed || periodsUsed.size === 0) return false;
  const all = new Set(Array.from(periodsUsed));
  all.add(newPeriod);
  const arr = Array.from(all);
  const min = Math.min(...arr);
  const max = Math.max(...arr);
  for (let p = min + 1; p < max; p++) {
    if (!all.has(p)) return true;
  }
  return false;
}

function computeSoftPenalties(
  classIds: number[],
  subjectId: number,
  grade: number,
  complexity: number,
  category: SubjectCategory,
  day: number,
  periodNumber: number,
  loadVal: number,
  maxDaily: number,
  maxSameSubject: number,
  classDailyCount: Map<string, number>,
  subjectDailyCount: Map<string, number>,
  classDailyComplexity: Map<string, number>,
  subjectDaysUsed: Map<string, Set<number>>,
  classPeriodsUsed: Map<string, Set<number>>,
  studyDaysCount: number,
): { conflicts: number; reasons: string[] } {
  let conflicts = 0;
  const reasons: string[] = [];

  for (const cid of classIds) {
    const cdKey = `${cid}_${day}`;
    if ((classDailyCount.get(cdKey) || 0) + loadVal > maxDaily) {
      conflicts += 50;
      reasons.push(`Sinf (${cid}) uchun kunlik dars soati oshib ketdi`);
    }

    const sdKey = `${cid}_${subjectId}_${day}`;
    if ((subjectDailyCount.get(sdKey) || 0) + loadVal > maxSameSubject) {
      conflicts += 30;
      reasons.push(`Sinf (${cid}) uchun bir kunda ayni shu fandan darslar ko'payib ketdi`);
    }

    const dayComplexity = classDailyComplexity.get(cdKey) || 0;
    const newComplexity = dayComplexity + complexity * loadVal;
    const maxDailyComp = getMaxDailyComplexity(grade, day);
    if (newComplexity > maxDailyComp) {
      conflicts += (newComplexity - maxDailyComp) * 5;
      reasons.push(`Sinf (${cid}) uchun kunlik aqliy zo'riqish chegarasi (SanPiN) oshib ketdi`);
    }

    const usedDays = subjectDaysUsed.get(`${cid}_${subjectId}`);
    if (usedDays && (usedDays.has(day - 1) || usedDays.has(day + 1))) {
      conflicts += 15;
      reasons.push(`Sinf (${cid}) uchun "${subjectId}"-fan ketma-ket kunlarga qo'yildi (kunora tavsiya etiladi)`);
    }

    // S6: Sinf jadvalida "oyna" (gap) paydo bo'lishini jarimalaymiz
    if (wouldCreateGap(classPeriodsUsed.get(cdKey), periodNumber)) {
      conflicts += 20;
      reasons.push(`Sinf (${cid}) jadvalida kun ichida bo'sh oraliq (oyna) paydo bo'ladi`);
    }

    // S11: Haftalik murakkablik balansi
    if (studyDaysCount > 1) {
      const allDayTotals: number[] = [];
      for (let d = 1; d <= 6; d++) {
        allDayTotals.push(classDailyComplexity.get(`${cid}_${d}`) || 0);
      }
      const thisDayTotal = allDayTotals[day - 1] + complexity * loadVal;
      allDayTotals[day - 1] = thisDayTotal;
      const avg = allDayTotals.reduce((a, b) => a + b, 0) / studyDaysCount;
      if (avg > 0) {
        const deviation = Math.abs(thisDayTotal - avg);
        if (deviation > avg * 0.3) {
          conflicts += Math.round(deviation * 2);
          reasons.push(`Sinf (${cid}) haftalik murakkablik balansi buzildi`);
        }
      }
    }
  }

  if (category === "dynamic" && periodNumber <= 3) {
    conflicts += (4 - periodNumber) * 10;
    reasons.push(`Yengil fanlar tushdan keyin (4, 5, 6-darslarga) qo'yilishi tavsiya etiladi`);
  }
  if (category === "mental" && periodNumber >= 5) {
    conflicts += (periodNumber - 4) * 10;
    reasons.push(`Qiyin fanlar kunning birinchi yarmiga (2, 3-darslarga) qo'yilishi kerak`);
  }

  return { conflicts, reasons };
}

export interface FeasibilityError {
  type: "class_overflow" | "teacher_overload" | "room_shortage" | "unassigned";
  entity: string;
  demand: number;
  supply: number;
  message: string;
}

export interface FeasibilityResult {
  feasible: boolean;
  errors: FeasibilityError[];
  warnings: Array<{ type: string; message: string }>;
}

export function checkFeasibility(
  classes: Array<{ id: number; name: string; grade: string; studyDays: string }>,
  classSubjects: Array<{ classId: number; subjectId: number; teacherId: number | null; weeklyHours: number }>,
  teachers: Array<{ id: number; firstName: string; lastName: string; maxHoursPerWeek: number | null }>,
  rooms: Array<{ id: number; roomType: string }>,
  subjects: Array<{ id: number; name: string; requiredRoomType: string }>,
  unavailability: Array<{ teacherId: number }>,
  activeSlotsPerDay: number,
): FeasibilityResult {
  const errors: FeasibilityError[] = [];
  const warnings: Array<{ type: string; message: string }> = [];

  const subjectMap = new Map(subjects.map(s => [s.id, s]));

  for (const cls of classes) {
    const studyDays = (cls.studyDays || "1,2,3,4,5").split(",");
    const maxPerDay = getMaxHoursPerDay(cls.grade);
    const totalSlots = studyDays.length * maxPerDay;
    const totalRequired = classSubjects
      .filter(cs => cs.classId === cls.id)
      .reduce((sum, cs) => sum + cs.weeklyHours, 0);
    if (totalRequired > totalSlots) {
      errors.push({
        type: "class_overflow",
        entity: cls.name,
        demand: totalRequired,
        supply: totalSlots,
        message: `${cls.name}: ${totalRequired} soat kerak, lekin ${totalSlots} slot mavjud`,
      });
    }
  }

  const teacherDemand = new Map<number, number>();
  for (const cs of classSubjects) {
    if (cs.teacherId) {
      teacherDemand.set(cs.teacherId, (teacherDemand.get(cs.teacherId) || 0) + cs.weeklyHours);
    }
  }
  const teacherUnavailCounts = new Map<number, number>();
  for (const u of unavailability) {
    teacherUnavailCounts.set(u.teacherId, (teacherUnavailCounts.get(u.teacherId) || 0) + 1);
  }
  for (const t of teachers) {
    const demand = teacherDemand.get(t.id) || 0;
    if (demand === 0) continue;
    const maxCapacity = t.maxHoursPerWeek || 30;
    const unavailCount = teacherUnavailCounts.get(t.id) || 0;
    const totalSlotsForTeacher = activeSlotsPerDay * 6;
    const realCapacity = Math.min(maxCapacity, totalSlotsForTeacher - unavailCount);
    const name = `${t.firstName} ${t.lastName}`.trim();
    if (demand > realCapacity) {
      errors.push({
        type: "teacher_overload",
        entity: name,
        demand,
        supply: realCapacity,
        message: `${name}: ${demand} soat talab, lekin ${realCapacity} slot mavjud`,
      });
    } else if (demand > realCapacity * 0.85) {
      warnings.push({
        type: "teacher_overload",
        message: `${name}: yuklamasi yuqori (${demand}/${realCapacity})`,
      });
    }
  }

  const roomTypes = ["classroom", "lab", "computer", "gym", "music", "art"] as const;
  for (const rt of roomTypes) {
    const roomCount = rooms.filter(r => r.roomType === rt).length;
    if (roomCount === 0) continue;
    let demandSlots = 0;
    for (const cs of classSubjects) {
      const sub = subjectMap.get(cs.subjectId);
      if (sub && sub.requiredRoomType === rt) {
        demandSlots += cs.weeklyHours;
      }
    }
    if (demandSlots === 0) continue;
    const supplySlots = roomCount * activeSlotsPerDay * 6;
    if (demandSlots > supplySlots) {
      errors.push({
        type: "room_shortage",
        entity: rt,
        demand: demandSlots,
        supply: supplySlots,
        message: `${rt}: ${demandSlots} soat kerak, ${roomCount} xona × ${activeSlotsPerDay * 6} slot = ${supplySlots} slot`,
      });
    } else if (demandSlots > supplySlots * 0.80) {
      warnings.push({
        type: "room_shortage",
        message: `${rt} xonasi sig'imi: ${demandSlots}/${supplySlots} (80%+)`,
      });
    }
  }

  // "any" (requiredRoomType belgilanmagan/umumiy) darslar — solverda istalgan xonaga
  // joylashtiriladi (roomsByType.get("any") === barcha xonalar), shuning uchun bu yerda
  // ham umumiy sig'im (BARCHA xonalar) bilan solishtiriladi. Boshqa turdagi darslar bilan
  // bir xil xonaga da'vogarlik hisobga olinmaydi (soddalashtirilgan tekshiruv).
  {
    let anyDemandSlots = 0;
    for (const cs of classSubjects) {
      const sub = subjectMap.get(cs.subjectId);
      if (sub && (!sub.requiredRoomType || sub.requiredRoomType === "any")) {
        anyDemandSlots += cs.weeklyHours;
      }
    }
    if (anyDemandSlots > 0 && rooms.length > 0) {
      const anySupplySlots = rooms.length * activeSlotsPerDay * 6;
      if (anyDemandSlots > anySupplySlots) {
        errors.push({
          type: "room_shortage",
          entity: "any",
          demand: anyDemandSlots,
          supply: anySupplySlots,
          message: `Umumiy xonalar: ${anyDemandSlots} soat kerak, ${rooms.length} xona × ${activeSlotsPerDay * 6} slot = ${anySupplySlots} slot`,
        });
      } else if (anyDemandSlots > anySupplySlots * 0.80) {
        warnings.push({
          type: "room_shortage",
          message: `Umumiy xonalar sig'imi: ${anyDemandSlots}/${anySupplySlots} (80%+)`,
        });
      }
    }
  }

  const unassigned = classSubjects.filter(cs => !cs.teacherId);
  if (unassigned.length > 0) {
    warnings.push({
      type: "unassigned",
      message: `${unassigned.length} ta fan-sinf juftligiga o'qituvchi biriktirilmagan`,
    });
  }

  return { feasible: errors.length === 0, errors, warnings };
}

export interface GenerateScheduleOptions {
  classIds?: number[];
  clearExisting?: boolean;
}

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

  const [allClasses, allRooms, allClassSubjects, allSubjects, allUnavailability, allTeachers, allJointLessons] =
    await Promise.all([
      storage.getClasses(),
      storage.getRooms(),
      storage.getAllClassSubjects(),
      storage.getSubjects(),
      storage.getAllTeacherUnavailability(),
      storage.getTeachers(),
      storage.getJointLessons(),
    ]);

  const targetClasses = classIds?.length
    ? allClasses.filter((c) => classIds.includes(c.id))
    : allClasses;

  const targetJointLessons = classIds?.length
    ? allJointLessons.filter((jl) => jl.classIds.some((cid: number) => classIds.includes(cid)))
    : allJointLessons;

  if (targetClasses.length === 0) throw new DomainError("Sinflar mavjud emas.");
  if (allRooms.length === 0) throw new DomainError("Xonalar mavjud emas.");

  const periodsPerDay = new Set(activeSlots.filter(s => Number(s.dayOfWeek) === 1).map(s => s.periodNumber)).size
    || activeSlots.filter(s => Number(s.dayOfWeek) === activeSlots[0]?.dayOfWeek).length;
  const feasibility = checkFeasibility(
    targetClasses, allClassSubjects, allTeachers, allRooms, allSubjects, allUnavailability, periodsPerDay,
  );

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
    isJoint?: boolean;
    jointLessonId?: number;
    classIds?: number[];
    groups?: Array<{ groupName: string; teacherId: number; roomId?: number | null }>;
    roomId?: number | null;
    defaultRoomId?: number | null;
  }

  const lessonsToSchedule: LessonRequirement[] = [];
  
  // 1. Regular class-subject lessons
  for (const cls of targetClasses) {
    const classSubjectList = allClassSubjects.filter((cs) => cs.classId === cls.id);
    let altCount = 0; // Class-specific counter to alternate between surat and mahraj
    for (const cs of classSubjectList) {
      if (!cs.teacherId) continue;

      // Birlashtirilgan darslar (joint lessons) tarkibidagi fanlarni oddiy rejimda generatsiya qilmaymiz
      const isPartOfJoint = allJointLessons.some(jl => 
        jl.subjectId === cs.subjectId && jl.classIds.includes(cls.id)
      );
      if (isPartOfJoint) {
        continue;
      }

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
          roomId: (cs as any).roomId || null,
          defaultRoomId: cls.defaultRoomId || null,
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
          roomId: (cs as any).roomId || null,
          defaultRoomId: cls.defaultRoomId || null,
        });
      }
    }
  }

  // 2. Joint (birlashtirilgan) lessons
  for (const jl of targetJointLessons) {
    const sub = subjectMap.get(jl.subjectId);
    if (!sub) continue;

    const hoursAlways = Math.floor(jl.weeklyHours);
    const hasHalf = (jl.weeklyHours - hoursAlways) >= 0.49;

    for (let i = 0; i < hoursAlways; i++) {
      lessonsToSchedule.push({
        id: `joint_${jl.id}_always_${i}`,
        classId: jl.classIds[0],
        classIds: jl.classIds,
        subjectId: jl.subjectId,
        teacherId: jl.groups[0]?.teacherId || 0,
        teacherId2: null,
        weeklyHours: jl.weeklyHours,
        complexity: getSubjectComplexity(sub.name || ""),
        category: getSubjectCategory(sub.name || ""),
        grade: Math.max(...jl.classIds.map((cid: number) => {
          const c = targetClasses.find((cls) => cls.id === cid);
          return c ? parseInt(String(c.grade)) : 5;
        })),
        studyDays: "1,2,3,4,5,6", // checked dynamically per class
        weekType: "always",
        isJoint: true,
        jointLessonId: jl.id,
        groups: jl.groups,
      });
    }

    if (hasHalf) {
      lessonsToSchedule.push({
        id: `joint_${jl.id}_alt_surat`,
        classId: jl.classIds[0],
        classIds: jl.classIds,
        subjectId: jl.subjectId,
        teacherId: jl.groups[0]?.teacherId || 0,
        teacherId2: null,
        weeklyHours: jl.weeklyHours,
        complexity: getSubjectComplexity(sub.name || ""),
        category: getSubjectCategory(sub.name || ""),
        grade: Math.max(...jl.classIds.map((cid: number) => {
          const c = targetClasses.find((cls) => cls.id === cid);
          return c ? parseInt(String(c.grade)) : 5;
        })),
        studyDays: "1,2,3,4,5,6",
        weekType: "surat",
        isJoint: true,
        jointLessonId: jl.id,
        groups: jl.groups,
      });
    }
  }

  const precomputedLessons = lessonsToSchedule.map(lesson => {
    const classStudents = lesson.isJoint && lesson.classIds
      ? lesson.classIds.reduce((sum, cid) => sum + (targetClasses.find(c => c.id === cid)?.totalStudents || 25), 0)
      : (targetClasses.find(c => c.id === lesson.classId)?.totalStudents || 25);
    const reqType = subjectMap.get(lesson.subjectId)?.requiredRoomType || "any";
    // Juft dars (double period) qoidasi (docs/domain/scheduling-rules.md §2.B):
    // boshlang'ich sinfda (1-4) bir kunda bir fandan faqat 1 marta; yuqori sinfda
    // faqat laboratoriya talab qiladigan fanlar uchun bir kunda 2 martagacha ruxsat.
    const grade = Number(lesson.grade);
    const maxSameSubject = grade >= 1 && grade <= 4 ? 1 : (reqType === "lab" ? 2 : 1);
    return {
      ...lesson,
      classStudents,
      reqType,
      maxDaily: getMaxHoursPerDay(String(lesson.grade)),
      maxSameSubject,
    };
  });

  const teacherUnavailCount = new Map<number, number>();
  for (const u of allUnavailability) {
    teacherUnavailCount.set(u.teacherId, (teacherUnavailCount.get(u.teacherId) || 0) + 1);
  }
  precomputedLessons.sort((a, b) => {
    const jointA = (a.isJoint ? 1 : 0) + (a.teacherId2 ? 1 : 0);
    const jointB = (b.isJoint ? 1 : 0) + (b.teacherId2 ? 1 : 0);
    if (jointB !== jointA) return jointB - jointA;
    const specA = a.reqType !== "any" ? 1 : 0;
    const specB = b.reqType !== "any" ? 1 : 0;
    if (specB !== specA) return specB - specA;
    const tightA = teacherUnavailCount.get(a.teacherId) || 0;
    const tightB = teacherUnavailCount.get(b.teacherId) || 0;
    if (tightB !== tightA) return tightB - tightA;
    return b.grade - a.grade || b.complexity - a.complexity;
  });

  const teacherBusy = new Set<string>();
  const roomBusy = new Set<string>();
  const classBusy = new Set<string>();
  const classDailyCount = new Map<string, number>();
  const subjectDailyCount = new Map<string, number>();
  const classDailyComplexity = new Map<string, number>();
  const subjectDaysUsed = new Map<string, Set<number>>();
  const teacherDayRoom = new Map<string, number>();
  const classPeriodsUsed = new Map<string, Set<number>>();
  const teacherPeriodsUsed = new Map<string, Set<number>>();

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

  function unmarkEntityBusy(
    busySet: Set<string>,
    entityId: number,
    slotId: number,
    weekType: "always" | "surat" | "mahraj"
  ) {
    busySet.delete(`${entityId}_${slotId}_${weekType}`);
  }

  // Load existing active schedule entries to populate busy states for partial generation
  const existingEntries = await storage.getScheduleEntries();
  const clearedClassIds = new Set(classIds || []);
  
  // Find joint lesson IDs that will be cleared (because they involve a cleared class)
  const clearedJointLessonIds = new Set<number>();
  if (classIds?.length) {
    for (const e of existingEntries) {
      if (clearedClassIds.has(e.classId) && e.jointLessonId) {
        clearedJointLessonIds.add(e.jointLessonId);
      }
    }
  }

  for (const e of existingEntries) {
    // Skip entries that are being cleared
    const isClearedClass = clearedClassIds.has(e.classId);
    const isClearedJoint = e.jointLessonId && clearedJointLessonIds.has(e.jointLessonId);
    
    if (classIds?.length && (isClearedClass || isClearedJoint)) {
      continue;
    }
    
    // Mark as busy
    markEntityBusy(classBusy, e.classId, e.timeSlotId, e.weekType as any);
    markEntityBusy(teacherBusy, e.teacherId, e.timeSlotId, e.weekType as any);
    markEntityBusy(roomBusy, e.roomId, e.timeSlotId, e.weekType as any);
    
    // Also update daily count and subject count for class
    const slot = slots.find(s => s.id === e.timeSlotId);
    if (slot) {
      const day = slot.dayOfWeek;
      const loadVal = e.weekType === "always" ? 1 : 0.5;
      const cdKey = `${e.classId}_${day}`;
      classDailyCount.set(cdKey, (classDailyCount.get(cdKey) || 0) + loadVal);
      
      const sdKey = `${e.classId}_${e.subjectId}_${day}`;
      subjectDailyCount.set(sdKey, (subjectDailyCount.get(sdKey) || 0) + loadVal);
      
      const sub = subjectMap.get(e.subjectId);
      const subComp = sub ? getSubjectComplexity(sub.name || "") : 7;
      classDailyComplexity.set(cdKey, (classDailyComplexity.get(cdKey) || 0) + (subComp * loadVal));

      const sdaysKey = `${e.classId}_${e.subjectId}`;
      if (!subjectDaysUsed.has(sdaysKey)) subjectDaysUsed.set(sdaysKey, new Set());
      subjectDaysUsed.get(sdaysKey)!.add(Number(day));

      teacherDayRoom.set(`${e.teacherId}_${day}`, e.roomId);

      const cpKey = `${e.classId}_${day}`;
      if (!classPeriodsUsed.has(cpKey)) classPeriodsUsed.set(cpKey, new Set());
      classPeriodsUsed.get(cpKey)!.add(Number(slot.periodNumber));

      const tpKey = `${e.teacherId}_${day}`;
      if (!teacherPeriodsUsed.has(tpKey)) teacherPeriodsUsed.set(tpKey, new Set());
      teacherPeriodsUsed.get(tpKey)!.add(Number(slot.periodNumber));
    }
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
  const pendingSkips: Array<{ lesson: (typeof precomputedLessons)[number] }> = [];
  // Faza 3.3 local search uchun: shu generatsiyada joylashtirilgan, keyinroq boshqa
  // vaqtga ko'chirilishi mumkin bo'lgan oddiy (bitta o'qituvchili, birlashtirilmagan) darslar
  const movableLessons: MovablePlacedLesson[] = [];
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
      
      if (lesson.isJoint && lesson.classIds && lesson.groups) {
        // --- Joint Lesson Logic ---
        // 1. Check if all classes study on this day (hard constraint)
        let allStudy = true;
        for (const cid of lesson.classIds) {
          const cls = targetClasses.find(c => c.id === cid);
          const classStudyDays = cls?.studyDays ? cls.studyDays.split(",").map(Number) : [1, 2, 3, 4, 5];
          if (!classStudyDays.includes(Number(day))) {
            allStudy = false;
            break;
          }
        }
        if (!allStudy) continue;

        // 2. Class busy check (hard constraint)
        let anyClassBusy = false;
        for (const cid of lesson.classIds) {
          if (isEntityBusy(classBusy, cid, slotId, lesson.weekType)) {
            anyClassBusy = true;
            break;
          }
        }
        if (anyClassBusy) continue;

        // 3. Teacher busy checks (hard constraint)
        let anyTeacherBusy = false;
        for (const g of lesson.groups) {
          if (isEntityBusy(teacherBusy, g.teacherId, slotId, lesson.weekType)) {
            anyTeacherBusy = true;
            break;
          }
        }
        if (anyTeacherBusy) continue;

        // 4. Teacher unavailability checks (hard constraint)
        let anyTeacherUnavail = false;
        for (const g of lesson.groups) {
          if (unavailSet.has(`${g.teacherId}_${day}_${slot.periodNumber}`)) {
            anyTeacherUnavail = true;
            break;
          }
        }
        if (anyTeacherUnavail) continue;

        // 5. Room availability check (hard constraint)
        const avgCapacity = Math.ceil(lesson.classStudents / lesson.groups.length);
        const candidateRooms = roomsByType.get(lesson.reqType) || roomsByType.get("any") || [];
        const assignedRooms: any[] = [];
        let roomsOk = true;

        for (const g of lesson.groups) {
          if (g.roomId) {
            // Room pre-assigned
            const isBusy = isEntityBusy(roomBusy, g.roomId, slotId, lesson.weekType) || assignedRooms.some(r => r.id === g.roomId);
            if (isBusy) {
              roomsOk = false;
              break;
            }
            const roomObj = allRooms.find(r => r.id === g.roomId);
            assignedRooms.push(roomObj || { id: g.roomId });
          } else {
            // Find a free room
            const freeRoom = candidateRooms.find(r => 
              r.capacity >= avgCapacity &&
              !isEntityBusy(roomBusy, r.id, slotId, lesson.weekType) &&
              !assignedRooms.some(ar => ar.id === r.id)
            );
            if (!freeRoom) {
              roomsOk = false;
              break;
            }
            assignedRooms.push(freeRoom);
          }
        }

        if (!roomsOk) continue;

        const loadVal = lesson.weekType === "always" ? 1 : 0.5;
        const jStudyDaysCount = (lesson.studyDays || "1,2,3,4,5,6").split(",").length;
        let { conflicts, reasons } = computeSoftPenalties(
          lesson.classIds, lesson.subjectId, lesson.grade, lesson.complexity, lesson.category,
          day, slot.periodNumber, loadVal, lesson.maxDaily, lesson.maxSameSubject,
          classDailyCount, subjectDailyCount, classDailyComplexity, subjectDaysUsed,
          classPeriodsUsed, jStudyDaysCount,
        );
        for (const g of lesson.groups) {
          if (wouldCreateGap(teacherPeriodsUsed.get(`${g.teacherId}_${day}`), slot.periodNumber)) {
            conflicts += 15;
            reasons.push("O'qituvchi jadvalida oyna paydo bo'ladi");
          }
        }

        if (conflicts < leastConflicts) {
          leastConflicts = conflicts;
          bestConflictReasons = reasons;
          bestSlot = slot;
          bestRoom1 = assignedRooms;
        }

        if (leastConflicts === 0) break;

      } else {
        // --- Existing single lesson / legacy split lesson logic ---
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
            const targetRoomId = (lesson as any).roomId || (lesson.reqType === "any" ? (lesson as any).defaultRoomId : null);
            if (targetRoomId) {
              const matchedRoom = suitableRooms.find(r => r.id === targetRoomId);
              if (matchedRoom) {
                room1 = matchedRoom;
              } else {
                continue; // Assigned/default room is busy or not suitable!
              }
            } else {
              // Xona barqarorligi: o'qituvchi shu kuni allaqachon ishlatgan xona bo'sh bo'lsa, o'shani afzal ko'ramiz
              const preferredRoomId = teacherDayRoom.get(`${lesson.teacherId}_${day}`);
              room1 = suitableRooms.find(r => r.id === preferredRoomId) || suitableRooms[0];
            }
          } else {
            continue; // No free suitable room
          }
        } else {
          if (suitableRooms.length >= 2) {
            const targetRoomId = (lesson as any).roomId || (lesson.reqType === "any" ? (lesson as any).defaultRoomId : null);
            if (targetRoomId) {
              const matchedRoom = suitableRooms.find(r => r.id === targetRoomId);
              if (matchedRoom) {
                room1 = matchedRoom;
                room2 = suitableRooms.find(r => r.id !== targetRoomId) || null;
              }
            }
            if (!room1 || !room2) {
              room1 = suitableRooms[0];
              room2 = suitableRooms[1];
            }
          } else {
            continue; // Not enough free suitable rooms for split lesson
          }
        }

        const loadVal = lesson.weekType === "always" ? 1 : 0.5;
        const sStudyDaysCount = (lesson.studyDays || "1,2,3,4,5").split(",").length;
        let { conflicts, reasons } = computeSoftPenalties(
          [lesson.classId], lesson.subjectId, lesson.grade, lesson.complexity, lesson.category,
          day, slot.periodNumber, loadVal, lesson.maxDaily, lesson.maxSameSubject,
          classDailyCount, subjectDailyCount, classDailyComplexity, subjectDaysUsed,
          classPeriodsUsed, sStudyDaysCount,
        );
        if (wouldCreateGap(teacherPeriodsUsed.get(`${lesson.teacherId}_${day}`), slot.periodNumber)) {
          conflicts += 15;
          reasons.push("O'qituvchi jadvalida oyna paydo bo'ladi");
        }

        if (conflicts < leastConflicts) {
          leastConflicts = conflicts;
          bestConflictReasons = reasons;
          bestSlot = slot;
          bestRoom1 = room1;
          bestRoom2 = room2;
        }
        
        if (leastConflicts === 0) break; // Perfect match found!
      }
    }

    // Apply best slot
    if (bestSlot && bestRoom1) {
      const day = bestSlot.dayOfWeek;
      const slotId = bestSlot.id;
      
      if (lesson.isJoint && lesson.classIds && lesson.groups && Array.isArray(bestRoom1)) {
        // Mark all classes busy
        for (const cid of lesson.classIds) {
          markEntityBusy(classBusy, cid, slotId, lesson.weekType);
        }
        // Mark all teachers busy
        for (const g of lesson.groups) {
          markEntityBusy(teacherBusy, g.teacherId, slotId, lesson.weekType);
        }
        // Mark all rooms busy
        for (const r of bestRoom1) {
          if (r && r.id) {
            markEntityBusy(roomBusy, r.id, slotId, lesson.weekType);
          }
        }
        
        const loadVal = lesson.weekType === "always" ? 1 : 0.5;
        for (const cid of lesson.classIds) {
          classDailyCount.set(`${cid}_${day}`, (classDailyCount.get(`${cid}_${day}`) || 0) + loadVal);
          subjectDailyCount.set(`${cid}_${lesson.subjectId}_${day}`, (subjectDailyCount.get(`${cid}_${lesson.subjectId}_${day}`) || 0) + loadVal);
          classDailyComplexity.set(`${cid}_${day}`, (classDailyComplexity.get(`${cid}_${day}`) || 0) + (lesson.complexity * loadVal));
          const sdaysKey = `${cid}_${lesson.subjectId}`;
          if (!subjectDaysUsed.has(sdaysKey)) subjectDaysUsed.set(sdaysKey, new Set());
          subjectDaysUsed.get(sdaysKey)!.add(day);
        }
        for (const cid of lesson.classIds) {
          const cpKey = `${cid}_${day}`;
          if (!classPeriodsUsed.has(cpKey)) classPeriodsUsed.set(cpKey, new Set());
          classPeriodsUsed.get(cpKey)!.add(bestSlot.periodNumber);
        }
        for (let i = 0; i < lesson.groups.length; i++) {
          const roomObj = bestRoom1[i];
          const tid = lesson.groups[i].teacherId;
          if (roomObj?.id) teacherDayRoom.set(`${tid}_${day}`, roomObj.id);
          const tpKey = `${tid}_${day}`;
          if (!teacherPeriodsUsed.has(tpKey)) teacherPeriodsUsed.set(tpKey, new Set());
          teacherPeriodsUsed.get(tpKey)!.add(bestSlot.periodNumber);
        }

        // Create schedule entries: C classes * G groups
        for (const cid of lesson.classIds) {
          for (let i = 0; i < lesson.groups.length; i++) {
            const g = lesson.groups[i];
            const roomObj = bestRoom1[i];
            const entry: InsertScheduleEntry = {
              classId: cid,
              subjectId: lesson.subjectId,
              teacherId: g.teacherId,
              roomId: roomObj.id,
              timeSlotId: slotId,
              weekType: lesson.weekType,
              jointLessonId: lesson.jointLessonId,
              isActive: true
            };
            finalSchedule.push(entry);
          }
        }
        placedLessons++;
        
        if (leastConflicts >= 100 || bestConflictReasons.length > 0) {
          generatedConflicts.push({
            conflictType: "schedule_overlap",
            description: `Ziddiyat (Birlashtirilgan dars ${lesson.jointLessonId}): ${bestConflictReasons.join(", ")}`,
            severity: leastConflicts >= 100 ? "high" : "medium",
            _key: { classId: lesson.classIds[0], subjectId: lesson.subjectId, teacherId: lesson.groups[0].teacherId, timeSlotId: slotId, weekType: lesson.weekType },
          });
        }

      } else {
        // --- Existing single lesson / legacy split lesson logic ---
        markEntityBusy(classBusy, lesson.classId, slotId, lesson.weekType);
        markEntityBusy(teacherBusy, lesson.teacherId, slotId, lesson.weekType);
        if (lesson.teacherId2) {
          markEntityBusy(teacherBusy, lesson.teacherId2, slotId, lesson.weekType);
        }
        
        const r1Obj = bestRoom1 as any;
        markEntityBusy(roomBusy, r1Obj.id, slotId, lesson.weekType);
        if (bestRoom2) {
          markEntityBusy(roomBusy, bestRoom2.id, slotId, lesson.weekType);
        }
        
        const loadVal = lesson.weekType === "always" ? 1 : 0.5;
        classDailyCount.set(`${lesson.classId}_${day}`, (classDailyCount.get(`${lesson.classId}_${day}`) || 0) + loadVal);
        subjectDailyCount.set(`${lesson.classId}_${lesson.subjectId}_${day}`, (subjectDailyCount.get(`${lesson.classId}_${lesson.subjectId}_${day}`) || 0) + loadVal);
        classDailyComplexity.set(`${lesson.classId}_${day}`, (classDailyComplexity.get(`${lesson.classId}_${day}`) || 0) + (lesson.complexity * loadVal));
        const sdaysKey = `${lesson.classId}_${lesson.subjectId}`;
        if (!subjectDaysUsed.has(sdaysKey)) subjectDaysUsed.set(sdaysKey, new Set());
        subjectDaysUsed.get(sdaysKey)!.add(day);
        teacherDayRoom.set(`${lesson.teacherId}_${day}`, r1Obj.id);
        if (lesson.teacherId2 && bestRoom2) teacherDayRoom.set(`${lesson.teacherId2}_${day}`, bestRoom2.id);

        const cpKey = `${lesson.classId}_${day}`;
        if (!classPeriodsUsed.has(cpKey)) classPeriodsUsed.set(cpKey, new Set());
        classPeriodsUsed.get(cpKey)!.add(bestSlot.periodNumber);
        const tpKey = `${lesson.teacherId}_${day}`;
        if (!teacherPeriodsUsed.has(tpKey)) teacherPeriodsUsed.set(tpKey, new Set());
        teacherPeriodsUsed.get(tpKey)!.add(bestSlot.periodNumber);
        if (lesson.teacherId2) {
          const tp2Key = `${lesson.teacherId2}_${day}`;
          if (!teacherPeriodsUsed.has(tp2Key)) teacherPeriodsUsed.set(tp2Key, new Set());
          teacherPeriodsUsed.get(tp2Key)!.add(bestSlot.periodNumber);
        }

        const entry1: InsertScheduleEntry = { 
          classId: lesson.classId, 
          subjectId: lesson.subjectId, 
          teacherId: lesson.teacherId, 
          roomId: r1Obj.id, 
          timeSlotId: slotId, 
          weekType: lesson.weekType, 
          isActive: true 
        };
        finalSchedule.push(entry1);
        placedLessons++;

        // Faqat oddiy (bitta o'qituvchili) darslar keyinroq xavfsiz ko'chirilishi mumkin —
        // split (teacherId2) darslarni bitta tomonini ko'chirish juftlikni buzadi.
        if (!lesson.teacherId2) {
          const classStudyDaysForMove = lesson.studyDays ? lesson.studyDays.split(",").map(Number) : [1, 2, 3, 4, 5];
          movableLessons.push({
            index: finalSchedule.length - 1,
            classId: lesson.classId,
            teacherId: lesson.teacherId,
            roomId: r1Obj.id,
            timeSlotId: slotId,
            weekType: lesson.weekType,
            studyDays: classStudyDaysForMove,
          });
        }

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
      }
    } else {
      // Joylashtirib bo'lmagan darsni hisobga olish — Faza 3.3 local search'da qayta urinib ko'riladi
      pendingSkips.push({ lesson });
    }
  }

  // --- Faza 3.3: chegaralangan local search (retry-with-relaxation) ---
  // Joylashtirib bo'lmagan (skipped) oddiy darslar uchun: ularni to'sib turgan, shu
  // generatsiyada joylashtirilgan boshqa oddiy darsni bo'sh vaqtga ko'chirib, bo'shagan
  // joyga skipped darsni qo'yishga harakat qiladi (faqat "o'qituvchi band" turidagi
  // to'siqlar uchun — server/services/schedule-optimizer.ts).
  const resolvedSkipIndices = new Set<number>();
  const optimizableSkips = pendingSkips
    .map((p, idx) => ({ lesson: p.lesson, idx }))
    .filter((p) => !p.lesson.isJoint && !p.lesson.teacherId2);

  if (optimizableSkips.length > 0) {
    const skippedInputs: SkippedLessonInput[] = optimizableSkips.map((p) => {
      const lesson = p.lesson;
      const studyDays = lesson.studyDays ? lesson.studyDays.split(",").map(Number) : [1, 2, 3, 4, 5];
      const candidateRooms = roomsByType.get(lesson.reqType) || roomsByType.get("any") || [];
      const targetRoomId = (lesson as any).roomId || (lesson.reqType === "any" ? (lesson as any).defaultRoomId : null);
      let roomCandidates = candidateRooms.filter((r) => r.capacity >= lesson.classStudents).map((r) => r.id);
      if (targetRoomId) {
        roomCandidates = roomCandidates.filter(rid => rid === targetRoomId);
      }
      return {
        skippedIndex: p.idx,
        classId: lesson.classId,
        teacherId: lesson.teacherId,
        weekType: lesson.weekType,
        studyDays,
        roomCandidates,
      };
    });

    const optimizerSlots = activeSlots.map((s) => ({ id: s.id, dayOfWeek: Number(s.dayOfWeek) }));
    const slotById = new Map(activeSlots.map((s) => [s.id, s]));
    // O'qituvchi shaxsiy bandligi (unavailSet) — asosiy greedy bosqichdagi hard constraint
    // bilan bir xil tekshiruv, aks holda relocation o'qituvchini u band bo'lgan vaqtga qo'yib qo'yishi mumkin edi.
    const isTeacherFreeConsideringUnavailability = (teacherId: number, slotId: number, weekType: "always" | "surat" | "mahraj") => {
      if (isEntityBusy(teacherBusy, teacherId, slotId, weekType)) return false;
      const slot = slotById.get(slotId);
      if (slot && unavailSet.has(`${teacherId}_${slot.dayOfWeek}_${slot.periodNumber}`)) return false;
      return true;
    };
    const plans = attemptRelocations({
      skippedLessons: skippedInputs,
      placedLessons: movableLessons,
      activeSlots: optimizerSlots,
      isClassFree: (classId, slotId, weekType) => !isEntityBusy(classBusy, classId, slotId, weekType),
      isTeacherFree: isTeacherFreeConsideringUnavailability,
      isRoomFree: (roomId, slotId, weekType) => !isEntityBusy(roomBusy, roomId, slotId, weekType),
      // Har bir reja topilgach DARHOL band holatini yangilaydi (optimizer o'zi chaqiradi) —
      // shu bilan bitta chaqiruvdagi keyingi skipped darslar yangilangan holatni ko'radi va
      // bir xil xona/slot/o'qituvchiga ikkinchi marta da'vogar bo'lmaydi.
      markClassBusy: (classId, slotId, weekType) => markEntityBusy(classBusy, classId, slotId, weekType),
      unmarkClassBusy: (classId, slotId, weekType) => unmarkEntityBusy(classBusy, classId, slotId, weekType),
      markTeacherBusy: (teacherId, slotId, weekType) => markEntityBusy(teacherBusy, teacherId, slotId, weekType),
      unmarkTeacherBusy: (teacherId, slotId, weekType) => unmarkEntityBusy(teacherBusy, teacherId, slotId, weekType),
      markRoomBusy: (roomId, slotId, weekType) => markEntityBusy(roomBusy, roomId, slotId, weekType),
      unmarkRoomBusy: (roomId, slotId, weekType) => unmarkEntityBusy(roomBusy, roomId, slotId, weekType),
    });

    for (const plan of plans) {
      // Band holatlar allaqachon attemptRelocations ichida (mark/unmark callback orqali)
      // yangilangan — bu yerda faqat finalSchedule'ni (haqiqiy DB yozuvlari) yangilaymiz.
      const moved = finalSchedule[plan.movedLessonIndex];
      moved.timeSlotId = plan.movedLessonNewSlotId;

      const skippedItem = optimizableSkips.find((p) => p.idx === plan.skippedIndex)!;
      const lesson = skippedItem.lesson;

      finalSchedule.push({
        classId: lesson.classId,
        subjectId: lesson.subjectId,
        teacherId: lesson.teacherId,
        roomId: plan.newRoomId,
        timeSlotId: plan.newSlotId,
        weekType: lesson.weekType,
        isActive: true,
      });
      placedLessons++;
      resolvedSkipIndices.add(plan.skippedIndex);
    }

    if (plans.length > 0) {
      console.log(`[Optimization] ${plans.length} ta skipped dars retry-with-relaxation orqali joylashtirildi.`);
    }
  }

  const skippedLessons: Array<{ classId: number; subjectId: string; reason: string }> = pendingSkips
    .filter((_, idx) => !resolvedSkipIndices.has(idx))
    .map((p) => ({
      classId: p.lesson.classId,
      subjectId: String(p.lesson.subjectId),
      reason: "Barcha slotlar band yoki mos xona topilmadi",
    }));

  // --- Faza 2.2: Gap minimizatsiya (post-processing) ---
  const slotPeriodMap = new Map(activeSlots.map(s => [s.id, Number(s.periodNumber)]));
  const slotDayMap = new Map(activeSlots.map(s => [s.id, Number(s.dayOfWeek)]));
  const optimizerSlotsForGap = activeSlots.map(s => ({ id: s.id, dayOfWeek: Number(s.dayOfWeek) }));
  const slotByIdGap = new Map(activeSlots.map(s => [s.id, s]));
  const isTeacherFreeForGap = (teacherId: number, slotId: number, weekType: "always" | "surat" | "mahraj") => {
    if (isEntityBusy(teacherBusy, teacherId, slotId, weekType)) return false;
    const sl = slotByIdGap.get(slotId);
    if (sl && unavailSet.has(`${teacherId}_${sl.dayOfWeek}_${sl.periodNumber}`)) return false;
    return true;
  };
  const gapSwaps = minimizeGaps({
    schedule: finalSchedule,
    activeSlots: optimizerSlotsForGap,
    slotPeriodMap,
    slotDayMap,
    isClassFree: (classId, slotId, weekType) => !isEntityBusy(classBusy, classId, slotId, weekType),
    isTeacherFree: isTeacherFreeForGap,
    isRoomFree: (roomId, slotId, weekType) => !isEntityBusy(roomBusy, roomId, slotId, weekType),
    markClassBusy: (classId, slotId, weekType) => markEntityBusy(classBusy, classId, slotId, weekType),
    unmarkClassBusy: (classId, slotId, weekType) => unmarkEntityBusy(classBusy, classId, slotId, weekType),
    markTeacherBusy: (teacherId, slotId, weekType) => markEntityBusy(teacherBusy, teacherId, slotId, weekType),
    unmarkTeacherBusy: (teacherId, slotId, weekType) => unmarkEntityBusy(teacherBusy, teacherId, slotId, weekType),
    markRoomBusy: (roomId, slotId, weekType) => markEntityBusy(roomBusy, roomId, slotId, weekType),
    unmarkRoomBusy: (roomId, slotId, weekType) => unmarkEntityBusy(roomBusy, roomId, slotId, weekType),
  });
  if (gapSwaps > 0) {
    console.log(`[GapMinimize] ${gapSwaps} ta swap bajarildi.`);
  }

  // --- Faza 3: Post-validatsiya ---
  const hardViolations = validateSchedule(finalSchedule, activeSlots, unavailSet);
  if (hardViolations.length > 0) {
    console.error(`[PostValidation] ${hardViolations.length} ta qat'iy shart buzilishi aniqlandi:`, hardViolations);
  }

  // --- Sifat hisoboti ---
  let classGaps = 0;
  let teacherGaps = 0;
  const finalClassPeriods = new Map<string, Set<number>>();
  const finalTeacherPeriods = new Map<string, Set<number>>();
  let spacingViolations = 0;
  let complexityViolations = 0;
  const finalSubjectDays = new Map<string, Set<number>>();

  for (const entry of finalSchedule) {
    const sl = slotByIdGap.get(entry.timeSlotId);
    if (!sl) continue;
    const day = Number(sl.dayOfWeek);
    const period = Number(sl.periodNumber);

    const cpKey = `${entry.classId}_${day}`;
    if (!finalClassPeriods.has(cpKey)) finalClassPeriods.set(cpKey, new Set());
    finalClassPeriods.get(cpKey)!.add(period);

    const tpKey = `${entry.teacherId}_${day}`;
    if (!finalTeacherPeriods.has(tpKey)) finalTeacherPeriods.set(tpKey, new Set());
    finalTeacherPeriods.get(tpKey)!.add(period);

    const sub = subjectMap.get(entry.subjectId);
    if (sub) {
      const cat = getSubjectCategory(sub.name);
      if (cat === "dynamic" && period <= 3) complexityViolations++;
      if (cat === "mental" && period >= 5) complexityViolations++;
    }

    const sdKey = `${entry.classId}_${entry.subjectId}`;
    if (!finalSubjectDays.has(sdKey)) finalSubjectDays.set(sdKey, new Set());
    finalSubjectDays.get(sdKey)!.add(day);
  }

  for (const periods of Array.from(finalClassPeriods.values())) {
    const arr = Array.from(periods).sort((a, b) => a - b);
    for (let i = 1; i < arr.length; i++) {
      classGaps += arr[i] - arr[i - 1] - 1;
    }
  }
  for (const periods of Array.from(finalTeacherPeriods.values())) {
    const arr = Array.from(periods).sort((a, b) => a - b);
    for (let i = 1; i < arr.length; i++) {
      teacherGaps += arr[i] - arr[i - 1] - 1;
    }
  }
  for (const days of Array.from(finalSubjectDays.values())) {
    const sorted = Array.from(days).sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] - sorted[i - 1] === 1) spacingViolations++;
    }
  }

  const qualityScore = Math.max(0, Math.round(
    100
    - skippedLessons.length * 10
    - hardViolations.length * 50
    - classGaps * 2
    - teacherGaps * 1
    - complexityViolations * 1.5
    - spacingViolations * 1
  ));

  console.log(`[Greedy] Finished. Placed ${placedLessons}/${precomputedLessons.length} lessons. Skipped: ${skippedLessons.length}. Quality: ${qualityScore}/100`);

  if (finalSchedule.length > 0) {
    const insertedEntries = await storage.createScheduleEntriesBulk(finalSchedule);

    const entryByKey = new Map<string, ScheduleEntry>();
    for (const e of insertedEntries) {
      const key = `${e.classId}_${e.subjectId}_${e.teacherId}_${e.timeSlotId}_${e.weekType}`;
      entryByKey.set(key, e);
    }
    // finalSchedule[idx] -> tegishli insertedEntries yozuvi (bir xil kalit orqali)
    const entryByFinalIdx = (idx: number) => {
      const fe = finalSchedule[idx];
      if (!fe) return undefined;
      const key = `${fe.classId}_${fe.subjectId}_${fe.teacherId}_${fe.timeSlotId}_${fe.weekType || "always"}`;
      return entryByKey.get(key);
    };

    if (generatedConflicts.length > 0) {
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

    // Post-validatsiyadagi qat'iy (hard) buzilishlar — avval faqat console.error qilinardi,
    // admin UI'da (schedule_conflicts) ko'rinmas edi. Endi bazaga ham yoziladi.
    for (const v of hardViolations) {
      const entry1 = entryByFinalIdx(v.idx1);
      const entry2 = v.idx2 !== undefined ? entryByFinalIdx(v.idx2) : undefined;
      await storage.createConflict({
        conflictType: v.type,
        description: v.detail,
        severity: "high",
        scheduleEntry1Id: entry1?.id ?? null,
        scheduleEntry2Id: entry2?.id ?? null,
      });
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
    stats: { steps: precomputedLessons.length, timeMs: Date.now() - startTime },
    feasibility,
    quality: {
      score: qualityScore,
      classGaps,
      teacherGaps,
      spacingViolations,
      complexityViolations,
      hardViolations: hardViolations.length,
    },
  };
}

function validateSchedule(
  entries: InsertScheduleEntry[],
  slots: Array<{ id: number; dayOfWeek: number; periodNumber: number }>,
  unavailSet: Set<string>,
): Array<{ type: string; detail: string; idx1: number; idx2?: number }> {
  const violations: Array<{ type: string; detail: string; idx1: number; idx2?: number }> = [];
  const slotMap = new Map(slots.map(s => [s.id, s]));

  type WkType = "always" | "surat" | "mahraj";
  function wkConflict(a: string, b: string) {
    if (a === "always" || b === "always") return true;
    return a === b;
  }

  const teacherSlotEntries = new Map<string, Array<{ idx: number; wt: WkType }>>();
  const classSlotEntries = new Map<string, Array<{ idx: number; wt: WkType }>>();
  const roomSlotEntries = new Map<string, Array<{ idx: number; wt: WkType }>>();

  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];
    const wt = (e.weekType || "always") as WkType;

    const tKey = `${e.teacherId}_${e.timeSlotId}`;
    if (!teacherSlotEntries.has(tKey)) teacherSlotEntries.set(tKey, []);
    teacherSlotEntries.get(tKey)!.push({ idx: i, wt });

    const cKey = `${e.classId}_${e.timeSlotId}`;
    if (!classSlotEntries.has(cKey)) classSlotEntries.set(cKey, []);
    classSlotEntries.get(cKey)!.push({ idx: i, wt });

    const rKey = `${e.roomId}_${e.timeSlotId}`;
    if (!roomSlotEntries.has(rKey)) roomSlotEntries.set(rKey, []);
    roomSlotEntries.get(rKey)!.push({ idx: i, wt });

    const slot = slotMap.get(e.timeSlotId);
    if (slot && unavailSet.has(`${e.teacherId}_${slot.dayOfWeek}_${slot.periodNumber}`)) {
      violations.push({ type: "unavail_violation", detail: `O'qituvchi ${e.teacherId} band vaqtda darsga qo'yilgan (slot ${e.timeSlotId})`, idx1: i });
    }
  }

  for (const [key, group] of Array.from(teacherSlotEntries.entries())) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        if (wkConflict(group[i].wt, group[j].wt)) {
          const jl1 = entries[group[i].idx].jointLessonId;
          const jl2 = entries[group[j].idx].jointLessonId;
          if (jl1 && jl2 && jl1 === jl2) continue;
          violations.push({ type: "teacher_clash", detail: `O'qituvchi to'qnashuvi: ${key}`, idx1: group[i].idx, idx2: group[j].idx });
        }
      }
    }
  }
  for (const [key, group] of Array.from(classSlotEntries.entries())) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        if (wkConflict(group[i].wt, group[j].wt)) {
          const jl1 = entries[group[i].idx].jointLessonId;
          const jl2 = entries[group[j].idx].jointLessonId;
          if (jl1 && jl2 && jl1 === jl2) continue;
          violations.push({ type: "class_clash", detail: `Sinf to'qnashuvi: ${key}`, idx1: group[i].idx, idx2: group[j].idx });
        }
      }
    }
  }
  for (const [key, group] of Array.from(roomSlotEntries.entries())) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        if (wkConflict(group[i].wt, group[j].wt)) {
          const jl1 = entries[group[i].idx].jointLessonId;
          const jl2 = entries[group[j].idx].jointLessonId;
          if (jl1 && jl2 && jl1 === jl2) continue;
          violations.push({ type: "room_clash", detail: `Xona to'qnashuvi: ${key}`, idx1: group[i].idx, idx2: group[j].idx });
        }
      }
    }
  }

  return violations;
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

  if (rows.length === 0) throw new DomainError("Qatorlar bo'sh bo'lmasligi kerak");

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