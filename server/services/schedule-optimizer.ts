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

import { getMaxHoursPerDay, parseGrade, type SubjectCategory } from "../../shared/constants";

export type WeekType = "always" | "surat" | "mahraj";

export interface OptimizerScheduleEntry {
  classId: number;
  subjectId: number;
  teacherId: number;
  roomId: number;
  timeSlotId: number;
  weekType?: string | null;
  isActive?: boolean | null;
  roomCandidates?: number[];
  jointLessonId?: number | null;
}

function isPrimaryConsecutiveViolation(params: {
  schedule?: OptimizerScheduleEntry[];
  classId: number;
  subjectId: number;
  targetSlotId: number;
  weekType: string;
  classGrades?: Map<number, string>;
  slotPeriodMap?: Map<number, number>;
  slotDayMap?: Map<number, number>;
  excludeEntryIdx?: number;
}): boolean {
  const grade = params.classGrades?.get(params.classId) || "5";
  if (parseGrade(grade) > 4) return false; // Faqat 1-4 boshlang'ich sinflar uchun

  // Kerakli kontekst berilmasa tekshirilmaydi (eski xatti-harakat).
  if (!params.schedule || !params.slotPeriodMap || !params.slotDayMap) return false;

  const targetPeriod = params.slotPeriodMap.get(params.targetSlotId);
  const targetDay = params.slotDayMap.get(params.targetSlotId);
  if (targetPeriod === undefined || targetDay === undefined) return false;

  for (let i = 0; i < params.schedule.length; i++) {
    if (i === params.excludeEntryIdx) continue;
    const e = params.schedule[i];
    if (e.classId !== params.classId || e.subjectId !== params.subjectId) continue;

    const day = params.slotDayMap.get(e.timeSlotId);
    const period = params.slotPeriodMap.get(e.timeSlotId);
    if (day !== targetDay || period === undefined) continue;

    const wt = e.weekType || "always";
    const conflict = wt === "always" || params.weekType === "always" || wt === params.weekType;
    if (!conflict) continue;

    if (Math.abs(period - targetPeriod) === 1) {
      return true;
    }
  }
  return false;
}

export interface OptimizerSlot {
  id: number;
  dayOfWeek: number;
}

export interface MovablePlacedLesson {
  index: number; // chaqiruvchining finalSchedule massividagi indeksi
  classId: number;
  subjectId: number;
  teacherId: number;
  roomId: number;
  timeSlotId: number;
  weekType: WeekType;
  studyDays: number[];
}

