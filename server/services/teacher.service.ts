import { storage } from "../storage/index";
import { db } from "../db";
import { classSubjects, teacherSubjects, type Subject, type Class, type Teacher, type ClassSubject } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { UZBEK_CURRICULUM, RUSSIAN_CURRICULUM } from "@shared/curriculum";
import { getSpecialty } from "./curriculum.service";

const DEFAULT_MAX_HOURS = 30;

import { PRIMARY_TEACHER_ALLOWED_SUBJECTS, isPrimaryTeacherAllowedSubject } from "@shared/constants";

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

  const updatedAssignmentsByClass = new Map<number, (AssignmentEntry | ClassSubject)[]>();
  let createdTeachersCount = 0;
  const unassignedBySpecialty = new Map<string, AssignmentEntry[]>();

  for (const cls of allClasses) {
    const curriculum = (cls as any).language === "ru" ? RUSSIAN_CURRICULUM : UZBEK_CURRICULUM;
    const gradeRequirements = curriculum[cls.grade];
    if (!gradeRequirements) {
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
      const specialty = getSpecialty(subjectName, cls.grade, (cls as any).language || "uz");

      const existing = existingClassSubjects.find(
        (cs) => cs.classId === cls.id && cs.subjectId === subject!.id
      );
      let teacherId = existing?.teacherId || null;

      if (teacherId) {
        const t = allTeachers.find((x) => x.id === teacherId);
        if (!t) {
          teacherId = null;
        } else {
          const tSpecialty = getSpecialty(t.specialization || "", "5", (cls as any).language || "uz");
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

    const firstAssignment = assignments[0];
    const targetClass = firstAssignment ? allClasses.find(c => c.id === firstAssignment.classId) : null;
    const grade = targetClass ? String(targetClass.grade) : "5";
    const language = targetClass ? (targetClass as any).language || "uz" : "uz";

    const matchingTeachers = allTeachers.filter(
      (t) =>
        t.isActive &&
        (getSpecialty(t.specialization || "", "5", language) === specialty ||
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

export async function autoDistributeAll(classIds?: number[]) {
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
  let unassignedCS = allClassSubjects.filter((cs) => !cs.teacherId);
  if (classIds && classIds.length > 0) {
    unassignedCS = unassignedCS.filter((cs) => classIds.includes(cs.classId));
  }

  for (const cs of unassignedCS) {
    // Sinf ma'lumotini olish
    const allClasses = await storage.getClasses();
    const classInfo = allClasses.find(c => c.id === cs.classId);
    const gradeNum = classInfo ? parseInt(classInfo.grade) : 5;
    const isPrimaryClass = gradeNum >= 1 && gradeNum <= 4;
    
    // Fan ma'lumotini olish
    const subject = allSubjects.find(s => s.id === cs.subjectId);
    const subjectName = subject?.name || "";
    
    const candidates = allTeachers.filter((t) => {
      const subjects = teacherSubjectMap.get(t.id) || new Set();
      const currentLoad = teacherLoadMap.get(t.id) || 0;
      
      const teacherGradeLevels = ((t as any).gradeLevel || "high").split(",").map((s: string) => s.trim());
      const isPrimaryTeacher = teacherGradeLevels.includes("primary");
      
      const requiredLevel = isPrimaryClass ? "primary" : "high";
      const universalSubjects = [
        "rus tili", "chet tili", "ingliz tili", "nemis tili", "fransuz tili",
        "musiqa madaniyati", "musiqa", "tasviriy san'at", "jismoniy tarbiya",
        "tarbiya", "chaqiruvga qadar boshlang'ich tayyorgarlik"
      ];
      const isUniversalSubject = universalSubjects.some(s => 
        subjectName.toLowerCase().includes(s.toLowerCase())
      );
      const gradeLevelMatch = isUniversalSubject || teacherGradeLevels.includes(requiredLevel);
      if (!gradeLevelMatch) return false;
      
      if (isPrimaryTeacher && isPrimaryClass && !isPrimaryTeacherAllowedSubject(subjectName)) {
        return false;
      }
      
      const grade = classInfo ? classInfo.grade : "5";
      const language = classInfo ? (classInfo as any).language || "uz" : "uz";
      
      const teacherSpecialty = getSpecialty(t.specialization || "", "5", language);
      const subjectSpecialty = getSpecialty(subjectName, grade, language);
      const specialtyMatch = !!teacherSpecialty && !!subjectSpecialty && teacherSpecialty === subjectSpecialty;
      
      const subjectMatch = subjects.has(cs.subjectId) || 
                           (isPrimaryTeacher && isPrimaryClass && isPrimaryTeacherAllowedSubject(subjectName)) ||
                           specialtyMatch;
      return subjectMatch && currentLoad + cs.weeklyHours <= (t.maxHoursPerWeek || 30);
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

  const classesToSave = classIds && classIds.length > 0 ? classIds : Array.from(assignmentsByClass.keys());
  for (const classId of classesToSave) {
    const items = assignmentsByClass.get(classId) || [];
    await storage.setClassSubjects(classId, items);
  }

  return {
    message: `${assignedCount} ta dars o'qituvchilarga avtomatik taqsimlandi.`,
    assignedCount,
  };
}

// ─── Faqat bo'sh fanlarni biriktirish (yangi funksiya) ───────────────────────
export async function autoDistributeUnassignedOnly(classIds?: number[]) {
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
  let unassignedCS = allClassSubjects.filter((cs) => !cs.teacherId);
  if (classIds && classIds.length > 0) {
    unassignedCS = unassignedCS.filter((cs) => classIds.includes(cs.classId));
  }

  for (const cs of unassignedCS) {
    const allClasses = await storage.getClasses();
    const classInfo = allClasses.find(c => c.id === cs.classId);
    const gradeNum = classInfo ? parseInt(classInfo.grade) : 5;
    const isPrimaryClass = gradeNum >= 1 && gradeNum <= 4;
    
    const subject = allSubjects.find(s => s.id === cs.subjectId);
    const subjectName = subject?.name || "";
    
    const candidates = allTeachers.filter((t) => {
      const subjects = teacherSubjectMap.get(t.id) || new Set();
      const currentLoad = teacherLoadMap.get(t.id) || 0;
      
      const teacherGradeLevels = ((t as any).gradeLevel || "high").split(",").map((s: string) => s.trim());
      const isPrimaryTeacher = teacherGradeLevels.includes("primary");
      
      const requiredLevel = isPrimaryClass ? "primary" : "high";
      const universalSubjects = [
        "rus tili", "chet tili", "ingliz tili", "nemis tili", "fransuz tili",
        "musiqa madaniyati", "musiqa", "tasviriy san'at", "jismoniy tarbiya",
        "tarbiya", "chaqiruvga qadar boshlang'ich tayyorgarlik"
      ];
      const isUniversalSubject = universalSubjects.some(s => 
        subjectName.toLowerCase().includes(s.toLowerCase())
      );
      const gradeLevelMatch = isUniversalSubject || teacherGradeLevels.includes(requiredLevel);
      if (!gradeLevelMatch) return false;
      
      if (isPrimaryTeacher && isPrimaryClass && !isPrimaryTeacherAllowedSubject(subjectName)) {
        return false;
      }
      
      const grade = classInfo ? classInfo.grade : "5";
      const language = classInfo ? (classInfo as any).language || "uz" : "uz";
      
      const teacherSpecialty = getSpecialty(t.specialization || "", "5", language);
      const subjectSpecialty = getSpecialty(subjectName, grade, language);
      const specialtyMatch = !!teacherSpecialty && !!subjectSpecialty && teacherSpecialty === subjectSpecialty;
      
      const subjectMatch = subjects.has(cs.subjectId) || 
                           (isPrimaryTeacher && isPrimaryClass && isPrimaryTeacherAllowedSubject(subjectName)) ||
                           specialtyMatch;
      return subjectMatch && currentLoad + cs.weeklyHours <= (t.maxHoursPerWeek || 30);
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

  // teacherLoadMap holds hours of teachers who are NOT reassigned.
  const teacherLoadMap = new Map<number, number>();
  
  // Clear/reset assignments for target classes
  for (const cs of allClassSubjects) {
    const shouldReset = !classIds || classIds.length === 0 || classIds.includes(cs.classId);
    if (shouldReset) {
      cs.teacherId = null;
    } else if (cs.teacherId) {
      teacherLoadMap.set(cs.teacherId, (teacherLoadMap.get(cs.teacherId) || 0) + cs.weeklyHours);
    }
  }

  let assignedCount = 0;
  
  // We only assign class subjects of classes we want to reset
  let targetCS = allClassSubjects;
  if (classIds && classIds.length > 0) {
    targetCS = allClassSubjects.filter((cs) => classIds.includes(cs.classId));
  }

  for (const cs of targetCS) {
    const allClasses = await storage.getClasses();
    const classInfo = allClasses.find(c => c.id === cs.classId);
    const gradeNum = classInfo ? parseInt(classInfo.grade) : 5;
    const isPrimaryClass = gradeNum >= 1 && gradeNum <= 4;
    
    const subject = allSubjects.find(s => s.id === cs.subjectId);
    const subjectName = subject?.name || "";
    
    const candidates = allTeachers.filter((t) => {
      const subjects = teacherSubjectMap.get(t.id) || new Set();
      const currentLoad = teacherLoadMap.get(t.id) || 0;
      
      const teacherGradeLevels = ((t as any).gradeLevel || "high").split(",").map((s: string) => s.trim());
      const isPrimaryTeacher = teacherGradeLevels.includes("primary");
      
      const requiredLevel = isPrimaryClass ? "primary" : "high";
      const universalSubjects = [
        "rus tili", "chet tili", "ingliz tili", "nemis tili", "fransuz tili",
        "musiqa madaniyati", "musiqa", "tasviriy san'at", "jismoniy tarbiya",
        "tarbiya", "chaqiruvga qadar boshlang'ich tayyorgarlik"
      ];
      const isUniversalSubject = universalSubjects.some(s => 
        subjectName.toLowerCase().includes(s.toLowerCase())
      );
      const gradeLevelMatch = isUniversalSubject || teacherGradeLevels.includes(requiredLevel);
      if (!gradeLevelMatch) return false;
      
      if (isPrimaryTeacher && isPrimaryClass && !isPrimaryTeacherAllowedSubject(subjectName)) {
        return false;
      }
      
      const grade = classInfo ? classInfo.grade : "5";
      const language = classInfo ? (classInfo as any).language || "uz" : "uz";
      
      const teacherSpecialty = getSpecialty(t.specialization || "", "5", language);
      const subjectSpecialty = getSpecialty(subjectName, grade, language);
      const specialtyMatch = !!teacherSpecialty && !!subjectSpecialty && teacherSpecialty === subjectSpecialty;
      
      const subjectMatch = subjects.has(cs.subjectId) || 
                           (isPrimaryTeacher && isPrimaryClass && isPrimaryTeacherAllowedSubject(subjectName)) ||
                           specialtyMatch;
      return subjectMatch && currentLoad + cs.weeklyHours <= (t.maxHoursPerWeek || 30);
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

  const classesToSave = classIds && classIds.length > 0 ? classIds : Array.from(assignmentsByClass.keys());
  for (const classId of classesToSave) {
    const items = assignmentsByClass.get(classId) || [];
    await storage.setClassSubjects(classId, items);
  }

  return {
    message: classIds && classIds.length > 0 
      ? `Tanlangan sinflar darslari qayta taqsimlandi. ${assignedCount} ta dars o'qituvchilarga biriktirildi.`
      : `Barcha darslar qayta taqsimlandi. ${assignedCount} ta dars o'qituvchilarga biriktirildi.`,
    assignedCount,
  };
}

function pickTeacherForSubjectBackend(
  subject: Subject,
  allTeachers: Teacher[],
  teacherLoadMap: Map<number, number>,
  teacherSubjectMap: Map<number, Set<number>>,
  grade: string,
  language: string = "uz"
) {
  const gradeNum = parseInt(grade);
  const requiredLevel = gradeNum >= 1 && gradeNum <= 4 ? "primary" : "high";

  const universalSubjects = [
    "rus tili", "chet tili", "ingliz tili", "nemis tili", "fransuz tili",
    "musiqa madaniyati", "musiqa", "tasviriy san'at", "jismoniy tarbiya",
    "tarbiya", "chaqiruvga qadar boshlang'ich tayyorgarlik"
  ];
  const isUniversalSubject = universalSubjects.some(s => 
    subject.name.toLowerCase().includes(s.toLowerCase())
  );

  const scored = allTeachers
    .map((teacher) => {
      const specialization = (teacher.specialization || "").toLowerCase();
      const subjectIds = teacherSubjectMap.get(teacher.id) || new Set<number>();
      const currentHours = teacherLoadMap.get(teacher.id) || 0;
      const maxHours = teacher.maxHoursPerWeek || 30;
      const currentSubjects = subjectIds.size;
      
      const teacherGradeLevels = ((teacher as any).gradeLevel || "high").split(",").map((s: string) => s.trim());
      const isPrimaryTeacher = teacherGradeLevels.includes("primary");
      const isPrimaryClass = requiredLevel === "primary";
      const isPrimarySubjectAllowed = isPrimaryTeacherAllowedSubject(subject.name);

      const teacherSpecialty = getSpecialty(teacher.specialization || "", "5", language);
      const subjectSpecialty = getSpecialty(subject.name, grade, language);
      const specialtyMatch = !!teacherSpecialty && !!subjectSpecialty && teacherSpecialty === subjectSpecialty;

      const hasSlot = (isPrimaryTeacher || currentSubjects < 2) && currentHours < maxHours;
      const subjectMatch = subjectIds.has(subject.id) || 
                           (isPrimaryTeacher && isPrimaryClass && isPrimarySubjectAllowed) || 
                           specialtyMatch;
      const specializationMatch = specialization.length > 0 && specialization.includes(subject.name.toLowerCase());
      
      const gradeLevelMatch = isUniversalSubject || teacherGradeLevels.includes(requiredLevel);
      
      if (isPrimaryTeacher && isPrimaryClass && !isPrimarySubjectAllowed) {
        return { teacher, score: -1, hasSlot: false, subjectMatch: false, specializationMatch: false, gradeLevelMatch: false };
      }
      
      if (!gradeLevelMatch) return { teacher, score: -1, hasSlot: false, subjectMatch: false, specializationMatch: false, gradeLevelMatch: false };
      
      let score = 0;
      if (subjectMatch) score += 100;
      if (specializationMatch) score += 50;
      if (!hasSlot) score = -1;
      score -= currentHours;
      score -= currentSubjects * 5;
      
      return { teacher, score, hasSlot, subjectMatch, specializationMatch, gradeLevelMatch };
    })
    .filter((item) => item.score >= 0 && item.subjectMatch && item.gradeLevelMatch);

  if (scored.length === 0) return null;

  return scored
    .slice()
    .sort((a, b) => b.score - a.score || (teacherLoadMap.get(a.teacher.id) || 0) - (teacherLoadMap.get(b.teacher.id) || 0))[0]
    ?.teacher || null;
}

export async function autoAssignDtsForClasses(classIds: number[]) {
  const [allSubjects, allClasses, allTeachers, allTeacherSubjects, allClassSubjects] = await Promise.all([
    storage.getSubjects(),
    storage.getClasses(),
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

  for (const classId of classIds) {
    const cls = allClasses.find(c => c.id === classId);
    if (!cls) continue;

    const curriculum = (cls as any).language === "ru" ? RUSSIAN_CURRICULUM : UZBEK_CURRICULUM;
    const gradeRequirements = curriculum[cls.grade];
    if (!gradeRequirements) continue;

    const newAssignments: { subjectId: number; teacherId: number | null; weeklyHours: number }[] = [];

    for (const [subjectName, hours] of Object.entries(gradeRequirements)) {
      const subject = allSubjects.find(s => s.name.toLowerCase() === subjectName.toLowerCase());
      if (!subject) continue;

      const teacher = pickTeacherForSubjectBackend(subject, allTeachers, teacherLoadMap, teacherSubjectMap, cls.grade, (cls as any).language || "uz");
      
      newAssignments.push({
        subjectId: subject.id,
        teacherId: teacher?.id ?? null,
        weeklyHours: hours,
      });

      if (teacher) {
        teacherLoadMap.set(teacher.id, (teacherLoadMap.get(teacher.id) || 0) + hours);
        assignedCount++;
      }
    }

    await storage.setClassSubjects(classId, newAssignments);
  }

  return {
    message: `${classIds.length} ta sinf uchun DTS fanlari avtomatik biriktirildi. ${assignedCount} ta darsga o'qituvchi tayinlandi.`,
    assignedCount,
  };
}
