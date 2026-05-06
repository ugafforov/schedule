import { storage } from "../storage/index";
import { db } from "../db";
import { scheduleEntries, timeSlots } from "@shared/schema";
import { eq, and } from "drizzle-orm";

const DAYS = [1, 2, 3, 4, 5];
const DAY_NAMES = ["", "Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma"];

const DEFAULT_TIME_SLOTS = [
  { period: 1, name: "1-dars", start: "08:00", end: "08:45" },
  { period: 2, name: "2-dars", start: "09:00", end: "09:45" },
  { period: 3, name: "3-dars", start: "10:00", end: "10:45" },
  { period: 4, name: "4-dars", start: "11:00", end: "11:45" },
  { period: 5, name: "5-dars", start: "12:00", end: "12:45" },
  { period: 6, name: "6-dars", start: "13:00", end: "13:45" },
];

export async function ensureTimeSlots() {
  const existing = await storage.getTimeSlots();
  if (existing.length > 0) return existing;

  const toCreate: any[] = [];
  for (const day of DAYS) {
    for (const slot of DEFAULT_TIME_SLOTS) {
      toCreate.push({
        name: `${DAY_NAMES[day]} ${slot.name}`,
        startTime: slot.start,
        endTime: slot.end,
        dayOfWeek: day,
        periodNumber: slot.period,
        isBreak: false,
        isActive: true,
      });
    }
  }
  const created = [];
  for (const s of toCreate) {
    created.push(await storage.createTimeSlot(s));
  }
  return created;
}

export interface GenerateScheduleOptions {
  weekStart: string;
  classIds?: number[];
  clearExisting?: boolean;
}

export async function generateSchedule(options: GenerateScheduleOptions) {
  const { weekStart, classIds, clearExisting } = options;
  const weekStartDate = new Date(weekStart);

  if (clearExisting) {
    await storage.clearScheduleForWeek(weekStartDate);
    await storage.clearConflicts();
  }

  const slots = await ensureTimeSlots();
  const activeSlots = slots.filter((s) => !s.isBreak);

  const [allClasses, allRooms, allClassSubjects, allSubjects, allUnavailability, allTeachers] =
    await Promise.all([
      storage.getClasses(),
      storage.getRooms(),
      storage.getAllClassSubjects(),
      storage.getSubjects(),
      storage.getAllTeacherUnavailability(),
      storage.getTeachers(),
    ]);

  const targetClasses = classIds?.length
    ? allClasses.filter((c) => classIds.includes(c.id))
    : allClasses;

  if (targetClasses.length === 0) throw new Error("Sinflar mavjud emas. Avval sinf qo'shing.");
  if (allRooms.length === 0) throw new Error("Xonalar mavjud emas. Avval xona qo'shing.");

  const unavailSet = new Set<string>(
    allUnavailability.map((u) => `${u.teacherId}_${u.dayOfWeek}_${u.periodNumber}`)
  );

  const teacherHoursCount: Record<number, number> = {};
  for (const t of allTeachers) teacherHoursCount[t.id] = 0;

  const teacherBusy = new Set<string>();
  const roomBusy = new Set<string>();
  const classBusy = new Set<string>();
  const classPerDay = new Map<string, number>();
  const subjectPerDay = new Map<string, number>();

  const existingEntries = await storage.getScheduleEntriesForWeek(weekStartDate);
  for (const e of existingEntries) {
    teacherBusy.add(`${e.teacherId}_${e.timeSlotId}`);
    roomBusy.add(`${e.roomId}_${e.timeSlotId}`);
    classBusy.add(`${e.classId}_${e.timeSlotId}`);
    teacherHoursCount[e.teacherId] = (teacherHoursCount[e.teacherId] || 0) + 1;
  }

  const slotsByDay: Record<number, typeof activeSlots> = {};
  for (const s of activeSlots) {
    if (!slotsByDay[s.dayOfWeek]) slotsByDay[s.dayOfWeek] = [];
    slotsByDay[s.dayOfWeek].push(s);
  }
  for (const day of DAYS) {
    slotsByDay[day] = (slotsByDay[day] || []).sort((a, b) => a.periodNumber - b.periodNumber);
  }

  const subjectMap = new Map(allSubjects.map((s) => [s.id, s]));
  const toCreate: any[] = [];
  const stats: Record<number, { className: string; scheduled: number; total: number }> = {};

  const dayRotations = [
    [1, 2, 3, 4, 5],
    [2, 3, 4, 5, 1],
    [3, 4, 5, 1, 2],
    [4, 5, 1, 2, 3],
    [5, 1, 2, 3, 4],
  ];

  for (const cls of targetClasses) {
    const classSubjectList = allClassSubjects
      .filter((cs) => cs.classId === cls.id)
      .sort((a, b) => b.weeklyHours - a.weeklyHours);

    if (classSubjectList.length === 0) continue;

    const totalNeeded = classSubjectList.reduce((s, cs) => s + cs.weeklyHours, 0);
    stats[cls.id] = { className: cls.name, scheduled: 0, total: totalNeeded };

    for (const cs of classSubjectList) {
      if (!cs.teacherId) continue;

      const subject = subjectMap.get(cs.subjectId);
      const requiredRoomType = subject?.requiredRoomType || "any";
      const needed = cs.weeklyHours;
      let scheduled = 0;

      const maxSameSubjectPerDay = cs.weeklyHours >= 5 ? 2 : 1;
      const maxPerDay = Math.ceil(needed / 5) + 1;
      const teacher = allTeachers.find((t) => t.id === cs.teacherId);
      if (!teacher) continue;
      const teacherMax = teacher.maxHoursPerWeek || 30;

      for (let attempt = 0; attempt < 5 && scheduled < needed; attempt++) {
        const dayOrder = dayRotations[attempt % 5];

        for (const day of dayOrder) {
          if (scheduled >= needed) break;

          const daySlots = slotsByDay[day] || [];
          const classDay = `${cls.id}_${day}`;
          const subjectDay = `${cls.id}_${cs.subjectId}_${day}`;

          if ((classPerDay.get(classDay) || 0) >= 6) continue;
          if ((subjectPerDay.get(subjectDay) || 0) >= maxSameSubjectPerDay) continue;

          for (const slot of daySlots) {
            if (scheduled >= needed) break;

            const tk = `${cs.teacherId}_${slot.id}`;
            const ck = `${cls.id}_${slot.id}`;

            if (teacherBusy.has(tk)) continue;
            if (classBusy.has(ck)) continue;
            if (unavailSet.has(`${cs.teacherId}_${day}_${slot.periodNumber}`)) continue;
            if ((teacherHoursCount[cs.teacherId] || 0) >= teacherMax) continue;

            const classStudents = cls.totalStudents || 25;
            const availableRooms = allRooms.filter((r) => !roomBusy.has(`${r.id}_${slot.id}`));
            if (availableRooms.length === 0) continue;

            let selectedRoom =
              requiredRoomType !== "any"
                ? (availableRooms.find((r) => r.roomType === requiredRoomType && r.capacity >= classStudents) ??
                  availableRooms.find((r) => r.roomType === requiredRoomType))
                : null;

            selectedRoom ??=
              availableRooms.find((r) => r.capacity >= classStudents) ?? availableRooms[0];

            if (!selectedRoom) continue;

            teacherBusy.add(tk);
            classBusy.add(ck);
            roomBusy.add(`${selectedRoom.id}_${slot.id}`);
            teacherHoursCount[cs.teacherId] = (teacherHoursCount[cs.teacherId] || 0) + 1;
            classPerDay.set(classDay, (classPerDay.get(classDay) || 0) + 1);
            subjectPerDay.set(subjectDay, (subjectPerDay.get(subjectDay) || 0) + 1);

            toCreate.push({
              classId: cls.id,
              subjectId: cs.subjectId,
              teacherId: cs.teacherId,
              roomId: selectedRoom.id,
              timeSlotId: slot.id,
              weekStartDate: weekStartDate,
              isActive: true,
            });
            scheduled++;
            stats[cls.id].scheduled++;
          }
        }
      }
    }
  }

  const created = await storage.createScheduleEntriesBulk(toCreate);

  const classResults = Object.values(stats).map((s) => ({
    className: s.className,
    scheduled: s.scheduled,
    total: s.total,
    coverage: s.total > 0 ? Math.round((s.scheduled / s.total) * 100) : 0,
  }));

  const totalNeeded = classResults.reduce((s, r) => s + r.total, 0);
  const totalScheduled = classResults.reduce((s, r) => s + r.scheduled, 0);
  const coverage = totalNeeded > 0 ? Math.round((totalScheduled / totalNeeded) * 100) : 100;

  return {
    message: `${created.length} ta dars muvaffaqiyatli jadvallandi (${coverage}% qoplanish)`,
    count: created.length,
    classesScheduled: targetClasses.length,
    coverage,
    classResults,
    warnings: classResults
      .filter((r) => r.coverage < 100)
      .map((r) => `${r.className}: ${r.scheduled}/${r.total} dars jadvallandi`),
  };
}

