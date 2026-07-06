import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { insertSubjectSchema, subjects } from "@shared/schema";
import { storage } from "../storage/index";
import { authMiddleware, requireAdmin } from "../middleware/auth";
import { strictRateLimit } from "../middleware/rateLimit";
import { db } from "../db";

export const subjectRoutes = new Hono()
  .use(authMiddleware)

  .get("/", async (c) => c.json(await storage.getSubjects()))

  .post("/", requireAdmin, async (c) => {
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

  .patch("/:id", requireAdmin, async (c) => {
    const id = parseInt(c.req.param("id"));
    const body = await c.req.json();
    const data = insertSubjectSchema.partial().parse(body);
    const result = await storage.updateSubject(id, data);
    if (!result) return c.json({ message: "Fan topilmadi" }, 404);
    return c.json(result);
  })

  .delete("/:id", requireAdmin, async (c) => {
    await storage.deleteSubject(parseInt(c.req.param("id")));
    return c.body(null, 204);
  })

  // Bulk create
  .post("/bulk", requireAdmin, strictRateLimit, async (c) => {
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

  // Bulk import (Excel) — qator-darajali xato hisoboti bilan
  .post("/bulk-import", requireAdmin, strictRateLimit, async (c) => {
    const { items } = await c.req.json();
    if (!Array.isArray(items) || items.length === 0) {
      return c.json({ message: "Fanlar ro'yxati bo'sh" }, 400);
    }
    const existing = await storage.getSubjects();
    const errors: Array<{ row: number; message: string }> = [];
    let successCount = 0;
    for (let i = 0; i < items.length; i++) {
      try {
        const item = items[i];
        if (!item.name?.trim()) throw new Error("Fan nomi bo'sh");
        const dup = existing.find((s) => s.name.toLowerCase() === String(item.name).toLowerCase());
        if (dup) throw new Error(`"${item.name}" allaqachon mavjud`);
        const code = item.code?.trim()
          ? `${item.code}_${Date.now().toString().slice(-4)}${i}`
          : String(item.name).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8) + "_" + Date.now().toString().slice(-4) + i;
        const data = insertSubjectSchema.parse({
          name: item.name, code,
          description: item.description || "",
          color: item.color || "#1976D2",
          weeklyHours: Number(item.weeklyHours) || 2,
          isActive: true,
        });
        existing.push(await storage.createSubject(data));
        successCount++;
      } catch (e: any) {
        errors.push({ row: i + 2, message: e.message || "Noma'lum xato" }); // +2: Excel sarlavha qatori
      }
    }
    return c.json({ successCount, errors });
  })

  // Clear all (soft delete)
  .post("/clear-all", requireAdmin, strictRateLimit, async (c) => {
    await db.update(subjects).set({ isActive: false });
    return c.json({ message: "Barcha fanlar muvaffaqiyatli tozalandi" });
  });
