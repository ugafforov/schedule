import {
  subjects, teachers, classes, rooms, timeSlots, scheduleEntries, scheduleConflicts,
  accessCodes, teacherSubjects, classSubjects,
  type Subject, type InsertSubject,
  type Teacher, type InsertTeacher,
  type Class, type InsertClass,
  type Room, type InsertRoom,
  type TimeSlot, type InsertTimeSlot,
  type ScheduleEntry, type InsertScheduleEntry,
  type ScheduleConflict, type InsertScheduleConflict,
  type AccessCode, type InsertAccessCode,
  type TeacherSubject, type InsertTeacherSubject,
  type ClassSubject, type InsertClassSubject,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, count, inArray } from "drizzle-orm";

export interface IStorage {
  getAccessCodeByCode(code: string): Promise<AccessCode | undefined>;
  createAccessCode(data: InsertAccessCode): Promise<AccessCode>;
  updateAccessCodeLastUsed(code: string): Promise<void>;
  getAllAccessCodes(): Promise<AccessCode[]>;
  deleteAccessCode(id: number): Promise<boolean>;

  getSubjects(): Promise<Subject[]>;
  createSubject(data: InsertSubject): Promise<Subject>;
  updateSubject(id: number, data: Partial<InsertSubject>): Promise<Subject | undefined>;
  deleteSubject(id: number): Promise<boolean>;

  getTeachers(): Promise<Teacher[]>;
  createTeacher(data: InsertTeacher): Promise<Teacher>;
  updateTeacher(id: number, data: Partial<InsertTeacher>): Promise<Teacher | undefined>;
  deleteTeacher(id: number): Promise<boolean>;

  getTeacherSubjects(teacherId: number): Promise<TeacherSubject[]>;
  setTeacherSubjects(teacherId: number, subjectIds: number[]): Promise<void>;

  getClasses(): Promise<Class[]>;
  createClass(data: InsertClass): Promise<Class>;
  updateClass(id: number, data: Partial<InsertClass>): Promise<Class | undefined>;
  deleteClass(id: number): Promise<boolean>;

  getClassSubjects(classId: number): Promise<ClassSubject[]>;
  setClassSubjects(classId: number, items: Array<{ subjectId: number; teacherId: number | null; weeklyHours: number }>): Promise<void>;
  getAllClassSubjects(): Promise<ClassSubject[]>;

  getRooms(): Promise<Room[]>;
  createRoom(data: InsertRoom): Promise<Room>;
  updateRoom(id: number, data: Partial<InsertRoom>): Promise<Room | undefined>;
  deleteRoom(id: number): Promise<boolean>;

  getTimeSlots(): Promise<TimeSlot[]>;
  createTimeSlot(data: InsertTimeSlot): Promise<TimeSlot>;
  deleteAllTimeSlots(): Promise<void>;

  getScheduleEntries(): Promise<ScheduleEntry[]>;
  getScheduleEntriesByClass(classId: number): Promise<ScheduleEntry[]>;
  getScheduleEntriesForWeek(weekStart: Date): Promise<ScheduleEntry[]>;
  createScheduleEntry(data: InsertScheduleEntry): Promise<ScheduleEntry>;
  createScheduleEntriesBulk(data: InsertScheduleEntry[]): Promise<ScheduleEntry[]>;
  updateScheduleEntry(id: number, data: Partial<InsertScheduleEntry>): Promise<ScheduleEntry | undefined>;
  deleteScheduleEntry(id: number): Promise<boolean>;
  clearScheduleForWeek(weekStart: Date): Promise<void>;

  getUnresolvedConflicts(): Promise<ScheduleConflict[]>;
  createConflict(data: InsertScheduleConflict): Promise<ScheduleConflict>;
  resolveConflict(id: number): Promise<boolean>;
  clearConflicts(): Promise<void>;

  getDashboardStats(): Promise<{
    totalClasses: number;
    totalTeachers: number;
    totalSubjects: number;
    totalRooms: number;
    totalScheduled: number;
    activeConflicts: number;
  }>;
}

export class DatabaseStorage implements IStorage {
  // ─── ACCESS CODES ────────────────────────────────────────────────────────────
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

  // ─── SUBJECTS ────────────────────────────────────────────────────────────────
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

