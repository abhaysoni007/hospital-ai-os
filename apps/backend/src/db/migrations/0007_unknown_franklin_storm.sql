CREATE TYPE "public"."break_glass_reason" AS ENUM('emergency_care', 'patient_safety', 'continuity_of_care');
--> statement-breakpoint
ALTER TABLE "break_glass_sessions" ADD COLUMN "encounter_id" uuid;
--> statement-breakpoint
ALTER TABLE "break_glass_sessions" ADD COLUMN "reason" "public"."break_glass_reason" DEFAULT 'emergency_care' NOT NULL;
--> statement-breakpoint
ALTER TABLE "break_glass_sessions" ADD COLUMN "expires_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "break_glass_sessions" ADD COLUMN "revoked_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "break_glass_sessions" ADD CONSTRAINT "break_glass_sessions_encounter_id_encounters_id_fk" FOREIGN KEY ("encounter_id") REFERENCES "public"."encounters"("id") ON DELETE no action ON UPDATE no action;
