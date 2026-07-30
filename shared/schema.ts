import { pgTable, text, serial, integer, boolean, timestamp, time, real, index, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Eslatma: eski access_codes jadvali (Supabase auth'dan oldingi autentifikatsiya)
// koddan olib tashlandi — DB'dagi jadval tegilmagan, lekin ilova uni ishlatmaydi.

// Subjects table
export const subjects = pgTable("subjects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  description: text("description"),
  color: text("color").notNull().default("#1976D2"),
  weeklyHours: real("weekly_hours").notNull().default(2),
  // room type required: "classroom" | "lab" | "gym" | "computer" | "music" | "art" | "any"
  requiredRoomType: text("required_room_type").notNull().default("any"),
  isActive: boolean("is_active").notNull().default(true),
}).enableRLS();

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
  // Qaysi sinf darajalarida dars bera oladi: "primary" (1-4), "high" (5-11)
  // Ko'p qiymat: "primary,high" (barcha sinflar)
  gradeLevel: text("grade_level").default("high"),
  // Avtomatik yaratilgan "vakant" (bo'sh o'rin) o'qituvchi — ism-matn heuristikasi o'rniga flag
  isVacant: boolean("is_vacant").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
}).enableRLS();

// Teacher unavailability — which day/period a teacher cannot teach
export const teacherUnavailability = pgTable("teacher_unavailability", {
  id: serial("id").primaryKey(),
  teacherId: integer("teacher_id").references(() => teachers.id, { onDelete: "cascade" }).notNull(),
  dayOfWeek: integer("day_of_week").notNull(), // 1=Mon … 5=Fri
  periodNumber: integer("period_number").notNull(), // 1-6
}, (table) => ({
  teacherIdIdx: index("teacher_unavail_teacher_id_idx").on(table.teacherId),
  compositeIdx: index("teacher_unavail_lookup_idx").on(table.teacherId, table.dayOfWeek, table.periodNumber),
})).enableRLS();

// Classes table
export const classes = pgTable("classes", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  grade: text("grade").notNull(),
  section: text("section"),
  language: text("language").notNull().default("uz"), // 'uz', 'ru'
  classTeacherId: integer("class_teacher_id").references(() => teachers.id),
  defaultRoomId: integer("default_room_id").references(() => rooms.id, { onDelete: "set null" }),
  totalStudents: integer("total_students").default(30),
  studyDays: text("study_days").notNull().default("1,2,3,4,5"), // "1,2,3,4,5" or "1,2,3,4,5,6"
  isActive: boolean("is_active").notNull().default(true),
}).enableRLS();

// Rooms table
export const rooms = pgTable("rooms", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  roomNumber: text("room_number").notNull(),
  building: text("building"),
  floor: text("floor"),
  capacity: integer("capacity").notNull(),
  // "classroom" | "lab" | "gym" | "computer" | "music" | "art"
  roomType: text("room_type").notNull().default("classroom"),
  isActive: boolean("is_active").notNull().default(true),
}).enableRLS();

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
}).enableRLS();

// Teacher-Subject junction (which subjects a teacher can teach)
export const teacherSubjects = pgTable("teacher_subjects", {
  id: serial("id").primaryKey(),
  teacherId: integer("teacher_id").references(() => teachers.id, { onDelete: "cascade" }).notNull(),
  subjectId: integer("subject_id").references(() => subjects.id, { onDelete: "cascade" }).notNull(),
}).enableRLS();

// Class-Subject assignments (which subjects a class studies, with teacher and weekly hours)
export const classSubjects = pgTable("class_subjects", {
  id: serial("id").primaryKey(),
  classId: integer("class_id").references(() => classes.id, { onDelete: "cascade" }).notNull(),
  subjectId: integer("subject_id").references(() => subjects.id, { onDelete: "cascade" }).notNull(),
  teacherId: integer("teacher_id").references(() => teachers.id),
  teacherId2: integer("teacher_id_2").references(() => teachers.id),
  roomId: integer("room_id").references(() => rooms.id, { onDelete: "set null" }),
  roomId2: integer("room_id_2").references(() => rooms.id, { onDelete: "set null" }),
  weeklyHours: real("weekly_hours").notNull().default(2),
  isSplit: boolean("is_split").default(false),
  splitType: text("split_type").default("none"),
  jointGroupId: text("joint_group_id"),
}, (table) => ({
  classIdIdx: index("class_subjects_class_id_idx").on(table.classId),
  teacherIdIdx: index("class_subjects_teacher_id_idx").on(table.teacherId),
})).enableRLS();

