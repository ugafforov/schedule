// Bir martalik skript: 2026-2027-o'quv yili uchun tayanch o'quv reja
// (Maktabgacha va maktab ta'limi vazirining 2026-yil 10-apreldagi 133-son buyrug'i)
// ma'lumotlarini curriculum_plans/curriculum_entries jadvallariga ko'chiradi va
// darhol faollashtiradi (eski 2025-2026 planlar avtomatik faolsizlanadi).
//
// Ishga tushirish: npx tsx --env-file=.env server/scripts/seed-curriculum-2026-2027.ts
import { db, pool } from "../db";
import { curriculumPlans, curriculumEntries } from "@shared/schema";
import { DTS_CURRICULUM_2026, RUSSIAN_DTS_CURRICULUM_2026, type DtsCurriculumEntry } from "@shared/dts-curriculum";
import { getSpecialty } from "@shared/curriculum";
import { storage } from "../storage/index";

const YEAR = "2026-2027";
const ORDER_NUMBER = "133-son buyruq, 10.04.2026";

async function seedAndActivate(entries: DtsCurriculumEntry[], language: "uz" | "ru") {
  const [plan] = await db.insert(curriculumPlans)
    .values({ year: YEAR, orderNumber: ORDER_NUMBER, language, isActive: false })
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
  console.log(`[${language}] plan #${plan.id} ("${YEAR}", ${ORDER_NUMBER}) yaratildi — ${rows.length} ta yozuv qo'shildi.`);

  await storage.activateCurriculumPlan(plan.id);
  console.log(`[${language}] plan #${plan.id} faollashtirildi (eski planlar avtomatik faolsizlantirildi).`);
}

async function main() {
  const existing = await db.select().from(curriculumPlans);
  const already2026 = existing.filter((p) => p.year === YEAR);
  if (already2026.length > 0) {
    console.log(`${YEAR} uchun allaqachon ${already2026.length} ta plan mavjud — qayta seed qilinmadi.`);
    return;
  }

  await seedAndActivate(DTS_CURRICULUM_2026, "uz");
  await seedAndActivate(RUSSIAN_DTS_CURRICULUM_2026, "ru");
}

main()
  .then(() => pool.end())
  .catch((err) => {
    console.error("2026-2027 curriculum seed xato bilan tugadi:", err);
    process.exit(1);
  });
