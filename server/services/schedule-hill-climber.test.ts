import { describe, it, expect } from "vitest";
import { evaluateSchedulePenalty, PenaltyTracker, hillClimbOptimize, HillClimbContext } from "./schedule-hill-climber";
import { OptimizerScheduleEntry } from "./schedule-optimizer";

// Determinstik PRNG — test har safar bir xil ketma-ketlikni sinaydi.
function prng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const DAYS = [1, 2, 3, 4, 5, 6];
const PERIODS = 7;

function buildContext(opts: { classes: number; lessonsPerClass: number; rooms: number; seed: number }): {
  ctx: HillClimbContext;
  schedule: OptimizerScheduleEntry[];
} {
  const rnd = prng(opts.seed);

  const slots: Array<{ id: number; dayOfWeek: number; periodNumber: number }> = [];
  let slotId = 1;
  for (const d of DAYS) {
    for (let p = 1; p <= PERIODS; p++) slots.push({ id: slotId++, dayOfWeek: d, periodNumber: p });
  }
  const slotMap = new Map(slots.map((s) => [s.id, s]));

  const allRooms = Array.from({ length: opts.rooms }, (_, i) => ({
    id: i + 1, name: `${100 + i}`, roomType: "any", capacity: 30, isActive: true,
  }));

  // "mental" (Matematika) va "dynamic" (Jismoniy tarbiya) — murakkablik jarimasi ishlashi uchun
  const subjectMap = new Map<number, { id: number; name: string }>([
    [1, { id: 1, name: "Matematika" }],
    [2, { id: 2, name: "Jismoniy tarbiya" }],
    [3, { id: 3, name: "Tarix" }],
  ]);

  const classGrades = new Map<number, string>();
  const classStudyDays = new Map<number, number[]>();
  const schedule: OptimizerScheduleEntry[] = [];
  const weekTypes = ["always", "always", "always", "surat", "mahraj"] as const;

  for (let c = 1; c <= opts.classes; c++) {
    classGrades.set(c, String(c));
    classStudyDays.set(c, DAYS);
    for (let k = 0; k < opts.lessonsPerClass; k++) {
      schedule.push({
        classId: c,
        subjectId: 1 + Math.floor(rnd() * 3),
        teacherId: 1 + Math.floor(rnd() * 12),
        roomId: 1 + Math.floor(rnd() * opts.rooms),
        timeSlotId: slots[Math.floor(rnd() * slots.length)].id,
        weekType: weekTypes[Math.floor(rnd() * weekTypes.length)],
        isActive: true,
      } as OptimizerScheduleEntry);
    }
  }

  // Bir nechta o'qituvchi band vaqti — unavailability jarimasi ham qamrab olinsin
  const unavailSet = new Set<string>();
  for (let t = 1; t <= 4; t++) unavailSet.add(`${t}_${1 + Math.floor(rnd() * 6)}_${1 + Math.floor(rnd() * PERIODS)}`);

  const ctx: HillClimbContext = {
    schedule,
    activeSlots: slots,
    slotMap,
    unavailSet,
    protectedIndices: new Set<number>(),
    classGrades,
    classStudyDays,
    subjectMap,
    allRooms,
  };

  return { ctx, schedule };
}

/** Qo'lda yig'ilgan kichik kontekst — aniq bitta qoidani sinash uchun. */
function makeCtx(opts: {
  schedule: OptimizerScheduleEntry[];
  grades?: Array<[number, string]>;
  subjects?: Array<{ id: number; name: string; requiredRoomType?: string }>;
  rooms?: number;
  homeRooms?: Array<[number, number]>;
}): HillClimbContext {
  const slots: Array<{ id: number; dayOfWeek: number; periodNumber: number }> = [];
  let slotId = 1;
  for (const d of DAYS) {
    for (let p = 1; p <= PERIODS; p++) slots.push({ id: slotId++, dayOfWeek: d, periodNumber: p });
  }
  const subjects = opts.subjects ?? [{ id: 1, name: "Tarix" }];
  return {
    schedule: opts.schedule,
    activeSlots: slots,
    slotMap: new Map(slots.map((s) => [s.id, s])),
    unavailSet: new Set<string>(),
    protectedIndices: new Set<number>(),
    classGrades: new Map(opts.grades ?? [[1, "5"]]),
    classStudyDays: new Map([[1, [1, 2, 3, 4, 5]]]),
    subjectMap: new Map(subjects.map((s) => [s.id, s])),
    allRooms: Array.from({ length: opts.rooms ?? 4 }, (_, i) => ({
      id: i + 1, name: `${100 + i}`, roomType: "classroom", capacity: 30, isActive: true,
    })),
    classHomeRooms: opts.homeRooms ? new Map(opts.homeRooms) : undefined,
  };
}

