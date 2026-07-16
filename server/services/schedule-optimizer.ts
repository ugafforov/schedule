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

import { getMaxHoursPerDay } from "../../shared/constants";

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
  maxAttempts?: number;
}): RelocationPlan[] {
  const {
    skippedLessons, placedLessons, activeSlots,
    isClassFree, isTeacherFree, isRoomFree,
    markClassBusy, unmarkClassBusy, markTeacherBusy, unmarkTeacherBusy, markRoomBusy, unmarkRoomBusy,
    canPlaceClassOnDay,
    maxAttempts = 200,
  } = params;
  const canPlace: CanPlaceClassOnDay = canPlaceClassOnDay ?? (() => true);

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
      // SanPiN: shu kunda sinfning dars soati limiti to'lgan bo'lsa, bu slotga qo'ymaymiz
      if (!canPlace(skipped.classId, slot.id, skipped.weekType)) continue;

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
          if (!canPlace(roomBlocker.classId, newSlot.id, roomBlocker.weekType, slot.id)) continue;

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
  schedule: Array<{ classId: number; teacherId: number; roomId: number; timeSlotId: number; weekType?: string | null; isActive?: boolean | null; roomCandidates?: number[] }>;
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
  maxIterations?: number;
}): number {
  const {
    schedule, activeSlots, slotPeriodMap, slotDayMap,
    isClassFree, isTeacherFree, isRoomFree,
    markClassBusy, unmarkClassBusy, markTeacherBusy, unmarkTeacherBusy, markRoomBusy, unmarkRoomBusy,
    protectedIndices,
    canPlaceClassOnDay,
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
  schedule: Array<{ classId: number; teacherId: number; roomId: number; timeSlotId: number; weekType?: string | null; roomCandidates?: number[] }>;
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
  maxIterations?: number;
}): number {
  const {
    schedule, activeSlots, slotPeriodMap, slotDayMap,
    isClassFree, isTeacherFree, isRoomFree,
    markClassBusy, unmarkClassBusy, markTeacherBusy, unmarkTeacherBusy, markRoomBusy, unmarkRoomBusy,
    protectedIndices,
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
        if (!isTeacherFree(entry.teacherId, gapSlotId, wt)) continue;

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
  schedule: Array<{ classId: number; teacherId: number; roomId: number; timeSlotId: number; weekType?: string | null; roomCandidates?: number[] }>;
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

      // Only balance if imbalance is meaningful (heavy > targetHigh AND light < targetLow)
      if (heaviestDay === lightestDay) continue;
      if (heaviestCount - lightestCount <= 1) continue;
      if (heaviestCount <= targetHigh && lightestCount >= targetLow) continue;

      // Try to move the LAST lesson from heaviest day to first available slot on lightest day
      const heavyIndices = dayEntries.get(heaviestDay) || [];
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
