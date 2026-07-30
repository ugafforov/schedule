-- Faza 3.4 (konflikt-aniqlashni yarashtirish): check_schedule_conflicts() har chaqirilganda
-- (GET /api/schedule-conflicts) "DELETE FROM schedule_conflicts WHERE is_resolved = false"
-- BARCHA hal qilinmagan konfliktlarni o'chirib yuborardi — shu jumladan generateSchedule()
-- o'zi yozgan SanPiN yumshoq konfliktlarini ("schedule_overlap" turi), keyin faqat
-- teacher/room/class turidagi qattiq to'qnashuvlarni qayta yozardi. Natijada solver
-- generatsiya paytida yozgan SanPiN ogohlantirishlari administrator "Ziddiyatlar"
-- sahifasini birinchi ochganda sezilmasdan yo'qolib qolardi.
--
-- Tuzatish: DELETE va keyingi qayta hisoblashni faqat shu funksiya boshqaradigan
-- conflict_type'lar (teacher/room/class) bilan chegaralaymiz — solverning "schedule_overlap"
-- yozuvlariga tegilmaydi. Ikkala tizim endi bir-birining natijasini "bexabar" o'chirmaydi.

DROP FUNCTION IF EXISTS check_schedule_conflicts();

CREATE OR REPLACE FUNCTION check_schedule_conflicts()
RETURNS TABLE (
  id integer,
  conflict_type text,
  description text,
  schedule_entry_1_id integer,
  schedule_entry_2_id integer,
  severity text,
  is_resolved boolean,
  created_at timestamp
) AS $$
BEGIN
  -- Faqat shu funksiya boshqaradigan turlarni tozalaymiz (hal qilinmaganlar orasidan)
  DELETE FROM schedule_conflicts
  WHERE schedule_conflicts.is_resolved = false
    AND schedule_conflicts.conflict_type IN ('teacher', 'room', 'class');

  -- 1. Detect Teacher Conflicts
  INSERT INTO schedule_conflicts (conflict_type, description, schedule_entry_1_id, schedule_entry_2_id, severity, is_resolved)
  SELECT
    'teacher' AS conflict_type,
    'O''qituvchi ' || t.first_name || ' ' || t.last_name || ' bir vaqtning o''zida ' || c1.name || ' va ' || c2.name || ' sinflarida darsga ega.' AS description,
    se1.id AS schedule_entry_1_id,
    se2.id AS schedule_entry_2_id,
    'high' AS severity,
    false AS is_resolved
  FROM schedule_entries se1
  JOIN schedule_entries se2 ON se1.teacher_id = se2.teacher_id
    AND se1.time_slot_id = se2.time_slot_id
    AND se1.id < se2.id
    AND (se1.week_type = 'always' OR se2.week_type = 'always' OR se1.week_type = se2.week_type)
  JOIN teachers t ON se1.teacher_id = t.id
  JOIN classes c1 ON se1.class_id = c1.id
  JOIN classes c2 ON se2.class_id = c2.id
  WHERE se1.is_active = true AND se2.is_active = true;

  -- 2. Detect Room Conflicts
  INSERT INTO schedule_conflicts (conflict_type, description, schedule_entry_1_id, schedule_entry_2_id, severity, is_resolved)
  SELECT
    'room' AS conflict_type,
    'Xona ' || r.name || ' (xona raqami: ' || r.room_number || ') bir vaqtning o''zida ' || c1.name || ' va ' || c2.name || ' sinflariga taqsimlangan.' AS description,
    se1.id AS schedule_entry_1_id,
    se2.id AS schedule_entry_2_id,
    'medium' AS severity,
    false AS is_resolved
  FROM schedule_entries se1
  JOIN schedule_entries se2 ON se1.room_id = se2.room_id
    AND se1.time_slot_id = se2.time_slot_id
    AND se1.id < se2.id
    AND (se1.week_type = 'always' OR se2.week_type = 'always' OR se1.week_type = se2.week_type)
  JOIN rooms r ON se1.room_id = r.id
  JOIN classes c1 ON se1.class_id = c1.id
  JOIN classes c2 ON se2.class_id = c2.id
  WHERE se1.is_active = true AND se2.is_active = true;

  -- 3. Detect Class Conflicts
  INSERT INTO schedule_conflicts (conflict_type, description, schedule_entry_1_id, schedule_entry_2_id, severity, is_resolved)
  SELECT
    'class' AS conflict_type,
    'Sinf ' || c.name || ' bir vaqtda ikkita darsga ega: ' || s1.name || ' va ' || s2.name || '.' AS description,
    se1.id AS schedule_entry_1_id,
    se2.id AS schedule_entry_2_id,
    'high' AS severity,
    false AS is_resolved
  FROM schedule_entries se1
  JOIN schedule_entries se2 ON se1.class_id = se2.class_id
    AND se1.time_slot_id = se2.time_slot_id
    AND se1.id < se2.id
    AND (se1.week_type = 'always' OR se2.week_type = 'always' OR se1.week_type = se2.week_type)
  JOIN classes c ON se1.class_id = c.id
  JOIN subjects s1 ON se1.subject_id = s1.id
  JOIN subjects s2 ON se2.subject_id = s2.id
  WHERE se1.is_active = true AND se2.is_active = true;

  -- Barcha hal qilinmagan konfliktlarni qaytaramiz (teacher/room/class + solverning schedule_overlap turi)
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
$$ LANGUAGE plpgsql;
