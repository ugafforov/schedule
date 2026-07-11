import { Hono } from "hono";
import { insertScheduleEntrySchema, scheduleEntries, scheduleConflicts } from "@shared/schema";
import { storage } from "../storage/index";
import { authMiddleware, requireAdmin } from "../middleware/auth";
import { strictRateLimit } from "../middleware/rateLimit";
import { db } from "../db";
import { sql, eq } from "drizzle-orm";
import { generateSchedule, checkFeasibility } from "../services/schedule.service";
import { getMaxHoursPerDay } from "@shared/constants";
import { autoDistributeUnassignedOnly, autoDistributeAllForceReassign, autoAssignDtsForClasses } from "../services/teacher.service";

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
  .delete("/", requireAdmin, strictRateLimit, async (c) => {
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
  .post("/", requireAdmin, async (c) => {
    const body = await c.req.json();
    const result = await generateSchedule(body);
    return c.json(result);
  });

export const checkFeasibilityRoute = new Hono().use(authMiddleware)
  .post("/", requireAdmin, async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const [allClasses, allClassSubjects, allTeachers, allRooms, allSubjects, allUnavailability, allSlots] =
      await Promise.all([
        storage.getClasses(), storage.getAllClassSubjects(), storage.getTeachers(),
        storage.getRooms(), storage.getSubjects(), storage.getAllTeacherUnavailability(),
        storage.getTimeSlots(),
      ]);
    const classes = body.classIds?.length
      ? allClasses.filter((c: any) => body.classIds.includes(c.id))
      : allClasses;
    const activePerDay = new Set(allSlots.filter((s: any) => !s.isBreak && Number(s.dayOfWeek) === 1).map((s: any) => s.periodNumber)).size
      || allSlots.filter((s: any) => !s.isBreak && Number(s.dayOfWeek) === (allSlots[0]?.dayOfWeek ?? 1)).length;
    const result = checkFeasibility(classes, allClassSubjects, allTeachers, allRooms, allSubjects, allUnavailability, activePerDay);
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
      const allConflicts = await db
        .select({
          id: scheduleConflicts.id,
          conflictType: scheduleConflicts.conflictType,
          description: scheduleConflicts.description,
          scheduleEntry1Id: scheduleConflicts.scheduleEntry1Id,
          scheduleEntry2Id: scheduleConflicts.scheduleEntry2Id,
          severity: scheduleConflicts.severity,
          isResolved: scheduleConflicts.isResolved,
          classId: scheduleEntries.classId,
          teacherId: scheduleEntries.teacherId,
        })
        .from(scheduleConflicts)
        .leftJoin(scheduleEntries, eq(scheduleConflicts.scheduleEntry1Id, scheduleEntries.id))
        .where(eq(scheduleConflicts.isResolved, false));
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
  // Eslatma: eski autoDistributeAll funksiyasi autoDistributeUnassignedOnly bilan
  // bayt-baytiga bir xil edi (faqat bo'sh fanlarni biriktiradi) — duplikat o'chirildi.
  .post("/auto-distribute-all", requireAdmin, async (c) => {
    const result = await autoDistributeUnassignedOnly();
    return c.json(result);
  })
  .post("/auto-distribute-unassigned", requireAdmin, async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const result = await autoDistributeUnassignedOnly(body.classIds);
    return c.json(result);
  })
  .post("/auto-distribute-force-reassign", requireAdmin, async (c) => {
    const body = await c.req.json().catch(() => ({}));
    const result = await autoDistributeAllForceReassign(body.classIds);
    return c.json(result);
  })
  .post("/auto-assign-dts", requireAdmin, async (c) => {
    const body = await c.req.json().catch(() => ({}));
    if (!Array.isArray(body.classIds) || body.classIds.length === 0) {
      return c.json({ message: "classIds massivi kiritilishi shart" }, 400);
    }
    const result = await autoAssignDtsForClasses(body.classIds);
    return c.json(result);
  })
  .post("/clear-bulk", requireAdmin, async (c) => {
    const body = await c.req.json().catch(() => ({}));
    if (!Array.isArray(body.classIds) || body.classIds.length === 0) {
      return c.json({ message: "classIds massivi kiritilishi shart" }, 400);
    }
    for (const id of body.classIds) {
      await storage.setClassSubjects(id, []);
    }
    return c.json({ message: `${body.classIds.length} ta sinf biriktirishlari tozalandi.` });
  })
  // Bulk import (Excel): sinf/fan/o'qituvchi NOM bo'yicha moslashtirib class_subjects yozadi.
  // Qator formati: { className, subjectName, teacherName?, weeklyHours? }
  .post("/bulk-import", requireAdmin, async (c) => {
    const { items } = await c.req.json();
    if (!Array.isArray(items) || items.length === 0) {
      return c.json({ message: "Qatorlar ro'yxati bo'sh" }, 400);
    }
    const [allClasses, allSubjects, allTeachers, allCS] = await Promise.all([
      storage.getClasses(), storage.getSubjects(), storage.getTeachers(), storage.getAllClassSubjects(),
    ]);
    const errors: Array<{ row: number; message: string }> = [];
    // classId -> yangilangan biriktirishlar ro'yxati (mavjudlarini saqlab)
    const byClass = new Map<number, Array<{ subjectId: number; teacherId: number | null; weeklyHours: number }>>();
    for (const cs of allCS) {
      if (!byClass.has(cs.classId)) byClass.set(cs.classId, []);
      byClass.get(cs.classId)!.push({ subjectId: cs.subjectId, teacherId: cs.teacherId, weeklyHours: cs.weeklyHours });
    }
    let successCount = 0;
    const touchedClassIds = new Set<number>();

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const row = i + 2; // Excel sarlavha qatoridan keyin
      try {
        const clsName = String(item.className || "").trim().toLowerCase();
        const cls = allClasses.find((x) => x.name.toLowerCase() === clsName);
        if (!cls) throw new Error(`Sinf topilmadi: "${item.className}"`);

        const subName = String(item.subjectName || "").trim().toLowerCase();
        const sub = allSubjects.find((x) => x.name.toLowerCase() === subName)
          || allSubjects.find((x) => x.name.toLowerCase().includes(subName) && subName.length >= 4);
        if (!sub) throw new Error(`Fan topilmadi: "${item.subjectName}"`);

        let teacherId: number | null = null;
        if (item.teacherName && String(item.teacherName).trim()) {
          const tName = String(item.teacherName).trim().toLowerCase();
          const teacher = allTeachers.find(
            (t) => `${t.firstName} ${t.lastName}`.toLowerCase() === tName
              || `${t.lastName} ${t.firstName}`.toLowerCase() === tName
          );
          if (!teacher) throw new Error(`O'qituvchi topilmadi: "${item.teacherName}"`);
          teacherId = teacher.id;
        }

        // Excel qatorida soat ko'rsatilmagan bo'lsa (0/bo'sh/NaN), mavjud biriktirishning
        // hozirgi soatini SAQLAB qolamiz — aks holda faqat o'qituvchini yangilash uchun
        // import qilingan qator sukut bo'yicha maxsus sozlangan soatni fan standartiga
        // almashtirib, uni jimgina yo'qotib qo'yardi.
        const importedHours = Number(item.weeklyHours);
        const hasImportedHours = Number.isFinite(importedHours) && importedHours > 0;
        if (!byClass.has(cls.id)) byClass.set(cls.id, []);
        const list = byClass.get(cls.id)!;
        const existing = list.find((x) => x.subjectId === sub.id);
        if (existing) {
          existing.teacherId = teacherId ?? existing.teacherId;
          if (hasImportedHours) existing.weeklyHours = importedHours;
        } else {
          list.push({ subjectId: sub.id, teacherId, weeklyHours: hasImportedHours ? importedHours : (sub.weeklyHours || 2) });
        }
        touchedClassIds.add(cls.id);
        successCount++;
      } catch (e: any) {
        errors.push({ row, message: e.message || "Noma'lum xato" });
      }
    }

    for (const classId of Array.from(touchedClassIds)) {
      await storage.setClassSubjects(classId, byClass.get(classId) || []);
    }

    return c.json({ successCount, errors });
  })

  .post("/bulk-assign", requireAdmin, async (c) => {
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
