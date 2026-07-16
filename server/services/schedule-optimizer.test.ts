import { describe, it, expect } from "vitest";
import { attemptRelocations, minimizeGaps, compactDays, weekTypesConflict, type MovablePlacedLesson, type SkippedLessonInput } from "./schedule-optimizer";

describe("weekTypesConflict", () => {
  it("'always' har doim ziddiyat hisoblanadi", () => {
    expect(weekTypesConflict("always", "surat")).toBe(true);
    expect(weekTypesConflict("mahraj", "always")).toBe(true);
  });
  it("bir xil turlar ziddiyatli", () => {
    expect(weekTypesConflict("surat", "surat")).toBe(true);
  });
  it("surat va mahraj bir-biriga zid emas", () => {
    expect(weekTypesConflict("surat", "mahraj")).toBe(false);
  });
});

// Oddiy dunyoni simulyatsiya qilish: 2 kun x 2 slot (id 1-4), 1 sinf, 1 xona, 2 o'qituvchi.
// Teacher 1 allaqachon slot 1'da band (class 10 uchun). Skipped dars ham teacher 1'ni talab
// qiladi va faqat slot 1'da sinf/xona bo'sh — demak teacher 1'ning slot 1'dagi darsini
// boshqa bo'sh joyga (slot 3, masalan) ko'chirish orqaligina yechim topiladi.
describe("attemptRelocations", () => {
  const activeSlots = [
    { id: 1, dayOfWeek: 1 },
    { id: 2, dayOfWeek: 1 },
    { id: 3, dayOfWeek: 2 },
    { id: 4, dayOfWeek: 2 },
  ];

  // Haqiqiy chaqiruvchi (schedule.service.ts) kabi — busy Set bitta va mark/unmark
  // callback'lari uni DARHOL mutatsiya qiladi (bu batafsil test qilinadigan aynan shu narsa).
  function buildCheckersAndMutators(busy: Set<string>) {
    return {
      isClassFree: (classId: number, slotId: number) => !busy.has(`class_${classId}_${slotId}`),
      isTeacherFree: (teacherId: number, slotId: number) => !busy.has(`teacher_${teacherId}_${slotId}`),
      isRoomFree: (roomId: number, slotId: number) => !busy.has(`room_${roomId}_${slotId}`),
      markClassBusy: (classId: number, slotId: number) => { busy.add(`class_${classId}_${slotId}`); },
      unmarkClassBusy: (classId: number, slotId: number) => { busy.delete(`class_${classId}_${slotId}`); },
      markTeacherBusy: (teacherId: number, slotId: number) => { busy.add(`teacher_${teacherId}_${slotId}`); },
      unmarkTeacherBusy: (teacherId: number, slotId: number) => { busy.delete(`teacher_${teacherId}_${slotId}`); },
      markRoomBusy: (roomId: number, slotId: number) => { busy.add(`room_${roomId}_${slotId}`); },
      unmarkRoomBusy: (roomId: number, slotId: number) => { busy.delete(`room_${roomId}_${slotId}`); },
    };
  }

  it("teacher-band to'siqni blokerni ko'chirib hal qiladi", () => {
    // Bloker: class 10, teacher 1, room 100 — slot1'da joylashgan.
    // Skipped dars boshqa xonani (200) talab qiladi — demak faqat teacher band bo'lgani to'siq.
    const busy = new Set<string>(["class_10_1", "teacher_1_1", "room_100_1"]);
    const checkers = buildCheckersAndMutators(busy);

    const placedLessons: MovablePlacedLesson[] = [
      { index: 0, classId: 10, teacherId: 1, roomId: 100, timeSlotId: 1, weekType: "always", studyDays: [1, 2] },
    ];

    const skippedLessons: SkippedLessonInput[] = [
      { skippedIndex: 0, classId: 20, teacherId: 1, weekType: "always", studyDays: [1, 2], roomCandidates: [200] },
    ];
    // Skipped lesson uchun sinf 20 faqat slot 1'da bo'sh deb faraz qilamiz
    // (boshqa barcha sloterda sinf 20 band) — shuning uchun faqat slot1 ustida ishlaymiz.
    busy.add("class_20_2");
    busy.add("class_20_3");
    busy.add("class_20_4");

    const plans = attemptRelocations({ skippedLessons, placedLessons, activeSlots, ...checkers });

    expect(plans).toHaveLength(1);
    expect(plans[0]).toMatchObject({
      skippedIndex: 0,
      newSlotId: 1,
      newRoomId: 200,
      movedLessonIndex: 0,
    });
    // Bloker (teacher 1, class 10) slot1'dan tashqari, sinfi/o'qituvchisi/xonasi bo'sh biror joyga ko'chishi kerak
    expect([2, 3, 4]).toContain(plans[0].movedLessonNewSlotId);
  });

  it("bloker uchun hech qanday bo'sh joy topilmasa, reja qaytarilmaydi", () => {
    const busy = new Set<string>([
      "class_10_1", "teacher_1_1", "room_100_1",
      // Bloker (class 10, teacher 1, room 100) boshqa HECH bir slotga ko'cha olmaydi:
      "class_10_2", "teacher_1_3", "room_100_4",
      "class_20_2", "class_20_3", "class_20_4",
    ]);
    const checkers = buildCheckersAndMutators(busy);

    const placedLessons: MovablePlacedLesson[] = [
      { index: 0, classId: 10, teacherId: 1, roomId: 100, timeSlotId: 1, weekType: "always", studyDays: [1, 2] },
    ];
    const skippedLessons: SkippedLessonInput[] = [
      { skippedIndex: 0, classId: 20, teacherId: 1, weekType: "always", studyDays: [1, 2], roomCandidates: [200] },
    ];

    const plans = attemptRelocations({ skippedLessons, placedLessons, activeSlots, ...checkers });
    expect(plans).toHaveLength(0);
  });

  it("bitta blokerni ikkinchi marta qayta ishlatmaydi (bir marta ko'chirilgach band hisoblanadi)", () => {
    const busy = new Set<string>(["teacher_1_1", "class_10_1", "room_100_1", "class_20_2", "class_20_3", "class_20_4", "class_30_2", "class_30_3", "class_30_4"]);
    const checkers = buildCheckersAndMutators(busy);

    const placedLessons: MovablePlacedLesson[] = [
      { index: 0, classId: 10, teacherId: 1, roomId: 100, timeSlotId: 1, weekType: "always", studyDays: [1, 2] },
    ];
    const skippedLessons: SkippedLessonInput[] = [
      { skippedIndex: 0, classId: 20, teacherId: 1, weekType: "always", studyDays: [1, 2], roomCandidates: [200] },
      { skippedIndex: 1, classId: 30, teacherId: 1, weekType: "always", studyDays: [1, 2], roomCandidates: [200] },
    ];

    const plans = attemptRelocations({ skippedLessons, placedLessons, activeSlots, ...checkers });
    // Faqat bitta bloker bor edi — ikkinchi skipped dars uchun boshqa bloker topilmagani sababli faqat 1 ta reja qaytishi kerak
    expect(plans).toHaveLength(1);
  });

  it("REGRESSIYA: bitta chaqiruvda ikkita skipped dars bir xil xona+slotni ikki marta band qilmaydi", () => {
    // Ikkita mustaqil bloker (turli sinf/o'qituvchi/xona), ikkalasi ham faqat slot1'da.
    // Ikkita skipped dars ham FAQAT slot1'da yechilishi mumkin (boshqa barcha sloterda
    // o'qituvchilari band) va ikkalasi ham BIR XIL xonani (200) talab qiladi.
    // Darhol mutatsiya bo'lmasa, ikkalasi ham (slot1, room200) ga reja tuzib, real
    // to'qnashuv yaratardi.
    const busy = new Set<string>([
      "class_10_1", "teacher_1_1", "room_100_1",
      "class_11_1", "teacher_2_1", "room_101_1",
      // teacher1 va teacher2 boshqa barcha sloterda ham band (fon bandligi) —
      // shuning uchun ularning yagona "ko'chirilishi mumkin" nomzodi slot1'dagi bloker bo'ladi.
      "teacher_1_2", "teacher_1_3", "teacher_1_4",
      "teacher_2_2", "teacher_2_3", "teacher_2_4",
    ]);
    const checkers = buildCheckersAndMutators(busy);

    const placedLessons: MovablePlacedLesson[] = [
      { index: 0, classId: 10, teacherId: 1, roomId: 100, timeSlotId: 1, weekType: "always", studyDays: [1, 2] },
      { index: 1, classId: 11, teacherId: 2, roomId: 101, timeSlotId: 1, weekType: "always", studyDays: [1, 2] },
    ];
    const skippedLessons: SkippedLessonInput[] = [
      { skippedIndex: 0, classId: 20, teacherId: 1, weekType: "always", studyDays: [1, 2], roomCandidates: [200] },
      { skippedIndex: 1, classId: 21, teacherId: 2, weekType: "always", studyDays: [1, 2], roomCandidates: [200] },
    ];

    const plans = attemptRelocations({ skippedLessons, placedLessons, activeSlots, ...checkers });

    // Ikkinchi skipped dars uchun endi room200 slot1'da band bo'lib qolgani sababli
    // (birinchisi darhol band qilgani uchun) yechim topilmasligi kerak — bu XATO EMAS,
    // bu XAVFSIZ natija (ikkalasi ham joylashib, to'qnashuv yaratgandan ko'ra yaxshi).
    expect(plans.length).toBeLessThanOrEqual(1);

    // Eng muhimi: qaytgan rejalar orasida (slot, xona) juftligi TAKRORLANMASLIGI kerak.
    const slotRoomPairs = plans.map((p) => `${p.newSlotId}_${p.newRoomId}`);
    expect(new Set(slotRoomPairs).size).toBe(slotRoomPairs.length);
  });

  it("xona-band to'siqni (o'qituvchi bo'sh, lekin mos xona band) blokerni ko'chirib hal qiladi", () => {
    // Bloker: class 10, teacher 1, room 100 — slot1'da joylashgan.
    // Skipped dars uchun teacher 5 butunlay bo'sh, lekin yagona nomzod xona (100) slot1'da band —
    // demak faqat xonani bo'shatish orqaligina yechim topiladi.
    const busy = new Set<string>(["class_10_1", "teacher_1_1", "room_100_1"]);
    const checkers = buildCheckersAndMutators(busy);

    const placedLessons: MovablePlacedLesson[] = [
      { index: 0, classId: 10, teacherId: 1, roomId: 100, timeSlotId: 1, weekType: "always", studyDays: [1, 2] },
    ];

    const skippedLessons: SkippedLessonInput[] = [
      { skippedIndex: 0, classId: 20, teacherId: 5, weekType: "always", studyDays: [1, 2], roomCandidates: [100] },
    ];
    // Skipped dars uchun sinf 20 faqat slot 1'da bo'sh deb faraz qilamiz
    busy.add("class_20_2");
    busy.add("class_20_3");
    busy.add("class_20_4");

    const plans = attemptRelocations({ skippedLessons, placedLessons, activeSlots, ...checkers });

    expect(plans).toHaveLength(1);
    expect(plans[0]).toMatchObject({
      skippedIndex: 0,
      newSlotId: 1,
      newRoomId: 100,
      movedLessonIndex: 0,
    });
    // Bloker (teacher 1, class 10, room 100) slot1'dan tashqari bo'sh biror joyga ko'chishi kerak
    expect([2, 3, 4]).toContain(plans[0].movedLessonNewSlotId);
    // Skipped dars endi slot1'da room100'ni egallagan bo'lishi kerak
    expect(busy.has("room_100_1")).toBe(true);
    expect(busy.has("teacher_5_1")).toBe(true);
    expect(busy.has("class_20_1")).toBe(true);
  });

  it("xona-band to'siq uchun ham hech qanday bo'sh joy topilmasa, reja qaytarilmaydi", () => {
    const busy = new Set<string>([
      "class_10_1", "teacher_1_1", "room_100_1",
      // Bloker (class 10, teacher 1, room 100) boshqa HECH bir slotga ko'cha olmaydi:
      "class_10_2", "teacher_1_3", "room_100_4",
      "class_20_2", "class_20_3", "class_20_4",
    ]);
    const checkers = buildCheckersAndMutators(busy);

    const placedLessons: MovablePlacedLesson[] = [
      { index: 0, classId: 10, teacherId: 1, roomId: 100, timeSlotId: 1, weekType: "always", studyDays: [1, 2] },
    ];
    const skippedLessons: SkippedLessonInput[] = [
      { skippedIndex: 0, classId: 20, teacherId: 5, weekType: "always", studyDays: [1, 2], roomCandidates: [100] },
    ];

    const plans = attemptRelocations({ skippedLessons, placedLessons, activeSlots, ...checkers });
    expect(plans).toHaveLength(0);
  });
});