/** slotId: kun 1 dan boshlanadi, har kunda PERIODS ta dars. */
const slotOf = (day: number, period: number) => (day - 1) * PERIODS + period;

function lesson(over: Partial<OptimizerScheduleEntry>): OptimizerScheduleEntry {
  return {
    classId: 1, subjectId: 1, teacherId: 1, roomId: 1,
    timeSlotId: slotOf(1, 1), weekType: "always", isActive: true, ...over,
  } as OptimizerScheduleEntry;
}

describe("Bir kunda bir fan takrorlanishi", () => {
  it("bir kunda ikkinchi marta qo'yilgan fan jarima oladi", () => {
    // Ikkala jadval ham bir xil slotlarni egallaydi — farq faqat fanlarning takrorlanishida,
    // shuning uchun jarima farqi aynan takror hadiga teng bo'ladi.
    const subjects = [{ id: 1, name: "Tarix" }, { id: 2, name: "Geografiya" }];
    const distinct = [lesson({ timeSlotId: slotOf(1, 1) }), lesson({ timeSlotId: slotOf(1, 2), subjectId: 2 })];
    const repeated = [lesson({ timeSlotId: slotOf(1, 1) }), lesson({ timeSlotId: slotOf(1, 2) })];

    const distinctEval = evaluateSchedulePenalty(distinct, makeCtx({ schedule: distinct, subjects }));
    const repeatedEval = evaluateSchedulePenalty(repeated, makeCtx({ schedule: repeated, subjects }));

    // Jarima ierarxiyasi: docs/domain/scheduling-rules.md §3.1
    expect(repeatedEval.totalPenalty - distinctEval.totalPenalty).toBe(3000);
    expect(distinctEval.sameSubjectDays).toBe(0);
    expect(repeatedEval.sameSubjectDays).toBe(1);
  });

  it("surat + mahraj juftligi takror hisoblanmaydi (haftada bir marta o'tadi)", () => {
    const half = [
      lesson({ timeSlotId: slotOf(1, 1), weekType: "surat" }),
      lesson({ timeSlotId: slotOf(1, 2), weekType: "mahraj" }),
    ];
    expect(evaluateSchedulePenalty(half, makeCtx({ schedule: half })).sameSubjectDays).toBe(0);
  });

  it("haftalik soati kunlardan kam fan bir kunga ikki marta qo'yilsa jarima oladi (laboratoriya fani ham)", () => {
    // 2 soatlik fizika 5 kunlik haftaga bemalol sig'adi — ikkala soatni bir kunga
    // qo'yish uchun hech qanday sabab yo'q (11-A da aynan shu xato bo'lgan).
    const labSubjects = [{ id: 1, name: "Fizika", requiredRoomType: "lab" }];
    const pair = [lesson({ timeSlotId: slotOf(1, 1) }), lesson({ timeSlotId: slotOf(1, 2) })];

    for (const grade of ["9", "3"]) {
      const ctx = makeCtx({ schedule: pair, subjects: labSubjects, grades: [[1, grade]] });
      expect(evaluateSchedulePenalty(pair, ctx).sameSubjectDays).toBe(1);
    }
  });

  it("haftalik soati o'quv kunlaridan ko'p fan uchun juft dars jarima olmaydi", () => {
    // 6 soatlik matematika 5 kunlik haftada — bir kun majburan ikkita dars bo'ladi.
    const subjects = [{ id: 1, name: "Matematika" }];
    const six = [
      lesson({ timeSlotId: slotOf(1, 1) }), lesson({ timeSlotId: slotOf(1, 2) }),
      lesson({ timeSlotId: slotOf(2, 1) }), lesson({ timeSlotId: slotOf(3, 1) }),
      lesson({ timeSlotId: slotOf(4, 1) }), lesson({ timeSlotId: slotOf(5, 1) }),
    ];
    const ctx = makeCtx({ schedule: six, subjects, grades: [[1, "9"]] });
    expect(evaluateSchedulePenalty(six, ctx).sameSubjectDays).toBe(0);

    // Uchtasi bir kunga tushsa — chegara (2) buzildi
    const three = [
      lesson({ timeSlotId: slotOf(1, 1) }), lesson({ timeSlotId: slotOf(1, 2) }),
      lesson({ timeSlotId: slotOf(1, 3) }), lesson({ timeSlotId: slotOf(3, 1) }),
      lesson({ timeSlotId: slotOf(4, 1) }), lesson({ timeSlotId: slotOf(5, 1) }),
    ];
    const ctx3 = makeCtx({ schedule: three, subjects, grades: [[1, "9"]] });
    expect(evaluateSchedulePenalty(three, ctx3).sameSubjectDays).toBe(1);
  });

  it("inkremental tracker takror jarimasini to'liq hisob bilan bir xil yuritadi", () => {
    const schedule = [lesson({ timeSlotId: slotOf(1, 1) }), lesson({ timeSlotId: slotOf(2, 1) })];
    const ctx = makeCtx({ schedule });
    const tracker = new PenaltyTracker(schedule, ctx);

    tracker.moveEntry(1, slotOf(1, 2), 2); // ikkalasi ham 1-kunga tushdi
    expect(tracker.total).toBe(evaluateSchedulePenalty(schedule, ctx).totalPenalty);

    tracker.moveEntry(1, slotOf(3, 1), 2); // yana ajratildi
    expect(tracker.total).toBe(evaluateSchedulePenalty(schedule, ctx).totalPenalty);
  });
});

