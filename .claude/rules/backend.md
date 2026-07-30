---
paths:
  - "server/**/*.ts"
---

# Backend qoidalari (Hono)

## Route qoʻshish va URL mapping
Yagona manba: AGENTS.md ("Muhim qoidalar" #2) — route qoʻshish zanjiri va teacher-load/teacher-recommendation URL mapping tuzogʻi. Shu yerda takrorlanmaydi. Murakkab logika: `server/services/` ga ajrating.

## Storage
- Interfeys: `server/storage/IStorage.ts`
- Implementatsiyalar: `core.storage`, `teachers.storage`, `classes.storage`, `schedule.storage`
- Eksport: `server/storage/index.ts` → `storage` obyekti
- Yangi metod: interfeys + tegishli storage class + index.ts bind

## Auth va xatoliklar
- `server/middleware/auth.ts` — Supabase token tekshiruvi, protected routelarda ishlating.
- Global error handler `server/index.ts`da: productionda 500 xabari umumiy, devda batafsil.
