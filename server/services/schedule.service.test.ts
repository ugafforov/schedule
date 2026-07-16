import { describe, it, expect, vi, beforeEach } from "vitest";

// generateSchedule "../db" (haqiqiy Postgres pool) va "../storage/index"ni import qiladi.
// DATABASE_URL bo'lmasa "../db" import paytida throw qiladi — shuning uchun ikkalasini ham
// mock qilamiz va real DB'ga umuman ulanmaymiz. Bu — Faza 3'da solver o'zgarganda regressiyani
// ushlaydigan "oldin/keyin" baseline testi (Faza 0, guardrail).
vi.mock("../db", () => ({ db: {} }));

vi.mock("../storage/index", () => ({
  storage: {
    getTimeSlots: vi.fn(),
    createTimeSlot: vi.fn(),
    getClasses: vi.fn(),
    getRooms: vi.fn(),
    getAllClassSubjects: vi.fn(),
    getSubjects: vi.fn(),
    getAllTeacherUnavailability: vi.fn(),
    getTeachers: vi.fn(),
    getJointLessons: vi.fn(),
    getScheduleEntries: vi.fn(),
    getSetting: vi.fn(),
    createScheduleEntriesBulk: vi.fn(),
    createConflict: vi.fn(),
    clearScheduleForClass: vi.fn(),
    deleteAllScheduleEntries: vi.fn(),
    clearConflicts: vi.fn(),
  },
}));

import { storage } from "../storage/index";
import { generateSchedule, checkFeasibility } from "./schedule.service";

const DAYS = [1, 2, 3, 4, 5, 6];

function buildTimeSlots() {
  const slots: any[] = [];
  let id = 1;
  for (const day of DAYS) {
    for (let period = 1; period <= 6; period++) {
      slots.push({
        id: id++,
        name: `kun${day}-dars${period}`,
        startTime: "08:00",
        endTime: "08:45",
        dayOfWeek: day,
        periodNumber: period,
        isBreak: false,
        isActive: true,
      });
    }
  }
  return slots;
}

// Kichik fixture: 2 sinf (5-A, 5-B), 2 fan (Matematika 5 soat/hafta, Jismoniy tarbiya 2 soat/hafta),
// bitta matematika o'qituvchisi ikkala sinfda ham (band bo'lish holatini sinash uchun).
function buildFixture() {
  return {
    classes: [
      { id: 1, name: "5-A", grade: "5", language: "uz", studyDays: "1,2,3,4,5,6", totalStudents: 25, isActive: true },
      { id: 2, name: "5-B", grade: "5", language: "uz", studyDays: "1,2,3,4,5,6", totalStudents: 25, isActive: true },
    ],
    rooms: [
      { id: 1, name: "101", capacity: 30, roomType: "any", isActive: true },
      { id: 2, name: "102", capacity: 30, roomType: "any", isActive: true },
      { id: 3, name: "103", capacity: 30, roomType: "any", isActive: true },
    ],
    subjects: [
      { id: 1, name: "Matematika", code: "MATH", requiredRoomType: "any", isActive: true },
      { id: 2, name: "Jismoniy tarbiya", code: "JT", requiredRoomType: "any", isActive: true },
    ],
    classSubjects: [
      { id: 1, classId: 1, subjectId: 1, teacherId: 10, teacherId2: null, weeklyHours: 5 },
      { id: 2, classId: 1, subjectId: 2, teacherId: 20, teacherId2: null, weeklyHours: 2 },
      { id: 3, classId: 2, subjectId: 1, teacherId: 10, teacherId2: null, weeklyHours: 5 },
      { id: 4, classId: 2, subjectId: 2, teacherId: 20, teacherId2: null, weeklyHours: 2 },
    ],
  };
}

