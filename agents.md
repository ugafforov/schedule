# Maktab Dars Jadvali — Agent Qo'llanmasi

O'zbekiston maktablari uchun haftalik dars jadvalini avtomatik yaratish tizimi.
Stack: React + TypeScript + Hono (Node.js) + Drizzle ORM + Supabase (PostgreSQL).
Barcha UI o'zbek tilida. O'quv reja: DTS 2025-2026 (121-son buyruq, 10.04.2025).

---

## Buyruqlar

```bash
npm run dev           # Server + Vite birgalikda port 5001 (bitta buyruq yetarli)
npm run build && npm start  # Production build va start
npm run check         # TypeScript tekshiruvi
npm run db:push       # Dev: Schemani bazaga tezkor "surish" (migration yaratmaydi)
npm run db:generate   # Prod: Yangi migration fayl yaratish (shared/schema.ts o'zgarganda)
npm run db:migrate    # Prod: Yaratilgan migrationlarni bazaga qo'llash
```

**Eslatma:** Development jarayonida tezkorlik uchun `db:push` dan foydalaning. Production muhitida yoki jamoada ishlashda esa `db:generate` va `db:migrate` orqali o'zgarishlarni boshqaring.

---

## Noodatiy texnologiya tanlovlar

| Nima | Ishlatiladi | Ishlatilmaydi |
|------|-------------|---------------|
| Backend | **Hono** | Express.js |
| Frontend routing | **Wouter** | React Router |
| ORM | **Drizzle** | Prisma |
| Auth | **Supabase Auth** (email+parol) | JWT/access codes |
| DB | **PostgreSQL** (standard pg) | Neon serverless |
| Platform | **Web / PWA** | Electron / Desktop |

---

## Muhit o'zgaruvchilari

```env
DATABASE_URL=postgresql://...
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...        # brauzerga chiqadi — maxfiy emas
SUPABASE_SERVICE_ROLE_KEY=eyJ...     # faqat server — frontendga BERMANG
```

---

## Auth

Login: `supabase.auth.signInWithPassword()` → token `localStorage("auth_token")` ga.
Token yangilanishi: `onAuthStateChange()` avtomatik kuzatadi.
Har API so'rovda: `getAuthHeaders()` → `supabase.auth.getSession()` → `Authorization: Bearer`.
Server: `supabase.auth.getUser(token)` → foydalanuvchi.

Rol: `user_metadata.role` — `"admin"` yoki `"teacher"`.
Yangi foydalanuvchi: Supabase Dashboard → Auth → Users → user_metadata:
`{ "role": "admin", "first_name": "Ism", "last_name": "Familiya" }`

---

## Muhim qoidalar

### 1. Boshlang'ich sinf o'qituvchilari uchun qoidalar

**Boshlang'ich sinf o'qituvchilari** (gradeLevel="primary", 1-4 sinf) faqat o'z sinfiga quyidagi fanlarga biriktirilishi mumkin:
- Ona tili
- Matematika
- O'qish savodxonligi
- Tarbiya
- Sinf soati (kelajak soati)

Boshqa fanlar (Rus tili, Ingliz tili, Musiqa, Jismoniy tarbiya va h.k.) uchun boshlang'ich sinf o'qituvchilari biriktirilmaydi.

**Qo'llaniladigan joylar:**
- `client/src/pages/assignments.tsx` — `pickTeacherForSubject()` funksiyasi (avtomatik biriktirish)
- `server/services/teacher.service.ts` — `autoDistributeAll()` funksiyasi (server-side avtomatik taqsimlash)

**Qoidani o'zgartirish:**
- `shared/constants.ts` — `PRIMARY_TEACHER_ALLOWED_SUBJECTS` va `isPrimaryTeacherAllowedSubject()`

### 2. API so'rovlar — DOIM `apiRequest()` ishlatish
```typescript
import { apiRequest } from "@/lib/queryClient";

// GET — queryKey yetarli (token avtomatik)
const { data } = useQuery({ queryKey: ["/api/rooms"] });

// GET + parametr — queryFn yozish shart
queryFn: async () => {
  const res = await apiRequest("GET", `/api/schedule-entries?weekStart=${weekStart}`);
  return res.json();
}

// POST/PATCH/DELETE
await apiRequest("POST", "/api/rooms", data);
```
`fetch()` to'g'ridan-to'g'ri chaqirma — token qo'shilmaydi.

### 3. Routing — Wouter
```typescript
import { useLocation } from "wouter";
const [, setLocation] = useLocation();
setLocation("/teachers");
```

### 4. Hono route qo'shish
Yangi route: `server/routes/yangi.ts` → `server/routes/index.ts` ga `app.route(...)` qo'sh.

**URL mapping xatosi — eng ko'p uchraydigan muammo:**
```
app.route("/api/teacher-load", teacherRoutes)    → /api/teacher-load/load  ❌
app.route("/api/teacher-load", teacherLoadRoute) → /api/teacher-load/      ✅
```
`teacher-load` va `teacher-recommendation` alohida routerlar — `teacherRoutes` ga qo'shma.

### 5. Database
- Soft delete: `isActive: false` — haqiqiy `DELETE` emas
- Yangi jadval: `shared/schema.ts` → `server/storage.ts` (IStorage interfeysi) → `npm run db:push`

---

## Noodatiy API URL lar

