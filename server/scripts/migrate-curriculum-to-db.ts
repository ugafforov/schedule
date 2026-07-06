// Bir martalik skript: shared/dts-curriculum.ts (DTS_CURRICULUM_2025, RUSSIAN_DTS_CURRICULUM_2025)
// ma'lumotlarini curriculum_plans/curriculum_entries jadvallariga ko'chiradi.
//
// dts-curriculum.ts — 121-son buyruq (10.04.2025) asosidagi eng rasmiy va batafsil manba —
// asosiy (authoritative) manba sifatida tanlandi. Ishga tushirish: npx tsx --env-file=.env
// server/scripts/migrate-curriculum-to-db.ts
import { db, pool } from "../db";
import { curriculumPlans, curriculumEntries } from "@shared/schema";
import { DTS_CURRICULUM_2025, RUSSIAN_DTS_CURRICULUM_2025, type DtsCurriculumEntry } from "@shared/dts-curriculum";
import { getSpecialty } from "@shared/curriculum";

async function seedPlan(entries: DtsCurriculumEntry[], language: "uz" | "ru", year: string, orderNumber: string) {
  const [plan] = await db.insert(curriculumPlans)
    .values({ year, orderNumber, language, isActive: true })
    .returning();

  const rows = [];
  for (const entry of entries) {
    for (const [gradeStr, hours] of Object.entries(entry.hours)) {
      const grade = Number(gradeStr);
      rows.push({
        planId: plan.id,
        grade,
        subjectName: entry.name,
        codes: entry.codes,
        keywords: entry.keywords,
        weeklyHours: hours as number,
        recommendedSpecialty: getSpecialty(entry.name, String(grade), language),
      });
    }
  }

  await db.insert(curriculumEntries).values(rows);
  console.log(`[${language}] plan #${plan.id} ("${year}", ${orderNumber}) yaratildi — ${rows.length} ta yozuv qo'shildi.`);
}

async function main() {
  const existing = await db.select().from(curriculumPlans);
  if (existing.length > 0) {
    console.log(`curriculum_plans jadvalida allaqachon ${existing.length} ta plan bor — qayta seed qilinmadi.`);
    return;
  }

  await seedPlan(DTS_CURRICULUM_2025, "uz", "2025-2026", "121-son buyruq, 10.04.2025");
  await seedPlan(RUSSIAN_DTS_CURRICULUM_2025, "ru", "2025-2026", "121-son buyruq, 10.04.2025");
}

main()
  .then(() => pool.end())
  .catch((err) => {
    console.error("Curriculum migratsiyasi xato bilan tugadi:", err);
    process.exit(1);
  });