describe("SanPiN kunlik aqliy zo'riqish", () => {
  // "Ona tili"/"Adabiyot"/"Rus tili" — humanitar (dars raqami uchun jarima yo'q),
  // murakkabligi 10, ya'ni og'ir fan. "Tarbiya"/"Sinf soati" — murakkabligi 6, yengil.
  const heavy = [{ id: 1, name: "Ona tili" }, { id: 2, name: "Adabiyot" }, { id: 3, name: "Rus tili" }];
  const light = [{ id: 1, name: "Tarbiya" }, { id: 2, name: "Sinf soati" }, { id: 3, name: "Kelajak soati" }];
  const threeInARow = () => [1, 2, 3].map((p) => lesson({ subjectId: p, timeSlotId: slotOf(1, p) }));

  it("1-sinfda dushanbadagi chegaradan (35 x 0.8 = 28) oshgan zo'riqish jarima oladi", () => {
    const over = threeInARow(); // 10 + 10 + 10 = 30 > 28
    const under = threeInARow(); // 6 + 6 + 6 = 18 < 28

    const overEval = evaluateSchedulePenalty(over, makeCtx({ schedule: over, subjects: heavy, grades: [[1, "1"]] }));
    const underEval = evaluateSchedulePenalty(under, makeCtx({ schedule: under, subjects: light, grades: [[1, "1"]] }));

    expect(overEval.dailyComplexityDays).toBe(1);
    expect(underEval.dailyComplexityDays).toBe(0);
    // Farq: 2 birlik oshiq x 200 + kun oxiridagi og'ir fan 400
    expect(overEval.heavyLastPeriods).toBe(1);
    expect(underEval.heavyLastPeriods).toBe(0);
    expect(overEval.totalPenalty - underEval.totalPenalty).toBe(2 * 200 + 400);
  });

  it("og'ir fan kunning oxirgi darsiga tushsa jarima oladi, o'rtasiga tushsa yo'q", () => {
    const subjects = [{ id: 1, name: "Ona tili" }, { id: 2, name: "Tarix" }]; // 10 (og'ir) va 8
    const heavyLast = [lesson({ subjectId: 2, timeSlotId: slotOf(1, 1) }), lesson({ subjectId: 1, timeSlotId: slotOf(1, 2) })];
    const heavyFirst = [lesson({ subjectId: 1, timeSlotId: slotOf(1, 1) }), lesson({ subjectId: 2, timeSlotId: slotOf(1, 2) })];

    const a = evaluateSchedulePenalty(heavyLast, makeCtx({ schedule: heavyLast, subjects }));
    const b = evaluateSchedulePenalty(heavyFirst, makeCtx({ schedule: heavyFirst, subjects }));

    expect(a.heavyLastPeriods).toBe(1);
    expect(b.heavyLastPeriods).toBe(0);
    expect(a.totalPenalty - b.totalPenalty).toBe(400);
  });
});

