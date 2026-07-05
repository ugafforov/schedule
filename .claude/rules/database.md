---
paths:
  - "shared/**/*.ts"
  - "server/storage/**/*.ts"
  - "drizzle.config.ts"
  - "migrations/**/*"
---

# Database qoidalari (Drizzle + Supabase PostgreSQL)

## Schema oʻzgartirish tartibi
1. `shared/schema.ts` — jadval/ustun
2. `server/storage/IStorage.ts` + tegishli `*.storage.ts`
3. Dev: `npm run db:push`
4. Prod: `npm run db:generate` → `npm run db:migrate`

## Qoidalar
- Soft delete: `isActive: false` (hard DELETE emas)
- Import: `@shared/schema`
- Oʻquv reja soatlari: `shared/curriculum.ts` (DTS 2025-2026)
- Fan murakkabligi/kategoriya (SanPiN): `shared/constants.ts`
- Oʻzgarishdan oldin Supabase MCP (`list_tables`) bilan real strukturani tekshiring

## Asosiy jadvallar
`teachers`, `subjects`, `classes`, `rooms`, `time_slots`, `teacher_subjects`, `class_subjects`, `schedule_entries`, `schedule_conflicts`, `teacher_unavailability`
