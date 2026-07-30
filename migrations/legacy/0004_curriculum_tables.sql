-- Faza 2 (curriculum yagona manba): DTS o'quv reja ma'lumotlarini DB'ga ko'chirish uchun jadvallar.
-- Har bir "plan" bitta rasmiy buyruq/yil/tilga mos keladi (versiyalash uchun) — DTS yangilanganda
-- yangi plan yaratiladi, eskisi isActive=false qilinadi, kod o'zgarmaydi.

CREATE TABLE IF NOT EXISTS curriculum_plans (
  id SERIAL PRIMARY KEY,
  year TEXT NOT NULL,
  order_number TEXT,
  language TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS curriculum_entries (
  id SERIAL PRIMARY KEY,
  plan_id INTEGER NOT NULL REFERENCES curriculum_plans(id) ON DELETE CASCADE,
  grade INTEGER NOT NULL,
  subject_name TEXT NOT NULL,
  codes JSONB NOT NULL DEFAULT '[]',
  keywords JSONB NOT NULL DEFAULT '[]',
  weekly_hours REAL NOT NULL,
  recommended_specialty TEXT
);

CREATE INDEX IF NOT EXISTS curriculum_entries_plan_id_idx ON curriculum_entries(plan_id);
CREATE INDEX IF NOT EXISTS curriculum_entries_plan_grade_idx ON curriculum_entries(plan_id, grade);

ALTER TABLE curriculum_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE curriculum_entries ENABLE ROW LEVEL SECURITY;
