import { Hono } from "hono";
import { z } from "zod";
import { insertTeacherSchema, teacherSubjects, classSubjects, teachers } from "@shared/schema";
import { storage } from "../storage/index";
import { authMiddleware } from "../middleware/auth";
import { db } from "../db";
import { eq, and, sql } from "drizzle-orm";
import { autoGenerateTeachers, autoDistributeAll } from "../services/teacher.service";
import { getSpecialty } from "../services/curriculum.service";
import { UZBEK_CURRICULUM } from "@shared/curriculum";

// Bulk teacher validation schema
const bulkTeacherSchema = z.object({
  teachers: z.array(z.object({
    firstName: z.string().min(1, "Ism kiritilishi kerak"),
    lastName: z.string().min(1, "Familiya kiritilishi kerak"),
    employeeId: z.string().optional(),
    maxHoursPerWeek: z.number().min(1).max(40).optional(),
    specialization: z.string().optional(),
    subjectName: z.string().optional(),
    subjectId: z.number().optional(),
  })).max(100, "Bir vaqtning o'zida 100 ta o'qituvchidan ko'p qo'shib bo'lmaydi"),
});

// ─── Shared Logic for Load and Recommendations ──────────────────────────────
const getTeacherLoadLogic = async () => {
  const [allSubjects, allTeachers, allCS] = await Promise.all([
    storage.getSubjects(),
    storage.getTeachers(),
    storage.getAllClassSubjects(),
  ]);

  type SubEntry = {
    subjectId: number; subjectName: string; subjectColor: string;
    totalClasses: number; totalHours: number; assignedCount: number;
    teachers: Map<number, { teacherId: number; teacherName: string; hours: number; classCount: number }>;
  };
  const subjectMap = new Map<number, SubEntry>();
  for (const cs of allCS) {
    if (!subjectMap.has(cs.subjectId)) {
      const sub = allSubjects.find((s) => s.id === cs.subjectId);
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
      const t = allTeachers.find((x) => x.id === cs.teacherId);
      if (t) {
        const prev = entry.teachers.get(cs.teacherId) || {
          teacherId: cs.teacherId,
          teacherName: `${t.firstName} ${t.lastName}`,
          hours: 0, classCount: 0,
        };
        prev.hours += cs.weeklyHours;
        prev.classCount++;
        entry.teachers.set(cs.teacherId, prev);
      }
    }
  }

  const teacherMap = new Map<number, any>();
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
    const sub = allSubjects.find((s) => s.id === cs.subjectId);
    if (sub && !entry.subjects.includes(sub.name)) entry.subjects.push(sub.name);
  }

  return {
    subjects: Array.from(subjectMap.values())
      .map((s) => ({ ...s, teachers: Array.from(s.teachers.values()) }))
      .sort((a, b) => b.totalHours - a.totalHours),
    teachers: Array.from(teacherMap.values()).sort(
      (a, b) => b.totalAssignedHours - a.totalAssignedHours
    ),
  };
};

