import { 
  users, schools, subjects, teachers, classes, rooms, timeSlots, scheduleEntries, scheduleConflicts, accessCodes,
  type User, type InsertUser, type School, type InsertSchool, type Subject, type InsertSubject,
  type Teacher, type InsertTeacher, type Class, type InsertClass, type Room, type InsertRoom,
  type TimeSlot, type InsertTimeSlot, type ScheduleEntry, type InsertScheduleEntry,
  type ScheduleConflict, type InsertScheduleConflict, type AccessCode, type InsertAccessCode
} from "@shared/schema";
import { db } from "./db";
import { eq, and, count } from "drizzle-orm";

export interface IStorage {
  // Access code methods
  getAccessCodeByCode(code: string): Promise<AccessCode | undefined>;
  createAccessCode(insertAccessCode: InsertAccessCode): Promise<AccessCode>;
  updateAccessCodeLastUsed(code: string): Promise<void>;
  getAllAccessCodes(): Promise<AccessCode[]>;
  deleteAccessCode(id: number): Promise<boolean>;
  
  // User methods (legacy - still needed for JWT)
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(insertUser: InsertUser): Promise<User>;
  
  // School methods
  getSchools(): Promise<School[]>;
  createSchool(insertSchool: InsertSchool): Promise<School>;
  updateSchool(id: number, updateData: Partial<InsertSchool>): Promise<School | undefined>;
  deleteSchool(id: number): Promise<boolean>;
  
  // Subject methods
  getSubjects(): Promise<Subject[]>;
  createSubject(insertSubject: InsertSubject): Promise<Subject>;
  updateSubject(id: number, updateData: Partial<InsertSubject>): Promise<Subject | undefined>;
  deleteSubject(id: number): Promise<boolean>;
  
  // Teacher methods
  getTeachers(): Promise<Teacher[]>;
  createTeacher(insertTeacher: InsertTeacher): Promise<Teacher>;
  updateTeacher(id: number, updateData: Partial<InsertTeacher>): Promise<Teacher | undefined>;
  deleteTeacher(id: number): Promise<boolean>;
  
  // Class methods
  getClasses(): Promise<Class[]>;
  createClass(insertClass: InsertClass): Promise<Class>;
  updateClass(id: number, updateData: Partial<InsertClass>): Promise<Class | undefined>;
  deleteClass(id: number): Promise<boolean>;
  
  // Room methods
  getRooms(): Promise<Room[]>;
  createRoom(insertRoom: InsertRoom): Promise<Room>;
  updateRoom(id: number, updateData: Partial<InsertRoom>): Promise<Room | undefined>;
  deleteRoom(id: number): Promise<boolean>;
  
  // Time slot methods
  getTimeSlots(): Promise<TimeSlot[]>;
  createTimeSlot(insertTimeSlot: InsertTimeSlot): Promise<TimeSlot>;
  
  // Schedule entry methods
  getScheduleEntries(): Promise<ScheduleEntry[]>;
  getScheduleEntriesForWeek(weekStart: Date): Promise<ScheduleEntry[]>;
  createScheduleEntry(insertScheduleEntry: InsertScheduleEntry): Promise<ScheduleEntry>;
  updateScheduleEntry(id: number, updateData: Partial<InsertScheduleEntry>): Promise<ScheduleEntry | undefined>;
  deleteScheduleEntry(id: number): Promise<boolean>;
  
  // Conflict methods
  getUnresolvedConflicts(): Promise<ScheduleConflict[]>;
  resolveConflict(id: number): Promise<boolean>;
  
  // Dashboard methods
  getDashboardStats(): Promise<{
    totalClasses: number;
    totalTeachers: number;
    activeConflicts: number;
    roomUtilization: number;
  }>;
}

export class DatabaseStorage implements IStorage {
  // Access code methods
  async getAccessCodeByCode(code: string): Promise<AccessCode | undefined> {
    const [accessCode] = await db.select().from(accessCodes)
      .where(and(eq(accessCodes.code, code), eq(accessCodes.isActive, true)));
    return accessCode || undefined;
  }

