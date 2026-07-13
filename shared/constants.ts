/**
 * Boshlang'ich sinf o'qituvchilari (gradeLevel="primary") faqat o'z sinfiga
 * quyidagi fanlarga biriktirilishi mumkin bo'lgan fanlar ro'yxati.
 */
export const PRIMARY_TEACHER_ALLOWED_SUBJECTS = [
  "ona tili",
  "matematika",
  "o'qish savodxonligi",
  "tarbiya",
  "sinf soati",
  "tabiiy fanlar",
  "tasviriy san'at",
  "texnologiya",
  // 133-son buyruq (10.04.2026): "Informatika va axborot texnologiyalari" 1-4-sinflarda
  // boshlang'ich sinf o'qituvchilari tomonidan o'qitiladi (tushuntirish xati, 3-band).
  "informatika",
];

/**
 * Berilgan fan nomi boshlang'ich sinf o'qituvchisi uchun ruxsat etilganligini tekshiradi.
 */
export function isPrimaryTeacherAllowedSubject(subjectName: string): boolean {
  const name = subjectName.toLowerCase().trim();
  // startsWith — "Jismoniy tarbiya" ni "tarbiya" ga yanglish moslashdan saqlaydi
  return PRIMARY_TEACHER_ALLOWED_SUBJECTS.some(s => name.startsWith(s));
}

/**
 * "Sinf soati" (Kelajak soati) darsini aniqlaydi — 3271-son nizomga ko'ra bu dars
 * sinf rahbari tomonidan, belgilangan vaqtda (default: dushanba 1-soat) o'tiladi.
 * DTS'da bu dars "Tarbiya" nomi bilan yuritiladi.
 */
export function isClassHourSubject(subjectName: string): boolean {
  const name = subjectName.toLowerCase().trim();
  // startsWith — "Jismoniy tarbiya" ni yanglish moslashdan saqlaydi
  return (
    name.startsWith("tarbiya") ||
    name.includes("sinf soati") ||
    name.includes("kelajak soati")
  );
}

/** Sinf soati uchun standart vaqt: dushanba (1), 1-dars. */
export const DEFAULT_CLASS_HOUR_SLOT = { dayOfWeek: 1, periodNumber: 1 };

/** app_settings jadvalidagi sinf soati vaqti kaliti. */
export const CLASS_HOUR_SLOT_SETTING_KEY = "classHourSlot";

/**
 * classes.grade matn maydonidan raqamli sinf darajasini oladi.
 * "5", "5A", "5-A" kabi qiymatlarni to'g'ri qayta ishlaydi ("5A" uchun parseInt ham 5
 * qaytaradi, lekin bu helper niyatni aniq ifodalaydi va noto'g'ri qiymatda 0 qaytaradi).
 */
export function parseGrade(grade: string | number | null | undefined): number {
  const m = String(grade ?? "").match(/^\d+/);
  return m ? parseInt(m[0], 10) : 0;
}

export const ROOM_TYPE_LABELS: Record<string, string> = {
  classroom: "Sinf xonasi",
  lab: "Laboratoriya",
  gym: "Sport zali",
  computer: "Kompyuter xonasi",
  music: "Musiqa xonasi",
  art: "Rasm xonasi",
  any: "Istalgan xona",
};

export const ROOM_TYPES = Object.keys(ROOM_TYPE_LABELS);

/**
 * SanPiN №0341-16 bo'yicha fanlarning murakkablik darajasi (ballar 1-11)
 * Eng yuqori (11): Matematika, Informatika
 * Yuqori (10): Ona tili, Adabiyot, Xorijiy tillar
 * ... va hokazo.
 */
export type SubjectCategory = "mental" | "dynamic" | "humanitarian" | "other";