export interface SkippedLessonInput {
  skippedIndex: number; // chaqiruvchining pending-skip ro'yxatidagi indeksi
  classId: number;
  subjectId: number;
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

/**
 * Sinf uchun SanPiN kunlik dars limiti tekshiruvi (chaqiruvchi tomonidan beriladi).
 * `fromSlotId` berilsa — dars o'sha slotdan ko'chirilmoqda, ya'ni u shu kunda allaqachon
 * sanalgan bo'lsa, hisobdan chiqariladi (bir kun ichidagi ko'chirish limitni oshirmaydi).
 */
export type CanPlaceClassOnDay = (
  classId: number,
  toSlotId: number,
  weekType: WeekType,
  fromSlotId?: number,
) => boolean;

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
  /** SanPiN kunlik limit tekshiruvi — berilmasa tekshirilmaydi (eski xatti-harakat). */
  canPlaceClassOnDay?: CanPlaceClassOnDay;
  /** Boshlang'ich sinf juft dars tekshiruvi uchun kontekst — berilmasa tekshirilmaydi. */
  fullSchedule?: OptimizerScheduleEntry[];
  classGrades?: Map<number, string>;
  slotPeriodMap?: Map<number, number>;
  slotDayMap?: Map<number, number>;
  maxAttempts?: number;
}): RelocationPlan[] {
  const {
    skippedLessons, placedLessons, activeSlots,
    isClassFree, isTeacherFree, isRoomFree,
    markClassBusy, unmarkClassBusy, markTeacherBusy, unmarkTeacherBusy, markRoomBusy, unmarkRoomBusy,
    canPlaceClassOnDay,
    fullSchedule,
    classGrades,
    slotPeriodMap,
    slotDayMap,
    maxAttempts = 200,
  } = params;
  const canPlace: CanPlaceClassOnDay = canPlaceClassOnDay ?? (() => true);

  const plans: RelocationPlan[] = [];
  let attempts = 0;
  const relocatedLessonIndices = new Set<number>();

  // Copy fullSchedule to avoid mutating caller's original array or causing duplicates
  const currentSchedule = fullSchedule ? [...fullSchedule] : [];

  for (const skipped of skippedLessons) {
    if (attempts >= maxAttempts) break;
    let resolved = false;

    for (const slot of activeSlots) {
      if (attempts >= maxAttempts || resolved) break;
      if (!skipped.studyDays.includes(slot.dayOfWeek)) continue;
      if (!isClassFree(skipped.classId, slot.id, skipped.weekType)) continue;
      // SanPiN: shu kunda sinfning dars soati limiti to'lgan bo'lsa, bu slotga qo'ymaymiz
      if (!canPlace(skipped.classId, slot.id, skipped.weekType)) continue;

      // Boshlang'ich sinf ketma-ket juft dars taqiqi (hard constraint)
      if (isPrimaryConsecutiveViolation({
        schedule: currentSchedule,
        classId: skipped.classId,
        subjectId: skipped.subjectId,
        targetSlotId: slot.id,
        weekType: skipped.weekType,
        classGrades,
        slotPeriodMap,
        slotDayMap,
      })) continue;

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
          if (!canPlace(blocker.classId, newSlot.id, blocker.weekType, slot.id)) continue;

          // Boshlang'ich sinf ketma-ket juft dars taqiqi (hard constraint)
          if (isPrimaryConsecutiveViolation({
            schedule: currentSchedule,
            classId: blocker.classId,
            subjectId: blocker.subjectId,
            targetSlotId: newSlot.id,
            weekType: blocker.weekType,
            classGrades,
            slotPeriodMap,
            slotDayMap,
            excludeEntryIdx: blocker.index,
          })) continue;

          // Rejani DARHOL amalga oshiramiz (holatni yangilaymiz), shunda navbatdagi
          // skipped darslar bu o'zgarishni ko'radi va bir xil resursga da'vogar bo'lmaydi.
          unmarkClassBusy(blocker.classId, slot.id, blocker.weekType);
          unmarkTeacherBusy(blocker.teacherId, slot.id, blocker.weekType);
          unmarkRoomBusy(blocker.roomId, slot.id, blocker.weekType);
          markClassBusy(blocker.classId, newSlot.id, blocker.weekType);
          markTeacherBusy(blocker.teacherId, newSlot.id, blocker.weekType);
          markRoomBusy(blocker.roomId, newSlot.id, blocker.weekType);
          
          blocker.timeSlotId = newSlot.id;
          if (currentSchedule[blocker.index]) {
            currentSchedule[blocker.index] = {
              ...currentSchedule[blocker.index],
              timeSlotId: newSlot.id,
            };
          }

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
          
          // Yangi joylashtirilgan darsni ham currentSchedule'ga qo'shamiz
          currentSchedule.push({
            classId: skipped.classId,
            subjectId: skipped.subjectId,
            teacherId: skipped.teacherId,
            roomId: freeRoomId,
            timeSlotId: slot.id,
            weekType: skipped.weekType,
          });

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
          if (!canPlace(roomBlocker.classId, newSlot.id, roomBlocker.weekType, slot.id)) continue;

          // Boshlang'ich sinf ketma-ket juft dars taqiqi (hard constraint)
          if (isPrimaryConsecutiveViolation({
            schedule: currentSchedule,
            classId: roomBlocker.classId,
            subjectId: roomBlocker.subjectId,
            targetSlotId: newSlot.id,
            weekType: roomBlocker.weekType,
            classGrades,
            slotPeriodMap,
            slotDayMap,
            excludeEntryIdx: roomBlocker.index,
          })) continue;

          const freedRoomId = roomBlocker.roomId;
          unmarkClassBusy(roomBlocker.classId, slot.id, roomBlocker.weekType);
          unmarkTeacherBusy(roomBlocker.teacherId, slot.id, roomBlocker.weekType);
          unmarkRoomBusy(freedRoomId, slot.id, roomBlocker.weekType);
          markClassBusy(roomBlocker.classId, newSlot.id, roomBlocker.weekType);
          markTeacherBusy(roomBlocker.teacherId, newSlot.id, roomBlocker.weekType);
          markRoomBusy(freedRoomId, newSlot.id, roomBlocker.weekType);
          
          roomBlocker.timeSlotId = newSlot.id;
          if (currentSchedule[roomBlocker.index]) {
            currentSchedule[roomBlocker.index] = {
              ...currentSchedule[roomBlocker.index],
              timeSlotId: newSlot.id,
            };
          }

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

          // Yangi joylashtirilgan darsni ham currentSchedule'ga qo'shamiz
          currentSchedule.push({
            classId: skipped.classId,
            subjectId: skipped.subjectId,
            teacherId: skipped.teacherId,
            roomId: freedRoomId,
            timeSlotId: slot.id,
            weekType: skipped.weekType,
          });

          resolved = true;
          break;
        }
      }
    }
  }

  return plans;
}

