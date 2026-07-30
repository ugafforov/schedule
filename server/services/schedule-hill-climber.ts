/**
 * Hill-Climbing va Simulated Annealing Global Optimallashtirgich
 * 
 * Bu modul terilgan dars jadvalining har bir sinfi va o'qituvchisi uchun:
 * 1. Barcha juft dars almashtirishlarini (Pairwise Swaps)
 * 2. Barcha yakka dars ko'chirishlarini (Single Moves / Relocations)
 * 3. Barcha oyna yopish ixchamlashtirishlarini (Gap Compactions)
 * sistemali ravishda sinab ko'radi va jarima ballini (Penalty) minimal darajaga tushiradi.
 */

import { getSubjectCategory, getMaxDailyComplexity, parseGrade, SubjectCategory } from "../../shared/constants";
import { OptimizerScheduleEntry } from "./schedule-optimizer";

export interface HillClimbContext {
  schedule: OptimizerScheduleEntry[];
  activeSlots: Array<{ id: number; dayOfWeek: number; periodNumber: number }>;
  slotMap: Map<number, { id: number; dayOfWeek: number; periodNumber: number }>;
  unavailSet: Set<string>;
  protectedIndices: Set<number>;
  classGrades: Map<number, string>;
  classStudyDays: Map<number, number[]>;
  subjectMap: Map<number, { id: number; name: string }>;
  allRooms: Array<{ id: number; name: string; roomType: string; capacity: number; isActive: boolean }>;
  mode?: "greedy" | "annealing";
  maxIterations?: number;
}

type WkType = "always" | "surat" | "mahraj";

function isWkConflict(a: string, b: string): boolean {
  if (a === "always" || b === "always") return true;
  return a === b;
}

/**
 * Berilgan jadval holati uchun yagona sinf (yoki butun jadval) jarimasini hisoblaydi.
 */