const getTeacherRecommendationLogic = async () => {
  const [allSubjects, allClasses, allTeachers, allClassSubjects] = await Promise.all([
    storage.getSubjects(),
    storage.getClasses(),
    storage.getTeachers(),
    storage.getAllClassSubjects(),
  ]);

  const recommendations: any[] = [];
  const MAX_HOURS = 24;
  const specialtyStats = new Map<string, {
    totalHours: number; classCount: number; uniqueClassIds: Set<number>;
    subjectIds: Set<number>; subjectName: string; color: string;
  }>();

  for (const cls of allClasses) {
    const gradeRequirements = UZBEK_CURRICULUM[String(cls.grade)] || {};
    const dtsSubjects = Object.keys(gradeRequirements);
    const subjectsToAnalyze = new Set([
      ...dtsSubjects,
      ...allClassSubjects
        .filter((cs) => cs.classId === cls.id)
        .map((cs) => allSubjects.find((x) => x.id === cs.subjectId)?.name || "")
        .filter(Boolean),
    ]);

    for (const subName of Array.from(subjectsToAnalyze)) {
      const subject = allSubjects.find((s) => s.name.toLowerCase() === subName.toLowerCase());
      const specialty = getSpecialty(subName, String(cls.grade));
      const hours =
        (gradeRequirements as any)[subName] ||
        allClassSubjects.find((cs) => cs.classId === cls.id && cs.subjectId === subject?.id)?.weeklyHours ||
        2;

      if (!specialtyStats.has(specialty)) {
        specialtyStats.set(specialty, {
          totalHours: 0, classCount: 0, uniqueClassIds: new Set(),
          subjectIds: new Set(), subjectName: specialty, color: subject?.color || "#3B82F6",
        });
      }
      const stats = specialtyStats.get(specialty)!;
      stats.totalHours += hours;
      stats.classCount++;
      stats.uniqueClassIds.add(cls.id);
      if (subject) stats.subjectIds.add(subject.id);
    }
  }

  for (const [specialty, stats] of Array.from(specialtyStats.entries())) {
    const existingTeachers = allTeachers.filter(
      (t) =>
        t.isActive &&
        (getSpecialty(t.specialization || "", "5") === specialty ||
          `${t.firstName} ${t.lastName}`.includes(specialty))
    );
    let neededTeachers = Math.ceil(stats.totalHours / MAX_HOURS);
    if (specialty === "Boshlang'ich sinf o'qituvchisi") {
      neededTeachers = Math.max(neededTeachers, stats.uniqueClassIds.size);
    }
    const vacancies = Math.max(0, neededTeachers - existingTeachers.length);
    recommendations.push({
      subjectId: Array.from(stats.subjectIds)[0] || 0,
      subjectName: specialty,
      subjectColor: stats.color,
      totalWeeklyHours: Math.round(stats.totalHours * 10) / 10,
      classCount: stats.uniqueClassIds.size,
      neededTeachers,
      existingTeachers: existingTeachers.length,
      vacancies,
    });
  }

  return recommendations.sort((a, b) => b.vacancies - a.vacancies || b.totalWeeklyHours - a.totalWeeklyHours);
};

