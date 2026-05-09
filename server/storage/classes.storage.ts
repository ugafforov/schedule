import { db } from "../db";
import { classes, classSubjects, type Class, type InsertClass, type ClassSubject } from "@shared/schema";
import { eq } from "drizzle-orm";

export class ClassStorage {
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
    const results = await db.select({
      id: classSubjects.id,
      classId: classSubjects.classId,
      subjectId: classSubjects.subjectId,
      teacherId: classSubjects.teacherId,
      teacherId2: classSubjects.teacherId2,
      weeklyHours: classSubjects.weeklyHours,
    })
    .from(classSubjects)
    .innerJoin(classes, eq(classSubjects.classId, classes.id))
    .where(eq(classes.isActive, true));
    return results as any;
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
}
