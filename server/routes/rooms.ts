import { Hono } from "hono";
import { insertRoomSchema, rooms } from "@shared/schema";
import { storage } from "../storage/index";
import { authMiddleware, requireAdmin } from "../middleware/auth";
import { strictRateLimit } from "../middleware/rateLimit";
import { db } from "../db";
import { computeRoomRecommendations } from "../services/room-recommendation";

export const roomRoutes = new Hono()
  .use(authMiddleware)

  .get("/", async (c) => c.json(await storage.getRooms()))

  .post("/", requireAdmin, async (c) => {
    const body = await c.req.json();
    const roomNumber = body.roomNumber || `R${Date.now().toString().slice(-4)}`;
    const data = insertRoomSchema.parse({
      name: body.name || `Xona ${roomNumber}`,
      roomNumber,
      building: body.building || null,
      floor: body.floor || null,
      capacity: body.capacity || 30,
      roomType: body.roomType || "classroom",
      isActive: true,
    });
    return c.json(await storage.createRoom(data), 201);
  })

  .patch("/:id", requireAdmin, async (c) => {
    const id = parseInt(c.req.param("id"));
    const data = insertRoomSchema.partial().parse(await c.req.json());
    const result = await storage.updateRoom(id, data);
    if (!result) return c.json({ message: "Xona topilmadi" }, 404);
    return c.json(result);
  })

  .delete("/:id", requireAdmin, async (c) => {
    await storage.deleteRoom(parseInt(c.req.param("id")));
    return c.body(null, 204);
  })

  // Bulk create
  .post("/bulk", requireAdmin, strictRateLimit, async (c) => {
    const { rooms: items } = await c.req.json();
    if (!Array.isArray(items) || items.length === 0) {
      return c.json({ message: "Xonalar ro'yxati bo'sh" }, 400);
    }
    const created = [];
    for (const item of items) {
      const data = insertRoomSchema.parse({
        name: item.name, roomNumber: item.roomNumber,
        building: item.building || null, floor: item.floor || null,
        capacity: item.capacity || 30, roomType: item.roomType || "classroom", isActive: true,
      });
      created.push(await storage.createRoom(data));
    }
    return c.json(created, 201);
  })

  // Clear all
  .post("/clear-all", requireAdmin, strictRateLimit, async (c) => {
    await db.update(rooms).set({ isActive: false });
    return c.json({ message: "Barcha xonalar muvaffaqiyatli tozalandi" });
  })

  // Recommendation — xona turi, sig'imi va bandligini hisobga oladi (room-recommendation.ts)
  .get("/recommendation", requireAdmin, async (c) => {
    const shifts = parseInt(c.req.query("shifts") || "1", 10);
    const reservePercent = parseInt(c.req.query("reservePercent") || "15", 10);

    const [allClasses, allClassSubjects, allSubjects, allTimeSlots, allRooms] = await Promise.all([
      storage.getClasses(),
      storage.getAllClassSubjects(),
      storage.getSubjects(),
      storage.getTimeSlots(),
      storage.getRooms(),
    ]);

    const activeSlotsPerWeek = allTimeSlots.filter(t => t.isActive && !t.isBreak).length || 36;

    return c.json(
      computeRoomRecommendations({
        classes: allClasses,
        classSubjects: allClassSubjects,
        subjects: allSubjects,
        rooms: allRooms,
        activeSlotsPerWeek,
        shifts,
        reservePercent,
      }),
    );
  })

  // Tavsiyani qo'llash: yangi xonalarni yaratish, sig'imlarni oshirish va umumiy
  // maxsus xonani fanga biriktirish (nomini "Fizika laboratoriyasi" ga o'zgartirish).
  // Solver fanga atalgan xonani nomi bo'yicha taniydi (roomMatchesSubject).
  .post("/apply-recommendation", requireAdmin, strictRateLimit, async (c) => {
    const body = await c.req.json();
    const toCreate: any[] = Array.isArray(body.create) ? body.create : [];
    const toUpgrade: any[] = Array.isArray(body.upgrades) ? body.upgrades : [];
    const toRename: any[] = Array.isArray(body.renames) ? body.renames : [];

    let created = 0, upgraded = 0, renamed = 0;

    for (const item of toCreate) {
      const data = insertRoomSchema.parse({
        name: item.name,
        roomNumber: item.roomNumber,
        building: item.building || null,
        floor: item.floor || null,
        capacity: item.capacity || 30,
        roomType: item.roomType || "classroom",
        isActive: true,
      });
      await storage.createRoom(data);
      created++;
    }

    for (const u of toUpgrade) {
      if (!u.roomId || !u.suggestedCapacity) continue;
      await storage.updateRoom(Number(u.roomId), { capacity: Number(u.suggestedCapacity) });
      upgraded++;
    }

    for (const r of toRename) {
      if (!r.roomId || !r.suggestedName) continue;
      await storage.updateRoom(Number(r.roomId), {
        name: String(r.suggestedName),
        ...(r.suggestedCapacity ? { capacity: Number(r.suggestedCapacity) } : {}),
      });
      renamed++;
    }

    return c.json({
      created, upgraded, renamed,
      message: `${created} ta xona yaratildi, ${upgraded} ta sig'im oshirildi, ${renamed} ta xona fanga biriktirildi.`,
    });
  });
