---
paths:
  - "server/**/*.ts"
---

# Backend qoidalari (Hono)

## Route qoʻshish
1. `server/routes/yangi.ts` — Hono sub-router
2. `server/routes/index.ts` — `app.route("/api/...", yangiRoutes)`
3. Murakkab logika: `server/services/` ga ajrating

## URL mapping xatosi (eng koʻp uchraydigan muammo)
```typescript
// ❌ teacherRoutes ichida /load → /api/teacher-load/load
app.route("/api/teacher-load", teacherRoutes);
// ✅ Alohida router
app.route("/api/teacher-load", teacherLoadRoute);
```
`teacher-load` va `teacher-recommendation` alohida routerlar.

## Storage
- Interfeys: `server/storage/IStorage.ts`
- Implementatsiyalar: `core.storage`, `teachers.storage`, `classes.storage`, `schedule.storage`
- Eksport: `server/storage/index.ts` → `storage` obyekti
- Yangi metod: interfeys + tegishli storage class + index.ts bind

## Auth va xatoliklar
- `server/middleware/auth.ts` — Supabase token tekshiruvi, protected routelarda ishlating.
- Global error handler `server/index.ts`da: productionda 500 xabari umumiy, devda batafsil.
