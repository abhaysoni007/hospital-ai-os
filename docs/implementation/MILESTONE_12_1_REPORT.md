# MILESTONE 12.1 — INTEGRITY RESTORATION REPORT

**Status:** COMPLETE
**Date:** 2026-08-26
**Baseline:** M12 freeze (`dc60037` + cleanup `e4ed783`, status sync `0fe8aed`)
**Mode:** Correctness / security / concurrency / audit remediation. NO new features.

---

## 1. Provenance

A full READ-ONLY forensic audit of the repository was performed after the M12
freeze. It concluded that the architecture is sound and M8–M12 need no
redesign, but identified **five P0 defects** plus secondary consistency gaps.
Per audit discipline, this report documents each finding and its correction;
historical milestone reports are NOT rewritten.

---

## 2. P0-1 — Frontend double-encoding (CRITICAL)

**Audit finding.** `apps/frontend/src/services/api-client.ts` serialized every
request body (`JSON.stringify(body)`), while 13 mutation call sites across
`patient-service`, `clinical-service`, `diagnostics-service`,
`appointment-service`, `encounter-service`, `ai-service` ALSO pre-stringified.
Every frontend mutation therefore transmitted a JSON *string*; Express'
strict JSON parser / Zod contracts rejected it with 400. All UI write flows
were inoperative, invalidating prior "working frontend" verification claims.

**Correction.**
- Single-source-of-truth serialization: services pass structured objects;
  `apiClient` performs the only serialization.
- Programming-error guard: `apiClient` now THROWS on a pre-stringified body,
  so this bug class cannot silently return.
- GET behavior, empty-body requests, login flow, `credentials: 'include'`,
  Content-Type handling and error mapping unchanged (no FormData exists).

**Regression tests.** `apps/frontend/src/services/__tests__/encoding.test.ts`
(13 tests) capture the RAW body handed to fetch for every mutating service call
(patient registration, booking, cancel, clinical create/update/sign, order,
result entry, verify, AI note-draft, AI action, encounter activation) and
assert exactly one serialization occurred (`JSON.parse(body)` is an object,
never a string). Live proof: `m12_1_integrity_gate_verify.ts` replays these
exact body shapes over real HTTP against the real Express app.

---

## 3. P0-2 — Gemini adapter canonicalization bypass (HIGH)

**Audit finding.** ADR-018 §11 / PROMPT_ARCHITECTURE.md §4 require delimiter
canonicalization of untrusted clinical context before it reaches a provider.
The versioned template did canonicalize — but
`gemini.adapter.ts::buildUserPrompt` PREPENDED its own raw
`JSON.stringify(context)` ahead of the task prompt. On the real Gemini path
the wire therefore carried RAW + CANONICALIZED duplicates; forged structural
tokens inside clinical text survived verbatim in the first copy, and context
token cost was doubled. Existing injection batteries tested the template
function only, so the gap was invisible to gates.

**Correction.**
- The template-rendered `userPrompt` is the SINGLE authoritative rendering;
  adapters must never re-render `params.context` (ADR-005 interface field kept
  verbatim for transport compatibility, never serialized into a prompt).
- Pure seam `buildGeminiRequest()` exported from inside `adapters/` (SDK
  boundary intact) builds the exact SDK request deterministically for tests.

**Adversarial tests.**
`src/modules/ai/adapters/__tests__/gemini-adapter.wire.test.ts` (4 tests):
wire content === template output; zero forged `[PATIENT_INPUT]`/`[SYSTEM_*]`
tokens; exactly ONE `[CLINICAL_CONTEXT_START]/[END]` pair even when the payload
forges copies of both; raw uncanonicalized narrative absent while its
neutralized form is preserved; no bulk JSON re-render of context present.
Gate coverage: M11 gate gained three P0-2 wire checks; the new M12.1 gate adds
three more (see §9).

---

## 4. P0-3 — Appointment double-booking race (HIGH)

