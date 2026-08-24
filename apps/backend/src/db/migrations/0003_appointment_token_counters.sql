-- ADR-012: Appointment token number allocation.
-- Per-doctor/per-day high-water mark. Allocation is an atomic
-- upsert-increment executed INSIDE the booking transaction:
--
--   INSERT INTO appointment_token_counters AS c (doctor_id, scheduled_date, last_token)
--   VALUES ($1, $2, 1)
--   ON CONFLICT (doctor_id, scheduled_date)
--   DO UPDATE SET last_token = c.last_token + 1
--   RETURNING last_token;
--
-- The row-level exclusive lock is held until COMMIT; rollback reverts the
-- increment (no gaps). Committed tokens are never reused by cancellation.
-- The existing partial unique index idx_appointments_token remains the
-- defense-in-depth uniqueness guarantee.
CREATE TABLE IF NOT EXISTS appointment_token_counters (
  doctor_id      UUID    NOT NULL REFERENCES staff(id),
  scheduled_date DATE    NOT NULL,
  last_token     INTEGER NOT NULL DEFAULT 0 CHECK (last_token >= 0),
  PRIMARY KEY (doctor_id, scheduled_date)
);