describe("generateSchedule — Faza 0 baseline (regressiyani ushlash uchun)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const fixture = buildFixture();
    (storage.getTimeSlots as any).mockResolvedValue(buildTimeSlots());
    (storage.getClasses as any).mockResolvedValue(fixture.classes);
    (storage.getRooms as any).mockResolvedValue(fixture.rooms);
    (storage.getAllClassSubjects as any).mockResolvedValue(fixture.classSubjects);
    (storage.getSubjects as any).mockResolvedValue(fixture.subjects);
    (storage.getAllTeacherUnavailability as any).mockResolvedValue([]);
    (storage.getTeachers as any).mockResolvedValue([]);
    (storage.getJointLessons as any).mockResolvedValue([]);
    (storage.getScheduleEntries as any).mockResolvedValue([]);
    (storage.createScheduleEntriesBulk as any).mockImplementation(async (entries: any[]) =>
      entries.map((e, i) => ({ ...e, id: i + 1 }))
    );
    (storage.createConflict as any).mockResolvedValue({});
  });

  it("2 sinf x (Matematika 5s + Jismoniy tarbiya 2s) — barcha 14 dars 100% joylashadi, konflikt yo'q", async () => {
    const result = await generateSchedule({});

    expect(result.success).toBe(true);
    expect(result.stats.steps).toBe(14); // 2 sinf * (5 + 2) soat
    expect(result.coverage).toBe(100);
    expect(result.skipped).toHaveLength(0);
    expect(result.count).toBe(14);
    expect(result.feasibility).toBeDefined();
    expect(result.feasibility.feasible).toBe(true);
    expect(result.quality).toBeDefined();
    expect(result.quality.score).toBeGreaterThan(0);
    expect(result.quality.hardViolations).toBe(0);
  });

  it("bitta xona bo'lsa ham (band bo'lish ehtimoli yuqori) coverage kamaymaydi — 3 xona yetarli", async () => {
    (storage.getRooms as any).mockResolvedValue([{ id: 1, name: "101", capacity: 30, roomType: "any", isActive: true }]);

    const result = await generateSchedule({});

    // Bitta xonada ikkala sinf bir vaqtda dars o'ta olmaydi, lekin 36 ta bo'sh slot
    // yetarli bo'lgani uchun solver darslarni turli vaqtlarga taqsimlab, baribir 100% joylashtirishi kerak.
    expect(result.coverage).toBe(100);
    expect(result.skipped).toHaveLength(0);
  });

  it("sinflar mavjud bo'lmasa xato tashlaydi", async () => {
    (storage.getClasses as any).mockResolvedValue([]);
    await expect(generateSchedule({})).rejects.toThrow("Sinflar mavjud emas.");
  });

  it("xonalar mavjud bo'lmasa xato tashlaydi", async () => {
    (storage.getRooms as any).mockResolvedValue([]);
    await expect(generateSchedule({})).rejects.toThrow("Xonalar mavjud emas.");
  });
});

describe("generateSchedule — Faza 3.3 local search (retry-with-relaxation)", () => {
  // Ataylab tor fixture: 2 kun (har birida 1 slot), 2 xona, bitta o'qituvchi ikkala sinfda.
  // 5-B ikkala kunda ham o'qiydi (moslashuvchan), 5-A esa FAQAT 1-kunda o'qiydi (qattiq).
  // Sort tartibi (murakkablik kamayish bo'yicha) 5-B/Matematika (complexity 11) ni birinchi
  // qo'yadi — u ikkala kun ham bo'sh bo'lgani uchun greedy uni birinchi topilgan slotga
  // (1-kun) qo'yadi va shu bilan yagona o'qituvchini band qilib, 5-A/Musiqa (complexity 1,
  // faqat 1-kunda o'qishi mumkin) ni band qilib qo'yadi. Local search bo'lmasa 5-A o'tkazib
  // yuboriladi; local search 5-B'ni 2-kunga ko'chirib, 5-A'ga joy ochishi kerak.
  beforeEach(() => {
    vi.clearAllMocks();
    (storage.getTimeSlots as any).mockResolvedValue([
      { id: 1, name: "Dushanba 1-dars", dayOfWeek: 1, periodNumber: 1, isBreak: false, isActive: true },
      { id: 2, name: "Seshanba 1-dars", dayOfWeek: 2, periodNumber: 1, isBreak: false, isActive: true },
    ]);
    (storage.getClasses as any).mockResolvedValue([
      { id: 1, name: "5-A", grade: "5", language: "uz", studyDays: "1", totalStudents: 25, isActive: true },
      { id: 2, name: "5-B", grade: "5", language: "uz", studyDays: "1,2", totalStudents: 25, isActive: true },
    ]);
    (storage.getRooms as any).mockResolvedValue([
      { id: 1, name: "101", capacity: 30, roomType: "any", isActive: true },
      { id: 2, name: "102", capacity: 30, roomType: "any", isActive: true },
    ]);
    (storage.getSubjects as any).mockResolvedValue([
      { id: 1, name: "Matematika", code: "MATH", requiredRoomType: "any", isActive: true },
      { id: 2, name: "Musiqa madaniyati", code: "MUS", requiredRoomType: "any", isActive: true },
    ]);
    (storage.getAllClassSubjects as any).mockResolvedValue([
      { id: 1, classId: 1, subjectId: 2, teacherId: 10, teacherId2: null, weeklyHours: 1 }, // 5-A: Musiqa
      { id: 2, classId: 2, subjectId: 1, teacherId: 10, teacherId2: null, weeklyHours: 1 }, // 5-B: Matematika
    ]);
    (storage.getAllTeacherUnavailability as any).mockResolvedValue([]);
    (storage.getTeachers as any).mockResolvedValue([]);
    (storage.getJointLessons as any).mockResolvedValue([]);
    (storage.getScheduleEntries as any).mockResolvedValue([]);
    (storage.createScheduleEntriesBulk as any).mockImplementation(async (entries: any[]) =>
      entries.map((e, i) => ({ ...e, id: i + 1 }))
    );
    (storage.createConflict as any).mockResolvedValue({});
  });

  it("greedy bosqich 5-A'ni o'tkazib yuboradi, local search uni qayta joylashtiradi", async () => {
    const result = await generateSchedule({});

    expect(result.coverage).toBe(100);
    expect(result.skipped).toHaveLength(0);
    expect(result.count).toBe(2);
  });
});