// Joint lessons table (combined lessons metadata)
export const jointLessons = pgTable("joint_lessons", {
  id: serial("id").primaryKey(),
  subjectId: integer("subject_id").references(() => subjects.id, { onDelete: "cascade" }).notNull(),
  weeklyHours: real("weekly_hours").notNull().default(2),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}).enableRLS();

// Joint lesson classes junction table
export const jointLessonClasses = pgTable("joint_lesson_classes", {
  id: serial("id").primaryKey(),
  jointLessonId: integer("joint_lesson_id").references(() => jointLessons.id, { onDelete: "cascade" }).notNull(),
  classId: integer("class_id").references(() => classes.id, { onDelete: "cascade" }).notNull(),
}, (table) => ({
  jointLessonIdIdx: index("joint_lesson_classes_joint_lesson_id_idx").on(table.jointLessonId),
  classIdIdx: index("joint_lesson_classes_class_id_idx").on(table.classId),
})).enableRLS();

// Joint lesson groups table (teacher-room division for a joint lesson)
export const jointLessonGroups = pgTable("joint_lesson_groups", {
  id: serial("id").primaryKey(),
  jointLessonId: integer("joint_lesson_id").references(() => jointLessons.id, { onDelete: "cascade" }).notNull(),
  groupName: text("group_name").notNull(),
  teacherId: integer("teacher_id").references(() => teachers.id, { onDelete: "cascade" }).notNull(),
  roomId: integer("room_id").references(() => rooms.id, { onDelete: "set null" }),
}, (table) => ({
  jointLessonIdIdx: index("joint_lesson_groups_joint_lesson_id_idx").on(table.jointLessonId),
  teacherIdIdx: index("joint_lesson_groups_teacher_id_idx").on(table.teacherId),
})).enableRLS();

// Schedule entries table (main timetable)
export const scheduleEntries = pgTable("schedule_entries", {
  id: serial("id").primaryKey(),
  classId: integer("class_id").references(() => classes.id).notNull(),
  subjectId: integer("subject_id").references(() => subjects.id).notNull(),
  teacherId: integer("teacher_id").references(() => teachers.id).notNull(),
  roomId: integer("room_id").references(() => rooms.id).notNull(),
  timeSlotId: integer("time_slot_id").references(() => timeSlots.id).notNull(),
  weekType: text("week_type").default("always").notNull(), // 'always' | 'surat' | 'mahraj'
  jointLessonId: integer("joint_lesson_id").references(() => jointLessons.id, { onDelete: "set null" }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  classIdIdx: index("schedule_entries_class_id_idx").on(table.classId),
  teacherIdIdx: index("schedule_entries_teacher_id_idx").on(table.teacherId),
  timeSlotIdIdx: index("schedule_entries_time_slot_id_idx").on(table.timeSlotId),
  activeIdx: index("schedule_entries_active_idx").on(table.isActive),
})).enableRLS();

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
}).enableRLS();

// Curriculum plans (DTS versiyalari) — har biri bitta rasmiy buyruqqa mos keladi.
// Yangi o'quv yil/qonun yangilanganda yangi plan yaratiladi, eskisi isActive=false qilinadi.
export const curriculumPlans = pgTable("curriculum_plans", {
  id: serial("id").primaryKey(),
  year: text("year").notNull(), // masalan "2025-2026"
  orderNumber: text("order_number"), // masalan "121-son buyruq, 10.04.2025"
  language: text("language").notNull(), // "uz" | "ru"
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}).enableRLS();

// Curriculum entries — bitta plan ichida grade x subject uchun haftalik soat.
export const curriculumEntries = pgTable("curriculum_entries", {
  id: serial("id").primaryKey(),
  planId: integer("plan_id").references(() => curriculumPlans.id, { onDelete: "cascade" }).notNull(),
  grade: integer("grade").notNull(),
  subjectName: text("subject_name").notNull(),
  codes: jsonb("codes").$type<string[]>().notNull().default([]),
  keywords: jsonb("keywords").$type<string[]>().notNull().default([]),
  weeklyHours: real("weekly_hours").notNull(),
  recommendedSpecialty: text("recommended_specialty"),
}, (table) => ({
  planIdIdx: index("curriculum_entries_plan_id_idx").on(table.planId),
  planGradeIdx: index("curriculum_entries_plan_grade_idx").on(table.planId, table.grade),
})).enableRLS();

