import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import jwt from "jsonwebtoken";
import {
  insertSubjectSchema, insertTeacherSchema, insertClassSchema,
  insertRoomSchema, insertTimeSlotSchema, insertScheduleEntrySchema, loginSchema,
  timeSlots, scheduleEntries,
} from "@shared/schema";
import { eq, and } from "drizzle-orm";

const JWT_SECRET = process.env.JWT_SECRET || "maktab-jadval-secret-2024";

function auth(req: any, res: any, next: any) {
  const token = req.headers["authorization"]?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "Avtorizatsiya talab etiladi" });
  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.status(403).json({ message: "Yaroqsiz token" });
    req.user = user;
    next();
  });
}

// ─── DEFAULT TIME SLOTS (Uzbek school schedule) ──────────────────────────────
const DEFAULT_TIME_SLOTS = [
  { period: 1, name: "1-dars", start: "08:00", end: "08:45" },
  { period: 2, name: "2-dars", start: "09:00", end: "09:45" },
  { period: 3, name: "3-dars", start: "10:00", end: "10:45" },
  { period: 4, name: "4-dars", start: "11:00", end: "11:45" },
  { period: 5, name: "5-dars", start: "12:00", end: "12:45" },
  { period: 6, name: "6-dars", start: "13:00", end: "13:45" },
];
const DAYS = [1, 2, 3, 4, 5]; // Mon-Fri
const DAY_NAMES = ["", "Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma"];