describe("checkFeasibility — mustaqil pre-check", () => {
  it("sinf sloti yetarli bo'lmasa feasible=false qaytaradi", () => {
    const result = checkFeasibility(
      [{ id: 1, name: "5-A", grade: "5", studyDays: "1" }],
      [{ classId: 1, subjectId: 1, teacherId: 10, weeklyHours: 8 }],
      [{ id: 10, firstName: "Ali", lastName: "Valiyev", maxHoursPerWeek: 30 }],
      [{ id: 1, roomType: "any" }],
      [{ id: 1, name: "Matematika", requiredRoomType: "any" }],
      [],
      6,
    );
    expect(result.feasible).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].type).toBe("class_overflow");
    expect(result.errors[0].entity).toBe("5-A");
  });

  it("o'qituvchi yuklamasi ortiq bo'lsa feasible=false", () => {
    const result = checkFeasibility(
      [{ id: 1, name: "5-A", grade: "5", studyDays: "1,2,3,4,5,6" }],
      [{ classId: 1, subjectId: 1, teacherId: 10, weeklyHours: 10 }],
      [{ id: 10, firstName: "Ali", lastName: "Valiyev", maxHoursPerWeek: 5 }],
      [{ id: 1, roomType: "any" }],
      [{ id: 1, name: "Matematika", requiredRoomType: "any" }],
      [],
      6,
    );
    expect(result.feasible).toBe(false);
    expect(result.errors.some(e => e.type === "teacher_overload")).toBe(true);
    expect(result.errors[0].entity).toContain("Ali");
  });

  it("barcha parametrlar yetarli bo'lsa feasible=true", () => {
    const result = checkFeasibility(
      [{ id: 1, name: "5-A", grade: "5", studyDays: "1,2,3,4,5,6" }],
      [{ classId: 1, subjectId: 1, teacherId: 10, weeklyHours: 5 }],
      [{ id: 10, firstName: "Ali", lastName: "Valiyev", maxHoursPerWeek: 30 }],
      [{ id: 1, roomType: "any" }],
      [{ id: 1, name: "Matematika", requiredRoomType: "any" }],
      [],
      6,
    );
    expect(result.feasible).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("biriktirilmagan fan bo'lsa warning qaytaradi", () => {
    const result = checkFeasibility(
      [{ id: 1, name: "5-A", grade: "5", studyDays: "1,2,3,4,5,6" }],
      [{ classId: 1, subjectId: 1, teacherId: null, weeklyHours: 3 }],
      [],
      [{ id: 1, roomType: "any" }],
      [{ id: 1, name: "Matematika", requiredRoomType: "any" }],
      [],
      6,
    );
    expect(result.feasible).toBe(true);
    expect(result.warnings.some(w => w.type === "unassigned")).toBe(true);
  });
});

describe("generateSchedule — sifat hisoboti va gap penaltisi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (storage.getScheduleEntries as any).mockResolvedValue([]);
    (storage.createScheduleEntriesBulk as any).mockImplementation(async (entries: any[]) =>
      entries.map((e: any, i: number) => ({ ...e, id: i + 1 }))
    );
    (storage.createConflict as any).mockResolvedValue({});
    (storage.getAllTeacherUnavailability as any).mockResolvedValue([]);
    (storage.getTeachers as any).mockResolvedValue([]);
    (storage.getJointLessons as any).mockResolvedValue([]);
  });

  it("quality maydoni to'g'ri tuzilgan va score 0-100 oralig'ida", async () => {
    (storage.getTimeSlots as any).mockResolvedValue(buildTimeSlots());
    const fixture = buildFixture();
    (storage.getClasses as any).mockResolvedValue(fixture.classes);
    (storage.getRooms as any).mockResolvedValue(fixture.rooms);
    (storage.getAllClassSubjects as any).mockResolvedValue(fixture.classSubjects);
    (storage.getSubjects as any).mockResolvedValue(fixture.subjects);

    const result = await generateSchedule({});

    expect(result.quality).toBeDefined();
    expect(result.quality.score).toBeGreaterThanOrEqual(0);
    expect(result.quality.score).toBeLessThanOrEqual(100);
    expect(typeof result.quality.classGaps).toBe("number");
    expect(typeof result.quality.teacherGaps).toBe("number");
    expect(typeof result.quality.spacingViolations).toBe("number");
    expect(typeof result.quality.complexityViolations).toBe("number");
    expect(result.quality.hardViolations).toBe(0);
  });
});