// Dunyo: 3 kun (dushanba/seshanba/chorshanba) x 5 dars. Bitta sinf (10).
// Slot id = kun*10 + dars (masalan 11 = dushanba 1-dars, 25 = seshanba 5-dars).
describe("minimizeGaps", () => {
  const DAYS = [1, 2, 3];
  const PERIODS = [1, 2, 3, 4, 5];
  const activeSlots = DAYS.flatMap(d => PERIODS.map(p => ({ id: d * 10 + p, dayOfWeek: d })));
  const slotPeriodMap = new Map(activeSlots.map(s => [s.id, s.id % 10]));
  const slotDayMap = new Map(activeSlots.map(s => [s.id, s.dayOfWeek]));

  type Entry = { classId: number; teacherId: number; roomId: number; timeSlotId: number; weekType?: string | null };

  function buildParams(schedule: Entry[], extra: Record<string, unknown> = {}) {
    const busy = new Set<string>();
    for (const e of schedule) {
      busy.add(`class_${e.classId}_${e.timeSlotId}`);
      busy.add(`teacher_${e.teacherId}_${e.timeSlotId}`);
      busy.add(`room_${e.roomId}_${e.timeSlotId}`);
    }
    return {
      schedule,
      activeSlots,
      slotPeriodMap,
      slotDayMap,
      isClassFree: (c: number, s: number) => !busy.has(`class_${c}_${s}`),
      isTeacherFree: (t: number, s: number) => !busy.has(`teacher_${t}_${s}`),
      isRoomFree: (r: number, s: number) => !busy.has(`room_${r}_${s}`),
      markClassBusy: (c: number, s: number) => { busy.add(`class_${c}_${s}`); },
      unmarkClassBusy: (c: number, s: number) => { busy.delete(`class_${c}_${s}`); },
      markTeacherBusy: (t: number, s: number) => { busy.add(`teacher_${t}_${s}`); },
      unmarkTeacherBusy: (t: number, s: number) => { busy.delete(`teacher_${t}_${s}`); },
      markRoomBusy: (r: number, s: number) => { busy.add(`room_${r}_${s}`); },
      unmarkRoomBusy: (r: number, s: number) => { busy.delete(`room_${r}_${s}`); },
      ...extra,
    } as any;
  }

  it("oynani boshqa kunning oxirgi darsi bilan to'ldiradi", () => {
    // Dushanba: 1, 2, [oyna], 4 → oyna 3-darsda. Seshanba: 1, 2, 3 (oxirgisi ko'chiriladi).
    const schedule: Entry[] = [
      { classId: 10, teacherId: 1, roomId: 100, timeSlotId: 11 },
      { classId: 10, teacherId: 2, roomId: 100, timeSlotId: 12 },
      { classId: 10, teacherId: 3, roomId: 100, timeSlotId: 14 },
      { classId: 10, teacherId: 4, roomId: 100, timeSlotId: 21 },
      { classId: 10, teacherId: 5, roomId: 100, timeSlotId: 22 },
      { classId: 10, teacherId: 6, roomId: 100, timeSlotId: 23 },
    ];
    const swaps = minimizeGaps(buildParams(schedule));
    expect(swaps).toBeGreaterThan(0);
    // Seshanba oxirgi darsi (teacher 6) dushanba 3-darsga (slot 13) ko'chdi
    expect(schedule.find(e => e.teacherId === 6)!.timeSlotId).toBe(13);
  });

  it("REGRESSIYA: himoyalangan (sinf soati / joint / split) darsni ko'chirmaydi", () => {
    // Seshanbaning oxirgi darsi (index 5) himoyalangan — u oynaga ko'chirilmasligi kerak
    const schedule: Entry[] = [
      { classId: 10, teacherId: 1, roomId: 100, timeSlotId: 11 },
      { classId: 10, teacherId: 2, roomId: 100, timeSlotId: 12 },
      { classId: 10, teacherId: 3, roomId: 100, timeSlotId: 14 },
      { classId: 10, teacherId: 4, roomId: 100, timeSlotId: 21 },
      { classId: 10, teacherId: 5, roomId: 100, timeSlotId: 22 },
      { classId: 10, teacherId: 6, roomId: 100, timeSlotId: 23 },
    ];
    const swaps = minimizeGaps(buildParams(schedule, { protectedIndices: new Set([5]) }));
    expect(swaps).toBe(0);
    expect(schedule[5].timeSlotId).toBe(23);
  });

  it("REGRESSIYA: SanPiN kunlik limiti oshsa oynaga ko'chirmaydi", () => {
    // Dushanbada allaqachon 5 dars (1,2,3,4 va 6 — 5-darsda oyna) → limit 5 to'lgan
    const schedule: Entry[] = [
      { classId: 10, teacherId: 1, roomId: 100, timeSlotId: 11 },
      { classId: 10, teacherId: 2, roomId: 100, timeSlotId: 12 },
      { classId: 10, teacherId: 3, roomId: 100, timeSlotId: 13 },
      { classId: 10, teacherId: 4, roomId: 100, timeSlotId: 15 },
      { classId: 10, teacherId: 5, roomId: 100, timeSlotId: 21 },
      { classId: 10, teacherId: 6, roomId: 100, timeSlotId: 22 },
      { classId: 10, teacherId: 7, roomId: 100, timeSlotId: 23 },
    ];
    // Dushanbada 4 ta dars bor (11,12,13,15) — bittasi qo'shilsa 5 bo'ladi; limit 4 deb qo'yamiz
    const swaps = minimizeGaps(buildParams(schedule, {
      canPlaceClassOnDay: (_c: number, toSlotId: number) => Math.floor(toSlotId / 10) !== 1,
    }));
    expect(swaps).toBe(0);
    expect(schedule[6].timeSlotId).toBe(23);
  });

  it("REGRESSIYA: 2 darsli kundan dars olib ketib '1 darsli kun' yaratmaydi", () => {
    // Dushanba: 1, 2, [oyna], 4 | Seshanba: atigi 2 dars — manba sifatida ishlatilmasin
    const schedule: Entry[] = [
      { classId: 10, teacherId: 1, roomId: 100, timeSlotId: 11 },
      { classId: 10, teacherId: 2, roomId: 100, timeSlotId: 12 },
      { classId: 10, teacherId: 3, roomId: 100, timeSlotId: 14 },
      { classId: 10, teacherId: 4, roomId: 100, timeSlotId: 21 },
      { classId: 10, teacherId: 5, roomId: 100, timeSlotId: 22 },
    ];
    const swaps = minimizeGaps(buildParams(schedule));
    expect(swaps).toBe(0);
    expect(schedule[4].timeSlotId).toBe(22);
  });
});

