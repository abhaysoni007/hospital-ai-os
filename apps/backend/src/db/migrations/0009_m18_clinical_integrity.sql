-- M18 Part 1: clinical data integrity.
--
-- 1. patients.version — optimistic-concurrency counter for demographic updates.
--    Defaults to 1; the service increments on every successful write. Pre-existing
--    rows backfill to 1 so the guard is consistent from the moment the column exists.
--
-- 2. diagnostic_orders.client_request_id — idempotency key for createOrder.
--    Partial UNIQUE: only enforced when the client supplies a key. Scoped per
--    encounter so a key reused across two encounters (different orders) is
--    permitted. Pre-existing rows backfill to NULL so the partial index
--    skips them.
ALTER TABLE "patients" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "diagnostic_orders" ADD COLUMN "client_request_id" varchar(100);--> statement-breakpoint
CREATE UNIQUE INDEX "idx_diagnostic_orders_idempotency"
  ON "diagnostic_orders" USING btree ("encounter_id","client_request_id")
  WHERE "client_request_id" IS NOT NULL;
