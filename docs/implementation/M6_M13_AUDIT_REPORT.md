# M6–M13 Implementation Audit

## Executive Verdict

All eight milestones (M6–M13) are genuinely implemented with substantial, executing verification suites against a real Postgres database. The audit found no architectural conflicts, no security stop conditions (no PHI exposure, no authorization bypass, no AI-determined critical values, no audit tamper path, no unsigned-record mutation, no discharge without authorization). Two verification-coverage gaps were found and closed with new tests rather than code changes: M6 lacked direct tests for search/duplicate-detection/identity-document flows, and M7 lacked direct tests for hash-chain integrity under concurrency and DB-level append-only enforcement. After remediation, all eight milestones are VERIFIED.

## Audit Method

Direct code inspection of every module under `apps/backend/src/modules/`, enumeration of every test case name in each `__tests__/` suite, reading of the relevant migrations and DB triggers, reading of existing milestone reports, and execution of the canonical verification commands (`pnpm install --frozen-lockfile`, `pnpm run build`, `pnpm run lint`, prettier, `pnpm -r run test`) plus the new gap-closing tests. Milestone claims were checked against acceptance criteria, not against report text or commit messages.

## Milestone Matrix

| Milestone | Status | Implementation | Tests | Runtime | Security | Report | Gaps |
|---|---|---|---|---|---|---|---|
| M6 | VERIFIED | patient.service (register/MRN/search/duplicates/identity) | MRN/concurrency suite + NEW acceptance suite (9 tests) | real-DB | RBAC via patient:* permissions | MILESTONE_6_REPORT.md exists | test-coverage gap closed this audit |
| M7 | VERIFIED | audit.service hash chain + 0001 append-only trigger | NEW integrity suite (4 tests) + rollback tests across modules | real-DB | append-only DB-enforced; security_admin-only query | none (documented in M6 report notes) | dedicated test suite was missing — closed this audit |
| M8 | VERIFIED | appointment + encounter modules | 25 appointment tests + state-machine + encounter suites | real-DB | dept scope, uq constraint, token concurrency | MILESTONE_8_REPORT.md exists | none found |
| M9 | VERIFIED | clinical module + state machine | 13 lifecycle/concurrency/immutability/PHI tests + m9 RBAC matrix | real-DB | author-only sign, version conflicts, signed immutability | MILESTONE_9_REPORT.md exists | none found |
| M10 | VERIFIED | diagnostics module + deterministic critical-value-evaluator | 22 evaluator boundary/determinism tests + 11 integration tests + m10 RBAC matrix | real-DB | deterministic classification (no AI), atomic critical flow | MILESTONE_10_REPORT.md exists | none found |
| M11 | VERIFIED | ai module (adapters/orchestrator/resilience/validation/persistence/readiness) | resilience, readiness, budget, output-pipeline, orchestrator suites | real-DB + fake provider | fail-closed unconfigured, encrypted at rest, authz-before-projection | MILESTONE_11_REPORT.md exists | none found |
| M12 | VERIFIED | ai/capabilities (note draft, chart brief) | m12-hero integration (atomic binding, TTL, cross-scope), interaction-action audit suite, projections-gaps | real-DB | prompt-injection ceiling, citation validation, no auto-sign | MILESTONE_12_REPORT.md (+12_1/12_2) exists | none found |
| M13 | VERIFIED | encounter discharge flow (discharge.integration) | 7 discharge tests: authz, diagnostic resolution, concurrency, audit, immutability, rollback | real-DB | physician-only, AI-independent path | covered in M9/M10 reports | no dedicated MILESTONE_13 report file (see findings) |

## M6 Findings

Implementation (`patient.service.ts`): registration with in-transaction exact duplicate check (name+DOB or phone → 409 `DUPLICATE_PATIENT`), MRN generation via year-scoped Postgres sequence, trigram (pg_trgm) fuzzy search plus exact MRN/phone/status filters with pagination metadata, identity documents stored encrypted (`encryptField`, `iv:tag:ciphertext` — never plaintext), verification lifecycle (`pending → verified|rejected`, re-decision → 409), and `PATIENT_REGISTERED` / `IDENTITY_UPLOADED` / `IDENTITY_VERIFIED` audit events in the same transaction. Existing tests covered MRN format, 20-way concurrent registration uniqueness, rollback, and registration audit. **Gap found:** no direct tests for search behavior, duplicate rejection, identity upload encryption, or verification lifecycle. **Closed:** new `patient.acceptance.test.ts` (9 tests, all passing) — duplicate detection both variants, MRN/phone/fuzzy search, pagination, PHI-safe responses, encrypted-at-rest identity storage, verification decision + audit + 409 on re-decision.

## M7 Findings

