import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import jwt from "jsonwebtoken";
import { db } from "./db";
import { classes, teachers, rooms, scheduleConflicts } from "@shared/schema";
import { eq, count, and } from "drizzle-orm";
import {
  insertSubjectSchema,
  insertTeacherSchema,
  insertClassSchema,
  insertRoomSchema,
  insertTimeSlotSchema,
  insertScheduleEntrySchema,
  loginSchema,
} from "@shared/schema";

const JWT_SECRET = process.env.JWT_SECRET || "maktab-jadval-secret-2024";

function authenticateToken(req: any, res: any, next: any) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ message: "Avtorizatsiya talab etiladi" });
  jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
    if (err) return res.status(403).json({ message: "Yaroqsiz token" });
    req.user = user;
    next();
  });
}

function requireAdmin(req: any, res: any, next: any) {
  if (req.user?.role !== "admin") return res.status(403).json({ message: "Admin huquqi talab etiladi" });
  next();
}

export async function registerRoutes(app: Express): Promise<Server> {
  // ─── AUTH ───────────────────────────────────────────────────────────────────
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { accessCode } = loginSchema.parse(req.body);
      const validCode = await storage.getAccessCodeByCode(accessCode.trim().toUpperCase());
      if (!validCode) {
        return res.status(401).json({ message: "Kirish kodi noto'g'ri" });
      }
      await storage.updateAccessCodeLastUsed(validCode.code);
      const token = jwt.sign(
        { id: validCode.id, code: validCode.code, ownerName: validCode.ownerName, role: validCode.role },
        JWT_SECRET,
        { expiresIn: "24h" }
      );
      const parts = validCode.ownerName.trim().split(" ");
      const user = {
        id: validCode.id,
        firstName: parts[0] || validCode.ownerName,
        lastName: parts.slice(1).join(" ") || "",
        role: validCode.role,
        username: validCode.code,
        email: `${validCode.code.toLowerCase()}@maktab.uz`,
      };
      res.json({ token, user });
    } catch (error: any) {
      console.error("[login]", error);
      res.status(400).json({ message: "So'rov noto'g'ri formatda" });
    }
  });

  app.get("/api/auth/me", authenticateToken, async (req: any, res) => {
    try {
      const parts = (req.user.ownerName || "").trim().split(" ");
      res.json({
        id: req.user.id,
        firstName: parts[0] || "Foydalanuvchi",
        lastName: parts.slice(1).join(" ") || "",
        role: req.user.role,
        username: req.user.code,
        email: `${(req.user.code || "").toLowerCase()}@maktab.uz`,
      });
    } catch (error) {
      res.status(500).json({ message: "Server xatosi" });
    }
  });

  // ─── DASHBOARD ──────────────────────────────────────────────────────────────
  app.get("/api/dashboard/stats", authenticateToken, async (_req, res) => {
    try {
      const stats = await storage.getDashboardStats();
      res.json(stats);
    } catch (error) {
      console.error("[dashboard/stats]", error);
      res.status(500).json({ message: "Server xatosi" });
    }
  });

  // ─── SUBJECTS ───────────────────────────────────────────────────────────────
  app.get("/api/subjects", authenticateToken, async (_req, res) => {
    try {
      res.json(await storage.getSubjects());
    } catch (error) {
      res.status(500).json({ message: "Server xatosi" });
    }
  });

  app.post("/api/subjects", authenticateToken, async (req, res) => {
    try {
      const body = req.body;
      // Auto-generate code from name if not provided
      if (!body.code) {
        body.code = (body.name || "FAN")
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, "")
          .slice(0, 8) + "_" + Date.now().toString().slice(-4);
      }
      const data = insertSubjectSchema.parse({ ...body, isActive: true });
      res.status(201).json(await storage.createSubject(data));
    } catch (error: any) {
      console.error("[subjects POST]", error);
      res.status(400).json({ message: error.message || "Fan qo'shilmadi" });
    }
  });

  app.patch("/api/subjects/:id", authenticateToken, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const data = insertSubjectSchema.partial().parse(req.body);
      const result = await storage.updateSubject(id, data);
      if (!result) return res.status(404).json({ message: "Fan topilmadi" });
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Yangilashda xato" });
    }
  });

  app.delete("/api/subjects/:id", authenticateToken, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const ok = await storage.deleteSubject(id);
      if (!ok) return res.status(404).json({ message: "Fan topilmadi" });
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Server xatosi" });
    }
  });

  // ─── TEACHERS ───────────────────────────────────────────────────────────────
  app.get("/api/teachers", authenticateToken, async (_req, res) => {
    try {
      res.json(await storage.getTeachers());
    } catch (error) {
      res.status(500).json({ message: "Server xatosi" });
    }
  });

  app.post("/api/teachers", authenticateToken, async (req, res) => {
    try {
      const body = req.body;
      // Build employeeId from firstName+lastName if not provided
      const nameSlug = `${body.firstName || ""}${body.lastName || ""}`.replace(/\s+/g, "").toUpperCase().slice(0, 6);
      const employeeId = body.employeeId || `T_${nameSlug}_${Date.now().toString().slice(-4)}`;
      // Build specialization / department display name
      const specialization = body.specialization || body.department || "";
      const data = insertTeacherSchema.parse({
        employeeId,
        department: body.department || "",
        specialization,
        phone: body.phone || null,
        maxHoursPerWeek: body.maxHoursPerWeek || 20,
        isActive: true,
      });
      res.status(201).json(await storage.createTeacher(data));
    } catch (error: any) {
      console.error("[teachers POST]", error);
      res.status(400).json({ message: error.message || "O'qituvchi qo'shilmadi" });
    }
  });

  app.patch("/api/teachers/:id", authenticateToken, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const data = insertTeacherSchema.partial().parse(req.body);
      const result = await storage.updateTeacher(id, data);
      if (!result) return res.status(404).json({ message: "O'qituvchi topilmadi" });
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Yangilashda xato" });
    }
  });

  app.delete("/api/teachers/:id", authenticateToken, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const ok = await storage.deleteTeacher(id);
      if (!ok) return res.status(404).json({ message: "O'qituvchi topilmadi" });
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Server xatosi" });
    }
  });

  // ─── CLASSES ────────────────────────────────────────────────────────────────
  app.get("/api/classes", authenticateToken, async (_req, res) => {
    try {
      res.json(await storage.getClasses());
    } catch (error) {
      res.status(500).json({ message: "Server xatosi" });
    }
  });

  app.post("/api/classes", authenticateToken, async (req, res) => {
    try {
      const body = req.body;
      const name = body.name || `${body.grade || "?"}${body.section ? "-" + body.section : ""}`;
      const grade = body.grade || name.split("-")[0] || "1";
      const data = insertClassSchema.parse({
        name,
        grade,
        section: body.section || null,
        totalStudents: body.totalStudents || 25,
        isActive: true,
      });
      res.status(201).json(await storage.createClass(data));
    } catch (error: any) {
      console.error("[classes POST]", error);
      res.status(400).json({ message: error.message || "Sinf qo'shilmadi" });
    }
  });

  app.patch("/api/classes/:id", authenticateToken, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const data = insertClassSchema.partial().parse(req.body);
      const result = await storage.updateClass(id, data);
      if (!result) return res.status(404).json({ message: "Sinf topilmadi" });
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Yangilashda xato" });
    }
  });

  app.delete("/api/classes/:id", authenticateToken, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const ok = await storage.deleteClass(id);
      if (!ok) return res.status(404).json({ message: "Sinf topilmadi" });
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Server xatosi" });
    }
  });

  // ─── ROOMS ──────────────────────────────────────────────────────────────────
  app.get("/api/rooms", authenticateToken, async (_req, res) => {
    try {
      res.json(await storage.getRooms());
    } catch (error) {
      res.status(500).json({ message: "Server xatosi" });
    }
  });

  app.post("/api/rooms", authenticateToken, async (req, res) => {
    try {
      const body = req.body;
      const roomNumber = body.roomNumber || body.name?.replace(/[^A-Z0-9]/gi, "").slice(0, 6) || `R${Date.now().toString().slice(-4)}`;
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
    } catch (error: any) {
      console.error("[rooms POST]", error);
      res.status(400).json({ message: error.message || "Xona qo'shilmadi" });
    }
  });

  app.patch("/api/rooms/:id", authenticateToken, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const data = insertRoomSchema.partial().parse(req.body);
      const result = await storage.updateRoom(id, data);
      if (!result) return res.status(404).json({ message: "Xona topilmadi" });
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Yangilashda xato" });
    }
  });

  app.delete("/api/rooms/:id", authenticateToken, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const ok = await storage.deleteRoom(id);
      if (!ok) return res.status(404).json({ message: "Xona topilmadi" });
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Server xatosi" });
    }
  });

  // ─── TIME SLOTS ─────────────────────────────────────────────────────────────
  app.get("/api/time-slots", authenticateToken, async (_req, res) => {
    try {
      res.json(await storage.getTimeSlots());
    } catch (error) {
      res.status(500).json({ message: "Server xatosi" });
    }
  });

  app.post("/api/time-slots", authenticateToken, async (req, res) => {
    try {
      const data = insertTimeSlotSchema.parse(req.body);
      res.status(201).json(await storage.createTimeSlot(data));
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Vaqt uyasi qo'shilmadi" });
    }
  });

  // ─── SCHEDULE ENTRIES ───────────────────────────────────────────────────────
  app.get("/api/schedule-entries", authenticateToken, async (req, res) => {
    try {
      const weekStart = req.query.weekStart as string;
      const entries = weekStart
        ? await storage.getScheduleEntriesForWeek(new Date(weekStart))
        : await storage.getScheduleEntries();
      res.json(entries);
    } catch (error) {
      res.status(500).json({ message: "Server xatosi" });
    }
  });

  app.post("/api/schedule-entries", authenticateToken, async (req, res) => {
    try {
      const data = insertScheduleEntrySchema.parse(req.body);
      res.status(201).json(await storage.createScheduleEntry(data));
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Jadval yozuvi qo'shilmadi" });
    }
  });

  app.patch("/api/schedule-entries/:id", authenticateToken, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const data = insertScheduleEntrySchema.partial().parse(req.body);
      const result = await storage.updateScheduleEntry(id, data);
      if (!result) return res.status(404).json({ message: "Jadval yozuvi topilmadi" });
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Yangilashda xato" });
    }
  });

  app.delete("/api/schedule-entries/:id", authenticateToken, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const ok = await storage.deleteScheduleEntry(id);
      if (!ok) return res.status(404).json({ message: "Jadval yozuvi topilmadi" });
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Server xatosi" });
    }
  });

  // ─── SCHEDULE CONFLICTS ─────────────────────────────────────────────────────
  app.get("/api/schedule-conflicts", authenticateToken, async (_req, res) => {
    try {
      res.json(await storage.getUnresolvedConflicts());
    } catch (error) {
      res.status(500).json({ message: "Server xatosi" });
    }
  });

  app.post("/api/schedule-conflicts/:id/resolve", authenticateToken, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const ok = await storage.resolveConflict(id);
      if (!ok) return res.status(404).json({ message: "Ziddiyat topilmadi" });
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Server xatosi" });
    }
  });

  // ─── ACCESS CODES ───────────────────────────────────────────────────────────
  app.get("/api/access-codes", authenticateToken, requireAdmin, async (_req, res) => {
    try {
      res.json(await storage.getAllAccessCodes());
    } catch (error) {
      res.status(500).json({ message: "Server xatosi" });
    }
  });

  app.post("/api/access-codes", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const { code, ownerName, role } = req.body;
      if (!code || !ownerName) return res.status(400).json({ message: "Kod va egasi nomi kiritilishi kerak" });
      const ac = await storage.createAccessCode({ code: code.toUpperCase(), ownerName, role: role || "teacher", isActive: true });
      res.status(201).json(ac);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Kod yaratishda xatolik" });
    }
  });

  app.delete("/api/access-codes/:id", authenticateToken, requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const ok = await storage.deleteAccessCode(id);
      if (!ok) return res.status(404).json({ message: "Kod topilmadi" });
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Server xatosi" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
