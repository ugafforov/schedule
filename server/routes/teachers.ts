import { Hono } from "hono";
import { z } from "zod";
import { insertTeacherSchema, teacherSubjects, classSubjects, teachers, classes } from "@shared/schema";
import { storage } from "../storage/index";
import { authMiddleware, requireAdmin } from "../middleware/auth";
import { strictRateLimit } from "../middleware/rateLimit";
import { db } from "../db";
import { eq, and, sql } from "drizzle-orm";
import { autoGenerateTeachers } from "../services/teacher.service";
import { getSpecialty, getCurriculumForGrade } from "../services/curriculum.service";
import { parseGrade, isClassHourSubject } from "@shared/constants";

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
      classHourCount: 0,
      subjects: [],
    });
  }
  for (const cs of allCS) {
    if (!cs.teacherId) continue;
    const entry = teacherMap.get(cs.teacherId);
    if (!entry) continue;
    const sub = allSubjects.find((s) => s.id === cs.subjectId);
    // Sinf soati (Kelajak soati) dars yuklamasiga kirmaydi — alohida sanaladi
    if (sub && isClassHourSubject(sub.name)) {
      entry.classHourCount += cs.weeklyHours;
    } else {
      entry.totalAssignedHours += cs.weeklyHours;
    }
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
  const [allSubjects, allClasses, allTeachers, allClassSubjects, allTeacherSubjects] = await Promise.all([
    storage.getSubjects(),
    storage.getClasses(),
    storage.getTeachers(),
    storage.getAllClassSubjects(),
    db.select().from(teacherSubjects),
  ]);

  const teacherSubjectMap = new Map<number, Set<number>>();
  for (const ts of allTeacherSubjects) {
    if (!teacherSubjectMap.has(ts.teacherId)) teacherSubjectMap.set(ts.teacherId, new Set());
    teacherSubjectMap.get(ts.teacherId)!.add(ts.subjectId);
  }

  const recommendations: any[] = [];
  const OPTIMAL_LOAD_PER_TEACHER = 20; // 1 stavka dars me'yori (20 soat)
  const MAX_LOAD_PER_TEACHER = 24;     // Maksimal chegara (24 soat)
  const RESERVE_FACTOR = 1.15;          // 15% zaxira marjasi

  const specialtyStats = new Map<string, {
    totalHours: number; classCount: number; uniqueClassIds: Set<number>;
    subjectIds: Set<number>; subjectName: string; color: string;
  }>();

  for (const cls of allClasses) {
    const classLang = (cls as any).language || "uz";
    const gradeRequirements = await getCurriculumForGrade(parseGrade(cls.grade), classLang);
    const dtsSubjects = Object.keys(gradeRequirements);
    const subjectsToAnalyze = new Set([
      ...dtsSubjects,
      ...allClassSubjects
        .filter((cs) => cs.classId === cls.id)
        .map((cs) => allSubjects.find((x) => x.id === cs.subjectId)?.name || "")
        .filter(Boolean),
    ]);

    for (const subName of Array.from(subjectsToAnalyze)) {
      // Sinf soati (Kelajak soati) — sinf rahbari o'tadi, o'qituvchi vakansiyasi talab qilmaydi
      if (isClassHourSubject(subName)) continue;
      const subject = allSubjects.find((s) => s.name.toLowerCase() === subName.toLowerCase());
      const specialty = getSpecialty(subName, String(cls.grade), classLang);
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
    const classId = Array.from(stats.uniqueClassIds)[0];
    const targetClass = allClasses.find(c => c.id === classId);
    const language = targetClass ? (targetClass as any).language || "uz" : "uz";

    const existingTeachers = allTeachers.filter((t) => {
      if (!t.isActive) return false;
      const tSpecialty = getSpecialty(t.specialization || "", "5", language);
      if (tSpecialty === specialty) return true;
      if ((t.specialization || "").toLowerCase().includes(specialty.toLowerCase())) return true;
      const assignedSubs = teacherSubjectMap.get(t.id);
      if (assignedSubs && Array.from(stats.subjectIds).some(sid => assignedSubs.has(sid))) return true;
      return false;
    });

    // 20-25 soat dars me'yori (20soat + 15% zaxira marjasi, maksimal 24 soat chegara)
    const totalWithReserve = Math.ceil(stats.totalHours * RESERVE_FACTOR);
    const neededByOptimal = Math.ceil(totalWithReserve / OPTIMAL_LOAD_PER_TEACHER);
    const neededByMaxLimit = Math.ceil(stats.totalHours / MAX_LOAD_PER_TEACHER);

    let neededTeachers = Math.max(neededByOptimal, neededByMaxLimit);
    if (specialty === "Boshlang'ich sinf o'qituvchisi") {
      neededTeachers = Math.max(neededTeachers, stats.uniqueClassIds.size);
    }

    const vacancies = Math.max(0, neededTeachers - existingTeachers.length);
    const roundedHours = Math.round(stats.totalHours * 10) / 10;

    recommendations.push({
      subjectId: Array.from(stats.subjectIds)[0] || 0,
      subjectName: specialty,
      subjectColor: stats.color,
      totalWeeklyHours: roundedHours,
      classCount: stats.uniqueClassIds.size,
      neededTeachers,
      existingTeachers: existingTeachers.length,
      vacancies,
      optimalLoadPerTeacher: OPTIMAL_LOAD_PER_TEACHER,
      maxLoadPerTeacher: MAX_LOAD_PER_TEACHER,
      reservePercent: 15,
      note: vacancies > 0
        ? `Jami ${roundedHours} soat yuklama: 1 ta o'qituvchiga ko'pi bilan 20-24 soat dars (+15% zaxira) me'yorida ${neededTeachers} ta o'qituvchi kerak (${existingTeachers.length} ta mavjud, ${vacancies} ta vakant).`
        : `Yetarli (${existingTeachers.length} ta o'qituvchi mavjud, o'rtacha yuklama: ${Math.round(roundedHours / (existingTeachers.length || 1))} soat/hafta).`,
    });
  }

  return recommendations.sort((a, b) => b.vacancies - a.vacancies || b.totalWeeklyHours - a.totalWeeklyHours);
};

export const teacherRoutes = new Hono()
  .use(authMiddleware)

  // Unavailability for all teachers
  .get("/unavailability", async (c) => {
    return c.json(await storage.getAllTeacherUnavailability());
  })

  // Unavailability for specific teacher
  .get("/:id/unavailability", async (c) => {
    return c.json(await storage.getTeacherUnavailability(parseInt(c.req.param("id"))));
  })

  .post("/:id/unavailability", requireAdmin, async (c) => {
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

  .put("/:id/subjects", requireAdmin, async (c) => {
    const { subjectIds } = await c.req.json();
    await storage.setTeacherSubjects(parseInt(c.req.param("id")), subjectIds || []);
    return c.json({ ok: true });
  })

  .get("/", async (c) => c.json(await storage.getTeachers()))

  .post("/", requireAdmin, async (c) => {
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

  .patch("/:id", requireAdmin, async (c) => {
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

  .delete("/:id", requireAdmin, async (c) => {
    const idParam = c.req.param("id");
    if (idParam === "all") {
      await db.transaction(async (tx) => {
        await tx.update(classes).set({ classTeacherId: null });
        await tx.update(teachers).set({ isActive: false });
      });
      return c.body(null, 204);
    }
    const id = parseInt(idParam);
    if (isNaN(id)) {
      return c.json({ message: "Noto'g'ri ID" }, 400);
    }
    await storage.deleteTeacher(id);
    return c.body(null, 204);
  })

  // Clear all (soft delete)
  .post("/clear-all", requireAdmin, strictRateLimit, async (c) => {
    await db.transaction(async (tx) => {
      await tx.update(classes).set({ classTeacherId: null });
      await tx.update(teachers).set({ isActive: false });
    });
    return c.json({ message: "Barcha o'qituvchilar muvaffaqiyatli tozalandi" });
  })

  // Save (create or update)
  .post("/save", requireAdmin, async (c) => {
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
  .post("/bulk-save", requireAdmin, strictRateLimit, async (c) => {
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
      let specialization = tData.specialization || tData.subjectName || "";
      if (!specialization && tData.subjectId) {
        const sub = await storage.getSubjects().then(subs => subs.find(s => s.id === tData.subjectId));
        if (sub) {
          specialization = getSpecialty(sub.name, "5", "uz");
        }
      }

      const teacher = await storage.createTeacher({
        firstName: tData.firstName,
        lastName: tData.lastName,
        employeeId: tData.employeeId || `T_${Date.now()}_${Math.random().toString(36).slice(-4)}`,
        maxHoursPerWeek: tData.maxHoursPerWeek || 30,
        // bulk-add-dialog.tsx "vakant ro'yxati" rejimida lastName="...vakant..." bilan
        // yuboradi — bu yerda (yagona qo'lda-vakant-yaratish yo'li) flag to'g'ri o'rnatiladi.
        isVacant: /vakant/i.test(tData.lastName) || /vakant/i.test(tData.firstName),
        isActive: true,
        specialization,
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

  // Bulk import (Excel) — qator-darajali xato hisoboti bilan
  .post("/bulk-import", requireAdmin, strictRateLimit, async (c) => {
    const { items } = await c.req.json();
    if (!Array.isArray(items) || items.length === 0) {
      return c.json({ message: "O'qituvchilar ro'yxati bo'sh" }, 400);
    }
    const existing = await storage.getTeachers();
    const errors: Array<{ row: number; message: string }> = [];
    let successCount = 0;
    for (let i = 0; i < items.length; i++) {
      try {
        const item = items[i];
        if (!item.firstName?.trim() || !item.lastName?.trim()) throw new Error("Ism yoki familiya bo'sh");
        const dup = existing.find(
          (t) => t.firstName.toLowerCase() === String(item.firstName).toLowerCase().trim()
            && t.lastName.toLowerCase() === String(item.lastName).toLowerCase().trim()
        );
        if (dup) throw new Error(`"${item.firstName} ${item.lastName}" allaqachon mavjud`);
        const slug = `${item.firstName}${item.lastName}`.replace(/\s+/g, "").toUpperCase().slice(0, 6);
        const data = insertTeacherSchema.parse({
          firstName: String(item.firstName).trim(),
          lastName: String(item.lastName).trim(),
          employeeId: item.employeeId || `T_${slug || "NEW"}_${Date.now().toString().slice(-4)}${i}`,
          department: item.department || "",
          specialization: item.specialization || "",
          phone: item.phone || null,
          maxHoursPerWeek: Number(item.maxHoursPerWeek) || 30,
          gradeLevel: item.gradeLevel === "primary" ? "primary" : "high",
          isActive: true,
        });
        existing.push(await storage.createTeacher(data));
        successCount++;
      } catch (e: any) {
        errors.push({ row: i + 2, message: e.message || "Noma'lum xato" });
      }
    }
    return c.json({ successCount, errors });
  })

  // Auto generate
  .post("/auto-generate", requireAdmin, strictRateLimit, async (c) => {
    const result = await autoGenerateTeachers();
    return c.json(result, 201);
  });
// Eslatma: eski GET /load va /recommendation duplikatlari o'chirildi —
// to'g'ri URLlar /api/teacher-load va /api/teacher-recommendation (quyidagi alohida routerlar).

// ─── Alohida routelar — to'g'ri URL mapping uchun ────────────────────────────
// Frontend: GET /api/teacher-load
export const teacherLoadRoute = new Hono().use(authMiddleware)
  .get("/", async (c) => c.json(await getTeacherLoadLogic()));

// Frontend: GET /api/teacher-recommendation
export const teacherRecommendationRoute = new Hono().use(authMiddleware)
  .get("/", async (c) => c.json(await getTeacherRecommendationLogic()));
