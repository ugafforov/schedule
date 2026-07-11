import { db } from "../db";
import { 
  classes, classSubjects, jointLessons, jointLessonClasses, jointLessonGroups, teachers, rooms, scheduleEntries,
  type Class, type InsertClass, type ClassSubject 
} from "@shared/schema";
import { eq, sql } from "drizzle-orm";

export class ClassStorage {
  async getClasses(): Promise<Class[]> {
    const data = await db.select().from(classes).where(eq(classes.isActive, true));
    return data.sort((a, b) => {
      const ga = parseInt(a.grade) || 0;
      const gb = parseInt(b.grade) || 0;
      if (ga !== gb) return ga - gb;
      return (a.section || "").localeCompare(b.section || "");
    });
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
    const results = await db.select({
      id: classSubjects.id,
      classId: classSubjects.classId,
      subjectId: classSubjects.subjectId,
      teacherId: classSubjects.teacherId,
      teacherId2: classSubjects.teacherId2,
      roomId: classSubjects.roomId,
      weeklyHours: classSubjects.weeklyHours,
    })
    .from(classSubjects)
    .innerJoin(classes, eq(classSubjects.classId, classes.id))
    .where(eq(classes.isActive, true));
    return results as any;
  }
  async setClassSubjects(classId: number, items: Array<{ subjectId: number; teacherId: number | null; roomId?: number | null; weeklyHours: number }>): Promise<void> {
    await db.delete(classSubjects).where(eq(classSubjects.classId, classId));
    if (items.length > 0) {
      await db.insert(classSubjects).values(items.map(item => ({
        classId,
        subjectId: item.subjectId,
        teacherId: item.teacherId,
        roomId: item.roomId || null,
        weeklyHours: item.weeklyHours,
      })));
    }
  }

  // Joint Lessons
  async getJointLessons(): Promise<any[]> {
    const lessons = await db.select().from(jointLessons).where(eq(jointLessons.isActive, true));
    if (lessons.length === 0) return [];

    const jlClasses = await db.select({
      id: jointLessonClasses.id,
      jointLessonId: jointLessonClasses.jointLessonId,
      classId: jointLessonClasses.classId,
      className: classes.name
    })
    .from(jointLessonClasses)
    .innerJoin(classes, eq(jointLessonClasses.classId, classes.id));

    const jlGroups = await db.select({
      id: jointLessonGroups.id,
      jointLessonId: jointLessonGroups.jointLessonId,
      groupName: jointLessonGroups.groupName,
      teacherId: jointLessonGroups.teacherId,
      teacherName: sql<string>`${teachers.firstName} || ' ' || ${teachers.lastName}`,
      roomId: jointLessonGroups.roomId,
      roomName: rooms.name
    })
    .from(jointLessonGroups)
    .innerJoin(teachers, eq(jointLessonGroups.teacherId, teachers.id))
    .leftJoin(rooms, eq(jointLessonGroups.roomId, rooms.id));

    return lessons.map(l => {
      const lessonClasses = jlClasses.filter(c => c.jointLessonId === l.id);
      const lessonGroups = jlGroups.filter(g => g.jointLessonId === l.id);
      return {
        ...l,
        classIds: lessonClasses.map(c => c.classId),
        classes: lessonClasses,
        groups: lessonGroups
      };
    });
  }

  async getJointLessonById(id: number): Promise<any> {
    const [lesson] = await db.select().from(jointLessons).where(eq(jointLessons.id, id));
    if (!lesson) return undefined;

    const jlClasses = await db.select({
      id: jointLessonClasses.id,
      classId: jointLessonClasses.classId,
      className: classes.name
    })
    .from(jointLessonClasses)
    .innerJoin(classes, eq(jointLessonClasses.classId, classes.id))
    .where(eq(jointLessonClasses.jointLessonId, id));

    const jlGroups = await db.select({
      id: jointLessonGroups.id,
      groupName: jointLessonGroups.groupName,
      teacherId: jointLessonGroups.teacherId,
      teacherName: sql<string>`${teachers.firstName} || ' ' || ${teachers.lastName}`,
      roomId: jointLessonGroups.roomId,
      roomName: rooms.name
    })
    .from(jointLessonGroups)
    .innerJoin(teachers, eq(jointLessonGroups.teacherId, teachers.id))
    .leftJoin(rooms, eq(jointLessonGroups.roomId, rooms.id))
    .where(eq(jointLessonGroups.jointLessonId, id));

    return {
      ...lesson,
      classIds: jlClasses.map(c => c.classId),
      classes: jlClasses,
      groups: jlGroups
    };
  }

  async createJointLesson(data: { subjectId: number; weeklyHours: number; classIds: number[]; groups: Array<{ groupName: string; teacherId: number; roomId?: number | null }> }): Promise<any> {
    return await db.transaction(async (tx) => {
      const [lesson] = await tx.insert(jointLessons).values({
        subjectId: data.subjectId,
        weeklyHours: data.weeklyHours,
        isActive: true
      }).returning();

      if (data.classIds.length > 0) {
        await tx.insert(jointLessonClasses).values(
          data.classIds.map(cid => ({
            jointLessonId: lesson.id,
            classId: cid
          }))
        );
      }

      if (data.groups.length > 0) {
        await tx.insert(jointLessonGroups).values(
          data.groups.map(g => ({
            jointLessonId: lesson.id,
            groupName: g.groupName,
            teacherId: g.teacherId,
            roomId: g.roomId || null
          }))
        );
      }

      return lesson;
    });
  }

  async updateJointLesson(id: number, data: { subjectId: number; weeklyHours: number; classIds: number[]; groups: Array<{ groupName: string; teacherId: number; roomId?: number | null }> }): Promise<any> {
    return await db.transaction(async (tx) => {
      const [lesson] = await tx.update(jointLessons).set({
        subjectId: data.subjectId,
        weeklyHours: data.weeklyHours
      }).where(eq(jointLessons.id, id)).returning();

      await tx.delete(jointLessonClasses).where(eq(jointLessonClasses.jointLessonId, id));
      await tx.delete(jointLessonGroups).where(eq(jointLessonGroups.jointLessonId, id));

      if (data.classIds.length > 0) {
        await tx.insert(jointLessonClasses).values(
          data.classIds.map(cid => ({
            jointLessonId: id,
            classId: cid
          }))
        );
      }

      if (data.groups.length > 0) {
        await tx.insert(jointLessonGroups).values(
          data.groups.map(g => ({
            jointLessonId: id,
            groupName: g.groupName,
            teacherId: g.teacherId,
            roomId: g.roomId || null
          }))
        );
      }

      return lesson;
    });
  }

  async deleteJointLesson(id: number): Promise<boolean> {
    return await db.transaction(async (tx) => {
      const [r] = await tx.update(jointLessons).set({ isActive: false }).where(eq(jointLessons.id, id)).returning();
      if (!r) return false;
      
      // Also soft-delete all schedule entries associated with this joint lesson
      await tx.update(scheduleEntries)
        .set({ isActive: false })
        .where(eq(scheduleEntries.jointLessonId, id));
        
      return true;
    });
  }
}