describe("generateSchedule — room constraints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (storage.getTimeSlots as any).mockResolvedValue(buildTimeSlots());
    (storage.getAllTeacherUnavailability as any).mockResolvedValue([]);
    (storage.getTeachers as any).mockResolvedValue([]);
    (storage.getJointLessons as any).mockResolvedValue([]);
    (storage.getScheduleEntries as any).mockResolvedValue([]);
    (storage.createScheduleEntriesBulk as any).mockImplementation(async (entries: any[]) =>
      entries.map((e, i) => ({ ...e, id: i + 1 }))
    );
    (storage.createConflict as any).mockResolvedValue({});
  });

  it("sinfning defaultRoomId'si bo'lsa darslar o'sha xonaga qo'yiladi", async () => {
    const classes = [
      { id: 1, name: "5-A", grade: "5", language: "uz", studyDays: "1,2,3,4,5,6", totalStudents: 25, isActive: true, defaultRoomId: 2 },
    ];
    const rooms = [
      { id: 1, name: "101", capacity: 30, roomType: "any", isActive: true },
      { id: 2, name: "102", capacity: 30, roomType: "any", isActive: true },
    ];
    const subjects = [
      { id: 1, name: "Matematika", code: "MATH", requiredRoomType: "any", isActive: true },
    ];
    const classSubjects = [
      { id: 1, classId: 1, subjectId: 1, teacherId: 10, teacherId2: null, weeklyHours: 2 },
    ];

    (storage.getClasses as any).mockResolvedValue(classes);
    (storage.getRooms as any).mockResolvedValue(rooms);
    (storage.getAllClassSubjects as any).mockResolvedValue(classSubjects);
    (storage.getSubjects as any).mockResolvedValue(subjects);

    const result = await generateSchedule({});
    expect(result.count).toBe(2);
    const mockCalls = (storage.createScheduleEntriesBulk as any).mock.calls;
    const entries = mockCalls[0][0];
    expect(entries.every((e: any) => e.classId === 1 && e.roomId === 2)).toBe(true);
  });

  it("fanning maxsus roomId'si bo'lsa sinf defaultRoomId'sidan ustun turadi", async () => {
    const classes = [
      { id: 1, name: "5-A", grade: "5", language: "uz", studyDays: "1,2,3,4,5,6", totalStudents: 25, isActive: true, defaultRoomId: 2 },
    ];
    const rooms = [
      { id: 1, name: "101", capacity: 30, roomType: "any", isActive: true },
      { id: 2, name: "102", capacity: 30, roomType: "any", isActive: true },
    ];
    const subjects = [
      { id: 1, name: "Matematika", code: "MATH", requiredRoomType: "any", isActive: true },
    ];
    // classSubject has roomId: 1 which overrides class defaultRoomId: 2
    const classSubjects = [
      { id: 1, classId: 1, subjectId: 1, teacherId: 10, teacherId2: null, weeklyHours: 2, roomId: 1 },
    ];

    (storage.getClasses as any).mockResolvedValue(classes);
    (storage.getRooms as any).mockResolvedValue(rooms);
    (storage.getAllClassSubjects as any).mockResolvedValue(classSubjects);
    (storage.getSubjects as any).mockResolvedValue(subjects);

    const result = await generateSchedule({});
    expect(result.count).toBe(2);
    const mockCalls = (storage.createScheduleEntriesBulk as any).mock.calls;
    const entries = mockCalls[0][0];
    expect(entries.every((e: any) => e.classId === 1 && e.roomId === 1)).toBe(true);
  });
});

