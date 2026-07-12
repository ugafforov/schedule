# Maktab Dars Jadvali — Agent Qoʻllanmasi

Oʻzbekiston maktablari uchun haftalik dars jadvalini avtomatik yaratish tizimi.
Stack: React 18 + TypeScript + Vite + Tailwind/shadcn (client/) · Hono (server/) · Drizzle ORM · Supabase PostgreSQL.
Barcha UI matnlari **oʻzbek tilida**. Oʻquv reja: DTS 2025-2026.

Domen bilimi (jadval tuzish qoidalari, SanPiN, DTS): `docs/domain/scheduling-rules.md` va `docs/domain/research.md` — solver yoki taqsimlash logikasiga tegishda oʻqing.

## Buyruqlar

```bash
npm run dev           # Server + Vite birgalikda, port 5001 (bitta buyruq yetarli)
npm run check         # TypeScript tekshiruvi (tsc)
npm run test          # Vitest (bir martalik)
npm run test:watch    # Vitest watch rejimi
npm run build && npm start   # Production
npm run db:push       # Dev: schemani bazaga surish (migration yaratmaydi)
npm run db:generate   # Prod: migration fayl yaratish (schema.ts o'zgarganda)
npm run db:migrate    # Prod: migrationlarni qo'llash
```

Har qanday kod oʻzgarishidan soʻng `npm run check` toza oʻtishi shart. Sof logika (solver, matching, utils) oʻzgarganda test yozing yoki mavjudini yangilang.

## Noodatiy texnologiya tanlovlari

| Nima | Ishlatiladi | Ishlatilmaydi |
|------|-------------|---------------|
| Backend | **Hono** | Express.js |
| Frontend routing | **Wouter** | React Router |
| ORM | **Drizzle** | Prisma |
| Auth | **Supabase Auth** (email+parol) | JWT/access codes |
| DB | **PostgreSQL** (standard pg) | Neon serverless |
| Platforma | **Web / PWA** | Electron / Desktop |

## Loyiha tuzilmasi

```
client/src/pages|components|hooks|lib   React frontend
server/routes|services|middleware|storage   Hono API
shared/schema.ts, constants.ts, curriculum.ts, teacher-matching.ts
docs/domain/                            Domen bilimi (DTS, SanPiN)
```

Ogohlantirish: `client/src/pages/timetables.tsx` va `assignments.tsx` juda katta — toʻliq oʻqimasdan, kerakli funksiyani Grep bilan qidirib toping.
`scratch/` va `dist/` ni oʻzgartirmang.

## Muhit oʻzgaruvchilari

```env
DATABASE_URL=postgresql://...
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...        # brauzerga chiqadi — maxfiy emas
SUPABASE_SERVICE_ROLE_KEY=eyJ...     # faqat server — frontendga BERMANG
```