  async createAccessCode(insertAccessCode: InsertAccessCode): Promise<AccessCode> {
    const [accessCode] = await db.insert(accessCodes).values(insertAccessCode).returning();
    return accessCode;
  }

  async updateAccessCodeLastUsed(code: string): Promise<void> {
    await db.update(accessCodes)
      .set({ lastUsed: new Date() })
      .where(eq(accessCodes.code, code));
  }

  async getAllAccessCodes(): Promise<AccessCode[]> {
    return await db.select().from(accessCodes).where(eq(accessCodes.isActive, true));
  }

  async deleteAccessCode(id: number): Promise<boolean> {
    const result = await db.update(accessCodes)
      .set({ isActive: false })
      .where(eq(accessCodes.id, id));
    return (result.rowCount || 0) > 0;
  }

  // User methods (legacy)
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  // School methods
  async getSchools(): Promise<School[]> {
    return await db.select().from(schools).where(eq(schools.isActive, true));
  }

  async createSchool(insertSchool: InsertSchool): Promise<School> {
    const [school] = await db.insert(schools).values(insertSchool).returning();
    return school;
  }

  async updateSchool(id: number, updateData: Partial<InsertSchool>): Promise<School | undefined> {
    const [school] = await db.update(schools)
      .set(updateData)
      .where(eq(schools.id, id))
      .returning();
    return school || undefined;
  }

  async deleteSchool(id: number): Promise<boolean> {
    const result = await db.update(schools)
      .set({ isActive: false })
      .where(eq(schools.id, id));
    return result.rowCount > 0;
  }

  // Subject methods
  async getSubjects(): Promise<Subject[]> {
    return await db.select().from(subjects).where(eq(subjects.isActive, true));
  }

  async createSubject(insertSubject: InsertSubject): Promise<Subject> {
    const [subject] = await db.insert(subjects).values(insertSubject).returning();
    return subject;
  }

  async updateSubject(id: number, updateData: Partial<InsertSubject>): Promise<Subject | undefined> {
    const [subject] = await db.update(subjects)
      .set(updateData)
      .where(eq(subjects.id, id))
      .returning();
    return subject || undefined;
  }

  async deleteSubject(id: number): Promise<boolean> {
    const result = await db.update(subjects)
      .set({ isActive: false })
      .where(eq(subjects.id, id));
    return result.rowCount > 0;
  }

  // Teacher methods
  async getTeachers(): Promise<Teacher[]> {
    return await db.select().from(teachers).where(eq(teachers.isActive, true));
  }

  async createTeacher(insertTeacher: InsertTeacher): Promise<Teacher> {
    const [teacher] = await db.insert(teachers).values(insertTeacher).returning();
    return teacher;
  }

  async updateTeacher(id: number, updateData: Partial<InsertTeacher>): Promise<Teacher | undefined> {
    const [teacher] = await db.update(teachers)
      .set(updateData)
      .where(eq(teachers.id, id))
      .returning();
    return teacher || undefined;
  }

  async deleteTeacher(id: number): Promise<boolean> {
    const result = await db.update(teachers)
      .set({ isActive: false })
      .where(eq(teachers.id, id));
    return result.rowCount > 0;
  }

  // Class methods
  async getClasses(): Promise<Class[]> {
    return await db.select().from(classes).where(eq(classes.isActive, true));
  }

  async createClass(insertClass: InsertClass): Promise<Class> {
    const [newClass] = await db.insert(classes).values(insertClass).returning();
    return newClass;
  }

  async updateClass(id: number, updateData: Partial<InsertClass>): Promise<Class | undefined> {
    const [updatedClass] = await db.update(classes)
      .set(updateData)
      .where(eq(classes.id, id))
      .returning();
    return updatedClass || undefined;
  }

  async deleteClass(id: number): Promise<boolean> {
    const result = await db.update(classes)
      .set({ isActive: false })
      .where(eq(classes.id, id));
    return result.rowCount > 0;
  }

