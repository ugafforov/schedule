/**
 * Boshlang'ich sinf o'qituvchilari (gradeLevel="primary") faqat o'z sinfiga
 * quyidagi fanlarga biriktirilishi mumkin bo'lgan fanlar ro'yxati.
 */
export const PRIMARY_TEACHER_ALLOWED_SUBJECTS = [
  "ona tili", 
  "matematika", 
  "o'qish savodxonligi", 
  "tarbiya", 
  "sinf soati"
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
