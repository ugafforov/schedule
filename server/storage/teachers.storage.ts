import { db } from "../db";
import { teachers, teacherSubjects, teacherUnavailability, type Teacher, type InsertTeacher, type TeacherSubject, type TeacherUnavailability } from "@shared/schema";
import { eq } from "drizzle-orm";

export class TeacherStorage {
  async getTeachers(): Promise<Teacher[]> {
    return db.query.teachers.findMany({
      where: eq(teachers.isActive, true),
      with: {
        teacherSubjects: true,
        unavailability: true,
      },
    });
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

  async getTeacherUnavailability(teacherId: number): Promise<TeacherUnavailability[]> {
    return db.select().from(teacherUnavailability).where(eq(teacherUnavailability.teacherId, teacherId));
  }
  async getAllTeacherUnavailability(): Promise<TeacherUnavailability[]> {
    const results = await db.select({
      id: teacherUnavailability.id,
      teacherId: teacherUnavailability.teacherId,
      dayOfWeek: teacherUnavailability.dayOfWeek,
      periodNumber: teacherUnavailability.periodNumber,
    })
    .from(teacherUnavailability)
    .innerJoin(teachers, eq(teacherUnavailability.teacherId, teachers.id))
    .where(eq(teachers.isActive, true));
    return results as any;
  }
  async setTeacherUnavailability(
    teacherId: number,
    slots: Array<{ dayOfWeek: number; periodNumber: number }>
  ): Promise<void> {
    await db.delete(teacherUnavailability).where(eq(teacherUnavailability.teacherId, teacherId));
    if (slots.length > 0) {
      await db.insert(teacherUnavailability).values(
        slots.map(s => ({ teacherId, dayOfWeek: s.dayOfWeek, periodNumber: s.periodNumber }))
      );
    }
  }
}
