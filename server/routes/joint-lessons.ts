import { Hono } from "hono";
import { storage } from "../storage/index";
import { authMiddleware, requireAdmin } from "../middleware/auth";
import { strictRateLimit } from "../middleware/rateLimit";

export const jointLessonRoutes = new Hono()
  .use(authMiddleware)

  .get("/", async (c) => {
    return c.json(await storage.getJointLessons());
  })

  .get("/:id", async (c) => {
    const id = parseInt(c.req.param("id"));
    const result = await storage.getJointLessonById(id);
    if (!result) return c.json({ message: "Birlashtirilgan dars topilmadi" }, 404);
    return c.json(result);
  })

  .post("/", requireAdmin, strictRateLimit, async (c) => {
    const body = await c.req.json();
    const { subjectId, weeklyHours, classIds, groups } = body;

    if (!subjectId || !weeklyHours || !Array.isArray(classIds) || classIds.length === 0 || !Array.isArray(groups) || groups.length === 0) {
      return c.json({ message: "Noto'g'ri ma'lumotlar uzatildi" }, 400);
    }

    try {
      const result = await storage.createJointLesson({
        subjectId: parseInt(subjectId),
        weeklyHours: parseFloat(weeklyHours),
        classIds: classIds.map((id: any) => parseInt(id)),
        groups: groups.map((g: any) => ({
          groupName: String(g.groupName),
          teacherId: parseInt(g.teacherId),
          roomId: g.roomId ? parseInt(g.roomId) : null
        }))
      });
      return c.json(result, 201);
    } catch (e: any) {
      return c.json({ message: e.message || "Birlashtirilgan darsni yaratish muvaffaqiyatsiz tugadi" }, 500);
    }
  })

  .patch("/:id", requireAdmin, strictRateLimit, async (c) => {
    const id = parseInt(c.req.param("id"));
    const body = await c.req.json();
    const { subjectId, weeklyHours, classIds, groups } = body;

    if (!subjectId || !weeklyHours || !Array.isArray(classIds) || classIds.length === 0 || !Array.isArray(groups) || groups.length === 0) {
      return c.json({ message: "Noto'g'ri ma'lumotlar uzatildi" }, 400);
    }

    try {
      const existing = await storage.getJointLessonById(id);
      if (!existing) return c.json({ message: "Birlashtirilgan dars topilmadi" }, 404);

      const result = await storage.updateJointLesson(id, {
        subjectId: parseInt(subjectId),
        weeklyHours: parseFloat(weeklyHours),
        classIds: classIds.map((id: any) => parseInt(id)),
        groups: groups.map((g: any) => ({
          groupName: String(g.groupName),
          teacherId: parseInt(g.teacherId),
          roomId: g.roomId ? parseInt(g.roomId) : null
        }))
      });
      return c.json(result);
    } catch (e: any) {
      return c.json({ message: e.message || "Tahrirlash muvaffaqiyatsiz tugadi" }, 500);
    }
  })

  .delete("/:id", requireAdmin, async (c) => {
    const id = parseInt(c.req.param("id"));
    const success = await storage.deleteJointLesson(id);
    if (!success) return c.json({ message: "Birlashtirilgan dars topilmadi" }, 404);
    return c.body(null, 204);
  });