/**
 * Sinf jadvalidagi "oyna"larni (kun ichidagi bo'sh oraliq) kamaytiradi: boshqa kunning
 * OXIRGI darsini oynaga ko'chiradi.
 *
 * MUHIM cheklovlar (bularsiz optimizatsiya jadvalni buzadi):
 *  - `protectedIndices` — hech qachon ko'chirilmaydigan darslar: sinf soati (pinned),
 *    birlashtirilgan (joint) va guruhga bo'lingan (split) darslar.
 *  - `canPlaceClassOnDay` — SanPiN kunlik dars limiti (oyna kunida limit oshmasin).
 *  - Manba kun himoyasi: 2 darsli kundan bittasini olib ketib, "1 darsli kun" yaratmaymiz.
 */
export function minimizeGaps(params: {
  schedule: OptimizerScheduleEntry[];
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
  /** finalSchedule indekslari — ko'chirilmaydigan darslar (sinf soati, joint, split). */
  protectedIndices?: Set<number>;
  /** SanPiN kunlik limit tekshiruvi — berilmasa tekshirilmaydi (eski xatti-harakat). */
  canPlaceClassOnDay?: CanPlaceClassOnDay;
  classGrades?: Map<number, string>;
  maxIterations?: number;
}): number {
  const {
    schedule, activeSlots, slotPeriodMap, slotDayMap,
    isClassFree, isTeacherFree, isRoomFree,
    markClassBusy, unmarkClassBusy, markTeacherBusy, unmarkTeacherBusy, markRoomBusy, unmarkRoomBusy,
    protectedIndices,
    canPlaceClassOnDay,
    classGrades,
    maxIterations = 300,
  } = params;
  const canPlace: CanPlaceClassOnDay = canPlaceClassOnDay ?? (() => true);

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

      let hasGap = periods.length > 0 && periods[0] > 1;
      if (!hasGap) {
        for (let i = 1; i < periods.length; i++) {
          if (periods[i] - periods[i - 1] > 1) { hasGap = true; break; }
        }
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
        // Manba kun himoyasi: 2 darsli kundan bittasini olsak, "1 darsli kun" qoladi
        if (otherPeriods.length === 2) continue;
        const lastPeriod = otherPeriods[otherPeriods.length - 1];
        const entryIdx = otherPeriodMap.get(lastPeriod);
        if (entryIdx === undefined) continue;
        // Sinf soati (pinned), joint va split darslar ko'chirilmaydi
        if (protectedIndices?.has(entryIdx)) continue;

        const entry = schedule[entryIdx];
        const wt = (entry.weekType || "always") as WeekType;

        if (!isClassFree(classId, gapSlot.id, wt)) continue;
        if (!isTeacherFree(entry.teacherId, gapSlot.id, wt)) continue;
        // SanPiN: oyna kunida sinfning kunlik dars limiti oshmasin
        if (!canPlace(classId, gapSlot.id, wt, entry.timeSlotId)) continue;

        // Kunlik akademik dars limitini tekshirish (gapDay uchun)
        const gapDayEntries = Array.from(periodMap.values());
        let gapDayAcademicCount = 0;
        for (const idx of gapDayEntries) {
          if (!protectedIndices?.has(idx)) {
            const ge = schedule[idx];
            // weekType berilmagan bo'lsa "always" hisoblanadi (yuqoridagi wt bilan bir xil mantiq)
            gapDayAcademicCount += (ge.weekType || "always") === "always" ? 1 : 0.5;
          }
        }
        const grade = classGrades?.get(classId) || "5";
        const maxAcademicLimit = getMaxHoursPerDay(grade);
        const loadVal = wt === "always" ? 1 : 0.5;
        if (gapDayAcademicCount + loadVal > maxAcademicLimit) continue;

        // Boshlang'ich sinf ketma-ket juft dars taqiqi (hard constraint)
        if (isPrimaryConsecutiveViolation({
          schedule,
          classId,
          subjectId: entry.subjectId,
          targetSlotId: gapSlot.id,
          weekType: wt,
          classGrades,
          slotPeriodMap,
          slotDayMap,
          excludeEntryIdx: entryIdx,
        })) continue;

        // Xona tekshiruvi: avval hozirgi xona, keyin roomCandidates'dan bo'sh topish
        let newRoomId = entry.roomId;
        if (!isRoomFree(entry.roomId, gapSlot.id, wt)) {
          const candidates = entry.roomCandidates || [];
          const alt = candidates.find(rid => rid !== entry.roomId && isRoomFree(rid, gapSlot.id, wt));
          if (alt !== undefined) {
            newRoomId = alt;
          } else {
            continue;
          }
        }

        const oldSlotId = entry.timeSlotId;
        const oldRoomId = entry.roomId;
        unmarkClassBusy(entry.classId, oldSlotId, wt);
        unmarkTeacherBusy(entry.teacherId, oldSlotId, wt);
        unmarkRoomBusy(oldRoomId, oldSlotId, wt);

        entry.roomId = newRoomId;
        markClassBusy(entry.classId, gapSlot.id, wt);
        markTeacherBusy(entry.teacherId, gapSlot.id, wt);
        markRoomBusy(newRoomId, gapSlot.id, wt);

        entry.timeSlotId = gapSlot.id;
        swaps++;
        improved = true;
        didSwap = true;
      }
    }
  }

  return swaps;
}

