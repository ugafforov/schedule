// Idempotent skript: "Kelajak soati" (sinf soati) fanini yaratadi, o'quv reja
// (curriculum_entries) yozuvlarini to'g'rilaydi va har bir aktiv sinfga haftasiga
// 1 soatdan, sinf rahbariga biriktirilgan holda qo'shadi.
// "Tarbiya" alohida oddiy fan bo'lib qoladi — uning biriktiruvlariga TEGILMAYDI.
//
// Ishga tushirish: npx tsx --env-file=.env server/scripts/seed-kelajak-soati.ts
import { db, pool } from "../db";
import { subjects, classes, classSubjects, curriculumPlans, curriculumEntries } from "@shared/schema";
import { isClassHourSubject } from "@shared/constants";
import { eq } from "drizzle-orm";

const GRADES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

/**
 * O'quv reja (curriculum_entries) tuzatish:
 *  - "Tarbiya" yozuvlaridan sinf soati kalit so'zlari/kodlari olib tashlanadi;
 *  - har bir plan/sinf uchun "Kelajak soati" yozuvi qo'shiladi (yo'q bo'lsa).
 * Kelajak soati DTS jami soatiga kirmaydi — kod darajasida isClassHourSubject bilan
 * barcha jami/norma hisoblaridan chiqariladi.
 */
async function fixCurriculumEntries() {
  const plans = await db.select().from(curriculumPlans);
  let tarbiyaFixed = 0, kelajakAdded = 0;

  for (const plan of plans) {
    const entries = await db.select().from(curriculumEntries)
      .where(eq(curriculumEntries.planId, plan.id));

    for (const e of entries) {
      if (e.subjectName !== "Tarbiya") continue;
      const keywords = (e.keywords as string[] | null) || [];
      const codes = (e.codes as string[] | null) || [];
      const newKeywords = keywords.filter(k => !isClassHourSubject(k));
      const newCodes = codes.filter(c => c !== "SINF");
      if (newKeywords.length !== keywords.length || newCodes.length !== codes.length) {
        await db.update(curriculumEntries)
          .set({ keywords: newKeywords, codes: newCodes })
          .where(eq(curriculumEntries.id, e.id));
        tarbiyaFixed++;
      }
    }

    const existingGrades = new Set(
      entries.filter(e => isClassHourSubject(e.subjectName)).map(e => e.grade),
    );
    const missing = GRADES.filter(g => !existingGrades.has(g));
    if (missing.length > 0) {
      await db.insert(curriculumEntries).values(missing.map(grade => ({
        planId: plan.id,
        grade,
        subjectName: "Kelajak soati",
        codes: ["KELS", "SINF"],
        keywords: ["kelajak soati", "sinf soati"],
        weeklyHours: 1,
        recommendedSpecialty: "Sinf rahbari",
      })));
      kelajakAdded += missing.length;
    }
  }

  console.log(`O'quv reja: ${plans.length} ta plan — Tarbiya tuzatildi: ${tarbiyaFixed} ta yozuv, Kelajak soati qo'shildi: ${kelajakAdded} ta yozuv.`);
}

async function main() {
  await fixCurriculumEntries();

  // 1. "Kelajak soati" fanini topish yoki yaratish
  const allSubjects = await db.select().from(subjects).where(eq(subjects.isActive, true));
  let kelajak = allSubjects.find(s => isClassHourSubject(s.name));
  if (!kelajak) {
    [kelajak] = await db.insert(subjects).values({
      name: "Kelajak soati",
      code: "KELS",
      description: "Sinf soati — sinf rahbari o'tadi, dushanba 1-soat. O'quv soatiga kirmaydi.",
      color: "#0D9488",
      weeklyHours: 1,
      requiredRoomType: "any",
      isActive: true,
    }).returning();
    console.log(`"Kelajak soati" fani yaratildi (id=${kelajak.id}).`);
  } else {
    console.log(`Sinf soati fani mavjud: "${kelajak.name}" (id=${kelajak.id}).`);
  }

  // 2. Har bir aktiv sinf uchun class_subjects qatori (1 soat, rahbar)
  const activeClasses = await db.select().from(classes).where(eq(classes.isActive, true));
  let added = 0, updated = 0, skipped = 0;
  const noTeacher: string[] = [];

  for (const cls of activeClasses) {
    const existing = await db.select().from(classSubjects)
      .where(eq(classSubjects.classId, cls.id));
    const row = existing.find(r => r.subjectId === kelajak!.id);
    const teacherId = cls.classTeacherId ?? null;
    if (teacherId == null) noTeacher.push(cls.name);

    if (!row) {
      await db.insert(classSubjects).values({
        classId: cls.id,
        subjectId: kelajak.id,
        teacherId,
        roomId: null,
        weeklyHours: 1,
      });
      added++;
    } else if (row.teacherId !== teacherId || row.weeklyHours !== 1) {
      await db.update(classSubjects)
        .set({ teacherId, weeklyHours: 1 })
        .where(eq(classSubjects.id, row.id));
      updated++;
    } else {
      skipped++;
    }
  }

  console.log(`Sinflar: ${activeClasses.length} ta — qo'shildi: ${added}, yangilandi: ${updated}, o'zgarishsiz: ${skipped}.`);
  if (noTeacher.length > 0) {
    console.warn(`OGOHLANTIRISH: quyidagi sinflarda sinf rahbari belgilanmagan (teacherId=null qoldi): ${noTeacher.join(", ")}`);
  }
}

main()
  .then(() => pool.end())
  .catch((err) => {
    console.error("Kelajak soati seed xato bilan tugadi:", err);
    process.exit(1);
  });
