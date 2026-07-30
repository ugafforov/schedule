# Maktab Dars Jadvali — Agent Qoʻllanmasi

Oʻzbekiston maktablari uchun haftalik dars jadvalini avtomatik yaratish tizimi.
Barcha UI matnlari **oʻzbek tilida**. Oʻquv reja: DTS 2025-2026.

Domen bilimi (jadval tuzish qoidalari, SanPiN, DTS): `docs/domain/scheduling-rules.md` va `docs/domain/research.md` — solver yoki taqsimlash logikasiga tegishda oʻqing.

## Buyruqlar

```bash
npm run dev           # Server + Vite birgalikda, port 5001 (bitta buyruq yetarli)
npm run check         # TypeScript tekshiruvi (tsc)
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

## Fayllar boʻyicha ehtiyot choralari

- `client/src/pages/timetables.tsx` va `assignments.tsx` juda katta — toʻliq oʻqimasdan, kerakli funksiyani Grep bilan qidirib toping.
- `scratch/` va `dist/` ni oʻzgartirmang.

## Muhit oʻzgaruvchilari

Roʻyxat `.env.example`da. `SUPABASE_SERVICE_ROLE_KEY` — faqat server, frontendga BERMANG.

`SUPABASE_ACCESS_TOKEN` (faqat MCP uchun) `.env`da EMAS — **Windows user muhitida** saqlanadi (yagona manba, barcha loyiha va barcha agent uchun). MCP configlarda faqat `${SUPABASE_ACCESS_TOKEN}` havolasi turadi; hech qanday sozlama fayliga koʻchirib yozilmaydi.

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
- Schema oʻzgartirish tartibi — quyidagi "Kritik tartiblar" boʻlimida.
- Jadvallar roʻyxati: `shared/schema.ts`.
- **Har yangi `pgTable` oxiriga `.enableRLS()` qoʻying.** Aks holda `npm run db:push`
  bazadagi RLS'ni jim oʻchiradi va jadval `anon` kalit orqali ochiq qoladi (bu avval
  uch marta sodir boʻlgan). Sabab va tafsilot: `migrations/0010_harden_rls_and_revoke_anon.sql`.

### 5. Boshlangʻich sinf oʻqituvchilari
gradeLevel="primary" (1-4 sinf) oʻqituvchilar faqat oʻz sinfiga va faqat ruxsat etilgan fanlarga biriktiriladi.
- Qoida manbasi: `shared/constants.ts` — `PRIMARY_TEACHER_ALLOWED_SUBJECTS`, `isPrimaryTeacherAllowedSubject()`
- Qoʻllanish: `shared/teacher-matching.ts`, `client/src/pages/assignments.tsx` (`pickTeacherForSubject`), `server/services/teacher.service.ts` (`autoDistributeAll`)

### 6. UI Ranglar (Dark Mode qo'llab-quvvatlashi)
UI komponentlar (badge, kartochka, active state, hover) yozayotganda **hech qachon** `bg-blue-50`, `hover:bg-red-100`, `text-green-700` kabi och fonlarni "hardcoded" bermang, ular Dark Modeda oqish/ko'rinmas bo'lib qoladi.
- Och fon o'rniga opacity ishlating: `bg-blue-500/10` yoki semantic ranglar: `bg-muted`, `bg-accent`.
- Yozuvlar o'qilishi uchun doim dark variantni bering: `text-blue-700 dark:text-blue-400`.
- Chegaralar (border) uchun opacity ishlating: `border-blue-500/20`.

## Kritik tartiblar (barcha agentlar uchun)

Claude Code'da bular skill/hook sifatida avtomatlashtirilgan; boshqa agentlar shu tartibga qoʻlda amal qilsin.

**Schema oʻzgartirish (Drizzle + Supabase):**
1. Avval real bazani koʻring (Supabase MCP `list_tables`) — schema.ts bilan farq boʻlishi mumkin.
2. `shared/schema.ts` (drizzle-zod insert schema'lari bilan) → `server/storage/IStorage.ts` → tegishli `*.storage.ts` → `server/storage/index.ts` bind.
3. Dev: `npm run db:push`. Prod: `npm run db:generate` → migrationni koʻzdan kechiring → `npm run db:migrate`.
4. Mavjud ustunni oʻchirish/qayta nomlashdan oldin foydalanuvchidan tasdiq oling (maʼlumot yoʻqolishi mumkin).
5. Yakunda: `npm run check` + `execute_sql` bilan yangi strukturani tekshiring.

**Verifikatsiya intizomi:** har kod oʻzgarishidan soʻng `npm run check` toza oʻtishi shart; sof logika oʻzgarganda `npm run test`. UI oʻzgarishini brauzerda skrinshot bilan tasdiqlamasdan "tayyor" demang (dark mode'ni ham tekshiring, konsolda yangi error boʻlmasin).

## Noodatiy API URLlar

```
GET  /api/time-slots              # yo'q bo'lsa avtomatik yaratadi
GET  /api/schedule-entries        # ?weekStart=, ?classId=, ?teacherId=
POST /api/generate-schedule       # { weekStart, classIds?, clearExisting }
GET  /api/teacher-load            # /api/teachers/load emas!
GET  /api/teacher-recommendation  # /api/teachers/recommendation emas!
```

## MCP serverlari

Ikkita server ishlatiladi — **Supabase** (bazani tekshirish: `list_tables`, `execute_sql`, `get_logs`, `get_advisors`; schema oʻzgarishidan oldin real jadvallarni koʻzdan kechiring) va **Playwright** (brauzerda izolyatsiyalangan tekshirish, `http://localhost:5001`, avval `npm run dev`; skrinshotlar `.playwright-mcp/` ga).

