import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { insertSubjectSchema, subjects } from "@shared/schema";
import { storage } from "../storage/index";
import { authMiddleware } from "../middleware/auth";
import { db } from "../db";

export const subjectRoutes = new Hono()
  .use(authMiddleware)

  .get("/", async (c) => c.json(await storage.getSubjects()))

  .post("/", async (c) => {
    const body = await c.req.json();
    if (!body.code) {
      body.code =
        (body.name || "FAN").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8) +
        "_" +
        Date.now().toString().slice(-4);
    }
    const data = insertSubjectSchema.parse({ ...body, isActive: true });
    return c.json(await storage.createSubject(data), 201);
  })

  .patch("/:id", async (c) => {
    const id = parseInt(c.req.param("id"));
    const body = await c.req.json();
    const data = insertSubjectSchema.partial().parse(body);
    const result = await storage.updateSubject(id, data);
    if (!result) return c.json({ message: "Fan topilmadi" }, 404);
    return c.json(result);
  })

  .delete("/:id", async (c) => {
    await storage.deleteSubject(parseInt(c.req.param("id")));
    return c.body(null, 204);
  })

  // Bulk create
  .post("/bulk", async (c) => {
    const { subjects: items } = await c.req.json();
    if (!Array.isArray(items) || items.length === 0) {
      return c.json({ message: "Fanlar ro'yxati bo'sh" }, 400);
    }
    const created = [];
    for (const item of items) {
      const code =
        item.code + "_" + Date.now().toString().slice(-4) + Math.floor(Math.random() * 99);
      const data = insertSubjectSchema.parse({ ...item, code, isActive: true });
      created.push(await storage.createSubject(data));
    }
    return c.json(created, 201);
  })

  // Clear all (soft delete)
  .post("/clear-all", async (c) => {
    await db.update(subjects).set({ isActive: false });
    return c.json({ message: "Barcha fanlar muvaffaqiyatli tozalandi" });
  });
