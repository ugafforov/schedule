import { pgTable, text, serial, integer, boolean, timestamp, time } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Access codes table for custom authentication
export const accessCodes = pgTable("access_codes", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  ownerName: text("owner_name").notNull(),
  role: text("role").notNull().default("teacher"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  lastUsed: timestamp("last_used"),
});

// Subjects table
export const subjects = pgTable("subjects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  description: text("description"),
  color: text("color").notNull().default("#1976D2"),
  weeklyHours: integer("weekly_hours").notNull().default(2),
  isActive: boolean("is_active").notNull().default(true),
});

// Teachers table
export const teachers = pgTable("teachers", {
  id: serial("id").primaryKey(),
  firstName: text("first_name").notNull().default(""),
  lastName: text("last_name").notNull().default(""),
  employeeId: text("employee_id").notNull().unique(),
  department: text("department"),
  specialization: text("specialization"),
  phone: text("phone"),
  maxHoursPerWeek: integer("max_hours_per_week").default(30),
  isActive: boolean("is_active").notNull().default(true),
});

// Classes table
export const classes = pgTable("classes", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  grade: text("grade").notNull(),
  section: text("section"),
  classTeacherId: integer("class_teacher_id").references(() => teachers.id),
  totalStudents: integer("total_students").default(30),
  isActive: boolean("is_active").notNull().default(true),
});

// Rooms table
export const rooms = pgTable("rooms", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  roomNumber: text("room_number").notNull(),
  building: text("building"),
  floor: text("floor"),
  capacity: integer("capacity").notNull(),
  roomType: text("room_type").notNull().default("classroom"),
  isActive: boolean("is_active").notNull().default(true),
});

// Time slots table
export const timeSlots = pgTable("time_slots", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  startTime: time("start_time").notNull(),
  endTime: time("end_time").notNull(),
  dayOfWeek: integer("day_of_week").notNull(),
  periodNumber: integer("period_number").notNull().default(1),
  isBreak: boolean("is_break").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
});

// Teacher-Subject junction (which subjects a teacher can teach)
export const teacherSubjects = pgTable("teacher_subjects", {
  id: serial("id").primaryKey(),
  teacherId: integer("teacher_id").references(() => teachers.id, { onDelete: "cascade" }).notNull(),
  subjectId: integer("subject_id").references(() => subjects.id, { onDelete: "cascade" }).notNull(),
});

// Class-Subject assignments (which subjects a class studies, with teacher and weekly hours)
export const classSubjects = pgTable("class_subjects", {
  id: serial("id").primaryKey(),
  classId: integer("class_id").references(() => classes.id, { onDelete: "cascade" }).notNull(),
  subjectId: integer("subject_id").references(() => subjects.id, { onDelete: "cascade" }).notNull(),
  teacherId: integer("teacher_id").references(() => teachers.id),
  weeklyHours: integer("weekly_hours").notNull().default(2),
});

