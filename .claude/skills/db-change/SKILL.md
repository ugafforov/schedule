---
name: db-change
description: Database schema oʻzgartirish workflow (Drizzle + Supabase). Yangi jadval, ustun yoki index qoʻshishda ishlating.
---

# Schema oʻzgartirish tartibi

1. **Hozirgi holatni tekshiring:** Supabase MCP `list_tables` bilan real bazadagi strukturani koʻring — schema.ts bilan farq boʻlishi mumkin.
2. **`shared/schema.ts`** — jadval/ustun qoʻshing yoki oʻzgartiring. Drizzle-zod insert schema'larini ham yangilang.
3. **Storage qatlami:** `server/storage/IStorage.ts` interfeysiga metod qoʻshing → tegishli `*.storage.ts` faylda implementatsiya → `server/storage/index.ts` da bind tekshiring.
4. **Bazaga qoʻllash:**
   - Dev: `npm run db:push` (tezkor, migration yaratmaydi)
   - Prod uchun: `npm run db:generate` → migration faylni koʻzdan kechiring → `npm run db:migrate`
5. **Qoidalar:**
   - Soft delete: `isActive: false` ustuni — hard DELETE yoʻq
   - Mavjud ustunlarni oʻchirish/nomini oʻzgartirishdan oldin foydalanuvchidan tasdiqlang (maʼlumot yoʻqolishi mumkin)
6. **Tekshirish:** `npm run check` + Supabase MCP `execute_sql` bilan yangi struktura va (kerak boʻlsa) test soʻrov.
