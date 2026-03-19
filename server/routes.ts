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
      // Set subject assignments
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

  // ─── SCHEDULE ENTRIES ─────────────────────────────────────────────────────
  app.get("/api/schedule-entries", auth, async (req, res) => {
    try {
      const { classId, weekStart } = req.query;
      let entries: any[];
      if (classId) {
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
        // Clear all
        await db.update(scheduleEntries).set({ isActive: false });
      }
      res.status(204).send();
    } catch (e) {
      res.status(500).json({ message: "Server xatosi" });
    }
  });

  // ─── GENERATE SCHEDULE ────────────────────────────────────────────────────
  app.post("/api/generate-schedule", auth, async (req, res) => {
    try {
      const { weekStart, classIds, clearExisting } = req.body;
      if (!weekStart) return res.status(400).json({ message: "weekStart kiritilishi kerak" });

      const weekStartDate = new Date(weekStart);

      // Clear existing schedule for this week if requested
      if (clearExisting) {
        await storage.clearScheduleForWeek(weekStartDate);
        await storage.clearConflicts();
      }

      // Ensure time slots exist
      const slots = await ensureTimeSlots();
      const activeSlots = slots.filter(s => !s.isBreak);

      // Get all resources
      const allClasses = await storage.getClasses();
      const allRooms = await storage.getRooms();
      const allClassSubjects = await storage.getAllClassSubjects();

      const targetClasses = classIds?.length
        ? allClasses.filter(c => classIds.includes(c.id))
        : allClasses;

      if (targetClasses.length === 0) {
        return res.status(400).json({ message: "Sinflar mavjud emas. Avval sinf qo'shing." });
      }
      if (allRooms.length === 0) {
        return res.status(400).json({ message: "Xonalar mavjud emas. Avval xona qo'shing." });
      }

      // Occupancy tracking: `${teacherId}_${slotId}`, `${roomId}_${slotId}`, `${classId}_${slotId}`
      const teacherBusy = new Set<string>();
      const roomBusy = new Set<string>();
      const classBusy = new Set<string>();

      // Load existing entries for this week to populate occupancy
      const existingEntries = await storage.getScheduleEntriesForWeek(weekStartDate);
      for (const e of existingEntries) {
        teacherBusy.add(`${e.teacherId}_${e.timeSlotId}`);
        roomBusy.add(`${e.roomId}_${e.timeSlotId}`);
        classBusy.add(`${e.classId}_${e.timeSlotId}`);
      }

      const toCreate: any[] = [];

      for (const cls of targetClasses) {
        const subjects = allClassSubjects.filter(cs => cs.classId === cls.id);
        if (subjects.length === 0) continue;

        // Shuffle slots for variety - group by day for good distribution
        const slotsByDay: Record<number, any[]> = {};
        for (const s of activeSlots) {
          if (!slotsByDay[s.dayOfWeek]) slotsByDay[s.dayOfWeek] = [];
          slotsByDay[s.dayOfWeek].push(s);
        }

        for (const cs of subjects) {
          if (!cs.teacherId) continue;
          let scheduled = 0;
          const needed = cs.weeklyHours;

          // Try to spread across all days first
          const dayOrder = [1, 2, 3, 4, 5, 1, 2, 3, 4, 5, 1, 2, 3, 4, 5];

          for (const day of dayOrder) {
            if (scheduled >= needed) break;
            const daySlots = slotsByDay[day] || [];

            for (const slot of daySlots) {
              if (scheduled >= needed) break;

              const tk = `${cs.teacherId}_${slot.id}`;
              const ck = `${cls.id}_${slot.id}`;

              if (teacherBusy.has(tk) || classBusy.has(ck)) continue;

              // Find available room
              const room = allRooms.find(r => !roomBusy.has(`${r.id}_${slot.id}`));
              if (!room) continue;

              const rk = `${room.id}_${slot.id}`;
              teacherBusy.add(tk);
              classBusy.add(ck);
              roomBusy.add(rk);

              toCreate.push({
                classId: cls.id,
                subjectId: cs.subjectId,
                teacherId: cs.teacherId,
                roomId: room.id,
                timeSlotId: slot.id,
                weekStartDate: weekStartDate,
                isActive: true,
              });
              scheduled++;
            }
          }
        }
      }

      const created = await storage.createScheduleEntriesBulk(toCreate);
      res.json({
        message: `${created.length} ta dars muvaffaqiyatli jadvallandi`,
        count: created.length,
        classesScheduled: targetClasses.length,
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