Implementation (`audit.service.ts` + migration `0001_audit_append_only.sql`): SHA-256 hash chain (previousHash + canonical JSON payload), `LOCK TABLE audit_events IN EXCLUSIVE MODE` for chain serialization under concurrency, genesis hash for the first event, and a **database trigger** raising `audit_events is an append-only table` on UPDATE/DELETE — immutability is enforced at the DB level, not by convention. Query API (`audit.routes.ts`) requires authentication + `audit_event:read` (security_admin, hospital_admin per M5). Transactionality is verified across consumer suites (patient D2, appointment H, clinical L, diagnostics H, discharge 7, task/notification suites). **Gap found:** no test suite directly proved chain continuity under concurrent writes, DB-level append-only enforcement, or recomputation-based tamper detection. **Closed:** new `audit.integrity.test.ts` (4 tests, all passing) — 20 concurrent writes yield a continuous recomputable chain with strictly increasing sequences; UPDATE and DELETE on `audit_events` are rejected; single-byte payload tampering breaks hash verification.

## M8 Findings

Appointment suite (16 integration tests): booking happy path with token 1 + audit, past-date rejection, role/department authorization, double-booking → 409 `SLOT_UNAVAILABLE`, cancellation rules, check-in creates registered encounter with both audit events atomically, second check-in → 409, audit-failure full rollback including counter reversion (no token gaps), 20-way concurrent booking unique tokens 1..20, independent per-doctor/day sequences, 20-way concurrent check-in exactly-one-success, `uq_appointments_active_slot` migration authority test, department scope, ADR-014 booking options, and final hash-chain continuity assertion. Encounter state-machine suite: exhaustive legal/illegal transition matrix, terminal-state closure, exact pgEnum values. Encounter integration: optimistic concurrency, scope (assigned physician, same-dept nurse), ADR-013 PHI boundary (chiefComplaint gated on `clinical_record:read`). No gaps.

## M9 Findings

Clinical suite (13 integration tests): physician SOAP draft creation with version + audit, active-encounter requirement, creation scope (nurse vitals-only, cross-dept denied), scoped list with exactly-one `CLINICAL_RECORD_ACCESSED` audit per request, record-encounter binding, author-only draft edit with version bump + audit, optimistic concurrency (`VERSION_CONFLICT`, signed → `INVALID_TRANSITION`), physician-only sign with `NOTE_SIGNED` audit, signed immutability (byte-equivalent rejection), 20-way parallel update exactly-one-success, PATCH×SIGN race deterministic winner, audit-failure full rollback, and PHI (no narrative/vitals in audit payloads). State-machine suite covers signed immutability and unreachable `amended`. Plus `m9-rbac-matrix.test.ts`. No gaps.

## M10 Findings

`critical-value-evaluator.ts` is pure deterministic rule matching — no AI/LLM import anywhere in the classification path (verified by code inspection). Evaluator suite (22 tests): exact/just-below/just-above boundaries for critical_low and critical_high, normal boundaries, non-critical abnormal band, multi-parameter any-critical semantics, inactive-rule exclusion, unit mismatch → `UNIT_MISMATCH` (never silently normal), non-numeric → `NON_NUMERIC`, missing bounds → `NO_BOUNDS`, one-sided bounds, case-insensitive parameter matching, deterministic lowest-id rule resolution, and byte-identical determinism across repeated calls. Integration suite (11 tests): order creation scope/audit, cancellation rules and races, lab queue department isolation, result-entry transitions and duplicate rejection, critical path (flagged + PHI-free notification + full atomic event set), audit-failure total rollback, four-eyes verification with 20-way concurrency, verified immutability, read department parity. Plus `m10-rbac-matrix.test.ts`. No gaps.

## M11 Findings

AI module implements: provider abstraction behind adapters (Gemini wire test, Ollama, OpenAI-compatible, FakeProvider), orchestrator, prompt builder, context assembler with authorization-before-projection (nurses rejected despite `ai_interaction:invoke`; non-assigned physicians rejected cross-doctor AND cross-department), strict output pipeline (PARSE/SCHEMA/BUSINESS stages: non-JSON, wrong shape, duplicate SOAP headings, fabricated citations, gap-fidelity echo, zero-citation all rejected), resilience (circuit breaker threshold/half-open probe/re-open, semaphore overflow-immediate, per-user rate limiter, timeout with hang protection and abortAll), global daily token budget enforced before the provider call, readiness fail-closed (disabled when unconfigured, no plaintext fallback for the encryption key, production requires a strong key), persistence with encrypted raw responses and metadata-only audits, and no DB transaction held across provider latency. No gaps.

## M12 Findings

