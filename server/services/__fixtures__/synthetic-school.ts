/**
 * Sintetik maktab fixture'i — jadval terish algoritmini HAQIQIY o'lchamdagi
 * maktablarda sinash uchun. Kichik qo'lda yozilgan fixture'lar (2 sinf) algoritm
 * miqyoslashini ko'rsatmaydi; bu yerda 1-11-sinflar, DTS'ga yaqin soatlar,
 * o'qituvchi yuklamasi va xona parki real nisbatlarda quriladi.
 *
 * Faqat testlar uchun — ishlab chiqarish kodidan import qilinmaydi.
 */

export interface SyntheticSchool {
  classes: any[];
  rooms: any[];
  subjects: any[];
  teachers: any[];
  classSubjects: any[];
  timeSlots: any[];
  /** Jadvalga tushishi kerak bo'lgan umumiy dars soati. */
  totalWeeklyHours: number;
}

interface SubjectPlan {
  name: string;
  roomType: string;
  /** sinf darajasi -> haftalik soat (0 yoki yo'q = bu sinfda o'qitilmaydi) */
  hours: Record<number, number>;
}

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
const forGrades = (grades: number[], h: number) => Object.fromEntries(grades.map((g) => [g, h]));

/** DTS 2025-2026 ga yaqinlashtirilgan o'quv reja (aniq raqamlar emas — miqyos uchun). */
const SUBJECT_PLAN: SubjectPlan[] = [
  { name: "Ona tili", roomType: "classroom", hours: { ...forGrades(range(1, 4), 4), ...forGrades(range(5, 9), 3), ...forGrades(range(10, 11), 2) } },
  { name: "O'qish savodxonligi", roomType: "classroom", hours: forGrades(range(1, 4), 4) },
  { name: "Adabiyot", roomType: "classroom", hours: { ...forGrades(range(5, 9), 2), ...forGrades(range(10, 11), 2) } },
  { name: "Matematika", roomType: "classroom", hours: { ...forGrades(range(1, 4), 5), ...forGrades(range(5, 6), 4) } },
  { name: "Algebra", roomType: "classroom", hours: { ...forGrades(range(7, 9), 3), ...forGrades(range(10, 11), 3) } },
  { name: "Geometriya", roomType: "classroom", hours: { ...forGrades(range(7, 9), 2), ...forGrades(range(10, 11), 2) } },
  { name: "Chet tili", roomType: "classroom", hours: { ...forGrades(range(1, 4), 2), ...forGrades(range(5, 9), 3), ...forGrades(range(10, 11), 2) } },
  { name: "Rus tili", roomType: "classroom", hours: { ...forGrades(range(5, 9), 2), ...forGrades(range(10, 11), 2) } },
  { name: "Tarix", roomType: "classroom", hours: { ...forGrades(range(5, 9), 2), ...forGrades(range(10, 11), 2) } },
  { name: "Geografiya", roomType: "classroom", hours: { ...forGrades(range(6, 9), 2), ...forGrades(range(10, 11), 2) } },
  { name: "Biologiya", roomType: "lab", hours: { ...forGrades(range(6, 9), 2), ...forGrades(range(10, 11), 2) } },
  { name: "Fizika", roomType: "lab", hours: { ...forGrades(range(7, 9), 2), ...forGrades(range(10, 11), 2) } },
  { name: "Kimyo", roomType: "lab", hours: { ...forGrades(range(8, 9), 2), ...forGrades(range(10, 11), 2) } },
  { name: "Tabiiy fanlar", roomType: "classroom", hours: forGrades(range(1, 4), 2) },
  { name: "Informatika", roomType: "computer", hours: { ...forGrades(range(1, 4), 1), ...forGrades(range(5, 9), 1), ...forGrades(range(10, 11), 2) } },
  { name: "Jismoniy tarbiya", roomType: "gym", hours: { ...forGrades(range(1, 4), 3), ...forGrades(range(5, 11), 2) } },
  { name: "Musiqa", roomType: "music", hours: { ...forGrades(range(1, 4), 1), ...forGrades(range(5, 7), 1) } },
  { name: "Tasviriy san'at", roomType: "art", hours: { ...forGrades(range(1, 4), 1), ...forGrades(range(5, 7), 1) } },
  { name: "Texnologiya", roomType: "classroom", hours: { ...forGrades(range(1, 4), 1), ...forGrades(range(5, 9), 1) } },
  { name: "Tarbiya", roomType: "classroom", hours: forGrades(range(1, 11), 1) },
  { name: "Chaqiruvga qadar boshlang'ich tayyorgarlik", roomType: "gym", hours: forGrades(range(10, 11), 2) },
];

