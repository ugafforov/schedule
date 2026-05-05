import { Hono } from "hono";
import { insertScheduleEntrySchema, scheduleEntries } from "@shared/schema";
import { storage } from "../storage/index";
import { authMiddleware } from "../middleware/auth";
import { db } from "../db";
import { eq, sql } from "drizzle-orm";
import { generateSchedule } from "../services/schedule.service";
import { autoDistributeAll } from "../services/teacher.service";

export const scheduleRoutes = new Hono().use(authMiddleware)

  // ─── /api/schedule-entries ─────────────────────────────────────────────────
  .get("/", async (c) => {
    const { classId, weekStart, teacherId } = c.req.query();
    let entries: any[];
    if (teacherId && weekStart) {
      entries = await storage.getScheduleEntriesByTeacher(parseInt(teacherId), new Date(weekStart));
    } else if (classId) {
      entries = await storage.getScheduleEntriesByClass(parseInt(classId));
    } else if (weekStart) {
      entries = await storage.getScheduleEntriesForWeek(new Date(weekStart));
    } else {
      entries = await storage.getScheduleEntries();
    }
    return c.json(entries);
  })
  .post("/", async (c) => {
    const data = insertScheduleEntrySchema.parse(await c.req.json());
    return c.json(await storage.createScheduleEntry(data), 201);
  })
  .patch("/:id", async (c) => {
    const id = parseInt(c.req.param("id"));
    const data = insertScheduleEntrySchema.partial().parse(await c.req.json());
    const result = await storage.updateScheduleEntry(id, data);
    if (!result) return c.json({ message: "Jadval yozuvi topilmadi" }, 404);
    return c.json(result);
  })
  .delete("/:id", async (c) => {
    await storage.deleteScheduleEntry(parseInt(c.req.param("id")));
    return c.body(null, 204);
  })
  .delete("/", async (c) => {
    const { weekStart } = c.req.query();
    if (weekStart) {
      await storage.clearScheduleForWeek(new Date(weekStart));
    } else {
      await db.update(scheduleEntries).set({ isActive: false });
    }
    return c.body(null, 204);
  });

// ─── Alohida routelar (index.ts da to'g'ri URL bilan bog'lanadi) ──────────────

export const generateScheduleRoute = new Hono().use(authMiddleware)
  .post("/", async (c) => {
    const body = await c.req.json();
    if (!body.weekStart) return c.json({ message: "weekStart kiritilishi kerak" }, 400);
    const result = await generateSchedule(body);
    return c.json(result);
  });

export const scheduleConflictsRoute = new Hono().use(authMiddleware)
  .get("/", async (c) => {
    try {
      const result = await db.execute(sql`SELECT * FROM check_schedule_conflicts()`);
      return c.json(result.rows);
    } catch {
      return c.json(await storage.getUnresolvedConflicts());
    }
  })
  .post("/:id/resolve", async (c) => {
    const ok = await storage.resolveConflict(parseInt(c.req.param("id")));
    if (!ok) return c.json({ message: "Ziddiyat topilmadi" }, 404);
    return c.body(null, 204);
  });

export const classSubjectsRoute = new Hono().use(authMiddleware)
  .post("/auto-distribute-all", async (c) => {
    const result = await autoDistributeAll();
    return c.json(result);
  })
  .post("/bulk-assign", async (c) => {
    const { subjectId, teacherId } = await c.req.json();
    if (!subjectId) return c.json({ message: "subjectId kiritilishi kerak" }, 400);

    const allCS = await storage.getAllClassSubjects();
    const byClass = new Map<number, typeof allCS>();
    for (const cs of allCS) {
      if (!byClass.has(cs.classId)) byClass.set(cs.classId, []);
      byClass.get(cs.classId)!.push(cs);
    }

    let updatedCount = 0;
    for (const [classId, items] of Array.from(byClass.entries())) {
      if (!items.some((x) => x.subjectId === subjectId)) continue;
      const updated = items.map((x) => ({
        subjectId: x.subjectId,
        teacherId: x.subjectId === subjectId ? (teacherId ?? null) : x.teacherId,
        weeklyHours: x.weeklyHours,
      }));
      await storage.setClassSubjects(classId, updated);
      updatedCount++;
    }
    return c.json({ updated: updatedCount });
  });