export const SUBJECT_METADATA: Record<string, { complexity: number; category: SubjectCategory }> = {
  "matematika": { complexity: 11, category: "mental" },
  "algebra": { complexity: 11, category: "mental" },
  "geometriya": { complexity: 11, category: "mental" },
  "informatika": { complexity: 11, category: "mental" },
  
  "ona tili": { complexity: 10, category: "humanitarian" },
  "adabiyot": { complexity: 10, category: "humanitarian" },
  "ingliz tili": { complexity: 10, category: "humanitarian" },
  "rus tili": { complexity: 10, category: "humanitarian" },
  "nemis tili": { complexity: 10, category: "humanitarian" },
  "fransuz tili": { complexity: 10, category: "humanitarian" },
  
  "fizika": { complexity: 9, category: "mental" },
  "kimyo": { complexity: 9, category: "mental" },
  "astronomiya": { complexity: 9, category: "mental" },
  
  "tarix": { complexity: 8, category: "humanitarian" },
  "o'zbekiston tarixi": { complexity: 8, category: "humanitarian" },
  "jahon tarixi": { complexity: 8, category: "humanitarian" },
  "davlat va huquq": { complexity: 8, category: "humanitarian" },
  "huquq": { complexity: 8, category: "humanitarian" },
  "iqtisod": { complexity: 8, category: "mental" },
  
  "tabiiy fanlar": { complexity: 7, category: "mental" },
  "geografiya": { complexity: 7, category: "humanitarian" },
  "biologiya": { complexity: 7, category: "mental" },
  
  "tarbiya": { complexity: 6, category: "other" },
  "sinf soati": { complexity: 6, category: "other" },
  
  "jismoniy tarbiya": { complexity: 5, category: "dynamic" },
  "chqbt": { complexity: 5, category: "dynamic" },
  
  "texnologiya": { complexity: 4, category: "dynamic" },
  
  "chizmachilik": { complexity: 3, category: "dynamic" },
  
  "tasviriy san'at": { complexity: 2, category: "dynamic" },
  "musiqa": { complexity: 1, category: "dynamic" },
};

// Eng uzun mos kalitni tanlaydi — "jismoniy tarbiya" "tarbiya"dan ustun bo'lishi uchun
function findSubjectMetadata(subjectName: string) {
  const name = subjectName.toLowerCase().trim();
  let best: { key: string; meta: { complexity: number; category: SubjectCategory } } | null = null;
  for (const [key, meta] of Object.entries(SUBJECT_METADATA)) {
    if (name.includes(key) && (!best || key.length > best.key.length)) {
      best = { key, meta };
    }
  }
  return best?.meta ?? null;
}

export function getSubjectComplexity(subjectName: string): number {
  return findSubjectMetadata(subjectName)?.complexity ?? 7; // O'rtacha qiymat noma'lum fanlar uchun
}

export function getSubjectCategory(subjectName: string): SubjectCategory {
  return findSubjectMetadata(subjectName)?.category ?? "other";
}

/**
 * SanPiN №0341-16 bo'yicha kunlik maksimal dars soatlari
 */
export function getMaxHoursPerDay(grade: number | string): number {
  const g = parseInt(String(grade));
  if (g >= 1 && g <= 2) return 5;
  if (g >= 3 && g <= 4) return 5;
  if (g >= 5 && g <= 7) return 7;
  if (g >= 8 && g <= 11) return 7;
  return 7;
}

/**
 * SanPiN bo'yicha haftaning kunlari uchun murakkablik multiplikatori
 * Seshanba (2) va Chorshanba (3) eng yuqori (1.2)
 * Payshanba (4) o'rtacha (1.0)
 * Dushanba (1) va Juma (5) past (0.8)
 */
export function getSanPinDayMultiplier(dayOfWeek: number): number {
  switch (Number(dayOfWeek)) {
    case 1: return 0.8;
    case 2: return 1.2;
    case 3: return 1.2;
    case 4: return 1.0;
    case 5: return 0.8;
    case 6: return 0.7;
    default: return 1.0;
  }
}

/**
 * Sinf uchun kunlik optimal (maksimal) murakkablik chegarasi
 */
export function getMaxDailyComplexity(grade: number | string, dayOfWeek: number): number {
  const g = parseInt(String(grade));
  const mult = getSanPinDayMultiplier(dayOfWeek);
  
  // O'rtacha 1 dars qiyinchiligi = 7. 
  // 1-4 sinf: 5 soat * 7 = 35
  // 5-9 sinf: 6 soat * 7.5 = 45
  // 10-11 sinf: 7 soat * 8 = 56
  let base = 45;
  if (g >= 1 && g <= 4) base = 35;
  else if (g >= 10 && g <= 11) base = 56;
  
  return base * mult;
}