/**
 * Kun ICHIDAGI oynalarni yopadi: oynadan keyingi darsni shu kunning bo'sh darsiga
 * suradi (1,2,3,4,_,_,7 → 1,2,3,4,5).
 *
 * minimizeGaps faqat BOSHQA kunning oxirgi darsini oynaga ko'chiradi — ayni kun ichidagi
 * oynani u yopa olmaydi. Ikkalasi birgalikda ishlaydi.
 *
 * Himoyalangan darslar (sinf soati, joint, split) ko'chirilmaydi; ular oynadan keyin
 * turgan bo'lsa, ulardan keyingi ko'chirilishi mumkin bo'lgan dars sinaladi.
 */
export function compactDays(params: {
  schedule: OptimizerScheduleEntry[];
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
  protectedIndices?: Set<number>;
  classGrades?: Map<number, string>;
  maxIterations?: number;
}): number {
  const {
    schedule, activeSlots, slotPeriodMap, slotDayMap,
    isClassFree, isTeacherFree, isRoomFree,
    markClassBusy, unmarkClassBusy, markTeacherBusy, unmarkTeacherBusy, markRoomBusy, unmarkRoomBusy,
    protectedIndices,
    classGrades,
    maxIterations = 300,
  } = params;

  const slotByDayPeriod = new Map<string, number>();
  for (const s of activeSlots) {
    const period = slotPeriodMap.get(s.id);
    if (period !== undefined) slotByDayPeriod.set(`${s.dayOfWeek}_${period}`, s.id);
  }

  let moves = 0;
  let improved = true;
  let iteration = 0;

  while (improved && iteration < maxIterations) {
    improved = false;
    iteration++;

    // class_day → (period → schedule indeksi)
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

      const gapPeriod = findFirstGap(periods);
      if (gapPeriod === -1) continue;

      const [classIdStr, dayStr] = cdKey.split("_");
      const classId = parseInt(classIdStr);
      const day = parseInt(dayStr);
      const gapSlotId = slotByDayPeriod.get(`${day}_${gapPeriod}`);
      if (gapSlotId === undefined) continue;

      // Oynadan keyingi darslar — eng yaqinidan boshlab ko'chirishga urinamiz
      for (const period of periods) {
        if (period < gapPeriod) continue;
        const idx = periodMap.get(period)!;
        if (protectedIndices?.has(idx)) continue;

        const entry = schedule[idx];
        const wt = (entry.weekType || "always") as WeekType;
        if (!isClassFree(classId, gapSlotId, wt)) continue;
        if (!isTeacherFree(entry.teacherId, gapSlotId, wt)) {
          let swapDone = false;
          for (const prevPeriod of periods) {
            if (prevPeriod >= gapPeriod) continue;
            const prevIdx = periodMap.get(prevPeriod)!;
            if (protectedIndices?.has(prevIdx)) continue;
            const prevEntry = schedule[prevIdx];
            const prevWt = (prevEntry.weekType || "always") as WeekType;
            const prevSlotId = slotByDayPeriod.get(`${day}_${prevPeriod}`);
            if (!prevSlotId) continue;

            // Check if trailing entry can go to prevSlotId and prevEntry can go to gapSlotId
            const entryCanGoToPrev = isTeacherFree(entry.teacherId, prevSlotId, wt);
            const prevCanGoToGap = isTeacherFree(prevEntry.teacherId, gapSlotId, prevWt);

            if (entryCanGoToPrev && prevCanGoToGap) {
              let prevNewRoomId = prevEntry.roomId;
              if (!isRoomFree(prevEntry.roomId, gapSlotId, prevWt)) {
                const candidates = prevEntry.roomCandidates || [];
                const alt = candidates.find(rid => rid !== prevEntry.roomId && isRoomFree(rid, gapSlotId, prevWt));
                if (alt !== undefined) prevNewRoomId = alt;
                else continue;
              }

              let entryNewRoomId = entry.roomId;
              if (!isRoomFree(entry.roomId, prevSlotId, wt)) {
                const candidates = entry.roomCandidates || [];
                const alt = candidates.find(rid => rid !== entry.roomId && isRoomFree(rid, prevSlotId, wt));
                if (alt !== undefined) entryNewRoomId = alt;
                else continue;
              }

              const entryOldSlot = entry.timeSlotId;
              const entryOldRoom = entry.roomId;
              const prevOldSlot = prevEntry.timeSlotId;
              const prevOldRoom = prevEntry.roomId;

              unmarkClassBusy(entry.classId, entryOldSlot, wt);
              unmarkTeacherBusy(entry.teacherId, entryOldSlot, wt);
              unmarkRoomBusy(entryOldRoom, entryOldSlot, wt);

              unmarkClassBusy(prevEntry.classId, prevOldSlot, prevWt);
              unmarkTeacherBusy(prevEntry.teacherId, prevOldSlot, prevWt);
              unmarkRoomBusy(prevOldRoom, prevOldSlot, prevWt);

              prevEntry.roomId = prevNewRoomId;
              prevEntry.timeSlotId = gapSlotId;
              markClassBusy(prevEntry.classId, gapSlotId, prevWt);
              markTeacherBusy(prevEntry.teacherId, gapSlotId, prevWt);
              markRoomBusy(prevNewRoomId, gapSlotId, prevWt);

              entry.roomId = entryNewRoomId;
              entry.timeSlotId = prevSlotId;
              markClassBusy(entry.classId, prevSlotId, wt);
              markTeacherBusy(entry.teacherId, prevSlotId, wt);
              markRoomBusy(entryNewRoomId, prevSlotId, wt);

              moves += 2;
              improved = true;
              swapDone = true;
              break;
            }
          }
          if (swapDone) break;
          continue;
        }

        // Boshlang'ich sinf ketma-ket juft dars taqiqi (hard constraint)
        if (isPrimaryConsecutiveViolation({
          schedule,
          classId,
          subjectId: entry.subjectId,
          targetSlotId: gapSlotId,
          weekType: wt,
          classGrades,
          slotPeriodMap,
          slotDayMap,
          excludeEntryIdx: idx,
        })) continue;

        // Xona tekshiruvi: avval hozirgi xona, keyin roomCandidates'dan bo'sh topish
        let newRoomId = entry.roomId;
        if (!isRoomFree(entry.roomId, gapSlotId, wt)) {
          const candidates = entry.roomCandidates || [];
          const alt = candidates.find(rid => rid !== entry.roomId && isRoomFree(rid, gapSlotId, wt));
          if (alt !== undefined) {
            newRoomId = alt;
          } else {
            continue;
          }
        }

        const oldSlotId = entry.timeSlotId;
        const oldRoomId = entry.roomId;
        unmarkClassBusy(entry.classId, oldSlotId, wt);
        unmarkTeacherBusy(entry.teacherId, oldSlotId, wt);
        unmarkRoomBusy(oldRoomId, oldSlotId, wt);
        entry.roomId = newRoomId;
        markClassBusy(entry.classId, gapSlotId, wt);
        markTeacherBusy(entry.teacherId, gapSlotId, wt);
        markRoomBusy(newRoomId, gapSlotId, wt);
        entry.timeSlotId = gapSlotId;

        moves++;
        improved = true;
        break;
      }
    }
  }

  return moves;
}