export interface SchoolOptions {
  /** Har bir sinf darajasida nechta parallel sinf (A, B, C...). */
  parallelsPerGrade: number;
  /** Haftada nechta o'quv kuni (default 6). */
  studyDays?: number;
  /** Kunlik dars soatlari soni (default 7). */
  periodsPerDay?: number;
  /** Bitta o'qituvchining maqsadli haftalik yuklamasi (default 22). */
  targetTeacherLoad?: number;
  /** Maxsus xonalar soni (default: real maktabga yaqin). */
  specialRooms?: Partial<Record<"gym" | "computer" | "music" | "art" | "lab", number>>;
}

export function buildSyntheticSchool(opts: SchoolOptions): SyntheticSchool {
  const parallels = opts.parallelsPerGrade;
  const dayCount = opts.studyDays ?? 6;
  const periods = opts.periodsPerDay ?? 7;
  const targetLoad = opts.targetTeacherLoad ?? 22;

  const days = range(1, dayCount);
  const timeSlots: any[] = [];
  let slotId = 1;
  for (const day of days) {
    for (let p = 1; p <= periods; p++) {
      timeSlots.push({
        id: slotId++, name: `kun${day}-dars${p}`, startTime: "08:00", endTime: "08:45",
        dayOfWeek: day, periodNumber: p, isBreak: false, isActive: true,
      });
    }
  }

  const subjects = SUBJECT_PLAN.map((s, i) => ({
    id: i + 1, name: s.name, code: `S${i + 1}`, requiredRoomType: s.roomType, isActive: true,
  }));
  const subjectByName = new Map(subjects.map((s) => [s.name, s]));

  // --- Sinflar ---
  const letters = "ABCDEFGH";
  const classes: any[] = [];
  let classId = 1;
  for (const grade of range(1, 11)) {
    for (let p = 0; p < parallels; p++) {
      classes.push({
        id: classId++,
        name: `${grade}-${letters[p]}`,
        grade: String(grade),
        language: "uz",
        studyDays: days.join(","),
        totalStudents: 28,
        isActive: true,
        // defaultRoomId quyida (xonalar yaratilgach) beriladi
        defaultRoomId: null,
      });
    }
  }

  // --- Xonalar: har sinfga bitta uy xonasi + maxsus xonalar ---
  // Maxsus xonalar soni maktab kattaligiga qarab o'sadi. Aks holda fixture'ning o'zi
  // bajarib bo'lmaydigan bo'lib qoladi (88 sinfda 1 ta musiqa xonasiga 56 soat talab
  // tushadi, haftada esa atigi 42 slot bor) va algoritm aybdordek ko'rinadi.
  const special = {
    gym: opts.specialRooms?.gym ?? Math.max(1, Math.ceil(classes.length / 12)),
    computer: opts.specialRooms?.computer ?? Math.max(1, Math.ceil(classes.length / 20)),
    music: opts.specialRooms?.music ?? Math.max(1, Math.ceil(classes.length / 25)),
    art: opts.specialRooms?.art ?? Math.max(1, Math.ceil(classes.length / 25)),
    lab: opts.specialRooms?.lab ?? Math.max(3, Math.ceil(classes.length / 8)),
  };
  const rooms: any[] = [];
  let roomId = 1;
  for (const cls of classes) {
    rooms.push({ id: roomId, name: `Sinf xonasi ${100 + roomId}`, roomNumber: String(100 + roomId), capacity: 32, roomType: "classroom", isActive: true });
    cls.defaultRoomId = roomId;
    roomId++;
  }
  const labNames = ["Fizika laboratoriyasi", "Kimyo laboratoriyasi", "Biologiya laboratoriyasi"];
  const pushSpecial = (type: string, name: string, count: number) => {
    for (let i = 0; i < count; i++) {
      rooms.push({
        id: roomId, name: type === "lab" ? labNames[i % labNames.length] : `${name}${count > 1 ? " " + (i + 1) : ""}`,
        roomNumber: String(200 + roomId), capacity: 32, roomType: type, isActive: true,
      });
      roomId++;
    }
  };
  pushSpecial("gym", "Sport zali", special.gym);
  pushSpecial("computer", "Informatika xonasi", special.computer);
  pushSpecial("music", "Musiqa xonasi", special.music);
  pushSpecial("art", "Tasviriy xonasi", special.art);
  pushSpecial("lab", "", special.lab);

  // --- O'qituvchilar va biriktirishlar ---
  // Boshlang'ich sinf (1-4): bitta o'qituvchi o'z sinfining ruxsat etilgan fanlarini o'qitadi.
  // Yuqori sinflarda: har fan bo'yicha yuklamani targetLoad ga bo'lib, kerakli sonda o'qituvchi.
  const teachers: any[] = [];
  const classSubjects: any[] = [];
  let teacherId = 1;
  let csId = 1;
  let totalWeeklyHours = 0;

  const PRIMARY_OWN_SUBJECTS = new Set([
    "Ona tili", "O'qish savodxonligi", "Matematika", "Tabiiy fanlar", "Tarbiya", "Texnologiya", "Informatika",
  ]);

  const addClassSubject = (cls: any, subjectName: string, hours: number, tId: number) => {
    const subj = subjectByName.get(subjectName)!;
    classSubjects.push({
      id: csId++, classId: cls.id, subjectId: subj.id, teacherId: tId, teacherId2: null,
      roomId: null, roomId2: null, weeklyHours: hours, isSplit: false, splitType: "none", jointGroupId: null,
    });
    totalWeeklyHours += hours;
  };

  // Sinf o'qituvchilari (boshlang'ich)
  const primaryClasses = classes.filter((c) => Number(c.grade) <= 4);
  for (const cls of primaryClasses) {
    const t = { id: teacherId++, firstName: "O'qituvchi", lastName: `Boshlang'ich ${cls.name}`, employeeId: `T${teacherId}`, maxHoursPerWeek: 30, gradeLevel: "primary", isVacant: false, isActive: true };
    teachers.push(t);
    cls.classTeacherId = t.id;
    for (const plan of SUBJECT_PLAN) {
      const h = plan.hours[Number(cls.grade)];
      if (!h) continue;
      if (PRIMARY_OWN_SUBJECTS.has(plan.name)) addClassSubject(cls, plan.name, h, t.id);
    }
  }

  // Fan o'qituvchilari
  for (const plan of SUBJECT_PLAN) {
    // Shu fanni qaysi sinflar o'qiydi (boshlang'ichda sinf o'qituvchisi olganlari bundan mustasno)
    const targets = classes.filter((c) => {
      const h = plan.hours[Number(c.grade)];
      if (!h) return false;
      if (Number(c.grade) <= 4 && PRIMARY_OWN_SUBJECTS.has(plan.name)) return false;
      return true;
    });
    if (targets.length === 0) continue;

    const totalHours = targets.reduce((sum, c) => sum + plan.hours[Number(c.grade)], 0);
    const teacherCount = Math.max(1, Math.ceil(totalHours / targetLoad));
    const pool = range(1, teacherCount).map((i) => {
      const t = { id: teacherId++, firstName: "O'qituvchi", lastName: `${plan.name} ${i}`, employeeId: `T${teacherId}`, maxHoursPerWeek: 30, gradeLevel: "high", isVacant: false, isActive: true };
      teachers.push(t);
      return t;
    });

    // Sinflarni o'qituvchilarga yuklama bo'yicha taqsimlaymiz (eng bo'sh o'qituvchiga beriladi)
    const load = new Map(pool.map((t) => [t.id, 0]));
    for (const cls of targets) {
      const h = plan.hours[Number(cls.grade)];
      let best = pool[0];
      for (const t of pool) if ((load.get(t.id) ?? 0) < (load.get(best.id) ?? 0)) best = t;
      load.set(best.id, (load.get(best.id) ?? 0) + h);
      addClassSubject(cls, plan.name, h, best.id);
    }
  }

  return { classes, rooms, subjects, teachers, classSubjects, timeSlots, totalWeeklyHours };
}
