// O'zbekiston Respublikasi Maktabgacha va Maktab Ta'limi vazirligining
// 10.04.2025 yildagi 121-sonli buyrug'i bilan tasdiqlangan
// 2025-2026 o'quv yili Tayanch O'quv Rejasi (DTS)

export interface DtsCurriculumEntry {
  name: string;
  codes: string[];
  keywords: string[];
  hours: Record<number, number>; // grade -> weeklyHours
}

export const DTS_CURRICULUM_2025: DtsCurriculumEntry[] = [
  // ─── Boshlang'ich ta'lim (1–4-sinf) ────────────────────────────────────────
  {
    name: "Ona tili va o'qish savodxonligi",
    codes: ["ONA4"],
    keywords: ["ona tili", "o'qish savodxonligi", "savodxonlik"],
    hours: { 1: 8, 2: 7, 3: 6, 4: 5 },
  },
  {
    name: "Matematika",
    codes: ["MATH4"],
    keywords: ["matematika"],
    hours: { 1: 4, 2: 4, 3: 4, 4: 4 },
  },
  {
    name: "Atrofimizdagi olam",
    codes: ["ATRO"],
    keywords: ["atrofimizdagi", "tabiatshunoslik", "tabiat"],
    hours: { 1: 1, 2: 1, 3: 2, 4: 2 },
  },
  {
    name: "Xorijiy til",
    codes: ["XORT4"],
    keywords: ["xorijiy til", "chet tili", "ingliz tili"],
    hours: { 1: 1, 2: 2, 3: 2, 4: 3 },
  },
  {
    name: "Informatika va axborot texnologiyalari",
    codes: ["INF4"],
    keywords: ["informatika"],
    hours: { 1: 1, 2: 1, 3: 1, 4: 1 },
  },
  {
    name: "Musiqa",
    codes: ["MUS"],
    keywords: ["musiqa"],
    hours: { 1: 1, 2: 1, 3: 1, 4: 1 },
  },
  {
    name: "Tasviriy san'at",
    codes: ["TASV"],
    keywords: ["tasviriy"],
    hours: { 1: 1, 2: 1, 3: 1, 4: 1 },
  },
  {
    name: "Texnologiya (Mehnat)",
    codes: ["TECH4"],
    keywords: ["texnologiya", "mehnat"],
    hours: { 1: 1, 2: 1, 3: 1, 4: 1 },
  },
  {
    name: "Jismoniy tarbiya",
    codes: ["JT4"],
    keywords: ["jismoniy tarbiya"],
    hours: { 1: 3, 2: 3, 3: 3, 4: 3 },
  },

  // ─── Asosiy ta'lim (5–9-sinf) ───────────────────────────────────────────────
  {
    name: "Ona tili va adabiyoti",
    codes: ["ONA9"],
    keywords: ["ona tili va adabiyoti", "ona tili", "adabiyot"],
    hours: { 5: 5, 6: 4, 7: 4, 8: 4, 9: 4 },
  },
  {
    name: "Chet tili (Ingliz tili)",
    codes: ["ING", "XORT4"],
    keywords: ["ingliz tili", "chet tili", "xorijiy til"],
    hours: { 5: 3, 6: 3, 7: 4, 8: 3, 9: 3 },
  },
  {
    name: "Algebra",
    codes: ["ALG"],
    keywords: ["algebra", "matematika"],
    hours: { 5: 3, 6: 3, 7: 3, 8: 3, 9: 3 },
  },
  {
    name: "Geometriya",
    codes: ["GEOM"],
    keywords: ["geometriya"],
    hours: { 5: 2, 6: 2, 7: 2, 8: 2, 9: 2 },
  },
  {
    name: "Tarix (Jahon tarixi)",
    codes: ["JTAR"],
    keywords: ["jahon tarixi", "tarix"],
    hours: { 5: 2, 6: 2, 7: 2, 8: 2, 9: 2 },
  },
  {
    name: "O'zbekiston tarixi",
    codes: ["UZBT"],
    keywords: ["o'zbekiston tarixi"],
    hours: { 8: 2, 9: 2 },
  },
  {
    name: "Geografiya",
    codes: ["GEOG"],
    keywords: ["geografiya"],
    hours: { 6: 2, 7: 2, 8: 2, 9: 2 },
  },
  {
    name: "Tabiiy fanlar (Science)",
    codes: ["ATRO"],
    keywords: ["tabiiy fanlar", "science"],
    hours: { 5: 3, 6: 3 },
  },
  {
    name: "Biologiya",
    codes: ["BIO"],
    keywords: ["biologiya"],
    hours: { 7: 2, 8: 2, 9: 2 },
  },
  {
    name: "Fizika",
    codes: ["FIZ"],
    keywords: ["fizika"],
    hours: { 7: 2, 8: 3, 9: 3 },
  },
  {
    name: "Kimyo",
    codes: ["KIM"],
    keywords: ["kimyo"],
    hours: { 8: 2, 9: 2 },
  },
  {
    name: "Informatika va AT",
    codes: ["INF9", "INF4"],
    keywords: ["informatika"],
    hours: { 5: 1, 6: 1, 7: 1, 8: 1, 9: 1 },
  },
  {
    name: "Huquq asoslari (Konstitutsiya)",
    codes: ["HUQ"],
    keywords: ["huquq", "konstitutsiya"],
    hours: { 7: 1, 9: 1 },
  },
  {
    name: "Tasviriy san'at",
    codes: ["TASV9", "TASV"],
    keywords: ["tasviriy"],
    hours: { 5: 1, 6: 1 },
  },
  {
    name: "Musiqa",
    codes: ["MUS9", "MUS"],
    keywords: ["musiqa"],
    hours: { 5: 1, 6: 1 },
  },
  {
    name: "Texnologiya",
    codes: ["TECH9", "TECH4"],
    keywords: ["texnologiya", "mehnat"],
    hours: { 5: 1, 6: 1, 7: 2, 8: 2, 9: 1 },
  },
  {
    name: "Chizmachilik",
    codes: [],
    keywords: ["chizmachilik"],
    hours: { 8: 1, 9: 1 },
  },
  {
    name: "Jismoniy tarbiya",
    codes: ["JT9", "JT4"],
    keywords: ["jismoniy tarbiya"],
    hours: { 5: 2, 6: 2, 7: 2, 8: 2, 9: 2 },
  },

  // ─── O'rta ta'lim (10–11-sinf) ──────────────────────────────────────────────
  {
    name: "Ona tili va adabiyoti",
    codes: ["ONA11", "ONA9"],
    keywords: ["ona tili va adabiyoti", "ona tili", "adabiyot"],
    hours: { 10: 3, 11: 3 },
  },
  {
    name: "Xorijiy til",
    codes: ["XORT11", "ING", "XORT4"],
    keywords: ["xorijiy til", "ingliz tili", "chet tili"],
    hours: { 10: 2, 11: 2 },
  },
  {
    name: "O'zbekiston tarixi",
    codes: ["UZBT11", "UZBT"],
    keywords: ["o'zbekiston tarixi"],
    hours: { 10: 2, 11: 2 },
  },
  {
    name: "Algebra",
    codes: ["ALG", "MATH11"],
    keywords: ["algebra", "matematika"],
    hours: { 10: 3, 11: 3 },
  },
  {
    name: "Geometriya",
    codes: ["GEOM"],
    keywords: ["geometriya"],
    hours: { 10: 2, 11: 2 },
  },
  {
    name: "Fizika",
    codes: ["FIZ11", "FIZ"],
    keywords: ["fizika"],
    hours: { 10: 3, 11: 3 },
  },
  {
    name: "Kimyo",
    codes: ["KIM11", "KIM"],
    keywords: ["kimyo"],
    hours: { 10: 2, 11: 2 },
  },
  {
    name: "Biologiya",
    codes: ["BIO11", "BIO"],
    keywords: ["biologiya"],
    hours: { 10: 2, 11: 2 },
  },
  {
    name: "Geografiya",
    codes: ["GEOG11", "GEOG"],
    keywords: ["geografiya"],
    hours: { 10: 2, 11: 2 },
  },
  {
    name: "Informatika va AT",
    codes: ["INF11", "INF9"],
    keywords: ["informatika"],
    hours: { 10: 2, 11: 2 },
  },
  {
    name: "Davlat va huquq asoslari",
    codes: ["DHQ", "HUQ"],
    keywords: ["huquq", "davlat va huquq"],
    hours: { 10: 1, 11: 1 },
  },
  {
    name: "Jismoniy tarbiya",
    codes: ["JT11", "JT9"],
    keywords: ["jismoniy tarbiya"],
    hours: { 10: 3, 11: 3 },
  },
  {
    name: "Chaqiruvga qadar boshlang'ich tayyorgarlik (CHQBT)",
    codes: [],
    keywords: ["chqbt", "harbiy", "boshlang'ich tayyorgarlik"],
    hours: { 10: 2, 11: 2 },
  },
];