UI vizual tekshirishda default — Chrome tool (`claude-in-chrome`, **faqat Claude Code'da mavjud**); boshqa agentlarda va toza sessiya / dialogli oqim / uzun avtomatlashtirish hollarida — Playwright MCP (`/verify-ui` skillga qarang). Har muhim UI oʻzgarishidan soʻng skrinshot bilan tasdiqlang.

**Versiyalar hamma configda bir xil qotirilgan** — `@playwright/mcp@0.0.78 --headless --isolated` va `@supabase/mcp-server-supabase@0.9.0`. `@latest` YOZMANG: har MCP versiyasi oʻz playwright-core buildini talab qiladi, `@latest` bilan npx jim yangilanadi va "Browser is not installed" xatosi chiqadi. Bittasini oʻzgartirsangiz — **hammasini** oʻzgartiring.

| Agent | MCP config | Yoʻriqnoma |
|---|---|---|
| Claude Code | `.mcp.json` | `CLAUDE.md` → `@AGENTS.md` |
| VS Code Copilot | `.vscode/mcp.json` | `.github/copilot-instructions.md` → havola |
| Cursor | `.cursor/mcp.json` | `AGENTS.md` (oʻzi oʻqiydi) |
| Trae | `.trae/mcp.json` | `.trae/rules/project_rules.md` → havola |
| Codex CLI | `.codex/config.toml` (trusted project shart) | `AGENTS.md` (oʻzi oʻqiydi) |
| Windsurf | `~/.codeium/windsurf/mcp_config.json` (global) | `.windsurfrules` → havola |
| Antigravity | `~/.gemini/config/mcp_config.json` (global) | `AGENTS.md` |

Yoʻriqnoma fayllari **faqat havola**, nusxa emas — qoidalar faqat shu faylda. Claude Code uchun `~/.claude.json`da global MCP nusxasi ham bor; loyiha `.mcp.json`i ustun turadi (takror ataylab — `~/.claude.json`ni faqat Claude Code oʻqiydi).

Token: yuqoridagi "Muhit oʻzgaruvchilari" boʻlimida. Tokenni hech qachon commit qilinadigan faylga yozmang.

## Bu faylni yangilash

Faqat agent oʻzi topa OLMAYDIGAN yangilik boʻlganda yangilang: noodatiy texnologiya, yangi muhim qoida, auth oʻzgarishi, buyruqlar oʻzgarishi. 200 satrdan oshirmang.
