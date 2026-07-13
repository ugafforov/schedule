import { Hono } from "hono";
import { storage } from "../storage/index";
import { authMiddleware, requireAdmin } from "../middleware/auth";
import { CLASS_HOUR_SLOT_SETTING_KEY, DEFAULT_CLASS_HOUR_SLOT } from "@shared/constants";

// Ruxsat etilgan sozlama kalitlari — ixtiyoriy kalit yozishning oldini oladi
const ALLOWED_KEYS = new Set<string>([CLASS_HOUR_SLOT_SETTING_KEY]);

export const settingsRoutes = new Hono()
  .use(authMiddleware)

  .get("/:key", async (c) => {
    const key = c.req.param("key");
    if (!ALLOWED_KEYS.has(key)) return c.json({ message: "Noma'lum sozlama" }, 404);
    const value = await storage.getSetting(key);
    if (value === undefined && key === CLASS_HOUR_SLOT_SETTING_KEY) {
      return c.json({ key, value: DEFAULT_CLASS_HOUR_SLOT });
    }
    return c.json({ key, value: value !== undefined ? JSON.parse(value) : null });
  })

  .put("/:key", requireAdmin, async (c) => {
    const key = c.req.param("key");
    if (!ALLOWED_KEYS.has(key)) return c.json({ message: "Noma'lum sozlama" }, 404);
    const body = await c.req.json();
    if (key === CLASS_HOUR_SLOT_SETTING_KEY) {
      const day = Number(body?.dayOfWeek);
      const period = Number(body?.periodNumber);
      if (!Number.isInteger(day) || day < 1 || day > 6 || !Number.isInteger(period) || period < 1 || period > 7) {
        return c.json({ message: "Kun (1-6) va dars raqami (1-7) noto'g'ri" }, 400);
      }
      await storage.setSetting(key, JSON.stringify({ dayOfWeek: day, periodNumber: period }));
      return c.json({ key, value: { dayOfWeek: day, periodNumber: period } });
    }
    await storage.setSetting(key, JSON.stringify(body));
    return c.json({ key, value: body });
  });
