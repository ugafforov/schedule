import { describe, expect, it } from "vitest";
import type { Teacher } from "./schema";
import {
  isUniversalSubject,
  pickBestTeacher,
  resolveTeacherGradeLevels,
  scoreTeacherForSubject,
  type TeacherMatchContext,
} from "./teacher-matching";

function makeTeacher(overrides: Record<string, unknown> = {}): Teacher {
  return {
    id: 1,
    specialization: "Matematika",
    gradeLevel: "high",
    maxHoursPerWeek: 24,
    ...overrides,
  } as unknown as Teacher;
}

const mathCtx: TeacherMatchContext = {
  subjectId: 10,
  subjectName: "Matematika",
  classGrade: "5",
  weeklyHours: 4,
};

describe("isUniversalSubject", () => {
  it("universal fanlarni taniydi (barcha bosqichlarda o'qitiladi)", () => {
    expect(isUniversalSubject("Ingliz tili")).toBe(true);
    expect(isUniversalSubject("Jismoniy tarbiya")).toBe(true);
    expect(isUniversalSubject("Musiqa madaniyati")).toBe(true);
  });

  it("oddiy fanlar universal emas", () => {
    expect(isUniversalSubject("Matematika")).toBe(false);
    expect(isUniversalSubject("Fizika")).toBe(false);
  });
});

describe("resolveTeacherGradeLevels", () => {
  it("gradeLevel maydonini vergul bo'yicha ajratadi", () => {
    const t = makeTeacher({ gradeLevel: "primary,high" });
    expect(resolveTeacherGradeLevels(t)).toEqual(["primary", "high"]);
  });

  it("bo'sh gradeLevel uchun 'high' default", () => {
    const t = makeTeacher({ gradeLevel: undefined });
    expect(resolveTeacherGradeLevels(t)).toEqual(["high"]);
  });
});

describe("scoreTeacherForSubject", () => {
  it("fanga biriktirilgan o'qituvchi eng yuqori ball oladi", () => {
    const score = scoreTeacherForSubject(
      { teacher: makeTeacher(), teacherSubjectIds: [10], currentHours: 0 },
      mathCtx,
    );
    expect(score).toBeGreaterThanOrEqual(100);
  });

  it("haftalik limit oshsa -1 (mos emas)", () => {
    const score = scoreTeacherForSubject(
      { teacher: makeTeacher({ maxHoursPerWeek: 20 }), teacherSubjectIds: [10], currentHours: 18 },
      mathCtx, // 18 + 4 > 20
    );
    expect(score).toBe(-1);
  });

  it("boshlang'ich o'qituvchi boshlang'ich sinfda taqiqlangan fanga mos emas", () => {
    const score = scoreTeacherForSubject(
      {
        teacher: makeTeacher({ gradeLevel: "primary", specialization: "Boshlang'ich ta'lim" }),
        teacherSubjectIds: [99],
        currentHours: 0,
      },
      { subjectId: 99, subjectName: "Ingliz tili", classGrade: "2", weeklyHours: 2 },
    );
    expect(score).toBe(-1);
  });

  it("boshlang'ich o'qituvchi faqat o'z sinfiga biriktiriladi", () => {
    const teacher = makeTeacher({ gradeLevel: "primary" });
    const input = {
      teacher,
      teacherSubjectIds: [10],
      currentHours: 0,
      assignedClassIds: [55], // allaqachon 55-sinfga biriktirilgan
    };
    const ctxOtherClass = { ...mathCtx, classGrade: "2", classId: 77 };
    expect(scoreTeacherForSubject(input, ctxOtherClass)).toBe(-1);

    const ctxOwnClass = { ...mathCtx, classGrade: "2", classId: 55 };
    expect(scoreTeacherForSubject(input, ctxOwnClass)).toBeGreaterThanOrEqual(0);
  });

  it("yuklama ortgan sari ball kamayadi", () => {
    const base = { teacher: makeTeacher(), teacherSubjectIds: [10] as number[] };
    const fresh = scoreTeacherForSubject({ ...base, currentHours: 0 }, mathCtx);
    const loaded = scoreTeacherForSubject({ ...base, currentHours: 10 }, mathCtx);
    expect(fresh).toBeGreaterThan(loaded);
  });
});

describe("pickBestTeacher", () => {
  it("fanga to'g'ridan-to'g'ri biriktirilgan o'qituvchini tanlaydi", () => {
    const assigned = makeTeacher({ id: 1 });
    const specialtyOnly = makeTeacher({ id: 2 });
    const best = pickBestTeacher(
      [specialtyOnly, assigned],
      new Map([[1, new Set([10])], [2, new Set<number>()]]),
      new Map([[1, 0], [2, 0]]),
      mathCtx,
    );
    expect(best?.id).toBe(1);
  });

  it("hech kim mos kelmasa null qaytaradi", () => {
    const overloaded = makeTeacher({ id: 1, maxHoursPerWeek: 2 });
    const best = pickBestTeacher(
      [overloaded],
      new Map([[1, new Set([10])]]),
      new Map([[1, 2]]),
      mathCtx, // 2 + 4 > 2
    );
    expect(best).toBeNull();
  });
});