export function evaluateSchedulePenalty(
  schedule: OptimizerScheduleEntry[],
  ctx: HillClimbContext
): { totalPenalty: number; classGaps: number; dayImbalances: number; lateEndings: number; complexityViolations: number } {
  const { slotMap, classStudyDays, classGrades, subjectMap, unavailSet } = ctx;

  let totalPenalty = 0;
  let classGaps = 0;
  let dayImbalances = 0;
  let lateEndings = 0;
  let complexityViolations = 0;

  // Group entries by classId
  const classEntriesMap = new Map<number, number[]>();
  // Busy maps for hard conflict validation
  const teacherSlotMap = new Map<string, Array<{ idx: number; wt: string }>>();
  const classSlotMap = new Map<string, Array<{ idx: number; wt: string }>>();
  const roomSlotMap = new Map<string, Array<{ idx: number; wt: string }>>();

  for (let i = 0; i < schedule.length; i++) {
    const entry = schedule[i];
    if (entry.isActive === false) continue;
    const wt = entry.weekType || "always";

    // Class grouping
    if (!classEntriesMap.has(entry.classId)) classEntriesMap.set(entry.classId, []);
    classEntriesMap.get(entry.classId)!.push(i);

    // Hard conflict checks
    const tKey = `${entry.teacherId}_${entry.timeSlotId}`;
    if (!teacherSlotMap.has(tKey)) teacherSlotMap.set(tKey, []);
    teacherSlotMap.get(tKey)!.push({ idx: i, wt });

    const cKey = `${entry.classId}_${entry.timeSlotId}`;
    if (!classSlotMap.has(cKey)) classSlotMap.set(cKey, []);
    classSlotMap.get(cKey)!.push({ idx: i, wt });

    const rKey = `${entry.roomId}_${entry.timeSlotId}`;
    if (!roomSlotMap.has(rKey)) roomSlotMap.set(rKey, []);
    roomSlotMap.get(rKey)!.push({ idx: i, wt });

    // Unavailability check
    const slot = slotMap.get(entry.timeSlotId);
    if (slot && unavailSet.has(`${entry.teacherId}_${slot.dayOfWeek}_${slot.periodNumber}`)) {
      totalPenalty += 1000;
    }
  }

  // Hard conflict penalties
  for (const group of teacherSlotMap.values()) {
    if (group.length > 1) {
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          const e1 = schedule[group[i].idx];
          const e2 = schedule[group[j].idx];
          if (e1.jointLessonId && e2.jointLessonId && e1.jointLessonId === e2.jointLessonId) continue;
          if (isWkConflict(group[i].wt, group[j].wt)) totalPenalty += 1000;
        }
      }
    }
  }
  for (const group of classSlotMap.values()) {
    if (group.length > 1) {
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          const e1 = schedule[group[i].idx];
          const e2 = schedule[group[j].idx];
          if (e1.jointLessonId && e2.jointLessonId && e1.jointLessonId === e2.jointLessonId) continue;
          if (isWkConflict(group[i].wt, group[j].wt)) totalPenalty += 1000;
        }
      }
    }
  }
  for (const group of roomSlotMap.values()) {
    if (group.length > 1) {
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          const e1 = schedule[group[i].idx];
          const e2 = schedule[group[j].idx];
          if (e1.jointLessonId && e2.jointLessonId && e1.jointLessonId === e2.jointLessonId) continue;
          if (isWkConflict(group[i].wt, group[j].wt)) totalPenalty += 1000;
        }
      }
    }
  }

  // Soft Quality Evaluation per class
  for (const [classId, indices] of classEntriesMap.entries()) {
    const studyDays = classStudyDays.get(classId) || [1, 2, 3, 4, 5];
    const totalLessons = indices.length;
    const targetDaily = totalLessons / Math.max(1, studyDays.length);

    // Day -> Array of periodNumbers
    const dayPeriodsMap = new Map<number, number[]>();
    for (const d of studyDays) dayPeriodsMap.set(d, []);

    for (const idx of indices) {
      const e = schedule[idx];
      const slot = slotMap.get(e.timeSlotId);
      if (!slot) continue;
      const d = slot.dayOfWeek;
      const p = slot.periodNumber;
      if (!dayPeriodsMap.has(d)) dayPeriodsMap.set(d, []);
      dayPeriodsMap.get(d)!.push(p);

      // Complexity penalty
      const sub = subjectMap.get(e.subjectId);
      if (sub) {
        const cat = getSubjectCategory(sub.name || "");
        if (cat === "dynamic" && p <= 3) {
          complexityViolations++;
          totalPenalty += (4 - p) * 10;
        }
        if (cat === "mental" && p >= 5) {
          complexityViolations++;
          totalPenalty += (p - 4) * 15;
        }
      }
    }

    // Day Imbalance & Gap evaluation
    for (const [day, periods] of dayPeriodsMap.entries()) {
      const count = periods.length;
      const diff = Math.abs(count - targetDaily);
      if (diff > 0.5) {
        dayImbalances++;
        totalPenalty += Math.round(diff * diff * 120);
      }

      if (count === 0) continue;
      periods.sort((a, b) => a - b);
      const minP = periods[0];
      const maxP = periods[periods.length - 1];

      // Front gap (dars 1-soatdan emas 2-3 soatdan boshlansa)
      if (minP > 1) {
        const frontGap = minP - 1;
        classGaps += frontGap;
        totalPenalty += frontGap * 5000;
      }

      // Middle gaps (darslar orasidagi oyna / okno)
      for (let i = 1; i < periods.length; i++) {
        const g = periods[i] - periods[i - 1] - 1;
        if (g > 0) {
          classGaps += g;
          totalPenalty += g * 6000;
        }
      }

      // Late ending penalty (6-dars yoki undan kechi, ayniqsa boshqa kunda 5 tadan kam dars bo'lsa)
      if (maxP >= 6) {
        const hasUnderloadedDay = Array.from(dayPeriodsMap.values()).some((pList) => pList.length < 5);
        lateEndings++;
        totalPenalty += (maxP - 5) * (hasUnderloadedDay ? 2000 : 200);
      }
    }
  }

  return { totalPenalty, classGaps, dayImbalances, lateEndings, complexityViolations };
}

