-- M12.1 P0-3: Database-level authority against concurrent double-booking.
--
-- Audit finding (Full System Audit): booking used SELECT-then-INSERT with no
-- uniqueness guarantee on the occupied slot, so two concurrent requests could
-- book the same physician/date/time while receiving distinct token numbers.
--
-- Semantics matched to the appointment lifecycle:
--   * A slot is OCCUPIED by any appointment whose status is not 'cancelled'
--     ('booked', 'checked_in', 'completed').
--   * Cancelling releases the slot; committed token numbers are never reused
--     (ADR-012 counter is not decremented).
--   * The application pre-check remains for a friendly fast-fail, but THIS
--     index is the final authority under concurrency.
--
-- Idempotent: safe to re-run (IF NOT EXISTS).

CREATE UNIQUE INDEX IF NOT EXISTS uq_appointments_active_slot
ON appointments (doctor_id, scheduled_date, scheduled_time)
WHERE status <> 'cancelled';
