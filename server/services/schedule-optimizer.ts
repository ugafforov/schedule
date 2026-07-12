// Faza 3.3: chegaralangan "retry-with-relaxation" — asosiy greedy solver (schedule.service.ts)
// joylashtira olmagan (skipped) darslar uchun, allaqachon joylashtirilgan BITTA (oddiy,
// bitta o'qituvchili, birlashtirilmagan) darsni boshqa bo'sh vaqtga ko'chirib, bo'shagan
// joyga skipped darsni qo'yishga harakat qiladi. To'liq constraint-solver emas — faqat
// ikki turdagi to'siqni hal qiladi: "o'qituvchi band" va "barcha mos xonalar band"
// (sinf to'siqlari bu bosqichda qo'llab-quvvatlanmaydi, chunki ular ko'proq zanjirli
// ko'chirishni talab qiladi).
//
// MUHIM: bitta chaqiruvda bir nechta skipped dars ketma-ket qayta ishlanadi. Har bir
// reja topilgach DARHOL mark/unmark callback'lari orqali holat yangilanadi (band
// qilinadi/bo'shatiladi) — aks holda ikkinchi skipped dars birinchisi allaqachon band
// qilib qo'ygan xona/slot/o'qituvchiga qarshi eski (yangilanmagan) holat asosida reja
// tuzib, ikkala reja bir xil resursni band qilib, haqiqiy to'qnashuv yaratardi.

export type WeekType = "always" | "surat" | "mahraj";

export interface OptimizerSlot {
  id: number;
  dayOfWeek: number;
}

export interface MovablePlacedLesson {
  index: number; // chaqiruvchining finalSchedule massividagi indeksi
  classId: number;
  teacherId: number;
  roomId: number;
  timeSlotId: number;
  weekType: WeekType;
  studyDays: number[];
}

export interface SkippedLessonInput {
  skippedIndex: number; // chaqiruvchining pending-skip ro'yxatidagi indeksi
  classId: number;
  teacherId: number;
  weekType: WeekType;
  studyDays: number[];
  roomCandidates: number[]; // sig'imi/turi mos xonalar ro'yxati (band-band tekshirilmagan)
}

export interface RelocationPlan {
  skippedIndex: number;
  newSlotId: number;
  newRoomId: number;
  movedLessonIndex: number;
  movedLessonNewSlotId: number;
}

// Ikki weekType bir-biriga zid keladimi (schedule.service.ts'dagi isEntityBusy bilan bir xil mantiq)
export function weekTypesConflict(a: WeekType, b: WeekType): boolean {
  if (a === "always" || b === "always") return true;
  return a === b;
}

