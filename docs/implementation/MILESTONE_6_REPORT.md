# Milestone 6 Report: Patient Module — Final Acceptance Gate

## Overview

Final acceptance verification of M6 (Patient Module) against ADR-011 (MRN generation),
the accepted API contract (`docs/architecture/api-architecture.md` §2.2), and the
Phase 4/M5 RBAC boundary. All checks below were executed against a **live PostgreSQL 16
instance** (Docker, port 55432) and the **running backend**, not by static inspection alone.

**Verification commit base:** `dc421d7` (feat(patient): implement ADR-011 MRN generation)

## Corrections Applied During This Gate

| # | Issue | Correction |
|:--|:------|:-----------|
| 1 | Test DB config pointed at port 5432 (occupied by an unrelated local Postgres); project DB runs on Docker 55432 → all live tests failed | `vitest.config.ts` now reads `process.env.DATABASE_URL` with 55432 fallback; local `.env` corrected |
| 2 | Rollback test D was an unimplemented stub — sequence-gap behaviour was never actually verified | Real test implemented: audit write forced to fail AFTER `nextval()`; asserts patient row absent, audit row absent, sequence consumed exactly +1, next MRN strictly later |
| 3 | Concurrency test used only 10 registrations (gate requires ≥20) | Raised to 20 concurrent registrations with per-row MRN format assertions |
| 4 | `PATCH /patients/:id`, `POST /patients/:id/identities`, `PATCH /patients/:id/identities/:identityId` from the accepted API contract were missing | Implemented (see below) |
| 5 | Test suite cleanup attempted `DELETE FROM audit_events` (blocked by append-only trigger) | Cleanup no longer deletes audit rows (retained by design) |
| 6 | `db:migrate` hung after success (Drizzle pool not closed) | Explicit `process.exit(0)` after successful migration |
| 7 | Identity document numbers stored would be plaintext | AES-256-GCM encryption-at-rest utility (`src/utils/encryption.ts`), key via `ENCRYPTION_KEY` env |

### New endpoints (per accepted API contract)

- `PATCH /patients/:id` — `patient:update` → audit `PATIENT_UPDATED` (same transaction)
- `POST /patients/:id/identities` — `patient:create` → audit `IDENTITY_UPLOADED`; stores
  `documentType` + encrypted `documentNumberEnc`; plaintext number is never returned
- `PATCH /patients/:id/identities/:identityId` — `patient:verify_identity` → audit
  `IDENTITY_VERIFIED`; pending → verified/rejected only; re-resolution returns 409
- `GET /patients/:id` now emits contract-mandated `PATIENT_ACCESSED` audit event

## 1. ADR-011 MRN Verification (clean-database test)

Fresh database `hospital_ai_os_gate_clean` created; migrations applied cleanly:

| Check | Result |
|:---|:---|
| Sequences `patient_mrn_seq_2026`, `patient_mrn_seq_2027` exist | PASS |
| Allocation concurrency-safe (`nextval()`, non-transactional, lock-free) | PASS |
| `patients.mrn` NOT NULL (`attnotnull = t`) | PASS |
| `patients.mrn` UNIQUE (`patients_mrn_unique`) | PASS |
| UUID remains DB/API identifier (PK `patients.id`, all routes use UUID) | PASS |
| Sequence values not reused after rollback | PASS (test D, below) |
| Format `MRN-YYYY-NNNNN`, UTC year, zero-padded ≥5 digits | PASS |

## 2. Concurrent Registration (20 parallel)

Two independent executions:

1. **Service level** (vitest, live DB): 20/20 succeeded, 20 distinct MRNs, all matching
   `^MRN-2026-\d{5,}$`.
2. **HTTP API level**: 20 simultaneous `POST /api/v1/patients` completed in **845 ms**;
   20/20 returned 201 with distinct MRNs:
   `MRN-2026-00090 … MRN-2026-00109` (contiguous, zero duplicates).
   No serialization or application-lock bottleneck (native `nextval()`, no lock table on
   patients path).

## 3. Rollback (sequence gap) Test

Forced failure AFTER `nextval()` allocation by rejecting the audit write inside the
registration transaction:

- Patient row did NOT persist — PASS
- Audit row did NOT persist — PASS
- Sequence value permanently consumed: `last_value` advanced by exactly 1 — PASS
- Next successful registration received strictly later sequence value — PASS

Consistent with ADR-011 gap policy (PostgreSQL sequences are non-transactional).

## 4. Patient + Audit Atomicity

- Success path: patient row and `PATIENT_REGISTERED` audit event committed in the same
  `db.transaction()` — verified by reading both rows after registration — PASS.
- Forced audit failure: transaction rolled back; no orphan patient, no orphan audit
  event — PASS (live DB counts unchanged).

## 5. Audit Principal

DB inspection of latest `PATIENT_REGISTERED` event:

- `actor_id` = registering staff member's real UUID — PASS
- `actor_role` = canonical enum role (`receptionist`) — PASS
- `actor_department` = staff member's real department UUID — PASS
- `correlation_id` present — PASS
- Zero rows across the entire audit log with fabricated actors
  (`SYSTEM_USER` / `ADMISSIONS` / `SYSTEM`) — PASS

## 6. RBAC (live HTTP, backend authoritative)

| Request | Principal | Result |
|:---|:---|:---:|
| `POST /patients` | receptionist | 201 |
| `POST /patients` | physician | **403** |
| `GET /patients` | security_admin | **403** |
| `GET /patients` | receptionist | 200 |
| `GET /patients/:id` | receptionist | 200 |
| `PATCH /patients/:id` | receptionist | 200 |
| `PATCH /patients/:id` | physician | **403** |
| `POST /patients/:id/identities` | receptionist | 201 |
| `PATCH …/identities/:id` (verify) | physician | **403** |
| `PATCH …/identities/:id` (verify) | receptionist | 200 |
| No token | any | **401** |

Frontend visibility is UX-only; backend authorization remains authoritative.

## 7. Patient Search (live PostgreSQL)

- `pg_trgm` similarity operator used (`(first_name || ' ' || last_name) % query`),
  backed by GIN index `idx_patients_name_trgm` — PASS
- Fuzzy search matches deliberate typos ("Searchble Trigam") — PASS
- Pagination: `page=1&pageSize=3` returned exactly 3 rows with correct
  `totalPages` metadata — PASS
- Parameterized queries throughout; SQL-injection payload
  `'; DROP TABLE patients; --` returned 200 safely and table remained intact — PASS
- Response exposes approved patient fields only (no internal fields) — PASS

## 8. Build / Lint / Format / Tests

| Check | Result |
|:---|:---|
| `pnpm install --frozen-lockfile` | PASS |
| `pnpm run build` (shared tsc + backend tsc + next build) | PASS |
| `pnpm run lint` | PASS (39 pre-existing errors fixed) |
| `pnpm run format` | PASS |
| `pnpm -r run test` | PASS — shared 6/6, backend 150/150 (incl. new rollback & 20-way concurrency tests) |
| `pnpm --filter frontend exec tsc --noEmit` | PASS |
| Live script `phase4_verification.ts` (audit immutability, hash chain, rollback, concurrent appends, trigram search, principal truthfulness) | ALL PASSED |
| Live API gate `gate_api_verify.ts` | 27/27 PASSED |

## Remaining Issues

- None blocking M6. Note: `ENCRYPTION_KEY` must be set to a strong random value in any
  non-local environment (documented in `.env.example`).

## Status

**M6 STATUS = VERIFIED**
