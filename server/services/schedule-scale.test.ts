/**
 * MIQYOS KAFOLATI — algoritm katta maktabda ham yaroqli jadval berishi shart.
 *
 * Kichik fixture'lar (2 sinf) miqyoslashni ko'rsatmaydi: 44 sinfli maktabda ilgari
 * jadvalda qat'iy to'qnashuvlar qolib ketardi, hill-climb esa budjet ichida lokal
 * optimumga umuman yetmasdi. Bu test shu regressiyani ushlab turadi.
 *
 * To'liq benchmark (11 / 22 / 44 sinf, default budjet bilan) qo'lda ishga tushiriladi —
 * bu yerda CI tez qolishi uchun 22 sinf va qisqa budjet olingan.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../db", () => ({ db: {} }));
vi.mock("../storage/index", () => ({
  storage: {
    getTimeSlots: vi.fn(), createTimeSlot: vi.fn(), getClasses: vi.fn(), getRooms: vi.fn(),
    getAllClassSubjects: vi.fn(), getSubjects: vi.fn(), getAllTeacherUnavailability: vi.fn(),
    getTeachers: vi.fn(), getJointLessons: vi.fn(), getScheduleEntries: vi.fn(), getSetting: vi.fn(),
    createScheduleEntriesBulk: vi.fn(), createConflict: vi.fn(), clearScheduleForClass: vi.fn(),
    deleteAllScheduleEntries: vi.fn(), clearConflicts: vi.fn(),
  },
}));

import { storage } from "../storage/index";
import { generateSchedule, resolveTimeBudgetMs, computeQualityScore } from "./schedule.service";
import { buildSyntheticSchool } from "./__fixtures__/synthetic-school";

function mount(school: ReturnType<typeof buildSyntheticSchool>) {
  (storage.getTimeSlots as any).mockResolvedValue(school.timeSlots);
  (storage.getClasses as any).mockResolvedValue(school.classes);
  (storage.getRooms as any).mockResolvedValue(school.rooms);
  (storage.getAllClassSubjects as any).mockResolvedValue(school.classSubjects);
  (storage.getSubjects as any).mockResolvedValue(school.subjects);
  (storage.getAllTeacherUnavailability as any).mockResolvedValue([]);
  (storage.getTeachers as any).mockResolvedValue(school.teachers);
  (storage.getJointLessons as any).mockResolvedValue([]);
  (storage.getScheduleEntries as any).mockResolvedValue([]);
  (storage.getSetting as any).mockResolvedValue(null);
  (storage.createScheduleEntriesBulk as any).mockImplementation(async (e: any[]) => e.map((x, i) => ({ ...x, id: i + 1 })));
  (storage.createConflict as any).mockResolvedValue({});
}

describe("Vaqt budjeti maktab o'lchamiga moslashadi", () => {
  it("kichik maktabda minimal, kattasida dars soniga proporsional, lekin chegaradan oshmaydi", () => {
    expect(resolveTimeBudgetMs(300)).toBe(25_000);   // kichik maktab — minimal budjet
    expect(resolveTimeBudgetMs(1200)).toBe(60_000);  // 44 sinf — bitta nomzod ~20s
    expect(resolveTimeBudgetMs(50_000)).toBe(120_000); // yuqori chegara
    expect(resolveTimeBudgetMs(1200, 5_000)).toBe(5_000); // aniq berilgan qiymat ustun
  });
});

describe("Sifat balli maktab o'lchamiga bog'liq emas", () => {
  it("bir xil nisbatdagi kamchilikda kichik va katta maktab bir xil ball oladi", () => {
    const small = computeQualityScore({ totalLessons: 300, skipped: 0, hardViolations: 0, classGaps: 3, teacherGaps: 30, complexityViolations: 0, spacingViolations: 0 });
    const large = computeQualityScore({ totalLessons: 1200, skipped: 0, hardViolations: 0, classGaps: 12, teacherGaps: 120, complexityViolations: 0, spacingViolations: 0 });
    expect(small).toBe(large);
    expect(small).toBeGreaterThan(80);
  });

  it("mukammal jadval 100, qat'iy buzilishlar ballni keskin tushiradi", () => {
    expect(computeQualityScore({ totalLessons: 600, skipped: 0, hardViolations: 0, classGaps: 0, teacherGaps: 0, complexityViolations: 0, spacingViolations: 0 })).toBe(100);
    const withHard = computeQualityScore({ totalLessons: 600, skipped: 0, hardViolations: 30, classGaps: 0, teacherGaps: 0, complexityViolations: 0, spacingViolations: 0 });
    expect(withHard).toBeLessThan(80);
  });
});

describe("22 sinfli maktab — yaroqlilik kafolati", () => {
  beforeEach(() => vi.clearAllMocks());

  it("barcha darslar joylashadi, qat'iy to'qnashuv va sinf oynasi bo'lmaydi", async () => {
    const school = buildSyntheticSchool({ parallelsPerGrade: 2 });
    mount(school);

    const result = await generateSchedule({ clearExisting: true, timeBudgetMs: 12_000 });

    // 1. Qoplama — har bir DTS soati jadvalda bo'lishi shart
    expect(result.coverage).toBe(100);
    expect(result.skipped).toHaveLength(0);
    expect(result.count).toBe(school.totalWeeklyHours);

    // 2. Qat'iy shartlar — bir sinf/o'qituvchi/xona bir vaqtda ikki darsda bo'lmaydi
    expect(result.quality.hardViolations).toBe(0);

    // 3. O'quvchi kun o'rtasida bo'sh soatda o'tirmaydi
    expect(result.quality.classGaps).toBe(0);

    // 4. Ball ishonchli oraliqda (0 yoki 100 emas — haqiqiy o'lchov)
    expect(result.quality.score).toBeGreaterThanOrEqual(70);
  }, 120_000);

  it("sinflar o'z xonasida qoladi va bir kunda bir fan takrorlanmaydi", async () => {
    const school = buildSyntheticSchool({ parallelsPerGrade: 2 });
    mount(school);

    await generateSchedule({ clearExisting: true, timeBudgetMs: 12_000 });
    const entries: any[] = (storage.createScheduleEntriesBulk as any).mock.calls[0][0];

    const classById = new Map(school.classes.map((c) => [c.id, c]));
    const subjectById = new Map(school.subjects.map((s) => [s.id, s]));
    const slotById = new Map(school.timeSlots.map((s) => [s.id, s]));

    // Uy xonasi: maxsus xona talab qilmaydigan darslar sinfning o'z xonasida bo'lishi kerak
    const generic = entries.filter((e) => (subjectById.get(e.subjectId) as any).requiredRoomType === "classroom");
    const atHome = generic.filter((e) => e.roomId === (classById.get(e.classId) as any).defaultRoomId);
    expect(atHome.length / generic.length).toBeGreaterThan(0.95);

    // Bir kunda bir fan: 1-4 sinfda 1 marta, yuqori sinfda lab fanlari 2 martagacha
    const perDay = new Map<string, number>();
    for (const e of entries) {
      const slot: any = slotById.get(e.timeSlotId);
      const key = `${e.classId}_${slot.dayOfWeek}_${e.subjectId}`;
      perDay.set(key, (perDay.get(key) ?? 0) + (e.weekType === "always" ? 1 : 0.5));
    }
    let violations = 0;
    for (const [key, load] of perDay) {
      const [classId, , subjectId] = key.split("_").map(Number);
      const grade = Number((classById.get(classId) as any).grade);
      const limit = grade <= 4 ? 1 : ((subjectById.get(subjectId) as any).requiredRoomType === "lab" ? 2 : 1);
      if (load > limit) violations++;
    }
    // 600 darsdan bir nechtasi murosaga borishi mumkin, ammo tizimli takror bo'lmasin
    expect(violations).toBeLessThanOrEqual(5);
  }, 120_000);
});