export function attemptRelocations(params: {
  skippedLessons: SkippedLessonInput[];
  placedLessons: MovablePlacedLesson[];
  activeSlots: OptimizerSlot[];
  isClassFree: (classId: number, slotId: number, weekType: WeekType) => boolean;
  isTeacherFree: (teacherId: number, slotId: number, weekType: WeekType) => boolean;
  isRoomFree: (roomId: number, slotId: number, weekType: WeekType) => boolean;
  markClassBusy: (classId: number, slotId: number, weekType: WeekType) => void;
  unmarkClassBusy: (classId: number, slotId: number, weekType: WeekType) => void;
  markTeacherBusy: (teacherId: number, slotId: number, weekType: WeekType) => void;
  unmarkTeacherBusy: (teacherId: number, slotId: number, weekType: WeekType) => void;
  markRoomBusy: (roomId: number, slotId: number, weekType: WeekType) => void;
  unmarkRoomBusy: (roomId: number, slotId: number, weekType: WeekType) => void;
  maxAttempts?: number;
}): RelocationPlan[] {
  const {
    skippedLessons, placedLessons, activeSlots,
    isClassFree, isTeacherFree, isRoomFree,
    markClassBusy, unmarkClassBusy, markTeacherBusy, unmarkTeacherBusy, markRoomBusy, unmarkRoomBusy,
    maxAttempts = 200,
  } = params;

  const plans: RelocationPlan[] = [];
  let attempts = 0;
  const relocatedLessonIndices = new Set<number>();

  for (const skipped of skippedLessons) {
    if (attempts >= maxAttempts) break;
    let resolved = false;

    for (const slot of activeSlots) {
      if (attempts >= maxAttempts || resolved) break;
      if (!skipped.studyDays.includes(slot.dayOfWeek)) continue;
      if (!isClassFree(skipped.classId, slot.id, skipped.weekType)) continue;

      const freeRoomId = skipped.roomCandidates.find((rid) => isRoomFree(rid, slot.id, skipped.weekType));
      const teacherFreeHere = isTeacherFree(skipped.teacherId, slot.id, skipped.weekType);

      if (freeRoomId !== undefined && !teacherFreeHere) {
        // --- Holat A: xona bor, lekin o'qituvchi band — o'qituvchini bo'shatishga urinamiz ---
        attempts++;

        const blocker = placedLessons.find(
          (p) =>
            !relocatedLessonIndices.has(p.index) &&
            p.teacherId === skipped.teacherId &&
            p.timeSlotId === slot.id &&
            weekTypesConflict(p.weekType, skipped.weekType)
        );
        if (!blocker) continue;

        for (const newSlot of activeSlots) {
          if (newSlot.id === slot.id) continue;
          if (!blocker.studyDays.includes(newSlot.dayOfWeek)) continue;
          if (!isClassFree(blocker.classId, newSlot.id, blocker.weekType)) continue;
          if (!isTeacherFree(blocker.teacherId, newSlot.id, blocker.weekType)) continue;
          if (!isRoomFree(blocker.roomId, newSlot.id, blocker.weekType)) continue;

          // Rejani DARHOL amalga oshiramiz (holatni yangilaymiz), shunda navbatdagi
          // skipped darslar bu o'zgarishni ko'radi va bir xil resursga da'vogar bo'lmaydi.
          unmarkClassBusy(blocker.classId, slot.id, blocker.weekType);
          unmarkTeacherBusy(blocker.teacherId, slot.id, blocker.weekType);
          unmarkRoomBusy(blocker.roomId, slot.id, blocker.weekType);
          markClassBusy(blocker.classId, newSlot.id, blocker.weekType);
          markTeacherBusy(blocker.teacherId, newSlot.id, blocker.weekType);
          markRoomBusy(blocker.roomId, newSlot.id, blocker.weekType);
          blocker.timeSlotId = newSlot.id;

          markClassBusy(skipped.classId, slot.id, skipped.weekType);
          markTeacherBusy(skipped.teacherId, slot.id, skipped.weekType);
          markRoomBusy(freeRoomId, slot.id, skipped.weekType);

          plans.push({
            skippedIndex: skipped.skippedIndex,
            newSlotId: slot.id,
            newRoomId: freeRoomId,
            movedLessonIndex: blocker.index,
            movedLessonNewSlotId: newSlot.id,
          });
          relocatedLessonIndices.add(blocker.index);
          resolved = true;
          break;
        }
      } else if (freeRoomId === undefined && teacherFreeHere && skipped.roomCandidates.length > 0) {
        // --- Holat B: o'qituvchi bo'sh, lekin mos xonalarning barchasi band —
        // shu slotda mos xonalardan birini egallab turgan darsni bo'shatishga urinamiz ---
        attempts++;

        const roomBlocker = placedLessons.find(
          (p) =>
            !relocatedLessonIndices.has(p.index) &&
            skipped.roomCandidates.includes(p.roomId) &&
            p.timeSlotId === slot.id &&
            weekTypesConflict(p.weekType, skipped.weekType)
        );
        if (!roomBlocker) continue;

        for (const newSlot of activeSlots) {
          if (newSlot.id === slot.id) continue;
          if (!roomBlocker.studyDays.includes(newSlot.dayOfWeek)) continue;
          if (!isClassFree(roomBlocker.classId, newSlot.id, roomBlocker.weekType)) continue;
          if (!isTeacherFree(roomBlocker.teacherId, newSlot.id, roomBlocker.weekType)) continue;
          if (!isRoomFree(roomBlocker.roomId, newSlot.id, roomBlocker.weekType)) continue;

          const freedRoomId = roomBlocker.roomId;
          unmarkClassBusy(roomBlocker.classId, slot.id, roomBlocker.weekType);
          unmarkTeacherBusy(roomBlocker.teacherId, slot.id, roomBlocker.weekType);
          unmarkRoomBusy(freedRoomId, slot.id, roomBlocker.weekType);
          markClassBusy(roomBlocker.classId, newSlot.id, roomBlocker.weekType);
          markTeacherBusy(roomBlocker.teacherId, newSlot.id, roomBlocker.weekType);
          markRoomBusy(freedRoomId, newSlot.id, roomBlocker.weekType);
          roomBlocker.timeSlotId = newSlot.id;

          markClassBusy(skipped.classId, slot.id, skipped.weekType);
          markTeacherBusy(skipped.teacherId, slot.id, skipped.weekType);
          markRoomBusy(freedRoomId, slot.id, skipped.weekType);

          plans.push({
            skippedIndex: skipped.skippedIndex,
            newSlotId: slot.id,
            newRoomId: freedRoomId,
            movedLessonIndex: roomBlocker.index,
            movedLessonNewSlotId: newSlot.id,
          });
          relocatedLessonIndices.add(roomBlocker.index);
          resolved = true;
          break;
        }
      }
    }
  }

  return plans;
}

