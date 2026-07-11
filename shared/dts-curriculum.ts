// O'zbekiston Respublikasi Maktabgacha va Maktab Ta'limi vazirligining
// 10.04.2025 yildagi 121-sonli buyrug'i bilan tasdiqlangan
// 2025-2026 o'quv yili Tayanch O'quv Rejasi (DTS)
//
// Manba: 1-ILOVA — ta'lim o'zbek tilida olib boriladigan maktablar uchun
//
// Jami haftalik soatlar: 1=21, 2=24, 3=24, 4=24, 5=29, 6=30, 7=35, 8=33, 9=34, 10=31, 11=31
//
// MUHIM: Har bir fan PDFdagi kabi ALOHIDA (birlashtirilmagan).
// Masalan: "Ona tili" va "Adabiyot" — ikki mustaqil fan.
//          "O'zbekiston tarixi" va "Jahon tarixi" — ikki mustaqil fan.

export interface DtsCurriculumEntry {
  name: string;
  codes: string[];
  keywords: string[];
  hours: Record<number, number>;
}

export const DTS_CURRICULUM_2025: DtsCurriculumEntry[] = [

  // ═══════════════════════════════════════════════════════════════════════════
  // I. FILOLOGIYA FANLARI (jadval satr 1–5)
  // ═══════════════════════════════════════════════════════════════════════════

  // 1. Ona tili — 1-sinfdan 11-sinfgacha (soatlar sinf bo'yicha farqlanadi)
  {
    name: "Ona tili",
    codes: ["ONA", "ONA1", "ONA4"],
    keywords: ["ona tili"],
    hours: { 1: 4, 2: 4, 3: 4, 4: 4, 5: 4, 6: 4, 7: 3, 8: 3, 9: 3, 10: 2, 11: 2 },
  },

  // 2. O'qish savodxonligi — faqat 1–4-sinf
  {
    name: "O'qish savodxonligi",
    codes: ["OQISH", "SAVOD"],
    keywords: ["o'qish savodxonligi", "savodxonlik"],
    hours: { 1: 4, 2: 3, 3: 3, 4: 3 },
  },

  // 3. Adabiyot — 5-sinfdan 11-sinfgacha
  {
    name: "Adabiyot",
    codes: ["ADAB"],
    keywords: ["adabiyot"],
    hours: { 5: 2, 6: 2, 7: 2, 8: 2, 9: 2, 10: 2, 11: 2 },
  },

  // 4. Rus tili — 2-sinfdan 11-sinfgacha (1-sinfda yo'q)
  {
    name: "Rus tili",
    codes: ["RUS"],
    keywords: ["rus tili"],
    hours: { 2: 2, 3: 2, 4: 2, 5: 2, 6: 2, 7: 2, 8: 2, 9: 2, 10: 2, 11: 2 },
  },

  // 5. Chet tili (ingliz/nemis/fransuz) — 1-sinfdan 11-sinfgacha
  {
    name: "Chet tili",
    codes: ["ING", "XORT4", "XORT"],
    keywords: ["ingliz tili", "chet tili", "xorijiy til", "nemis tili", "fransuz tili"],
    hours: { 1: 1, 2: 2, 3: 2, 4: 2, 5: 4, 6: 4, 7: 4, 8: 3, 9: 3, 10: 2, 11: 2 },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // II. IJTIMOIY FANLAR (jadval satr 6–11)
  // ═══════════════════════════════════════════════════════════════════════════

  // 6. Tarixdan hikoyalar — faqat 5-sinf
  {
    name: "Tarixdan hikoyalar",
    codes: ["TARHIK"],
    keywords: ["tarixdan hikoyalar"],
    hours: { 5: 2 },
  },

  // 7. Qadimgi dunyo tarixi — faqat 6-sinf
  {
    name: "Qadimgi dunyo tarixi",
    codes: ["QADTARIX"],
    keywords: ["qadimgi dunyo tarixi", "qadimgi dunyo"],
    hours: { 6: 2 },
  },

  // 8. O'zbekiston tarixi — 7–11-sinf (7-9: 2s, 10-11: 1s)
  {
    name: "O'zbekiston tarixi",
    codes: ["UZBT"],
    keywords: ["o'zbekiston tarixi"],
    hours: { 7: 2, 8: 2, 9: 2, 10: 1, 11: 1 },
  },

  // 9. Jahon tarixi — 7–11-sinf (har birida 1s)
  {
    name: "Jahon tarixi",
    codes: ["JTAR"],
    keywords: ["jahon tarixi", "umumiy tarix"],
    hours: { 7: 1, 8: 1, 9: 1, 10: 1, 11: 1 },
  },

  // 10. Davlat va huquq asoslari — 8–11-sinf
  {
    name: "Davlat va huquq asoslari",
    codes: ["DHQ", "HUQ"],
    keywords: ["davlat va huquq", "huquq asoslari", "konstitutsiya"],
    hours: { 8: 1, 9: 1, 10: 1, 11: 1 },
  },

  // 11. Tarbiya (Sinf soati / Kelajak soati) — 1–11-sinf
  {
    name: "Tarbiya",
    codes: ["TARB", "SINF"],
    keywords: ["tarbiya", "sinf soati", "kelajak soati"],
    hours: { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1, 10: 1, 11: 1 },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // III. ANIQ FANLAR (jadval satr 12–15)
  // ═══════════════════════════════════════════════════════════════════════════

  // 12. Matematika — 1–7-sinf (8-sinfdan Algebra va Geometriyaga bo'linadi)
  {
    name: "Matematika",
    codes: ["MATH4", "MATH", "MATH5"],
    keywords: ["matematika"],
    hours: { 1: 5, 2: 5, 3: 5, 4: 5, 5: 5, 6: 5, 7: 5 },
  },

  // 13. Algebra — 8–11-sinf
  {
    name: "Algebra",
    codes: ["ALG", "MATH11"],
    keywords: ["algebra"],
    hours: { 8: 3, 9: 3, 10: 3, 11: 3 },
  },

  // 14. Geometriya — 8–11-sinf
  {
    name: "Geometriya",
    codes: ["GEOM"],
    keywords: ["geometriya"],
    hours: { 8: 2, 9: 2, 10: 2, 11: 2 },
  },

  // 15. Informatika va axborot texnologiyalari
  // DIQQAT: 4-sinfda YO'Q (2025-yildan 3-sinfga kiritildi, 4-sinfga emas)
  {
    name: "Informatika va axborot texnologiyalari",
    codes: ["INF4", "INF9", "INF11", "INF"],
    keywords: ["informatika"],
    hours: { 1: 1, 2: 1, 3: 1, 5: 1, 6: 1, 7: 1, 8: 1, 9: 2, 10: 2, 11: 2 },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // IV. TABIIY VA IQTISODIY FANLAR (jadval satr 16–23)
  // ═══════════════════════════════════════════════════════════════════════════

  // 23. Tabiiy fanlar (Science) / Atrofimizdagi olam — 1–6-sinf
  {
    name: "Tabiiy fanlar (Science)",
    codes: ["ATRO", "TABIIY"],
    keywords: ["tabiiy fanlar", "atrofimizdagi olam", "science", "tabiat"],
    hours: { 1: 1, 2: 1, 3: 1, 4: 2, 5: 2, 6: 3 },
  },

  // 16. Fizika — 7–11-sinf
  {
    name: "Fizika",
    codes: ["FIZ", "FIZ11"],
    keywords: ["fizika"],
    hours: { 7: 2, 8: 2, 9: 2, 10: 2, 11: 2 },
  },

  // 17. Astronomiya — faqat 11-sinf
  {
    name: "Astronomiya",
    codes: ["ASTRO"],
    keywords: ["astronomiya"],
    hours: { 11: 1 },
  },

  // 18. Kimyo — 7–11-sinf
  {
    name: "Kimyo",
    codes: ["KIM", "KIM11"],
    keywords: ["kimyo"],
    hours: { 7: 2, 8: 2, 9: 2, 10: 2, 11: 2 },
  },

  // 19. Biologiya — 7–11-sinf
  {
    name: "Biologiya",
    codes: ["BIO", "BIO11"],
    keywords: ["biologiya"],
    hours: { 7: 2, 8: 2, 9: 2, 10: 2, 11: 2 },
  },

  // 20. Geografiya — 7–10-sinf (11-sinfda yo'q)
  // DIQQAT: 8-9-sinfda 1.5 soat (Iqtisodiy bilim asoslari 0.5s bilan juft)
  {
    name: "Geografiya",
    codes: ["GEOG"],
    keywords: ["geografiya"],
    hours: { 7: 2, 8: 1.5, 9: 1.5, 10: 2 },
  },

  // 21. Iqtisodiy bilim asoslari — faqat 8–9-sinf (0.5 soat)
  {
    name: "Iqtisodiy bilim asoslari",
    codes: ["IQT", "IQTISOD"],
    keywords: ["iqtisodiy bilim", "iqtisodiyot"],
    hours: { 8: 0.5, 9: 0.5 },
  },

  // 22. Tadbirkorlik asoslari — faqat 11-sinf
  {
    name: "Tadbirkorlik asoslari",
    codes: ["TADBIR"],
    keywords: ["tadbirkorlik"],
    hours: { 11: 1 },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // V. AMALIY FANLAR (jadval satr 24–29)
  // ═══════════════════════════════════════════════════════════════════════════

  // 24. Musiqa madaniyati — 1–7-sinf
  {
    name: "Musiqa madaniyati",
    codes: ["MUS", "MUS9"],
    keywords: ["musiqa madaniyati", "musiqa"],
    hours: { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1 },
  },

  // 25. Tasviriy san'at — 1–7-sinf
  {
    name: "Tasviriy san'at",
    codes: ["TASV", "TASV9"],
    keywords: ["tasviriy san'at", "tasviriy"],
    hours: { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1 },
  },

  // 26. Chizmachilik — faqat 8–9-sinf
  {
    name: "Chizmachilik",
    codes: ["CHIZMA"],
    keywords: ["chizmachilik"],
    hours: { 8: 1, 9: 1 },
  },

  // 27. Texnologiya (Mehnat ta'limi) — 1–9-sinf
  {
    name: "Texnologiya",
    codes: ["TECH4", "TECH9", "TECH"],
    keywords: ["texnologiya", "mehnat ta'limi", "mehnat"],
    hours: { 1: 1, 2: 1, 3: 1, 4: 1, 5: 2, 6: 2, 7: 2, 8: 1, 9: 1 },
  },

  // 28. Jismoniy tarbiya — 1–11-sinf
  {
    name: "Jismoniy tarbiya",
    codes: ["JT4", "JT9", "JT11", "JT"],
    keywords: ["jismoniy tarbiya"],
    hours: { 1: 1, 2: 2, 3: 2, 4: 2, 5: 2, 6: 2, 7: 2, 8: 2, 9: 2, 10: 2, 11: 2 },
  },

  // 29. Chaqiruvga qadar boshlang'ich tayyorgarlik (CHQBT) — 10–11-sinf
  {
    name: "Chaqiruvga qadar boshlang'ich tayyorgarlik",
    codes: ["CHQBT"],
    keywords: ["chqbt", "chaqiruvga qadar", "boshlang'ich tayyorgarlik"],
    hours: { 10: 2, 11: 2 },
  },
];

export const RUSSIAN_DTS_CURRICULUM_2025: DtsCurriculumEntry[] = [
  {
    name: "Ona tili",
    codes: ["ONA"],
    keywords: ["ona tili", "rodnoy yazik"],
    hours: { 1: 4, 2: 4, 3: 4, 4: 4, 5: 3, 6: 3, 7: 2, 8: 2, 9: 2, 10: 1, 11: 1 },
  },
  {
    name: "O'qish savodxonligi",
    codes: ["OQISH"],
    keywords: ["o'qish savodxonligi", "chtenie"],
    hours: { 1: 4, 2: 3, 3: 3, 4: 3 },
  },
  {
    name: "Adabiyot",
    codes: ["ADAB"],
    keywords: ["adabiyot", "literatura"],
    hours: { 5: 2, 6: 2, 7: 2, 8: 2, 9: 2, 10: 2, 11: 2 },
  },
  {
    name: "O'zbek tili",
    codes: ["UZB"],
    keywords: ["o'zbek tili"],
    hours: { 2: 2, 3: 2, 4: 2, 5: 3, 6: 3, 7: 3, 8: 3, 9: 3, 10: 3, 11: 3 },
  },
  {
    name: "Chet tili",
    codes: ["ING"],
    keywords: ["ingliz tili", "chet tili", "inostranniy"],
    hours: { 1: 1, 2: 2, 3: 2, 4: 2, 5: 4, 6: 4, 7: 4, 8: 3, 9: 3, 10: 2, 11: 2 },
  },
  {
    name: "Tarbiya",
    codes: ["TARB"],
    keywords: ["tarbiya", "vospitanie"],
    hours: { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1, 10: 1, 11: 1 },
  },
  // Faza 2 tuzatishi: bu 5 ta fan avvalgi RUSSIAN_DTS_CURRICULUM_2025'da umuman
  // yo'q edi (yozishda unutilgan) — DTS_CURRICULUM_2025 (o'zbek) massividagi bilan
  // bir xil soatlar bilan qo'shildi (rus tilida o'qiydigan sinflarda ham bu fanlar
  // rasmiy ravishda o'tiladi, faqat darslik/til farq qiladi).
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
    codes: ["UZBT"],
    keywords: ["o'zbekiston tarixi"],
    hours: { 7: 2, 8: 2, 9: 2, 10: 1, 11: 1 },
  },
  {
    name: "Jahon tarixi",
    codes: ["JTAR"],
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
    name: "Matematika",
    codes: ["MATH"],
    keywords: ["matematika"],
    hours: { 1: 5, 2: 5, 3: 5, 4: 5, 5: 5, 6: 5, 7: 5 },
  },
  {
    name: "Algebra",
    codes: ["ALG"],
    keywords: ["algebra"],
    hours: { 8: 3, 9: 3, 10: 3, 11: 3 },
  },
  {
    name: "Geometriya",
    codes: ["GEOM"],
    keywords: ["geometriya"],
    hours: { 8: 2, 9: 2, 10: 2, 11: 2 },
  },
  {
    name: "Informatika va axborot texnologiyalari",
    codes: ["INF"],
    keywords: ["informatika"],
    hours: { 1: 1, 2: 1, 3: 1, 5: 1, 6: 1, 7: 1, 8: 1, 9: 2, 10: 2, 11: 2 },
  },
  {
    name: "Tabiiy fanlar (Science)",
    codes: ["TABIIY"],
    keywords: ["tabiiy fanlar", "science"],
    hours: { 1: 1, 2: 1, 3: 1, 4: 2, 5: 2, 6: 3 },
  },
  {
    name: "Fizika",
    codes: ["FIZ"],
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
    name: "Kimyo",
    codes: ["KIM"],
    keywords: ["kimyo"],
    hours: { 7: 2, 8: 2, 9: 2, 10: 2, 11: 2 },
  },
  {
    name: "Biologiya",
    codes: ["BIO"],
    keywords: ["biologiya"],
    hours: { 7: 2, 8: 2, 9: 2, 10: 2, 11: 2 },
  },
  {
    name: "Geografiya",
    codes: ["GEOG"],
    keywords: ["geografiya"],
    hours: { 7: 2, 8: 1.5, 9: 1.5, 10: 2 },
  },
  {
    name: "Iqtisodiy bilim asoslari",
    codes: ["IQT"],
    keywords: ["iqtisodiy bilim"],
    hours: { 8: 0.5, 9: 0.5 },
  },
  {
    name: "Tadbirkorlik asoslari",
    codes: ["TADBIR"],
    keywords: ["tadbirkorlik"],
    hours: { 11: 1 },
  },
  {
    name: "Musiqa madaniyati",
    codes: ["MUS"],
    keywords: ["musiqa"],
    hours: { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1 },
  },
  {
    name: "Tasviriy san'at",
    codes: ["TASV"],
    keywords: ["tasviriy"],
    hours: { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1 },
  },
  {
    name: "Chizmachilik",
    codes: ["CHIZMA"],
    keywords: ["chizmachilik"],
    hours: { 8: 1, 9: 1 },
  },
  {
    name: "Texnologiya",
    codes: ["TECH"],
    keywords: ["texnologiya"],
    hours: { 1: 1, 2: 1, 3: 1, 4: 1, 5: 2, 6: 2, 7: 2, 8: 1, 9: 1 },
  },
  {
    name: "Jismoniy tarbiya",
    codes: ["JT"],
    keywords: ["jismoniy tarbiya"],
    hours: { 1: 1, 2: 2, 3: 2, 4: 2, 5: 2, 6: 2, 7: 2, 8: 2, 9: 2, 10: 2, 11: 2 },
  },
  {
    name: "Chaqiruvga qadar boshlang'ich tayyorgarlik",
    codes: ["CHQBT"],
    keywords: ["chqbt"],
    hours: { 10: 2, 11: 2 },
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// 2026-2027 o'quv yili — Maktabgacha va maktab ta'limi vazirining
// 2026-yil 10-apreldagi 133-son buyrug'i ("Umumiy o'rta ta'lim muassasalari
// uchun 2026-2027-o'quv yiliga mo'ljallangan tayanch o'quv rejalarni tasdiqlash
// to'g'risida"). Manba PDF (1-ILOVA/2-ILOVA) matn qatlami dasturiy tekshirildi
// (pdftotext -layout) va 2025-2026 bilan qator-baqator solishtirildi.
//
// Yagona farq: 4-sinfda "Informatika va axborot texnologiyalari" joriy etildi
// (yangi: 1 soat) — buyruqning 4-bandi shuni talab qiladi. Buning evaziga
// "Tabiiy fanlar (Science)" 4-sinfda 2 soatdan 1 soatga kamaydi (jami sinf
// soati o'zgarmasligi uchun). Boshqa barcha fan/sinf/til bo'yicha soatlar
// 2025-2026 bilan AYNAN bir xil (tekshirilgan). Jami haftalik soatlar
// o'zgarmagan: 1=21, 2=24, 3=24, 4=24, 5=29, 6=30, 7=35, 8=33, 9=34, 10=31, 11=31.
// ═══════════════════════════════════════════════════════════════════════════
function applyGrade4InformatikaShift(entries: DtsCurriculumEntry[]): DtsCurriculumEntry[] {
  return entries.map((e) => {
    if (e.name === "Informatika va axborot texnologiyalari" || e.name === "Tabiiy fanlar (Science)") {
      return { ...e, hours: { ...e.hours, 4: 1 } };
    }
    return { ...e, hours: { ...e.hours } };
  });
}

export const DTS_CURRICULUM_2026: DtsCurriculumEntry[] = applyGrade4InformatikaShift(DTS_CURRICULUM_2025);
export const RUSSIAN_DTS_CURRICULUM_2026: DtsCurriculumEntry[] = applyGrade4InformatikaShift(RUSSIAN_DTS_CURRICULUM_2025);

// ── Matching function ─────────────────────────────────────────────────────────

export interface AutoAssignResult {
  assignments: Array<{ subjectId: number; teacherId: null; weeklyHours: number }>;
  matchedNames: string[];
  missingNames: string[];
}

export function getAutoAssignments(
  grade: number,
  dbSubjects: Array<{ id: number; name: string; code: string }>,
  language: string = "uz"
): AutoAssignResult {
  const curriculum = language === "ru" ? RUSSIAN_DTS_CURRICULUM_2026 : DTS_CURRICULUM_2026;
  const gradeEntries = curriculum.filter((e) => grade in e.hours);
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