function findFirstGap(sortedPeriods: number[]): number {
  if (sortedPeriods.length > 0 && sortedPeriods[0] > 1) {
    return 1;
  }
  for (let i = 1; i < sortedPeriods.length; i++) {
    if (sortedPeriods[i] - sortedPeriods[i - 1] > 1) {
      return sortedPeriods[i - 1] + 1;
    }
  }
  return -1;
}

/**
 * Kunlararo dars sonini teng taqsimlaydi: "og'ir" (ko'p darsli) kunlarning oxirgi darsini
 * "yengil" (kam darsli) kunlarga ko'chiradi.
 *
 * minimizeGaps ichki oynalarni (1,2,_,4) to'ldirsa, balanceDays KUNLAR ORASIDA dars SONIni
 * tekislaydi. 6-A dushanba=1 dars, seshanba=6 dars muammosini faqat shu funksiya hal qiladi.
 */
export function balanceDays(params: {
  schedule: OptimizerScheduleEntry[];
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
  protectedIndices?: Set<number>;
  canPlaceClassOnDay?: CanPlaceClassOnDay;
  /** classId → studyDays number[] */
  classStudyDays: Map<number, number[]>;
  /** classId → grade string */
  classGrades?: Map<number, string>;
  maxIterations?: number;
}): number {
  const {
    schedule, activeSlots, slotPeriodMap, slotDayMap,
    isClassFree, isTeacherFree, isRoomFree,
    markClassBusy, unmarkClassBusy, markTeacherBusy, unmarkTeacherBusy, markRoomBusy, unmarkRoomBusy,
    protectedIndices,
    canPlaceClassOnDay,
    classStudyDays,
    classGrades,
    maxIterations = 200,
  } = params;
  const canPlace: CanPlaceClassOnDay = canPlaceClassOnDay ?? (() => true);

  const slotsByDay = new Map<number, OptimizerSlot[]>();
  for (const s of activeSlots) {
    if (!slotsByDay.has(s.dayOfWeek)) slotsByDay.set(s.dayOfWeek, []);
    slotsByDay.get(s.dayOfWeek)!.push(s);
  }
  // Sort each day's slots by period
  for (const entry of Array.from(slotsByDay.entries())) {
    entry[1].sort((a: OptimizerSlot, b: OptimizerSlot) => (slotPeriodMap.get(a.id) || 0) - (slotPeriodMap.get(b.id) || 0));
  }

  // Collect unique class IDs from the schedule
  const classIds = new Set<number>();
  for (const e of schedule) classIds.add(e.classId);

  const movedEntryIndices = new Set<number>();
  let moves = 0;
  let improved = true;
  let iteration = 0;

  while (improved && iteration < maxIterations) {
    improved = false;
    iteration++;

    for (const classId of Array.from(classIds)) {
      const studyDays = classStudyDays.get(classId) || [1, 2, 3, 4, 5];

      // Build day → [schedule indices] map for this class
      const dayEntries = new Map<number, number[]>();
      for (const d of studyDays) dayEntries.set(d, []);
      for (let i = 0; i < schedule.length; i++) {
        const e = schedule[i];
        if (e.classId !== classId) continue;
        const day = slotDayMap.get(e.timeSlotId);
        if (day === undefined) continue;
        const arr = dayEntries.get(day);
        if (arr) arr.push(i);
      }

      const totalLessons = Array.from(dayEntries.values()).reduce((s, a) => s + a.length, 0);
      const targetDaily = totalLessons / studyDays.length;
      const targetLow = Math.floor(targetDaily);
      const targetHigh = Math.ceil(targetDaily);

      // Find heaviest day (most above target) and lightest day (most below target)
      let heaviestDay = -1;
      let heaviestCount = 0;
      let lightestDay = -1;
      let lightestCount = Infinity;

      for (const d of studyDays) {
        const count = (dayEntries.get(d) || []).length;
        if (count > heaviestCount) { heaviestCount = count; heaviestDay = d; }
        if (count < lightestCount) { lightestCount = count; lightestDay = d; }
      }

      const heavyIndices = dayEntries.get(heaviestDay) || [];
      const heavyMaxPeriod = heavyIndices.length > 0
        ? Math.max(...heavyIndices.map(idx => slotPeriodMap.get(schedule[idx].timeSlotId) || 0))
        : 0;

      const countDiff = heaviestCount - lightestCount;
      const isLateEndingDay = heavyMaxPeriod >= 6 && heaviestCount > targetLow && lightestCount < targetHigh;

      if (heaviestDay === lightestDay) continue;
      if (countDiff <= 0) continue;
      if (countDiff <= 1 && !isLateEndingDay) continue;
      if (heaviestCount <= targetHigh && lightestCount >= targetLow && !isLateEndingDay) continue;
      // Sort by period descending — pick the last period's entry
      heavyIndices.sort((a, b) => {
        const pA = slotPeriodMap.get(schedule[a].timeSlotId) || 0;
        const pB = slotPeriodMap.get(schedule[b].timeSlotId) || 0;
        return pB - pA;
      });

      let didMove = false;
      for (const entryIdx of heavyIndices) {
        if (didMove) break;
        if (protectedIndices?.has(entryIdx)) continue;
        if (movedEntryIndices.has(entryIdx)) continue;
        // Don't leave heaviest day with fewer than targetLow (protect from creating new imbalance)
        if (heavyIndices.length <= targetLow) break;

        const entry = schedule[entryIdx];
        const wt = (entry.weekType || "always") as WeekType;

        // Kunlik akademik dars limitini tekshirish
        const grade = classGrades?.get(classId) || "5";
        const maxAcademicLimit = getMaxHoursPerDay(grade);
        const lightIndices = dayEntries.get(lightestDay) || [];
        let lightAcademicCount = 0;
        for (const idx of lightIndices) {
          if (!protectedIndices?.has(idx)) lightAcademicCount++;
        }
        if (lightAcademicCount + 1 > maxAcademicLimit) continue;

        // Find first available slot on lightest day (ascending by period)
        const lightSlots = slotsByDay.get(lightestDay) || [];
        for (const targetSlot of lightSlots) {
          if (!isClassFree(classId, targetSlot.id, wt)) continue;
          if (!isTeacherFree(entry.teacherId, targetSlot.id, wt)) continue;
          if (!canPlace(classId, targetSlot.id, wt, entry.timeSlotId)) continue;

          // Boshlang'ich sinf ketma-ket juft dars taqiqi (hard constraint)
          if (isPrimaryConsecutiveViolation({
            schedule,
            classId,
            subjectId: entry.subjectId,
            targetSlotId: targetSlot.id,
            weekType: wt,
            classGrades,
            slotPeriodMap,
            slotDayMap,
            excludeEntryIdx: entryIdx,
          })) continue;

          // Room: try current room first, then candidates
          let newRoomId = entry.roomId;
          if (!isRoomFree(entry.roomId, targetSlot.id, wt)) {
            const candidates = entry.roomCandidates || [];
            const alt = candidates.find(rid => rid !== entry.roomId && isRoomFree(rid, targetSlot.id, wt));
            if (alt !== undefined) {
              newRoomId = alt;
            } else {
              continue;
            }
          }

          const oldSlotId = entry.timeSlotId;
          const oldRoomId = entry.roomId;
          unmarkClassBusy(entry.classId, oldSlotId, wt);
          unmarkTeacherBusy(entry.teacherId, oldSlotId, wt);
          unmarkRoomBusy(oldRoomId, oldSlotId, wt);

          entry.timeSlotId = targetSlot.id;
          entry.roomId = newRoomId;
          markClassBusy(entry.classId, targetSlot.id, wt);
          markTeacherBusy(entry.teacherId, targetSlot.id, wt);
          markRoomBusy(newRoomId, targetSlot.id, wt);

          movedEntryIndices.add(entryIdx);
          moves++;
          improved = true;
          didMove = true;
          break;
        }
      }
    }
  }

  return moves;
}