describe("generateSchedule — Sinf soati pinning (3271-son nizom)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const fixture = buildFixture();
    (storage.getTimeSlots as any).mockResolvedValue(buildTimeSlots());
    (storage.getClasses as any).mockResolvedValue(fixture.classes);
    (storage.getRooms as any).mockResolvedValue(fixture.rooms);
    (storage.getSubjects as any).mockResolvedValue([
      ...fixture.subjects,
      { id: 3, name: "Kelajak soati", code: "KELS", requiredRoomType: "any", isActive: true },
    ]);
    (storage.getAllTeacherUnavailability as any).mockResolvedValue([]);
    (storage.getTeachers as any).mockResolvedValue([]);
    (storage.getJointLessons as any).mockResolvedValue([]);
    (storage.getScheduleEntries as any).mockResolvedValue([]);
    (storage.getSetting as any).mockResolvedValue(undefined); // default: dushanba 1-dars
    (storage.createScheduleEntriesBulk as any).mockImplementation(async (entries: any[]) =>
      entries.map((e, i) => ({ ...e, id: i + 1 }))
    );
    (storage.createConflict as any).mockResolvedValue({});
  });

  function classHourEntries() {
    const mockCalls = (storage.createScheduleEntriesBulk as any).mock.calls;
    const entries = mockCalls[0][0];
    return entries.filter((e: any) => e.subjectId === 3);
  }

  it("Kelajak soati har sinfda default slotga (dushanba 1-dars) tushadi", async () => {
    (storage.getAllClassSubjects as any).mockResolvedValue([
      { id: 1, classId: 1, subjectId: 3, teacherId: 30, teacherId2: null, weeklyHours: 1 },
      { id: 2, classId: 2, subjectId: 3, teacherId: 40, teacherId2: null, weeklyHours: 1 },
      { id: 3, classId: 1, subjectId: 1, teacherId: 10, teacherId2: null, weeklyHours: 5 },
    ]);

    const result = await generateSchedule({});
    expect(result.coverage).toBe(100);

    const slots = buildTimeSlots();
    for (const e of classHourEntries()) {
      const slot = slots.find(s => s.id === e.timeSlotId)!;
      expect(Number(slot.dayOfWeek)).toBe(1);
      expect(Number(slot.periodNumber)).toBe(1);
    }
  });

  it("sozlamadagi boshqa slot (chorshanba 2-dars) hurmat qilinadi", async () => {
    (storage.getSetting as any).mockResolvedValue(JSON.stringify({ dayOfWeek: 3, periodNumber: 2 }));
    (storage.getAllClassSubjects as any).mockResolvedValue([
      { id: 1, classId: 1, subjectId: 3, teacherId: 30, teacherId2: null, weeklyHours: 1 },
    ]);

    await generateSchedule({});
    const slots = buildTimeSlots();
    const [e] = classHourEntries();
    const slot = slots.find(s => s.id === e.timeSlotId)!;
    expect(Number(slot.dayOfWeek)).toBe(3);
    expect(Number(slot.periodNumber)).toBe(2);
  });

  it("bitta rahbar 2 sinfda: biri belgilangan slotda, ikkinchisi fallback + past darajali konflikt", async () => {
    (storage.getAllClassSubjects as any).mockResolvedValue([
      { id: 1, classId: 1, subjectId: 3, teacherId: 30, teacherId2: null, weeklyHours: 1 },
      { id: 2, classId: 2, subjectId: 3, teacherId: 30, teacherId2: null, weeklyHours: 1 },
    ]);

    const result = await generateSchedule({});
    expect(result.coverage).toBe(100); // fallback tufayli baribir joylashadi

    const slots = buildTimeSlots();
    const pinnedCount = classHourEntries().filter((e: any) => {
      const slot = slots.find(s => s.id === e.timeSlotId)!;
      return Number(slot.dayOfWeek) === 1 && Number(slot.periodNumber) === 1;
    }).length;
    expect(pinnedCount).toBe(1);

    const conflictCalls = (storage.createConflict as any).mock.calls.map((c: any[]) => c[0]);
    expect(conflictCalls.some((c: any) => c.conflictType === "class_hour_slot" && c.severity === "low")).toBe(true);
  });
});