describe("compactDays — kun ichidagi oynalar", () => {
  const DAYS = [1, 2];
  const PERIODS = [1, 2, 3, 4, 5, 6, 7];
  const activeSlots = DAYS.flatMap(d => PERIODS.map(p => ({ id: d * 10 + p, dayOfWeek: d })));
  const slotPeriodMap = new Map(activeSlots.map(s => [s.id, s.id % 10]));
  const slotDayMap = new Map(activeSlots.map(s => [s.id, s.dayOfWeek]));

  type Entry = { classId: number; teacherId: number; roomId: number; timeSlotId: number; weekType?: string | null };

  function buildParams(schedule: Entry[], extra: Record<string, unknown> = {}) {
    const busy = new Set<string>();
    for (const e of schedule) {
      busy.add(`class_${e.classId}_${e.timeSlotId}`);
      busy.add(`teacher_${e.teacherId}_${e.timeSlotId}`);
      busy.add(`room_${e.roomId}_${e.timeSlotId}`);
    }
    return {
      schedule, activeSlots, slotPeriodMap, slotDayMap,
      isClassFree: (c: number, s: number) => !busy.has(`class_${c}_${s}`),
      isTeacherFree: (t: number, s: number) => !busy.has(`teacher_${t}_${s}`),
      isRoomFree: (r: number, s: number) => !busy.has(`room_${r}_${s}`),
      markClassBusy: (c: number, s: number) => { busy.add(`class_${c}_${s}`); },
      unmarkClassBusy: (c: number, s: number) => { busy.delete(`class_${c}_${s}`); },
      markTeacherBusy: (t: number, s: number) => { busy.add(`teacher_${t}_${s}`); },
      unmarkTeacherBusy: (t: number, s: number) => { busy.delete(`teacher_${t}_${s}`); },
      markRoomBusy: (r: number, s: number) => { busy.add(`room_${r}_${s}`); },
      unmarkRoomBusy: (r: number, s: number) => { busy.delete(`room_${r}_${s}`); },
      ...extra,
    } as any;
  }

  it("REGRESSIYA: kun ichidagi oynani yopadi (1,2,3,4,_,_,7 → 1,2,3,4,5)", () => {
    const schedule: Entry[] = [
      { classId: 10, teacherId: 1, roomId: 100, timeSlotId: 11 },
      { classId: 10, teacherId: 2, roomId: 100, timeSlotId: 12 },
      { classId: 10, teacherId: 3, roomId: 100, timeSlotId: 13 },
      { classId: 10, teacherId: 4, roomId: 100, timeSlotId: 14 },
      { classId: 10, teacherId: 5, roomId: 100, timeSlotId: 17 }, // 7-dars — oynadan keyin
    ];
    const moves = compactDays(buildParams(schedule));
    expect(moves).toBe(1);
    expect(schedule[4].timeSlotId).toBe(15); // 5-darsga surildi
  });

  it("bir nechta oynani ketma-ket yopadi", () => {
    const schedule: Entry[] = [
      { classId: 10, teacherId: 1, roomId: 100, timeSlotId: 11 },
      { classId: 10, teacherId: 2, roomId: 100, timeSlotId: 12 },
      { classId: 10, teacherId: 3, roomId: 100, timeSlotId: 14 }, // oyna: 3
      { classId: 10, teacherId: 4, roomId: 100, timeSlotId: 16 }, // oyna: 5
      { classId: 10, teacherId: 5, roomId: 100, timeSlotId: 17 },
    ];
    compactDays(buildParams(schedule));
    const periods = schedule.map(e => e.timeSlotId % 10).sort((a, b) => a - b);
    expect(periods).toEqual([1, 2, 3, 4, 5]);
  });

  it("himoyalangan (sinf soati / joint / split) darsni ko'chirmaydi, keyingisini suradi", () => {
    const schedule: Entry[] = [
      { classId: 10, teacherId: 1, roomId: 100, timeSlotId: 11 },
      { classId: 10, teacherId: 2, roomId: 100, timeSlotId: 12 },
      { classId: 10, teacherId: 3, roomId: 100, timeSlotId: 14 }, // himoyalangan, oyna 3-darsda
      { classId: 10, teacherId: 4, roomId: 100, timeSlotId: 15 },
    ];
    const moves = compactDays(buildParams(schedule, { protectedIndices: new Set([2]) }));
    expect(schedule[2].timeSlotId).toBe(14); // joyida qoldi
    expect(moves).toBe(1);
    expect(schedule[3].timeSlotId).toBe(13); // keyingisi oynaga surildi
  });

  it("o'qituvchi band bo'lgan oynaga ko'chirmaydi", () => {
    const schedule: Entry[] = [
      { classId: 10, teacherId: 1, roomId: 100, timeSlotId: 11 },
      { classId: 10, teacherId: 2, roomId: 100, timeSlotId: 12 },
      { classId: 10, teacherId: 3, roomId: 100, timeSlotId: 15 },
      // Boshqa sinf: teacher 3 aynan 3-darsda band (13-slot)
      { classId: 20, teacherId: 3, roomId: 200, timeSlotId: 13 },
    ];
    const moves = compactDays(buildParams(schedule));
    expect(moves).toBe(0);
    expect(schedule[2].timeSlotId).toBe(15);
  });
});
