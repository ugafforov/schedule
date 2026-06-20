# Maktab Dars Jadvali — Cursor Agent

> To'liq qo'llanma: [`agents.md`](./agents.md)

O'zbekiston maktablari uchun haftalik dars jadvalini avtomatik yaratish tizimi.

**Stack:** React + TypeScript + Hono + Drizzle ORM + Supabase (PostgreSQL)  
**UI tili:** O'zbek  
**O'quv reja:** DTS 2025-2026

## Tez boshlash

```bash
cp .env.example .env   # Supabase kalitlarini to'ldiring
npm install
npm run dev            # http://localhost:5001
```

## Agent uchun muhim

| Mavzu | Qoida |
|-------|-------|
| API (frontend) | Faqat `apiRequest()` — `client/src/lib/queryClient.ts` |
| Routing | Wouter, React Router emas |
| Backend | Hono, Express emas |
| Auth | Supabase Auth + Bearer token |
| DB o'zgarish | `shared/schema.ts` → storage → `npm run db:push` |
| O'chirish | Soft delete: `isActive: false` |
| Primary o'qituvchi | `shared/constants.ts` |

## Loyiha tuzilmasi

```
client/src/     React frontend (pages, components, hooks, lib)
server/         Hono API (routes, services, middleware, storage)
shared/         schema.ts, constants.ts, curriculum.ts
```

## Cursor qoidalari

`.cursor/rules/` papkasida fayl bo'yicha qoidalar mavjud:
- `project-core.mdc` — har doim qo'llanadi
- `frontend-patterns.mdc` — `client/**`
- `backend-patterns.mdc` — `server/**`
- `database-schema.mdc` — schema va storage

Domen qoidalari (dars jadval algoritmi, fanlar, API URL lar) — `agents.md` da.
