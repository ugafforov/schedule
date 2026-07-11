import { Hono } from "hono";
import { insertRoomSchema, rooms } from "@shared/schema";
import { storage } from "../storage/index";
import { authMiddleware, requireAdmin } from "../middleware/auth";
import { strictRateLimit } from "../middleware/rateLimit";
import { db } from "../db";

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

  // Recommendation
  .get("/recommendation", requireAdmin, async (c) => {
    const shifts = parseInt(c.req.query("shifts") || "1", 10);
    const reservePercent = parseInt(c.req.query("reservePercent") || "15", 10);
    const reserveFactor = 1 + reservePercent / 100;

    const [allClasses, allClassSubjects, allSubjects, allTimeSlots, allRooms] = await Promise.all([
      storage.getClasses(),
      storage.getAllClassSubjects(),
      storage.getSubjects(),
      storage.getTimeSlots(),
      storage.getRooms()
    ]);

    // Active classes
    const activeClasses = allClasses.filter(c => c.isActive);
    const activeClassIds = new Set(activeClasses.map(c => c.id));

    // Calculate max hours per room per shift
    const activeTimeSlots = allTimeSlots.filter(t => t.isActive && !t.isBreak);
    const slotsPerShift = activeTimeSlots.length > 0 ? activeTimeSlots.length : 36; 
    const totalCapacityPerRoom = slotsPerShift * shifts;

    // Build subject required room types
    const subjectRoomTypes: Record<number, string> = {};
    for (const sub of allSubjects) {
      subjectRoomTypes[sub.id] = sub.requiredRoomType || "classroom";
    }

    // Accumulate total required hours for each room type
    const hoursByRoomType: Record<string, number> = {};
    // Also track classes for primary homeroom calculation
    const primaryClassesCount = activeClasses.filter(c => {
      const g = parseInt(c.grade);
      return !isNaN(g) && g >= 1 && g <= 4;
    }).length;

    for (const cs of allClassSubjects) {
      if (!activeClassIds.has(cs.classId)) continue;
      
      let rType = subjectRoomTypes[cs.subjectId] || "classroom";
      if (rType === "any") rType = "classroom";
      
      if (!hoursByRoomType[rType]) hoursByRoomType[rType] = 0;
      hoursByRoomType[rType] += cs.weeklyHours;
    }

    // Count existing active rooms
    const activeRoomsByType: Record<string, number> = {};
    for (const r of allRooms) {
      if (!r.isActive) continue;
      let rType = r.roomType || "classroom";
      if (rType === "any") rType = "classroom";
      activeRoomsByType[rType] = (activeRoomsByType[rType] || 0) + 1;
    }

    const types = ["classroom", "computer", "gym", "lab", "music", "art"];
    const recommendations = [];

    for (const t of types) {
      const requiredHours = hoursByRoomType[t] || 0;
      const available = activeRoomsByType[t] || 0;
      
      let needed = Math.ceil((requiredHours / totalCapacityPerRoom) * reserveFactor);
      
      // For general classrooms, ensure at least enough rooms for primary classes to have their own homeroom if shift allows
      if (t === "classroom") {
         const minClassroomsForPrimary = Math.ceil(primaryClassesCount / shifts);
         const totalClasses = Math.ceil(activeClasses.length / shifts);
         // Often schools need a classroom for almost every class in a shift
         needed = Math.max(needed, minClassroomsForPrimary, totalClasses);
         // Add reserve factor to total classes constraint as well? Usually total classes already is a hard limit
         needed = Math.ceil(needed * reserveFactor);
      }

      const shortage = Math.max(0, needed - available);
      
      recommendations.push({
        roomType: t,
        requiredHours,
        needed,
        available,
        shortage
      });
    }

    return c.json({
      slotsPerShift,
      totalCapacityPerRoom,
      shifts,
      reservePercent,
      recommendations
    });
  });
