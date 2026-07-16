import { describe, expect, it } from "vitest";
import type { Teacher } from "./schema";
import { isClassHourSubject } from "./constants";
import {
  findClassPrimaryTeacherId,
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

describe("isClassHourSubject", () => {
  it("Sinf soati / Kelajak soati fanlarini taniydi", () => {
    expect(isClassHourSubject("Sinf soati")).toBe(true);
    expect(isClassHourSubject("Kelajak soati")).toBe(true);
  });

  it("Tarbiya — alohida oddiy fan, sinf soati EMAS", () => {
    expect(isClassHourSubject("Tarbiya")).toBe(false);
    expect(isClassHourSubject("Jismoniy tarbiya")).toBe(false);
    expect(isClassHourSubject("Matematika")).toBe(false);
  });
});

describe("sinf soati override (sinf rahbari)", () => {
  const kelajakCtx: TeacherMatchContext = {
    subjectId: 20,
    subjectName: "Kelajak soati",
    classGrade: "8",
    weeklyHours: 1,
    classId: 7,
    classTeacherId: 3,
  };

  it("sinf rahbari mutaxassisligidan qat'i nazar sinf soatini oladi", () => {
    const fizik = makeTeacher({ id: 3, specialization: "Fizika" });
    const score = scoreTeacherForSubject(
      { teacher: fizik, teacherSubjectIds: [], currentHours: 10 },
      kelajakCtx,
    );
    expect(score).toBeGreaterThan(0);
  });

  it("rahbar bo'lmagan o'qituvchi sinf soatini ololmaydi", () => {
    const boshqa = makeTeacher({ id: 5, specialization: "Tarbiya" });
    expect(
      scoreTeacherForSubject({ teacher: boshqa, teacherSubjectIds: [20], currentHours: 0 }, kelajakCtx),
    ).toBe(-1);
  });

  it("sinf soati yuklamadan tashqari — rahbar limiti to'lgan bo'lsa ham oladi", () => {
    const fizik = makeTeacher({ id: 3, maxHoursPerWeek: 10 });
    expect(
      scoreTeacherForSubject({ teacher: fizik, teacherSubjectIds: [], currentHours: 10 }, kelajakCtx),
    ).toBeGreaterThan(0);
  });

  it("rahbar belgilanmagan bo'lsa eski xatti-harakat saqlanadi", () => {
    const tarbiyachi = makeTeacher({ id: 5, specialization: "Tarbiya" });
    const score = scoreTeacherForSubject(
      { teacher: tarbiyachi, teacherSubjectIds: [20], currentHours: 0 },
      { ...kelajakCtx, classTeacherId: undefined, subjectName: "Tarbiya" },
    );
    expect(score).toBeGreaterThanOrEqual(0);
  });

  it("Tarbiya oddiy fan — sinf rahbari bo'lmagan o'qituvchi ham o'ta oladi", () => {
    const tarbiyachi = makeTeacher({ id: 5, specialization: "Tarbiya" });
    const score = scoreTeacherForSubject(
      { teacher: tarbiyachi, teacherSubjectIds: [20], currentHours: 0 },
      { ...kelajakCtx, subjectName: "Tarbiya" },
    );
    expect(score).toBeGreaterThanOrEqual(0);
  });
});

describe("boshlang'ich konsolidatsiya (3271-son nizom)", () => {
  const primary = (id: number) =>
    makeTeacher({ id, gradeLevel: "primary", specialization: "Boshlang'ich ta'lim" });

  const coreCtx = (subjectName: string, extra: Partial<TeacherMatchContext> = {}): TeacherMatchContext => ({
    subjectId: 30,
    subjectName,
    classGrade: "1",
    weeklyHours: 5,
    classId: 100,
    ...extra,
  });

  it("egasi aniqlangan sinfda boshqa primary o'qituvchi -1 oladi", () => {
    const t2 = primary(2);
    expect(
      scoreTeacherForSubject(
        { teacher: t2, teacherSubjectIds: [30], currentHours: 0 },
        coreCtx("Matematika", { classPrimaryTeacherId: 1 }),
      ),
    ).toBe(-1);
  });

  it("egasi yuklamasi ko'p bo'lsa ham fanni oladi (bonus jarimadan ustun)", () => {
    const owner = primary(1);
    const score = scoreTeacherForSubject(
      { teacher: owner, teacherSubjectIds: [30], currentHours: 15, assignedClassIds: [100] },
      coreCtx("Matematika", { classPrimaryTeacherId: 1 }),
    );
    expect(score).toBeGreaterThan(400);
  });

  it("regression: birinchi fan T1 ga tushgach, keyingi fan ham T1 ga boradi", () => {
    const t1 = primary(1);
    const t2 = primary(2);
    const teacherSubjectMap = new Map([[1, new Set([30])], [2, new Set([30])]]);
    const teacherLoadMap = new Map([[1, 0], [2, 0]]);
    const teacherClassMap = new Map<number, Set<number>>();

    // 1-fan: Ona tili — T1 tanlanadi (id kichik, yuklama teng)
    const first = pickBestTeacher([t1, t2], teacherSubjectMap, teacherLoadMap,
      coreCtx("Ona tili"), teacherClassMap);
    expect(first?.id).toBe(1);
    teacherLoadMap.set(1, 10);
    teacherClassMap.set(1, new Set([100]));

    // 2-fan: Matematika — yuklama tenglashiga qaramay T1 (T2 emas!)
    const second = pickBestTeacher([t1, t2], teacherSubjectMap, teacherLoadMap,
      coreCtx("Matematika"), teacherClassMap);
    expect(second?.id).toBe(1);

    // Boshqa sinf (101) uchun esa T2 tanlanadi
    const otherClass = pickBestTeacher([t1, t2], teacherSubjectMap, teacherLoadMap,
      coreCtx("Ona tili", { classId: 101 }), teacherClassMap);
    expect(otherClass?.id).toBe(2);
  });

  it("egasi limitdan oshsa fan biriktirilmaydi (boshqa primaryga berilmaydi)", () => {
    const t1 = primary(1);
    const t2 = primary(2);
    const best = pickBestTeacher(
      [t1, t2],
      new Map([[1, new Set([30])], [2, new Set([30])]]),
      new Map([[1, 22], [2, 0]]), // 22 + 5 > 24
      coreCtx("Matematika", { classPrimaryTeacherId: 1 }),
      new Map([[1, new Set([100])]]),
    );
    expect(best).toBeNull();
  });
});

describe("findClassPrimaryTeacherId", () => {
  const primary = (id: number) =>
    makeTeacher({ id, gradeLevel: "primary", specialization: "Boshlang'ich ta'lim" });

  it("primary sinf rahbari ustuvor", () => {
    const teachers = [primary(1), primary(2)];
    const map = new Map([[1, new Set([100])]]);
    expect(findClassPrimaryTeacherId(100, teachers, map, "uz", 2)).toBe(2);
  });

  it("rahbar primary bo'lmasa e'tiborga olinmaydi, sinfga kirgan primary qaytadi", () => {
    const fizik = makeTeacher({ id: 9, specialization: "Fizika" });
    const teachers = [fizik, primary(1)];
    const map = new Map([[1, new Set([100])]]);
    expect(findClassPrimaryTeacherId(100, teachers, map, "uz", 9)).toBe(1);
  });

  it("hech kim topilmasa null", () => {
    expect(findClassPrimaryTeacherId(100, [primary(1)], new Map())).toBeNull();
  });
});
