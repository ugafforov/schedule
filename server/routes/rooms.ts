import { Hono } from "hono";
import { insertRoomSchema, rooms } from "@shared/schema";
import { storage } from "../storage/index";
import { authMiddleware } from "../middleware/auth";
import { strictRateLimit } from "../middleware/rateLimit";
import { db } from "../db";

export const roomRoutes = new Hono()
  .use(authMiddleware)

  .get("/", async (c) => c.json(await storage.getRooms()))

  .post("/", async (c) => {
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

  .patch("/:id", async (c) => {
    const id = parseInt(c.req.param("id"));
    const data = insertRoomSchema.partial().parse(await c.req.json());
    const result = await storage.updateRoom(id, data);
    if (!result) return c.json({ message: "Xona topilmadi" }, 404);
    return c.json(result);
  })

  .delete("/:id", async (c) => {
    await storage.deleteRoom(parseInt(c.req.param("id")));
    return c.body(null, 204);
  })

  // Bulk create
  .post("/bulk", strictRateLimit, async (c) => {
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
  .post("/clear-all", strictRateLimit, async (c) => {
    await db.update(rooms).set({ isActive: false });
    return c.json({ message: "Barcha xonalar muvaffaqiyatli tozalandi" });
  });
