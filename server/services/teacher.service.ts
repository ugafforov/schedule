import { storage } from "../storage/index";
import { db } from "../db";
import { classSubjects, teacherSubjects } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { UZBEK_CURRICULUM } from "@shared/curriculum";
import { getSpecialty } from "./curriculum.service";

const DEFAULT_MAX_HOURS = 24;

export async function autoGenerateTeachers() {
  const [allSubjects, allClasses, allTeachers, existingClassSubjects] = await Promise.all([
    storage.getSubjects(),
    storage.getClasses(),
    storage.getTeachers(),
    storage.getAllClassSubjects(),
  ]);

  const updatedAssignmentsByClass = new Map<number, any[]>();
  let createdTeachersCount = 0;
  const unassignedBySpecialty = new Map<string, any[]>();

  for (const cls of allClasses) {
    const gradeRequirements = UZBEK_CURRICULUM[cls.grade];
    if (!gradeRequirements) {
      updatedAssignmentsByClass.set(
        cls.id,
        existingClassSubjects.filter((cs) => cs.classId === cls.id)
      );
      continue;
    }

    const newAssignments: any[] = [];
    const processedSubjectIds = new Set<number>();

    for (const [subjectName, hours] of Object.entries(gradeRequirements)) {
      let subject = allSubjects.find(
        (s) => s.name.toLowerCase() === subjectName.toLowerCase()
      );

      if (!subject) {
        subject = await storage.createSubject({
          name: subjectName,
          code: subjectName.replace(/\s+/g, "_").toUpperCase(),
          color: "#" + Math.floor(Math.random() * 16777215).toString(16),
          isActive: true,
        });
        allSubjects.push(subject);
      }

      processedSubjectIds.add(subject.id);
      const specialty = getSpecialty(subjectName, cls.grade);

      const existing = existingClassSubjects.find(
        (cs) => cs.classId === cls.id && cs.subjectId === subject!.id
      );
      let teacherId = existing?.teacherId || null;

      if (teacherId) {
        const t = allTeachers.find((x) => x.id === teacherId);
        if (!t) {
          teacherId = null;
        } else {
          const tSpecialty = getSpecialty(t.specialization || "", cls.grade);
          if (tSpecialty !== specialty && t.firstName.toLowerCase().includes("vakant")) {
            teacherId = null;
          }
        }
      }

      const entry = {
        classId: cls.id,
        subjectId: subject.id,
        teacherId,
        weeklyHours: hours as number,
        specialty,
        grade: cls.grade,
      };

      newAssignments.push(entry);
      if (!teacherId) {
        if (!unassignedBySpecialty.has(specialty)) unassignedBySpecialty.set(specialty, []);
        unassignedBySpecialty.get(specialty)!.push(entry);
      }
    }

    const nonDtsAssignments = existingClassSubjects.filter(
      (cs) => cs.classId === cls.id && !processedSubjectIds.has(cs.subjectId)
    );
    updatedAssignmentsByClass.set(cls.id, [...newAssignments, ...nonDtsAssignments]);
  }

  for (const [specialty, assignments] of Array.from(unassignedBySpecialty.entries())) {
    if (assignments.length === 0) continue;

    const matchingTeachers = allTeachers.filter(
      (t) =>
        t.isActive &&
        (getSpecialty(t.specialization || "", "5") === specialty ||
          t.firstName.includes(specialty))
    );

    for (const teacher of matchingTeachers) {
      let currentLoad = 0;
      for (const list of Array.from(updatedAssignmentsByClass.values())) {
        for (const a of list) {
          if (a.teacherId === teacher.id) currentLoad += a.weeklyHours;
        }
      }
      for (let i = 0; i < assignments.length; i++) {
        const a = assignments[i];
        if (currentLoad + a.weeklyHours <= (teacher.maxHoursPerWeek || DEFAULT_MAX_HOURS)) {
          a.teacherId = teacher.id;
          currentLoad += a.weeklyHours;
          assignments.splice(i, 1);
          i--;
        }
      }
    }

    while (assignments.length > 0) {
      const suffix = createdTeachersCount > 0 ? ` ${createdTeachersCount + 1}` : "";
      const newTeacher = await storage.createTeacher({
        firstName: specialty,
        lastName: `vakant${suffix}`,
        employeeId: `VAK_${specialty.slice(0, 3).toUpperCase()}_${Date.now().toString().slice(-4)}_${createdTeachersCount}`,
        department: "Avtomatik",
        specialization: specialty,
        maxHoursPerWeek: DEFAULT_MAX_HOURS,
        isActive: true,
      });
      createdTeachersCount++;
      allTeachers.push(newTeacher);

      let currentLoad = 0;
      for (let i = 0; i < assignments.length; i++) {
        const a = assignments[i];
        if (currentLoad + a.weeklyHours <= DEFAULT_MAX_HOURS) {
          a.teacherId = newTeacher.id;
          currentLoad += a.weeklyHours;
          assignments.splice(i, 1);
          i--;
        }
      }
    }
  }

  for (const [classId, items] of Array.from(updatedAssignmentsByClass.entries())) {
    const toSave = items.map(({ classId, subjectId, teacherId, weeklyHours }: any) => ({
      classId,
      subjectId,
      teacherId,
      weeklyHours,
    }));
    await storage.setClassSubjects(classId, toSave);
  }

  return {
    message: `${createdTeachersCount} ta yangi vakant o'qituvchi yaratildi. Jami darslar DTS asosida yangilandi.`,
    teachersCreated: createdTeachersCount,
  };
}