describe("SanPiN kunlik dars soni chegarasi", () => {
  const subjects = [1, 2, 3, 4, 5, 6].map((id) => ({ id, name: `Fan ${id}` }));

  it("1-sinfda kuniga 6 dars chegarani (5) buzadi, 5 ta esa yo'q", () => {
    const six = [1, 2, 3, 4, 5, 6].map((p) => lesson({ subjectId: p, timeSlotId: slotOf(1, p) }));
    const five = [1, 2, 3, 4, 5].map((p) => lesson({ subjectId: p, timeSlotId: slotOf(1, p) }))
      .concat(lesson({ subjectId: 6, timeSlotId: slotOf(2, 1) }));

    const over = evaluateSchedulePenalty(six, makeCtx({ schedule: six, subjects, grades: [[1, "1"]] }));
    const ok = evaluateSchedulePenalty(five, makeCtx({ schedule: five, subjects, grades: [[1, "1"]] }));

    expect(over.dailyCapDays).toBe(1);
    expect(ok.dailyCapDays).toBe(0);
    expect(over.totalPenalty - ok.totalPenalty).toBeGreaterThanOrEqual(20_000);
  });

  it("5-sinfda kuniga 6 dars chegarani (7) buzmaydi", () => {
    const six = [1, 2, 3, 4, 5, 6].map((p) => lesson({ subjectId: p, timeSlotId: slotOf(1, p) }));
    expect(evaluateSchedulePenalty(six, makeCtx({ schedule: six, subjects, grades: [[1, "5"]] })).dailyCapDays).toBe(0);
  });
});

describe("Takrorlash oralig'i (spacing)", () => {
  const subjects = [{ id: 1, name: "Tarix" }];

  it("ketma-ket kunlarga tushgan fan jarima oladi, kunora tushgani yo'q", () => {
    const adjacent = [lesson({ timeSlotId: slotOf(1, 1) }), lesson({ timeSlotId: slotOf(2, 1) })];
    const spaced = [lesson({ timeSlotId: slotOf(1, 1) }), lesson({ timeSlotId: slotOf(3, 1) })];

    const a = evaluateSchedulePenalty(adjacent, makeCtx({ schedule: adjacent, subjects }));
    const s = evaluateSchedulePenalty(spaced, makeCtx({ schedule: spaced, subjects }));

    expect(a.adjacentDaySubjects).toBe(1);
    expect(s.adjacentDaySubjects).toBe(0);
    expect(a.totalPenalty - s.totalPenalty).toBe(800);
  });

  it("5 kunlik haftadagi 5 soatlik fan uchun qo'shnilik muqarrar — jarima yo'q", () => {
    const everyDay = [1, 2, 3, 4, 5].map((d) => lesson({ timeSlotId: slotOf(d, 1) }));
    const evalResult = evaluateSchedulePenalty(everyDay, makeCtx({ schedule: everyDay, subjects }));
    expect(evalResult.adjacentDaySubjects).toBe(0);
  });

  it("4 kunga tarqalgan fanda 2 ta qo'shnilik muqarrar, 3-tasi jarima oladi", () => {
    // 1,3,4,5 — minimal joylashuv (2 ta qo'shni juftlik)
    const best = [1, 3, 4, 5].map((d) => lesson({ timeSlotId: slotOf(d, 1) }));
    // 1,2,3,4 — 3 ta qo'shni juftlik, ya'ni bittasi ortiqcha
    const worse = [1, 2, 3, 4].map((d) => lesson({ timeSlotId: slotOf(d, 1) }));

    expect(evaluateSchedulePenalty(best, makeCtx({ schedule: best, subjects })).adjacentDaySubjects).toBe(0);
    expect(evaluateSchedulePenalty(worse, makeCtx({ schedule: worse, subjects })).adjacentDaySubjects).toBe(1);
  });
});