async function ensureTimeSlots(): Promise<any[]> {
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

export async function registerRoutes(app: Express): Promise<Server> {
  // ─── AUTH ──────────────────────────────────────────────────────────────────
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { accessCode } = loginSchema.parse(req.body);
      const validCode = await storage.getAccessCodeByCode(accessCode.trim().toUpperCase());
      if (!validCode) return res.status(401).json({ message: "Kirish kodi noto'g'ri" });
      await storage.updateAccessCodeLastUsed(validCode.code);
      const token = jwt.sign(
        { id: validCode.id, code: validCode.code, ownerName: validCode.ownerName, role: validCode.role },
        JWT_SECRET,
        { expiresIn: "24h" }
      );
      const parts = validCode.ownerName.trim().split(" ");
      res.json({
        token,
        user: {
          id: validCode.id,
          firstName: parts[0] || validCode.ownerName,
          lastName: parts.slice(1).join(" ") || "",
          role: validCode.role,
          username: validCode.code,
          email: `${validCode.code.toLowerCase()}@maktab.uz`,
        },
      });
    } catch (e: any) {
      res.status(400).json({ message: "So'rov noto'g'ri formatda" });
    }
  });

  app.get("/api/auth/me", auth, async (req: any, res) => {
    const parts = (req.user.ownerName || "").trim().split(" ");
    res.json({
      id: req.user.id,
      firstName: parts[0] || "Foydalanuvchi",
      lastName: parts.slice(1).join(" ") || "",
      role: req.user.role,
      username: req.user.code,
      email: `${(req.user.code || "").toLowerCase()}@maktab.uz`,
    });
  });

  // ─── DASHBOARD ────────────────────────────────────────────────────────────
  app.get("/api/dashboard/stats", auth, async (_req, res) => {
    try {
      res.json(await storage.getDashboardStats());
    } catch (e) {
      res.status(500).json({ message: "Server xatosi" });
    }
  });

  // ─── SUBJECTS ─────────────────────────────────────────────────────────────
  app.get("/api/subjects", auth, async (_req, res) => {
    res.json(await storage.getSubjects());
  });

  app.post("/api/subjects", auth, async (req, res) => {
    try {
      const body = req.body;
      if (!body.code) {
        body.code = (body.name || "FAN").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8)
          + "_" + Date.now().toString().slice(-4);
      }
      const data = insertSubjectSchema.parse({ ...body, isActive: true });
      res.status(201).json(await storage.createSubject(data));
    } catch (e: any) {
      res.status(400).json({ message: e.message || "Fan qo'shilmadi" });
    }
  });

  app.patch("/api/subjects/:id", auth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const data = insertSubjectSchema.partial().parse(req.body);
      const r = await storage.updateSubject(id, data);
      if (!r) return res.status(404).json({ message: "Fan topilmadi" });
      res.json(r);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.delete("/api/subjects/:id", auth, async (req, res) => {
    const id = parseInt(req.params.id);
    await storage.deleteSubject(id);
    res.status(204).send();
  });

  // ── Bulk create subjects ────────────────────────────────────────────────────
  app.post("/api/subjects/bulk", auth, async (req, res) => {
    try {
      const items: Array<{ name: string; code: string; color: string; weeklyHours: number; requiredRoomType: string; description?: string }> = req.body.subjects;
      if (!Array.isArray(items) || items.length === 0)
        return res.status(400).json({ message: "Fanlar ro'yxati bo'sh" });
      const created = [];
      for (const item of items) {
        const code = item.code + "_" + Date.now().toString().slice(-4) + Math.floor(Math.random()*99);
        const data = insertSubjectSchema.parse({ ...item, code, isActive: true });
        created.push(await storage.createSubject(data));
      }
      res.status(201).json(created);
    } catch (e: any) {
      res.status(400).json({ message: e.message || "Xatolik" });
    }
  });

  // ─── TEACHERS ─────────────────────────────────────────────────────────────
  app.get("/api/teachers", auth, async (_req, res) => {
    res.json(await storage.getTeachers());
  });

  app.post("/api/teachers", auth, async (req, res) => {
    try {
      const body = req.body;
      const nameSlug = `${body.firstName || ""}${body.lastName || ""}`.replace(/\s+/g, "").toUpperCase().slice(0, 6);
      const employeeId = `T_${nameSlug || "NEW"}_${Date.now().toString().slice(-4)}`;
      const data = insertTeacherSchema.parse({
        firstName: body.firstName || "",
        lastName: body.lastName || "",
        employeeId,
        department: body.department || "",
        specialization: body.specialization || "",
        phone: body.phone || null,
        maxHoursPerWeek: body.maxHoursPerWeek || 30,
        isActive: true,
      });
      const teacher = await storage.createTeacher(data);
      if (Array.isArray(body.subjectIds) && body.subjectIds.length > 0) {
        await storage.setTeacherSubjects(teacher.id, body.subjectIds);
      }
      res.status(201).json(teacher);
    } catch (e: any) {
      console.error("[teachers POST]", e);
      res.status(400).json({ message: e.message || "O'qituvchi qo'shilmadi" });
    }
  });

  app.patch("/api/teachers/:id", auth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const body = req.body;
      const data = insertTeacherSchema.partial().parse(body);
      const r = await storage.updateTeacher(id, data);
      if (!r) return res.status(404).json({ message: "O'qituvchi topilmadi" });
      if (Array.isArray(body.subjectIds)) {
        await storage.setTeacherSubjects(id, body.subjectIds);
      }
      res.json(r);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.delete("/api/teachers/:id", auth, async (req, res) => {
    await storage.deleteTeacher(parseInt(req.params.id));
    res.status(204).send();
  });

  // ── Bulk create teachers ────────────────────────────────────────────────────
  app.post("/api/teachers/bulk", auth, async (req, res) => {
    try {
      const items: Array<{ firstName: string; lastName: string; maxHoursPerWeek?: number }> = req.body.teachers;
      if (!Array.isArray(items) || items.length === 0)
        return res.status(400).json({ message: "O'qituvchilar ro'yxati bo'sh" });
      const normalizeName = (firstName: string, lastName: string) =>
        `${firstName} ${lastName}`
          .replace(/\s+/g, " ")
          .trim()
          .toLowerCase();
      const existing = await storage.getTeachers();
      const existingNames = new Set(existing.map(t => normalizeName(t.firstName, t.lastName)));
      const incomingNames = new Set<string>();
      const created = [];
      for (const item of items) {
        const fullName = normalizeName(item.firstName || "", item.lastName || "");
        if (!fullName) {
          return res.status(400).json({ message: "O'qituvchi ismi bo'sh bo'lmasligi kerak" });
        }
        if (incomingNames.has(fullName)) {
          return res.status(400).json({ message: `Takrorlangan o'qituvchi: ${item.firstName} ${item.lastName}`.trim() });
        }
        if (existingNames.has(fullName)) {
          return res.status(400).json({ message: `Bunday o'qituvchi mavjud: ${item.firstName} ${item.lastName}`.trim() });
        }
        incomingNames.add(fullName);
        const slug = `${item.firstName}${item.lastName}`.replace(/\s+/g, "").toUpperCase().slice(0, 6);
        const employeeId = `T_${slug || "NEW"}_${Date.now().toString().slice(-4)}`;
        const data = insertTeacherSchema.parse({
          firstName: item.firstName, lastName: item.lastName, employeeId,
          department: null, specialization: null, phone: null,
          maxHoursPerWeek: item.maxHoursPerWeek || 30, isActive: true,
        });
        created.push(await storage.createTeacher(data));
        existingNames.add(fullName);
      }
      res.status(201).json(created);
    } catch (e: any) {
      res.status(400).json({ message: e.message || "Xatolik" });
    }
  });

  app.get("/api/teachers/:id/subjects", auth, async (req, res) => {
    const teacherId = parseInt(req.params.id);
    res.json(await storage.getTeacherSubjects(teacherId));
  });

  app.put("/api/teachers/:id/subjects", auth, async (req, res) => {
    const teacherId = parseInt(req.params.id);
    const { subjectIds } = req.body;
    await storage.setTeacherSubjects(teacherId, subjectIds || []);
    res.json({ ok: true });
  });

  // ─── TEACHER UNAVAILABILITY ───────────────────────────────────────────────
  app.get("/api/teachers/:id/unavailability", auth, async (req, res) => {
    const teacherId = parseInt(req.params.id);
    res.json(await storage.getTeacherUnavailability(teacherId));
  });

  app.put("/api/teachers/:id/unavailability", auth, async (req, res) => {
    try {
      const teacherId = parseInt(req.params.id);
      const { slots } = req.body; // [{ dayOfWeek, periodNumber }]
      await storage.setTeacherUnavailability(teacherId, slots || []);
      res.json({ ok: true });
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  // ─── CLASSES ──────────────────────────────────────────────────────────────
  app.get("/api/classes", auth, async (_req, res) => {
    res.json(await storage.getClasses());
  });

  app.post("/api/classes", auth, async (req, res) => {
    try {
      const body = req.body;
      const name = body.name || `${body.grade || "1"}${body.section ? "-" + body.section : ""}`;
      const data = insertClassSchema.parse({
        name,
        grade: body.grade || name.split("-")[0] || "1",
        section: body.section || null,
        totalStudents: body.totalStudents || 25,
        isActive: true,
      });
      const cls = await storage.createClass(data);
      if (Array.isArray(body.subjects) && body.subjects.length > 0) {
        await storage.setClassSubjects(cls.id, body.subjects);
      }
      res.status(201).json(cls);
    } catch (e: any) {
      console.error("[classes POST]", e);
      res.status(400).json({ message: e.message || "Sinf qo'shilmadi" });
    }
  });

  app.patch("/api/classes/:id", auth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const body = req.body;
      const data = insertClassSchema.partial().parse(body);
      const r = await storage.updateClass(id, data);
      if (!r) return res.status(404).json({ message: "Sinf topilmadi" });
      if (Array.isArray(body.subjects)) {
        await storage.setClassSubjects(id, body.subjects);
      }
      res.json(r);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.delete("/api/classes/:id", auth, async (req, res) => {
    await storage.deleteClass(parseInt(req.params.id));
    res.status(204).send();
  });

  // ── Bulk create classes ─────────────────────────────────────────────────────
  app.post("/api/classes/bulk", auth, async (req, res) => {
    try {
      const items: Array<{ grade: string; section: string; totalStudents: number }> = req.body.classes;
      if (!Array.isArray(items) || items.length === 0)
        return res.status(400).json({ message: "Sinflar ro'yxati bo'sh" });
      const created = [];
      for (const item of items) {
        const name = `${item.grade}${item.section ? "-" + item.section : ""}`;
        const data = insertClassSchema.parse({ name, grade: item.grade, section: item.section || null, totalStudents: item.totalStudents || 25, isActive: true });
        created.push(await storage.createClass(data));
      }
      res.status(201).json(created);
    } catch (e: any) {
      res.status(400).json({ message: e.message || "Xatolik" });
    }
  });

  app.get("/api/classes/:id/subjects", auth, async (req, res) => {
    res.json(await storage.getClassSubjects(parseInt(req.params.id)));
  });

  app.put("/api/classes/:id/subjects", auth, async (req, res) => {
    const classId = parseInt(req.params.id);
    const { subjects: items } = req.body;
    await storage.setClassSubjects(classId, items || []);
    res.json({ ok: true });
  });

  // ─── ROOMS ────────────────────────────────────────────────────────────────
  app.get("/api/rooms", auth, async (_req, res) => {
    res.json(await storage.getRooms());
  });

  app.post("/api/rooms", auth, async (req, res) => {
    try {
      const body = req.body;
      const roomNumber = body.roomNumber || `R${Date.now().toString().slice(-4)}`;
      const data = insertRoomSchema.parse({
        name: body.name || `Xona ${roomNumber}`,
        roomNumber,
        building: body.building || null,
        floor: body.floor || null,
        capacity: body.capacity || 30,
        roomType: body.roomType || "classroom",
        isActive: true,
      });
      res.status(201).json(await storage.createRoom(data));
    } catch (e: any) {
      res.status(400).json({ message: e.message || "Xona qo'shilmadi" });
    }
  });

  app.patch("/api/rooms/:id", auth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const data = insertRoomSchema.partial().parse(req.body);
      const r = await storage.updateRoom(id, data);
      if (!r) return res.status(404).json({ message: "Xona topilmadi" });
      res.json(r);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.delete("/api/rooms/:id", auth, async (req, res) => {
    await storage.deleteRoom(parseInt(req.params.id));
    res.status(204).send();
  });

  // ── Bulk create rooms ───────────────────────────────────────────────────────
  app.post("/api/rooms/bulk", auth, async (req, res) => {
    try {
      const items: Array<{ name: string; roomNumber: string; capacity: number; roomType: string; building?: string; floor?: string }> = req.body.rooms;
      if (!Array.isArray(items) || items.length === 0)
        return res.status(400).json({ message: "Xonalar ro'yxati bo'sh" });
      const created = [];
      for (const item of items) {
        const data = insertRoomSchema.parse({
          name: item.name, roomNumber: item.roomNumber, building: item.building || null,
          floor: item.floor || null, capacity: item.capacity || 30,
          roomType: item.roomType || "classroom", isActive: true,
        });
        created.push(await storage.createRoom(data));
      }
      res.status(201).json(created);
    } catch (e: any) {
      res.status(400).json({ message: e.message || "Xatolik" });
    }
  });

  // ─── TIME SLOTS ───────────────────────────────────────────────────────────
  app.get("/api/time-slots", auth, async (_req, res) => {
    try {
      const slots = await ensureTimeSlots();
      res.json(slots);
    } catch (e) {
      res.status(500).json({ message: "Server xatosi" });
    }
  });

  app.post("/api/time-slots/reset", auth, async (_req, res) => {
    try {
      await storage.deleteAllTimeSlots();
      const slots = await ensureTimeSlots();
      res.json(slots);
    } catch (e) {
      res.status(500).json({ message: "Server xatosi" });
    }
  });

  app.put("/api/time-slots/periods", auth, async (req, res) => {
    try {
      const periods: Array<{ periodNumber: number; startTime: string; endTime: string }> = req.body.periods;
      if (!Array.isArray(periods) || periods.length === 0)
        return res.status(400).json({ message: "Periods bo'sh bo'lmasligi kerak" });
      await storage.deleteAllTimeSlots();
      const toCreate: any[] = [];
      for (const day of DAYS) {
        for (const p of periods) {
          toCreate.push({
            name: `${DAY_NAMES[day]} ${p.periodNumber}-dars`,
            startTime: p.startTime,
            endTime: p.endTime,
            dayOfWeek: day,
            periodNumber: p.periodNumber,
            isBreak: false,
            isActive: true,
          });
        }
      }
      const created = [];
      for (const s of toCreate) created.push(await storage.createTimeSlot(s));
      res.json(created);
    } catch (e: any) {
      res.status(500).json({ message: e.message || "Server xatosi" });
    }
  });

  // Save full bell schedule (lessons + breaks/lunch) for all days
  app.post("/api/time-slots/save", auth, async (req, res) => {
    try {
      const rowsRaw = req.body.rows;
      if (!Array.isArray(rowsRaw) || rowsRaw.length === 0) {
        return res.status(400).json({ message: "Qatorlar bo'sh bo'lmasligi kerak" });
      }

      const rows = rowsRaw
        .map((row: any) => ({
          type: row.type === "lunch" ? "lunch" : "lesson",
          periodNumber: Number(row.type === "lesson" ? row.periodNumber : 0),
          startTime: String(row.startTime || "").slice(0, 5),
          endTime: String(row.endTime || "").slice(0, 5),
          meta: row.meta === "evening-lunch" ? "evening-lunch" : "day-lunch",
        }))
        .filter((row: any) => row.startTime && row.endTime);

      if (rows.length === 0) {
        return res.status(400).json({ message: "Qatorlar bo'sh bo'lmasligi kerak" });
      }

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

      const created = await storage.getTimeSlots();
      res.json(created);
    } catch (e: any) {
      res.status(500).json({ message: e.message || "Server xatosi" });
    }
  });

  // Individual time-slot CRUD
  app.patch("/api/time-slots/:id", auth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const data = insertTimeSlotSchema.partial().parse(req.body);
      const r = await storage.updateTimeSlot(id, data);
      if (!r) return res.status(404).json({ message: "Topilmadi" });
      res.json(r);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.delete("/api/time-slots/:id", auth, async (req, res) => {
    await storage.deleteTimeSlot(parseInt(req.params.id));
    res.status(204).send();
  });

  // ─── SCHEDULE ENTRIES ─────────────────────────────────────────────────────
  app.get("/api/schedule-entries", auth, async (req, res) => {
    try {
      const { classId, weekStart, teacherId } = req.query;
      let entries: any[];
      if (teacherId && weekStart) {
        entries = await storage.getScheduleEntriesByTeacher(
          parseInt(teacherId as string),
          new Date(weekStart as string)
        );
      } else if (classId) {
        entries = await storage.getScheduleEntriesByClass(parseInt(classId as string));
      } else if (weekStart) {
        entries = await storage.getScheduleEntriesForWeek(new Date(weekStart as string));
      } else {
        entries = await storage.getScheduleEntries();
      }
      res.json(entries);
    } catch (e) {
      res.status(500).json({ message: "Server xatosi" });
    }
  });

  app.post("/api/schedule-entries", auth, async (req, res) => {
    try {
      const data = insertScheduleEntrySchema.parse(req.body);
      res.status(201).json(await storage.createScheduleEntry(data));
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.patch("/api/schedule-entries/:id", auth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const data = insertScheduleEntrySchema.partial().parse(req.body);
      const r = await storage.updateScheduleEntry(id, data);
      if (!r) return res.status(404).json({ message: "Jadval yozuvi topilmadi" });
      res.json(r);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
    }
  });

  app.delete("/api/schedule-entries/:id", auth, async (req, res) => {
    await storage.deleteScheduleEntry(parseInt(req.params.id));
    res.status(204).send();
  });

  app.delete("/api/schedule-entries", auth, async (req, res) => {
    try {
      const { weekStart } = req.query;
      if (weekStart) {
        await storage.clearScheduleForWeek(new Date(weekStart as string));
      } else {
        await db.update(scheduleEntries).set({ isActive: false });
      }
      res.status(204).send();
    } catch (e) {
      res.status(500).json({ message: "Server xatosi" });
    }
  });

  // ─── GENERATE SCHEDULE (Improved Algorithm) ───────────────────────────────
  app.post("/api/generate-schedule", auth, async (req, res) => {
    try {
      const { weekStart, classIds, clearExisting } = req.body;
      if (!weekStart) return res.status(400).json({ message: "weekStart kiritilishi kerak" });

      const weekStartDate = new Date(weekStart);

      if (clearExisting) {
        await storage.clearScheduleForWeek(weekStartDate);
        await storage.clearConflicts();
      }

      const slots = await ensureTimeSlots();
      const activeSlots = slots.filter(s => !s.isBreak);

      const allClasses = await storage.getClasses();
      const allRooms = await storage.getRooms();
      const allClassSubjects = await storage.getAllClassSubjects();
      const allSubjects = await storage.getSubjects();
      const allUnavailability = await storage.getAllTeacherUnavailability();
      const allTeachers = await storage.getTeachers();

      const targetClasses = classIds?.length
        ? allClasses.filter((c: any) => classIds.includes(c.id))
        : allClasses;

      if (targetClasses.length === 0) {
        return res.status(400).json({ message: "Sinflar mavjud emas. Avval sinf qo'shing." });
      }
      if (allRooms.length === 0) {
        return res.status(400).json({ message: "Xonalar mavjud emas. Avval xona qo'shing." });
      }

      // Build teacher unavailability set: `${teacherId}_${dayOfWeek}_${periodNumber}`
      const unavailSet = new Set<string>(
        allUnavailability.map((u: any) => `${u.teacherId}_${u.dayOfWeek}_${u.periodNumber}`)
      );

      // Build teacher workload tracker
      const teacherHoursCount: Record<number, number> = {};
      for (const t of allTeachers) {
        teacherHoursCount[t.id] = 0;
      }

      // Occupancy tracking
      const teacherBusy = new Set<string>(); // `${teacherId}_${slotId}`
      const roomBusy = new Set<string>();    // `${roomId}_${slotId}`
      const classBusy = new Set<string>();   // `${classId}_${slotId}`
      // Track lessons per day per class: `${classId}_${dayOfWeek}` → count
      const classPerDay = new Map<string, number>();
      // Track same subject per day: `${classId}_${subjectId}_${dayOfWeek}` → count
      const subjectPerDay = new Map<string, number>();

      // Load existing entries for this week to populate occupancy
      const existingEntries = await storage.getScheduleEntriesForWeek(weekStartDate);
      for (const e of existingEntries) {
        teacherBusy.add(`${e.teacherId}_${e.timeSlotId}`);
        roomBusy.add(`${e.roomId}_${e.timeSlotId}`);
        classBusy.add(`${e.classId}_${e.timeSlotId}`);
        teacherHoursCount[e.teacherId] = (teacherHoursCount[e.teacherId] || 0) + 1;
      }

      // Group active slots by day
      const slotsByDay: Record<number, any[]> = {};
      for (const s of activeSlots) {
        if (!slotsByDay[s.dayOfWeek]) slotsByDay[s.dayOfWeek] = [];
        slotsByDay[s.dayOfWeek].push(s);
      }
      // Sort each day's slots by period number (early periods first = harder subjects early)
      for (const day of DAYS) {
        slotsByDay[day] = (slotsByDay[day] || []).sort((a: any, b: any) => a.periodNumber - b.periodNumber);
      }

      // Subject lookup map
      const subjectMap = new Map(allSubjects.map((s: any) => [s.id, s]));

      const toCreate: any[] = [];
      const stats: Record<number, { className: string; scheduled: number; total: number }> = {};

      for (const cls of targetClasses) {
        const classSubjectList = allClassSubjects
          .filter((cs: any) => cs.classId === cls.id)
          // Sort by weeklyHours DESC — harder to schedule subjects first (more hours = priority)
          .sort((a: any, b: any) => b.weeklyHours - a.weeklyHours);

        if (classSubjectList.length === 0) continue;

        const totalNeeded = classSubjectList.reduce((s: number, cs: any) => s + cs.weeklyHours, 0);
        stats[cls.id] = { className: cls.name, scheduled: 0, total: totalNeeded };

        for (const cs of classSubjectList) {
          if (!cs.teacherId) continue;

          const subject = subjectMap.get(cs.subjectId);
          const requiredRoomType = subject?.requiredRoomType || "any";
          const needed = cs.weeklyHours;
          let scheduled = 0;

          // Max same subject per day: if weeklyHours >= 5, allow 2; otherwise 1
          const maxSameSubjectPerDay = cs.weeklyHours >= 5 ? 2 : 1;

          // Max lessons per class per day: aim for balanced spread
          const maxPerDay = Math.ceil(needed / 5) + 1; // e.g., 4h/week → max 2/day

          // Teacher max hours check
          const teacher = allTeachers.find((t: any) => t.id === cs.teacherId);
          const teacherMax = teacher?.maxHoursPerWeek || 30;

          // Try to spread across all 5 days, cycling through days
          // Rotate day order to ensure even distribution
          const dayRotations = [
            [1, 2, 3, 4, 5],
            [2, 3, 4, 5, 1],
            [3, 4, 5, 1, 2],
            [4, 5, 1, 2, 3],
            [5, 1, 2, 3, 4],
          ];

          for (let attempt = 0; attempt < 5 && scheduled < needed; attempt++) {
            const dayOrder = dayRotations[attempt % 5];

            for (const day of dayOrder) {
              if (scheduled >= needed) break;

              const daySlots = slotsByDay[day] || [];
              const classDay = `${cls.id}_${day}`;
              const subjectDay = `${cls.id}_${cs.subjectId}_${day}`;

              // Check class daily limit
              const classCount = classPerDay.get(classDay) || 0;
              if (classCount >= 6) continue; // max 6 periods/day/class (hard limit)

              // Check same subject per day limit
              const subjectCount = subjectPerDay.get(subjectDay) || 0;
              if (subjectCount >= maxSameSubjectPerDay) continue;

              for (const slot of daySlots) {
                if (scheduled >= needed) break;

                const tk = `${cs.teacherId}_${slot.id}`;
                const ck = `${cls.id}_${slot.id}`;

                // Hard constraint: teacher busy
                if (teacherBusy.has(tk)) continue;
                // Hard constraint: class busy
                if (classBusy.has(ck)) continue;
                // Hard constraint: teacher unavailability
                if (unavailSet.has(`${cs.teacherId}_${day}_${slot.periodNumber}`)) continue;
                // Soft constraint: teacher max hours
                if ((teacherHoursCount[cs.teacherId] || 0) >= teacherMax) continue;

                // Find best available room
                // Priority 1: matching room type AND sufficient capacity
                // Priority 2: matching room type (any capacity)
                // Priority 3: any available room with sufficient capacity
                // Priority 4: any available room
                let selectedRoom: any = null;

                const classStudents = cls.totalStudents || 25;
                const availableRooms = allRooms.filter((r: any) => !roomBusy.has(`${r.id}_${slot.id}`));

                if (availableRooms.length === 0) continue;

                // Priority 1: type match + capacity
                if (requiredRoomType !== "any") {
                  selectedRoom = availableRooms.find((r: any) =>
                    r.roomType === requiredRoomType && r.capacity >= classStudents
                  );
                  // Priority 2: type match only
                  if (!selectedRoom) {
                    selectedRoom = availableRooms.find((r: any) => r.roomType === requiredRoomType);
                  }
                }
                // Priority 3: capacity match (any type)
                if (!selectedRoom) {
                  selectedRoom = availableRooms.find((r: any) => r.capacity >= classStudents);
                }
                // Priority 4: any available room
                if (!selectedRoom) {
                  selectedRoom = availableRooms[0];
                }

                if (!selectedRoom) continue;

                const rk = `${selectedRoom.id}_${slot.id}`;
                teacherBusy.add(tk);
                classBusy.add(ck);
                roomBusy.add(rk);
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

      // Build per-class result summary
      const classResults = Object.values(stats).map((s: any) => ({
        className: s.className,
        scheduled: s.scheduled,
        total: s.total,
        coverage: s.total > 0 ? Math.round((s.scheduled / s.total) * 100) : 0,
      }));

      const totalNeeded = classResults.reduce((s, r) => s + r.total, 0);
      const totalScheduled = classResults.reduce((s, r) => s + r.scheduled, 0);
      const coverage = totalNeeded > 0 ? Math.round((totalScheduled / totalNeeded) * 100) : 100;

      res.json({
        message: `${created.length} ta dars muvaffaqiyatli jadvallandi (${coverage}% qoplanish)`,
        count: created.length,
        classesScheduled: targetClasses.length,
        coverage,
        classResults,
        warnings: classResults
          .filter((r) => r.coverage < 100)
          .map((r) => `${r.className}: ${r.scheduled}/${r.total} dars jadvallandi`),
      });
    } catch (e: any) {
      console.error("[generate-schedule]", e);
      res.status(500).json({ message: e.message || "Jadval yaratishda xatolik" });
    }
  });

  // ─── SCHEDULE CONFLICTS ───────────────────────────────────────────────────
  app.get("/api/schedule-conflicts", auth, async (_req, res) => {
    res.json(await storage.getUnresolvedConflicts());
  });

  app.post("/api/schedule-conflicts/:id/resolve", auth, async (req, res) => {
    const ok = await storage.resolveConflict(parseInt(req.params.id));
    if (!ok) return res.status(404).json({ message: "Ziddiyat topilmadi" });
    res.status(204).send();
  });

  // ─── ACCESS CODES ─────────────────────────────────────────────────────────
  app.get("/api/access-codes", auth, async (_req, res) => {
    res.json(await storage.getAllAccessCodes());
  });

  app.post("/api/access-codes", auth, async (req, res) => {
    try {
      const { code, ownerName, role } = req.body;
      if (!code || !ownerName) return res.status(400).json({ message: "Kod va egasi nomi kiritilishi kerak" });
      const ac = await storage.createAccessCode({ code: code.toUpperCase(), ownerName, role: role || "teacher", isActive: true });
      res.status(201).json(ac);
    } catch (e: any) {
      res.status(400).json({ message: e.message || "Kod yaratishda xatolik" });
    }
  });

  app.delete("/api/access-codes/:id", auth, async (req, res) => {
    await storage.deleteAccessCode(parseInt(req.params.id));
    res.status(204).send();
  });

  const httpServer = createServer(app);
  return httpServer;
}
