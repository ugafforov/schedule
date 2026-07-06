import type { Teacher } from "./schema";
import { isPrimaryTeacherAllowedSubject, parseGrade } from "./constants";
import { getSpecialty } from "./curriculum";

const UNIVERSAL_SUBJECTS = [
  "rus tili", "chet tili", "ingliz tili", "nemis tili", "fransuz tili",
  "musiqa madaniyati", "musiqa", "tasviriy san'at", "jismoniy tarbiya",
  "tarbiya", "chaqiruvga qadar boshlang'ich tayyorgarlik",
];

export function isUniversalSubject(subjectName: string): boolean {
  const lower = subjectName.toLowerCase();
  return UNIVERSAL_SUBJECTS.some(s => lower.includes(s));
}

export function resolveTeacherGradeLevels(teacher: Teacher, language = "uz"): string[] {
  const fromField = ((teacher as any).gradeLevel || "high").split(",").map((s: string) => s.trim());
  const teacherSpecialty = getSpecialty(teacher.specialization || "", "5", language);
  if (teacherSpecialty === "Boshlang'ich sinf o'qituvchisi" && !fromField.includes("primary")) {
    return [...fromField, "primary"];
  }
  return fromField;
}

export function isPrimaryTeacherFromSpecialty(teacher: Teacher, language = "uz"): boolean {
  return getSpecialty(teacher.specialization || "", "5", language) === "Boshlang'ich sinf o'qituvchisi";
}

export interface TeacherMatchContext {
  subjectId: number;
  subjectName: string;
  classGrade: string;
  language?: string;
  weeklyHours: number;
  classId?: number;
}

export interface TeacherMatchInput {
  teacher: Teacher;
  teacherSubjectIds: Set<number> | number[];
  currentHours: number;
  assignedClassIds?: Set<number> | number[];
}

export function scoreTeacherForSubject(
  input: TeacherMatchInput,
  ctx: TeacherMatchContext,
): number {
  const { teacher, currentHours } = input;
  const subjectIds = input.teacherSubjectIds instanceof Set
    ? input.teacherSubjectIds
    : new Set(input.teacherSubjectIds);

  const language = ctx.language || "uz";
  const gradeNum = parseGrade(ctx.classGrade);
  const requiredLevel = gradeNum >= 1 && gradeNum <= 4 ? "primary" : "high";
  const isPrimaryClass = requiredLevel === "primary";
  const isPrimarySubjectAllowed = isPrimaryTeacherAllowedSubject(ctx.subjectName);
  const universal = isUniversalSubject(ctx.subjectName);

  const teacherGradeLevels = resolveTeacherGradeLevels(teacher, language);
  const isPrimaryTeacher = teacherGradeLevels.includes("primary");

  // Primary o'qituvchi faqat bitta sinfda dars bera oladi cheklovi
  if (isPrimaryTeacher && input.assignedClassIds && ctx.classId) {
    const classIds = input.assignedClassIds instanceof Set
      ? input.assignedClassIds
      : new Set(input.assignedClassIds);
    if (classIds.size > 0 && !classIds.has(ctx.classId)) {
      return -1;
    }
  }

  const specialization = (teacher.specialization || "").toLowerCase();
  const teacherSpecialty = getSpecialty(teacher.specialization || "", "5", language);
  const subjectSpecialty = getSpecialty(ctx.subjectName, ctx.classGrade, language);
  const specialtyMatch = !!teacherSpecialty && !!subjectSpecialty && teacherSpecialty === subjectSpecialty;

  const subjectMatch =
    subjectIds.has(ctx.subjectId) ||
    (isPrimaryTeacher && isPrimaryClass && isPrimarySubjectAllowed) ||
    specialtyMatch ||
    (specialization.length > 0 && ctx.subjectName.toLowerCase().includes(specialization));

  if (isPrimaryTeacher && isPrimaryClass && !isPrimarySubjectAllowed) return -1;

  const gradeLevelMatch =
    universal ||
    teacherGradeLevels.includes(requiredLevel) ||
    (isPrimaryClass && specialtyMatch) ||
    (isPrimaryClass && isPrimarySubjectAllowed && specialtyMatch &&
      teacherSpecialty === "Boshlang'ich sinf o'qituvchisi" &&
      subjectSpecialty === "Boshlang'ich sinf o'qituvchisi");

  if (!gradeLevelMatch || !subjectMatch) return -1;

  const maxHours = teacher.maxHoursPerWeek || 30;
  if (currentHours + ctx.weeklyHours > maxHours) return -1;

  let score = 0;
  if (subjectIds.has(ctx.subjectId)) score += 100;
  else if (specialtyMatch) score += 80;
  else if (isPrimaryTeacher && isPrimaryClass && isPrimarySubjectAllowed) score += 70;
  else score += 40;

  if (specialization.includes(ctx.subjectName.toLowerCase())) score += 30;
  score -= currentHours;
  score -= subjectIds.size * 2;

  return score;
}

export function pickBestTeacher(
  teachers: Teacher[],
  teacherSubjectMap: Map<number, Set<number>>,
  teacherLoadMap: Map<number, number>,
  ctx: TeacherMatchContext,
  teacherClassMap?: Map<number, Set<number>>,
): Teacher | null {
  const scored = teachers
    .map(teacher => ({
      teacher,
      score: scoreTeacherForSubject(
        {
          teacher,
          teacherSubjectIds: teacherSubjectMap.get(teacher.id) || new Set(),
          currentHours: teacherLoadMap.get(teacher.id) || 0,
          assignedClassIds: teacherClassMap?.get(teacher.id) || new Set(),
        },
        ctx,
      ),
    }))
    .filter(x => x.score >= 0)
    .sort((a, b) =>
      b.score - a.score ||
      (teacherLoadMap.get(a.teacher.id) || 0) - (teacherLoadMap.get(b.teacher.id) || 0)
    );

  return scored[0]?.teacher ?? null;
}