**Audit finding.** `bookAppointment` used SELECT-then-INSERT with no uniqueness
guarantee on `(doctor_id, scheduled_date, scheduled_time)`. Two concurrent
requests could both pass the pre-check and commit distinct appointments for
the same physician slot with different token numbers.

**Correction.**
- Migration **`0005_appointment_slot_uniqueness.sql`** (journal-tracked,
  idempotent `CREATE UNIQUE INDEX IF NOT EXISTS`):
  `uq_appointments_active_slot ON appointments (doctor_id, scheduled_date,
  scheduled_time) WHERE status <> 'cancelled'`.
- Semantics match the lifecycle: cancelled appointments release the slot
  (committed token numbers still never reused per ADR-012); booked /
  checked_in / completed occupy it. The database is the final authority.
- Service maps unique violation (pg code `23505`, checked on both `err.code`
  and drizzle-wrapped `err.cause.code`) to the existing public error
  `409 ConflictError('SLOT_UNAVAILABLE')`. No postgres internals leak.

**Proofs.** `appointment.test.ts`: K2 asserts the index exists; K3 fires 20
concurrent SAME-SLOT service bookings → exactly 1 success, 19 ×
SLOT_UNAVAILABLE, exactly one occupying row, and loser token allocations fully
rolled back (counter == 1). Sequential duplicate + cancelled-slot rebooking +
cross-doctor same-time are covered by existing tests D/J (re-verified).
Live proof: M12.1 gate replays 20 concurrent same-slot bookings over REAL HTTP
with identical outcome distribution.

---

## 5. P0-4 — AI interaction lifecycle audit gap (MEDIUM)

**Audit finding.** `PATCH /ai/interactions/:id/action` mutated `userAction`
from `pending → edited` with NO audit event (no EDITED event existed in the
ADR-020 catalog), and audited `pending → rejected` NON-atomically (transition
and audit were separate transactions — an audit failure left an unaudited
mutation). Additionally, the "not pending" guard used `ValidationError`, whose
hardcoded code masked the intended `INVALID_TRANSITION` discriminator on the
wire.

**Correction.**
- `AI_DRAFT_EDITED` added to the authoritative catalog (`ai.audit.ts`);
  ADR-020 §1 table updated (five events).
- Both PATCH transitions now run guarded-transition + metadata-only audit
  event inside ONE short transaction; audit failure rolls the state change
  back (ADR-008 fail-safe rule).
- Guard errors are now `ConflictError(409, INVALID_TRANSITION)`, consistent
  with `bindAiDraftInTx` semantics.

**Tests.** `interaction-action.audit.test.ts` (5 tests): edit → event exists,
actor-attributed, correlation-bound, payload contains no narrative/raw output;
reject → category-only in ledger (free-text note provably absent from audit
payload, stored only in the access-controlled column); forced audit failure
rolls back BOTH edit and reject transitions; double-edit → 409
INVALID_TRANSITION. Live proof: M12.1 gate exercises the HTTP edit/reject paths
including PHI-free payload assertions.

---

## 6. P0-5 — Daily token budget scope mismatch (HIGH documentation / implementation)