/**
 * Berilgan slotda dars uchun bo'sh xonani topadi.
 */
function findFreeRoomForEntry(
  schedule: OptimizerScheduleEntry[],
  entryIdx: number,
  targetSlotId: number,
  ctx: HillClimbContext
): number | null {
  const entry = schedule[entryIdx];
  const { allRooms } = ctx;
  const wt = entry.weekType || "always";

  // 1. Joriy xona shu slotda bo'sh bo'lsa, o'shani saqlaymiz
  let currentRoomFree = true;
  for (let i = 0; i < schedule.length; i++) {
    if (i === entryIdx || schedule[i].isActive === false) continue;
    if (schedule[i].roomId === entry.roomId && schedule[i].timeSlotId === targetSlotId) {
      if (isWkConflict(wt, schedule[i].weekType || "always")) {
        currentRoomFree = false;
        break;
      }
    }
  }
  if (currentRoomFree) return entry.roomId;

  // 2. Aks holda boshqa mos bo'sh xona izlaymiz
  for (const r of allRooms) {
    if (!r.isActive) continue;
    let free = true;
    for (let i = 0; i < schedule.length; i++) {
      if (i === entryIdx || schedule[i].isActive === false) continue;
      if (schedule[i].roomId === r.id && schedule[i].timeSlotId === targetSlotId) {
        if (isWkConflict(wt, schedule[i].weekType || "always")) {
          free = false;
          break;
        }
      }
    }
    if (free) return r.id;
  }

  return null;
}

/**
 * Hill-Climbing Optimallashtirgich
 * Barcha sinflar uchun dars almashtirishlari (Swaps) va ko'chirishlarini (Moves)
 * qat'iy tekshiruvlar va penaltilar kamayishi asosida amalga oshiradi.
 */
