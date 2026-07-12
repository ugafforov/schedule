import { Hono } from "hono";
import { insertTimeSlotSchema } from "@shared/schema";
import { storage } from "../storage/index";
import { authMiddleware, requireAdmin } from "../middleware/auth";
import { ensureTimeSlots, saveTimeSlotsFromRows } from "../services/schedule.service";

const DAYS = [1, 2, 3, 4, 5, 6];
const DAY_NAMES = ["", "Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba"];

export const timeslotRoutes = new Hono()
  .use(authMiddleware)

  .get("/", async (c) => {
    const slots = await ensureTimeSlots();
    return c.json(slots);
  })

  .patch("/:id", requireAdmin, async (c) => {
    const id = parseInt(c.req.param("id"));
    const data = insertTimeSlotSchema.partial().parse(await c.req.json());
    const result = await storage.updateTimeSlot(id, data);
    if (!result) return c.json({ message: "Topilmadi" }, 404);
    return c.json(result);
  })

  .delete("/:id", requireAdmin, async (c) => {
    await storage.deleteTimeSlot(parseInt(c.req.param("id")));
    return c.body(null, 204);
  })

  // Reset to defaults
  .post("/reset", requireAdmin, async (c) => {
    await storage.deleteAllTimeSlots();
    const slots = await ensureTimeSlots();
    return c.json(slots);
  })

  // Update periods
  .put("/periods", requireAdmin, async (c) => {
    const { periods } = await c.req.json();
    if (!Array.isArray(periods) || periods.length === 0) {
      return c.json({ message: "Periods bo'sh bo'lmasligi kerak" }, 400);
    }
    await storage.deleteAllTimeSlots();
    const toCreate: any[] = [];
    for (const day of DAYS) {
      for (const p of periods) {
        toCreate.push({
          name: `${DAY_NAMES[day]} ${p.periodNumber}-dars`,
          startTime: p.startTime,
          endTime: p.endTime,
          dayOfWeek: day,
          periodNumber: p.periodNumber,
          isBreak: false,
          isActive: true,
        });
      }
    }
    const created = [];
    for (const s of toCreate) created.push(await storage.createTimeSlot(s));
    return c.json(created);
  })

  // Save full bell schedule
  .post("/save", requireAdmin, async (c) => {
    const { rows } = await c.req.json();
    if (!Array.isArray(rows) || rows.length === 0) {
      return c.json({ message: "Qatorlar bo'sh bo'lmasligi kerak" }, 400);
    }
    const created = await saveTimeSlotsFromRows(rows);
    return c.json(created);
  });
