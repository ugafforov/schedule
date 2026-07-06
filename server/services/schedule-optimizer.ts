// Faza 3.3: chegaralangan "retry-with-relaxation" — asosiy greedy solver (schedule.service.ts)
// joylashtira olmagan (skipped) darslar uchun, allaqachon joylashtirilgan BITTA (oddiy,
// bitta o'qituvchili, birlashtirilmagan) darsni boshqa bo'sh vaqtga ko'chirib, bo'shagan
// joyga skipped darsni qo'yishga harakat qiladi. To'liq constraint-solver emas — faqat
// "o'qituvchi band" turidagi to'siqni hal qiladi (sinf/xona to'siqlari bu bosqichda
// qo'llab-quvvatlanmaydi, chunki ular ko'proq zanjirli ko'chirishni talab qiladi).
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
      if (freeRoomId === undefined) continue;

      if (isTeacherFree(skipped.teacherId, slot.id, skipped.weekType)) {
        // Bu holat normalda yuz bermasligi kerak (aks holda asosiy bosqichda joylashgan bo'lardi)
        continue;
      }

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
    }
  }

  return plans;
}