// Schedule entries table (main timetable)
export const scheduleEntries = pgTable("schedule_entries", {
  id: serial("id").primaryKey(),
  classId: integer("class_id").references(() => classes.id).notNull(),
  subjectId: integer("subject_id").references(() => subjects.id).notNull(),
  teacherId: integer("teacher_id").references(() => teachers.id).notNull(),
  roomId: integer("room_id").references(() => rooms.id).notNull(),
  timeSlotId: integer("time_slot_id").references(() => timeSlots.id).notNull(),
  weekStartDate: timestamp("week_start_date").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Schedule conflicts table
export const scheduleConflicts = pgTable("schedule_conflicts", {
  id: serial("id").primaryKey(),
  conflictType: text("conflict_type").notNull(),
  description: text("description").notNull(),
  scheduleEntry1Id: integer("schedule_entry_1_id").references(() => scheduleEntries.id),
  scheduleEntry2Id: integer("schedule_entry_2_id").references(() => scheduleEntries.id),
  severity: text("severity").notNull().default("medium"),
  isResolved: boolean("is_resolved").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Relations
export const teachersRelations = relations(teachers, ({ many }) => ({
  teacherSubjects: many(teacherSubjects),
  classSubjects: many(classSubjects),
  scheduleEntries: many(scheduleEntries),
}));

export const subjectsRelations = relations(subjects, ({ many }) => ({
  teacherSubjects: many(teacherSubjects),
  classSubjects: many(classSubjects),
  scheduleEntries: many(scheduleEntries),
}));

export const classesRelations = relations(classes, ({ one, many }) => ({
  classTeacher: one(teachers, { fields: [classes.classTeacherId], references: [teachers.id] }),
  classSubjects: many(classSubjects),
  scheduleEntries: many(scheduleEntries),
}));

export const roomsRelations = relations(rooms, ({ many }) => ({
  scheduleEntries: many(scheduleEntries),
}));

export const timeSlotsRelations = relations(timeSlots, ({ many }) => ({
  scheduleEntries: many(scheduleEntries),
}));

export const teacherSubjectsRelations = relations(teacherSubjects, ({ one }) => ({
  teacher: one(teachers, { fields: [teacherSubjects.teacherId], references: [teachers.id] }),
  subject: one(subjects, { fields: [teacherSubjects.subjectId], references: [subjects.id] }),
}));

export const classSubjectsRelations = relations(classSubjects, ({ one }) => ({
  class: one(classes, { fields: [classSubjects.classId], references: [classes.id] }),
  subject: one(subjects, { fields: [classSubjects.subjectId], references: [subjects.id] }),
  teacher: one(teachers, { fields: [classSubjects.teacherId], references: [teachers.id] }),
}));

export const scheduleEntriesRelations = relations(scheduleEntries, ({ one }) => ({
  class: one(classes, { fields: [scheduleEntries.classId], references: [classes.id] }),
  subject: one(subjects, { fields: [scheduleEntries.subjectId], references: [subjects.id] }),
  teacher: one(teachers, { fields: [scheduleEntries.teacherId], references: [teachers.id] }),
  room: one(rooms, { fields: [scheduleEntries.roomId], references: [rooms.id] }),
  timeSlot: one(timeSlots, { fields: [scheduleEntries.timeSlotId], references: [timeSlots.id] }),
}));

// Insert schemas
export const insertAccessCodeSchema = createInsertSchema(accessCodes).omit({ id: true, createdAt: true, lastUsed: true });
export const insertSubjectSchema = createInsertSchema(subjects).omit({ id: true });
export const insertTeacherSchema = createInsertSchema(teachers).omit({ id: true });
export const insertClassSchema = createInsertSchema(classes).omit({ id: true });
export const insertRoomSchema = createInsertSchema(rooms).omit({ id: true });
export const insertTimeSlotSchema = createInsertSchema(timeSlots).omit({ id: true });
export const insertTeacherSubjectSchema = createInsertSchema(teacherSubjects).omit({ id: true });
export const insertClassSubjectSchema = createInsertSchema(classSubjects).omit({ id: true });
export const insertScheduleEntrySchema = createInsertSchema(scheduleEntries).omit({ id: true, createdAt: true });
export const insertScheduleConflictSchema = createInsertSchema(scheduleConflicts).omit({ id: true, createdAt: true });

// Types
export type AccessCode = typeof accessCodes.$inferSelect;
export type InsertAccessCode = z.infer<typeof insertAccessCodeSchema>;
export type Subject = typeof subjects.$inferSelect;
export type InsertSubject = z.infer<typeof insertSubjectSchema>;
export type Teacher = typeof teachers.$inferSelect;
export type InsertTeacher = z.infer<typeof insertTeacherSchema>;
export type Class = typeof classes.$inferSelect;
export type InsertClass = z.infer<typeof insertClassSchema>;
export type Room = typeof rooms.$inferSelect;
export type InsertRoom = z.infer<typeof insertRoomSchema>;
export type TimeSlot = typeof timeSlots.$inferSelect;
export type InsertTimeSlot = z.infer<typeof insertTimeSlotSchema>;
export type TeacherSubject = typeof teacherSubjects.$inferSelect;
export type InsertTeacherSubject = z.infer<typeof insertTeacherSubjectSchema>;
export type ClassSubject = typeof classSubjects.$inferSelect;
export type InsertClassSubject = z.infer<typeof insertClassSubjectSchema>;
export type ScheduleEntry = typeof scheduleEntries.$inferSelect;
export type InsertScheduleEntry = z.infer<typeof insertScheduleEntrySchema>;
export type ScheduleConflict = typeof scheduleConflicts.$inferSelect;
export type InsertScheduleConflict = z.infer<typeof insertScheduleConflictSchema>;

// Login schema
export const loginSchema = z.object({
  accessCode: z.string().min(1, "Kirish kodi kiritilishi kerak"),
});
export type LoginRequest = z.infer<typeof loginSchema>;

// Legacy types for backward compat
export type User = {
  id: number;
  firstName: string;
  lastName: string;
  role: string;
  username: string;
  email: string;
};
