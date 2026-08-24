-- Custom SQL migration file, put your code below! --
-- Create sequence for MRN generation per ADR-011
-- Sequence is year-specific. For MVP, we initialize the current year (2026).
-- A background job or lazy-init will handle future years.
CREATE SEQUENCE IF NOT EXISTS patient_mrn_seq_2026 START 1;
CREATE SEQUENCE IF NOT EXISTS patient_mrn_seq_2027 START 1;