**Audit finding.** The orchestrator comment, PROJECT_STATUS.md and
MILESTONE_11_REPORT.md all described the daily budget as GLOBAL ("DB-backed,
correct across replicas"), but `sumTokensSince()` filtered by
`initiated_by = ?`, making the cap PER-USER. ADR-017 itself was internally
contradictory: §7's prose said "per-user" with per-user SQL while §7's title,
the §8 control-scope table ("Daily token budget | GLOBAL (DB SUM) | Exact
across replicas") and the summary documents all ratified GLOBAL.

**Interpretation (required before changing anything).** The accepted
architecture is GLOBAL. Decision 8 is the multi-replica-honesty contract and
classifies the budget GLOBAL; the per-user limiter (Decision 6) already bounds
individual abuse — the budget exists to bound TOTAL hospital spend. One stale
sentence and its SQL sketch caused the implementation defect.

**Correction.**
- `sumTokensSince(initiatedBy, since)` replaced by
  `sumTokensForUtcDay(sinceUtc)`: UTC day boundary, committed rows only, NO
  user filter. Orchestrator comment now states the true scope.
- Error semantics preserved (`429 RateLimitError` BEFORE provider invocation).
- ADR-017 §7 rewritten with an explicit M12.1 correction block; Consequences
  line updated ("capped hospital-wide per day").

**Tests.** New `budget-scope.global.test.ts` (2 tests): consumption by user A
blocks user B pre-provider (`providerB.calls === 0`), and the SUM demonstrably
aggregates across distinct `initiated_by` values. The existing orchestrator
budget test was made global-correct and flake-hardened against parallel
workers. Gate coverage: M11 gate budget check now proves CROSS-USER blocking
against live DB state; M12.1 gate repeats physician-A-blocks-nurse-B live.

---

## 7. Secondary corrections (directly-necessary consistency only)

1. **Pharmacist dead grant** — the frozen M5 matrix grants pharmacists
   `diagnostic_result:read`, but `DiagnosticsService.assertReadScope` excluded
   them, making the grant unreachable. Pharmacists added to diagnostic read
   scope (department parity retained). Code now matches the frozen matrix.
2. **Authz probe production mount** — `/api/v1/_test/authz-probe/*` is now
   mounted ONLY when `NODE_ENV !== 'production'` (tests/gates unaffected).
3. **Audit endpoint path** — api-architecture.md corrected: implemented route
   is `GET /api/v1/audit` (catalog previously said `/admin/audit-events`).
4. **Implementation-status annotations** — api-architecture.md now marks
   chart-search (route not implemented; prompt/contracts ship),
   tasks/notifications §2.9 (planned, not implemented),
   admin staff/departments (planned M20), break-glass §2.11 (planned M15),
   discharge endpoints §2.4 (planned M13) as NOT IMPLEMENTED, ending
   doc-vs-route ambiguity found by the audit.
5. **Nurse `ai_interaction:invoke`** — intentionally NOT changed: ADR-018 §3
   reserves nurse scope for read-only capabilities; the capability arrives
   with chart-search. Documented here as deferred, not fixed.

---

## 8. Test results (exact counts)

| Suite | Result |
|---|---|
| shared (vitest) | **51/51 passed** (6 files) |
| backend (vitest) | **555/555 passed** (32 files) — was 542; +13 new |
| frontend (vitest) | **26/26 passed** (2 files) — was 13; +13 new |

New backend tests: appointment K2/K3 (2), interaction-action.audit (5),
budget-scope.global (2), gemini-adapter.wire (4). New frontend tests:
encoding regression (13).

Zero skipped/todo/only tests. No test counts reduced anywhere.

---

## 9. Live gates

| Gate | Result |
|---|---|
| m6/m17 `gate_api_verify.ts` (live server :3001) | **27/27 PASS** |
| m8 `m8_gate_verify.ts` | **13/13 PASS** |
| m9 `m9_gate_verify.ts` | **30/30 PASS** |
| m10 `m10_gate_verify.ts` | **23/23 PASS** |
| m11 `m11_gate_verify.ts` (extended) | **38/38 PASS** (was 35; +3 P0-2 wire checks; budget check upgraded to cross-user GLOBAL) |
| m12 `m12_gate_verify.ts` | **27/27 PASS** |
| **m12_1 `m12_1_integrity_gate_verify.ts` (new)** | **27/27 PASS** |

M12.1 gate coverage: real-HTTP frontend-shaped mutations end-to-end (P0-1),
adapter wire format incl. forged-token batteries (P0-2), 20-way concurrent
same-slot HTTP bookings + cancelled-slot rebooking (P0-3), deterministic
edit/reject audit assertions with PHI-free payload proofs (P0-4), and live
cross-user global-budget enforcement (P0-5).

Migration idempotency: `db:migrate` re-run after 0005 — clean no-op success.

---

## 10. Build / Lint / Format

- `pnpm -r run build` — PASS (backend tsc, shared tsc, Next.js production build)
- `pnpm -r run lint` — PASS (0 warnings/errors)
- `pnpm exec prettier --check` — PASS on all touched sources (SQL migration
  file has no prettier parser by design)

---

## 11. Migration status

- `0005_appointment_slot_uniqueness` applied to the dev database; journal
  entry idx 5 added; re-run verified idempotent (`IF NOT EXISTS`).
- No schema/migration was altered retroactively; 0000–0004 untouched.

---

## 12. Documentation updates

- `PROJECT_STATUS.md` — M12.1 completion entry + phase header.
- This report (`docs/implementation/MILESTONE_12_1_REPORT.md`).
- `docs/architecture/adrs/ADR-017-runtime-topology.md` — §7 GLOBAL budget
  correction block + Consequences wording (P0-5).
- `docs/architecture/adrs/ADR-018-context-authorization-and-phi-minimization.md`
  — §11 single-rendering-path correction block (P0-2).
- `docs/architecture/adrs/ADR-020-ai-audit-provenance-retention-encryption.md`
  — §1 catalog gains `AI_DRAFT_EDITED`; atomicity notes for both PATCH
  transitions (P0-4).
- `docs/architecture/api-architecture.md` — implementation-status annotations
  and audit-path correction (secondary items 3–4).

Historical reports deliberately NOT edited: they document what was believed
true at their gates; this report records what the audit found afterwards.

---

## 13. Security / PHI regression review

- PHI posture unchanged or improved: two additional unaudited-mutation paths
  closed; AI audit payloads remain metadata-only (builder-shape enforced);
  edit/reject free-text stays out of the ledger; provider prompts carry only
  the canonicalized template rendering (raw duplicate eliminated).
- Authorization matrix untouched except closing a dead-grant inconsistency in
  favor of the frozen matrix (pharmacist diagnostic read, department parity).
- No new routes; probe surface removed from production mounts; no secrets
  touched; `.env`/keys remain untracked.

---

## 14. Remaining deferred findings (NOT fixed in M12.1, by design)

From the Full System Audit, explicitly deferred:

| ID | Finding | Disposition |
|---|---|---|
| D-2 | Duplicate-registration race (phone SELECT-then-INSERT) | Deferred — low data-quality impact |
| D-3 | Encounter-status TOCTOU outside tx in createClinicalRecord/createOrder | Deferred — low probability/harm |
| S-1 | Refresh-token reuse detection / family revocation | Deferred — hardening backlog |
| S-2 | Login-specific rate limit / lockout | Deferred — hardening backlog |
| S-5 | `patient:update` allows setting `status` (archive) | Deferred — needs product ruling |
| S-7 | Encounter controller UUID param validation inconsistency | Deferred — cosmetic |
| AI-2 | Audit TRUNCATE trigger gap | Deferred — requires dba-role threat model |
| AI-S3 | Citation excerpt fidelity not source-verified | Deferred — ADR-018 §7 documents human-review control |
| AI-S4 | 90-day retention purge job absent | Deferred until async infra decision |
| F-1..F-3 | Frontend 401 interceptor, stale-response races, swallowed AI bind/reject errors | Deferred — UX hardening batch |
| F-4 | Mock dashboard/notification/global-search demo data | Deferred — belongs to product UI transformation phase |
| A-5/A-6 | "Temporary" pharmacist clinical-read scope; nurse invoke dead capability | Deferred — capability decisions tied to Chart Brief |
| Perf items | Audit-lock throughput, N+1 result fetches, PEM caching, pool tuning, load testing | Deferred — performance phase |

---

## 15. Verdict

All five P0 findings are FIXED with adversarial regression coverage at unit,
integration and live-gate levels. M8–M12 integrity is re-established: every
frozen-milestone gate passes against current code with equal-or-stronger
assertions than its original run, and backend/frontend/shared suites grew from
606 to 632 tests with zero losses. M12.1 introduces no new features and no
architectural change. The repository is READY for the next milestone decision.
