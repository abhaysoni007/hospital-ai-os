-- M-ACK: Critical result acknowledgement
-- Adds acknowledged_by and acknowledged_at columns to diagnostic_results.
-- Physicians and nurses acknowledge critical results after clinical review.

ALTER TABLE "diagnostic_results"
  ADD COLUMN IF NOT EXISTS "acknowledged_by" uuid REFERENCES "staff"("id"),
  ADD COLUMN IF NOT EXISTS "acknowledged_at" timestamptz;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_diagnostic_results_acknowledged"
  ON "diagnostic_results" ("acknowledged_by")
  WHERE acknowledged_by IS NOT NULL;