export function hillClimbOptimize(ctx: HillClimbContext): {
  improved: boolean;
  initialPenalty: number;
  finalPenalty: number;
  totalSwaps: number;
  totalMoves: number;
} {
  const {
    schedule,
    activeSlots,
    protectedIndices,
    classStudyDays,
    mode = "greedy",
    maxIterations = mode === "annealing" ? 600 : 350,
  } = ctx;

  const slotByDayPeriod = new Map<string, number>();
  for (const s of activeSlots) {
    slotByDayPeriod.set(`${s.dayOfWeek}_${s.periodNumber}`, s.id);
  }

  let currentEval = evaluateSchedulePenalty(schedule, ctx);
  const initialPenalty = currentEval.totalPenalty;
  let currentPenalty = initialPenalty;

  let totalSwaps = 0;
  let totalMoves = 0;

  let temperature = mode === "annealing" ? 150.0 : 0.0;
  const coolingRate = 0.985;

  let globalImproved = false;
  let iteration = 0;

  while (iteration < maxIterations) {
    iteration++;
    let stepImproved = false;

    // Group entries by classId to restrict search space per class
    const classEntriesMap = new Map<number, number[]>();
    for (let i = 0; i < schedule.length; i++) {
      const e = schedule[i];
      if (e.isActive === false) continue;
      if (!classEntriesMap.has(e.classId)) classEntriesMap.set(e.classId, []);
      classEntriesMap.get(e.classId)!.push(i);
    }

    for (const [classId, indices] of classEntriesMap.entries()) {
      const studyDays = classStudyDays.get(classId) || [1, 2, 3, 4, 5, 6];

      // --- OPERATSIYA 1: PAIRWISE SWAPS (Bir sinf ichida 2 dars o'rnini almashtirish) ---
      for (let i = 0; i < indices.length; i++) {
        const idxA = indices[i];
        if (protectedIndices.has(idxA)) continue;
        const entryA = schedule[idxA];
        if (entryA.jointLessonId) continue; // Skip joint lessons for safety

        for (let j = i + 1; j < indices.length; j++) {
          const idxB = indices[j];
          if (protectedIndices.has(idxB)) continue;
          const entryB = schedule[idxB];
          if (entryB.jointLessonId) continue;
          if (entryA.timeSlotId === entryB.timeSlotId) continue;

          // Dynamic room resolving
          const oldSlotA = entryA.timeSlotId;
          const oldSlotB = entryB.timeSlotId;
          const oldRoomA = entryA.roomId;
          const oldRoomB = entryB.roomId;

          const newRoomA = findFreeRoomForEntry(schedule, idxA, oldSlotB, ctx);
          const newRoomB = findFreeRoomForEntry(schedule, idxB, oldSlotA, ctx);

          if (!newRoomA || !newRoomB) continue;

          entryA.timeSlotId = oldSlotB;
          entryA.roomId = newRoomA;
          entryB.timeSlotId = oldSlotA;
          entryB.roomId = newRoomB;

          const testEval = evaluateSchedulePenalty(schedule, ctx);
          const newPenalty = testEval.totalPenalty;
          const delta = newPenalty - currentPenalty;

          let accept = false;
          if (delta < 0) {
            accept = true;
          } else if (mode === "annealing" && temperature > 0.1) {
            const prob = Math.exp(-delta / temperature);
            if (Math.random() < prob) accept = true;
          }

          if (accept) {
            currentPenalty = newPenalty;
            currentEval = testEval;
            totalSwaps++;
            stepImproved = true;
            globalImproved = true;
            break;
          } else {
            // Revert swap
            entryA.timeSlotId = oldSlotA;
            entryA.roomId = oldRoomA;
            entryB.timeSlotId = oldSlotB;
            entryB.roomId = oldRoomB;
          }
        }
        if (stepImproved) break;
      }

      if (stepImproved) continue;

      // --- OPERATSIYA 2: SINGLE RELOCATIONS (Bitta darsni boshqa slotga ko'chirish) ---
      for (let i = 0; i < indices.length; i++) {
        const idx = indices[i];
        if (protectedIndices.has(idx)) continue;
        const entry = schedule[idx];
        if (entry.jointLessonId) continue;

        const currentSlotId = entry.timeSlotId;
        const currentRoomId = entry.roomId;

        // Try candidate slots on all study days
        for (const day of studyDays) {
          for (let period = 1; period <= 6; period++) {
            const targetSlotId = slotByDayPeriod.get(`${day}_${period}`);
            if (!targetSlotId || targetSlotId === currentSlotId) continue;

            const newRoom = findFreeRoomForEntry(schedule, idx, targetSlotId, ctx);
            if (!newRoom) continue;

            entry.timeSlotId = targetSlotId;
            entry.roomId = newRoom;

            const testEval = evaluateSchedulePenalty(schedule, ctx);
            const newPenalty = testEval.totalPenalty;
            const delta = newPenalty - currentPenalty;

            let accept = false;
            if (delta < 0) {
              accept = true;
            } else if (mode === "annealing" && temperature > 0.1) {
              const prob = Math.exp(-delta / temperature);
              if (Math.random() < prob) accept = true;
            }

            if (accept) {
              currentPenalty = newPenalty;
              currentEval = testEval;
              totalMoves++;
              stepImproved = true;
              globalImproved = true;
              break;
            } else {
              entry.timeSlotId = currentSlotId;
              entry.roomId = currentRoomId;
            }
          }
          if (stepImproved) break;
        }
        if (stepImproved) break;
      }
    }

    if (mode === "annealing") {
      temperature *= coolingRate;
    }

    if (!stepImproved && (mode !== "annealing" || temperature <= 0.1)) {
      break; // Local optimum reached
    }
  }

  return {
    improved: globalImproved,
    initialPenalty,
    finalPenalty: currentPenalty,
    totalSwaps,
    totalMoves,
  };
}
