# Eski migrationlar (ishlatilmaydi — faqat tarix uchun)

Bu papkadagi fayllar **hech qachon ishga tushmaydi**: `drizzle-kit` faqat
`migrations/meta/_journal.json` da roʻyxatga olingan fayllarni bajaradi, bu papka esa
u yerda yoʻq.

## Nega arxivga olindi

`0000_calm_nicolaos.sql` juda eskirgan edi va zanjir hozirgi `shared/schema.ts` ni
qayta tiklay olmasdi:

- `access_codes` jadvali bor edi (Supabase Auth'ga oʻtilganda olib tashlangan),
- `schedule_entries.week_start_date` bor edi (hozir `week_type`),
- `joint_*`, `curriculum_*`, `app_settings` jadvallari umuman yoʻq edi,
- `class_subjects` ning `room_id`, `room_id_2`, `is_split`, `split_type`,
  `joint_group_id` ustunlari yoʻq edi (ular faqat `db:push` orqali qoʻshilgan).

Bundan tashqari `0001`–`0010` fayllari `_journal.json` da roʻyxatdan oʻtmagan edi, ya'ni
`npm run db:migrate` ularni **umuman bajarmasdi** — ular qoʻlda qoʻllanardi. Aynan shu
sababdan `0003_enable_rls.sql` hech qachon avtomatik qoʻllanmagan va RLS bir necha bor
yoʻqolgan.

## Oʻrniga nima keldi

- `migrations/0000_baseline.sql` — `shared/schema.ts` dan `drizzle-kit generate` bilan
  yaratilgan, 18 jadval + indekslar + FK + RLS.
- `migrations/0001_functions_and_grants.sql` — drizzle yarata olmaydigan qism:
  `check_schedule_conflicts`, `get_teacher_recommendations` RPC funksiyalari
  (ishlayotgan bazadan `pg_get_functiondef()` bilan olingan) va rol huquqlari.

Ikkalasi ham `_journal.json` da roʻyxatda, ya'ni `npm run db:migrate` ularni bajaradi.

Mavjud toʻldirilgan baza (`Jadvalim`) 2026-07-30 da "baseline" qilingan:
`drizzle.__drizzle_migrations` ga ikkala migration yozuvi qoʻshilgan, shuning uchun
`db:migrate` ularni qayta bajarmaydi va maʼlumotga tegmaydi.