describe("generateSchedule — SanPiN kunlik limit (qat'iy shart)", () => {
  const slots = buildTimeSlots();

  function mockBase() {
    vi.clearAllMocks();
    (storage.getTimeSlots as any).mockResolvedValue(slots);
    (storage.getRooms as any).mockResolvedValue([
      { id: 1, name: "101", capacity: 30, roomType: "any", isActive: true },
      { id: 2, name: "102", capacity: 30, roomType: "any", isActive: true },
    ]);
    (storage.getAllTeacherUnavailability as any).mockResolvedValue([]);
    (storage.getTeachers as any).mockResolvedValue([]);
    (storage.getJointLessons as any).mockResolvedValue([]);
    (storage.getScheduleEntries as any).mockResolvedValue([]);
    (storage.getSetting as any).mockResolvedValue(undefined);
    (storage.createScheduleEntriesBulk as any).mockImplementation(async (entries: any[]) =>
      entries.map((e, i) => ({ ...e, id: i + 1 }))
    );
    (storage.createConflict as any).mockResolvedValue({});
  }

  function lessonsPerDay(entries: any[]) {
    const perDay = new Map<number, number>();
    for (const e of entries) {
      const slot = slots.find(s => s.id === e.timeSlotId)!;
      perDay.set(slot.dayOfWeek, (perDay.get(slot.dayOfWeek) || 0) + 1);
    }
    return perDay;
  }

  it("1-sinfda hech bir kunda 5 tadan ko'p dars bo'lmaydi", async () => {
    mockBase();
    // 1-sinf, 5 o'quv kuni, 20 soat — kunlik limit 5, ya'ni aynan 4 soatdan
    (storage.getClasses as any).mockResolvedValue([
      { id: 1, name: "1-A", grade: "1", language: "uz", studyDays: "1,2,3,4,5", totalStudents: 25, isActive: true },
    ]);
    (storage.getSubjects as any).mockResolvedValue([
      { id: 1, name: "Ona tili", code: "ONA", requiredRoomType: "any", isActive: true },
      { id: 2, name: "Matematika", code: "MATH", requiredRoomType: "any", isActive: true },
    ]);
    (storage.getAllClassSubjects as any).mockResolvedValue([
      { id: 1, classId: 1, subjectId: 1, teacherId: 10, teacherId2: null, weeklyHours: 10 },
      { id: 2, classId: 1, subjectId: 2, teacherId: 11, teacherId2: null, weeklyHours: 10 },
    ]);

    await generateSchedule({});
    const entries = (storage.createScheduleEntriesBulk as any).mock.calls[0][0];
    for (const [, count] of lessonsPerDay(entries)) {
      expect(count).toBeLessThanOrEqual(5);
    }
  });

  it("sinf soati kunlik limitdan tashqarida — limit to'lgan kunga ham qo'yiladi", async () => {
    mockBase();
    // 1-sinf: 25 soat oddiy dars (5 kun x 5) — barcha kunlar to'la; ustiga sinf soati
    (storage.getClasses as any).mockResolvedValue([
      { id: 1, name: "1-A", grade: "1", language: "uz", studyDays: "1,2,3,4,5", totalStudents: 25, isActive: true, classTeacherId: 30 },
    ]);
    (storage.getSubjects as any).mockResolvedValue([
      { id: 1, name: "Ona tili", code: "ONA", requiredRoomType: "any", isActive: true },
      { id: 2, name: "Matematika", code: "MATH", requiredRoomType: "any", isActive: true },
      { id: 3, name: "Kelajak soati", code: "KELS", requiredRoomType: "any", isActive: true },
    ]);
    (storage.getAllClassSubjects as any).mockResolvedValue([
      { id: 1, classId: 1, subjectId: 1, teacherId: 10, teacherId2: null, weeklyHours: 13 },
      { id: 2, classId: 1, subjectId: 2, teacherId: 11, teacherId2: null, weeklyHours: 12 },
      { id: 3, classId: 1, subjectId: 3, teacherId: 30, teacherId2: null, weeklyHours: 1 },
    ]);

    const result = await generateSchedule({});
    const entries = (storage.createScheduleEntriesBulk as any).mock.calls[0][0];

    // Sinf soati o'z joyida (dushanba 1-dars), oddiy darslar esa 5/kun limitida
    const classHour = entries.find((e: any) => e.subjectId === 3);
    expect(classHour).toBeDefined();
    const chSlot = slots.find(s => s.id === classHour.timeSlotId)!;
    expect(chSlot.dayOfWeek).toBe(1);
    expect(chSlot.periodNumber).toBe(1);

    const academicPerDay = lessonsPerDay(entries.filter((e: any) => e.subjectId !== 3));
    for (const [, count] of academicPerDay) {
      expect(count).toBeLessThanOrEqual(5);
    }
    expect(result.coverage).toBe(100);
  });
});

