import { Hono } from "hono";
import { insertScheduleEntrySchema, scheduleEntries } from "@shared/schema";
import { storage } from "../storage/index";
import { authMiddleware } from "../middleware/auth";
import { strictRateLimit } from "../middleware/rateLimit";
import { db } from "../db";
import { sql } from "drizzle-orm";
import { generateSchedule } from "../services/schedule.service";
import { autoDistributeAll, autoDistributeUnassignedOnly, autoDistributeAllForceReassign, autoAssignDtsForClasses } from "../services/teacher.service";

export const scheduleRoutes = new Hono().use(authMiddleware)

  // ─── /api/schedule-entries ─────────────────────────────────────────────────
  .get("/", async (c) => {
    const { classId, teacherId } = c.req.query();
    let entries: any[];
    if (teacherId) {
      entries = await storage.getScheduleEntriesByTeacher(parseInt(teacherId));
    } else if (classId) {
      entries = await storage.getScheduleEntriesByClass(parseInt(classId));
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
  .delete("/", strictRateLimit, async (c) => {
    const { classId } = c.req.query();
    if (classId) {
      await storage.clearScheduleForClass(parseInt(classId));
    } else {
      await db.update(scheduleEntries).set({ isActive: false });
    }
    return c.body(null, 204);
  });

// ─── Alohida routelar (index.ts da to'g'ri URL bilan bog'lanadi) ──────────────

export const generateScheduleRoute = new Hono().use(authMiddleware).use(strictRateLimit)
  .post("/", async (c) => {
    const body = await c.req.json();
    const result = await generateSchedule(body);
    return c.json(result);
  });

export const scheduleConflictsRoute = new Hono().use(authMiddleware)
  .get("/", async (c) => {
    try {
      await db.execute(sql`SELECT * FROM check_schedule_conflicts()`);
    } catch (err) {
      console.error("check_schedule_conflicts error:", err);
    }

    try {
      const allConflicts = await storage.getUnresolvedConflicts();
      return c.json(allConflicts);
    } catch (err) {
      console.error("Fetch conflicts error:", err);
      return c.json([]);
    }
  })
  .post("/:id/resolve", async (c) => {
    const ok = await storage.resolveConflict(parseInt(c.req.param("id")));
    if (!ok) return c.json({ message: "Ziddiyat topilmadi" }, 404);
    return c.body(null, 204);
  });

export const classSubjectsRoute = new Hono().use(authMiddleware).use(strictRateLimit)
  .get("/", async (c) => {
    return c.json(await storage.getAllClassSubjects());
  })
  .post("/auto-distribute-all", async (c) => {
    const result = await autoDistributeAll();
    return c.json(result);
  })
  .post("/auto-distribute-unassigned", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const result = await autoDistributeUnassignedOnly(body.classIds);
    return c.json(result);
  })
  .post("/auto-distribute-force-reassign", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const result = await autoDistributeAllForceReassign(body.classIds);
    return c.json(result);
  })
  .post("/auto-assign-dts", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    if (!Array.isArray(body.classIds) || body.classIds.length === 0) {
      return c.json({ message: "classIds massivi kiritilishi shart" }, 400);
    }
    const result = await autoAssignDtsForClasses(body.classIds);
    return c.json(result);
  })
  .post("/clear-bulk", async (c) => {
    const body = await c.req.json().catch(() => ({}));
    if (!Array.isArray(body.classIds) || body.classIds.length === 0) {
      return c.json({ message: "classIds massivi kiritilishi shart" }, 400);
    }
    for (const id of body.classIds) {
      await storage.setClassSubjects(id, []);
    }
    return c.json({ message: `${body.classIds.length} ta sinf biriktirishlari tozalandi.` });
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