export function optimizeSanPinComplexity(params: {
  schedule: OptimizerScheduleEntry[];
  activeSlots: OptimizerSlot[];
  slotPeriodMap: Map<number, number>;
  slotDayMap: Map<number, number>;
  subjectCategoryMap: Map<number, SubjectCategory>;
  isClassFree: (classId: number, slotId: number, weekType: WeekType) => boolean;
  isTeacherFree: (teacherId: number, slotId: number, weekType: WeekType) => boolean;
  isRoomFree: (roomId: number, slotId: number, weekType: WeekType) => boolean;
  markClassBusy: (classId: number, slotId: number, weekType: WeekType) => void;
  unmarkClassBusy: (classId: number, slotId: number, weekType: WeekType) => void;
  markTeacherBusy: (teacherId: number, slotId: number, weekType: WeekType) => void;
  unmarkTeacherBusy: (teacherId: number, slotId: number, weekType: WeekType) => void;
  markRoomBusy: (roomId: number, slotId: number, weekType: WeekType) => void;
  unmarkRoomBusy: (roomId: number, slotId: number, weekType: WeekType) => void;
  protectedIndices?: Set<number>;
  classGrades?: Map<number, string>;
  maxIterations?: number;
}): number {
  const {
    schedule, activeSlots, slotPeriodMap, slotDayMap, subjectCategoryMap,
    isClassFree, isTeacherFree, isRoomFree,
    markClassBusy, unmarkClassBusy, markTeacherBusy, unmarkTeacherBusy, markRoomBusy, unmarkRoomBusy,
    protectedIndices,
    classGrades,
    maxIterations = 200,
  } = params;

  // Evaluate penalty score for a lesson placement (lower is better)
  const evalLessonPenalty = (entry: OptimizerScheduleEntry, slotId: number) => {
    const period = slotPeriodMap.get(slotId) || 1;
    const cat = subjectCategoryMap.get(entry.subjectId) || "other";
    let penalty = 0;
    if (cat === "mental") {
      if (period === 1) penalty += 5;
      else if (period >= 5) penalty += 8;
      else penalty += 0; // Periods 2, 3, 4 are ideal
    } else if (cat === "dynamic") {
      if (period >= 2 && period <= 4) penalty += 6;
      else penalty += 0; // Periods 1, 5, 6 are ideal
    }
    return penalty;
  };

  let moves = 0;
  let improved = true;
  let iteration = 0;

  // Group schedule entries by class
  const classEntriesMap = new Map<number, number[]>();
  for (let i = 0; i < schedule.length; i++) {
    const e = schedule[i];
    if (!classEntriesMap.has(e.classId)) classEntriesMap.set(e.classId, []);
    classEntriesMap.get(e.classId)!.push(i);
  }

  while (improved && iteration < maxIterations) {
    improved = false;
    iteration++;

    for (const [classId, indices] of Array.from(classEntriesMap.entries())) {
      for (let a = 0; a < indices.length; a++) {
        const idxA = indices[a];
        if (protectedIndices?.has(idxA)) continue;
        const entryA = schedule[idxA];
        const wtA = (entryA.weekType || "always") as WeekType;
        const slotA = entryA.timeSlotId;
        const currentPenA = evalLessonPenalty(entryA, slotA);

        for (let b = a + 1; b < indices.length; b++) {
          const idxB = indices[b];
          if (protectedIndices?.has(idxB)) continue;
          const entryB = schedule[idxB];
          const wtB = (entryB.weekType || "always") as WeekType;
          const slotB = entryB.timeSlotId;

          if (slotA === slotB) continue;
          if (wtA !== wtB) continue; // Require matching weekType for clean swap

          const currentPenB = evalLessonPenalty(entryB, slotB);
          const currentTotal = currentPenA + currentPenB;

          if (currentTotal === 0) continue; // Already perfect

          const newPenA = evalLessonPenalty(entryA, slotB);
          const newPenB = evalLessonPenalty(entryB, slotA);
          const newTotal = newPenA + newPenB;

          if (newTotal >= currentTotal) continue; // Must strictly improve SanPiN penalty score

          // Temporarily unmark entryA and entryB to check true availability for swap
          unmarkClassBusy(classId, slotA, wtA);
          unmarkTeacherBusy(entryA.teacherId, slotA, wtA);
          unmarkRoomBusy(entryA.roomId, slotA, wtA);

          unmarkClassBusy(classId, slotB, wtB);
          unmarkTeacherBusy(entryB.teacherId, slotB, wtB);
          unmarkRoomBusy(entryB.roomId, slotB, wtB);

          const teacherAFreeAtB = isTeacherFree(entryA.teacherId, slotB, wtA);
          const teacherBFreeAtA = isTeacherFree(entryB.teacherId, slotA, wtB);

          let newRoomBForA: number | null = entryA.roomId;
          let newRoomAForB: number | null = entryB.roomId;

          if (teacherAFreeAtB && teacherBFreeAtA) {
            if (!isRoomFree(entryA.roomId, slotB, wtA)) {
              const candidates = entryA.roomCandidates || [];
              const alt = candidates.find(rid => isRoomFree(rid, slotB, wtA));
              if (alt !== undefined) newRoomBForA = alt;
              else newRoomBForA = null;
            }

            if (!isRoomFree(entryB.roomId, slotA, wtB)) {
              const candidates = entryB.roomCandidates || [];
              const alt = candidates.find(rid => isRoomFree(rid, slotA, wtB));
              if (alt !== undefined) newRoomAForB = alt;
              else newRoomAForB = null;
            }
          }

          if (!teacherAFreeAtB || !teacherBFreeAtA || newRoomBForA === null || newRoomAForB === null) {
            // Restore marks and skip
            markClassBusy(classId, slotA, wtA);
            markTeacherBusy(entryA.teacherId, slotA, wtA);
            markRoomBusy(entryA.roomId, slotA, wtA);

            markClassBusy(classId, slotB, wtB);
            markTeacherBusy(entryB.teacherId, slotB, wtB);
            markRoomBusy(entryB.roomId, slotB, wtB);
            continue;
          }

          // Check primary double-period violation for both moves
          if (
            isPrimaryConsecutiveViolation({ schedule, classId, subjectId: entryA.subjectId, targetSlotId: slotB, weekType: wtA, classGrades, slotPeriodMap, slotDayMap, excludeEntryIdx: idxA }) ||
            isPrimaryConsecutiveViolation({ schedule, classId, subjectId: entryB.subjectId, targetSlotId: slotA, weekType: wtB, classGrades, slotPeriodMap, slotDayMap, excludeEntryIdx: idxB })
          ) {
            markClassBusy(classId, slotA, wtA);
            markTeacherBusy(entryA.teacherId, slotA, wtA);
            markRoomBusy(entryA.roomId, slotA, wtA);

            markClassBusy(classId, slotB, wtB);
            markTeacherBusy(entryB.teacherId, slotB, wtB);
            markRoomBusy(entryB.roomId, slotB, wtB);
            continue;
          }

          // Perform swap

          entryA.timeSlotId = slotB;
          entryA.roomId = newRoomBForA;
          markClassBusy(classId, slotB, wtA);
          markTeacherBusy(entryA.teacherId, slotB, wtA);
          markRoomBusy(newRoomBForA, slotB, wtA);

          entryB.timeSlotId = slotA;
          entryB.roomId = newRoomAForB;
          markClassBusy(classId, slotA, wtB);
          markTeacherBusy(entryB.teacherId, slotA, wtB);
          markRoomBusy(newRoomAForB, slotA, wtB);

          moves++;
          improved = true;
          break;
        }
        if (improved) break;
      }
    }
  }

  return moves;
}

