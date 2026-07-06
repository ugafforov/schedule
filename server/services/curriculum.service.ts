import { storage } from "../storage/index";

export { getSpecialty } from "@shared/curriculum";

export interface AutoAssignResult {
  assignments: Array<{ subjectId: number; teacherId: null; weeklyHours: number }>;
  matchedNames: string[];
  missingNames: string[];
}

// Faol curriculum_plan'dan berilgan sinf uchun fan yozuvlarini o'qiydi.
// DTS yangilanganda faqat DB'dagi plan o'zgaradi — bu funksiya va uni chaqiruvchilar
// kod o'zgarishisiz yangi qoidalarga moslashadi.
async function getEntriesForGrade(grade: number, language: string) {
  const lang = language === "ru" ? "ru" : "uz";
  const plan = await storage.getActiveCurriculumPlan(lang);
  if (!plan) return [];
  const entries = await storage.getCurriculumEntries(plan.id);
  return entries.filter((e) => e.grade === grade);
}

// Sinf uchun DTS bo'yicha fan -> haftalik soat xaritasi (autoGenerateTeachers uchun).
export async function getCurriculumForGrade(
  grade: number,
  language: string = "uz"
): Promise<Record<string, number>> {
  const entries = await getEntriesForGrade(grade, language);
  const result: Record<string, number> = {};
  for (const e of entries) {
    result[e.subjectName] = e.weeklyHours;
  }
  return result;
}

// Mavjud DB subjectlarini DTS fan kodi/kalit so'zi bo'yicha moslashtiradi
// (autoAssignDtsForClasses uchun) — yangi subject yaratmaydi, topilmaganlarni
// missingNames'da qaytaradi.
export async function getAutoAssignments(
  grade: number,
  dbSubjects: Array<{ id: number; name: string; code: string }>,
  language: string = "uz"
): Promise<AutoAssignResult> {
  const entries = await getEntriesForGrade(grade, language);
  const assignments: AutoAssignResult["assignments"] = [];
  const matchedNames: string[] = [];
  const missingNames: string[] = [];
  const usedSubjectIds = new Set<number>();

  for (const entry of entries) {
    const hours = entry.weeklyHours;
    let found: (typeof dbSubjects)[number] | undefined;

    // 1. Aniq kod bo'yicha moslik (ustuvorlik tartibida)
    for (const code of entry.codes) {
      found = dbSubjects.find((s) => s.code === code && !usedSubjectIds.has(s.id));
      if (found) break;
    }

    // 2. Kalit so'z bo'yicha moslik (nom ichida qidirish, katta-kichik harf farqisiz)
    if (!found) {
      for (const kw of entry.keywords) {
        found = dbSubjects.find(
          (s) => !usedSubjectIds.has(s.id) && s.name.toLowerCase().includes(kw.toLowerCase())
        );
        if (found) break;
      }
    }

    if (found) {
      usedSubjectIds.add(found.id);
      assignments.push({ subjectId: found.id, teacherId: null, weeklyHours: hours });
      matchedNames.push(`${found.name} (${hours} soat)`);
    } else {
      missingNames.push(`${entry.subjectName} — ${hours} soat`);
    }
  }

  return { assignments, matchedNames, missingNames };
}
