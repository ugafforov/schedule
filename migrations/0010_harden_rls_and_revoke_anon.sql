-- Xavfsizlik: public jadvallarni PostgREST orqali bevosita kirishdan yopish.
--
-- ESLATMA: bu fayl `_journal.json`da yo'q — 0001-0009 kabi QO'LDA qo'llanadi
-- (`npm run db:migrate` faqat 0000_calm_nicolaos ni ishga tushiradi).
-- Supabase'dagi "Jadvalim" bazasiga 2026-07-30 da qo'llangan
-- (migration nomi: harden_rls_and_revoke_anon_access).
--
-- Muammo: `VITE_SUPABASE_ANON_KEY` brauzer bundle'ida oshkor, `anon` roli esa
-- barcha jadvallarga SELECT/INSERT/UPDATE/DELETE/TRUNCATE huquqiga ega edi
-- (2026-05-03 dagi "allow_anon_access_for_all_tables" migrationi), RLS esa
-- o'chiq edi. Ya'ni anon kalitga ega har kim butun bazani o'qishi va o'chirishi
-- mumkin edi.
--
-- Nega ilovaga ta'sir qilmaydi: barcha ma'lumot Hono API orqali `postgres`
-- (jadval egasi) ulanishi bilan o'qiladi/yoziladi; brauzer Supabase'ni FAQAT
-- auth uchun ishlatadi (client/src/lib/supabase.ts da .from() yo'q).
-- FORCE RLS ataylab qo'yilmagan — jadval egasi RLS'ni bypass qiladi.
--
-- MUHIM: RLS `shared/schema.ts` da ham `.enableRLS()` bilan e'lon qilingan.
-- Aks holda `npm run db:push` uni qaytadan o'chiradi (avval shunday bo'lgan:
-- RLS uch marta yoqilib, uch marta yo'qolgan).

-- 1. Barcha public jadvallarga RLS. Ataylab HECH QANDAY policy yo'q:
--    RLS yoqilgan va policy yo'q => anon/authenticated uchun kirish rad etiladi.
DO $$
DECLARE t text;
BEGIN
  FOR t IN
    SELECT c.relname FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- 2. Haddan tashqari huquqlarni qaytarib olamiz. TRUNCATE alohida muhim:
--    RLS TRUNCATE'ni umuman filtrlamaydi, faqat huquqning o'zi to'sadi.
DO $$
DECLARE t text;
BEGIN
  FOR t IN
    SELECT c.relname FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
  LOOP
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated', t);
  END LOOP;
END $$;

-- 3. RPC funksiyalari PostgREST orqali anon uchun ochiq edi (PUBLIC=EXECUTE).
--    Ilova ularni server ulanishi (postgres, funksiya egasi) orqali chaqiradi.
REVOKE ALL ON FUNCTION public.check_schedule_conflicts() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_teacher_recommendations() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_schedule_conflicts() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_teacher_recommendations() TO service_role;
