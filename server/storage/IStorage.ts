import {
  subjects, teachers, classes, rooms, timeSlots, scheduleEntries, scheduleConflicts,
  teacherSubjects, classSubjects, teacherUnavailability,
  type Subject, type InsertSubject,
  type Teacher, type InsertTeacher,
  type TeacherUnavailability, type InsertTeacherUnavailability,
  type Class, type InsertClass,
  type Room, type InsertRoom,
  type TimeSlot, type InsertTimeSlot,
  type ScheduleEntry, type InsertScheduleEntry,
  type ScheduleConflict, type InsertScheduleConflict,
  type TeacherSubject, type InsertTeacherSubject,
  type ClassSubject, type InsertClassSubject,
  type JointLesson, type InsertJointLesson,
  type JointLessonClass, type InsertJointLessonClass,
  type JointLessonGroup, type InsertJointLessonGroup,
  type CurriculumPlan, type InsertCurriculumPlan,
  type CurriculumEntry, type InsertCurriculumEntry,
} from "@shared/schema";

export interface IStorage {
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

  getTeacherUnavailability(teacherId: number): Promise<TeacherUnavailability[]>;
  getAllTeacherUnavailability(): Promise<TeacherUnavailability[]>;
  setTeacherUnavailability(teacherId: number, slots: Array<{ dayOfWeek: number; periodNumber: number }>): Promise<void>;

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
  updateTimeSlot(id: number, data: Partial<InsertTimeSlot>): Promise<TimeSlot | undefined>;
  deleteTimeSlot(id: number): Promise<boolean>;
  deleteAllTimeSlots(): Promise<void>;

  getScheduleEntries(): Promise<ScheduleEntry[]>;
  getScheduleEntriesByClass(classId: number): Promise<ScheduleEntry[]>;
  getScheduleEntriesByTeacher(teacherId: number): Promise<ScheduleEntry[]>;
  createScheduleEntry(data: InsertScheduleEntry): Promise<ScheduleEntry>;
  createScheduleEntriesBulk(data: InsertScheduleEntry[]): Promise<ScheduleEntry[]>;
  updateScheduleEntry(id: number, data: Partial<InsertScheduleEntry>): Promise<ScheduleEntry | undefined>;
  deleteScheduleEntry(id: number): Promise<boolean>;
  deleteAllScheduleEntries(): Promise<void>;
  clearScheduleForClass(classId: number): Promise<void>;

  getUnresolvedConflicts(): Promise<ScheduleConflict[]>;
  createConflict(data: InsertScheduleConflict): Promise<ScheduleConflict>;
  resolveConflict(id: number): Promise<boolean>;
  clearConflicts(): Promise<void>;

  getJointLessons(): Promise<any[]>;
  getJointLessonById(id: number): Promise<any>;
  createJointLesson(data: { subjectId: number; weeklyHours: number; classIds: number[]; groups: Array<{ groupName: string; teacherId: number; roomId?: number | null }> }): Promise<any>;
  updateJointLesson(id: number, data: { subjectId: number; weeklyHours: number; classIds: number[]; groups: Array<{ groupName: string; teacherId: number; roomId?: number | null }> }): Promise<any>;
  deleteJointLesson(id: number): Promise<boolean>;

  getCurriculumPlans(): Promise<CurriculumPlan[]>;
  getActiveCurriculumPlan(language: string): Promise<CurriculumPlan | undefined>;
  createCurriculumPlan(data: InsertCurriculumPlan): Promise<CurriculumPlan>;
  activateCurriculumPlan(id: number): Promise<CurriculumPlan | undefined>;
  getCurriculumEntries(planId: number): Promise<CurriculumEntry[]>;
  createCurriculumEntry(data: InsertCurriculumEntry): Promise<CurriculumEntry>;
  updateCurriculumEntry(id: number, data: Partial<InsertCurriculumEntry>): Promise<CurriculumEntry | undefined>;
  deleteCurriculumEntry(id: number): Promise<boolean>;

  getDashboardStats(): Promise<{
    totalClasses: number;
    totalTeachers: number;
    totalSubjects: number;
    totalRooms: number;
    totalScheduled: number;
    activeConflicts: number;
  }>;
}
