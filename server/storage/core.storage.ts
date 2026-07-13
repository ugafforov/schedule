import { db } from "../db";
import {
  subjects, rooms, timeSlots, curriculumPlans, curriculumEntries, appSettings,
  type Subject, type InsertSubject,
  type Room, type InsertRoom, type TimeSlot, type InsertTimeSlot,
  type CurriculumPlan, type InsertCurriculumPlan, type CurriculumEntry, type InsertCurriculumEntry,
} from "@shared/schema";
import { eq, and } from "drizzle-orm";

export class CoreStorage {
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

  // Curriculum plans (DTS versiyalari)
  async getCurriculumPlans(): Promise<CurriculumPlan[]> {
    return db.select().from(curriculumPlans);
  }
  async getActiveCurriculumPlan(language: string): Promise<CurriculumPlan | undefined> {
    const [r] = await db.select().from(curriculumPlans)
      .where(and(eq(curriculumPlans.language, language), eq(curriculumPlans.isActive, true)));
    return r;
  }
  async createCurriculumPlan(data: InsertCurriculumPlan): Promise<CurriculumPlan> {
    const [r] = await db.insert(curriculumPlans).values(data).returning();
    return r;
  }
  async activateCurriculumPlan(id: number): Promise<CurriculumPlan | undefined> {
    const [plan] = await db.select().from(curriculumPlans).where(eq(curriculumPlans.id, id));
    if (!plan) return undefined;
    await db.update(curriculumPlans)
      .set({ isActive: false })
      .where(eq(curriculumPlans.language, plan.language));
    const [r] = await db.update(curriculumPlans).set({ isActive: true })
      .where(eq(curriculumPlans.id, id)).returning();
    return r;
  }

  // Curriculum entries
  async getCurriculumEntries(planId: number): Promise<CurriculumEntry[]> {
    return db.select().from(curriculumEntries).where(eq(curriculumEntries.planId, planId));
  }
  async createCurriculumEntry(data: InsertCurriculumEntry): Promise<CurriculumEntry> {
    const [r] = await db.insert(curriculumEntries).values(data).returning();
    return r;
  }
  async updateCurriculumEntry(id: number, data: Partial<InsertCurriculumEntry>): Promise<CurriculumEntry | undefined> {
    const [r] = await db.update(curriculumEntries).set(data).where(eq(curriculumEntries.id, id)).returning();
    return r;
  }
  async deleteCurriculumEntry(id: number): Promise<boolean> {
    const r = await db.delete(curriculumEntries).where(eq(curriculumEntries.id, id));
    return (r.rowCount || 0) > 0;
  }

  // App settings (key-value)
  async getSetting(key: string): Promise<string | undefined> {
    const [r] = await db.select().from(appSettings).where(eq(appSettings.key, key));
    return r?.value;
  }
  async setSetting(key: string, value: string): Promise<void> {
    await db.insert(appSettings).values({ key, value })
      .onConflictDoUpdate({ target: appSettings.key, set: { value } });
  }
}
