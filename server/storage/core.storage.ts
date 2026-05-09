import { db } from "../db";
import { accessCodes, subjects, rooms, timeSlots, type InsertAccessCode, type AccessCode, type Subject, type InsertSubject, type Room, type InsertRoom, type TimeSlot, type InsertTimeSlot } from "@shared/schema";
import { eq, and } from "drizzle-orm";

export class CoreStorage {
  // Access Codes
  async getAccessCodeByCode(code: string): Promise<AccessCode | undefined> {
    const [r] = await db.select().from(accessCodes)
      .where(and(eq(accessCodes.code, code), eq(accessCodes.isActive, true)));
    return r;
  }
  async createAccessCode(data: InsertAccessCode): Promise<AccessCode> {
    const [r] = await db.insert(accessCodes).values(data).returning();
    return r;
  }
  async updateAccessCodeLastUsed(code: string): Promise<void> {
    await db.update(accessCodes).set({ lastUsed: new Date() }).where(eq(accessCodes.code, code));
  }
  async getAllAccessCodes(): Promise<AccessCode[]> {
    return db.select().from(accessCodes).where(eq(accessCodes.isActive, true));
  }
  async deleteAccessCode(id: number): Promise<boolean> {
    const r = await db.update(accessCodes).set({ isActive: false }).where(eq(accessCodes.id, id));
    return (r.rowCount || 0) > 0;
  }

  // Subjects
  async getSubjects(): Promise<Subject[]> {
    return db.select().from(subjects).where(eq(subjects.isActive, true));
  }
  async createSubject(data: InsertSubject): Promise<Subject> {
    const [r] = await db.insert(subjects).values(data).returning();
    return r;
  }
  async updateSubject(id: number, data: Partial<InsertSubject>): Promise<Subject | undefined> {
    const [r] = await db.update(subjects).set(data).where(eq(subjects.id, id)).returning();
    return r;
  }
  async deleteSubject(id: number): Promise<boolean> {
    const r = await db.update(subjects).set({ isActive: false }).where(eq(subjects.id, id));
    return (r.rowCount || 0) > 0;
  }

  // Rooms
  async getRooms(): Promise<Room[]> {
    return db.select().from(rooms).where(eq(rooms.isActive, true));
  }
  async createRoom(data: InsertRoom): Promise<Room> {
    const [r] = await db.insert(rooms).values(data).returning();
    return r;
  }
  async updateRoom(id: number, data: Partial<InsertRoom>): Promise<Room | undefined> {
    const [r] = await db.update(rooms).set(data).where(eq(rooms.id, id)).returning();
    return r;
  }
  async deleteRoom(id: number): Promise<boolean> {
    const r = await db.update(rooms).set({ isActive: false }).where(eq(rooms.id, id));
    return (r.rowCount || 0) > 0;
  }

  // Time Slots
  async getTimeSlots(): Promise<TimeSlot[]> {
    return db.select().from(timeSlots).where(eq(timeSlots.isActive, true));
  }
  async createTimeSlot(data: InsertTimeSlot): Promise<TimeSlot> {
    const [r] = await db.insert(timeSlots).values(data).returning();
    return r;
  }
  async updateTimeSlot(id: number, data: Partial<InsertTimeSlot>): Promise<TimeSlot | undefined> {
    const [r] = await db.update(timeSlots).set(data).where(eq(timeSlots.id, id)).returning();
    return r;
  }
  async deleteTimeSlot(id: number): Promise<boolean> {
    const r = await db.delete(timeSlots).where(eq(timeSlots.id, id));
    return (r.rowCount || 0) > 0;
  }
  async deleteAllTimeSlots(): Promise<void> {
    await db.update(timeSlots).set({ isActive: false }).where(eq(timeSlots.isActive, true));
  }
}