export interface AutoAssignResult {
  assignments: Array<{ subjectId: number; teacherId: null; weeklyHours: number }>;
  matchedNames: string[];
  missingNames: string[];
}

export function getAutoAssignments(
  grade: number,
  dbSubjects: Array<{ id: number; name: string; code: string }>
): AutoAssignResult {
  const gradeEntries = DTS_CURRICULUM_2025.filter((e) => grade in e.hours);
  const assignments: AutoAssignResult["assignments"] = [];
  const matchedNames: string[] = [];
  const missingNames: string[] = [];
  const usedSubjectIds = new Set<number>();

  for (const entry of gradeEntries) {
    const hours = entry.hours[grade];
    if (!hours) continue;

    let found: (typeof dbSubjects)[number] | undefined;

    // 1. Exact code match
    for (const code of entry.codes) {
      found = dbSubjects.find((s) => s.code === code && !usedSubjectIds.has(s.id));
      if (found) break;
    }

    // 2. Keyword name match (case-insensitive)
    if (!found) {
      for (const kw of entry.keywords) {
        found = dbSubjects.find(
          (s) =>
            !usedSubjectIds.has(s.id) &&
            s.name.toLowerCase().includes(kw.toLowerCase())
        );
        if (found) break;
      }
    }

    if (found) {
      usedSubjectIds.add(found.id);
      assignments.push({ subjectId: found.id, teacherId: null, weeklyHours: hours });
      matchedNames.push(found.name);
    } else {
      missingNames.push(entry.name);
    }
  }

  return { assignments, matchedNames, missingNames };
}