`SUPABASE_ACCESS_TOKEN` (faqat MCP uchun) `.env`da EMAS — `.claude/settings.local.json`dagi `env` boʻlimida saqlanadi (gitignore'da); `.mcp.json` uni muhitdan `${SUPABASE_ACCESS_TOKEN}` orqali oʻqiydi.

## Auth

- Login: `supabase.auth.signInWithPassword()` → token `localStorage("auth_token")`.
- Har API soʻrovda: `getAuthHeaders()` → `Authorization: Bearer`.
- Server: `supabase.auth.getUser(token)`. Rol: `user_metadata.role` — `"admin"` yoki `"teacher"`.
- Yangi foydalanuvchi: Supabase Dashboard → Auth → Users → user_metadata: `{ "role": "admin", "first_name": "...", "last_name": "..." }`

## Muhim qoidalar

### 1. API soʻrovlar — DOIM `apiRequest()`
```typescript
import { apiRequest } from "@/lib/queryClient";

useQuery({ queryKey: ["/api/rooms"] });                    // GET — queryKey yetarli
queryFn: async () => {                                     // GET + parametr
  const res = await apiRequest("GET", `/api/schedule-entries?weekStart=${weekStart}`);
  return res.json();
}
await apiRequest("POST", "/api/rooms", data);              // POST/PATCH/DELETE
```
Toʻgʻridan-toʻgʻri `fetch()` chaqirmang — token qoʻshilmaydi.

### 2. Routing — Wouter
```typescript
import { useLocation } from "wouter";
const [, setLocation] = useLocation();
setLocation("/teachers");
```

### 3. Hono route qoʻshish
Yangi route: `server/routes/yangi.ts` → `server/routes/index.ts` ga `app.route(...)`.

**URL mapping xatosi — eng koʻp uchraydigan muammo:**
```
app.route("/api/teacher-load", teacherRoutes)    → /api/teacher-load/load  ❌
app.route("/api/teacher-load", teacherLoadRoute) → /api/teacher-load/      ✅
```
`teacher-load` va `teacher-recommendation` alohida routerlar — `teacherRoutes` ga qoʻshmang.

### 4. Database
- Soft delete: `isActive: false` — haqiqiy `DELETE` emas.
- Yangi jadval/ustun: `shared/schema.ts` → `server/storage/IStorage.ts` + tegishli `*.storage.ts` → `npm run db:push`.
- Asosiy jadvallar: `teachers`, `subjects`, `classes`, `rooms`, `time_slots`, `teacher_subjects`, `class_subjects`, `schedule_entries`, `schedule_conflicts`, `teacher_unavailability`.

### 5. Boshlangʻich sinf oʻqituvchilari
gradeLevel="primary" (1-4 sinf) oʻqituvchilar faqat oʻz sinfiga va faqat ruxsat etilgan fanlarga biriktiriladi.
- Qoida manbasi: `shared/constants.ts` — `PRIMARY_TEACHER_ALLOWED_SUBJECTS`, `isPrimaryTeacherAllowedSubject()`
- Qoʻllanish: `shared/teacher-matching.ts`, `client/src/pages/assignments.tsx` (`pickTeacherForSubject`), `server/services/teacher.service.ts` (`autoDistributeAll`)

### 6. UI Ranglar (Dark Mode qo'llab-quvvatlashi)
UI komponentlar (badge, kartochka, active state, hover) yozayotganda **hech qachon** `bg-blue-50`, `hover:bg-red-100`, `text-green-700` kabi och fonlarni "hardcoded" bermang, ular Dark Modeda oqish/ko'rinmas bo'lib qoladi.
- Och fon o'rniga opacity ishlating: `bg-blue-500/10` yoki semantic ranglar: `bg-muted`, `bg-accent`.
- Yozuvlar o'qilishi uchun doim dark variantni bering: `text-blue-700 dark:text-blue-400`.
- Chegaralar (border) uchun opacity ishlating: `border-blue-500/20`.

## Noodatiy API URLlar

```
GET  /api/time-slots              # yo'q bo'lsa avtomatik yaratadi
GET  /api/schedule-entries        # ?weekStart=, ?classId=, ?teacherId=
POST /api/generate-schedule       # { weekStart, classIds?, clearExisting }
GET  /api/teacher-load            # /api/teachers/load emas!
GET  /api/teacher-recommendation  # /api/teachers/recommendation emas!
POST /api/class-subjects/auto-distribute-all
POST /api/class-subjects/bulk-assign
```

## MCP serverlari

Ikkita server ishlatiladi — **Supabase** (bazani tekshirish: `list_tables`, `execute_sql`, `get_logs`, `get_advisors`; schema oʻzgarishidan oldin real jadvallarni koʻzdan kechiring) va **Playwright** (brauzerda izolyatsiyalangan tekshirish, `http://localhost:5001`, avval `npm run dev`; skrinshotlar `.playwright-mcp/` ga).

UI vizual tekshirishda default — Chrome tool (`claude-in-chrome`, **faqat Claude Code'da mavjud**); boshqa agentlarda va toza sessiya / dialogli oqim / uzun avtomatlashtirish hollarida — Playwright MCP (`/verify-ui` skillga qarang). Har muhim UI oʻzgarishidan soʻng skrinshot bilan tasdiqlang.

Har bir agent oʻz config faylini oʻqiydi (barchasi bir xil serverlarga sozlangan):

| Agent | Config |
|---|---|
| Claude Code | `.mcp.json` (loyihada) |
| VS Code Copilot | `.vscode/mcp.json` (loyihada) |
| Cursor | `.cursor/mcp.json` (loyihada) |
| Windsurf | `~/.codeium/windsurf/mcp_config.json` (global) |
| Antigravity | `~/.gemini/config/mcp_config.json` (global) |
| Trae | `.trae/mcp.json` (loyihada; token flag emas — server muhitdagi `SUPABASE_ACCESS_TOKEN`ni oʻzi oʻqiydi) |

Token: `SUPABASE_ACCESS_TOKEN` — user muhitida (`~/.config/environment.d/60-mcp-secrets.conf` va `~/.bashrc`); configlarda faqat `${env:SUPABASE_ACCESS_TOKEN}` havolasi. Tokenni hech qachon commit qilinadigan faylga yozmang.

## Bu faylni yangilash

Faqat agent oʻzi topa OLMAYDIGAN yangilik boʻlganda yangilang: noodatiy texnologiya, yangi muhim qoida, auth oʻzgarishi, buyruqlar oʻzgarishi. 200 satrdan oshirmang.
