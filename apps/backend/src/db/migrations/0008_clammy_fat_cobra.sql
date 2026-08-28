CREATE TYPE "public"."break_glass_reason" AS ENUM('emergency_care', 'patient_safety', 'continuity_of_care');--> statement-breakpoint
ALTER TABLE "break_glass_sessions" ALTER COLUMN "granted_scope" SET DEFAULT '{}';--> statement-breakpoint
ALTER TABLE "break_glass_sessions" ADD COLUMN "encounter_id" uuid;--> statement-breakpoint
ALTER TABLE "break_glass_sessions" ADD COLUMN "reason" "break_glass_reason" DEFAULT 'emergency_care' NOT NULL;--> statement-breakpoint
ALTER TABLE "break_glass_sessions" ADD COLUMN "expires_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "break_glass_sessions" ADD COLUMN "revoked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "break_glass_sessions" ADD CONSTRAINT "break_glass_sessions_encounter_id_encounters_id_fk" FOREIGN KEY ("encounter_id") REFERENCES "public"."encounters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_break_glass_actor_patient" ON "break_glass_sessions" USING btree ("staff_id","patient_id","expires_at");--> statement-breakpoint
CREATE INDEX "idx_staff_department" ON "staff" USING btree ("department_id");--> statement-breakpoint
CREATE INDEX "idx_appointments_dept_date" ON "appointments" USING btree ("department_id","scheduled_date");--> statement-breakpoint
CREATE INDEX "idx_encounters_department" ON "encounters" USING btree ("department_id");--> statement-breakpoint
CREATE INDEX "idx_diagnostic_orders_priority" ON "diagnostic_orders" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "idx_diagnostic_orders_created" ON "diagnostic_orders" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_tasks_patient" ON "tasks" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "idx_tasks_encounter" ON "tasks" USING btree ("encounter_id");--> statement-breakpoint
CREATE INDEX "idx_tasks_due_at" ON "tasks" USING btree ("due_at");