describe("generateSchedule — uy xonasi (defaultRoomId) afzallik, qat'iy shart emas", () => {
  it("REGRESSIYA: boshqa sinf uy xonasini egallasa ham sinf soati o'z slotida qoladi", async () => {
    vi.clearAllMocks();
    (storage.getTimeSlots as any).mockResolvedValue(buildTimeSlots());
    // Ikkala sinfning sinf soati ham dushanba 1-darsga mahkamlangan.
    // 2-sinfda uy xonasi yo'q — u erkin xona tanlaydi; 1-sinfning uy xonasi = 1.
    // Ilgari 2-sinf 1-xonani egallab, 1-sinfning mahkamlangan darsi joyini yo'qotardi.
    (storage.getClasses as any).mockResolvedValue([
      { id: 1, name: "1-A", grade: "1", language: "uz", studyDays: "1,2,3,4,5", totalStudents: 25, isActive: true, defaultRoomId: 1, classTeacherId: 30 },
      { id: 2, name: "2-A", grade: "2", language: "uz", studyDays: "1,2,3,4,5", totalStudents: 25, isActive: true, defaultRoomId: null, classTeacherId: 40 },
    ]);
    (storage.getRooms as any).mockResolvedValue([
      { id: 1, name: "101", capacity: 30, roomType: "classroom", isActive: true },
      { id: 2, name: "102", capacity: 30, roomType: "classroom", isActive: true },
    ]);
    (storage.getSubjects as any).mockResolvedValue([
      { id: 3, name: "Kelajak soati", code: "KELS", requiredRoomType: "any", isActive: true },
    ]);
    (storage.getAllClassSubjects as any).mockResolvedValue([
      { id: 1, classId: 1, subjectId: 3, teacherId: 30, teacherId2: null, weeklyHours: 1 },
      { id: 2, classId: 2, subjectId: 3, teacherId: 40, teacherId2: null, weeklyHours: 1 },
    ]);
    (storage.getAllTeacherUnavailability as any).mockResolvedValue([]);
    (storage.getTeachers as any).mockResolvedValue([]);
    (storage.getJointLessons as any).mockResolvedValue([]);
    (storage.getScheduleEntries as any).mockResolvedValue([]);
    (storage.getSetting as any).mockResolvedValue(undefined);
    (storage.createScheduleEntriesBulk as any).mockImplementation(async (entries: any[]) =>
      entries.map((e, i) => ({ ...e, id: i + 1 }))
    );
    (storage.createConflict as any).mockResolvedValue({});

    await generateSchedule({});

    const slots = buildTimeSlots();
    const entries = (storage.createScheduleEntriesBulk as any).mock.calls[0][0];
    // Ikkala sinfning ham sinf soati dushanba 1-darsda
    expect(entries).toHaveLength(2);
    for (const e of entries) {
      const slot = slots.find(s => s.id === e.timeSlotId)!;
      expect(slot.dayOfWeek).toBe(1);
      expect(slot.periodNumber).toBe(1);
    }
    // 1-A o'z uy xonasida (1), 2-A esa boshqa sinfning uy xonasini olmagan (2)
    const oneA = entries.find((e: any) => e.classId === 1)!;
    const twoA = entries.find((e: any) => e.classId === 2)!;
    expect(oneA.roomId).toBe(1);
    expect(twoA.roomId).toBe(2);
  });
});

