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
  "texnologiya"
];

/**
 * Berilgan fan nomi boshlang'ich sinf o'qituvchisi uchun ruxsat etilganligini tekshiradi.
 */
export function isPrimaryTeacherAllowedSubject(subjectName: string): boolean {
  const name = subjectName.toLowerCase();
  return PRIMARY_TEACHER_ALLOWED_SUBJECTS.some(s => name.includes(s));
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
 * SanPiN №0341-16 bo'yicha fanlarning murakkablik darajasi (ballar)
 * Yuqori (8-10): Matematika, Fizika, Kimyo, Chet tili
 * O'rta (5-7): Ona tili, Adabiyot, Tarix, Biologiya, Geografiya
 * Past (1-4): Tasviriy san'at, Musiqa, Texnologiya, Jismoniy tarbiya
 */
export type SubjectCategory = "mental" | "dynamic" | "humanitarian" | "other";

export const SUBJECT_METADATA: Record<string, { complexity: number; category: SubjectCategory }> = {
  "matematika": { complexity: 10, category: "mental" },
  "algebra": { complexity: 10, category: "mental" },
  "geometriya": { complexity: 10, category: "mental" },
  "fizika": { complexity: 9, category: "mental" },
  "kimyo": { complexity: 9, category: "mental" },
  "ingliz tili": { complexity: 8, category: "humanitarian" },
  "nemis tili": { complexity: 8, category: "humanitarian" },
  "fransuz tili": { complexity: 8, category: "humanitarian" },
  "ona tili": { complexity: 7, category: "humanitarian" },
  "adabiyot": { complexity: 6, category: "humanitarian" },
  "tarix": { complexity: 6, category: "humanitarian" },
  "o'zbekiston tarixi": { complexity: 6, category: "humanitarian" },
  "jahon tarixi": { complexity: 6, category: "humanitarian" },
  "biologiya": { complexity: 6, category: "mental" },
  "geografiya": { complexity: 5, category: "humanitarian" },
  "iqtisod": { complexity: 5, category: "mental" },
  "tarbiya": { complexity: 3, category: "other" },
  "tasviriy san'at": { complexity: 2, category: "dynamic" },
  "musiqa": { complexity: 2, category: "dynamic" },
  "texnologiya": { complexity: 2, category: "dynamic" },
  "jismoniy tarbiya": { complexity: 1, category: "dynamic" },
  "chqbt": { complexity: 1, category: "dynamic" },
  "sinf soati": { complexity: 0, category: "other" },
};

export function getSubjectComplexity(subjectName: string): number {
  const name = subjectName.toLowerCase().trim();
  for (const [key, meta] of Object.entries(SUBJECT_METADATA)) {
    if (name.includes(key)) return meta.complexity;
  }
  return 5;
}

export function getSubjectCategory(subjectName: string): SubjectCategory {
  const name = subjectName.toLowerCase().trim();
  for (const [key, meta] of Object.entries(SUBJECT_METADATA)) {
    if (name.includes(key)) return meta.category;
  }
  return "other";
}

/**
 * SanPiN №0341-16 bo'yicha kunlik maksimal dars soatlari
 */
export function getMaxHoursPerDay(grade: number | string): number {
  const g = parseInt(String(grade));
  if (g >= 1 && g <= 2) return 5; // Relaxed from 4 to 5 to allow 21h/week
  if (g >= 3 && g <= 4) return 5; // Relaxed from 4 to 5 to allow 22h/week
  if (g >= 5 && g <= 7) return 7; // Relaxed to 7
  if (g >= 8 && g <= 11) return 7; // Relaxed to 7
  return 7;
}