  // Room methods
  async getRooms(): Promise<Room[]> {
    return await db.select().from(rooms).where(eq(rooms.isActive, true));
  }

  async createRoom(insertRoom: InsertRoom): Promise<Room> {
    const [room] = await db.insert(rooms).values(insertRoom).returning();
    return room;
  }

  async updateRoom(id: number, updateData: Partial<InsertRoom>): Promise<Room | undefined> {
    const [room] = await db.update(rooms)
      .set(updateData)
      .where(eq(rooms.id, id))
      .returning();
    return room || undefined;
  }

  async deleteRoom(id: number): Promise<boolean> {
    const result = await db.update(rooms)
      .set({ isActive: false })
      .where(eq(rooms.id, id));
    return result.rowCount > 0;
  }

  // Time slot methods
  async getTimeSlots(): Promise<TimeSlot[]> {
    return await db.select().from(timeSlots).where(eq(timeSlots.isActive, true));
  }

  async createTimeSlot(insertTimeSlot: InsertTimeSlot): Promise<TimeSlot> {
    const [timeSlot] = await db.insert(timeSlots).values(insertTimeSlot).returning();
    return timeSlot;
  }

  // Schedule entry methods
  async getScheduleEntries(): Promise<ScheduleEntry[]> {
    return await db.select().from(scheduleEntries).where(eq(scheduleEntries.isActive, true));
  }

  async getScheduleEntriesForWeek(weekStart: Date): Promise<ScheduleEntry[]> {
    return await db.select().from(scheduleEntries)
      .where(and(
        eq(scheduleEntries.isActive, true),
        eq(scheduleEntries.weekStartDate, weekStart)
      ));
  }

  async createScheduleEntry(insertScheduleEntry: InsertScheduleEntry): Promise<ScheduleEntry> {
    const [entry] = await db.insert(scheduleEntries).values(insertScheduleEntry).returning();
    return entry;
  }

  async updateScheduleEntry(id: number, updateData: Partial<InsertScheduleEntry>): Promise<ScheduleEntry | undefined> {
    const [entry] = await db.update(scheduleEntries)
      .set(updateData)
      .where(eq(scheduleEntries.id, id))
      .returning();
    return entry || undefined;
  }

  async deleteScheduleEntry(id: number): Promise<boolean> {
    const result = await db.update(scheduleEntries)
      .set({ isActive: false })
      .where(eq(scheduleEntries.id, id));
    return result.rowCount > 0;
  }

  // Conflict methods
  async getUnresolvedConflicts(): Promise<ScheduleConflict[]> {
    return await db.select().from(scheduleConflicts)
      .where(eq(scheduleConflicts.isResolved, false));
  }

  async resolveConflict(id: number): Promise<boolean> {
    const result = await db.update(scheduleConflicts)
      .set({ isResolved: true })
      .where(eq(scheduleConflicts.id, id));
    return result.rowCount > 0;
  }

  // Dashboard methods
  async getDashboardStats(): Promise<{
    totalClasses: number;
    totalTeachers: number;
    activeConflicts: number;
    roomUtilization: number;
  }> {
    const [classResult] = await db.select({ count: count() }).from(classes).where(eq(classes.isActive, true));
    const [teacherResult] = await db.select({ count: count() }).from(teachers).where(eq(teachers.isActive, true));
    const [conflictResult] = await db.select({ count: count() }).from(scheduleConflicts).where(eq(scheduleConflicts.isResolved, false));
    const [roomResult] = await db.select({ count: count() }).from(rooms).where(eq(rooms.isActive, true));
    const totalRooms = roomResult?.count || 0;
    const utilization = totalRooms > 0 ? Math.min(Math.round((Number(teacherResult?.count || 0) / totalRooms) * 100), 100) : 0;

    return {
      totalClasses: Number(classResult?.count || 0),
      totalTeachers: Number(teacherResult?.count || 0),
      activeConflicts: Number(conflictResult?.count || 0),
      roomUtilization: utilization || 0,
    };
  }
}

export const storage = new DatabaseStorage();