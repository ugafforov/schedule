import { db } from "../db";
import { scheduleEntries, scheduleConflicts, teachers, classes, subjects, rooms, type ScheduleEntry, type InsertScheduleEntry, type ScheduleConflict, type InsertScheduleConflict } from "@shared/schema";
import { eq, and, count, isNotNull } from "drizzle-orm";

export class ScheduleStorage {
  // Schedule Entries
  async getScheduleEntries(): Promise<ScheduleEntry[]> {
    return db.select().from(scheduleEntries).where(eq(scheduleEntries.isActive, true));
  }
  async getScheduleEntriesByClass(classId: number): Promise<ScheduleEntry[]> {
    return db.select().from(scheduleEntries)
      .where(and(eq(scheduleEntries.isActive, true), eq(scheduleEntries.classId, classId)));
  }
  async getScheduleEntriesByTeacher(teacherId: number): Promise<ScheduleEntry[]> {
    return db.select().from(scheduleEntries)
      .where(and(
        eq(scheduleEntries.isActive, true),
        eq(scheduleEntries.teacherId, teacherId)
      ));
  }
  async createScheduleEntry(data: InsertScheduleEntry): Promise<ScheduleEntry> {
    const [r] = await db.insert(scheduleEntries).values(data).returning();
    return r;
  }
  async createScheduleEntriesBulk(data: InsertScheduleEntry[]): Promise<ScheduleEntry[]> {
    if (data.length === 0) return [];
    return db.insert(scheduleEntries).values(data).returning();
  }
  async updateScheduleEntry(id: number, data: Partial<InsertScheduleEntry>): Promise<ScheduleEntry | undefined> {
    const [entry] = await db.select().from(scheduleEntries).where(eq(scheduleEntries.id, id));
    if (!entry) return undefined;

    if (entry.jointLessonId && data.timeSlotId !== undefined) {
      await db.update(scheduleEntries)
        .set({ timeSlotId: data.timeSlotId })
        .where(and(
          eq(scheduleEntries.jointLessonId, entry.jointLessonId),
          eq(scheduleEntries.timeSlotId, entry.timeSlotId),
          eq(scheduleEntries.isActive, true)
        ));
      return { ...entry, timeSlotId: data.timeSlotId };
    }

    const [r] = await db.update(scheduleEntries).set(data).where(eq(scheduleEntries.id, id)).returning();
    return r;
  }
  async deleteScheduleEntry(id: number): Promise<boolean> {
    const [entry] = await db.select().from(scheduleEntries).where(eq(scheduleEntries.id, id));
    if (!entry) return false;

    if (entry.jointLessonId) {
      const r = await db.update(scheduleEntries)
        .set({ isActive: false })
        .where(and(
          eq(scheduleEntries.jointLessonId, entry.jointLessonId),
          eq(scheduleEntries.timeSlotId, entry.timeSlotId),
          eq(scheduleEntries.isActive, true)
        ));
      return (r.rowCount || 0) > 0;
    }

    const r = await db.update(scheduleEntries).set({ isActive: false }).where(eq(scheduleEntries.id, id));
    return (r.rowCount || 0) > 0;
  }
  async deleteAllScheduleEntries(): Promise<void> {
    await db.update(scheduleEntries).set({ isActive: false }).where(eq(scheduleEntries.isActive, true));
  }
  async clearScheduleForClass(classId: number): Promise<void> {
    await db.transaction(async (tx) => {
      // 1. Find all active joint lesson IDs that this class has entries for
      const activeJoints = await tx.select({ jointLessonId: scheduleEntries.jointLessonId })
        .from(scheduleEntries)
        .where(and(
          eq(scheduleEntries.isActive, true),
          eq(scheduleEntries.classId, classId),
          isNotNull(scheduleEntries.jointLessonId)
        ));
      
      const jointIds = Array.from(new Set(activeJoints.map(j => j.jointLessonId).filter((id): id is number => id !== null)));
      
      // 2. Clear regular entries for this class
      await tx.update(scheduleEntries)
        .set({ isActive: false })
        .where(and(
          eq(scheduleEntries.isActive, true),
          eq(scheduleEntries.classId, classId)
        ));
        
      // 3. Clear joint lesson entries for all participating classes for the identified joint lessons
      if (jointIds.length > 0) {
        for (const jid of jointIds) {
          await tx.update(scheduleEntries)
            .set({ isActive: false })
            .where(and(
              eq(scheduleEntries.isActive, true),
              eq(scheduleEntries.jointLessonId, jid)
            ));
        }
      }
    });
  }

  // Conflicts
  async getUnresolvedConflicts(): Promise<ScheduleConflict[]> {
    return db.select().from(scheduleConflicts).where(eq(scheduleConflicts.isResolved, false));
  }
  async createConflict(data: InsertScheduleConflict): Promise<ScheduleConflict> {
    const [r] = await db.insert(scheduleConflicts).values(data).returning();
    return r;
  }
  async resolveConflict(id: number): Promise<boolean> {
    const r = await db.update(scheduleConflicts).set({ isResolved: true }).where(eq(scheduleConflicts.id, id));
    return (r.rowCount || 0) > 0;
  }
  async clearConflicts(): Promise<void> {
    await db.update(scheduleConflicts).set({ isResolved: true });
  }

  // Dashboard
  async getDashboardStats() {
    const [cls] = await db.select({ count: count() }).from(classes).where(eq(classes.isActive, true));
    const [tch] = await db.select({ count: count() }).from(teachers).where(eq(teachers.isActive, true));
    const [sub] = await db.select({ count: count() }).from(subjects).where(eq(subjects.isActive, true));
    const [rm] = await db.select({ count: count() }).from(rooms).where(eq(rooms.isActive, true));

    const [sch] = await db.select({ count: count() }).from(scheduleEntries).where(eq(scheduleEntries.isActive, true));
    const [cf] = await db.select({ count: count() }).from(scheduleConflicts).where(eq(scheduleConflicts.isResolved, false));

    return {
      totalClasses: Number(cls?.count || 0),
      totalTeachers: Number(tch?.count || 0),
      totalSubjects: Number(sub?.count || 0),
      totalRooms: Number(rm?.count || 0),
      totalScheduled: Number(sch?.count || 0),
      activeConflicts: Number(cf?.count || 0),
    };
  }
}
