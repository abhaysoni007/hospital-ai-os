CREATE TABLE "appointment_token_counters" (
	"doctor_id" uuid NOT NULL,
	"scheduled_date" date NOT NULL,
	"last_token" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "appointment_token_counters_doctor_id_scheduled_date_pk" PRIMARY KEY("doctor_id","scheduled_date")
);
--> statement-breakpoint
ALTER TABLE "diagnostic_orders" ADD COLUMN "collected_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "diagnostic_orders" ADD COLUMN "collected_by" uuid;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "reference_type" varchar(50);--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "reference_id" uuid;--> statement-breakpoint
ALTER TABLE "appointment_token_counters" ADD CONSTRAINT "appointment_token_counters_doctor_id_staff_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diagnostic_orders" ADD CONSTRAINT "diagnostic_orders_collected_by_staff_id_fk" FOREIGN KEY ("collected_by") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_tasks_unique_reference" ON "tasks" USING btree ("reference_type","reference_id","task_type") WHERE reference_id IS NOT NULL;