CREATE TABLE "access_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"owner_name" text NOT NULL,
	"role" text DEFAULT 'teacher' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_used" timestamp,
	CONSTRAINT "access_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text,
	"action" text NOT NULL,
	"method" text NOT NULL,
	"path" text NOT NULL,
	"details" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "class_subjects" (
	"id" serial PRIMARY KEY NOT NULL,
	"class_id" integer NOT NULL,
	"subject_id" integer NOT NULL,
	"teacher_id" integer,
	"teacher_id_2" integer,
	"weekly_hours" real DEFAULT 2 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "classes" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"grade" text NOT NULL,
	"section" text,
	"language" text DEFAULT 'uz' NOT NULL,
	"class_teacher_id" integer,
	"total_students" integer DEFAULT 30,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rooms" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"room_number" text NOT NULL,
	"building" text,
	"floor" text,
	"capacity" integer NOT NULL,
	"room_type" text DEFAULT 'classroom' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schedule_conflicts" (
	"id" serial PRIMARY KEY NOT NULL,
	"conflict_type" text NOT NULL,
	"description" text NOT NULL,
	"schedule_entry_1_id" integer,
	"schedule_entry_2_id" integer,
	"severity" text DEFAULT 'medium' NOT NULL,
	"is_resolved" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schedule_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"class_id" integer NOT NULL,
	"subject_id" integer NOT NULL,
	"teacher_id" integer NOT NULL,
	"room_id" integer NOT NULL,
	"time_slot_id" integer NOT NULL,
	"week_start_date" timestamp NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subjects" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"description" text,
	"color" text DEFAULT '#1976D2' NOT NULL,
	"weekly_hours" real DEFAULT 2 NOT NULL,
	"required_room_type" text DEFAULT 'any' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "subjects_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "teacher_subjects" (
	"id" serial PRIMARY KEY NOT NULL,
	"teacher_id" integer NOT NULL,
	"subject_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teacher_unavailability" (
	"id" serial PRIMARY KEY NOT NULL,
	"teacher_id" integer NOT NULL,
	"day_of_week" integer NOT NULL,
	"period_number" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teachers" (
	"id" serial PRIMARY KEY NOT NULL,
	"first_name" text DEFAULT '' NOT NULL,
	"last_name" text DEFAULT '' NOT NULL,
	"employee_id" text NOT NULL,
	"department" text,
	"specialization" text,
	"phone" text,
	"max_hours_per_week" integer DEFAULT 30,
	"grade_level" text DEFAULT 'high',
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "teachers_employee_id_unique" UNIQUE("employee_id")
);
--> statement-breakpoint
CREATE TABLE "time_slots" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"day_of_week" integer NOT NULL,
	"period_number" integer DEFAULT 1 NOT NULL,
	"is_break" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'teacher' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_roles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "class_subjects" ADD CONSTRAINT "class_subjects_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_subjects" ADD CONSTRAINT "class_subjects_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_subjects" ADD CONSTRAINT "class_subjects_teacher_id_teachers_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_subjects" ADD CONSTRAINT "class_subjects_teacher_id_2_teachers_id_fk" FOREIGN KEY ("teacher_id_2") REFERENCES "public"."teachers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classes" ADD CONSTRAINT "classes_class_teacher_id_teachers_id_fk" FOREIGN KEY ("class_teacher_id") REFERENCES "public"."teachers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_conflicts" ADD CONSTRAINT "schedule_conflicts_schedule_entry_1_id_schedule_entries_id_fk" FOREIGN KEY ("schedule_entry_1_id") REFERENCES "public"."schedule_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_conflicts" ADD CONSTRAINT "schedule_conflicts_schedule_entry_2_id_schedule_entries_id_fk" FOREIGN KEY ("schedule_entry_2_id") REFERENCES "public"."schedule_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_entries" ADD CONSTRAINT "schedule_entries_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_entries" ADD CONSTRAINT "schedule_entries_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_entries" ADD CONSTRAINT "schedule_entries_teacher_id_teachers_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_entries" ADD CONSTRAINT "schedule_entries_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_entries" ADD CONSTRAINT "schedule_entries_time_slot_id_time_slots_id_fk" FOREIGN KEY ("time_slot_id") REFERENCES "public"."time_slots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_subjects" ADD CONSTRAINT "teacher_subjects_teacher_id_teachers_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_subjects" ADD CONSTRAINT "teacher_subjects_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teacher_unavailability" ADD CONSTRAINT "teacher_unavailability_teacher_id_teachers_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "class_subjects_class_id_idx" ON "class_subjects" USING btree ("class_id");--> statement-breakpoint
CREATE INDEX "class_subjects_teacher_id_idx" ON "class_subjects" USING btree ("teacher_id");--> statement-breakpoint
CREATE INDEX "schedule_entries_class_id_idx" ON "schedule_entries" USING btree ("class_id");--> statement-breakpoint
CREATE INDEX "schedule_entries_teacher_id_idx" ON "schedule_entries" USING btree ("teacher_id");--> statement-breakpoint
CREATE INDEX "schedule_entries_time_slot_id_idx" ON "schedule_entries" USING btree ("time_slot_id");--> statement-breakpoint
CREATE INDEX "schedule_entries_week_start_idx" ON "schedule_entries" USING btree ("week_start_date");--> statement-breakpoint
CREATE INDEX "schedule_entries_active_idx" ON "schedule_entries" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "teacher_unavail_teacher_id_idx" ON "teacher_unavailability" USING btree ("teacher_id");--> statement-breakpoint
CREATE INDEX "teacher_unavail_lookup_idx" ON "teacher_unavailability" USING btree ("teacher_id","day_of_week","period_number");