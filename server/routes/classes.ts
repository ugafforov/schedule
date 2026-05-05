import { Hono } from "hono";
import { insertClassSchema, classes } from "@shared/schema";
import { storage } from "../storage/index";
import { authMiddleware } from "../middleware/auth";
import { db } from "../db";
import { autoDistributeAll } from "../services/teacher.service";

export const classRoutes = new Hono()
  .use(authMiddleware)

  .get("/", async (c) => c.json(await storage.getClasses()))

  .post("/", async (c) => {
    const body = await c.req.json();
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
    return c.json(cls, 201);
  })

  .patch("/:id", async (c) => {
    const id = parseInt(c.req.param("id"));
    const body = await c.req.json();
    const data = insertClassSchema.partial().parse(body);
    const result = await storage.updateClass(id, data);
    if (!result) return c.json({ message: "Sinf topilmadi" }, 404);
    if (Array.isArray(body.subjects)) {
      await storage.setClassSubjects(id, body.subjects);
    }
    return c.json(result);
  })

  .delete("/:id", async (c) => {
    await storage.deleteClass(parseInt(c.req.param("id")));
    return c.body(null, 204);
  })

  // Bulk create
  .post("/bulk", async (c) => {
    const { classes: items } = await c.req.json();
    if (!Array.isArray(items) || items.length === 0) {
      return c.json({ message: "Sinflar ro'yxati bo'sh" }, 400);
    }
    const created = [];
    for (const item of items) {
      const name = `${item.grade}${item.section ? "-" + item.section : ""}`;
      const data = insertClassSchema.parse({
        name, grade: item.grade, section: item.section || null,
        totalStudents: item.totalStudents || 25, isActive: true,
      });
      created.push(await storage.createClass(data));
    }
    return c.json(created, 201);
  })

  // Clear all
  .post("/clear-all", async (c) => {
    await db.update(classes).set({ isActive: false });
    return c.json({ message: "Barcha sinflar muvaffaqiyatli tozalandi" });
  })

  // Subjects for a class
  .get("/:id/subjects", async (c) => {
    return c.json(await storage.getClassSubjects(parseInt(c.req.param("id"))));
  })

  .put("/:id/subjects", async (c) => {
    const classId = parseInt(c.req.param("id"));
    const { subjects: items } = await c.req.json();
    await storage.setClassSubjects(classId, items || []);
    return c.json({ ok: true });
  })

  .post("/:id/subjects", async (c) => {
    const id = parseInt(c.req.param("id"));
    const { assignments } = await c.req.json();
    await storage.setClassSubjects(id, assignments);
    return c.json({ message: "Muvaffaqiyatli saqlandi" });
  })

  // Barcha biriktirishlarni tozalash (bo'sh array bilan)
  .delete("/:id/subjects", async (c) => {
    const id = parseInt(c.req.param("id"));
    await storage.setClassSubjects(id, []);
    return c.body(null, 204);
  });
