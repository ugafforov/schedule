-- Create joint_lessons table
CREATE TABLE IF NOT EXISTS "joint_lessons" (
  "id" serial PRIMARY KEY NOT NULL,
  "subject_id" integer NOT NULL REFERENCES "subjects"("id") ON DELETE CASCADE,
  "weekly_hours" real NOT NULL DEFAULT 2,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp NOT NULL DEFAULT now()
);

-- Create joint_lesson_classes table
CREATE TABLE IF NOT EXISTS "joint_lesson_classes" (
  "id" serial PRIMARY KEY NOT NULL,
  "joint_lesson_id" integer NOT NULL REFERENCES "joint_lessons"("id") ON DELETE CASCADE,
  "class_id" integer NOT NULL REFERENCES "classes"("id") ON DELETE CASCADE
);

-- Create joint_lesson_groups table
CREATE TABLE IF NOT EXISTS "joint_lesson_groups" (
  "id" serial PRIMARY KEY NOT NULL,
  "joint_lesson_id" integer NOT NULL REFERENCES "joint_lessons"("id") ON DELETE CASCADE,
  "group_name" text NOT NULL,
  "teacher_id" integer NOT NULL REFERENCES "teachers"("id") ON DELETE CASCADE,
  "room_id" integer REFERENCES "rooms"("id") ON DELETE SET NULL
);

-- Add indexes
CREATE INDEX IF NOT EXISTS "joint_lesson_classes_joint_lesson_id_idx" ON "joint_lesson_classes"("joint_lesson_id");
CREATE INDEX IF NOT EXISTS "joint_lesson_classes_class_id_idx" ON "joint_lesson_classes"("class_id");
CREATE INDEX IF NOT EXISTS "joint_lesson_groups_joint_lesson_id_idx" ON "joint_lesson_groups"("joint_lesson_id");
CREATE INDEX IF NOT EXISTS "joint_lesson_groups_teacher_id_idx" ON "joint_lesson_groups"("teacher_id");

-- Add joint_lesson_id column to schedule_entries
ALTER TABLE "schedule_entries" ADD COLUMN IF NOT EXISTS "joint_lesson_id" integer REFERENCES "joint_lessons"("id") ON DELETE SET NULL;

-- Update check_schedule_conflicts function
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
  -- Clear all unresolved conflicts first
  DELETE FROM schedule_conflicts WHERE schedule_conflicts.is_resolved = false;

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
  WHERE se1.is_active = true AND se2.is_active = true
    AND (
      se1.joint_lesson_id IS NULL 
      OR se2.joint_lesson_id IS NULL 
      OR se1.joint_lesson_id != se2.joint_lesson_id
    );

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
  WHERE se1.is_active = true AND se2.is_active = true
    AND (
      se1.joint_lesson_id IS NULL 
      OR se2.joint_lesson_id IS NULL 
      OR se1.joint_lesson_id != se2.joint_lesson_id
    );

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
  WHERE se1.is_active = true AND se2.is_active = true
    AND (
      se1.joint_lesson_id IS NULL 
      OR se2.joint_lesson_id IS NULL 
      OR se1.joint_lesson_id != se2.joint_lesson_id
    );

  -- Return the unresolved conflicts
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
