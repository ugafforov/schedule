import { Hono } from "hono";
import { insertClassSchema, classes } from "@shared/schema";
import { storage } from "../storage/index";
import { authMiddleware, requireAdmin } from "../middleware/auth";
import { strictRateLimit } from "../middleware/rateLimit";
import { db } from "../db";

// Bir o'qituvchi faqat bitta sinfga rahbar bo'la oladi
async function classTeacherConflict(teacherId: number, excludeClassId?: number): Promise<string | null> {
  const all = await storage.getClasses();
  const other = all.find(cl => cl.classTeacherId === teacherId && cl.id !== excludeClassId);
  return other ? `Bu o'qituvchi allaqachon ${other.name} sinfiga rahbar. Bir o'qituvchi faqat bitta sinfga rahbar bo'la oladi.` : null;
}

export const classRoutes = new Hono()
  .use(authMiddleware)

  .get("/", async (c) => c.json(await storage.getClasses()))

  .post("/", requireAdmin, async (c) => {
    const body = await c.req.json();
    if (body.classTeacherId) {
      const conflict = await classTeacherConflict(body.classTeacherId);
      if (conflict) return c.json({ message: conflict }, 400);
    }
    const name = body.name || `${body.grade || "1"}${body.section ? "-" + body.section : ""}`;
    const data = insertClassSchema.parse({
      name,
      grade: body.grade || name.split("-")[0] || "1",
      section: body.section || null,
      language: body.language || "uz",
      totalStudents: body.totalStudents || 25,
      studyDays: body.studyDays || "1,2,3,4,5",
      defaultRoomId: body.defaultRoomId !== undefined ? body.defaultRoomId : null,
      classTeacherId: body.classTeacherId ?? null,
      isActive: true,
    });
    const cls = await storage.createClass(data);
    if (Array.isArray(body.subjects) && body.subjects.length > 0) {
      await storage.setClassSubjects(cls.id, body.subjects);
    }
    return c.json(cls, 201);
  })

  .patch("/:id", requireAdmin, async (c) => {
    const id = parseInt(c.req.param("id"));
    const body = await c.req.json();
    if (body.classTeacherId) {
      const conflict = await classTeacherConflict(body.classTeacherId, id);
      if (conflict) return c.json({ message: conflict }, 400);
    }
    const data = insertClassSchema.partial().parse(body);
    const result = await storage.updateClass(id, data);
    if (!result) return c.json({ message: "Sinf topilmadi" }, 404);
    if (Array.isArray(body.subjects)) {
      await storage.setClassSubjects(id, body.subjects);
    }
    return c.json(result);
  })

  .delete("/:id", requireAdmin, async (c) => {
    await storage.deleteClass(parseInt(c.req.param("id")));
    return c.body(null, 204);
  })

  // Bulk create
  .post("/bulk", requireAdmin, strictRateLimit, async (c) => {
    const { classes: items } = await c.req.json();
    if (!Array.isArray(items) || items.length === 0) {
      return c.json({ message: "Sinflar ro'yxati bo'sh" }, 400);
    }
    const created = [];
    for (const item of items) {
      const name = `${item.grade}${item.section ? "-" + item.section : ""}`;
      const data = insertClassSchema.parse({
        name, 
        grade: item.grade, 
        section: item.section || null,
        language: item.language || "uz",
        totalStudents: item.totalStudents || 25, 
        studyDays: item.studyDays || "1,2,3,4,5",
        isActive: true,
      });
      created.push(await storage.createClass(data));
    }
    return c.json(created, 201);
  })

  // Bulk import (Excel) — qator-darajali xato hisoboti bilan
  .post("/bulk-import", requireAdmin, strictRateLimit, async (c) => {
    const { items } = await c.req.json();
    if (!Array.isArray(items) || items.length === 0) {
      return c.json({ message: "Sinflar ro'yxati bo'sh" }, 400);
    }
    const existing = await storage.getClasses();
    const errors: Array<{ row: number; message: string }> = [];
    let successCount = 0;
    for (let i = 0; i < items.length; i++) {
      try {
        const item = items[i];
        if (!item.grade) throw new Error("Sinf raqami (grade) bo'sh");
        const name = item.name || `${item.grade}${item.section ? "-" + item.section : ""}`;
        const dup = existing.find((cls) => cls.name.toLowerCase() === String(name).toLowerCase());
        if (dup) throw new Error(`"${name}" sinfi allaqachon mavjud`);
        const data = insertClassSchema.parse({
          name,
          grade: String(item.grade),
          section: item.section || null,
          language: item.language || "uz",
          totalStudents: Number(item.totalStudents) || 25,
          studyDays: item.studyDays || "1,2,3,4,5",
          isActive: true,
        });
        existing.push(await storage.createClass(data));
        successCount++;
      } catch (e: any) {
        errors.push({ row: i + 2, message: e.message || "Noma'lum xato" });
      }
    }
    return c.json({ successCount, errors });
  })

  // Bulk update study days
  .post("/bulk-update-study-days", requireAdmin, strictRateLimit, async (c) => {
    const { classIds, studyDays } = await c.req.json();
    if (!Array.isArray(classIds) || classIds.length === 0) {
      return c.json({ message: "Sinflar ro'yxati bo'sh" }, 400);
    }
    const updated = [];
    for (const id of classIds) {
      const result = await storage.updateClass(id, { studyDays });
      if (result) updated.push(result);
    }
    return c.json(updated);
  })

  // Clear all
  .post("/clear-all", requireAdmin, strictRateLimit, async (c) => {
    await db.update(classes).set({ isActive: false });
    return c.json({ message: "Barcha sinflar muvaffaqiyatli tozalandi" });
  })

  // Get all class subjects (for badge display)
  .get("/all/subjects", async (c) => {
    const allClasses = await storage.getClasses();
    const result: Record<number, any[]> = {};
    for (const cls of allClasses) {
      result[cls.id] = await storage.getClassSubjects(cls.id);
    }
    return c.json(result);
  })

  // Subjects for a class
  .get("/:id/subjects", async (c) => {
    return c.json(await storage.getClassSubjects(parseInt(c.req.param("id"))));
  })

  .put("/:id/subjects", requireAdmin, async (c) => {
    const classId = parseInt(c.req.param("id"));
    const { subjects: items } = await c.req.json();
    await storage.setClassSubjects(classId, items || []);
    return c.json({ ok: true });
  })

  .post("/:id/subjects", requireAdmin, async (c) => {
    const id = parseInt(c.req.param("id"));
    const { assignments } = await c.req.json();
    // Filter out invalid assignments on the backend as well to prevent foreign key errors
    const validAssignments = (assignments || []).filter(
      (a: any) => a.subjectId && a.subjectId !== 0
    );
    await storage.setClassSubjects(id, validAssignments);
    return c.json({ message: "Muvaffaqiyatli saqlandi" });
  })

  // Barcha biriktirishlarni tozalash (bo'sh array bilan) — jadval yozuvlari ham
  // tozalanadi, aks holda class_subjects'siz qolgan schedule_entries eskirib qoladi
  .delete("/:id/subjects", requireAdmin, async (c) => {
    const id = parseInt(c.req.param("id"));
    await storage.setClassSubjects(id, []);
    await storage.clearScheduleForClass(id);
    return c.body(null, 204);
  });
