import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import jwt from "jsonwebtoken";
import {
  insertSubjectSchema, insertTeacherSchema, insertClassSchema,
  insertRoomSchema, insertTimeSlotSchema, insertScheduleEntrySchema, loginSchema,
  subjects, teachers, classes, rooms, timeSlots, scheduleEntries, teacherSubjects, classSubjects,
  type Teacher, type Subject, type Class
} from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { UZBEK_CURRICULUM } from "@shared/curriculum";

const JWT_SECRET = process.env.JWT_SECRET || "maktab-jadval-secret-2024";

function auth(req: any, res: any, next: any) {
  const authHeader = req.headers["authorization"];
  const token = authHeader?.split(" ")[1];
  
  if (!token || token === "null" || token === "undefined") {
    return res.status(401).json({ message: "Avtorizatsiya talab etiladi" });
  }

  // 1. Check if it's a plain access code (common in this project)
  storage.getAccessCodeByCode(token.toUpperCase()).then(validCode => {
    if (validCode && validCode.isActive) {
      req.user = { id: validCode.id, code: validCode.code, role: validCode.role };
      return next();
    }

    // 2. Try JWT as fallback
    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
      if (!err) {
        req.user = user;
        return next();
      }
      return res.status(403).json({ message: "Yaroqsiz token yoki kod: " + token.slice(0, 5) + "..." });
    });
  }).catch(() => {
    res.status(403).json({ message: "Server auth xatosi" });
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
      const trimmedCode = accessCode.trim().toUpperCase();
      console.log(`[auth] Login attempt with code: "${trimmedCode}"`);
      const validCode = await storage.getAccessCodeByCode(trimmedCode);
      if (!validCode) {
        console.log(`[auth] Login failed: code "${trimmedCode}" not found or inactive`);
        return res.status(401).json({ message: "Kirish kodi noto'g'ri" });
      }
      console.log(`[auth] Login successful for: ${validCode.ownerName} (${validCode.role})`);
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

  app.post("/api/subjects/clear-all", auth, async (_req, res) => {
    try {
      await db.update(subjects).set({ isActive: false });
      res.json({ message: "Barcha fanlar muvaffaqiyatli tozalandi" });
    } catch (e) {
      res.status(500).json({ message: "Server xatosi" });
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

        // Auto-assign to all classes if requested
        if (body.autoAssignToAllClasses) {
          const firstSubjectId = body.subjectIds[0];
          const allCS = await storage.getAllClassSubjects();
          const assignmentsByClass = new Map<number, any[]>();
          
          // Group existing by classId
          for (const cs of allCS) {
            if (!assignmentsByClass.has(cs.classId)) assignmentsByClass.set(cs.classId, []);
            assignmentsByClass.get(cs.classId)!.push(cs);
          }

          // Update assignments for this subject
          for (const [classId, items] of Array.from(assignmentsByClass.entries())) {
            const updated = items.map(x => ({
              subjectId: x.subjectId,
              teacherId: x.subjectId === firstSubjectId ? teacher.id : x.teacherId,
              weeklyHours: x.weeklyHours
            }));
            await storage.setClassSubjects(classId, updated);
          }
        }
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

  app.post("/api/classes/clear-all", auth, async (_req, res) => {
    try {
      await db.update(classes).set({ isActive: false });
      res.json({ message: "Barcha sinflar muvaffaqiyatli tozalandi" });
    } catch (e) {
      res.status(500).json({ message: "Server xatosi" });
    }
  });

  // ─── TEACHER RECOMMENDATION & AUTO-GEN ─────────────────────────────────────
  app.get("/api/teacher-recommendation", auth, async (_req, res) => {
    try {
      const [allSubjects, allClasses, allTeachers, allClassSubjects] = await Promise.all([
        storage.getSubjects(),
        storage.getClasses(),
        storage.getTeachers(),
        storage.getAllClassSubjects(),
      ]);

      const recommendations: any[] = [];
      const MAX_HOURS = 24;

      // Group requirements by Specialty
      const specialtyStats = new Map<string, {
        totalHours: number;
        classCount: number;
        uniqueClassIds: Set<number>;
        subjectIds: Set<number>;
        subjectName: string;
        color: string;
      }>();

      console.log(`[teacher-recommendation] Curriculum grades: ${Object.keys(UZBEK_CURRICULUM).join(", ")}`);
      for (const cls of allClasses) {
        const gradeKey = String(cls.grade);
        const gradeRequirements = UZBEK_CURRICULUM[gradeKey] || {};
        console.log(`[teacher-recommendation] Class ${cls.name} (grade ${gradeKey}): ${Object.keys(gradeRequirements).length} requirements found`);
        
        // Analyze subjects defined in DTS for this grade
        const dtsSubjects = Object.keys(gradeRequirements);
        const subjectsToAnalyze = new Set([
          ...dtsSubjects,
          ...allClassSubjects.filter(cs => cs.classId === cls.id).map(cs => {
            const s = allSubjects.find(x => x.id === cs.subjectId);
            return s?.name || "";
          }).filter(Boolean)
        ]);

        for (const subName of Array.from(subjectsToAnalyze)) {
          let subject = allSubjects.find(s => s.name.toLowerCase() === subName.toLowerCase());
          
          const specialty = getSpecialty(subName, gradeKey);
          const hours = gradeRequirements[subName] || 
                        allClassSubjects.find(cs => cs.classId === cls.id && cs.subjectId === subject?.id)?.weeklyHours || 2;

          if (!specialtyStats.has(specialty)) {
            specialtyStats.set(specialty, {
              totalHours: 0,
              classCount: 0,
              uniqueClassIds: new Set(),
              subjectIds: new Set(),
              subjectName: specialty,
              color: subject?.color || "#3B82F6"
            });
          }

          const stats = specialtyStats.get(specialty)!;
          stats.totalHours += hours;
          stats.classCount++;
          stats.uniqueClassIds.add(cls.id);
          if (subject) stats.subjectIds.add(subject.id);
        }
      }

      console.log(`[teacher-recommendation] specialtyStats count: ${specialtyStats.size}`);
      for (const [specialty, stats] of Array.from(specialtyStats.entries())) {
        // Count existing teachers who can teach this specialty
        const existingTeachers = allTeachers.filter(t => 
          t.isActive && (getSpecialty(t.specialization || "", "5") === specialty || (t.firstName + " " + t.lastName).includes(specialty))
        );

        let neededTeachers = Math.ceil(stats.totalHours / MAX_HOURS);
        
        // Primary school rule: at least one teacher per unique class
        if (specialty === "Boshlang'ich sinf o'qituvchisi") {
          neededTeachers = Math.max(neededTeachers, stats.uniqueClassIds.size);
        }

        const vacancies = Math.max(0, neededTeachers - existingTeachers.length);
        
        console.log(`[teacher-recommendation] ${specialty}: hours=${stats.totalHours}, needed=${neededTeachers}, existing=${existingTeachers.length}, vacancies=${vacancies}, classes=${stats.uniqueClassIds.size}`);

        recommendations.push({
          subjectId: Array.from(stats.subjectIds)[0] || 0,
          subjectName: specialty,
          subjectColor: stats.color,
          totalWeeklyHours: Math.round(stats.totalHours * 10) / 10,
          classCount: stats.uniqueClassIds.size, // Use unique classes for UI label
          neededTeachers,
          existingTeachers: existingTeachers.length,
          vacancies
        });
      }

      console.log(`[teacher-recommendation] Returning ${recommendations.length} recommendations`);
      res.json(recommendations.sort((a, b) => b.vacancies - a.vacancies || b.totalWeeklyHours - a.totalWeeklyHours));
    } catch (e: any) {
      console.error("[teacher-recommendation]", e);
      res.status(500).json({ message: e.message || "Server xatosi" });
    }
  });

  // ── Auto-generate teachers and assignments based on DTS ──────────────────
  // ── Helper to group subjects by teacher specialty ───────────────────────
  function getSpecialty(subjectName: string, grade: string): string {
    const name = subjectName.toLowerCase().trim();
    const g = parseInt(grade);

    // Primary classes (1-4)
    if (g >= 1 && g <= 4) {
      if (["ona tili", "o'qish savodxonligi", "matematika", "tarbiya", "tabiiy fanlar (science)", "tasviriy san'at", "texnologiya"].includes(name)) {
        return "Boshlang'ich sinf o'qituvchisi";
      }
    }

    // Mathematical sciences
    if (["matematika", "algebra", "geometriya"].includes(name)) {
      return "Matematika";
    }

    // Economics and Entrepreneurship
    if (["iqtisodiy bilim asoslari", "tadbirkorlik asoslari"].includes(name)) {
      return "Iqtisod va tadbirkorlik";
    }

    // Biology and Science
    if (["biologiya", "tabiiy fanlar (science)"].includes(name)) {
      return "Biologiya va Tabiiy fanlar";
    }

    // Language and Literature
    if (["ona tili", "adabiyot"].includes(name)) {
      return "Ona tili va adabiyot";
    }

    // History sciences
    if (["tarix", "o'zbekiston tarixi", "jahon tarixi", "tarixdan hikoyalar", "qadimgi dunyo tarixi"].includes(name)) {
      return "Tarix";
    }

    // Law and Education
    if (["davlat va huquq asoslari", "tarbiya"].includes(name)) {
      return "Huquq va tarbiya";
    }

    // Foreign Languages
    if (["ingliz tili", "nemis tili", "fransuz tili", "chet tili"].includes(name)) {
      return "Chet tili";
    }

    // Natural sciences
    if (["fizika", "astronomiya"].includes(name)) {
      return "Fizika va astronomiya";
    }

    return subjectName.charAt(0).toUpperCase() + subjectName.slice(1);
  }

  // ── Auto-generate teachers and assignments based on DTS ──────────────────
  app.post("/api/teachers/auto-generate", auth, async (_req, res) => {
    try {
      const [allSubjects, allClasses, allTeachers, existingClassSubjects] = await Promise.all([
        storage.getSubjects(),
        storage.getClasses(),
        storage.getTeachers(),
        storage.getAllClassSubjects(),
      ]);

      const updatedAssignmentsByClass = new Map<number, any[]>();
      let createdTeachersCount = 0;

      // 1. Process each class to determine required DTS lessons
      const unassignedBySpecialty = new Map<string, any[]>();

      for (const cls of allClasses) {
        const gradeRequirements = UZBEK_CURRICULUM[cls.grade];
        if (!gradeRequirements) {
          updatedAssignmentsByClass.set(cls.id, existingClassSubjects.filter(cs => cs.classId === cls.id));
          continue;
        }

        const newAssignments: any[] = [];
        const processedSubjectIds = new Set<number>();

        for (const [subjectName, hours] of Object.entries(gradeRequirements)) {
          let subject = allSubjects.find(s => s.name.toLowerCase() === subjectName.toLowerCase());
          
          if (!subject) {
            // Auto-create missing subject
            subject = await storage.createSubject({
              name: subjectName,
              code: subjectName.replace(/\s+/g, "_").toUpperCase(),
              color: "#" + Math.floor(Math.random()*16777215).toString(16),
              isActive: true
            });
            allSubjects.push(subject);
          }

          processedSubjectIds.add(subject.id);
          const specialty = getSpecialty(subjectName, cls.grade);
          
          // Try to keep existing teacher if they match the specialty AND THEY EXIST
          const existing = existingClassSubjects.find(cs => cs.classId === cls.id && cs.subjectId === subject.id);
          let teacherId = existing?.teacherId || null;

          if (teacherId) {
            const t = allTeachers.find(x => x.id === teacherId);
            if (!t) {
              teacherId = null; // Teacher was deleted
            } else {
              const tSpecialty = getSpecialty(t.specialization || "", cls.grade);
              if (tSpecialty !== specialty && t.firstName.toLowerCase().includes("vakant")) {
                // If it's a vacancy and specialty doesn't match, unassign it to allow regrouping
                teacherId = null;
              }
            }
          }

          const entry = {
            classId: cls.id,
            subjectId: subject.id,
            teacherId: teacherId,
            weeklyHours: hours,
            specialty,
            grade: cls.grade
          };

          newAssignments.push(entry);
          if (!teacherId) {
            if (!unassignedBySpecialty.has(specialty)) unassignedBySpecialty.set(specialty, []);
            unassignedBySpecialty.get(specialty)!.push(entry);
          }
        }

        const nonDtsAssignments = existingClassSubjects.filter(cs => cs.classId === cls.id && !processedSubjectIds.has(cs.subjectId));
        updatedAssignmentsByClass.set(cls.id, [...newAssignments, ...nonDtsAssignments]);
      }

      // 2. Fill unassigned lessons by specialty
      const DEFAULT_MAX_HOURS = 24;

      for (const [specialty, assignments] of Array.from(unassignedBySpecialty.entries())) {
        if (assignments.length === 0) continue;

        // Find teachers (real or vacancy) who can teach this specialty
        const matchingTeachers = allTeachers.filter(t => 
          t.isActive && (getSpecialty(t.specialization || "", "5") === specialty || t.firstName.includes(specialty))
        );

        // Sort by current load to fill existing ones first
        for (const teacher of matchingTeachers) {
          let currentLoad = 0;
          // Calculate load from ALL currently planned assignments
          for (const list of Array.from(updatedAssignmentsByClass.values())) {
            for (const a of list) {
              if (a.teacherId === teacher.id) currentLoad += a.weeklyHours;
            }
          }

          // Assign as much as possible to this teacher
          for (let i = 0; i < assignments.length; i++) {
            const a = assignments[i];
            if (currentLoad + a.weeklyHours <= (teacher.maxHoursPerWeek || DEFAULT_MAX_HOURS)) {
              a.teacherId = teacher.id;
              currentLoad += a.weeklyHours;
              assignments.splice(i, 1);
              i--;
            }
          }
        }

        // 3. Create NEW vacancies for remaining unassigned lessons in this specialty
        while (assignments.length > 0) {
          const suffix = createdTeachersCount > 0 ? ` ${createdTeachersCount + 1}` : "";
          const newTeacher = await storage.createTeacher({
            firstName: specialty,
            lastName: `vakant${suffix}`,
            employeeId: `VAK_${specialty.slice(0,3).toUpperCase()}_${Date.now().toString().slice(-4)}_${createdTeachersCount}`,
            department: "Avtomatik",
            specialization: specialty,
            maxHoursPerWeek: DEFAULT_MAX_HOURS,
            isActive: true
          });
          createdTeachersCount++;

          let currentLoad = 0;
          for (let i = 0; i < assignments.length; i++) {
            const a = assignments[i];
            if (currentLoad + a.weeklyHours <= DEFAULT_MAX_HOURS) {
              a.teacherId = newTeacher.id;
              currentLoad += a.weeklyHours;
              assignments.splice(i, 1);
              i--;
            }
          }
        }
      }

      // 4. Final Save
      for (const [classId, items] of Array.from(updatedAssignmentsByClass.entries())) {
        // Remove helper fields before saving
        const toSave = items.map(({ classId, subjectId, teacherId, weeklyHours }) => ({
          classId, subjectId, teacherId, weeklyHours
        }));
        await storage.setClassSubjects(classId, toSave);
      }

      res.status(201).json({
        message: `${createdTeachersCount} ta yangi vakant o'qituvchi yaratildi. Jami darslar DTS asosida yangilandi.`,
        teachersCreated: createdTeachersCount
      });
    } catch (e: any) {
      console.error("[auto-generate]", e);
      res.status(500).json({ message: e.message || "Xatolik" });
    }
  });

  app.post("/api/teachers/bulk-save", auth, async (req, res) => {
    try {
      const { teachers: teachersData } = req.body;
      if (!Array.isArray(teachersData)) {
        return res.status(400).json({ message: "Noto'g'ri ma'lumot formati" });
      }

      const results = [];
      for (const tData of teachersData) {
        const teacher = await storage.createTeacher({
          firstName: tData.firstName,
          lastName: tData.lastName,
          employeeId: tData.employeeId || `T_${Date.now()}_${Math.random().toString(36).slice(-4)}`,
          maxHoursPerWeek: tData.maxHoursPerWeek || 24,
          isActive: true,
          specialization: tData.specialization || tData.subjectName || ""
        });

        if (tData.subjectId) {
          await db.insert(teacherSubjects).values({
            teacherId: teacher.id,
            subjectId: tData.subjectId
          });

          // Also auto-assign to all class subjects that match this subject and have no teacher
          await db.update(classSubjects)
            .set({ teacherId: teacher.id })
            .where(and(
              eq(classSubjects.subjectId, tData.subjectId),
              sql`${classSubjects.teacherId} IS NULL`
            ));
        }
        results.push(teacher);
      }

      res.status(201).json({ message: `${results.length} ta o'qituvchi muvaffaqiyatli qo'shildi`, count: results.length });
    } catch (e: any) {
      console.error("[bulk-save]", e);
      res.status(500).json({ message: e.message || "Server xatosi" });
    }
  });

  app.post("/api/teachers/save", auth, async (req, res) => {
    try {
      const { id, firstName, lastName, department, specialization, phone, maxHoursPerWeek, subjectIds, unavailSlots, autoAssignToAll } = req.body;
      
      let teacher: any;
      if (id) {
        teacher = await storage.updateTeacher(id, { firstName, lastName, department, specialization, phone, maxHoursPerWeek });
        if (!teacher) return res.status(404).json({ message: "O'qituvchi topilmadi" });
      } else {
        const slug = `${firstName}${lastName}`.replace(/\s+/g, "").toUpperCase().slice(0, 6);
        const employeeId = `T_${slug || "NEW"}_${Date.now().toString().slice(-4)}`;
        teacher = await storage.createTeacher({ firstName, lastName, department, specialization, phone, maxHoursPerWeek, employeeId, isActive: true });
      }

      const teacherId = teacher.id;

      // Subjects
      await storage.setTeacherSubjects(teacherId, subjectIds || []);

      // Unavailability
      const slots = (unavailSlots || []).map((key: string) => {
        const [day, period] = key.split("_").map(Number);
        return { dayOfWeek: day, periodNumber: period };
      });
      await storage.setTeacherUnavailability(teacherId, slots);

      // Auto-assign
      if (!id && autoAssignToAll && subjectIds?.length > 0) {
        const firstSubjectId = subjectIds[0];
        const allClassSubjects = await storage.getAllClassSubjects();
        const targets = allClassSubjects.filter(cs => cs.subjectId === firstSubjectId);
        if (targets.length > 0) {
          // This is a bit inefficient but works for now
          for (const t of targets) {
            await db.update(classSubjects).set({ teacherId }).where(eq(classSubjects.id, t.id));
          }
        }
      }

      res.json(teacher);
    } catch (e: any) {
      res.status(400).json({ message: e.message });
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

  // ─── TEACHER LOAD (aggregated analytics) ─────────────────────────────────
  app.get("/api/teacher-load", auth, async (_req, res) => {
    try {
      const [allCS, allTeachers, allSubjects] = await Promise.all([
        storage.getAllClassSubjects(),
        storage.getTeachers(),
        storage.getSubjects(),
      ]);

      // ── Per-subject summary ──────────────────────────────────────────────
      type SubEntry = {
        subjectId: number; subjectName: string; subjectColor: string;
        totalClasses: number; totalHours: number; assignedCount: number;
        teachers: Map<number, { teacherId: number; teacherName: string; hours: number; classCount: number }>;
      };
      const subjectMap = new Map<number, SubEntry>();
      for (const cs of allCS) {
        if (!subjectMap.has(cs.subjectId)) {
          const sub = allSubjects.find(s => s.id === cs.subjectId);
          subjectMap.set(cs.subjectId, {
            subjectId: cs.subjectId,
            subjectName: sub?.name || `Fan #${cs.subjectId}`,
            subjectColor: sub?.color || "#3B82F6",
            totalClasses: 0, totalHours: 0, assignedCount: 0,
            teachers: new Map(),
          });
        }
        const entry = subjectMap.get(cs.subjectId)!;
        entry.totalClasses++;
        entry.totalHours += cs.weeklyHours;
        if (cs.teacherId) {
          entry.assignedCount++;
          const t = allTeachers.find(x => x.id === cs.teacherId);
          if (t) {
            const tId = cs.teacherId;
            const prev = entry.teachers.get(tId) || { teacherId: tId, teacherName: `${t.firstName} ${t.lastName}`, hours: 0, classCount: 0 };
            prev.hours += cs.weeklyHours;
            prev.classCount++;
            entry.teachers.set(tId, prev);
          }
        }
      }

      // ── Per-teacher summary ──────────────────────────────────────────────
      type TEntry = { teacherId: number; teacherName: string; maxHours: number; totalAssignedHours: number; subjects: string[] };
      const teacherMap = new Map<number, TEntry>();
      for (const t of allTeachers) {
        teacherMap.set(t.id, {
          teacherId: t.id,
          teacherName: `${t.firstName} ${t.lastName}`.trim() || `O'qituvchi #${t.id}`,
          maxHours: t.maxHoursPerWeek || 30,
          totalAssignedHours: 0,
          subjects: [],
        });
      }
      for (const cs of allCS) {
        if (!cs.teacherId) continue;
        const entry = teacherMap.get(cs.teacherId);
        if (!entry) continue;
        entry.totalAssignedHours += cs.weeklyHours;
        const sub = allSubjects.find(s => s.id === cs.subjectId);
        if (sub && !entry.subjects.includes(sub.name)) entry.subjects.push(sub.name);
      }

      res.json({
        subjects: Array.from(subjectMap.values())
          .map(s => ({ ...s, teachers: Array.from(s.teachers.values()) }))
          .sort((a, b) => b.totalHours - a.totalHours),
        teachers: Array.from(teacherMap.values())
          .sort((a, b) => b.totalAssignedHours - a.totalAssignedHours),
      });
    } catch (e: any) {
      res.status(500).json({ message: e.message || "Server xatosi" });
    }
  });

  // ─── AUTO DISTRIBUTE ALL ────────────────────────────────────────────────
  app.post("/api/class-subjects/auto-distribute-all", auth, async (_req, res) => {
    try {
      const [allSubjects, allTeachers, allTeacherSubjects, allClassSubjects] = await Promise.all([
        storage.getSubjects(),
        storage.getTeachers(),
        db.select().from(teacherSubjects),
        storage.getAllClassSubjects(),
      ]);

      const teacherSubjectMap = new Map<number, Set<number>>();
      for (const ts of allTeacherSubjects) {
        if (!teacherSubjectMap.has(ts.teacherId)) teacherSubjectMap.set(ts.teacherId, new Set());
        teacherSubjectMap.get(ts.teacherId)!.add(ts.subjectId);
      }

      const teacherLoadMap = new Map<number, number>();
      for (const cs of allClassSubjects) {
        if (cs.teacherId) {
          teacherLoadMap.set(cs.teacherId, (teacherLoadMap.get(cs.teacherId) || 0) + cs.weeklyHours);
        }
      }

      let assignedCount = 0;
      const unassignedCS = allClassSubjects.filter(cs => !cs.teacherId);
      
      for (const cs of unassignedCS) {
        // Find best teacher for this subject
        const candidates = allTeachers.filter(t => {
          const subjects = teacherSubjectMap.get(t.id) || new Set();
          const currentLoad = teacherLoadMap.get(t.id) || 0;
          return subjects.has(cs.subjectId) && currentLoad + cs.weeklyHours <= (t.maxHoursPerWeek || 30);
        });

        if (candidates.length > 0) {
          // Pick teacher with least load
          candidates.sort((a, b) => (teacherLoadMap.get(a.id) || 0) - (teacherLoadMap.get(b.id) || 0));
          const best = candidates[0];
          
          cs.teacherId = best.id;
          teacherLoadMap.set(best.id, (teacherLoadMap.get(best.id) || 0) + cs.weeklyHours);
          assignedCount++;
        }
      }

      // Save all updated assignments
      const assignmentsByClass = new Map<number, any[]>();
      for (const cs of allClassSubjects) {
        if (!assignmentsByClass.has(cs.classId)) assignmentsByClass.set(cs.classId, []);
        assignmentsByClass.get(cs.classId)!.push({
          subjectId: cs.subjectId,
          teacherId: cs.teacherId,
          weeklyHours: cs.weeklyHours
        });
      }

      for (const [classId, items] of Array.from(assignmentsByClass.entries())) {
        await storage.setClassSubjects(classId, items);
      }

      res.json({ message: `${assignedCount} ta dars o'qituvchilarga avtomatik taqsimlandi.`, assignedCount });
    } catch (e: any) {
      console.error("[auto-distribute-all]", e);
      res.status(500).json({ message: e.message || "Xatolik" });
    }
  });

  // ─── BULK ASSIGN teacher to ALL classes that have a given subject ─────────
  app.post("/api/class-subjects/bulk-assign", auth, async (req, res) => {
    try {
      const { subjectId, teacherId } = req.body;
      if (!subjectId) return res.status(400).json({ message: "subjectId kiritilishi kerak" });
      const allCS = await storage.getAllClassSubjects();
      // Group by classId
      const byClass = new Map<number, typeof allCS>();
      for (const cs of allCS) {
        if (!byClass.has(cs.classId)) byClass.set(cs.classId, []);
        byClass.get(cs.classId)!.push(cs);
      }
      let updatedCount = 0;
      for (const entry of Array.from(byClass.entries())) {
        const classId = entry[0];
        const items = entry[1];
        const hasSubject = items.some((x: any) => x.subjectId === subjectId);
        if (!hasSubject) continue;
        const updated = items.map((x: any) => ({
          subjectId: x.subjectId,
          teacherId: x.subjectId === subjectId ? (teacherId ?? null) : x.teacherId,
          weeklyHours: x.weeklyHours,
        }));
        await storage.setClassSubjects(classId, updated);
        updatedCount++;
      }
      res.json({ updated: updatedCount });
    } catch (e: any) {
      res.status(400).json({ message: e.message || "Xatolik" });
    }
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

  app.post("/api/rooms/clear-all", auth, async (_req, res) => {
    try {
      await db.update(rooms).set({ isActive: false });
      res.json({ message: "Barcha xonalar muvaffaqiyatli tozalandi" });
    } catch (e) {
      res.status(500).json({ message: "Server xatosi" });
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

  app.get("/api/dashboard/stats", auth, async (_req, res) => {
    try {
      const [allTeachers, allClasses, allSubjects, allRooms, allScheduled] = await Promise.all([
        storage.getTeachers(),
        storage.getClasses(),
        storage.getSubjects(),
        storage.getRooms(),
        storage.getScheduleEntries(),
      ]);
      res.json({
        totalTeachers: allTeachers.length,
        totalClasses: allClasses.length,
        totalSubjects: allSubjects.length,
        totalRooms: allRooms.length,
        totalScheduled: allScheduled.length,
      });
    } catch (e) {
      res.status(500).json({ message: "Server xatosi" });
    }
  });

  app.get("/api/schedule-conflicts", auth, async (_req, res) => {
    try {
      const conflicts = await db.execute(sql`SELECT * FROM check_schedule_conflicts()`);
      res.json(conflicts.rows);
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

  // ─── CLASS SUBJECTS & TEACHER LOAD ─────────────────────────────────────────
  app.get("/api/classes/:id/subjects", auth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const items = await storage.getClassSubjects(id);
      res.json(items);
    } catch (e) {
      res.status(500).json({ message: "Server xatosi" });
    }
  });

  app.post("/api/classes/:id/subjects", auth, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { assignments } = req.body;
      await storage.setClassSubjects(id, assignments);
      res.json({ message: "Muvaffaqiyatli saqlandi" });
    } catch (e) {
      res.status(500).json({ message: "Saqlashda xatolik" });
    }
  });

  app.get("/api/teacher-load", auth, async (_req, res) => {
    try {
      const [subjects, teachers, classSubs] = await Promise.all([
        storage.getSubjects(),
        storage.getTeachers(),
        storage.getAllClassSubjects()
      ]);

      const teacherMap = new Map<number, any>();
      teachers.forEach(t => teacherMap.set(t.id, {
        teacherId: t.id,
        teacherName: `${t.firstName} ${t.lastName}`,
        maxHours: t.maxHoursPerWeek,
        totalAssignedHours: 0,
        subjects: []
      }));

      const subjectStats = new Map<number, any>();
      subjects.forEach(s => subjectStats.set(s.id, {
        subjectId: s.id,
        subjectName: s.name,
        subjectColor: s.color,
        totalClasses: 0,
        totalHours: 0,
        assignedCount: 0,
        teachers: []
      }));

      classSubs.forEach(cs => {
        const sStat = subjectStats.get(cs.subjectId);
        if (sStat) {
          sStat.totalClasses++;
          sStat.totalHours += cs.weeklyHours;
          if (cs.teacherId) {
            sStat.assignedCount++;
            const t = teachers.find(t => t.id === cs.teacherId);
            if (t) {
              const teacherName = `${t.firstName} ${t.lastName}`;
              const existingT = sStat.teachers.find((x: any) => x.teacherId === t.id);
              if (existingT) {
                existingT.hours += cs.weeklyHours;
                existingT.classCount++;
              } else {
                sStat.teachers.push({ teacherId: t.id, teacherName, hours: cs.weeklyHours, classCount: 1 });
              }
            }
          }
        }
        if (cs.teacherId) {
          const tStat = teacherMap.get(cs.teacherId);
          if (tStat) {
            tStat.totalAssignedHours += cs.weeklyHours;
            const sub = subjects.find(s => s.id === cs.subjectId);
            if (sub && !tStat.subjects.includes(sub.name)) {
              tStat.subjects.push(sub.name);
            }
          }
        }
      });

      res.json({
        subjects: Array.from(subjectStats.values()),
        teachers: Array.from(teacherMap.values())
      });
    } catch (e) {
      res.status(500).json({ message: "Server xatosi" });
    }
  });

  app.post("/api/class-subjects/auto-distribute-all", auth, async (_req, res) => {
    try {
      const [subjects, teachers, classSubs] = await Promise.all([
        storage.getSubjects(),
        storage.getTeachers(),
        storage.getAllClassSubjects()
      ]);

      let count = 0;
      for (const cs of classSubs) {
        if (cs.teacherId) continue; // Skip already assigned

        const sub = subjects.find(s => s.id === cs.subjectId);
        if (!sub) continue;

        // Simple scoring: matching specialty + available hours
        const candidates = teachers
          .map(t => {
            const isMatch = (t.specialization || "").toLowerCase().includes(sub.name.toLowerCase());
            const currentHours = classSubs.filter(x => x.teacherId === t.id).reduce((s, x) => s + x.weeklyHours, 0);
            return { teacher: t, isMatch, currentHours };
          })
          .filter(c => c.isMatch && c.currentHours + cs.weeklyHours <= (c.teacher.maxHoursPerWeek || 30))
          .sort((a, b) => a.currentHours - b.currentHours);

        if (candidates.length > 0) {
          // Update via direct DB or storage call if available
          await db.update(classSubjects).set({ teacherId: candidates[0].teacher.id }).where(eq(classSubjects.id, cs.id));
          count++;
        }
      }

      res.json({ message: `${count} ta dars o'qituvchilarga muvaffaqiyatli taqsimlandi` });
    } catch (e) {
      res.status(500).json({ message: "Taqsimlashda xatolik" });
    }
  });

  app.post("/api/subjects/:id/bulk-assign-teachers", auth, async (req, res) => {
    try {
      const subjectId = parseInt(req.params.id);
      const { teacherId } = req.body;
      await db.update(classSubjects).set({ teacherId }).where(eq(classSubjects.subjectId, subjectId));
      res.json({ message: "Muvaffaqiyatli biriktirildi" });
    } catch (e) {
      res.status(500).json({ message: "Server xatosi" });
    }
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