// Umumiy sozlamalar (key-value): masalan classHourSlot — sinf soati kuni/vaqti
export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
}).enableRLS();

// User roles table
export const userRoles = pgTable("user_roles", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().unique(), // Supabase auth.users UUID
  role: text("role").notNull().default("teacher"), // "admin" | "teacher"
  createdAt: timestamp("created_at").notNull().defaultNow(),
}).enableRLS();

// Audit logs table
export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  userId: text("user_id"), // Supabase UUID as string
  action: text("action").notNull(),
  method: text("method").notNull(),
  path: text("path").notNull(),
  details: text("details"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}).enableRLS();

// Relations
export const teachersRelations = relations(teachers, ({ many }) => ({
  teacherSubjects: many(teacherSubjects),
  classSubjects: many(classSubjects),
  scheduleEntries: many(scheduleEntries),
  unavailability: many(teacherUnavailability),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  // Note: user relationship would depend on having a users table exposed, 
  // but Supabase auth users are in auth schema.
}));

export const teacherUnavailabilityRelations = relations(teacherUnavailability, ({ one }) => ({
  teacher: one(teachers, { fields: [teacherUnavailability.teacherId], references: [teachers.id] }),
}));

export const subjectsRelations = relations(subjects, ({ many }) => ({
  teacherSubjects: many(teacherSubjects),
  classSubjects: many(classSubjects),
  scheduleEntries: many(scheduleEntries),
}));

export const classesRelations = relations(classes, ({ one, many }) => ({
  classTeacher: one(teachers, { fields: [classes.classTeacherId], references: [teachers.id] }),
  defaultRoom: one(rooms, { fields: [classes.defaultRoomId], references: [rooms.id] }),
  classSubjects: many(classSubjects),
  scheduleEntries: many(scheduleEntries),
}));

export const roomsRelations = relations(rooms, ({ many }) => ({
  defaultClasses: many(classes),
  classSubjects: many(classSubjects),
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
  room: one(rooms, { fields: [classSubjects.roomId], references: [rooms.id] }),
}));

export const scheduleEntriesRelations = relations(scheduleEntries, ({ one }) => ({
  class: one(classes, { fields: [scheduleEntries.classId], references: [classes.id] }),
  subject: one(subjects, { fields: [scheduleEntries.subjectId], references: [subjects.id] }),
  teacher: one(teachers, { fields: [scheduleEntries.teacherId], references: [teachers.id] }),
  room: one(rooms, { fields: [scheduleEntries.roomId], references: [rooms.id] }),
  timeSlot: one(timeSlots, { fields: [scheduleEntries.timeSlotId], references: [timeSlots.id] }),
  jointLesson: one(jointLessons, { fields: [scheduleEntries.jointLessonId], references: [jointLessons.id] }),
}));

export const jointLessonsRelations = relations(jointLessons, ({ one, many }) => ({
  subject: one(subjects, { fields: [jointLessons.subjectId], references: [subjects.id] }),
  classes: many(jointLessonClasses),
  groups: many(jointLessonGroups),
  scheduleEntries: many(scheduleEntries),
}));

export const jointLessonClassesRelations = relations(jointLessonClasses, ({ one }) => ({
  jointLesson: one(jointLessons, { fields: [jointLessonClasses.jointLessonId], references: [jointLessons.id] }),
  class: one(classes, { fields: [jointLessonClasses.classId], references: [classes.id] }),
}));

export const jointLessonGroupsRelations = relations(jointLessonGroups, ({ one }) => ({
  jointLesson: one(jointLessons, { fields: [jointLessonGroups.jointLessonId], references: [jointLessons.id] }),
  teacher: one(teachers, { fields: [jointLessonGroups.teacherId], references: [teachers.id] }),
  room: one(rooms, { fields: [jointLessonGroups.roomId], references: [rooms.id] }),
}));

export const curriculumPlansRelations = relations(curriculumPlans, ({ many }) => ({
  entries: many(curriculumEntries),
}));