describe("generateSchedule — xona murosasi (lab sig'imi to'sig'i)", () => {
  it("sig'imi yetmasa ham lab darsi joylashadi va room_capacity konflikti qayd etiladi", async () => {
    vi.clearAllMocks();
    (storage.getTimeSlots as any).mockResolvedValue(buildTimeSlots());
    (storage.getClasses as any).mockResolvedValue([
      { id: 1, name: "7-A", grade: "7", language: "uz", studyDays: "1,2,3,4,5,6", totalStudents: 25, isActive: true },
    ]);
    // Yagona laboratoriya sig'imi 24 < 25 o'quvchi — ilgari Fizika umuman joylashmasdi
    (storage.getRooms as any).mockResolvedValue([
      { id: 1, name: "101", capacity: 30, roomType: "classroom", isActive: true },
      { id: 2, name: "Laboratoriya 401", capacity: 24, roomType: "lab", isActive: true },
    ]);
    (storage.getSubjects as any).mockResolvedValue([
      { id: 1, name: "Fizika", code: "FIZ", requiredRoomType: "lab", isActive: true },
    ]);
    (storage.getAllClassSubjects as any).mockResolvedValue([
      { id: 1, classId: 1, subjectId: 1, teacherId: 10, teacherId2: null, weeklyHours: 2 },
    ]);
    (storage.getAllTeacherUnavailability as any).mockResolvedValue([]);
    (storage.getTeachers as any).mockResolvedValue([]);
    (storage.getJointLessons as any).mockResolvedValue([]);
    (storage.getScheduleEntries as any).mockResolvedValue([]);
    (storage.getSetting as any).mockResolvedValue(undefined);
    (storage.createScheduleEntriesBulk as any).mockImplementation(async (entries: any[]) =>
      entries.map((e, i) => ({ ...e, id: i + 1 }))
    );
    (storage.createConflict as any).mockResolvedValue({});

    const result = await generateSchedule({});

    expect(result.coverage).toBe(100);
    const entries = (storage.createScheduleEntriesBulk as any).mock.calls[0][0];
    expect(entries).toHaveLength(2);
    expect(entries.every((e: any) => e.roomId === 2)).toBe(true); // baribir laboratoriyada

    const conflictCalls = (storage.createConflict as any).mock.calls.map((c: any[]) => c[0]);
    expect(conflictCalls.some((c: any) => c.conflictType === "room_capacity")).toBe(true);
  });

  it("Fizika o'z laboratoriyasiga, Kimyo o'zinikiga tushadi (fanga atalgan xonalar)", async () => {
    vi.clearAllMocks();
    (storage.getTimeSlots as any).mockResolvedValue(buildTimeSlots());
    (storage.getClasses as any).mockResolvedValue([
      { id: 1, name: "7-A", grade: "7", language: "uz", studyDays: "1,2,3,4,5,6", totalStudents: 25, isActive: true },
    ]);
    (storage.getRooms as any).mockResolvedValue([
      { id: 1, name: "101", capacity: 30, roomType: "classroom", isActive: true },
      { id: 2, name: "Fizika laboratoriyasi", capacity: 30, roomType: "lab", isActive: true },
      { id: 3, name: "Kimyo laboratoriyasi", capacity: 30, roomType: "lab", isActive: true },
    ]);
    (storage.getSubjects as any).mockResolvedValue([
      { id: 1, name: "Fizika", code: "FIZ", requiredRoomType: "lab", isActive: true },
      { id: 2, name: "Kimyo", code: "KIM", requiredRoomType: "lab", isActive: true },
    ]);
    (storage.getAllClassSubjects as any).mockResolvedValue([
      { id: 1, classId: 1, subjectId: 1, teacherId: 10, teacherId2: null, weeklyHours: 2 },
      { id: 2, classId: 1, subjectId: 2, teacherId: 11, teacherId2: null, weeklyHours: 2 },
    ]);
    (storage.getAllTeacherUnavailability as any).mockResolvedValue([]);
    (storage.getTeachers as any).mockResolvedValue([]);
    (storage.getJointLessons as any).mockResolvedValue([]);
    (storage.getScheduleEntries as any).mockResolvedValue([]);
    (storage.getSetting as any).mockResolvedValue(undefined);
    (storage.createScheduleEntriesBulk as any).mockImplementation(async (entries: any[]) =>
      entries.map((e, i) => ({ ...e, id: i + 1 }))
    );
    (storage.createConflict as any).mockResolvedValue({});

    const result = await generateSchedule({});
    expect(result.coverage).toBe(100);

    const entries = (storage.createScheduleEntriesBulk as any).mock.calls[0][0];
    const fizika = entries.filter((e: any) => e.subjectId === 1);
    const kimyo = entries.filter((e: any) => e.subjectId === 2);
    expect(fizika).toHaveLength(2);
    expect(kimyo).toHaveLength(2);
    expect(fizika.every((e: any) => e.roomId === 2)).toBe(true); // Fizika laboratoriyasi
    expect(kimyo.every((e: any) => e.roomId === 3)).toBe(true);  // Kimyo laboratoriyasi
  });

  it("talab qilingan turdagi xona umuman bo'lmasa, boshqa xonaga qo'yiladi (room_type)", async () => {
    vi.clearAllMocks();
    (storage.getTimeSlots as any).mockResolvedValue(buildTimeSlots());
    (storage.getClasses as any).mockResolvedValue([
      { id: 1, name: "7-A", grade: "7", language: "uz", studyDays: "1,2,3,4,5,6", totalStudents: 25, isActive: true },
    ]);
    (storage.getRooms as any).mockResolvedValue([
      { id: 1, name: "101", capacity: 30, roomType: "classroom", isActive: true },
    ]);
    (storage.getSubjects as any).mockResolvedValue([
      { id: 1, name: "Kimyo", code: "KIM", requiredRoomType: "lab", isActive: true },
    ]);
    (storage.getAllClassSubjects as any).mockResolvedValue([
      { id: 1, classId: 1, subjectId: 1, teacherId: 10, teacherId2: null, weeklyHours: 2 },
    ]);
    (storage.getAllTeacherUnavailability as any).mockResolvedValue([]);
    (storage.getTeachers as any).mockResolvedValue([]);
    (storage.getJointLessons as any).mockResolvedValue([]);
    (storage.getScheduleEntries as any).mockResolvedValue([]);
    (storage.getSetting as any).mockResolvedValue(undefined);
    (storage.createScheduleEntriesBulk as any).mockImplementation(async (entries: any[]) =>
      entries.map((e, i) => ({ ...e, id: i + 1 }))
    );
    (storage.createConflict as any).mockResolvedValue({});

    const result = await generateSchedule({});

    expect(result.coverage).toBe(100);
    const entries = (storage.createScheduleEntriesBulk as any).mock.calls[0][0];
    expect(entries.every((e: any) => e.roomId === 1)).toBe(true);

    const conflictCalls = (storage.createConflict as any).mock.calls.map((c: any[]) => c[0]);
    expect(conflictCalls.some((c: any) => c.conflictType === "room_type")).toBe(true);
  });
});