export const teacherRoutes = new Hono()
  .use(authMiddleware)

  // Unavailability
  .get("/:id/unavailability", async (c) => {
    return c.json(await storage.getTeacherUnavailability(parseInt(c.req.param("id"))));
  })

  .post("/:id/unavailability", async (c) => {
    const id = parseInt(c.req.param("id"));
    const { slots } = await c.req.json();
    console.log(`[API] Setting unavailability for teacher ${id}:`, slots);
    await storage.setTeacherUnavailability(id, slots || []);
    return c.json({ ok: true });
  })

  // Subjects
  .get("/:id/subjects", async (c) => {
    return c.json(await storage.getTeacherSubjects(parseInt(c.req.param("id"))));
  })

  .put("/:id/subjects", async (c) => {
    const { subjectIds } = await c.req.json();
    await storage.setTeacherSubjects(parseInt(c.req.param("id")), subjectIds || []);
    return c.json({ ok: true });
  })

  .get("/", async (c) => c.json(await storage.getTeachers()))

  .post("/", async (c) => {
    const body = await c.req.json();
    const nameSlug = `${body.firstName || ""}${body.lastName || ""}`
      .replace(/\s+/g, "")
      .toUpperCase()
      .slice(0, 6);
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

      if (body.autoAssignToAllClasses) {
        const firstSubjectId = body.subjectIds[0];
        const allCS = await storage.getAllClassSubjects();
        const assignmentsByClass = new Map<number, any[]>();
        for (const cs of allCS) {
          if (!assignmentsByClass.has(cs.classId)) assignmentsByClass.set(cs.classId, []);
          assignmentsByClass.get(cs.classId)!.push(cs);
        }
        for (const [classId, items] of Array.from(assignmentsByClass.entries())) {
          const updated = items.map((x: any) => ({
            subjectId: x.subjectId,
            teacherId: x.subjectId === firstSubjectId ? teacher.id : x.teacherId,
            weeklyHours: x.weeklyHours,
          }));
          await storage.setClassSubjects(classId, updated);
        }
      }
    }
    return c.json(teacher, 201);
  })

  .patch("/:id", async (c) => {
    const id = parseInt(c.req.param("id"));
    const body = await c.req.json();
    const data = insertTeacherSchema.partial().parse(body);
    const result = await storage.updateTeacher(id, data);
    if (!result) return c.json({ message: "O'qituvchi topilmadi" }, 404);
    if (Array.isArray(body.subjectIds)) {
      await storage.setTeacherSubjects(id, body.subjectIds);
    }
    return c.json(result);
  })

  .delete("/:id", async (c) => {
    await storage.deleteTeacher(parseInt(c.req.param("id")));
    return c.body(null, 204);
  })

  // Clear all (soft delete)
  .post("/clear-all", async (c) => {
    await db.update(teachers).set({ isActive: false });
    return c.json({ message: "Barcha o'qituvchilar muvaffaqiyatli tozalandi" });
  })

  // Save (create or update)
  .post("/save", async (c) => {
    const { id, firstName, lastName, department, specialization, phone, maxHoursPerWeek, subjectIds, unavailSlots, autoAssignToAll, gradeLevel } =
      await c.req.json();

    let teacher: any;
    if (id) {
      teacher = await storage.updateTeacher(id, { firstName, lastName, department, specialization, phone, maxHoursPerWeek, gradeLevel: gradeLevel || "high" });
      if (!teacher) return c.json({ message: "O'qituvchi topilmadi" }, 404);
    } else {
      const slug = `${firstName}${lastName}`.replace(/\s+/g, "").toUpperCase().slice(0, 6);
      const employeeId = `T_${slug || "NEW"}_${Date.now().toString().slice(-4)}`;
      teacher = await storage.createTeacher({
        firstName, lastName, department, specialization, phone,
        maxHoursPerWeek, employeeId, isActive: true, gradeLevel: gradeLevel || "high",
      });
    }

    await storage.setTeacherSubjects(teacher.id, subjectIds || []);

    const slots = (unavailSlots || []).map((key: string) => {
      const [day, period] = key.split("_").map(Number);
      return { dayOfWeek: day, periodNumber: period };
    });
    await storage.setTeacherUnavailability(teacher.id, slots);

    if (!id && autoAssignToAll && subjectIds?.length > 0) {
      const firstSubjectId = subjectIds[0];
      const allClassSubjects = await storage.getAllClassSubjects();
      const targets = allClassSubjects.filter((cs) => cs.subjectId === firstSubjectId);
      for (const t of targets) {
        await db.update(classSubjects).set({ teacherId: teacher.id }).where(eq(classSubjects.id, t.id));
      }
    }

    return c.json(teacher);
  })

  // Bulk save
  .post("/bulk-save", async (c) => {
    const body = await c.req.json();
    const validation = bulkTeacherSchema.safeParse(body);
    if (!validation.success) {
      return c.json({ 
        message: "Validatsiya xatosi", 
        errors: validation.error.errors.map(e => e.message) 
      }, 400);
    }
    const { teachers: teachersData } = validation.data;
    const results = [];
    for (const tData of teachersData) {
      const teacher = await storage.createTeacher({
        firstName: tData.firstName,
        lastName: tData.lastName,
        employeeId: tData.employeeId || `T_${Date.now()}_${Math.random().toString(36).slice(-4)}`,
        maxHoursPerWeek: tData.maxHoursPerWeek || 24,
        isActive: true,
        specialization: tData.specialization || tData.subjectName || "",
      });
      if (tData.subjectId) {
        await db.insert(teacherSubjects).values({ teacherId: teacher.id, subjectId: tData.subjectId });
        await db
          .update(classSubjects)
          .set({ teacherId: teacher.id })
          .where(and(eq(classSubjects.subjectId, tData.subjectId), sql`${classSubjects.teacherId} IS NULL`));
      }
      results.push(teacher);
    }
    return c.json({ message: `${results.length} ta o'qituvchi muvaffaqiyatli qo'shildi`, count: results.length }, 201);
  })

  // Auto generate
  .post("/auto-generate", async (c) => {
    const result = await autoGenerateTeachers();
    return c.json(result, 201);
  })

  // Teacher load analytics
  .get("/load", async (c) => c.json(await getTeacherLoadLogic()))

  // Teacher recommendation
  .get("/recommendation", async (c) => c.json(await getTeacherRecommendationLogic()));

// ─── Alohida routelar — to'g'ri URL mapping uchun ────────────────────────────
// Frontend: GET /api/teacher-load
export const teacherLoadRoute = new Hono().use(authMiddleware)
  .get("/", async (c) => c.json(await getTeacherLoadLogic()));

// Frontend: GET /api/teacher-recommendation
export const teacherRecommendationRoute = new Hono().use(authMiddleware)
  .get("/", async (c) => c.json(await getTeacherRecommendationLogic()));