export const curriculumEntriesRelations = relations(curriculumEntries, ({ one }) => ({
  plan: one(curriculumPlans, { fields: [curriculumEntries.planId], references: [curriculumPlans.id] }),
}));

// Insert schemas
export const insertSubjectSchema = createInsertSchema(subjects).omit({ id: true });
export const insertTeacherSchema = createInsertSchema(teachers).omit({ id: true });
export const insertTeacherUnavailabilitySchema = createInsertSchema(teacherUnavailability).omit({ id: true });
export const insertClassSchema = createInsertSchema(classes).omit({ id: true });
export const insertRoomSchema = createInsertSchema(rooms).omit({ id: true });
export const insertTimeSlotSchema = createInsertSchema(timeSlots).omit({ id: true });
export const insertTeacherSubjectSchema = createInsertSchema(teacherSubjects).omit({ id: true });
export const insertClassSubjectSchema = createInsertSchema(classSubjects).omit({ id: true });
export const insertScheduleEntrySchema = createInsertSchema(scheduleEntries)
  .omit({ id: true, createdAt: true });
export const insertScheduleConflictSchema = createInsertSchema(scheduleConflicts).omit({ id: true, createdAt: true });
export const insertUserRoleSchema = createInsertSchema(userRoles).omit({ id: true, createdAt: true });
export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({ id: true, createdAt: true });
export const insertJointLessonSchema = createInsertSchema(jointLessons).omit({ id: true, createdAt: true });
export const insertJointLessonClassSchema = createInsertSchema(jointLessonClasses).omit({ id: true });
export const insertJointLessonGroupSchema = createInsertSchema(jointLessonGroups).omit({ id: true });
export const insertCurriculumPlanSchema = createInsertSchema(curriculumPlans).omit({ id: true, createdAt: true });
export const insertCurriculumEntrySchema = createInsertSchema(curriculumEntries).omit({ id: true });
export const insertAppSettingSchema = createInsertSchema(appSettings);

// Types
export type Subject = typeof subjects.$inferSelect;
export type InsertSubject = z.infer<typeof insertSubjectSchema>;
export type Teacher = typeof teachers.$inferSelect;
export type InsertTeacher = z.infer<typeof insertTeacherSchema>;
export type TeacherUnavailability = typeof teacherUnavailability.$inferSelect;
export type InsertTeacherUnavailability = z.infer<typeof insertTeacherUnavailabilitySchema>;
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
export type UserRole = typeof userRoles.$inferSelect;
export type InsertUserRole = z.infer<typeof insertUserRoleSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type JointLesson = typeof jointLessons.$inferSelect;
export type InsertJointLesson = z.infer<typeof insertJointLessonSchema>;
export type JointLessonClass = typeof jointLessonClasses.$inferSelect;
export type InsertJointLessonClass = z.infer<typeof insertJointLessonClassSchema>;
export type JointLessonGroup = typeof jointLessonGroups.$inferSelect;
export type InsertJointLessonGroup = z.infer<typeof insertJointLessonGroupSchema>;
export type CurriculumPlan = typeof curriculumPlans.$inferSelect;
export type InsertCurriculumPlan = z.infer<typeof insertCurriculumPlanSchema>;
export type CurriculumEntry = typeof curriculumEntries.$inferSelect;
export type InsertCurriculumEntry = z.infer<typeof insertCurriculumEntrySchema>;
export type AppSetting = typeof appSettings.$inferSelect;
export type InsertAppSetting = z.infer<typeof insertAppSettingSchema>;


// Login schema — Supabase Auth (email + password)
// Kuchli parol talablari: 8+ belgi, 1 katta harf, 1 kichik harf, 1 raqam
export const loginSchema = z.object({
  email: z.string().email("To'g'ri email kiriting"),
  password: z
    .string()
    .min(8, "Parol kamida 8 ta belgi bo'lishi kerak")
    .regex(/[A-Z]/, "Kamida 1 ta katta harf bo'lishi kerak")
    .regex(/[a-z]/, "Kamida 1 ta kichik harf bo'lishi kerak")
    .regex(/\d/, "Kamida 1 ta raqam bo'lishi kerak"),
});
export type LoginRequest = z.infer<typeof loginSchema>;

// App user type — Supabase user_metadata dan olinadi
export type User = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: "admin" | "teacher";
};

export { ROOM_TYPE_LABELS, ROOM_TYPES } from "./constants";
