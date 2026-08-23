CREATE TYPE "public"."ai_interaction_type" AS ENUM('note_draft', 'chart_search', 'discharge_draft', 'ocr');--> statement-breakpoint
CREATE TYPE "public"."ai_user_action" AS ENUM('pending', 'accepted', 'rejected', 'edited');--> statement-breakpoint
CREATE TYPE "public"."appointment_status" AS ENUM('booked', 'checked_in', 'in_consult', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."clinical_record_status" AS ENUM('draft', 'signed', 'amended');--> statement-breakpoint
CREATE TYPE "public"."clinical_record_type" AS ENUM('soap', 'progress_note', 'vital_signs', 'discharge_summary');--> statement-breakpoint
CREATE TYPE "public"."department_status" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TYPE "public"."diagnostic_order_status" AS ENUM('ordered', 'sample_collected', 'in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."diagnostic_result_status" AS ENUM('preliminary', 'verified', 'critical_flagged');--> statement-breakpoint
CREATE TYPE "public"."document_type" AS ENUM('aadhaar', 'pan', 'passport', 'driving_license', 'voter_id', 'other');--> statement-breakpoint
CREATE TYPE "public"."encounter_status" AS ENUM('registered', 'active', 'discharge_initiated', 'discharged', 'closed');--> statement-breakpoint
CREATE TYPE "public"."encounter_type" AS ENUM('opd', 'follow_up');--> statement-breakpoint
CREATE TYPE "public"."gender_type" AS ENUM('male', 'female', 'other', 'undisclosed');--> statement-breakpoint
CREATE TYPE "public"."grounding_status" AS ENUM('unverified', 'grounded', 'validation_failed');--> statement-breakpoint
CREATE TYPE "public"."notification_priority" AS ENUM('normal', 'urgent', 'critical');--> statement-breakpoint
CREATE TYPE "public"."notification_status" AS ENUM('dispatched', 'delivered', 'acknowledged');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('critical_lab_alert', 'task_assignment', 'break_glass_alert', 'system_alert');--> statement-breakpoint
CREATE TYPE "public"."order_priority" AS ENUM('routine', 'urgent', 'stat');--> statement-breakpoint
CREATE TYPE "public"."patient_status" AS ENUM('active', 'merged', 'archived');--> statement-breakpoint
CREATE TYPE "public"."staff_role" AS ENUM('physician', 'nurse', 'pharmacist', 'lab_technician', 'receptionist', 'hospital_admin', 'security_admin');--> statement-breakpoint
CREATE TYPE "public"."staff_status" AS ENUM('active', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."task_priority" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('created', 'assigned', 'in_progress', 'awaiting_approval', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."task_type" AS ENUM('lab_review', 'discharge_draft', 'critical_alert', 'general');--> statement-breakpoint
CREATE TYPE "public"."verification_status" AS ENUM('pending', 'verified', 'rejected');--> statement-breakpoint
CREATE TABLE "break_glass_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staff_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"justification" text NOT NULL,
	"granted_scope" jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"activated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deactivated_at" timestamp with time zone,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"review_notes" text
);
--> statement-breakpoint
CREATE TABLE "departments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"code" varchar(20) NOT NULL,
	"status" "department_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "departments_name_unique" UNIQUE("name"),
	CONSTRAINT "departments_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staff_id" uuid NOT NULL,
	"token_hash" varchar(255) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"ip_address" "inet",
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "refresh_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "staff" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" varchar(50) NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"role" "staff_role" NOT NULL,
	"department_id" uuid NOT NULL,
	"phone" varchar(20),
	"status" "staff_status" DEFAULT 'active' NOT NULL,
	"mfa_enabled" boolean DEFAULT false NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "staff_employee_id_unique" UNIQUE("employee_id"),
	CONSTRAINT "staff_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "patients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mrn" varchar(20) NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"date_of_birth" date NOT NULL,
	"gender" "gender_type" NOT NULL,
	"phone_primary" varchar(20) NOT NULL,
	"phone_emergency" varchar(20),
	"emergency_contact_name" varchar(100),
	"address_line_1" varchar(200),
	"address_city" varchar(100),
	"address_state" varchar(100),
	"address_postal_code" varchar(20),
	"status" "patient_status" DEFAULT 'active' NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "patients_mrn_unique" UNIQUE("mrn")
);
--> statement-breakpoint
CREATE TABLE "identities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"document_type" "document_type" NOT NULL,
	"document_number_enc" varchar(500) NOT NULL,
	"document_image_path" varchar(500),
	"ocr_extracted_data" jsonb,
	"verification_status" "verification_status" DEFAULT 'pending' NOT NULL,
	"verified_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "appointments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"doctor_id" uuid NOT NULL,
	"department_id" uuid NOT NULL,
	"scheduled_date" date NOT NULL,
	"scheduled_time" time NOT NULL,
	"token_number" integer,
	"status" "appointment_status" DEFAULT 'booked' NOT NULL,
	"encounter_id" uuid,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "encounters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"doctor_id" uuid NOT NULL,
	"department_id" uuid NOT NULL,
	"encounter_type" "encounter_type" NOT NULL,
	"chief_complaint" text,
	"status" "encounter_status" DEFAULT 'registered' NOT NULL,
	"started_at" timestamp with time zone,
	"discharged_at" timestamp with time zone,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clinical_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"encounter_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"record_type" "clinical_record_type" NOT NULL,
	"content" jsonb NOT NULL,
	"vitals" jsonb,
	"ai_draft_id" uuid,
	"status" "clinical_record_status" DEFAULT 'draft' NOT NULL,
	"signed_by" uuid,
	"signed_at" timestamp with time zone,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "critical_value_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"test_code" varchar(50) NOT NULL,
	"parameter_name" varchar(100) NOT NULL,
	"unit" varchar(20) NOT NULL,
	"normal_low" numeric(10, 4),
	"normal_high" numeric(10, 4),
	"critical_low" numeric(10, 4),
	"critical_high" numeric(10, 4),
	"is_active" boolean DEFAULT true NOT NULL,
	"updated_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "diagnostic_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"encounter_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"ordering_doctor_id" uuid NOT NULL,
	"test_code" varchar(50) NOT NULL,
	"test_name" varchar(200) NOT NULL,
	"clinical_indication" text,
	"priority" "order_priority" DEFAULT 'routine' NOT NULL,
	"status" "diagnostic_order_status" DEFAULT 'ordered' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "diagnostic_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"test_code" varchar(50) NOT NULL,
	"result_values" jsonb NOT NULL,
	"reference_range" jsonb,
	"is_abnormal" boolean DEFAULT false NOT NULL,
	"is_critical" boolean DEFAULT false NOT NULL,
	"critical_rule_id" uuid,
	"status" "diagnostic_result_status" DEFAULT 'preliminary' NOT NULL,
	"entered_by" uuid NOT NULL,
	"verified_by" uuid,
	"verified_at" timestamp with time zone,
	"ai_summary" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "diagnostic_results_order_id_unique" UNIQUE("order_id")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipient_id" uuid NOT NULL,
	"notification_type" "notification_type" NOT NULL,
	"title" varchar(200) NOT NULL,
	"body" text NOT NULL,
	"reference_type" varchar(50),
	"reference_id" uuid,
	"priority" "notification_priority" NOT NULL,
	"status" "notification_status" DEFAULT 'dispatched' NOT NULL,
	"acknowledged_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_type" "task_type" NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" text,
	"patient_id" uuid,
	"encounter_id" uuid,
	"assigned_to" uuid,
	"assigned_by" uuid,
	"priority" "task_priority" DEFAULT 'medium' NOT NULL,
	"status" "task_status" DEFAULT 'created' NOT NULL,
	"due_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_interactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"interaction_type" "ai_interaction_type" NOT NULL,
	"initiated_by" uuid NOT NULL,
	"patient_id" uuid,
	"encounter_id" uuid,
	"prompt_template_id" varchar(100),
	"context_summary" jsonb,
	"model_provider" varchar(50) NOT NULL,
	"model_name" varchar(100) NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"latency_ms" integer DEFAULT 0 NOT NULL,
	"raw_response" jsonb,
	"parsed_output" jsonb,
	"grounding_status" "grounding_status" DEFAULT 'unverified' NOT NULL,
	"user_action" "ai_user_action" DEFAULT 'pending' NOT NULL,
	"rejection_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "embeddings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_type" varchar(50) NOT NULL,
	"source_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"content_hash" varchar(64) NOT NULL,
	"embedding" vector(1536) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sequence_number" bigserial NOT NULL,
	"event_type" varchar(100) NOT NULL,
	"actor_id" uuid NOT NULL,
	"actor_role" varchar(50) NOT NULL,
	"actor_department" varchar(100) NOT NULL,
	"target_type" varchar(50),
	"target_id" uuid,
	"patient_id" uuid,
	"action_detail" jsonb,
	"justification" text,
	"ip_address" "inet",
	"correlation_id" uuid NOT NULL,
	"previous_hash" varchar(64) NOT NULL,
	"record_hash" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "audit_events_sequence_number_unique" UNIQUE("sequence_number")
);
--> statement-breakpoint
ALTER TABLE "break_glass_sessions" ADD CONSTRAINT "break_glass_sessions_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "break_glass_sessions" ADD CONSTRAINT "break_glass_sessions_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "break_glass_sessions" ADD CONSTRAINT "break_glass_sessions_reviewed_by_staff_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff" ADD CONSTRAINT "staff_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patients" ADD CONSTRAINT "patients_created_by_staff_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "identities" ADD CONSTRAINT "identities_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "identities" ADD CONSTRAINT "identities_verified_by_staff_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_doctor_id_staff_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_encounter_id_encounters_id_fk" FOREIGN KEY ("encounter_id") REFERENCES "public"."encounters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_created_by_staff_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "encounters" ADD CONSTRAINT "encounters_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "encounters" ADD CONSTRAINT "encounters_doctor_id_staff_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "encounters" ADD CONSTRAINT "encounters_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "encounters" ADD CONSTRAINT "encounters_created_by_staff_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_records" ADD CONSTRAINT "clinical_records_encounter_id_encounters_id_fk" FOREIGN KEY ("encounter_id") REFERENCES "public"."encounters"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_records" ADD CONSTRAINT "clinical_records_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_records" ADD CONSTRAINT "clinical_records_ai_draft_id_ai_interactions_id_fk" FOREIGN KEY ("ai_draft_id") REFERENCES "public"."ai_interactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_records" ADD CONSTRAINT "clinical_records_signed_by_staff_id_fk" FOREIGN KEY ("signed_by") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clinical_records" ADD CONSTRAINT "clinical_records_created_by_staff_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "critical_value_rules" ADD CONSTRAINT "critical_value_rules_updated_by_staff_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diagnostic_orders" ADD CONSTRAINT "diagnostic_orders_encounter_id_encounters_id_fk" FOREIGN KEY ("encounter_id") REFERENCES "public"."encounters"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diagnostic_orders" ADD CONSTRAINT "diagnostic_orders_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diagnostic_orders" ADD CONSTRAINT "diagnostic_orders_ordering_doctor_id_staff_id_fk" FOREIGN KEY ("ordering_doctor_id") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diagnostic_results" ADD CONSTRAINT "diagnostic_results_order_id_diagnostic_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."diagnostic_orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diagnostic_results" ADD CONSTRAINT "diagnostic_results_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diagnostic_results" ADD CONSTRAINT "diagnostic_results_critical_rule_id_critical_value_rules_id_fk" FOREIGN KEY ("critical_rule_id") REFERENCES "public"."critical_value_rules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diagnostic_results" ADD CONSTRAINT "diagnostic_results_entered_by_staff_id_fk" FOREIGN KEY ("entered_by") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diagnostic_results" ADD CONSTRAINT "diagnostic_results_verified_by_staff_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_id_staff_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_encounter_id_encounters_id_fk" FOREIGN KEY ("encounter_id") REFERENCES "public"."encounters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assigned_to_staff_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assigned_by_staff_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_interactions" ADD CONSTRAINT "ai_interactions_initiated_by_staff_id_fk" FOREIGN KEY ("initiated_by") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_interactions" ADD CONSTRAINT "ai_interactions_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_interactions" ADD CONSTRAINT "ai_interactions_encounter_id_encounters_id_fk" FOREIGN KEY ("encounter_id") REFERENCES "public"."encounters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "embeddings" ADD CONSTRAINT "embeddings_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_id_staff_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_patients_mrn" ON "patients" USING btree ("mrn");--> statement-breakpoint
CREATE INDEX "idx_patients_name_trgm" ON "patients" USING gin ((first_name || ' ' || last_name) gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "idx_patients_dob" ON "patients" USING btree ("date_of_birth");--> statement-breakpoint
CREATE INDEX "idx_patients_phone" ON "patients" USING btree ("phone_primary");--> statement-breakpoint
CREATE INDEX "idx_patients_status" ON "patients" USING btree ("status") WHERE deleted_at IS NULL;--> statement-breakpoint
CREATE INDEX "idx_identities_patient" ON "identities" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "idx_identities_status" ON "identities" USING btree ("verification_status");--> statement-breakpoint
CREATE INDEX "idx_appointments_patient" ON "appointments" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "idx_appointments_doctor_date" ON "appointments" USING btree ("doctor_id","scheduled_date");--> statement-breakpoint
CREATE INDEX "idx_appointments_status" ON "appointments" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_appointments_token" ON "appointments" USING btree ("doctor_id","scheduled_date","token_number") WHERE token_number IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_encounters_patient" ON "encounters" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "idx_encounters_doctor" ON "encounters" USING btree ("doctor_id");--> statement-breakpoint
CREATE INDEX "idx_encounters_status" ON "encounters" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_encounters_created" ON "encounters" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_clinical_records_encounter" ON "clinical_records" USING btree ("encounter_id");--> statement-breakpoint
CREATE INDEX "idx_clinical_records_patient" ON "clinical_records" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "idx_clinical_records_type" ON "clinical_records" USING btree ("record_type");--> statement-breakpoint
CREATE INDEX "idx_clinical_records_status" ON "clinical_records" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_critical_rules_test_code" ON "critical_value_rules" USING btree ("test_code") WHERE is_active = TRUE;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_critical_rules_active_unique" ON "critical_value_rules" USING btree ("test_code","parameter_name") WHERE is_active = TRUE;--> statement-breakpoint
CREATE INDEX "idx_diagnostic_orders_encounter" ON "diagnostic_orders" USING btree ("encounter_id");--> statement-breakpoint
CREATE INDEX "idx_diagnostic_orders_patient" ON "diagnostic_orders" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "idx_diagnostic_orders_status" ON "diagnostic_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_diagnostic_results_order" ON "diagnostic_results" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "idx_diagnostic_results_patient" ON "diagnostic_results" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "idx_diagnostic_results_critical" ON "diagnostic_results" USING btree ("is_critical") WHERE is_critical = TRUE;--> statement-breakpoint
CREATE INDEX "idx_diagnostic_results_status" ON "diagnostic_results" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_notifications_recipient" ON "notifications" USING btree ("recipient_id");--> statement-breakpoint
CREATE INDEX "idx_notifications_status" ON "notifications" USING btree ("status") WHERE status != 'acknowledged';--> statement-breakpoint
CREATE INDEX "idx_notifications_priority" ON "notifications" USING btree ("priority") WHERE priority = 'critical';--> statement-breakpoint
CREATE INDEX "idx_tasks_assigned_to" ON "tasks" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX "idx_tasks_status" ON "tasks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_tasks_priority" ON "tasks" USING btree ("priority") WHERE status NOT IN ('completed', 'cancelled');--> statement-breakpoint
CREATE INDEX "idx_ai_interactions_initiated_by" ON "ai_interactions" USING btree ("initiated_by");--> statement-breakpoint
CREATE INDEX "idx_ai_interactions_patient" ON "ai_interactions" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "idx_ai_interactions_type" ON "ai_interactions" USING btree ("interaction_type");--> statement-breakpoint
CREATE INDEX "idx_ai_interactions_created" ON "ai_interactions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_embeddings_patient" ON "embeddings" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "idx_embeddings_source" ON "embeddings" USING btree ("source_type","source_id");--> statement-breakpoint
CREATE INDEX "idx_audit_events_actor" ON "audit_events" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "idx_audit_events_event_type" ON "audit_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "idx_audit_events_target" ON "audit_events" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "idx_audit_events_patient" ON "audit_events" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "idx_audit_events_created" ON "audit_events" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_audit_events_sequence" ON "audit_events" USING btree ("sequence_number");--> statement-breakpoint
CREATE INDEX "idx_audit_events_correlation" ON "audit_events" USING btree ("correlation_id");