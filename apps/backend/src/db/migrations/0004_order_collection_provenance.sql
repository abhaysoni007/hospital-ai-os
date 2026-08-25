-- ADR-016 Decision 4: collection provenance on diagnostic orders.
-- Additive, nullable, backward-safe. Populated atomically by the
-- collect-sample transaction; immutable afterwards (status guard).
ALTER TABLE diagnostic_orders ADD COLUMN IF NOT EXISTS collected_at TIMESTAMPTZ;
ALTER TABLE diagnostic_orders ADD COLUMN IF NOT EXISTS collected_by UUID REFERENCES staff(id);
