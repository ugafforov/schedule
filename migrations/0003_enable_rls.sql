-- Faza 1 (xavfsizlik): barcha public jadvallarga Row Level Security yoqish.
--
-- Nima uchun: `VITE_SUPABASE_ANON_KEY` brauzer bundle'ida oshkor (maxfiy emas, lekin
-- PostgREST orqali to'g'ridan-to'g'ri so'rov yuborish imkonini beradi). Ilova o'zi
-- barcha ma'lumotlarni Hono API orqali `postgres` (superuser, RLS'ni bypass qiladi)
-- ulanishi bilan o'qiydi/yozadi — shuning uchun bu policy'lar ilovaning ishlashiga
-- ta'sir qilmaydi. Maqsad — anon/authenticated Supabase rollari orqali jadvallarga
-- PostgREST orqali bevosita kirishning oldini olish (ikkinchi himoya qatlami).
--
-- Ataylab HECH QANDAY policy yozilmagan: RLS yoqilgan-u policy yo'q jadvalga
-- anon/authenticated rollari uchun standart xatti-harakat — kirish rad etiladi.

ALTER TABLE access_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_unavailability ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE joint_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE joint_lesson_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE joint_lesson_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_conflicts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
