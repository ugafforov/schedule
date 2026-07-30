-- Drizzle schemadan yaratib bo'lmaydigan qism: RPC funksiyalari va rol huquqlari.
-- Ta'riflar 2026-07-30 da ishlayotgan bazadan `pg_get_functiondef()` bilan olindi,
-- shuning uchun repo va baza aynan bir xil.
--
-- Xavfsizlik: `search_path` ataylab qotirilgan (search_path injection'ga qarshi),
-- funksiyalar SECURITY DEFINER EMAS — chaqiruvchi huquqi bilan ishlaydi.

CREATE OR REPLACE FUNCTION public.check_schedule_conflicts()
 RETURNS TABLE(id integer, conflict_type text, description text, schedule_entry_1_id integer, schedule_entry_2_id integer, severity text, is_resolved boolean, created_at timestamp without time zone)
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
    BEGIN
      -- Clear unresolved conflicts managed by this function
      DELETE FROM schedule_conflicts
      WHERE schedule_conflicts.is_resolved = false
        AND schedule_conflicts.conflict_type IN ('teacher', 'room', 'class', 'unavailability');

      -- 1. Detect Teacher Conflicts
      INSERT INTO schedule_conflicts (conflict_type, description, schedule_entry_1_id, schedule_entry_2_id, severity, is_resolved)
      SELECT
        'teacher'::text AS conflict_type,
        ('O''qituvchi ' || t.first_name || ' ' || t.last_name || ' bir vaqtning o''zida ' || c1.name || ' va ' || c2.name || ' sinflarida darsga ega.')::text AS description,
        se1.id AS schedule_entry_1_id,
        se2.id AS schedule_entry_2_id,
        'high'::text AS severity,
        false AS is_resolved
      FROM schedule_entries se1
      JOIN schedule_entries se2 ON se1.teacher_id = se2.teacher_id
        AND se1.time_slot_id = se2.time_slot_id
        AND se1.id < se2.id
        AND (se1.week_type = 'always' OR se2.week_type = 'always' OR se1.week_type = se2.week_type)
        AND (se1.joint_lesson_id IS NULL OR se2.joint_lesson_id IS NULL OR se1.joint_lesson_id != se2.joint_lesson_id)
      JOIN teachers t ON se1.teacher_id = t.id
      JOIN classes c1 ON se1.class_id = c1.id
      JOIN classes c2 ON se2.class_id = c2.id
      WHERE se1.is_active = true AND se2.is_active = true;

      -- 2. Detect Room Conflicts
      INSERT INTO schedule_conflicts (conflict_type, description, schedule_entry_1_id, schedule_entry_2_id, severity, is_resolved)
      SELECT
        'room'::text AS conflict_type,
        ('Xona ' || r.name || ' (xona raqami: ' || r.room_number || ') bir vaqtning o''zida ' || c1.name || ' va ' || c2.name || ' sinflariga taqsimlangan.')::text AS description,
        se1.id AS schedule_entry_1_id,
        se2.id AS schedule_entry_2_id,
        'medium'::text AS severity,
        false AS is_resolved
      FROM schedule_entries se1
      JOIN schedule_entries se2 ON se1.room_id = se2.room_id
        AND se1.time_slot_id = se2.time_slot_id
        AND se1.id < se2.id
        AND (se1.week_type = 'always' OR se2.week_type = 'always' OR se1.week_type = se2.week_type)
        AND (se1.joint_lesson_id IS NULL OR se2.joint_lesson_id IS NULL OR se1.joint_lesson_id != se2.joint_lesson_id)
      JOIN rooms r ON se1.room_id = r.id
      JOIN classes c1 ON se1.class_id = c1.id
      JOIN classes c2 ON se2.class_id = c2.id
      WHERE se1.is_active = true AND se2.is_active = true;

      -- 3. Detect Class Conflicts
      INSERT INTO schedule_conflicts (conflict_type, description, schedule_entry_1_id, schedule_entry_2_id, severity, is_resolved)
      SELECT
        'class'::text AS conflict_type,
        ('Sinf ' || c.name || ' bir vaqtda ikkita darsga ega: ' || s1.name || ' va ' || s2.name || '.')::text AS description,
        se1.id AS schedule_entry_1_id,
        se2.id AS schedule_entry_2_id,
        'high'::text AS severity,
        false AS is_resolved
      FROM schedule_entries se1
      JOIN schedule_entries se2 ON se1.class_id = se2.class_id
        AND se1.time_slot_id = se2.time_slot_id
        AND se1.id < se2.id
        AND (se1.week_type = 'always' OR se2.week_type = 'always' OR se1.week_type = se2.week_type)
        AND (se1.joint_lesson_id IS NULL OR se2.joint_lesson_id IS NULL OR se1.joint_lesson_id != se2.joint_lesson_id)
      JOIN classes c ON se1.class_id = c.id
      JOIN subjects s1 ON se1.subject_id = s1.id
      JOIN subjects s2 ON se2.subject_id = s2.id
      WHERE se1.is_active = true AND se2.is_active = true;

      -- 4. Detect Teacher Unavailability Conflicts
      INSERT INTO schedule_conflicts (conflict_type, description, schedule_entry_1_id, severity, is_resolved)
      SELECT
        'unavailability'::text AS conflict_type,
        ('O''qituvchi ' || t.last_name || ' ' || t.first_name || ' uchun ' ||
        CASE tu.day_of_week
          WHEN 1 THEN 'Dushanba'
          WHEN 2 THEN 'Seshanba'
          WHEN 3 THEN 'Chorshanba'
          WHEN 4 THEN 'Payshanba'
          WHEN 5 THEN 'Juma'
          WHEN 6 THEN 'Shanba'
          ELSE 'Noma''lum kun'
        END || ' kuni ' || tu.period_number || '-soat dars o''tish taqiqlangan, lekin u ' || c.name || ' sinfiga darsga biriktirilgan.')::text AS description,
        se.id AS schedule_entry_1_id,
        'high'::text AS severity,
        false AS is_resolved
      FROM schedule_entries se
      JOIN time_slots ts ON se.time_slot_id = ts.id
      JOIN teacher_unavailability tu ON se.teacher_id = tu.teacher_id
        AND ts.day_of_week = tu.day_of_week
        AND ts.period_number = tu.period_number
      JOIN teachers t ON se.teacher_id = t.id
      JOIN classes c ON se.class_id = c.id
      WHERE se.is_active = true;

      RETURN QUERY
      SELECT
        sc.id,
        sc.conflict_type,
        sc.description,
        sc.schedule_entry_1_id,
        sc.schedule_entry_2_id,
        sc.severity,
        sc.is_resolved,
        sc.created_at
      FROM schedule_conflicts sc
      WHERE sc.is_resolved = false;
    END;
    $function$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.get_teacher_recommendations()
 RETURNS TABLE("subjectId" integer, "subjectName" text, "subjectColor" text, "totalWeeklyHours" bigint, "classCount" bigint, "neededTeachers" integer, "existingTeachers" bigint, vacancies integer)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
    RETURN QUERY
    WITH subject_needs AS (
        SELECT
            s.id as s_id,
            s.name as s_name,
            s.color as s_color,
            COALESCE(SUM(cs.weekly_hours), 0)::bigint as total_hours,
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
        sn.s_id,
        sn.s_name,
        sn.s_color,
        sn.total_hours,
        sn.classes,
        CEIL(sn.total_hours::float / 24.0)::integer,
        COALESCE(tc.t_count, 0),
        GREATEST(0, CEIL(sn.total_hours::float / 24.0)::integer - COALESCE(tc.t_count, 0))::integer
    FROM subject_needs sn
    LEFT JOIN teacher_counts tc ON sn.s_id = tc.subject_id
    WHERE sn.total_hours > 0;
END;
$function$;
--> statement-breakpoint
-- Rol huquqlari: `anon`/`authenticated` public jadvallarga TEGMASIN.
-- Ilova barcha ma'lumotni Hono API orqali `postgres` (jadval egasi) ulanishi bilan
-- o'qiydi/yozadi; brauzer Supabase'ni faqat auth uchun ishlatadi. RLS 0000 baseline'da
-- yoqilgan va HECH QANDAY policy yo'q => anon/authenticated uchun kirish rad etiladi.
-- TRUNCATE alohida muhim: RLS uni filtrlamaydi, faqat huquqning o'zi to'sadi.
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
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.check_schedule_conflicts() FROM PUBLIC, anon, authenticated;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.get_teacher_recommendations() FROM PUBLIC, anon, authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.check_schedule_conflicts() TO service_role;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.get_teacher_recommendations() TO service_role;
