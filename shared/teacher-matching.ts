import type { Teacher } from "./schema";
import { isClassHourSubject, isPrimaryTeacherAllowedSubject, parseGrade } from "./constants";
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
  /** Sinf rahbari (classes.classTeacherId) — sinf soati va primary konsolidatsiyada qattiq ustuvor. */
  classTeacherId?: number | null;
  /** Shu sinf fanlarini allaqachon olgan boshlang'ich o'qituvchi (callerda teacherClassMap'dan hisoblanadi). */
  classPrimaryTeacherId?: number | null;
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

  // Sinf soati (Kelajak soati) — sinf rahbari belgilangan bo'lsa, faqat u o'tadi.
  // Yuqori sinf rahbari mutaxassisligidan qat'i nazar oladi (specialty tekshiruvisiz).
  // Bu soat dars yuklamasidan tashqari — maxHoursPerWeek limiti qo'llanmaydi.
  if (isClassHourSubject(ctx.subjectName) && ctx.classTeacherId != null) {
    if (teacher.id !== ctx.classTeacherId) return -1;
    return 1000 - currentHours;
  }

  // Boshlang'ich konsolidatsiya (3271-son nizom): sinfning asosiy fanlari egasi
  // aniqlangan bo'lsa (sinf rahbari yoki sinfga allaqachon kirgan primary o'qituvchi),
  // boshqa hech kim bu fanlarni ololmaydi — qattiq qoida.
  if (isPrimaryClass && isPrimarySubjectAllowed) {
    const owner = ctx.classPrimaryTeacherId ?? null;
    if (owner != null && teacher.id !== owner) return -1;
  }

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
  // Sinf egasi (konsolidatsiya) — mutaxassislardan ham, yuklama jarimasidan ham ustun tursin
  if (
    isPrimaryClass && isPrimarySubjectAllowed &&
    ctx.classPrimaryTeacherId != null && teacher.id === ctx.classPrimaryTeacherId
  ) {
    score += 500;
  }
  score -= currentHours;
  score -= subjectIds.size * 2;

  return score;
}

/**
 * Sinfning asosiy fanlari "egasi"ni aniqlaydi (3271-son nizom konsolidatsiyasi uchun):
 * 1) sinf rahbari boshlang'ich o'qituvchi bo'lsa — u;
 * 2) aks holda sinfga allaqachon fan olgan boshlang'ich o'qituvchi (deterministik: eng kichik id);
 * 3) topilmasa — null (yangi sinf, erkin tanlov).
 * Natija TeacherMatchContext.classPrimaryTeacherId sifatida uzatiladi.
 */
export function findClassPrimaryTeacherId(
  classId: number,
  teachers: Teacher[],
  teacherClassMap: Map<number, Set<number>>,
  language = "uz",
  classTeacherId?: number | null,
): number | null {
  if (classTeacherId != null) {
    const rahbar = teachers.find(t => t.id === classTeacherId);
    if (rahbar && resolveTeacherGradeLevels(rahbar, language).includes("primary")) {
      return classTeacherId;
    }
  }
  const candidates = teachers
    .filter(t =>
      resolveTeacherGradeLevels(t, language).includes("primary") &&
      teacherClassMap.get(t.id)?.has(classId),
    )
    .sort((a, b) => a.id - b.id);
  return candidates[0]?.id ?? null;
}

export function pickBestTeacher(
  teachers: Teacher[],
  teacherSubjectMap: Map<number, Set<number>>,
  teacherLoadMap: Map<number, number>,
  ctx: TeacherMatchContext,
  teacherClassMap?: Map<number, Set<number>>,
): Teacher | null {
  // Konsolidatsiya egasi berilmagan bo'lsa, teacherClassMap'dan o'zi aniqlaydi
  const resolvedCtx: TeacherMatchContext =
    ctx.classPrimaryTeacherId === undefined && teacherClassMap && ctx.classId != null
      ? {
          ...ctx,
          classPrimaryTeacherId: findClassPrimaryTeacherId(
            ctx.classId, teachers, teacherClassMap, ctx.language || "uz", ctx.classTeacherId,
          ),
        }
      : ctx;

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
        resolvedCtx,
      ),
    }))
    .filter(x => x.score >= 0)
    .sort((a, b) =>
      b.score - a.score ||
      (teacherLoadMap.get(a.teacher.id) || 0) - (teacherLoadMap.get(b.teacher.id) || 0)
    );

  return scored[0]?.teacher ?? null;
}