describe("O'qituvchi oynasi", () => {
  it("kun ichidagi bo'sh soat jarima oladi, ketma-ket darslar esa yo'q", () => {
    // Bitta o'qituvchining ikkita darsi ikki xil sinfda, bir kunda.
    const back2back = [lesson({ timeSlotId: slotOf(1, 1) }), lesson({ classId: 2, timeSlotId: slotOf(1, 2) })];
    const withGap = [lesson({ timeSlotId: slotOf(1, 1) }), lesson({ classId: 2, timeSlotId: slotOf(1, 4) })];

    const ctxOf = (schedule: OptimizerScheduleEntry[]) => {
      const c = makeCtx({ schedule, grades: [[1, "5"], [2, "5"]] });
      c.classStudyDays.set(2, [1, 2, 3, 4, 5]);
      return c;
    };
    const a = evaluateSchedulePenalty(back2back, ctxOf(back2back));
    const b = evaluateSchedulePenalty(withGap, ctxOf(withGap));

    expect(a.teacherGaps).toBe(0);
    expect(b.teacherGaps).toBe(2); // 2- va 3-soat bo'sh
  });

  it("inkremental tracker o'qituvchi oynasini to'liq hisob bilan bir xil yuritadi", () => {
    const schedule = [lesson({ timeSlotId: slotOf(1, 1) }), lesson({ classId: 2, timeSlotId: slotOf(1, 2) })];
    const ctx = makeCtx({ schedule, grades: [[1, "5"], [2, "5"]] });
    ctx.classStudyDays.set(2, [1, 2, 3, 4, 5]);
    const tracker = new PenaltyTracker(schedule, ctx);

    tracker.moveEntry(1, slotOf(1, 5), 2); // oyna ochildi
    expect(tracker.total).toBe(evaluateSchedulePenalty(schedule, ctx).totalPenalty);

    tracker.moveEntry(1, slotOf(1, 2), 2); // yana yopildi
    expect(tracker.total).toBe(evaluateSchedulePenalty(schedule, ctx).totalPenalty);
  });
});

describe("Sinfning uy xonasi", () => {
  const week = () => [1, 2, 3, 4, 5].map((d) => lesson({ timeSlotId: slotOf(d, 1), roomId: 3 }));

  it("begona xonadagi dars jarima oladi", () => {
    const schedule = week();
    const ctx = makeCtx({ schedule, homeRooms: [[1, 1]] });
    const evalResult = evaluateSchedulePenalty(schedule, ctx);
    expect(evalResult.awayFromHomeRoom).toBe(5);
    expect(evalResult.totalPenalty).toBe(5 * 1000);
  });

  it("hillClimbOptimize darslarni uy xonasiga qaytaradi", async () => {
    const schedule = week();
    const ctx = makeCtx({ schedule, homeRooms: [[1, 1]] });
    const result = await hillClimbOptimize({ ...ctx, schedule, mode: "greedy", maxIterations: 20 });

    expect(result.homeRoomFixes).toBe(5);
    expect(schedule.every((e) => e.roomId === 1)).toBe(true);
    expect(result.finalPenalty).toBe(0);
    expect(evaluateSchedulePenalty(schedule, ctx).totalPenalty).toBe(0);
  });

  it("fanga biriktirilgan xona (preferredRoomId) sinf uy xonasidan ustun turadi", async () => {
    const schedule = week().map((e) => ({ ...e, preferredRoomId: 4 }));
    const ctx = makeCtx({ schedule, homeRooms: [[1, 1]] });
    const result = await hillClimbOptimize({ ...ctx, schedule, mode: "greedy", maxIterations: 20 });

    expect(result.homeRoomFixes).toBe(5);
    expect(schedule.every((e) => e.roomId === 4)).toBe(true);
  });

  it("uy xonasi band bo'lsa dars o'z joyida qoladi", async () => {
    // 1-xonani boshqa sinf egallagan (1-kun 1-dars)
    const schedule = [lesson({ timeSlotId: slotOf(1, 1), roomId: 3 }), lesson({ classId: 2, timeSlotId: slotOf(1, 1), roomId: 1 })];
    const ctx = makeCtx({ schedule, grades: [[1, "5"], [2, "5"]], homeRooms: [[1, 1]] });
    ctx.classStudyDays.set(2, [1, 2, 3, 4, 5]);

    const tracker = new PenaltyTracker(schedule, ctx);
    expect(tracker.tryMoveHome(0)).toBe(false);
    expect(schedule[0].roomId).toBe(3);
  });
});

