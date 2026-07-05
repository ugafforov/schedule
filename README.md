# Maktab Dars Jadvali

O'zbekiston maktablari uchun dars jadvalini avtomatik yaratish va boshqarish tizimi.

## Texnologiyalar

- **Frontend**: React 18 + TypeScript + Vite + TailwindCSS + shadcn/ui
- **Backend**: Hono (Node.js) + Drizzle ORM
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth (email/password)
- **Platforma**: Web / PWA

## Ishga tushirish

### Talablar
- Node.js 20+
- Supabase loyihasi

### O'rnatish

```bash
npm install
```

### Muhit o'zgaruvchilari

`.env` faylini yarating:

```env
DATABASE_URL=postgresql://...
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

### Development

```bash
npm run dev
```

Server `http://localhost:5001` da ishga tushadi (Vite + API birgalikda).

### Production build

```bash
npm run build
npm start
```

## Loyiha tuzilmasi

```
├── client/          # React frontend
│   ├── src/
│   │   ├── pages/   # Sahifalar
│   │   ├── components/
│   │   ├── hooks/
│   │   └── lib/
│   └── public/      # PWA assets
├── server/          # Hono backend
│   ├── routes/      # API endpointlar
│   ├── services/    # Biznes logika
│   ├── middleware/  # Auth middleware
│   └── storage/     # Database layer
└── shared/          # Umumiy types va schema
    ├── schema.ts    # Drizzle ORM schema
    └── curriculum.ts # O'quv reja (1-11 sinf)
```

## Asosiy xususiyatlar

- Avtomatik dars jadvali yaratish (DTS 2025-2026 asosida)
- O'qituvchilar, sinflar, fanlar, xonalar boshqaruvi
- Ziddiyatlarni aniqlash (o'qituvchi/xona/sinf)
- PWA — telefonga o'rnatish mumkin
