import { pgTable, text, serial, integer, boolean, timestamp, time, json } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table for authentication
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("teacher"), // admin, teacher, student
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Schools table
export const schools = pgTable("schools", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  address: text("address"),
  phone: text("phone"),
  email: text("email"),
  isActive: boolean("is_active").notNull().default(true),
});

// Subjects table
export const subjects = pgTable("subjects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  description: text("description"),
  color: text("color").notNull().default("#1976D2"),
  isActive: boolean("is_active").notNull().default(true),
});

// Teachers table
export const teachers = pgTable("teachers", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  employeeId: text("employee_id").notNull().unique(),
  department: text("department"),
  specialization: text("specialization"),
  phone: text("phone"),
  maxHoursPerWeek: integer("max_hours_per_week").default(40),
  preferences: json("preferences"), // scheduling preferences
  isActive: boolean("is_active").notNull().default(true),
});

// Classes table (academic classes/grades)
export const classes = pgTable("classes", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  grade: text("grade").notNull(),
  section: text("section"),
  schoolId: integer("school_id").references(() => schools.id),
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
  roomType: text("room_type").notNull(), // classroom, lab, auditorium, etc.
  equipment: json("equipment"), // available equipment
  isActive: boolean("is_active").notNull().default(true),
});

// Time slots table
export const timeSlots = pgTable("time_slots", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  startTime: time("start_time").notNull(),
  endTime: time("end_time").notNull(),
  dayOfWeek: integer("day_of_week").notNull(), // 1=Monday, 7=Sunday
  isBreak: boolean("is_break").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
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
  conflictType: text("conflict_type").notNull(), // room, teacher, class
  description: text("description").notNull(),
  scheduleEntry1Id: integer("schedule_entry_1_id").references(() => scheduleEntries.id),
  scheduleEntry2Id: integer("schedule_entry_2_id").references(() => scheduleEntries.id),
  severity: text("severity").notNull().default("medium"), // low, medium, high
  isResolved: boolean("is_resolved").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ one }) => ({
  teacher: one(teachers, {
    fields: [users.id],
    references: [teachers.userId],
  }),
}));

export const teachersRelations = relations(teachers, ({ one, many }) => ({
  user: one(users, {
    fields: [teachers.userId],
    references: [users.id],
  }),
  scheduleEntries: many(scheduleEntries),
  classesAsTeacher: many(classes),
}));

export const schoolsRelations = relations(schools, ({ many }) => ({
  classes: many(classes),
}));

export const classesRelations = relations(classes, ({ one, many }) => ({
  school: one(schools, {
    fields: [classes.schoolId],
    references: [schools.id],
  }),
  classTeacher: one(teachers, {
    fields: [classes.classTeacherId],
    references: [teachers.id],
  }),
  scheduleEntries: many(scheduleEntries),
}));

export const subjectsRelations = relations(subjects, ({ many }) => ({
  scheduleEntries: many(scheduleEntries),
}));

export const roomsRelations = relations(rooms, ({ many }) => ({
  scheduleEntries: many(scheduleEntries),
}));

export const timeSlotsRelations = relations(timeSlots, ({ many }) => ({
  scheduleEntries: many(scheduleEntries),
}));

export const scheduleEntriesRelations = relations(scheduleEntries, ({ one, many }) => ({
  class: one(classes, {
    fields: [scheduleEntries.classId],
    references: [classes.id],
  }),
  subject: one(subjects, {
    fields: [scheduleEntries.subjectId],
    references: [subjects.id],
  }),
  teacher: one(teachers, {
    fields: [scheduleEntries.teacherId],
    references: [teachers.id],
  }),
  room: one(rooms, {
    fields: [scheduleEntries.roomId],
    references: [rooms.id],
  }),
  timeSlot: one(timeSlots, {
    fields: [scheduleEntries.timeSlotId],
    references: [timeSlots.id],
  }),
  conflictsAsEntry1: many(scheduleConflicts, {
    relationName: "entry1Conflicts",
  }),
  conflictsAsEntry2: many(scheduleConflicts, {
    relationName: "entry2Conflicts",
  }),
}));

export const scheduleConflictsRelations = relations(scheduleConflicts, ({ one }) => ({
  scheduleEntry1: one(scheduleEntries, {
    fields: [scheduleConflicts.scheduleEntry1Id],
    references: [scheduleEntries.id],
    relationName: "entry1Conflicts",
  }),
  scheduleEntry2: one(scheduleEntries, {
    fields: [scheduleConflicts.scheduleEntry2Id],
    references: [scheduleEntries.id],
    relationName: "entry2Conflicts",
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertSchoolSchema = createInsertSchema(schools).omit({
  id: true,
});

export const insertSubjectSchema = createInsertSchema(subjects).omit({
  id: true,
});

export const insertTeacherSchema = createInsertSchema(teachers).omit({
  id: true,
});

export const insertClassSchema = createInsertSchema(classes).omit({
  id: true,
});

export const insertRoomSchema = createInsertSchema(rooms).omit({
  id: true,
});

export const insertTimeSlotSchema = createInsertSchema(timeSlots).omit({
  id: true,
});

export const insertScheduleEntrySchema = createInsertSchema(scheduleEntries).omit({
  id: true,
  createdAt: true,
});

export const insertScheduleConflictSchema = createInsertSchema(scheduleConflicts).omit({
  id: true,
  createdAt: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type School = typeof schools.$inferSelect;
export type InsertSchool = z.infer<typeof insertSchoolSchema>;

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

export type ScheduleEntry = typeof scheduleEntries.$inferSelect;
export type InsertScheduleEntry = z.infer<typeof insertScheduleEntrySchema>;

export type ScheduleConflict = typeof scheduleConflicts.$inferSelect;
export type InsertScheduleConflict = z.infer<typeof insertScheduleConflictSchema>;

// Login schema
export const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export type LoginRequest = z.infer<typeof loginSchema>;