describe("findFreeRoom — mos xonalar ro'yxati", () => {
  it("roomCandidates'dan tashqariga chiqmaydi", () => {
    const schedule = [
      lesson({ timeSlotId: slotOf(1, 1), roomId: 1, roomCandidates: [1, 2] }),
      lesson({ classId: 2, timeSlotId: slotOf(2, 1), roomId: 1 }),
      lesson({ classId: 3, timeSlotId: slotOf(2, 1), roomId: 2 }),
    ];
    const ctx = makeCtx({ schedule, grades: [[1, "5"], [2, "5"], [3, "5"]] });
    ctx.classStudyDays.set(2, [1, 2, 3, 4, 5]);
    ctx.classStudyDays.set(3, [1, 2, 3, 4, 5]);
    const tracker = new PenaltyTracker(schedule, ctx);

    // 2-kun 1-darsda 1- va 2-xona band, 3/4-xona bo'sh — lekin ular nomzod emas
    expect(tracker.findFreeRoom(0, slotOf(2, 1))).toBeNull();
    // 3-kunda 1-xona bo'sh
    expect(tracker.findFreeRoom(0, slotOf(3, 1))).toBe(1);
  });
});

describe("PenaltyTracker — inkremental jarima to'liq hisob bilan mos kelishi", () => {
  it("boshlang'ich jarima evaluateSchedulePenalty bilan bir xil", () => {
    const { ctx, schedule } = buildContext({ classes: 6, lessonsPerClass: 30, rooms: 8, seed: 7 });
    const tracker = new PenaltyTracker(schedule, ctx);
    expect(tracker.total).toBe(evaluateSchedulePenalty(schedule, ctx).totalPenalty);
  });

  it("500 ta tasodifiy ko'chirishdan keyin ham to'liq hisob bilan bir xil qoladi", () => {
    const { ctx, schedule } = buildContext({ classes: 6, lessonsPerClass: 30, rooms: 8, seed: 42 });
    const tracker = new PenaltyTracker(schedule, ctx);
    const rnd = prng(99);

    for (let step = 0; step < 500; step++) {
      const idx = Math.floor(rnd() * schedule.length);
      const targetSlot = ctx.activeSlots[Math.floor(rnd() * ctx.activeSlots.length)].id;
      const targetRoom = ctx.allRooms[Math.floor(rnd() * ctx.allRooms.length)].id;

      tracker.moveEntry(idx, targetSlot, targetRoom);

      // Har 25-qadamda to'liq hisob bilan solishtiramiz (har qadamda tekshirish sekin)
      if (step % 25 === 0) {
        expect(tracker.total).toBe(evaluateSchedulePenalty(schedule, ctx).totalPenalty);
      }
    }
    expect(tracker.total).toBe(evaluateSchedulePenalty(schedule, ctx).totalPenalty);
  });

  it("o'quv kunlari cheklangan sinfda ham (dars o'quv kunidan tashqariga tushsa) mos qoladi", () => {
    const { ctx, schedule } = buildContext({ classes: 5, lessonsPerClass: 28, rooms: 7, seed: 21 });
    // Ba'zi sinflar faqat 3 kun o'qiydi — darslar esa 6 kunlik slotlarga tushishi mumkin.
    ctx.classStudyDays.set(1, [1, 2, 3]);
    ctx.classStudyDays.set(3, [2, 4]);

    const tracker = new PenaltyTracker(schedule, ctx);
    expect(tracker.total).toBe(evaluateSchedulePenalty(schedule, ctx).totalPenalty);

    const rnd = prng(1234);
    for (let step = 0; step < 200; step++) {
      const idx = Math.floor(rnd() * schedule.length);
      tracker.moveEntry(
        idx,
        ctx.activeSlots[Math.floor(rnd() * ctx.activeSlots.length)].id,
        ctx.allRooms[Math.floor(rnd() * ctx.allRooms.length)].id,
      );
      if (step % 20 === 0) {
        expect(tracker.total).toBe(evaluateSchedulePenalty(schedule, ctx).totalPenalty);
      }
    }
    expect(tracker.total).toBe(evaluateSchedulePenalty(schedule, ctx).totalPenalty);
  });

  it("ko'chirish va uni orqaga qaytarish jarimani asl qiymatiga tiklaydi", () => {
    const { ctx, schedule } = buildContext({ classes: 4, lessonsPerClass: 25, rooms: 6, seed: 5 });
    const tracker = new PenaltyTracker(schedule, ctx);
    const before = tracker.total;

    const entry = schedule[3];
    const oldSlot = entry.timeSlotId;
    const oldRoom = entry.roomId;
    const otherSlot = ctx.activeSlots.find((s) => s.id !== oldSlot)!.id;

    tracker.moveEntry(3, otherSlot, ctx.allRooms[2].id);
    tracker.moveEntry(3, oldSlot, oldRoom);

    expect(tracker.total).toBe(before);
    expect(entry.timeSlotId).toBe(oldSlot);
    expect(entry.roomId).toBe(oldRoom);
  });

  it("findFreeRoom band bo'lmagan xonani qaytaradi (haqiqiy to'qnashuvsiz)", () => {
    const { ctx, schedule } = buildContext({ classes: 3, lessonsPerClass: 20, rooms: 5, seed: 11 });
    const tracker = new PenaltyTracker(schedule, ctx);

    for (let idx = 0; idx < 20; idx++) {
      const targetSlot = ctx.activeSlots[idx % ctx.activeSlots.length].id;
      const room = tracker.findFreeRoom(idx, targetSlot);
      if (room === null) continue;
      const wt = schedule[idx].weekType || "always";
      const clash = schedule.some((e, i) =>
        i !== idx && e.roomId === room && e.timeSlotId === targetSlot &&
        (wt === "always" || (e.weekType || "always") === "always" || (e.weekType || "always") === wt)
      );
      expect(clash).toBe(false);
    }
  });
});

describe("hillClimbOptimize", () => {
  it("jarimani oshirmaydi va vaqt budjetiga bo'ysunadi", async () => {
    const { ctx, schedule } = buildContext({ classes: 8, lessonsPerClass: 32, rooms: 10, seed: 3 });
    const before = evaluateSchedulePenalty(schedule, ctx).totalPenalty;

    const startedAt = Date.now();
    const result = await hillClimbOptimize({ ...ctx, schedule, mode: "greedy", maxIterations: 300, deadline: startedAt + 3000 });
    const elapsed = Date.now() - startedAt;

    // Budjetdan sezilarli oshib ketmasligi kerak (bitta sinf sikli tugashiga ruxsat)
    expect(elapsed).toBeLessThan(6000);
    expect(result.finalPenalty).toBeLessThanOrEqual(before);
    // Qaytarilgan jarima jadvalning haqiqiy holatiga mos bo'lishi shart
    expect(evaluateSchedulePenalty(schedule, ctx).totalPenalty).toBe(result.finalPenalty);
  });
});
