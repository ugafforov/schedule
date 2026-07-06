import { storage } from "../storage/index";
import { db } from "../db";
import { classSubjects, teacherSubjects, type Subject, type Class, type Teacher, type ClassSubject } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { getCurriculumForGrade, getAutoAssignments, getSpecialty } from "./curriculum.service";

const DEFAULT_MAX_HOURS = 30;

import { isPrimaryTeacherFromSpecialty, pickBestTeacher, scoreTeacherForSubject } from "@shared/teacher-matching";
import { parseGrade } from "@shared/constants";

interface AssignmentEntry {
  classId: number;
  subjectId: number;
  teacherId: number | null;
  weeklyHours: number;
  specialty: string;
  grade: number | string;
}

export async function autoGenerateTeachers() {
  const [allSubjects, allClasses, allTeachers, existingClassSubjects] = await Promise.all([
    storage.getSubjects(),
    storage.getClasses(),
    storage.getTeachers(),
    storage.getAllClassSubjects(),
  ]);

  // Boshlang'ich sinf vacant o'qituvchilari ko'p sinfga biriktirilgan bo'lsa, ularni tozalash (qayta taqsimlash uchun)
  const primaryVacantClassCount = new Map<number, Set<number>>();
  for (const cs of existingClassSubjects) {
    if (cs.teacherId) {
      const t = allTeachers.find((x) => x.id === cs.teacherId);
      if (t && t.isVacant && t.gradeLevel === "primary") {
        if (!primaryVacantClassCount.has(t.id)) primaryVacantClassCount.set(t.id, new Set());
        primaryVacantClassCount.get(t.id)!.add(cs.classId);
      }
    }
  }

  for (const cs of existingClassSubjects) {
    if (cs.teacherId) {
      const classIds = primaryVacantClassCount.get(cs.teacherId);
      if (classIds && classIds.size > 1) {
        cs.teacherId = null;
      }
    }
  }

  const updatedAssignmentsByClass = new Map<number, (AssignmentEntry | ClassSubject)[]>();
  let createdTeachersCount = 0;
  const unassignedBySpecialty = new Map<string, AssignmentEntry[]>();

  for (const cls of allClasses) {
    const gradeRequirements = await getCurriculumForGrade(parseGrade(cls.grade), cls.language || "uz");
    if (Object.keys(gradeRequirements).length === 0) {
      updatedAssignmentsByClass.set(
        cls.id,
        existingClassSubjects.filter((cs) => cs.classId === cls.id)
      );
      continue;
    }

    const newAssignments: AssignmentEntry[] = [];
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
      const specialty = getSpecialty(subjectName, cls.grade, cls.language || "uz");

      const existing = existingClassSubjects.find(
        (cs) => cs.classId === cls.id && cs.subjectId === subject!.id
      );
      let teacherId = existing?.teacherId || null;

      if (teacherId) {
        const t = allTeachers.find((x) => x.id === teacherId);
        if (!t) {
          teacherId = null;
        } else {
          const tSpecialty = getSpecialty(t.specialization || "", "5", cls.language || "uz");
          if (tSpecialty !== specialty && t.isVacant) {
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

    const firstAssignment = assignments[0];
    const targetClass = firstAssignment ? allClasses.find(c => c.id === firstAssignment.classId) : null;
    const grade = targetClass ? String(targetClass.grade) : "5";
    const language = targetClass ? targetClass.language || "uz" : "uz";

    const matchingTeachers = allTeachers.filter(
      (t) =>
        t.isActive &&
        (getSpecialty(t.specialization || "", "5", language) === specialty ||
          t.firstName.includes(specialty))
    );

    const isPrimarySpecialty = specialty === "Boshlang'ich sinf o'qituvchisi";

    for (const teacher of matchingTeachers) {
      let currentLoad = 0;
      let teacherClassId: number | null = null;
      for (const list of Array.from(updatedAssignmentsByClass.values())) {
        for (const a of list) {
          if (a.teacherId === teacher.id) {
            currentLoad += a.weeklyHours;
            teacherClassId = a.classId;
          }
        }
      }

      for (let i = 0; i < assignments.length; i++) {
        const a = assignments[i];

        // Boshlang'ich o'qituvchilar faqat bitta sinfda dars berishi mumkin
        if (isPrimarySpecialty && teacherClassId !== null && a.classId !== teacherClassId) {
          continue;
        }

        if (currentLoad + a.weeklyHours <= (teacher.maxHoursPerWeek || DEFAULT_MAX_HOURS)) {
          a.teacherId = teacher.id;
          currentLoad += a.weeklyHours;
          if (isPrimarySpecialty && teacherClassId === null) {
            teacherClassId = a.classId;
          }
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
        gradeLevel: specialty === "Boshlang'ich sinf o'qituvchisi" ? "primary" : "high",
        isVacant: true,
        isActive: true,
      });
      createdTeachersCount++;
      allTeachers.push(newTeacher);

      let currentLoad = 0;
      let newTeacherClassId: number | null = null;
      const assignedSubjectIds = new Set<number>();

      for (let i = 0; i < assignments.length; i++) {
        const a = assignments[i];

        // Boshlang'ich o'qituvchilar faqat bitta sinfda dars berishi mumkin
        if (isPrimarySpecialty && newTeacherClassId !== null && a.classId !== newTeacherClassId) {
          continue;
        }

        if (currentLoad + a.weeklyHours <= DEFAULT_MAX_HOURS) {
          a.teacherId = newTeacher.id;
          currentLoad += a.weeklyHours;
          assignedSubjectIds.add(a.subjectId);
          if (isPrimarySpecialty && newTeacherClassId === null) {
            newTeacherClassId = a.classId;
          }
          assignments.splice(i, 1);
          i--;
        }
      }

      if (assignedSubjectIds.size > 0) {
        await storage.setTeacherSubjects(newTeacher.id, Array.from(assignedSubjectIds));
      }
    }
  }

  for (const [classId, items] of Array.from(updatedAssignmentsByClass.entries())) {
    const toSave = items.map(({ classId, subjectId, teacherId, weeklyHours }: AssignmentEntry | ClassSubject) => ({
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

async function syncPrimaryTeacherGradeLevels(allTeachers: Teacher[]) {
  for (const t of allTeachers) {
    if (isPrimaryTeacherFromSpecialty(t) && t.gradeLevel !== "primary") {
      await storage.updateTeacher(t.id, { gradeLevel: "primary" });
      t.gradeLevel = "primary";
    }
  }
}

function countEligibleTeachers(
  allTeachers: Teacher[],
  teacherSubjectMap: Map<number, Set<number>>,
  teacherLoadMap: Map<number, number>,
  teacherClassMap: Map<number, Set<number>>,
  subject: Subject,
  classInfo: Class | undefined,
  weeklyHours: number,
): number {
  const language = classInfo ? (classInfo.language || "uz") : "uz";
  return allTeachers.filter((t) =>
    scoreTeacherForSubject(
      {
        teacher: t,
        teacherSubjectIds: teacherSubjectMap.get(t.id) || new Set(),
        currentHours: teacherLoadMap.get(t.id) || 0,
        assignedClassIds: teacherClassMap.get(t.id) || new Set(),
      },
      {
        subjectId: subject.id,
        subjectName: subject.name,
        classGrade: classInfo?.grade || "5",
        language,
        weeklyHours,
        classId: classInfo?.id,
      },
    ) >= 0,
  ).length;
}

function sortAssignmentsForDistribution(
  entries: ClassSubject[],
  allSubjects: Subject[],
  allClasses: Class[],
  allTeachers: Teacher[],
  teacherSubjectMap: Map<number, Set<number>>,
  teacherLoadMap: Map<number, number>,
  teacherClassMap: Map<number, Set<number>>,
): ClassSubject[] {
  return [...entries].sort((a, b) => {
    const classA = allClasses.find(c => c.id === a.classId);
    const classB = allClasses.find(c => c.id === b.classId);
    const subjectA = allSubjects.find(s => s.id === a.subjectId);
    const subjectB = allSubjects.find(s => s.id === b.subjectId);
    if (!subjectA || !subjectB) return 0;

    const eligibleA = countEligibleTeachers(allTeachers, teacherSubjectMap, teacherLoadMap, teacherClassMap, subjectA, classA, a.weeklyHours);
    const eligibleB = countEligibleTeachers(allTeachers, teacherSubjectMap, teacherLoadMap, teacherClassMap, subjectB, classB, b.weeklyHours);
    if (eligibleA !== eligibleB) return eligibleA - eligibleB;

    const gradeA = parseInt(classA?.grade || "0");
    const gradeB = parseInt(classB?.grade || "0");
    if (gradeA !== gradeB) return gradeA - gradeB;

    return a.classId - b.classId || a.subjectId - b.subjectId;
  });
}

function assignTeachersToEntries(
  entries: ClassSubject[],
  allSubjects: Subject[],
  allClasses: Class[],
  allTeachers: Teacher[],
  teacherSubjectMap: Map<number, Set<number>>,
  teacherLoadMap: Map<number, number>,
  teacherClassMap: Map<number, Set<number>>,
): number {
  let assignedCount = 0;
  for (const cs of entries) {
    if (cs.teacherId) continue;
    const classInfo = allClasses.find(c => c.id === cs.classId);
    const subject = allSubjects.find(s => s.id === cs.subjectId);
    if (!subject) continue;

    const best = findTeacherForClassSubject(
      allTeachers, teacherSubjectMap, teacherLoadMap, teacherClassMap, subject, classInfo, cs.weeklyHours,
    );

    if (best) {
      cs.teacherId = best.id;
      teacherLoadMap.set(best.id, (teacherLoadMap.get(best.id) || 0) + cs.weeklyHours);
      if (!teacherClassMap.has(best.id)) teacherClassMap.set(best.id, new Set());
      teacherClassMap.get(best.id)!.add(cs.classId);
      assignedCount++;
    }
  }
  return assignedCount;
}

function findTeacherForClassSubject(
  allTeachers: Teacher[],
  teacherSubjectMap: Map<number, Set<number>>,
  teacherLoadMap: Map<number, number>,
  teacherClassMap: Map<number, Set<number>>,
  subject: Subject,
  classInfo: Class | undefined,
  weeklyHours: number,
) {
  return pickBestTeacher(allTeachers, teacherSubjectMap, teacherLoadMap, {
    subjectId: subject.id,
    subjectName: subject.name,
    classGrade: classInfo?.grade || "5",
    language: classInfo ? (classInfo.language || "uz") : "uz",
    weeklyHours,
    classId: classInfo?.id,
  }, teacherClassMap);
}

// ─── Faqat bo'sh fanlarni biriktirish ─────────────────────────────────────────
// (Eski autoDistributeAll shu funksiya bilan bayt-baytiga bir xil edi — o'chirildi)
export async function autoDistributeUnassignedOnly(classIds?: number[]) {
  const [allSubjects, allTeachers, allTeacherSubjects, allClassSubjects, allClasses] = await Promise.all([
    storage.getSubjects(),
    storage.getTeachers(),
    db.select().from(teacherSubjects),
    storage.getAllClassSubjects(),
    storage.getClasses(),
  ]);

  await syncPrimaryTeacherGradeLevels(allTeachers);

  const teacherSubjectMap = new Map<number, Set<number>>();
  for (const ts of allTeacherSubjects) {
    if (!teacherSubjectMap.has(ts.teacherId)) teacherSubjectMap.set(ts.teacherId, new Set());
    teacherSubjectMap.get(ts.teacherId)!.add(ts.subjectId);
  }

  const teacherLoadMap = new Map<number, number>();
  const teacherClassMap = new Map<number, Set<number>>();
  for (const cs of allClassSubjects) {
    if (cs.teacherId) {
      teacherLoadMap.set(cs.teacherId, (teacherLoadMap.get(cs.teacherId) || 0) + cs.weeklyHours);
      if (!teacherClassMap.has(cs.teacherId)) teacherClassMap.set(cs.teacherId, new Set());
      teacherClassMap.get(cs.teacherId)!.add(cs.classId);
    }
  }

  let assignedCount = 0;
  let unassignedCS = allClassSubjects.filter((cs) => !cs.teacherId);
  if (classIds && classIds.length > 0) {
    unassignedCS = unassignedCS.filter((cs) => classIds.includes(cs.classId));
  }

  for (const cs of unassignedCS) {
    const classInfo = allClasses.find(c => c.id === cs.classId);
    const subject = allSubjects.find(s => s.id === cs.subjectId);
    if (!subject) continue;

    const best = findTeacherForClassSubject(
      allTeachers, teacherSubjectMap, teacherLoadMap, teacherClassMap, subject, classInfo, cs.weeklyHours,
    );

    if (best) {
      cs.teacherId = best.id;
      teacherLoadMap.set(best.id, (teacherLoadMap.get(best.id) || 0) + cs.weeklyHours);
      if (!teacherClassMap.has(best.id)) teacherClassMap.set(best.id, new Set());
      teacherClassMap.get(best.id)!.add(cs.classId);
      assignedCount++;
    }
  }

  const assignmentsByClass = new Map<number, Array<{ subjectId: number; teacherId: number | null; weeklyHours: number }>>();
  for (const cs of allClassSubjects) {
    if (!assignmentsByClass.has(cs.classId)) assignmentsByClass.set(cs.classId, []);
    assignmentsByClass.get(cs.classId)!.push({
      subjectId: cs.subjectId,
      teacherId: cs.teacherId,
      weeklyHours: cs.weeklyHours,
    });
  }

  const classesToSave = classIds && classIds.length > 0 ? classIds : Array.from(assignmentsByClass.keys());
  for (const classId of classesToSave) {
    const items = assignmentsByClass.get(classId) || [];
    await storage.setClassSubjects(classId, items);
  }

  return {
    message: `${assignedCount} ta bo'sh dars o'qituvchilarga avtomatik taqsimlandi.`,
    assignedCount,
  };
}

// ─── Barcha fanlarni qayta biriktirish (yangi funksiya) ───────────────────────
export async function autoDistributeAllForceReassign(classIds?: number[]) {
  const [allSubjects, allTeachers, allTeacherSubjects, allClassSubjects, allClasses] = await Promise.all([
    storage.getSubjects(),
    storage.getTeachers(),
    db.select().from(teacherSubjects),
    storage.getAllClassSubjects(),
    storage.getClasses(),
  ]);

  await syncPrimaryTeacherGradeLevels(allTeachers);

  const teacherSubjectMap = new Map<number, Set<number>>();
  for (const ts of allTeacherSubjects) {
    if (!teacherSubjectMap.has(ts.teacherId)) teacherSubjectMap.set(ts.teacherId, new Set());
    teacherSubjectMap.get(ts.teacherId)!.add(ts.subjectId);
  }

  const teacherLoadMap = new Map<number, number>();
  const teacherClassMap = new Map<number, Set<number>>();

  for (const cs of allClassSubjects) {
    const shouldReset = !classIds || classIds.length === 0 || classIds.includes(cs.classId);
    if (shouldReset) {
      cs.teacherId = null;
    } else if (cs.teacherId) {
      teacherLoadMap.set(cs.teacherId, (teacherLoadMap.get(cs.teacherId) || 0) + cs.weeklyHours);
      if (!teacherClassMap.has(cs.teacherId)) teacherClassMap.set(cs.teacherId, new Set());
      teacherClassMap.get(cs.teacherId)!.add(cs.classId);
    }
  }

  let assignedCount = 0;
  let targetCS = allClassSubjects;
  if (classIds && classIds.length > 0) {
    targetCS = allClassSubjects.filter((cs) => classIds.includes(cs.classId));
  }

  const sortedTarget = sortAssignmentsForDistribution(
    targetCS, allSubjects, allClasses, allTeachers, teacherSubjectMap, teacherLoadMap, teacherClassMap,
  );

  for (let pass = 0; pass < 5; pass++) {
    const passAssigned = assignTeachersToEntries(
      sortedTarget, allSubjects, allClasses, allTeachers, teacherSubjectMap, teacherLoadMap, teacherClassMap,
    );
    assignedCount += passAssigned;
    if (passAssigned === 0) break;
  }

  const assignmentsByClass = new Map<number, Array<{ subjectId: number; teacherId: number | null; weeklyHours: number }>>();
  for (const cs of allClassSubjects) {
    if (!assignmentsByClass.has(cs.classId)) assignmentsByClass.set(cs.classId, []);
    assignmentsByClass.get(cs.classId)!.push({
      subjectId: cs.subjectId,
      teacherId: cs.teacherId,
      weeklyHours: cs.weeklyHours,
    });
  }

  const classesToSave = classIds && classIds.length > 0 ? classIds : Array.from(assignmentsByClass.keys());
  for (const classId of classesToSave) {
    const items = assignmentsByClass.get(classId) || [];
    await storage.setClassSubjects(classId, items);
  }

  const fillResult = await autoDistributeUnassignedOnly(classIds);
  assignedCount += fillResult.assignedCount;

  const remaining = (await storage.getAllClassSubjects()).filter(cs =>
    (!classIds || classIds.length === 0 || classIds.includes(cs.classId)) && !cs.teacherId,
  );

  const remainingNote = remaining.length > 0
    ? ` ${remaining.length} ta fan hali o'qituvchisiz — mos o'qituvchi yetishmayapti.`
    : " Barcha fanlar o'qituvchilarga biriktirildi.";

  return {
    message: classIds && classIds.length > 0
      ? `Tanlangan sinflar darslari qayta taqsimlandi. ${assignedCount} ta dars o'qituvchilarga biriktirildi.${remainingNote}`
      : `Barcha darslar qayta taqsimlandi. ${assignedCount} ta dars o'qituvchilarga biriktirildi.${remainingNote}`,
    assignedCount,
    remainingUnassigned: remaining.length,
  };
}

export async function autoAssignDtsForClasses(classIds: number[]) {
  const [allSubjects, allClasses, allTeachers, allTeacherSubjects, allClassSubjects] = await Promise.all([
    storage.getSubjects(),
    storage.getClasses(),
    storage.getTeachers(),
    db.select().from(teacherSubjects),
    storage.getAllClassSubjects(),
  ]);

  await syncPrimaryTeacherGradeLevels(allTeachers);

  const teacherSubjectMap = new Map<number, Set<number>>();
  for (const ts of allTeacherSubjects) {
    if (!teacherSubjectMap.has(ts.teacherId)) teacherSubjectMap.set(ts.teacherId, new Set());
    teacherSubjectMap.get(ts.teacherId)!.add(ts.subjectId);
  }

  const teacherLoadMap = new Map<number, number>();
  const teacherClassMap = new Map<number, Set<number>>();
  for (const cs of allClassSubjects) {
    if (cs.teacherId) {
      teacherLoadMap.set(cs.teacherId, (teacherLoadMap.get(cs.teacherId) || 0) + cs.weeklyHours);
      if (!teacherClassMap.has(cs.teacherId)) teacherClassMap.set(cs.teacherId, new Set());
      teacherClassMap.get(cs.teacherId)!.add(cs.classId);
    }
  }

  let assignedCount = 0;
  let preservedTeachers = 0;

  for (const classId of classIds) {
    const cls = allClasses.find(c => c.id === classId);
    if (!cls) continue;

    const language = cls.language || "uz";
    const grade = parseGrade(cls.grade);
    const existingForClass = allClassSubjects.filter(cs => cs.classId === classId);
    const existingBySubjectId = new Map(existingForClass.map(cs => [cs.subjectId, cs]));

    const dtsResult = await getAutoAssignments(grade, allSubjects, language);
    const dtsSubjectIds = new Set(dtsResult.assignments.map(a => a.subjectId));

    const merged: { subjectId: number; teacherId: number | null; weeklyHours: number }[] = existingForClass
      .filter(cs => !dtsSubjectIds.has(cs.subjectId))
      .map(cs => ({
        subjectId: cs.subjectId,
        teacherId: cs.teacherId,
        weeklyHours: cs.weeklyHours,
      }));

    for (const dtsEntry of dtsResult.assignments) {
      const existing = existingBySubjectId.get(dtsEntry.subjectId);
      let teacherId = existing?.teacherId ?? null;

      if (teacherId) {
        preservedTeachers++;
      } else {
        const subject = allSubjects.find(s => s.id === dtsEntry.subjectId);
        if (subject) {
          const teacher = findTeacherForClassSubject(
            allTeachers, teacherSubjectMap, teacherLoadMap, teacherClassMap, subject, cls, dtsEntry.weeklyHours,
          );
          if (teacher) {
            teacherId = teacher.id;
            teacherLoadMap.set(teacher.id, (teacherLoadMap.get(teacher.id) || 0) + dtsEntry.weeklyHours);
            if (!teacherClassMap.has(teacher.id)) teacherClassMap.set(teacher.id, new Set());
            teacherClassMap.get(teacher.id)!.add(cls.id);
            assignedCount++;
          }
        }
      }

      merged.push({
        subjectId: dtsEntry.subjectId,
        teacherId,
        weeklyHours: dtsEntry.weeklyHours,
      });
    }

    await storage.setClassSubjects(classId, merged);
  }

  // Qolgan bo'sh fanlarga ikkinchi bosqich — barcha qoidalarni qo'llab to'liq taqsimlash
  const distributeResult = await autoDistributeUnassignedOnly(classIds);
  assignedCount += distributeResult.assignedCount;

  const remaining = (await storage.getAllClassSubjects())
    .filter(cs => classIds.includes(cs.classId) && !cs.teacherId);

  const unassignedNote = remaining.length > 0
    ? ` ${remaining.length} ta fan hali o'qituvchisiz — mos o'qituvchi yetishmayapti.`
    : " Barcha fanlar o'qituvchilarga biriktirildi.";

  return {
    message: `${classIds.length} ta sinf uchun DTS fanlari yangilandi. Jami ${assignedCount} ta yangi o'qituvchi tayinlandi, ${preservedTeachers} ta mavjud biriktirish saqlandi.${unassignedNote}`,
    assignedCount,
    preservedTeachers,
    remainingUnassigned: remaining.length,
  };
}