Hero integration suite: grounded draft for the assigned physician with valid citations + gap fidelity; atomic draft binding (record `aiDraftId` set, interaction accepted, both audits in one transaction); double-bind → `ALREADY_RESOLVED`; stale draft past TTL → `DRAFT_EXPIRED`; cross-encounter → `ENCOUNTER_MISMATCH`; wrong record type → `TYPE_MISMATCH`; ungrounded → `INVALID_TRANSITION`; vitals records ignore `aiDraftId` (nurse domain); M9 precedence blocks non-assigned physicians before binding is reachable. Interaction-action suite: edit/reject lifecycle with `AI_DRAFT_EDITED` audits carrying category only (never free-text notes), audit-failure rollback of both transitions, double-edit → 409. Projections-gaps suite: fail-closed unknown block types, forbidden identifier fields rejected, mechanical manifest derivation, deterministic gap ordering, chart_search read-only gap rules, unknown capabilities rejected. Output pipeline includes a structural prompt-injection ceiling (injected artifacts cannot forge passable citations). No auto-signing exists anywhere. No gaps.

## M13 Findings

Discharge suite (7 integration tests): schema validation, authorization (non-physicians and unassigned physicians blocked), diagnostic resolution (pending orders block discharge), optimistic concurrency + transition verification, audit + atomic clinical record creation, post-discharge immutability (no new records or orders), audit-failure rollback. The discharge path is physician-driven; no AI involvement exists in the discharge decision path (AI is only usable for drafts under M12's separate authorization). Illegal transitions are rejected by the encounter state machine (verified in the M8 state-machine suite: `active → discharge_initiated` is the only discharge entry). **Note:** no standalone `MILESTONE_13_REPORT.md` file exists; discharge was delivered and documented as part of the encounter/clinical vertical slices. Content is verified; the missing report file is a documentation artifact only.

## Cross-Milestone Findings

Dependency integrity holds: M7 audit transactionality is consumed and tested by M6 (D2), M8 (H), M9 (L), M10 (H), M13 (7); M6 patients feed M8 encounters; M8 encounters gate M9/M10; M9 records gate M12 binding; M11 underpins M12; M12/M13 share the encounter lifecycle. A full-stack authorization probe (`middleware/rbac/__tests__/authorization.integration.test.ts`) exercises the real HTTP app for 401/403/200 across every role × permission, including break-glass and AI.

## Security Findings

No stop conditions found. Authorization is M4+M5 on every protected route (probe suite). Critical-value classification is deterministic (code-verified, no AI imports). Clinical sign/immutability enforced (M9 tests). AI context authorization precedes projection (M11/M12 tests); encrypted at rest; no plaintext fallback. Audit is append-only at the DB trigger level and hash-chained (now directly tested). PHI boundaries tested at M8 (chiefComplaint gating), M9 (audit payloads), M10 (notification bodies), M12 (identifier rejection).

## Architecture Findings

No implementation-versus-architecture conflicts identified. Module layering (routes → middleware → controller → service → repository/db) holds in all eight modules; no SQL in controllers; no cross-module joins bypassing services; no schema changes needed or made. Known documented deviations from earlier milestones (audit event naming `BREAK_GLASS_REVOKED`/`REVIEWED`) belong to M15 and are outside this audit's scope.

## Changes Made

1. NEW `apps/backend/src/modules/patient/__tests__/patient.acceptance.test.ts` — 9 tests closing the M6 verification-coverage gap (search, duplicate detection, identity documents, PHI safety).
2. NEW `apps/backend/src/modules/audit/__tests__/audit.integrity.test.ts` — 4 tests closing the M7 verification-coverage gap (concurrent hash-chain continuity + recomputation, DB-trigger append-only UPDATE/DELETE rejection, tamper-detection semantics).
3. No production code changes were required — all acceptance criteria were already implemented; the gaps were purely in direct test evidence.

## Verification Commands

```bash
pnpm install --frozen-lockfile   # PASS
pnpm run build                   # PASS (shared, backend, frontend)
pnpm run lint                    # PASS (0 errors)
npx prettier --check             # PASS on all touched files
pnpm -r run test                 # PASS — shared 51, frontend 58, backend 665 (44 files)
```

Playwright e2e: only `appointment-booking.spec.ts` is configured; M6–M13 runtime verification is via the real-Postgres vitest integration suites (no mocks of the DB/middleware stack).

## Final Verdict

```text
M6  VERIFIED
M7  VERIFIED
M8  VERIFIED
M9  VERIFIED
M10 VERIFIED
M11 VERIFIED
M12 VERIFIED
M13 VERIFIED
```

## Next Eligible Milestone

With M1–M15 all verified, the remaining Phase 4 track is M16 — Frontend Shell (and subsequent M17–M23 per the implementation plan). No M16+ work was started in this audit.
