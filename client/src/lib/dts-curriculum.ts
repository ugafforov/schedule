// O'zbekiston Respublikasi Maktabgacha va Maktab Ta'limi vazirligining
// 10.04.2025 yildagi 121-sonli buyrug'i bilan tasdiqlangan
// 2025-2026 o'quv yili Tayanch O'quv Rejasi (DTS)
//
// Manba: xalqtaliminfo.uz/storage/documents/1744872734O'quv_reja_2026_xalq860.pdf
// (1-ILOVA — ta'lim o'zbek tilida olib boriladigan maktablar uchun)
//
// Tekshirilgan jami soatlar (haftalik):
//  1=21, 2=24, 3=24, 4=24, 5=29, 6=30, 7=35, 8=33, 9=34, 10=31, 11=31  Jami=316

export interface DtsCurriculumEntry {
  name: string;
  codes: string[];     // birinchi mos kelgani ishlatiladi
  keywords: string[];  // nomdan qidirish uchun
  hours: Record<number, number>; // sinf → haftalik soat
}

export const DTS_CURRICULUM_2025: DtsCurriculumEntry[] = [

  // ── I. FILOLOGIYA FANLARI ─────────────────────────────────────────────────

  // Ona tili + O'qish savodxonligi birlashtirilgan holda saqlanadigan maktablar uchun
  {
    name: "Ona tili va o'qish savodxonligi (1–4-sinf)",
    codes: ["ONA4"],
    keywords: ["ona tili va o'qish", "o'qish savodxonligi"],
    // 1-sinf: Ona=4 + O'qish=4=8; 2: 4+3=7; 3: 4+3=7; 4: 4+3=7
    hours: { 1: 8, 2: 7, 3: 7, 4: 7 },
  },
  // Agar "Ona tili" va "O'qish savodxonligi" alohida bo'lsa — ikki alohida entry
  {
    name: "Ona tili (1–4-sinf)",
    codes: ["ONA", "ONA1"],
    keywords: ["ona tili"],
    hours: { 1: 4, 2: 4, 3: 4, 4: 4 },
  },
  {
    name: "O'qish savodxonligi",
    codes: ["OQISH", "SAVOD"],
    keywords: ["o'qish savodxonligi", "savodxonlik"],
    hours: { 1: 4, 2: 3, 3: 3, 4: 3 },
  },

  // Ona tili va adabiyot birlashtirilgan (5–11-sinf)
  {
    name: "Ona tili va adabiyoti (5–9-sinf)",
    codes: ["ONA9"],
    keywords: ["ona tili va adabiyoti"],
    // 5: Ona=4+Adabiyot=2=6; 6: 4+2=6; 7: 3+2=5; 8: 3+2=5; 9: 3+2=5
    hours: { 5: 6, 6: 6, 7: 5, 8: 5, 9: 5 },
  },
  {
    name: "Ona tili va adabiyoti (10–11-sinf)",
    codes: ["ONA11"],
    keywords: ["ona tili va adabiyoti (10", "ona tili va adabiyoti (11"],
    // 10: Ona=2+Adabiyot=2=4; 11: 2+2=4
    hours: { 10: 4, 11: 4 },
  },

  // Agar "Ona tili" va "Adabiyot" alohida bo'lsa
  {
    name: "Ona tili (5–11-sinf)",
    codes: ["ONA5", "ONAT"],
    keywords: ["ona tili"],
    hours: { 5: 4, 6: 4, 7: 3, 8: 3, 9: 3, 10: 2, 11: 2 },
  },
  {
    name: "Adabiyot",
    codes: ["ADAB"],
    keywords: ["adabiyot"],
    hours: { 5: 2, 6: 2, 7: 2, 8: 2, 9: 2, 10: 2, 11: 2 },
  },

  {
    name: "Chet tili (Ingliz/Nemis/Fransuz tili)",
    codes: ["ING", "XORT4", "XORT11", "XORT"],
    keywords: ["ingliz tili", "chet tili", "xorijiy til", "nemis tili", "fransuz tili"],
    hours: { 1: 1, 2: 2, 3: 2, 4: 2, 5: 4, 6: 4, 7: 4, 8: 3, 9: 3, 10: 2, 11: 2 },
  },

  {
    name: "Rus tili",
    codes: ["RUS", "UZB"],
    keywords: ["rus tili", "o'zbek tili"],
    hours: { 2: 2, 3: 2, 4: 2, 5: 2, 6: 2, 7: 2, 8: 2, 9: 2, 10: 2, 11: 2 },
  },

  // ── II. IJTIMOIY FANLAR ───────────────────────────────────────────────────

  {
    name: "Tarixdan hikoyalar",
    codes: ["TARHIK"],
    keywords: ["tarixdan hikoyalar"],
    hours: { 5: 2 },
  },
  {
    name: "Qadimgi dunyo tarixi",
    codes: ["QADTARIX"],
    keywords: ["qadimgi dunyo tarixi", "qadimgi dunyo"],
    hours: { 6: 2 },
  },
  {
    name: "O'zbekiston tarixi",
    codes: ["UZBT", "UZBT11"],
    keywords: ["o'zbekiston tarixi"],
    hours: { 7: 2, 8: 2, 9: 2, 10: 1, 11: 1 },
  },
  {
    name: "Jahon tarixi",
    codes: ["JTAR", "JTAR11"],
    keywords: ["jahon tarixi", "umumiy tarix"],
    hours: { 7: 1, 8: 1, 9: 1, 10: 1, 11: 1 },
  },
  {
    name: "Davlat va huquq asoslari",
    codes: ["DHQ", "HUQ"],
    keywords: ["davlat va huquq", "huquq asoslari", "konstitutsiya"],
    hours: { 8: 1, 9: 1, 10: 1, 11: 1 },
  },
  {
    name: "Tarbiya (Sinf soati)",
    codes: ["TARB", "SINF"],
    keywords: ["tarbiya", "sinf soati", "kelajak soati"],
    hours: { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1, 10: 1, 11: 1 },
  },

  // ── III. ANIQ FANLAR ──────────────────────────────────────────────────────

  // Matematika (1–7-sinf, yagona fan)
  {
    name: "Matematika (1–7-sinf)",
    codes: ["MATH4", "MATH", "MATH5", "MATH57"],
    keywords: ["matematika"],
    hours: { 1: 5, 2: 5, 3: 5, 4: 5, 5: 5, 6: 5, 7: 5 },
  },
  // Algebra (8–11-sinf)
  {
    name: "Algebra",
    codes: ["ALG", "MATH11"],
    keywords: ["algebra"],
    hours: { 8: 3, 9: 3, 10: 3, 11: 3 },
  },
  // Geometriya (8–11-sinf)
  {
    name: "Geometriya",
    codes: ["GEOM"],
    keywords: ["geometriya"],
    hours: { 8: 2, 9: 2, 10: 2, 11: 2 },
  },
  {
    name: "Informatika va axborot texnologiyalari",
    codes: ["INF4", "INF9", "INF11", "INF"],
    keywords: ["informatika"],
    // Grade 4 = 0! (rasmiy DTS da 4-sinfda yo'q)
    hours: { 1: 1, 2: 1, 3: 1, 5: 1, 6: 1, 7: 1, 8: 1, 9: 2, 10: 2, 11: 2 },
  },

  // ── IV. TABIIY VA IQTISODIY FANLAR ───────────────────────────────────────

  // Tabiiy fanlar (Science) — 1–6-sinf
  {
    name: "Tabiiy fanlar (Science) / Atrofimizdagi olam",
    codes: ["ATRO", "TABIIY"],
    keywords: ["tabiiy fanlar", "atrofimizdagi olam", "science", "tabiat"],
    hours: { 1: 1, 2: 1, 3: 1, 4: 2, 5: 2, 6: 3 },
  },
  {
    name: "Fizika",
    codes: ["FIZ", "FIZ11"],
    keywords: ["fizika"],
    hours: { 7: 2, 8: 2, 9: 2, 10: 2, 11: 2 },
  },
  {
    name: "Astronomiya",
    codes: ["ASTRO"],
    keywords: ["astronomiya"],
    hours: { 11: 1 },
  },
  {
    name: "Biologiya",
    codes: ["BIO", "BIO11"],
    keywords: ["biologiya"],
    hours: { 7: 2, 8: 2, 9: 2, 10: 2, 11: 2 },
  },
  {
    name: "Kimyo",
    codes: ["KIM", "KIM11"],
    keywords: ["kimyo"],
    // 11-sinfda 1 soat (Astronomiya bilan almashtirilib 1h kam)
    hours: { 7: 2, 8: 2, 9: 2, 10: 2, 11: 1 },
  },
  {
    name: "Geografiya",
    codes: ["GEOG", "GEOG11"],
    keywords: ["geografiya"],
    hours: { 7: 2, 8: 2, 9: 2, 10: 2, 11: 2 },
  },

  // ── V. BADIIY FANLAR ──────────────────────────────────────────────────────

  {
    name: "Musiqa",
    codes: ["MUS", "MUS9"],
    keywords: ["musiqa"],
    hours: { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1 },
  },
  {
    name: "Tasviriy san'at",
    codes: ["TASV", "TASV9"],
    keywords: ["tasviriy"],
    hours: { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1 },
  },

  // ── VI. JISMONIY VA TEXNOLOGIK FANLAR ────────────────────────────────────

  {
    name: "Texnologiya (Mehnat ta'limi)",
    codes: ["TECH4", "TECH9", "TECH"],
    keywords: ["texnologiya", "mehnat"],
    hours: { 1: 1, 2: 1, 3: 1, 4: 1, 5: 2, 6: 2, 7: 2, 8: 1, 9: 1 },
  },
  {
    name: "Chizmachilik",
    codes: ["CHIZMA"],
    keywords: ["chizmachilik"],
    hours: { 8: 1, 9: 1 },
  },
  {
    name: "Jismoniy tarbiya",
    codes: ["JT4", "JT9", "JT11", "JT"],
    keywords: ["jismoniy tarbiya"],
    // Rasmiy DTS: 1-sinf=1soat, 2-11=2soat
    hours: { 1: 1, 2: 2, 3: 2, 4: 2, 5: 2, 6: 2, 7: 2, 8: 2, 9: 2, 10: 2, 11: 2 },
  },
  {
    name: "Chaqiruvga qadar boshlang'ich tayyorgarlik (CHQBT)",
    codes: ["CHQBT"],
    keywords: ["chqbt", "chaqiruvga qadar", "harbiy tayyorgarlik"],
    hours: { 10: 2, 11: 2 },
  },
];

// ── Matching function ─────────────────────────────────────────────────────────

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

    // 1. Exact code match (try each code in priority order)
    for (const code of entry.codes) {
      found = dbSubjects.find((s) => s.code === code && !usedSubjectIds.has(s.id));
      if (found) break;
    }

    // 2. Keyword name match (case-insensitive substring)
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
      matchedNames.push(`${found.name} (${hours} soat)`);
    } else {
      missingNames.push(`${entry.name} — ${hours} soat`);
    }
  }

  return { assignments, matchedNames, missingNames };
}