export async function saveTimeSlotsFromRows(rowsRaw: any[]) {
  const rows = rowsRaw
    .map((row: any) => ({
      type: row.type === "lunch" ? "lunch" : "lesson",
      periodNumber: Number(row.type === "lesson" ? row.periodNumber : 0),
      startTime: String(row.startTime || "").slice(0, 5),
      endTime: String(row.endTime || "").slice(0, 5),
      meta: row.meta === "evening-lunch" ? "evening-lunch" : "day-lunch",
    }))
    .filter((row: any) => row.startTime && row.endTime);

  if (rows.length === 0) throw new Error("Qatorlar bo'sh bo'lmasligi kerak");

  const toCreate = DAYS.flatMap((day) =>
    rows.map((row) => ({
      name:
        row.type === "lesson"
          ? `${DAY_NAMES[day]} ${row.periodNumber}-dars`
          : row.meta === "evening-lunch"
            ? `${DAY_NAMES[day]} Kechki tushlik`
            : `${DAY_NAMES[day]} Tushlik tanaffusi`,
      startTime: row.startTime,
      endTime: row.endTime,
      dayOfWeek: day,
      periodNumber: row.type === "lesson" ? row.periodNumber : 0,
      isBreak: row.type === "lunch",
      isActive: true,
    }))
  );

  await db.transaction(async (tx) => {
    await tx.update(scheduleEntries).set({ isActive: false }).where(eq(scheduleEntries.isActive, true));
    await tx.update(timeSlots).set({ isActive: false }).where(eq(timeSlots.isActive, true));
    await tx.insert(timeSlots).values(toCreate);
  });

  return storage.getTimeSlots();
}