export async function autoDistributeAll() {
  const [allSubjects, allTeachers, allTeacherSubjects, allClassSubjects] = await Promise.all([
    storage.getSubjects(),
    storage.getTeachers(),
    db.select().from(teacherSubjects),
    storage.getAllClassSubjects(),
  ]);

  const teacherSubjectMap = new Map<number, Set<number>>();
  for (const ts of allTeacherSubjects) {
    if (!teacherSubjectMap.has(ts.teacherId)) teacherSubjectMap.set(ts.teacherId, new Set());
    teacherSubjectMap.get(ts.teacherId)!.add(ts.subjectId);
  }

  const teacherLoadMap = new Map<number, number>();
  for (const cs of allClassSubjects) {
    if (cs.teacherId) {
      teacherLoadMap.set(cs.teacherId, (teacherLoadMap.get(cs.teacherId) || 0) + cs.weeklyHours);
    }
  }

  let assignedCount = 0;
  const unassignedCS = allClassSubjects.filter((cs) => !cs.teacherId);

  for (const cs of unassignedCS) {
    const candidates = allTeachers.filter((t) => {
      const subjects = teacherSubjectMap.get(t.id) || new Set();
      const currentLoad = teacherLoadMap.get(t.id) || 0;
      return subjects.has(cs.subjectId) && currentLoad + cs.weeklyHours <= (t.maxHoursPerWeek || 30);
    });

    if (candidates.length > 0) {
      candidates.sort((a, b) => (teacherLoadMap.get(a.id) || 0) - (teacherLoadMap.get(b.id) || 0));
      const best = candidates[0];
      cs.teacherId = best.id;
      teacherLoadMap.set(best.id, (teacherLoadMap.get(best.id) || 0) + cs.weeklyHours);
      assignedCount++;
    }
  }

  const assignmentsByClass = new Map<number, any[]>();
  for (const cs of allClassSubjects) {
    if (!assignmentsByClass.has(cs.classId)) assignmentsByClass.set(cs.classId, []);
    assignmentsByClass.get(cs.classId)!.push({
      subjectId: cs.subjectId,
      teacherId: cs.teacherId,
      weeklyHours: cs.weeklyHours,
    });
  }

  for (const [classId, items] of Array.from(assignmentsByClass.entries())) {
    await storage.setClassSubjects(classId, items);
  }

  return {
    message: `${assignedCount} ta dars o'qituvchilarga avtomatik taqsimlandi.`,
    assignedCount,
  };
}