  // ─── TEACHERS ────────────────────────────────────────────────────────────────
  async getTeachers(): Promise<Teacher[]> {
    return db.select().from(teachers).where(eq(teachers.isActive, true));
  }
  async createTeacher(data: InsertTeacher): Promise<Teacher> {
    const [r] = await db.insert(teachers).values(data).returning();
    return r;
  }
  async updateTeacher(id: number, data: Partial<InsertTeacher>): Promise<Teacher | undefined> {
    const [r] = await db.update(teachers).set(data).where(eq(teachers.id, id)).returning();
    return r;
  }
  async deleteTeacher(id: number): Promise<boolean> {
    const r = await db.update(teachers).set({ isActive: false }).where(eq(teachers.id, id));
    return (r.rowCount || 0) > 0;
  }

  async getTeacherSubjects(teacherId: number): Promise<TeacherSubject[]> {
    return db.select().from(teacherSubjects).where(eq(teacherSubjects.teacherId, teacherId));
  }
  async setTeacherSubjects(teacherId: number, subjectIds: number[]): Promise<void> {
    await db.delete(teacherSubjects).where(eq(teacherSubjects.teacherId, teacherId));
    if (subjectIds.length > 0) {
      await db.insert(teacherSubjects).values(subjectIds.map(sid => ({ teacherId, subjectId: sid })));
    }
  }

  // ─── CLASSES ─────────────────────────────────────────────────────────────────
  async getClasses(): Promise<Class[]> {
    return db.select().from(classes).where(eq(classes.isActive, true));
  }
  async createClass(data: InsertClass): Promise<Class> {
    const [r] = await db.insert(classes).values(data).returning();
    return r;
  }
  async updateClass(id: number, data: Partial<InsertClass>): Promise<Class | undefined> {
    const [r] = await db.update(classes).set(data).where(eq(classes.id, id)).returning();
    return r;
  }
  async deleteClass(id: number): Promise<boolean> {
    const r = await db.update(classes).set({ isActive: false }).where(eq(classes.id, id));
    return (r.rowCount || 0) > 0;
  }

  async getClassSubjects(classId: number): Promise<ClassSubject[]> {
    return db.select().from(classSubjects).where(eq(classSubjects.classId, classId));
  }
  async getAllClassSubjects(): Promise<ClassSubject[]> {
    return db.select().from(classSubjects);
  }
  async setClassSubjects(classId: number, items: Array<{ subjectId: number; teacherId: number | null; weeklyHours: number }>): Promise<void> {
    await db.delete(classSubjects).where(eq(classSubjects.classId, classId));
    if (items.length > 0) {
      await db.insert(classSubjects).values(items.map(item => ({
        classId,
        subjectId: item.subjectId,
        teacherId: item.teacherId,
        weeklyHours: item.weeklyHours,
      })));
    }
  }

  // ─── ROOMS ───────────────────────────────────────────────────────────────────
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

  // ─── TIME SLOTS ──────────────────────────────────────────────────────────────
  async getTimeSlots(): Promise<TimeSlot[]> {
    return db.select().from(timeSlots).where(eq(timeSlots.isActive, true));
  }
  async createTimeSlot(data: InsertTimeSlot): Promise<TimeSlot> {
    const [r] = await db.insert(timeSlots).values(data).returning();
    return r;
  }
  async deleteAllTimeSlots(): Promise<void> {
    await db.delete(timeSlots);
  }

  // ─── SCHEDULE ENTRIES ────────────────────────────────────────────────────────
  async getScheduleEntries(): Promise<ScheduleEntry[]> {
    return db.select().from(scheduleEntries).where(eq(scheduleEntries.isActive, true));
  }
  async getScheduleEntriesByClass(classId: number): Promise<ScheduleEntry[]> {
    return db.select().from(scheduleEntries)
      .where(and(eq(scheduleEntries.isActive, true), eq(scheduleEntries.classId, classId)));
  }
  async getScheduleEntriesForWeek(weekStart: Date): Promise<ScheduleEntry[]> {
    return db.select().from(scheduleEntries)
      .where(and(eq(scheduleEntries.isActive, true), eq(scheduleEntries.weekStartDate, weekStart)));
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
    const [r] = await db.update(scheduleEntries).set(data).where(eq(scheduleEntries.id, id)).returning();
    return r;
  }
  async deleteScheduleEntry(id: number): Promise<boolean> {
    const r = await db.update(scheduleEntries).set({ isActive: false }).where(eq(scheduleEntries.id, id));
    return (r.rowCount || 0) > 0;
  }
  async clearScheduleForWeek(weekStart: Date): Promise<void> {
    await db.update(scheduleEntries)
      .set({ isActive: false })
      .where(and(eq(scheduleEntries.isActive, true), eq(scheduleEntries.weekStartDate, weekStart)));
  }

  // ─── CONFLICTS ───────────────────────────────────────────────────────────────
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

  // ─── DASHBOARD ───────────────────────────────────────────────────────────────
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

export const storage = new DatabaseStorage();