```
GET  /api/time-slots              # yo'q bo'lsa avtomatik yaratadi
GET  /api/schedule-entries        # ?weekStart=, ?classId=, ?teacherId=
POST /api/generate-schedule       # { weekStart, classIds?, clearExisting }
GET  /api/teacher-load            # /api/teachers/load emas!
GET  /api/teacher-recommendation  # /api/teachers/recommendation emas!
POST /api/class-subjects/auto-distribute-all
POST /api/class-subjects/bulk-assign
```

---

### 6. Dars jadval terish qoidalari (2024-2025-2026)

**Manbalar:** O'zbekiston Respublikasi Maktabgacha va maktab ta'limi vazirligi, DTS 2025-2026, UNESCO raporti.

#### A. Maktab tuzilmasi
- **Boshlang'ich ta'lim:** 1-4 sinf (7-10 yosh)
- **Asosiy ta'lim:** 5-9 sinf (11-15 yosh)
- **Yuqori ta'lim:** 10-11 sinf (16-18 yosh)
- **Jami:** 11 yillik majburiy ta'lim (2017-yildan 12-yildan o'zgartirildi)

#### B. Dars vaqti va struktura
- **Dars davomiyligi:** 45 daqiqa (standart)
- **Dars orasidagi tanaffus:** 10-15 daqiqa (kichik tanaffus)
- **Tushlik tanaffusi:** 20-30 daqiqa (katta tanaffus)
- **Kunlik dars soni:** 
  - 1-4 sinf: 4-5 dars (maksimal 4-5 soat)
  - 5-9 sinf: 5-6 dars (maksimal 5-6 soat)
  - 10-11 sinf: 6-7 dars (maksimal 6-7 soat)

#### C. Boshlang'ich sinf (1-4) fanlari
Majburiy fanlar:
- Ona tili (Uzbek tili)
- Matematika
- O'qish savodxonligi (1-2 sinf)
- Tarbiya (axloq ta'limi)
- Sinf soati (kelajak soati)
- Jismoniy tarbiya
- Tasviriy san'at
- Musiqa madaniyati

**Eslatma:** Boshlang'ich sinf o'qituvchilari (gradeLevel="primary") faqat Ona tili, Matematika, O'qish savodxonligi, Tarbiya, Sinf soatiga biriktiriladi. Boshqa fanlar (Rus tili, Ingliz tili, Musiqa, Jismoniy tarbiya) uchun maxsus o'qituvchilar kerak.

#### D. Asosiy sinf (5-9) fanlari
- Ona tili
- Matematika
- Tabiiy fanlar (Fizika, Kimyo, Biologiya, Geografiya)
- Chet tillari (Rus tili, Ingliz tili)
- Tarix va ijtimoiy fanlar
- Jismoniy tarbiya
- Tasviriy san'at
- Musiqa madaniyati
- Informatika/Texnologiya

#### E. Yuqori sinf (10-11) fanlari
- Matematika (Algebra, Geometriya)
- Tabiiy fanlar (Fizika, Kimyo, Biologiya)
- Chet tillari
- Tarix va ijtimoiy fanlar
- Jismoniy tarbiya
- Ixtiyoriy fanlar (o'quvchi tanlashi)

#### F. Umumiy qoidalar
1. **Dars jadvali tuzilishi:**
   - Dars orasidagi tanaffus: 10-15 daqiqa
   - Tushlik tanaffusi: 20-30 daqiqa (odatda 3-4 darsdan keyin)
   - Dars boshlanish vaqti: 08:00 yoki 09:00
   - Dars tugash vaqti: 12:00-14:00 (sinf soni va dars soniga qarab)

2. **O'qituvchi ish yukligi:**
   - Haftalik dars soni: 18-24 dars (o'qituvchi turida qarab)
   - Bir kunda maksimal: 6-7 dars
   - Bir kunda minimal: 1 dars

3. **Sinflar orasida dars jadvali:**
   - Bir xil sinf bir vaqtda bir fandan o'qiydi
   - Turli sinflar turli vaqtda o'qishi mumkin
   - Tanaffus vaqtlari sinflarga qarab turli bo'lishi mumkin

4. **Maxsus qoidalar:**
   - Jismoniy tarbiya: haftalik 2-3 dars
   - Musiqa va Tasviriy san'at: haftalik 1-2 dars
   - Informatika: 5-11 sinflarda mavjud
   - Chet tillari: 2-11 sinflarda majburiy

#### G. Avtomatik taqsimlash algoritmi
Dars jadvalini tuzishda quyidagi tartibni saqlash tavsiya etiladi:
1. Boshlang'ich darslar (Ona tili, Matematika) — ertalab
2. Tabiiy fanlar — o'rtada
3. Jismoniy tarbiya, Musiqa, San'at — oxirida
4. Chet tillari — ertalab yoki o'rtada
5. Tanaffus vaqtlari — dars orasida muntazam

**Manbalar:**
- [UNESCO Global Education Monitoring Report 2026 — Uzbekistan](https://www.unesco.org/gem-report/en/2026-gem-report-country-case-studies/uzbekistan)
- [Age-Wise Education System in Uzbekistan 2026](https://www.aubsp.com/age-wise-education-system-in-uzbekistan/)
- O'zbekiston Respublikasi Maktabgacha va maktab ta'limi vazirligi

---

## Bu faylni yangilash

Faqat agent o'zi topa OLMAYDIGAN yangilik bo'lganda yangilang:
noodatiy texnologiya, yangi muhim qoida, auth o'zgarishi, buyruqlar o'zgarishi.
