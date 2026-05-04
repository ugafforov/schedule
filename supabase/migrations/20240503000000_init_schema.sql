-- 1. Jadvallarni yaratish
CREATE TABLE IF NOT EXISTS subjects (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT UNIQUE,
    description TEXT,
    color TEXT DEFAULT '#1976D2',
    weekly_hours INTEGER DEFAULT 2,
    required_room_type TEXT DEFAULT 'any',
    is_active BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS teachers (
    id SERIAL PRIMARY KEY,
    first_name TEXT DEFAULT '',
    last_name TEXT DEFAULT '',
    employee_id TEXT UNIQUE NOT NULL,
    department TEXT,
    specialization TEXT,
    phone TEXT,
    max_hours_per_week INTEGER DEFAULT 30,
    is_active BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS rooms (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    room_number TEXT NOT NULL,
    building TEXT,
    floor TEXT,
    capacity INTEGER NOT NULL,
    room_type TEXT DEFAULT 'classroom',
    is_active BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS classes (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    grade TEXT NOT NULL,
    section TEXT,
    class_teacher_id INTEGER REFERENCES teachers(id),
    total_students INTEGER DEFAULT 30,
    is_active BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS time_slots (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    day_of_week INTEGER NOT NULL,
    period_number INTEGER DEFAULT 1,
    is_break BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS class_subjects (
    id SERIAL PRIMARY KEY,
    class_id INTEGER NOT NULL REFERENCES classes(id),
    subject_id INTEGER NOT NULL REFERENCES subjects(id),
    teacher_id INTEGER REFERENCES teachers(id),
    weekly_hours INTEGER DEFAULT 2
);

CREATE TABLE IF NOT EXISTS teacher_subjects (
    id SERIAL PRIMARY KEY,
    teacher_id INTEGER NOT NULL REFERENCES teachers(id),
    subject_id INTEGER NOT NULL REFERENCES subjects(id)
);

CREATE TABLE IF NOT EXISTS teacher_unavailability (
    id SERIAL PRIMARY KEY,
    teacher_id INTEGER NOT NULL REFERENCES teachers(id),
    day_of_week INTEGER NOT NULL,
    period_number INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS schedule_entries (
    id SERIAL PRIMARY KEY,
    class_id INTEGER NOT NULL REFERENCES classes(id),
    subject_id INTEGER NOT NULL REFERENCES subjects(id),
    teacher_id INTEGER NOT NULL REFERENCES teachers(id),
    room_id INTEGER NOT NULL REFERENCES rooms(id),
    time_slot_id INTEGER NOT NULL REFERENCES time_slots(id),
    week_start_date TIMESTAMP NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS access_codes (
    id SERIAL PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    owner_name TEXT NOT NULL,
    role TEXT DEFAULT 'teacher',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT now(),
    last_used TIMESTAMP
);

-- 2. RLS Siyosatlarini faollashtirish va sozlash
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE teacher_unavailability ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_codes ENABLE ROW LEVEL SECURITY;

-- Anonim foydalanuvchilarga ruxsat berish (Login access code orqali boshqariladi)
DO $$
DECLARE
    t text;
BEGIN
    FOR t IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Enable all access for anonymous" ON %I', t);
        EXECUTE format('CREATE POLICY "Enable all access for anonymous" ON %I FOR ALL USING (true) WITH CHECK (true)', t);
    END LOOP;
END $$;

-- 3. RPC Funksiyalarni yaratish

-- Ziddiyatlarni tekshirish
CREATE OR REPLACE FUNCTION check_schedule_conflicts()
RETURNS TABLE (
    id bigint,
    conflict_type text,
    description text,
    severity text
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        e1.id::bigint,
        'teacher'::text as conflict_type,
        format('%s %s bir vaqtda %s va %s sinflarida dars o''tmoqda', t.last_name, t.first_name, c1.name, c2.name) as description,
        'high'::text as severity
    FROM schedule_entries e1
    JOIN schedule_entries e2 ON e1.teacher_id = e2.teacher_id 
        AND e1.time_slot_id = e2.time_slot_id 
        AND e1.week_start_date = e2.week_start_date
        AND e1.id < e2.id
    JOIN teachers t ON e1.teacher_id = t.id
    JOIN classes c1 ON e1.class_id = c1.id
    JOIN classes c2 ON e2.class_id = c2.id
    WHERE e1.is_active = true AND e2.is_active = true

    UNION ALL

    SELECT 
        e1.id::bigint,
        'room'::text as conflict_type,
        format('%s xonasida bir vaqtda %s (%s) va %s (%s) darslari qo''yilgan', r.name, s1.name, c1.name, s2.name, c2.name) as description,
        'high'::text as severity
    FROM schedule_entries e1
    JOIN schedule_entries e2 ON e1.room_id = e2.room_id 
        AND e1.time_slot_id = e2.time_slot_id 
        AND e1.week_start_date = e2.week_start_date
        AND e1.id < e2.id
    JOIN rooms r ON e1.room_id = r.id
    JOIN subjects s1 ON e1.subject_id = s1.id
    JOIN subjects s2 ON e2.subject_id = s2.id
    JOIN classes c1 ON e1.class_id = c1.id
    JOIN classes c2 ON e2.class_id = c2.id
    WHERE e1.is_active = true AND e2.is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- O'qituvchi tavsiyalari
CREATE OR REPLACE FUNCTION get_teacher_recommendations()
RETURNS TABLE (
    "subjectId" integer,
    "subjectName" text,
    "subjectColor" text,
    "totalWeeklyHours" bigint,
    "classCount" bigint,
    "neededTeachers" integer,
    "existingTeachers" bigint,
    "vacancies" integer
) AS $$
BEGIN
    RETURN QUERY
    WITH subject_needs AS (
        SELECT 
            s.id as s_id,
            s.name as s_name,
            s.color as s_color,
            COALESCE(SUM(cs.weekly_hours), 0) as total_hours,
            COUNT(cs.id) as classes
        FROM subjects s
        LEFT JOIN class_subjects cs ON s.id = cs.subject_id
        WHERE s.is_active = true
        GROUP BY s.id, s.name, s.color
    ),
    teacher_counts AS (
        SELECT 
            ts.subject_id,
            COUNT(DISTINCT ts.teacher_id) as t_count
        FROM teacher_subjects ts
        JOIN teachers t ON ts.teacher_id = t.id
        WHERE t.is_active = true
        GROUP BY ts.subject_id
    )
    SELECT 
        sn.s_id as "subjectId",
        sn.s_name as "subjectName",
        sn.s_color as "subjectColor",
        sn.total_hours as "totalWeeklyHours",
        sn.classes as "classCount",
        CEIL(sn.total_hours::float / 24.0)::integer as "neededTeachers",
        COALESCE(tc.t_count, 0) as "existingTeachers",
        GREATEST(0, CEIL(sn.total_hours::float / 24.0)::integer - COALESCE(tc.t_count, 0))::integer as "vacancies"
    FROM subject_needs sn
    LEFT JOIN teacher_counts tc ON sn.s_id = tc.subject_id
    WHERE sn.total_hours > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Siyosatlar: RPC chaqirish huquqi
GRANT EXECUTE ON FUNCTION check_schedule_conflicts() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_teacher_recommendations() TO anon, authenticated;

-- 4. Boshlang'ich ma'lumotlar (Seed Data)
INSERT INTO access_codes (code, owner_name, role) VALUES 
('ADMIN2024', 'Admin', 'admin'),
('TEACHER001', 'O''qituvchi 1', 'teacher'),
('SCHOOL123', 'Maktab direktori', 'admin')
ON CONFLICT (code) DO NOTHING;