export function minimizeGaps(params: {
  schedule: Array<{ classId: number; teacherId: number; roomId: number; timeSlotId: number; weekType?: string | null; isActive?: boolean | null }>;
  activeSlots: OptimizerSlot[];
  slotPeriodMap: Map<number, number>;
  slotDayMap: Map<number, number>;
  isClassFree: (classId: number, slotId: number, weekType: WeekType) => boolean;
  isTeacherFree: (teacherId: number, slotId: number, weekType: WeekType) => boolean;
  isRoomFree: (roomId: number, slotId: number, weekType: WeekType) => boolean;
  markClassBusy: (classId: number, slotId: number, weekType: WeekType) => void;
  unmarkClassBusy: (classId: number, slotId: number, weekType: WeekType) => void;
  markTeacherBusy: (teacherId: number, slotId: number, weekType: WeekType) => void;
  unmarkTeacherBusy: (teacherId: number, slotId: number, weekType: WeekType) => void;
  markRoomBusy: (roomId: number, slotId: number, weekType: WeekType) => void;
  unmarkRoomBusy: (roomId: number, slotId: number, weekType: WeekType) => void;
  maxIterations?: number;
}): number {
  const {
    schedule, activeSlots, slotPeriodMap, slotDayMap,
    isClassFree, isTeacherFree, isRoomFree,
    markClassBusy, unmarkClassBusy, markTeacherBusy, unmarkTeacherBusy, markRoomBusy, unmarkRoomBusy,
    maxIterations = 300,
  } = params;

  const slotsByDay = new Map<number, OptimizerSlot[]>();
  for (const s of activeSlots) {
    if (!slotsByDay.has(s.dayOfWeek)) slotsByDay.set(s.dayOfWeek, []);
    slotsByDay.get(s.dayOfWeek)!.push(s);
  }

  let swaps = 0;
  let improved = true;
  let iteration = 0;

  while (improved && iteration < maxIterations) {
    improved = false;
    iteration++;

    const classDayPeriods = new Map<string, Map<number, number>>();
    for (let i = 0; i < schedule.length; i++) {
      const e = schedule[i];
      const day = slotDayMap.get(e.timeSlotId);
      const period = slotPeriodMap.get(e.timeSlotId);
      if (day === undefined || period === undefined) continue;
      const key = `${e.classId}_${day}`;
      if (!classDayPeriods.has(key)) classDayPeriods.set(key, new Map());
      classDayPeriods.get(key)!.set(period, i);
    }

    for (const [cdKey, periodMap] of Array.from(classDayPeriods.entries())) {
      const periods = Array.from(periodMap.keys()).sort((a, b) => a - b);
      if (periods.length < 2) continue;

      let hasGap = false;
      for (let i = 1; i < periods.length; i++) {
        if (periods[i] - periods[i - 1] > 1) { hasGap = true; break; }
      }
      if (!hasGap) continue;

      const gapPeriod = findFirstGap(periods);
      if (gapPeriod === -1) continue;

      const parts = cdKey.split("_");
      const classId = parseInt(parts[0]);
      const gapDay = parseInt(parts[1]);

      const gapDaySlots = slotsByDay.get(gapDay) || [];
      const gapSlot = gapDaySlots.find(s => slotPeriodMap.get(s.id) === gapPeriod);
      if (!gapSlot) continue;

      let didSwap = false;
      for (const [otherCdKey, otherPeriodMap] of Array.from(classDayPeriods.entries())) {
        if (didSwap) break;
        if (!otherCdKey.startsWith(`${classId}_`)) continue;
        const otherDay = parseInt(otherCdKey.split("_")[1]);
        if (otherDay === gapDay) continue;

        const otherPeriods = Array.from(otherPeriodMap.keys()).sort((a, b) => a - b);
        if (otherPeriods.length === 0) continue;
        const lastPeriod = otherPeriods[otherPeriods.length - 1];
        const entryIdx = otherPeriodMap.get(lastPeriod);
        if (entryIdx === undefined) continue;

        const entry = schedule[entryIdx];
        const wt = (entry.weekType || "always") as WeekType;

        if (!isClassFree(classId, gapSlot.id, wt)) continue;
        if (!isTeacherFree(entry.teacherId, gapSlot.id, wt)) continue;
        if (!isRoomFree(entry.roomId, gapSlot.id, wt)) continue;

        const oldSlotId = entry.timeSlotId;
        unmarkClassBusy(entry.classId, oldSlotId, wt);
        unmarkTeacherBusy(entry.teacherId, oldSlotId, wt);
        unmarkRoomBusy(entry.roomId, oldSlotId, wt);

        markClassBusy(entry.classId, gapSlot.id, wt);
        markTeacherBusy(entry.teacherId, gapSlot.id, wt);
        markRoomBusy(entry.roomId, gapSlot.id, wt);

        entry.timeSlotId = gapSlot.id;
        swaps++;
        improved = true;
        didSwap = true;
      }
    }
  }

  return swaps;
}

function findFirstGap(sortedPeriods: number[]): number {
  for (let i = 1; i < sortedPeriods.length; i++) {
    if (sortedPeriods[i] - sortedPeriods[i - 1] > 1) {
      return sortedPeriods[i - 1] + 1;
    }
  }
  return -1;
}
