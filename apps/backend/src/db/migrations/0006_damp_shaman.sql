ALTER TABLE "tasks" ADD COLUMN "reference_type" varchar(50);--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "reference_id" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_tasks_unique_reference" ON "tasks" USING btree ("reference_type","reference_id","task_type") WHERE reference_id IS NOT NULL;