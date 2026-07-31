import { storage } from "../storage/index";
import { db } from "../db";
import { scheduleEntries, scheduleConflicts, timeSlots, type InsertScheduleEntry, type ScheduleEntry } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { getSubjectComplexity, getMaxHoursPerDay, getSubjectCategory, type SubjectCategory, getMaxDailyComplexity, isClassHourSubject, CLASS_HOUR_SLOT_SETTING_KEY, DEFAULT_CLASS_HOUR_SLOT, roomMatchesSubject } from "@shared/constants";
import { DomainError } from "../errors";
import { attemptRelocations, minimizeGaps, compactDays, balanceDays, optimizeSanPinComplexity, type MovablePlacedLesson, type SkippedLessonInput } from "./schedule-optimizer";
import { hillClimbOptimize, evaluateSchedulePenalty } from "./schedule-hill-climber";

function createPRNG(seed: number) {
  let s = (seed ^ 0x12345678) >>> 0;
  return function () {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

function stochasticShuffleLessons<T extends { pinned?: any; isJoint?: boolean }>(array: T[], rng: () => number): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    if (result[i].pinned || result[i].isJoint) continue;
    const j = Math.floor(rng() * (i + 1));
    if (result[j].pinned || result[j].isJoint) continue;

    const temp = result[i];
    result[i] = result[j];
    result[j] = temp;
  }
  return result;
}

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
  classIdealMaxDailyMap?: Map<number, number>,
  classTotalWeeklyHoursMap?: Map<number, number>,
  isPinned?: boolean,
  algorithm: "greedy_chain" | "cpsat_optimal" = "greedy_chain"
): { conflicts: number; reasons: string[] } {
  let conflicts = 0;
  const reasons: string[] = [];

  const isCpsat = algorithm === "cpsat_optimal";
  const frontGapWeight = isCpsat ? 2000 : 3000;
  const middleGapWeight = isCpsat ? 2500 : 3500;
  const quadWeight = isCpsat ? 600 : 350;

  for (const cid of classIds) {
    const cdKey = `${cid}_${day}`;
    const currentClassCount = classDailyCount.get(cdKey) || 0;
    const newCount = currentClassCount + loadVal;

    if (newCount > maxDaily) {
      conflicts += 1000;
      reasons.push(`Sinf (${cid}) uchun kunlik dars soati oshib ketdi`);
    }

    // Kvadratik teng taqsimot jarimasi (targetDaily og'ishiga)
    const totalHours = classTotalWeeklyHoursMap?.get(cid) || 25;
    const targetDaily = totalHours / Math.max(1, studyDaysCount);
    const dev = newCount - targetDaily;
    if (dev > 0.1) {
      conflicts += Math.round(quadWeight * Math.pow(dev, 2));
      reasons.push(`Sinf (${cid}) kunlik darslar soni teng taqsimotdan (${targetDaily.toFixed(1)} soat) oshib ketmoqda`);
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

    const existingPeriods = classPeriodsUsed.get(cdKey);
    const allP = new Set(existingPeriods ? Array.from(existingPeriods) : []);
    allP.add(periodNumber);
    const periodsArr = Array.from(allP);
    const minP = Math.min(...periodsArr);

    // Front Gap: 1-dars bo'sh qolib, dars 2 yoki undan keyingi soatdan boshlanishi (belgilanmagan darslar uchun)
    if (!isPinned && minP > 1) {
      conflicts += frontGapWeight;
      reasons.push(`Sinf (${cid}) uchun 1-dars bo'sh qolib, dars ${minP}-darsdan boshlanmoqda`);
    }

    // Middle Gap: darslar orasida bo'shliq bo'lishi
    const maxP = Math.max(...periodsArr);
    if (maxP - minP + 1 > periodsArr.length) {
      conflicts += middleGapWeight;
      reasons.push(`Sinf (${cid}) dars jadvalida o'rtada bo'sh soat (oyna) paydo bo'lmoqda`);
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
  /**
   * Jadvaldagi haqiqiy o'quv kunlari soni. Berilmasa 6 deb olinadi (eski xatti-harakat).
   * MUHIM: 5 kunlik maktabda 6 deb hisoblash sig'imni 20% ga oshirib ko'rsatadi va
   * "hammasi joyida" degan noto'g'ri xulosa beradi — keyin darslar jim tushib qoladi.
   */
  activeDayCount: number = 6,
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
    const totalSlotsForTeacher = activeSlotsPerDay * activeDayCount;
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

    const classCountForTeacher = classSubjects.filter(cs => cs.teacherId === t.id).map(cs => cs.classId);
    const uniqueClassesCount = new Set(classCountForTeacher).size;
    if (demand >= 18 && uniqueClassesCount >= 6) {
      warnings.push({
        type: "concurrency_bottleneck",
        message: `${name}: 1 ta o'qituvchiga ${uniqueClassesCount} ta sinfda ${demand} soat dars biriktirilgan (to'qnashuvlar xavfi yuqori)`,
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
    const supplySlots = roomCount * activeSlotsPerDay * activeDayCount;
    if (demandSlots > supplySlots) {
      errors.push({
        type: "room_shortage",
        entity: rt,
        demand: demandSlots,
        supply: supplySlots,
        message: `${rt}: ${demandSlots} soat kerak, ${roomCount} xona × ${activeSlotsPerDay * activeDayCount} slot = ${supplySlots} slot`,
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
      const anySupplySlots = rooms.length * activeSlotsPerDay * activeDayCount;
      if (anyDemandSlots > anySupplySlots) {
        errors.push({
          type: "room_shortage",
          entity: "any",
          demand: anyDemandSlots,
          supply: anySupplySlots,
          message: `Umumiy xonalar: ${anyDemandSlots} soat kerak, ${rooms.length} xona × ${activeSlotsPerDay * activeDayCount} slot = ${anySupplySlots} slot`,
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
  algorithm?: "greedy_chain" | "cpsat_optimal";
  seed?: number;
  /** Qidiruvga ajratilgan maksimal vaqt (ms). Berilmasa — SCHEDULE_TIME_BUDGET_MS yoki default. */
  timeBudgetMs?: number;
}

/**
 * Jadval qidiruviga ajratiladigan default vaqt budjeti (ms).
 *
 * Nima uchun kerak: solver — sof sinxron CPU ishi va HTTP handler ichida bajariladi.
 * Budjetsiz 11 sinf miqyosida bitta so'rov o'nlab daqiqa davom etardi; shu vaqt ichida
 * Node event loop band bo'lgani uchun server BOSHQA hech qanday so'rovga (sahifani
 * yangilash ham) javob bera olmasdi. Budjet + `yieldToEventLoop()` shu ikkala muammoni
 * ham yopadi: generatsiya kafolatli tugaydi va server javob beradigan holatda qoladi.
 */
const MIN_TIME_BUDGET_MS = 25_000;
const MAX_TIME_BUDGET_MS = 120_000;
/**
 * Bitta darsga ajratiladigan qidiruv vaqti. O'lchov: 44 sinfli maktabda (1200 dars)
 * bitta nomzodning lokal optimumga yetishi ~20 soniya; 50ms/dars shu vaqtdan uch barobar
 * ko'p budjet beradi, ya'ni multi-start ham ishlaydi. Budjet — YUQORI chegara: kichik
 * maktabda qidiruv lokal optimumda o'zi to'xtaydi va budjetni sarflab o'tirmaydi.
 */
const TIME_BUDGET_PER_LESSON_MS = 50;

/**
 * Jadvalga tushishi kerak bo'lgan dars soniga qarab budjetni hisoblaydi.
 * Qat'iy 25 soniya katta maktabda bitta nomzodning ham tugashiga yetmasdi —
 * natijada 44 sinfli maktab yarim optimallashtirilgan jadval olardi.
 */
export function resolveTimeBudgetMs(lessonCount: number, explicit?: number): number {
  if (explicit !== undefined && Number.isFinite(explicit) && explicit > 0) return explicit;
  const fromEnv = Number(process.env.SCHEDULE_TIME_BUDGET_MS);
  if (Number.isFinite(fromEnv) && fromEnv > 0) return fromEnv;
  const scaled = lessonCount * TIME_BUDGET_PER_LESSON_MS;
  return Math.min(MAX_TIME_BUDGET_MS, Math.max(MIN_TIME_BUDGET_MS, scaled));
}

/**
 * Jadvalga umuman tusha olmagan dars uchun jarima — nomzodlarni solishtirishda.
 * Har qanday yumshoq jarimadan yuqori (qoplama — birinchi darajali sifat ko'rsatkichi),
 * ammo qat'iy to'qnashuvdan past: tushmagan dars — ma'lum kamchilik, to'qnashuv esa
 * jadvalni butunlay yaroqsiz qiladi.
 */
const SKIPPED_LESSON_PENALTY = 50_000;

/**
 * Jadval sifati balli (0-100).
 *
 * MUHIM: barcha kamchiliklar dars soniga NISBATAN o'lchanadi. Ilgari ular absolyut
 * hisoblanardi (`- teacherGaps * 1`), shuning uchun 11 sinfli maktabdagi normal jadval
 * ham 0/100 ko'rsatardi va maktab kattalashgani sayin ball muqarrar nolga tushardi —
 * ya'ni ko'rsatkich foydalanuvchi uchun ma'nosiz edi.
 *
 * Koeffitsientlar "har 100 darsga to'g'ri keladigan kamchilik" bilan o'lchanadi:
 * masalan har 100 darsda 1 ta tushmagan dars — 3 ball, 1 ta qat'iy buzilish — 5 ball.
 */
export function computeQualityScore(m: {
  totalLessons: number;
  skipped: number;
  hardViolations: number;
  classGaps: number;
  teacherGaps: number;
  complexityViolations: number;
  spacingViolations: number;
}): number {
  const per100 = (n: number) => (n / Math.max(1, m.totalLessons)) * 100;
  const score = 100
    - per100(m.skipped) * 3
    - per100(m.hardViolations) * 5
    - per100(m.classGaps) * 2
    - per100(m.teacherGaps) * 0.5
    - per100(m.spacingViolations) * 0.5
    - per100(m.complexityViolations) * 0.3;
  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Event loopni bo'shatadi — shu paytda server boshqa so'rovlarni (sahifa yangilash,
 * GET /api/... ) qayta ishlab ulguradi. Og'ir sinxron fazalar orasiga qo'yiladi.
 */
function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

export async function generateSchedule(options: GenerateScheduleOptions) {
  const { classIds, clearExisting, algorithm = "greedy_chain", seed: inputSeed } = options;
  const baseSeed = inputSeed ?? (Date.now() + Math.floor(Math.random() * 1000000));
  console.log(`[Solver] Running algorithm engine: ${algorithm} (Base Seed: ${baseSeed})`);

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

  // Sinf soati (Tarbiya/Kelajak soati) belgilangan vaqti — default: dushanba 1-dars
  let classHourSlot = DEFAULT_CLASS_HOUR_SLOT;
  try {
    const raw = await storage.getSetting(CLASS_HOUR_SLOT_SETTING_KEY);
    if (raw) classHourSlot = JSON.parse(raw);
  } catch { /* buzilgan qiymatda default qoladi */ }

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

  const slotPeriodMap = new Map<number, number>(activeSlots.map(s => [s.id, Number(s.periodNumber)]));
  const slotDayMap = new Map<number, number>(activeSlots.map(s => [s.id, Number(s.dayOfWeek)]));
  const slotById = new Map<number, typeof activeSlots[0]>(activeSlots.map(s => [s.id, s]));
  const classGradesMap = new Map<number, string>();
  for (const cls of allClasses) {
    classGradesMap.set(cls.id, cls.grade || "5");
  }
  const classStudyDaysMap = new Map<number, number[]>();
  for (const cls of allClasses) {
    classStudyDaysMap.set(cls.id, cls.studyDays ? cls.studyDays.split(",").map(Number) : [1, 2, 3, 4, 5]);
  }
  // Sinfning "uy" xonasi — maxsus xona talab qilmaydigan darslar shu yerda o'tishi kerak.
  const classHomeRoomsMap = new Map<number, number>();
  for (const cls of allClasses) {
    if (cls.defaultRoomId) classHomeRoomsMap.set(cls.id, cls.defaultRoomId);
  }
  const canPlaceClassOnDay = (classId: number, slotId: number) => {
    const slot = slotById.get(slotId);
    if (!slot) return true;
    return classStudyDaysMap.get(classId)?.includes(Number(slot.dayOfWeek)) ?? true;
  };

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
  const activeDayCount = new Set(activeSlots.map(s => Number(s.dayOfWeek))).size || 6;
  const feasibility = checkFeasibility(
    targetClasses, allClassSubjects, allTeachers, allRooms, allSubjects, allUnavailability, periodsPerDay, activeDayCount,
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
    /** Sinf soati kabi belgilangan vaqtga majburiy darslar; topilmasa oddiy qidiruvga fallback */
    pinned?: { dayOfWeek: number; periodNumber: number };
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
          // Sinf soati haftada 1 marta belgilangan slotga qo'yiladi (barcha sinflar)
          pinned: i === 0 && isClassHourSubject(sub?.name || "") ? classHourSlot : undefined,
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
        complexity: getSubjectComplexity(sub?.name || ""),
        category: getSubjectCategory(sub?.name || ""),
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
        complexity: getSubjectComplexity(sub?.name || ""),
        category: getSubjectCategory(sub?.name || ""),
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

  // `${classId}_${subjectId}` -> haftalik yuklama (surat/mahraj = 0.5). Juft dars
  // chegarasi shundan kelib chiqadi — hill-climber'dagi `sameSubjectDayLimit` bilan
  // bir xil qoida bo'lishi shart, aks holda ikki bosqich bir-birini buzadi.
  const weeklyLoadByClassSubject = new Map<string, number>();
  for (const l of lessonsToSchedule) {
    const key = `${l.classId}_${l.subjectId}`;
    const w = (l.weekType || "always") === "always" ? 1 : 0.5;
    weeklyLoadByClassSubject.set(key, (weeklyLoadByClassSubject.get(key) || 0) + w);
  }

  const precomputedLessons = lessonsToSchedule.map(lesson => {
    const classStudents = lesson.isJoint && lesson.classIds
      ? lesson.classIds.reduce((sum, cid) => sum + (targetClasses.find(c => c.id === cid)?.totalStudents || 25), 0)
      : (targetClasses.find(c => c.id === lesson.classId)?.totalStudents || 25);
    const reqType = (subjectMap.get(lesson.subjectId) as any)?.requiredRoomType || "any";
    // Juft dars (double period) qoidasi (docs/domain/scheduling-rules.md §2.B):
    // bir kunda bir fandan bitta dars. Ikkinchisi faqat MAJBURIY bo'lganda —
    // fanning haftalik soati o'quv kunlaridan ko'p bo'lsa (masalan 6 soatlik
    // matematika 5 kunlik haftada) ruxsat etiladi.
    const grade = Number(lesson.grade);
    const studyDayCount = Math.max(1, String(lesson.studyDays || "1,2,3,4,5").split(",").filter(Boolean).length);
    const weeklyLoad = weeklyLoadByClassSubject.get(`${lesson.classId}_${lesson.subjectId}`) || 0;
    const maxSameSubject = weeklyLoad > studyDayCount ? Math.ceil(weeklyLoad / studyDayCount) : 1;
    return {
      ...lesson,
      classStudents,
      reqType,
      maxDaily: (grade <= 4 && subjectMap.get(lesson.subjectId)?.name.toLowerCase().includes("musiqa")) ? 6 : getMaxHoursPerDay(String(lesson.grade)),
      maxSameSubject,
    };
  });

  
  const teacherTotalHours = new Map<number, number>();
  for (const cs of allClassSubjects) {
    const t1 = cs.teacherId;
    if (t1) teacherTotalHours.set(t1, (teacherTotalHours.get(t1) || 0) + Number(cs.weeklyHours));
    const t2 = cs.teacherId2;
    if (t2) teacherTotalHours.set(t2, (teacherTotalHours.get(t2) || 0) + Number(cs.weeklyHours));
  }
  const teacherUnavailCount = new Map<number, number>();

  for (const u of allUnavailability) {
    teacherUnavailCount.set(u.teacherId, (teacherUnavailCount.get(u.teacherId) || 0) + 1);
  }
  precomputedLessons.sort((a, b) => {
    // Belgilangan vaqtli (pinned) darslar eng avval — sloti band bo'lib qolmasin
    const pinA = a.pinned ? 1 : 0;
    const pinB = b.pinned ? 1 : 0;
    if (pinB !== pinA) return pinB - pinA;
    const jointA = (a.isJoint ? 1 : 0) + (a.teacherId2 ? 1 : 0);
    const jointB = (b.isJoint ? 1 : 0) + (b.teacherId2 ? 1 : 0);
    if (jointB !== jointA) return jointB - jointA;

    // Maxsus xona talab qiladiganlar (gym, lab)
    const specA = a.reqType !== "any" ? 1 : 0;
    const specB = b.reqType !== "any" ? 1 : 0;
    if (specB !== specA) return specB - specA;

    
    const tightA = teacherUnavailCount.get(a.teacherId) || 0;
    const tightB = teacherUnavailCount.get(b.teacherId) || 0;
    if (tightB !== tightA) return tightB - tightA;

    // const totalHoursA = teacherTotalHours.get(a.teacherId) || 0;
    // const totalHoursB = teacherTotalHours.get(b.teacherId) || 0;
    // if (totalHoursB !== totalHoursA) return totalHoursB - totalHoursA;

    return b.grade - a.grade || b.complexity - a.complexity;
  });

  const defaultRoomIdsOfOtherClasses = new Set<number>();
  for (const c of targetClasses) {
    if (c.defaultRoomId) defaultRoomIdsOfOtherClasses.add(c.defaultRoomId);
  }

  const baseTeacherBusy = new Set<string>();
  const baseRoomBusy = new Set<string>();
  const baseClassBusy = new Set<string>();
  const baseClassDailyCount = new Map<string, number>();
  const baseSubjectDailyCount = new Map<string, number>();
  const baseClassDailyComplexity = new Map<string, number>();
  const baseSubjectDaysUsed = new Map<string, Set<number>>();
  const baseTeacherDayRoom = new Map<string, number>();
  const baseClassPeriodsUsed = new Map<string, Set<number>>();
  const baseTeacherPeriodsUsed = new Map<string, Set<number>>();
  const baseClassSubjectPeriods = new Map<string, Set<number>>();

  const classTotalWeeklyHoursMap = new Map<number, number>();
  for (const cs of allClassSubjects) {
    const curr = classTotalWeeklyHoursMap.get(cs.classId) || 0;
    classTotalWeeklyHoursMap.set(cs.classId, curr + cs.weeklyHours);
  }

  const classIdealMaxDailyMap = new Map<number, number>();
  for (const cls of targetClasses) {
    const totalHours = classTotalWeeklyHoursMap.get(cls.id) || 25;
    const daysCount = cls.studyDays ? cls.studyDays.split(",").length : 5;
    const idealMax = Math.ceil(totalHours / Math.max(1, daysCount));
    classIdealMaxDailyMap.set(cls.id, idealMax);
  }

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
    markEntityBusy(baseClassBusy, e.classId, e.timeSlotId, e.weekType as any);
    markEntityBusy(baseTeacherBusy, e.teacherId, e.timeSlotId, e.weekType as any);
    markEntityBusy(baseRoomBusy, e.roomId, e.timeSlotId, e.weekType as any);
    
    // Also update daily count and subject count for class
    const slot = slots.find(s => s.id === e.timeSlotId);
    if (slot) {
      const day = slot.dayOfWeek;
      const loadVal = e.weekType === "always" ? 1 : 0.5;
       const cdKey = `${e.classId}_${day}`;
       const sub = subjectMap.get(e.subjectId);
       baseClassDailyCount.set(cdKey, (baseClassDailyCount.get(cdKey) || 0) + loadVal);
      
      const sdKey = `${e.classId}_${e.subjectId}_${day}`;
      baseSubjectDailyCount.set(sdKey, (baseSubjectDailyCount.get(sdKey) || 0) + loadVal);
      if (!baseClassSubjectPeriods.has(sdKey)) baseClassSubjectPeriods.set(sdKey, new Set());
      baseClassSubjectPeriods.get(sdKey)!.add(Number(slot.periodNumber));
      
      const subComp = sub ? getSubjectComplexity(sub.name || "") : 7;
      baseClassDailyComplexity.set(cdKey, (baseClassDailyComplexity.get(cdKey) || 0) + (subComp * loadVal));

      const sdaysKey = `${e.classId}_${e.subjectId}`;
      if (!baseSubjectDaysUsed.has(sdaysKey)) baseSubjectDaysUsed.set(sdaysKey, new Set());
      baseSubjectDaysUsed.get(sdaysKey)!.add(Number(day));

      baseTeacherDayRoom.set(`${e.teacherId}_${day}`, e.roomId);

      const cpKey = `${e.classId}_${day}`;
      if (!baseClassPeriodsUsed.has(cpKey)) baseClassPeriodsUsed.set(cpKey, new Set());
      baseClassPeriodsUsed.get(cpKey)!.add(Number(slot.periodNumber));

      const tpKey = `${e.teacherId}_${day}`;
      if (!baseTeacherPeriodsUsed.has(tpKey)) baseTeacherPeriodsUsed.set(tpKey, new Set());
      baseTeacherPeriodsUsed.get(tpKey)!.add(Number(slot.periodNumber));
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

  const CANDIDATE_RUNS = algorithm === "cpsat_optimal" ? 20 : 10;
  const startTime = Date.now();
  // Budjet maktab o'lchamiga qarab hisoblanadi — dars soni ma'lum bo'lgach.
  const timeBudgetMs = resolveTimeBudgetMs(precomputedLessons.length, options.timeBudgetMs);
  // Qidiruv budjeti shu yerdan boshlanadi (baza o'qish vaqti hisobga olinmaydi).
  const deadline = startTime + timeBudgetMs;
  let budgetExhausted = false;
  let completedRuns = 0;
  console.log(`[MultiStart] Running up to ${CANDIDATE_RUNS} candidate search iterations for algorithm: ${algorithm} (budget: ${timeBudgetMs}ms)`);

  let bestRun: {
    finalSchedule: InsertScheduleEntry[];
    generatedConflicts: any[];
    placedLessons: number;
    skippedLessons: any[];
    qualityScore: number;
    penalty: number;
    hardViolations: any[];
    classGaps: number;
    teacherGaps: number;
    spacingViolations: number;
    complexityViolations: number;
  } | null = null;

  for (let candidateSeed = 0; candidateSeed < CANDIDATE_RUNS; candidateSeed++) {
    // Budjet tugagan bo'lsa yangi nomzod boshlanmaydi — lekin kamida bittasi to'liq
    // bajariladi (bestRun bo'lmasa jadval umuman qaytmaydi).
    if (bestRun && Date.now() >= deadline) {
      budgetExhausted = true;
      console.log(`[MultiStart] Vaqt budjeti tugadi — ${completedRuns}/${CANDIDATE_RUNS} nomzod bajarildi.`);
      break;
    }
    // Har nomzod oldidan event loopni bo'shatamiz: shu payt server boshqa
    // so'rovlarni (sahifa yangilash va h.k.) qayta ishlab ulguradi.
    await yieldToEventLoop();

    // Clone base state maps for candidate run
    const teacherBusy = new Set(baseTeacherBusy);
    const roomBusy = new Set(baseRoomBusy);
    const classBusy = new Set(baseClassBusy);
    const classDailyCount = new Map(baseClassDailyCount);
    const subjectDailyCount = new Map(baseSubjectDailyCount);
    const classDailyComplexity = new Map(baseClassDailyComplexity);
    const subjectDaysUsed = new Map<string, Set<number>>();
    for (const [k, v] of baseSubjectDaysUsed.entries()) subjectDaysUsed.set(k, new Set(v));
    const teacherDayRoom = new Map(baseTeacherDayRoom);
    const classPeriodsUsed = new Map<string, Set<number>>();
    for (const [k, v] of baseClassPeriodsUsed.entries()) classPeriodsUsed.set(k, new Set(v));
    const teacherPeriodsUsed = new Map<string, Set<number>>();
    for (const [k, v] of baseTeacherPeriodsUsed.entries()) teacherPeriodsUsed.set(k, new Set(v));
    const classSubjectPeriods = new Map<string, Set<number>>();
    for (const [k, v] of baseClassSubjectPeriods.entries()) classSubjectPeriods.set(k, new Set(v));

    let candidateLessons = [...precomputedLessons];
    const effectiveSeed = baseSeed + candidateSeed * 9973 + (algorithm === "cpsat_optimal" ? 43210 : 12340);
    const rng = createPRNG(effectiveSeed);
    if (candidateSeed > 0 || inputSeed === undefined) {
      candidateLessons = stochasticShuffleLessons(precomputedLessons, rng);
    }

    const finalSchedule: InsertScheduleEntry[] = [];
    const generatedConflicts: Array<{
      conflictType: string;
      description: string;
      severity: string;
      _key: { classId: number; subjectId: number; teacherId: number; timeSlotId: number; weekType: "always" | "surat" | "mahraj" };
    }> = [];
    const pendingSkips: Array<{ lesson: (typeof precomputedLessons)[number] }> = [];
    const movableLessons: MovablePlacedLesson[] = [];
    let placedLessons = 0;

    for (const lesson of candidateLessons) {
    let bestSlot = null;
    let bestRoom1 = null;
    let bestRoom2 = null;
    let leastConflicts = 9999;
    let bestConflictReasons: string[] = [];

    // Pinned dars: avval faqat belgilangan slotda, topilmasa oddiy qidiruvga fallback
    for (let pinAttempt = 0; pinAttempt < (lesson.pinned ? 2 : 1); pinAttempt++) {
    const usePin = !!lesson.pinned && pinAttempt === 0;

    // Try to find the best slot
    for (const slot of activeSlots) {
      const day = slot.dayOfWeek;
      const slotId = slot.id;

      if (usePin && lesson.pinned &&
        (Number(day) !== lesson.pinned.dayOfWeek || Number(slot.periodNumber) !== lesson.pinned.periodNumber)) {
        continue;
      }

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

        // 5. SanPiN kunlik dars limiti (hard constraint)
        const jLoadVal = lesson.weekType === "always" ? 1 : 0.5;
        let anyClassOverLimit = false;
        for (const cid of lesson.classIds) {
          const jCdKey = `${cid}_${day}`;
          if ((classDailyCount.get(jCdKey) || 0) + jLoadVal > lesson.maxDaily) {
            anyClassOverLimit = true;
            break;
          }
          // Boshlang'ich sinf ketma-ket juft dars taqiqi (hard constraint)
          if (lesson.grade >= 1 && lesson.grade <= 4) {
            const jSpKey = `${cid}_${lesson.subjectId}_${day}`;
            const existingPeriods = classSubjectPeriods.get(jSpKey);
            if (existingPeriods && (existingPeriods.has(slot.periodNumber - 1) || existingPeriods.has(slot.periodNumber + 1))) {
              anyClassOverLimit = true;
              break;
            }
          }
        }
        if (anyClassOverLimit) continue;

        // 6. Room availability check (hard constraint)
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
            const subjectObj = subjectMap.get(lesson.subjectId);
            const subjectName = subjectObj?.name || "";
            let freeRoom = null;
            if (lesson.reqType !== "any" && subjectName) {
              freeRoom = candidateRooms.find(r => 
                r.capacity >= avgCapacity &&
                !isEntityBusy(roomBusy, r.id, slotId, lesson.weekType) &&
                !assignedRooms.some(ar => ar.id === r.id) &&
                roomMatchesSubject(r.name, subjectName)
              );
            }
            if (!freeRoom) {
              freeRoom = candidateRooms.find(r => 
                r.capacity >= avgCapacity &&
                !isEntityBusy(roomBusy, r.id, slotId, lesson.weekType) &&
                !assignedRooms.some(ar => ar.id === r.id)
              );
            }
            if (!freeRoom) {
              freeRoom = candidateRooms.find(r => 
                !isEntityBusy(roomBusy, r.id, slotId, lesson.weekType) &&
                !assignedRooms.some(ar => ar.id === r.id)
              );
            }
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
          classPeriodsUsed, jStudyDaysCount, classIdealMaxDailyMap, classTotalWeeklyHoursMap,
          Boolean(lesson.pinned),
          algorithm
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
        if (!classStudyDays.includes(Number(day))) continue;
        
        // 2. Class busy check (hard constraint)
        if (isEntityBusy(classBusy, lesson.classId, slotId, lesson.weekType)) continue;
        
        // 3. Teacher busy checks (hard constraint)
        if (isEntityBusy(teacherBusy, lesson.teacherId, slotId, lesson.weekType)) continue;
        
        const tKey2 = lesson.teacherId2;
        if (tKey2 && isEntityBusy(teacherBusy, tKey2, slotId, lesson.weekType)) continue;
        
        // 4. Teacher unavailability checks (hard constraint)
        if (unavailSet.has(`${lesson.teacherId}_${day}_${slot.periodNumber}`)) continue;
        if (lesson.teacherId2 && unavailSet.has(`${lesson.teacherId2}_${day}_${slot.periodNumber}`)) continue;
        
        // 5. SanPiN kunlik dars limiti (hard constraint)
        {
          const sLoadVal = lesson.weekType === "always" ? 1 : 0.5;
          const sCdKey = `${lesson.classId}_${day}`;
          if ((classDailyCount.get(sCdKey) || 0) + sLoadVal > lesson.maxDaily) continue;
          // Boshlang'ich sinf ketma-ket juft dars taqiqi (hard constraint)
          if (lesson.grade >= 1 && lesson.grade <= 4) {
            const sSpKey = `${lesson.classId}_${lesson.subjectId}_${day}`;
            const existingPeriods = classSubjectPeriods.get(sSpKey);
            if (existingPeriods && (existingPeriods.has(slot.periodNumber - 1) || existingPeriods.has(slot.periodNumber + 1))) {
              continue;
            }
          }
        }
        
        // 6. Room availability check (hard constraint)
        const candidateRooms = roomsByType.get(lesson.reqType) || roomsByType.get("any") || [];
        const requiredCapacity = lesson.teacherId2 ? lesson.classStudents / 2 : lesson.classStudents;
        const subjectObj = subjectMap.get(lesson.subjectId);
        const subjectName = subjectObj?.name || "";
        let suitableRooms = candidateRooms.filter(r => 
          r.capacity >= requiredCapacity && 
          !isEntityBusy(roomBusy, r.id, slotId, lesson.weekType)
        );
        if (lesson.reqType !== "any" && subjectName) {
          const matching = suitableRooms.filter(r => roomMatchesSubject(r.name, subjectName));
          if (matching.length > 0) suitableRooms = matching;
        }
        if (suitableRooms.length === 0) {
          suitableRooms = candidateRooms.filter(r => 
            !isEntityBusy(roomBusy, r.id, slotId, lesson.weekType)
          );
          if (lesson.reqType !== "any" && subjectName) {
            const matching = suitableRooms.filter(r => roomMatchesSubject(r.name, subjectName));
            if (matching.length > 0) suitableRooms = matching;
          }
        }
        
        let room1 = null, room2 = null;
        if (!lesson.teacherId2) {
          if (suitableRooms.length > 0) {
            const targetRoomId = (lesson as any).roomId || (lesson.reqType === "any" ? (lesson as any).defaultRoomId : null);
            if (targetRoomId) {
              const matchedRoom = suitableRooms.find(r => r.id === targetRoomId);
              if (matchedRoom) {
                room1 = matchedRoom;
              } else {
                continue; 
              }
            } else {
              // Xona barqarorligi: o'qituvchi shu kuni allaqachon ishlatgan xona bo'sh bo'lsa, o'shani afzal ko'ramiz
              const preferredRoomId = teacherDayRoom.get(`${lesson.teacherId}_${day}`);
              const ownDefaultRoomId = (lesson as any).defaultRoomId;
              const sortedRooms = [...suitableRooms].sort((rA, rB) => {
                if (rA.id === ownDefaultRoomId) return -1;
                if (rB.id === ownDefaultRoomId) return 1;
                const isOtherDefaultA = defaultRoomIdsOfOtherClasses.has(rA.id) ? 1 : 0;
                const isOtherDefaultB = defaultRoomIdsOfOtherClasses.has(rB.id) ? 1 : 0;
                return isOtherDefaultA - isOtherDefaultB;
              });
              room1 = sortedRooms.find(r => r.id === preferredRoomId) || sortedRooms[0];
            }
          } else {
            continue; 
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
            continue; 
          }
        }

        const loadVal = lesson.weekType === "always" ? 1 : 0.5;
        const sStudyDaysCount = (lesson.studyDays || "1,2,3,4,5").split(",").length;
        let { conflicts, reasons } = computeSoftPenalties(
          [lesson.classId], lesson.subjectId, lesson.grade, lesson.complexity, lesson.category,
          day, slot.periodNumber, loadVal, lesson.maxDaily, lesson.maxSameSubject,
          classDailyCount, subjectDailyCount, classDailyComplexity, subjectDaysUsed,
          classPeriodsUsed, sStudyDaysCount, classIdealMaxDailyMap, classTotalWeeklyHoursMap,
          Boolean(lesson.pinned),
          algorithm
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

    if (bestSlot || !lesson.pinned) break;
    if (usePin) {
      // Belgilangan slot band — oddiy qidiruvga o'tamiz va past darajali ziddiyat qayd etamiz
      const dayName = ["", "dushanba", "seshanba", "chorshanba", "payshanba", "juma", "shanba"][lesson.pinned.dayOfWeek] || "";
      generatedConflicts.push({
        conflictType: "class_hour_slot",
        description: `Sinf soati belgilangan vaqtga (${dayName} ${lesson.pinned.periodNumber}-dars) joylashtirilmadi — sinf: ${lesson.classId}, boshqa vaqt qidirildi.`,
        severity: "low",
        _key: { classId: lesson.classId, subjectId: lesson.subjectId, teacherId: lesson.teacherId, timeSlotId: 0, weekType: lesson.weekType },
      });
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
        const subName = subjectMap.get(lesson.subjectId)?.name || "";
        const isClassHour = isClassHourSubject(subName);
        for (const cid of lesson.classIds) {
          if (!isClassHour) {
            classDailyCount.set(`${cid}_${day}`, (classDailyCount.get(`${cid}_${day}`) || 0) + loadVal);
          }
          subjectDailyCount.set(`${cid}_${lesson.subjectId}_${day}`, (subjectDailyCount.get(`${cid}_${lesson.subjectId}_${day}`) || 0) + loadVal);
          const jcspKey = `${cid}_${lesson.subjectId}_${day}`;
          if (!classSubjectPeriods.has(jcspKey)) classSubjectPeriods.set(jcspKey, new Set());
          classSubjectPeriods.get(jcspKey)!.add(bestSlot.periodNumber);
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
        
        if (leastConflicts >= 20) {
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
        const subName = subjectMap.get(lesson.subjectId)?.name || "";
        const isClassHour = isClassHourSubject(subName);
        if (!isClassHour) {
          classDailyCount.set(`${lesson.classId}_${day}`, (classDailyCount.get(`${lesson.classId}_${day}`) || 0) + loadVal);
        }
        subjectDailyCount.set(`${lesson.classId}_${lesson.subjectId}_${day}`, (subjectDailyCount.get(`${lesson.classId}_${lesson.subjectId}_${day}`) || 0) + loadVal);
        const scspKey = `${lesson.classId}_${lesson.subjectId}_${day}`;
        if (!classSubjectPeriods.has(scspKey)) classSubjectPeriods.set(scspKey, new Set());
        classSubjectPeriods.get(scspKey)!.add(bestSlot.periodNumber);
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
        if (!lesson.teacherId2 && !lesson.pinned) {
          const classStudyDaysForMove = lesson.studyDays ? lesson.studyDays.split(",").map(Number) : [1, 2, 3, 4, 5];
          movableLessons.push({
            index: finalSchedule.length - 1,
            classId: lesson.classId,
            subjectId: lesson.subjectId,
            teacherId: lesson.teacherId,
            roomId: r1Obj.id,
            timeSlotId: slotId,
            weekType: lesson.weekType,
            studyDays: classStudyDaysForMove,
          });
        }

        if (leastConflicts >= 20) {
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
      pendingSkips.push({ lesson });
    }
  }

  // --- Faza 3.3: chegaralangan local search (retry-with-relaxation) ---
  const resolvedSkipIndices = new Set<number>();
  const optimizableSkips = pendingSkips
    .map((p, idx) => ({ lesson: p.lesson, idx }))
    .filter((p) => !p.lesson.isJoint && !p.lesson.teacherId2);

  if (optimizableSkips.length > 0) {
    const skippedInputs: SkippedLessonInput[] = optimizableSkips.map((p) => {
      const lesson = p.lesson;
      const studyDays = lesson.studyDays ? lesson.studyDays.split(",").map(Number) : [1, 2, 3, 4, 5];
      let candidateRooms = roomsByType.get(lesson.reqType) || roomsByType.get("any") || [];
      const subjectObj = subjectMap.get(lesson.subjectId);
      const subjectName = subjectObj?.name || "";
      if (lesson.reqType !== "any" && subjectName) {
        const matching = candidateRooms.filter(r => roomMatchesSubject(r.name, subjectName));
        if (matching.length > 0) candidateRooms = matching;
      }
      const targetRoomId = (lesson as any).roomId || (lesson.reqType === "any" ? (lesson as any).defaultRoomId : null);
      let roomCandidates = candidateRooms.filter((r) => r.capacity >= lesson.classStudents).map((r) => r.id);
      if (roomCandidates.length === 0 && candidateRooms.length > 0) {
        roomCandidates = candidateRooms.map((r) => r.id);
      }
      if (targetRoomId) {
        roomCandidates = roomCandidates.filter(rid => rid === targetRoomId);
      }
      return {
        skippedIndex: p.idx,
        classId: lesson.classId,
        subjectId: lesson.subjectId,
        teacherId: lesson.teacherId,
        weekType: lesson.weekType,
        studyDays,
        roomCandidates,
      };
    });

    const optimizerSlots = activeSlots.map((s) => ({ id: s.id, dayOfWeek: Number(s.dayOfWeek) }));
    const isTeacherFreeConsideringUnavailability = (teacherId: number, slotId: number, weekType: "always" | "surat" | "mahraj") => {
      if (isEntityBusy(teacherBusy, teacherId, slotId, weekType)) return false;
      const slot = slotById.get(slotId);
      if (slot && unavailSet.has(`${teacherId}_${(slot as any).dayOfWeek}_${(slot as any).periodNumber}`)) return false;
      return true;
    };
    const plans = attemptRelocations({
      skippedLessons: skippedInputs,
      placedLessons: movableLessons,
      activeSlots: optimizerSlots,
      isClassFree: (classId, slotId, weekType) => !isEntityBusy(classBusy, classId, slotId, weekType),
      isTeacherFree: isTeacherFreeConsideringUnavailability,
      isRoomFree: (roomId, slotId, weekType) => !isEntityBusy(roomBusy, roomId, slotId, weekType),
      markClassBusy: (classId, slotId, weekType) => markEntityBusy(classBusy, classId, slotId, weekType),
      unmarkClassBusy: (classId, slotId, weekType) => unmarkEntityBusy(classBusy, classId, slotId, weekType),
      markTeacherBusy: (teacherId, slotId, weekType) => markEntityBusy(teacherBusy, teacherId, slotId, weekType),
      unmarkTeacherBusy: (teacherId, slotId, weekType) => unmarkEntityBusy(teacherBusy, teacherId, slotId, weekType),
      markRoomBusy: (roomId, slotId, weekType) => markEntityBusy(roomBusy, roomId, slotId, weekType),
      unmarkRoomBusy: (roomId, slotId, weekType) => unmarkEntityBusy(roomBusy, roomId, slotId, weekType),
      canPlaceClassOnDay,
      fullSchedule: finalSchedule,
      classGrades: classGradesMap,
      slotPeriodMap,
      slotDayMap,
    });

    for (const plan of plans) {
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
  }

  const skippedLessons: Array<{ classId: number; subjectId: string; reason: string }> = pendingSkips
    .filter((_, idx) => !resolvedSkipIndices.has(idx))
    .map((p) => ({
      classId: p.lesson.classId,
      subjectId: String(p.lesson.subjectId),
      reason: "Barcha slotlar band yoki mos xona topilmadi",
    }));

  // --- Faza 2.2: Optimizatsiya (Post-processing) ---
  const optimizerSlotsForGap = activeSlots.map(s => ({ id: s.id, dayOfWeek: Number(s.dayOfWeek), periodNumber: Number(s.periodNumber) }));
  const isTeacherFreeForGap = (teacherId: number, slotId: number, weekType: "always" | "surat" | "mahraj") => {
    if (isEntityBusy(teacherBusy, teacherId, slotId, weekType)) return false;
    const sl = slotById.get(slotId);
    if (sl && unavailSet.has(`${teacherId}_${sl.dayOfWeek}_${sl.periodNumber}`)) return false;
    return true;
  };

  const scheduleWithRoomCandidates = finalSchedule.map(entry => {
    // Find matching precomputed lesson to know the required room type
    const lesson = precomputedLessons.find(pl => 
      pl.classId === entry.classId && 
      pl.subjectId === entry.subjectId && 
      pl.teacherId === entry.teacherId
    );
    const reqType = lesson ? lesson.reqType : "any";
    let candidateRooms = roomsByType.get(reqType) || roomsByType.get("any") || [];
    const subjectObj = lesson ? subjectMap.get(lesson.subjectId) : null;
    const subjectName = subjectObj?.name || "";
    if (reqType !== "any" && subjectName) {
      const matching = candidateRooms.filter(r => roomMatchesSubject(r.name, subjectName));
      if (matching.length > 0) candidateRooms = matching;
    }
    let roomCandidates = candidateRooms.length > 0 ? candidateRooms.map(r => r.id) : allRooms.map(r => r.id);

    // Afzal xona: avval fanga biriktirilgani, bo'lmasa sinfning uy xonasi (faqat maxsus
    // xona talab qilmaydigan fanlar uchun). Ro'yxat boshida tursin — optimizatorlar bo'sh
    // xonani `.find()` bilan tanlaydi, shuning uchun tartib sinf o'z xonasida qolishini
    // belgilaydi; aks holda sinf har darsda boshqa xonaga ko'chib yuradi.
    const explicitRoomId = (lesson as any)?.roomId as number | undefined | null;
    const preferredRoomId = explicitRoomId
      || (reqType === "any" || reqType === "classroom" ? classHomeRoomsMap.get(entry.classId) : undefined);
    if (preferredRoomId !== undefined && roomCandidates.includes(preferredRoomId)) {
      roomCandidates = [preferredRoomId, ...roomCandidates.filter(id => id !== preferredRoomId)];
    }

    return {
      ...entry,
      roomCandidates,
      preferredRoomId: preferredRoomId ?? undefined,
    };
  });

  const protectedEntryIndices = new Set<number>();
  for (let i = 0; i < finalSchedule.length; i++) {
    const entry = finalSchedule[i];
    const sub = subjectMap.get(entry.subjectId);
    if (sub && isClassHourSubject(sub.name || "")) {
      protectedEntryIndices.add(i);
    }
  }

  await yieldToEventLoop();
  const tOptimize = Date.now();

  // Kun ichida darslarni ixchamlashtirish
  compactDays({
    schedule: scheduleWithRoomCandidates,
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
    protectedIndices: protectedEntryIndices,
    classGrades: classGradesMap,
    deadline,
  });

  // Kunlararo darslarni balanslash
  balanceDays({
    schedule: scheduleWithRoomCandidates,
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
    protectedIndices: protectedEntryIndices,
    canPlaceClassOnDay,
    classStudyDays: classStudyDaysMap,
    classGrades: classGradesMap,
    deadline,
  });

  // Kun ichidagi oyna (gap) larni minimizatsiya
  minimizeGaps({
    schedule: scheduleWithRoomCandidates,
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
    protectedIndices: protectedEntryIndices,
    canPlaceClassOnDay,
    classGrades: classGradesMap,
    deadline,
  });

  // SanPiN fanlar murakkablik balansi va dars o'rinlarini almashtirish
  const subjectCategoryMap = new Map<number, SubjectCategory>();
  for (const s of allSubjects) {
    subjectCategoryMap.set(s.id, getSubjectCategory(s.name || ""));
  }
  optimizeSanPinComplexity({
    schedule: scheduleWithRoomCandidates,
    activeSlots: optimizerSlotsForGap,
    slotPeriodMap,
    slotDayMap,
    subjectCategoryMap,
    isClassFree: (classId, slotId, weekType) => !isEntityBusy(classBusy, classId, slotId, weekType),
    isTeacherFree: isTeacherFreeForGap,
    isRoomFree: (roomId, slotId, weekType) => !isEntityBusy(roomBusy, roomId, slotId, weekType),
    markClassBusy: (classId, slotId, weekType) => markEntityBusy(classBusy, classId, slotId, weekType),
    unmarkClassBusy: (classId, slotId, weekType) => unmarkEntityBusy(classBusy, classId, slotId, weekType),
    markTeacherBusy: (teacherId, slotId, weekType) => markEntityBusy(teacherBusy, teacherId, slotId, weekType),
    unmarkTeacherBusy: (teacherId, slotId, weekType) => unmarkEntityBusy(teacherBusy, teacherId, slotId, weekType),
    markRoomBusy: (roomId, slotId, weekType) => markEntityBusy(roomBusy, roomId, slotId, weekType),
    unmarkRoomBusy: (roomId, slotId, weekType) => unmarkEntityBusy(roomBusy, roomId, slotId, weekType),
    protectedIndices: protectedEntryIndices,
    classGrades: classGradesMap,
    deadline,
  });

  // Yopilgan optimizatsiya natijalarini qo'llash
  for (let i = 0; i < finalSchedule.length; i++) {
    finalSchedule[i].timeSlotId = scheduleWithRoomCandidates[i].timeSlotId;
    finalSchedule[i].roomId = scheduleWithRoomCandidates[i].roomId;
  }

  // Qat'iy Sinf Nollik Okno (Zero Class Gap) Post-Processing
  const slotByDayPeriodMap = new Map<string, number>();
  for (const s of activeSlots) {
    slotByDayPeriodMap.set(`${s.dayOfWeek}_${s.periodNumber}`, s.id);
  }

  for (const cls of targetClasses) {
    for (let day = 1; day <= 6; day++) {
      const dayIndices = [];
      for (let i = 0; i < finalSchedule.length; i++) {
        if (finalSchedule[i].classId !== cls.id) continue;
        const sl = slotById.get(finalSchedule[i].timeSlotId);
        if (sl && Number(sl.dayOfWeek) === day) {
          dayIndices.push(i);
        }
      }
      if (dayIndices.length < 2) continue;

      const pMap = new Map<number, number>();
      for (const idx of dayIndices) {
        const p = Number(slotById.get(finalSchedule[idx].timeSlotId)?.periodNumber);
        if (p) pMap.set(p, idx);
      }

      const periods = Array.from(pMap.keys()).sort((a, b) => a - b);
      const minP = Math.min(...periods);
      const maxP = Math.max(...periods);

      for (let gapP = minP; gapP < maxP; gapP++) {
        if (!pMap.has(gapP)) {
          const gapSlotId = slotByDayPeriodMap.get(`${day}_${gapP}`);
          if (!gapSlotId) continue;

          for (let p = minP; p < gapP; p++) {
            const earlierIdx = pMap.get(p)!;
            const trailingIdx = pMap.get(maxP)!;

            const earlierEntry = finalSchedule[earlierIdx];
            const trailingEntry = finalSchedule[trailingIdx];
            if (!earlierEntry || !trailingEntry) continue;
            const earlierSlotId = earlierEntry.timeSlotId;

            const wtE = (earlierEntry.weekType || "always") as any;
            const wtT = (trailingEntry.weekType || "always") as any;

            const trailingTeacherFreeAtEarlier = !isEntityBusy(teacherBusy, trailingEntry.teacherId, earlierSlotId, wtT) || trailingEntry.teacherId === earlierEntry.teacherId;
            const earlierTeacherFreeAtGap = !isEntityBusy(teacherBusy, earlierEntry.teacherId, gapSlotId, wtE) || earlierEntry.teacherId === trailingEntry.teacherId;
            const trailingRoomFreeAtEarlier = !isEntityBusy(roomBusy, trailingEntry.roomId, earlierSlotId, wtT) || trailingEntry.roomId === earlierEntry.roomId;
            const earlierRoomFreeAtGap = !isEntityBusy(roomBusy, earlierEntry.roomId, gapSlotId, wtE) || earlierEntry.roomId === trailingEntry.roomId;

            if (trailingTeacherFreeAtEarlier && earlierTeacherFreeAtGap && trailingRoomFreeAtEarlier && earlierRoomFreeAtGap) {
              unmarkEntityBusy(teacherBusy, earlierEntry.teacherId, earlierSlotId, wtE);
              unmarkEntityBusy(teacherBusy, trailingEntry.teacherId, trailingEntry.timeSlotId, wtT);
              unmarkEntityBusy(roomBusy, earlierEntry.roomId, earlierSlotId, wtE);
              unmarkEntityBusy(roomBusy, trailingEntry.roomId, trailingEntry.timeSlotId, wtT);

              earlierEntry.timeSlotId = gapSlotId;
              trailingEntry.timeSlotId = earlierSlotId;

              markEntityBusy(teacherBusy, earlierEntry.teacherId, gapSlotId, wtE);
              markEntityBusy(teacherBusy, trailingEntry.teacherId, earlierSlotId, wtT);
              markEntityBusy(roomBusy, earlierEntry.roomId, gapSlotId, wtE);
              markEntityBusy(roomBusy, trailingEntry.roomId, earlierSlotId, wtT);

              pMap.set(gapP, earlierIdx);
              pMap.set(p, trailingIdx);
              pMap.delete(maxP);
              break;
            }
          }
        }
      }
    }
  }

  type WkType = "always" | "surat" | "mahraj";

  const pinnedEntriesSet = new Set<InsertScheduleEntry>();
  for (const pl of precomputedLessons) {
    if (pl.pinned) {
      for (const e of finalSchedule) {
        if (e.classId === pl.classId && e.subjectId === pl.subjectId && e.teacherId === pl.teacherId) {
          pinnedEntriesSet.add(e);
        }
      }
    }
  }

  // --- Faza 3.5: Sinf darslaridagi "oyna" (gap) va 1-dars bo'shliqlarini yuqoriga surib yopish (Gap & Front-Gap Elimination Pass) ---
  const slotMapForCompact = new Map(activeSlots.map(s => [s.id, s]));
  const slotByDayPeriodForCompact = new Map<string, typeof activeSlots[0]>();
  for (const s of activeSlots) {
    slotByDayPeriodForCompact.set(`${s.dayOfWeek}_${s.periodNumber}`, s);
  }

  let gapPassMoved = true;
  let gapPasses = 0;

  while (gapPassMoved && gapPasses < 10) {
    if (Date.now() >= deadline) break;
    gapPassMoved = false;
    gapPasses++;

    const entriesByClassDay = new Map<string, number[]>();
    for (let i = 0; i < finalSchedule.length; i++) {
      const e = finalSchedule[i];
      const slot = slotMapForCompact.get(e.timeSlotId);
      if (!slot) continue;
      const key = `${e.classId}_${slot.dayOfWeek}`;
      if (!entriesByClassDay.has(key)) entriesByClassDay.set(key, []);
      entriesByClassDay.get(key)!.push(i);
    }

    for (const [key, indices] of Array.from(entriesByClassDay.entries())) {
      const [cidStr, dayStr] = key.split("_");
      const day = Number(dayStr);

      indices.sort((a, b) => slotMapForCompact.get(finalSchedule[a].timeSlotId)!.periodNumber - slotMapForCompact.get(finalSchedule[b].timeSlotId)!.periodNumber);

      const periodsUsed = indices.map(idx => slotMapForCompact.get(finalSchedule[idx].timeSlotId)!.periodNumber);
      if (periodsUsed.length === 0) continue;

      const minP = Math.min(...periodsUsed);
      const maxP = Math.max(...periodsUsed);
      const usedSet = new Set(periodsUsed);

      // 1. Front Gap check: 1-dars bo'sh bo'lsa (minP > 1), barcha darslarni 1-dars tomonga surishga harakat qilamiz
      if (minP > 1) {
        const targetP = minP - 1;
        const targetSlot = slotByDayPeriodForCompact.get(`${day}_${targetP}`);
        if (targetSlot) {
          const candidateIndex = indices[0]; // birinchi dars (minP dars)
          const candidateEntry = finalSchedule[candidateIndex];
          if (pinnedEntriesSet.has(candidateEntry)) continue;
          const currSlot = slotMapForCompact.get(candidateEntry.timeSlotId)!;
          const wt = (candidateEntry.weekType || "always") as WkType;

          if (!unavailSet.has(`${candidateEntry.teacherId}_${day}_${targetP}`) &&
              !isEntityBusy(teacherBusy, candidateEntry.teacherId, targetSlot.id, wt) &&
              !isEntityBusy(roomBusy, candidateEntry.roomId, targetSlot.id, wt)) {

            unmarkEntityBusy(teacherBusy, candidateEntry.teacherId, currSlot.id, wt);
            unmarkEntityBusy(roomBusy, candidateEntry.roomId, currSlot.id, wt);
            unmarkEntityBusy(classBusy, candidateEntry.classId, currSlot.id, wt);

            candidateEntry.timeSlotId = targetSlot.id;

            markEntityBusy(teacherBusy, candidateEntry.teacherId, targetSlot.id, wt);
            markEntityBusy(roomBusy, candidateEntry.roomId, targetSlot.id, wt);
            markEntityBusy(classBusy, candidateEntry.classId, targetSlot.id, wt);

            gapPassMoved = true;
            break;
          }
        }
      }

      // 2. Middle Gap check: minP va maxP orasida bo'sh oyna (okno) bo'lsa
      for (let targetP = minP + 1; targetP < maxP; targetP++) {
        if (!usedSet.has(targetP)) {
          const targetSlot = slotByDayPeriodForCompact.get(`${day}_${targetP}`);
          if (!targetSlot) continue;

          // 2a. Avval shu kundagi darchadan keyingi BARCHA darslarni sinab ko'ramiz
          const sameDayCandidates = indices.filter(idx => {
            const e = finalSchedule[idx];
            return !pinnedEntriesSet.has(e) && slotMapForCompact.get(e.timeSlotId)!.periodNumber > targetP;
          });

          for (const candIdx of sameDayCandidates) {
            const candidateEntry = finalSchedule[candIdx];
            const currSlot = slotMapForCompact.get(candidateEntry.timeSlotId)!;
            const wt = (candidateEntry.weekType || "always") as WkType;

            if (unavailSet.has(`${candidateEntry.teacherId}_${day}_${targetP}`)) continue;
            if (isEntityBusy(teacherBusy, candidateEntry.teacherId, targetSlot.id, wt)) continue;

            let targetRoomId = candidateEntry.roomId;
            if (isEntityBusy(roomBusy, candidateEntry.roomId, targetSlot.id, wt)) {
              const alt = allRooms.find(r => r.isActive && !isEntityBusy(roomBusy, r.id, targetSlot.id, wt));
              if (alt) targetRoomId = alt.id;
              else continue;
            }

            unmarkEntityBusy(teacherBusy, candidateEntry.teacherId, currSlot.id, wt);
            unmarkEntityBusy(roomBusy, candidateEntry.roomId, currSlot.id, wt);
            unmarkEntityBusy(classBusy, candidateEntry.classId, currSlot.id, wt);

            candidateEntry.timeSlotId = targetSlot.id;
            candidateEntry.roomId = targetRoomId;

            markEntityBusy(teacherBusy, candidateEntry.teacherId, targetSlot.id, wt);
            markEntityBusy(roomBusy, targetRoomId, targetSlot.id, wt);
            markEntityBusy(classBusy, candidateEntry.classId, targetSlot.id, wt);

            gapPassMoved = true;
            break;
          }

          // 2b. Agar shu kungi darslar ko'cha olmasa, BOSHQA KUNLARDAN (ayniqsa 6-darsli kunlardan) dars ko'chirish
          if (!gapPassMoved) {
            const otherDayIndices = finalSchedule
              .map((e, idx) => ({ e, idx }))
              .filter(({ e }) => {
                if (e.classId !== Number(cidStr)) return false;
                if (pinnedEntriesSet.has(e)) return false;
                const sl = slotMapForCompact.get(e.timeSlotId);
                return sl && Number(sl.dayOfWeek) !== day;
              });

            otherDayIndices.sort((a, b) => {
              const slA = slotMapForCompact.get(a.e.timeSlotId)!;
              const slB = slotMapForCompact.get(b.e.timeSlotId)!;
              const countA = (entriesByClassDay.get(`${cidStr}_${slA.dayOfWeek}`) || []).length;
              const countB = (entriesByClassDay.get(`${cidStr}_${slB.dayOfWeek}`) || []).length;
              if (countB !== countA) return countB - countA;
              return slB.periodNumber - slA.periodNumber;
            });

            for (const { e } of otherDayIndices) {
              const currSlot = slotMapForCompact.get(e.timeSlotId)!;
              const wt = (e.weekType || "always") as WkType;

              if (unavailSet.has(`${e.teacherId}_${day}_${targetP}`)) continue;
              if (isEntityBusy(teacherBusy, e.teacherId, targetSlot.id, wt)) continue;

              let targetRoomId = e.roomId;
              if (isEntityBusy(roomBusy, e.roomId, targetSlot.id, wt)) {
                const alt = allRooms.find(r => r.isActive && !isEntityBusy(roomBusy, r.id, targetSlot.id, wt));
                if (alt) targetRoomId = alt.id;
                else continue;
              }

              unmarkEntityBusy(teacherBusy, e.teacherId, currSlot.id, wt);
              unmarkEntityBusy(roomBusy, e.roomId, currSlot.id, wt);
              unmarkEntityBusy(classBusy, e.classId, currSlot.id, wt);

              e.timeSlotId = targetSlot.id;
              e.roomId = targetRoomId;

              markEntityBusy(teacherBusy, e.teacherId, targetSlot.id, wt);
              markEntityBusy(roomBusy, targetRoomId, targetSlot.id, wt);
              markEntityBusy(classBusy, e.classId, targetSlot.id, wt);

              gapPassMoved = true;
              break;
            }
          }

          if (gapPassMoved) break;
        }
      }
    }
  }

  // --- Faza 3.6: Kunlik darslar soatini tenglashtirish (Day Load Equalizer Pass) ---
  // 6 soatlik kunlardan 1 ta darsni olib 4 soatlik kunga ko'chirish
  let balanceMoved = true;
  let balancePasses = 0;

  while (balanceMoved && balancePasses < 5) {
    if (Date.now() >= deadline) break;
    balanceMoved = false;
    balancePasses++;

    for (const cls of targetClasses) {
      const cid = cls.id;
      const days = cls.studyDays ? cls.studyDays.split(",").map(Number) : [1, 2, 3, 4, 5];
      const totalHours = finalSchedule.filter(e => e.classId === cid).length;
      const targetDaily = totalHours / Math.max(1, days.length);

      // Map day -> Array of entry indices
      const dayEntriesMap = new Map<number, number[]>();
      for (const d of days) dayEntriesMap.set(d, []);

      for (let i = 0; i < finalSchedule.length; i++) {
        const e = finalSchedule[i];
        if (e.classId !== cid) continue;
        const slot = slotMapForCompact.get(e.timeSlotId);
        if (!slot) continue;
        if (dayEntriesMap.has(slot.dayOfWeek)) {
          dayEntriesMap.get(slot.dayOfWeek)!.push(i);
        }
      }

      // Find over-loaded day (count > targetDaily + 0.4) and under-loaded day (count < targetDaily - 0.4)
      const overLoadedDay = days.find(d => (dayEntriesMap.get(d)?.length || 0) > targetDaily + 0.4);
      const underLoadedDay = days.find(d => (dayEntriesMap.get(d)?.length || 0) < targetDaily - 0.4);

      if (overLoadedDay && underLoadedDay) {
        const overIndices = dayEntriesMap.get(overLoadedDay)!;
        const underIndices = dayEntriesMap.get(underLoadedDay)!;
        const targetPeriod = underIndices.length + 1;
        const targetSlot = slotByDayPeriodForCompact.get(`${underLoadedDay}_${targetPeriod}`);
        if (!targetSlot) continue;

        // Try candidate lessons from overLoadedDay (sorted by period descending)
        const candidateIndices = [...overIndices]
          .sort((a, b) => slotMapForCompact.get(finalSchedule[b].timeSlotId)!.periodNumber - slotMapForCompact.get(finalSchedule[a].timeSlotId)!.periodNumber)
          .filter(idx => !pinnedEntriesSet.has(finalSchedule[idx]));

        for (const idx of candidateIndices) {
          const candidateEntry = finalSchedule[idx];
          const currSlot = slotMapForCompact.get(candidateEntry.timeSlotId)!;
          const wt = (candidateEntry.weekType || "always") as WkType;

          if (unavailSet.has(`${candidateEntry.teacherId}_${underLoadedDay}_${targetPeriod}`)) continue;
          if (isEntityBusy(teacherBusy, candidateEntry.teacherId, targetSlot.id, wt)) continue;

          // Room resolution: current room or free alternative room
          let targetRoomId = candidateEntry.roomId;
          if (isEntityBusy(roomBusy, candidateEntry.roomId, targetSlot.id, wt)) {
            const alt = allRooms.find(r => r.isActive && !isEntityBusy(roomBusy, r.id, targetSlot.id, wt));
            if (alt) {
              targetRoomId = alt.id;
            } else {
              continue;
            }
          }

          unmarkEntityBusy(teacherBusy, candidateEntry.teacherId, currSlot.id, wt);
          unmarkEntityBusy(roomBusy, candidateEntry.roomId, currSlot.id, wt);
          unmarkEntityBusy(classBusy, candidateEntry.classId, currSlot.id, wt);

          candidateEntry.timeSlotId = targetSlot.id;
          candidateEntry.roomId = targetRoomId;

          markEntityBusy(teacherBusy, candidateEntry.teacherId, targetSlot.id, wt);
          markEntityBusy(roomBusy, targetRoomId, targetSlot.id, wt);
          markEntityBusy(classBusy, candidateEntry.classId, targetSlot.id, wt);

          balanceMoved = true;
          break;
        }
      }
    }
  }

  // --- Faza 3.7: Final Gap-Compacting Pass (Shift late lessons into internal gaps created by balancing) ---
  for (const cls of targetClasses) {
    for (let day = 1; day <= 6; day++) {
      const dayIndices: number[] = [];
      for (let i = 0; i < finalSchedule.length; i++) {
        if (finalSchedule[i].classId !== cls.id) continue;
        const sl = slotMapForCompact.get(finalSchedule[i].timeSlotId);
        if (sl && Number(sl.dayOfWeek) === day) {
          dayIndices.push(i);
        }
      }
      if (dayIndices.length < 2) continue;

      dayIndices.sort((a, b) => slotMapForCompact.get(finalSchedule[a].timeSlotId)!.periodNumber - slotMapForCompact.get(finalSchedule[b].timeSlotId)!.periodNumber);

      const periods = dayIndices.map(idx => slotMapForCompact.get(finalSchedule[idx].timeSlotId)!.periodNumber);
      const minP = Math.min(...periods);
      const maxP = Math.max(...periods);
      const usedSet = new Set(periods);

      for (let targetP = minP; targetP < maxP; targetP++) {
        if (!usedSet.has(targetP)) {
          const targetSlot = slotByDayPeriodForCompact.get(`${day}_${targetP}`);
          if (!targetSlot) continue;

          const candIdx = dayIndices.find(idx => {
            const e = finalSchedule[idx];
            return !pinnedEntriesSet.has(e) && slotMapForCompact.get(e.timeSlotId)!.periodNumber > targetP;
          });
          if (candIdx === undefined) continue;

          const candEntry = finalSchedule[candIdx];
          const currSlot = slotMapForCompact.get(candEntry.timeSlotId)!;
          const wt = (candEntry.weekType || "always") as WkType;

          if (unavailSet.has(`${candEntry.teacherId}_${day}_${targetP}`)) continue;
          if (isEntityBusy(teacherBusy, candEntry.teacherId, targetSlot.id, wt)) continue;

          let targetRoomId = candEntry.roomId;
          if (isEntityBusy(roomBusy, candEntry.roomId, targetSlot.id, wt)) {
            const alt = allRooms.find(r => r.isActive && !isEntityBusy(roomBusy, r.id, targetSlot.id, wt));
            if (alt) targetRoomId = alt.id;
            else continue;
          }

          unmarkEntityBusy(teacherBusy, candEntry.teacherId, currSlot.id, wt);
          unmarkEntityBusy(roomBusy, candEntry.roomId, currSlot.id, wt);
          unmarkEntityBusy(classBusy, candEntry.classId, currSlot.id, wt);

          candEntry.timeSlotId = targetSlot.id;
          candEntry.roomId = targetRoomId;

          markEntityBusy(teacherBusy, candEntry.teacherId, targetSlot.id, wt);
          markEntityBusy(roomBusy, targetRoomId, targetSlot.id, wt);
          markEntityBusy(classBusy, candEntry.classId, targetSlot.id, wt);

          usedSet.delete(currSlot.periodNumber);
          usedSet.add(targetP);
        }
      }
    }
  }

  // --- Faza 3.8: Global Hill-Climbing / Simulated Annealing Pass ---
  await yieldToEventLoop();
  const tHillClimb = Date.now();
  const hillClimbResult = await hillClimbOptimize({
    schedule: scheduleWithRoomCandidates,
    activeSlots: optimizerSlotsForGap,
    slotMap: slotById,
    unavailSet,
    protectedIndices: protectedEntryIndices,
    classGrades: classGradesMap,
    classStudyDays: classStudyDaysMap,
    subjectMap,
    allRooms,
    classHomeRooms: classHomeRoomsMap,
    mode: algorithm === "cpsat_optimal" ? "annealing" : "greedy",
    maxIterations: algorithm === "cpsat_optimal" ? 500 : 300,
    deadline,
  });

  if (hillClimbResult.improved) {
    console.log(`[HillClimb] Timetable improved! Penalty: ${hillClimbResult.initialPenalty} -> ${hillClimbResult.finalPenalty} (${hillClimbResult.totalSwaps} swaps, ${hillClimbResult.totalMoves} moves, ${hillClimbResult.homeRoomFixes} uy xonasi, ${hillClimbResult.iterations} iter, ${Date.now() - tHillClimb}ms${hillClimbResult.timedOut ? ", budjet tugadi" : ""})`);
  }

  // Re-apply updated slot IDs and room IDs back into finalSchedule
  for (let i = 0; i < finalSchedule.length; i++) {
    finalSchedule[i].timeSlotId = scheduleWithRoomCandidates[i].timeSlotId;
    finalSchedule[i].roomId = scheduleWithRoomCandidates[i].roomId;
  }

  // --- Stats and Quality Score calculation ---
  const hardViolations = validateSchedule(finalSchedule, activeSlots, unavailSet);
  if (hardViolations.length > 0) {
    console.error(`[PostValidation] ${hardViolations.length} ta qat'iy shart buzilishi aniqlandi:`, hardViolations);
  }

  // Xona sig'imi va turi muvofiqligini tekshirish (conflict_type: room_capacity / room_type)
  const classMap = new Map(targetClasses.map(c => [c.id, c]));
  const roomMap = new Map(allRooms.map(r => [r.id, r]));
  for (const entry of finalSchedule) {
    const classObj = classMap.get(entry.classId);
    const room = roomMap.get(entry.roomId);
    const lesson = precomputedLessons.find(pl => 
      pl.classId === entry.classId && 
      pl.subjectId === entry.subjectId && 
      pl.teacherId === entry.teacherId
    );
    if (!lesson) continue;

    const requiredCapacity = lesson.teacherId2 ? lesson.classStudents / 2 : lesson.classStudents;
    if (classObj && room) {
      if (room.capacity < requiredCapacity) {
        generatedConflicts.push({
          conflictType: "room_capacity",
          description: `Sinf o'quvchilari soni (${Math.ceil(requiredCapacity)}) xona sig'imidan (${room.capacity}) ko'p — xona: ${room.name}`,
          severity: "low",
          _key: { classId: entry.classId, subjectId: entry.subjectId, teacherId: entry.teacherId, timeSlotId: entry.timeSlotId, weekType: (entry.weekType || "always") as "always" | "surat" | "mahraj" },
        });
      }
      if (lesson.reqType !== "any" && room.roomType !== lesson.reqType) {
        generatedConflicts.push({
          conflictType: "room_type",
          description: `Xona turi mos kelmaydi: talab ${lesson.reqType}, berildi ${room.roomType} — xona: ${room.name}`,
          severity: "low",
          _key: { classId: entry.classId, subjectId: entry.subjectId, teacherId: entry.teacherId, timeSlotId: entry.timeSlotId, weekType: (entry.weekType || "always") as "always" | "surat" | "mahraj" },
        });
      }
    }
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
    const sl = slotById.get(entry.timeSlotId);
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
      const cat = getSubjectCategory(sub?.name || "");
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

  const qualityScore = computeQualityScore({
    totalLessons: precomputedLessons.length,
    skipped: skippedLessons.length,
    hardViolations: hardViolations.length,
    classGaps, teacherGaps, complexityViolations, spacingViolations,
  });

    const candidatePenaltyEval = evaluateSchedulePenalty(scheduleWithRoomCandidates, {
      schedule: scheduleWithRoomCandidates,
      activeSlots: optimizerSlotsForGap,
      slotMap: slotById,
      unavailSet,
      protectedIndices: protectedEntryIndices,
      classGrades: classGradesMap,
      classStudyDays: classStudyDaysMap,
      subjectMap,
      allRooms,
      classHomeRooms: classHomeRoomsMap,
    });

    const candidatePenalty = candidatePenaltyEval.totalPenalty + skippedLessons.length * SKIPPED_LESSON_PENALTY;
    completedRuns++;
    console.log(`[Candidate #${candidateSeed + 1}/${CANDIDATE_RUNS}] Penalty: ${candidatePenalty}, Quality: ${qualityScore}/100, Placed: ${placedLessons}/${precomputedLessons.length} — optimizatsiya ${tHillClimb - tOptimize}ms, jami ${Date.now() - startTime}ms`);

    if (bestRun === null || candidatePenalty < bestRun.penalty) {
      bestRun = {
        finalSchedule: [...finalSchedule],
        generatedConflicts: [...generatedConflicts],
        placedLessons,
        skippedLessons,
        qualityScore,
        penalty: candidatePenalty,
        hardViolations,
        classGaps,
        teacherGaps,
        spacingViolations,
        complexityViolations,
      };
    }
  }

  if (!bestRun) throw new DomainError("Jadval yaratib bo'lmadi");

  const { finalSchedule, generatedConflicts, placedLessons, skippedLessons, qualityScore, hardViolations, classGaps, teacherGaps, spacingViolations, complexityViolations } = bestRun;
  console.log(`[MultiStart Winner] Selected best candidate with penalty ${bestRun.penalty} and quality ${qualityScore}/100 (${completedRuns}/${CANDIDATE_RUNS} nomzod, ${Date.now() - startTime}ms)`);
  await yieldToEventLoop();

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

  const hardCount = hardViolations.length;
  const softCount = generatedConflicts.length;
  let statusNote = "";
  if (hardCount > 0) {
    statusNote = `${hardCount} ta qat'iy to'qnashuv va ${softCount} ta SanPiN tavsiyasi mavjud.`;
  } else if (softCount > 0) {
    statusNote = `Qat'iy to'qnashuvlar yo'q (${softCount} ta SanPiN pedagogik tavsiyasi).`;
  } else {
    statusNote = `Hech qanday ziddiyat yo'q.`;
  }

  return {
    message: coverage === 100
      ? `Barcha ${placedLessons} ta dars jadvalga kiritildi. ${statusNote}`
      : `${placedLessons}/${precomputedLessons.length} ta dars joylashtirildi (${skippedLessons.length} ta o'tkazib yuborildi). ${statusNote}`,
    count: finalSchedule.length,
    coverage,
    skipped: skippedLessons,
    success: true,
    stats: {
      steps: precomputedLessons.length,
      timeMs: Date.now() - startTime,
      candidateRuns: completedRuns,
      maxCandidateRuns: CANDIDATE_RUNS,
      timeBudgetMs,
      budgetExhausted,
    },
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
    // Vaqt oralig'i qayta yaratilganda eski jadval baribir yaroqsiz bo'ladi, shuning uchun
    // uni nofaol qilib qoldirmasdan butunlay o'chiramiz — aks holda har chaqiruvda bazada
    // yangi "o'lik" qatlam to'planadi (bir vaqtlar 27 693 dars yozuvi va 138 slot yig'ilgan).
    await tx.delete(scheduleConflicts);
    await tx.delete(scheduleEntries);
    await tx.delete(timeSlots);
    await tx.insert(timeSlots).values(toCreate);
  });

  return storage.getTimeSlots();
}