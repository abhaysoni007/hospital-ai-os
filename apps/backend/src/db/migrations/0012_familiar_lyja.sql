CREATE TYPE "public"."recommendation_status" AS ENUM('proposed', 'approved', 'executed', 'rejected', 'policy_rejected', 'execution_failed', 'insufficient_evidence', 'unavailable');--> statement-breakpoint
CREATE TYPE "public"."signal_severity" AS ENUM('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');--> statement-breakpoint
CREATE TYPE "public"."signal_status" AS ENUM('detected', 'analyzed', 'actioned', 'dismissed', 'resolved', 'stale');--> statement-breakpoint
CREATE TYPE "public"."signal_type" AS ENUM('PENDING_DIAGNOSTIC_RESULT', 'CRITICAL_RESULT_UNACKNOWLEDGED', 'ENCOUNTER_WITHOUT_CLINICAL_RECORD');--> statement-breakpoint
ALTER TYPE "public"."ai_interaction_type" ADD VALUE 'hospital_bottleneck';--> statement-breakpoint
CREATE TABLE "hospital_intelligence_signals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"signal_type" "signal_type" NOT NULL,
	"severity" "signal_severity" NOT NULL,
	"title" varchar(200) NOT NULL,
	"description" text NOT NULL,
	"detected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" "signal_status" DEFAULT 'detected' NOT NULL,
	"patient_id" uuid,
	"encounter_id" uuid,
	"evidence_refs" jsonb NOT NULL,
	"deterministic_reason" text NOT NULL,
	"ai_interaction_id" uuid,
	"ai_explanation" jsonb,
	"recommendation_id" uuid,
	"analysis_correlation_id" uuid NOT NULL,
	"requested_by" uuid NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "intelligence_approved_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"signal_id" uuid NOT NULL,
	"action_type" varchar(100) NOT NULL,
	"rationale" text NOT NULL,
	"evidence_refs" jsonb NOT NULL,
	"requires_human_approval" boolean DEFAULT true NOT NULL,
	"policy_status" "recommendation_status" DEFAULT 'proposed' NOT NULL,
	"executable_status" "recommendation_status" DEFAULT 'proposed' NOT NULL,
	"idempotency_key" varchar(255) NOT NULL,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"rejected_by" uuid,
	"rejected_at" timestamp with time zone,
	"rejection_reason" text,
	"execution_result" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "diagnostic_orders" ADD COLUMN "client_request_id" varchar(100);--> statement-breakpoint
ALTER TABLE "diagnostic_results" ADD COLUMN "acknowledged_by" uuid;--> statement-breakpoint
ALTER TABLE "diagnostic_results" ADD COLUMN "acknowledged_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "hospital_intelligence_signals" ADD CONSTRAINT "hospital_intelligence_signals_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hospital_intelligence_signals" ADD CONSTRAINT "hospital_intelligence_signals_encounter_id_encounters_id_fk" FOREIGN KEY ("encounter_id") REFERENCES "public"."encounters"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hospital_intelligence_signals" ADD CONSTRAINT "hospital_intelligence_signals_ai_interaction_id_ai_interactions_id_fk" FOREIGN KEY ("ai_interaction_id") REFERENCES "public"."ai_interactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hospital_intelligence_signals" ADD CONSTRAINT "hospital_intelligence_signals_requested_by_staff_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intelligence_approved_actions" ADD CONSTRAINT "intelligence_approved_actions_signal_id_hospital_intelligence_signals_id_fk" FOREIGN KEY ("signal_id") REFERENCES "public"."hospital_intelligence_signals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intelligence_approved_actions" ADD CONSTRAINT "intelligence_approved_actions_approved_by_staff_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intelligence_approved_actions" ADD CONSTRAINT "intelligence_approved_actions_rejected_by_staff_id_fk" FOREIGN KEY ("rejected_by") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_signals_status" ON "hospital_intelligence_signals" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_signals_type" ON "hospital_intelligence_signals" USING btree ("signal_type");--> statement-breakpoint
CREATE INDEX "idx_signals_severity" ON "hospital_intelligence_signals" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "idx_signals_patient" ON "hospital_intelligence_signals" USING btree ("patient_id") WHERE patient_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_signals_created" ON "hospital_intelligence_signals" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_signals_correlation" ON "hospital_intelligence_signals" USING btree ("analysis_correlation_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_approved_actions_idempotency" ON "intelligence_approved_actions" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "idx_approved_actions_signal" ON "intelligence_approved_actions" USING btree ("signal_id");--> statement-breakpoint
CREATE INDEX "idx_approved_actions_status" ON "intelligence_approved_actions" USING btree ("policy_status");--> statement-breakpoint
ALTER TABLE "diagnostic_results" ADD CONSTRAINT "diagnostic_results_acknowledged_by_staff_id_fk" FOREIGN KEY ("acknowledged_by") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_patients_pagination" ON "patients" USING btree ("created_at","id");--> statement-breakpoint
CREATE INDEX "idx_appointments_pagination" ON "appointments" USING btree ("created_at","id");--> statement-breakpoint
CREATE INDEX "idx_encounters_pagination" ON "encounters" USING btree ("created_at","id");--> statement-breakpoint
CREATE INDEX "idx_clinical_records_pagination" ON "clinical_records" USING btree ("created_at","id");--> statement-breakpoint
CREATE INDEX "idx_diagnostic_orders_idempotency" ON "diagnostic_orders" USING btree ("encounter_id","client_request_id") WHERE client_request_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_diagnostic_orders_pagination" ON "diagnostic_orders" USING btree ("created_at","id");--> statement-breakpoint
CREATE INDEX "idx_notifications_pagination" ON "notifications" USING btree ("created_at","id");--> statement-breakpoint
CREATE INDEX "idx_tasks_pagination" ON "tasks" USING btree ("created_at","id");--> statement-breakpoint
CREATE INDEX "idx_audit_events_pagination" ON "audit_events" USING btree ("created_at","id");