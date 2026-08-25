# ADR-016: Diagnostics Module — Order Lifecycle, Critical-Alert Persistence & Lab Access

**Status:** ACCEPTED  
**Date:** 2026-08-25  
**Author:** Phase 5 — M10 Architecture Ratification  
**Supersedes:** None (ratifies the M10 architecture review; amends the M5 matrix in exactly one cell)  
**References:** `ADR-010-deterministic-lab-rules.md`, `ADR-008-audit-hash-chain.md`, `ADR-013`, `ADR-015`, `backend-architecture.md §5.3, §7`, `api-architecture.md §2.6–2.7`, `domain-model.md §2.8–2.10`, `database-design.md §3.8–3.12, §5`, `security-architecture.md §2.3, §10`, `middleware/rbac/permissions.ts`

---

## Context

M10 (Lab/Diagnostics) is fully specified at the endpoint level (`api-architecture.md §2.6–§2.7`) and schema level (`diagnostic_orders`, `diagnostic_results`, `critical_value_rules`, `notifications`). The M10 architecture review identified eight rulings required before implementation, including one intentional amendment to the frozen M5 role-permission matrix (`diagnostic_order:cancel` exists in the vocabulary but is held by zero roles), a missing collection-provenance capability, and the previously flagged dependency between critical-value detection and notification dispatch (M14 infrastructure does not exist yet).

Pre-implementation contradiction checks performed against M5, ADR-010/013/015, security-architecture, database-design, domain-model, api-architecture, and backend-architecture found **no blocking contradictions**. Two refinements adopted during review are recorded below (notification body content; frontend RBAC mirror).

## Problem

Choose safe, minimal rulings for: critical-alert persistence without M14 infrastructure; order cancellation authorization; lifecycle transitions lacking API triggers; collection provenance persistence; the lab queue read path; verifier identity separation; alert recipients; and creation-time encounter requirements.

---

## Decision

### 1. Critical-alert persistence — Option C: outbox-via-notifications

When the deterministic evaluator flags a result critical, the INSERT of the `notifications` row happens **inside the same PostgreSQL transaction** as the diagnostic-result insert.

```text
BEGIN
  → order status guard
  → INSERT diagnostic_results (unique order_id)
  → pure rule evaluation (in-memory)
  → audit CRITICAL_VALUE_DETECTED            (if critical)
  → INSERT notifications (critical_lab_alert) (if critical)
  → audit LAB_RESULT_ENTERED
COMMIT
```

- Commit ⇒ result + detection audit + notification survive together; any failure ⇒ none exist. **Zero lost alerts** by construction.
- The `notifications` table IS the outbox: `backend-architecture.md §7` explicitly sanctions writing *"directly to notifications"* in-tx pending delivery.
- **M10 contains NO dispatcher, retry worker, acknowledgement workflow, escalation engine, reminder job, or task creation.** Delivery fan-out, acknowledgement endpoints (the `acknowledged_at` column sits ready), escalation, and reminders belong to **M14**, which will consume persisted rows.
- Recipient: **ordering physician only** (Decision 7).
- **Body content (PHI-hardened):** title/body contain test name, priority context, and pointer metadata ONLY — **no patient MRN, no numeric result values** (domain-model §2.12 requires "no raw PHI"; security-architecture §10 classifies values as PHI/Critical and MRN as PII). The recipient UI resolves patient details through existing gated endpoints using `referenceType='DiagnosticResult'` / `referenceId`.

### 2. Order cancellation — single intentional M5 matrix amendment

The `diagnostic_order:cancel` permission is granted to **physician** under strict conditions:

| Condition | Enforcement |
|---|---|
| Ordering physician only | `order.orderingDoctorId === actor.staffId` |
| Own order only | implied by the above |
| Status must be `ordered` | guarded UPDATE `WHERE status='ordered'`; impossible after sample collection |
| Department scope | encounter department === caller department |

**M5 permission-matrix diff (complete):**

```diff
 Role: physician
   diagnostic_order:create    ✓ (unchanged)
   diagnostic_order:read      ✓ (unchanged)
   diagnostic_order:update    ✗ (unchanged)
+  diagnostic_order:cancel    ✓ (ADDED — ordering physician, own order, pre-collection only)
   diagnostic_result:read     ✓ (unchanged)

 All other roles (nurse, pharmacist, lab_technician, receptionist,
 hospital_admin, security_admin): diagnostic_order:cancel remains ✗ (unchanged)
```

Before: vocabulary declared the permission (`VALID_PERMISSIONS`) but `ROLE_PERMISSIONS` granted it to nobody — cancellation was impossible system-wide. After: exactly one role, one narrow condition set.

**Implementation-time touchpoints (recorded now):** `apps/backend/src/middleware/rbac/permissions.ts` (physician set), mirrored static matrix in `apps/frontend/src/utils/rbac.ts`, and the `security-architecture.md §2.3` table gains a `diagnostic_order | cancel | physician (own, pre-collection)` row. No other files.

Rationale: the ordering clinician is the accountable owner of the clinical decision; restricting to pre-collection prevents cancelling work already in motion; alternatives (admin override, lab-tech cancel, time-window auto-cancel) either widen authority or invent workflows.

### 3. Order lifecycle — derived transitions, no new endpoints

Authoritative enum unchanged: `ordered → sample_collected → in_progress → completed | cancelled`.

- **Result entry permitted from `sample_collected`** (and from `in_progress` if it were ever set).
- **Successful verification atomically transitions the order to `completed`.**
- `in_progress` remains a valid enum state with NO public trigger in M10 (reserved for future lab-workflow instrumentation, e.g., analyzer integration).

These are **derived transitions**: they emerge from the ratified endpoint semantics rather than new dedicated endpoints. No contradiction with the pgEnum or domain-model chain — the chain describes possible states; the catalog simply never defined triggers for two of them.

### 4. Collection provenance — migration 0004

Add to `diagnostic_orders`:

```sql
ALTER TABLE diagnostic_orders ADD COLUMN IF NOT EXISTS collected_at TIMESTAMPTZ;
ALTER TABLE diagnostic_orders ADD COLUMN IF NOT EXISTS collected_by UUID REFERENCES staff(id);
```

- Deterministic, idempotent (`IF NOT EXISTS`), backward-safe (both nullable, no data backfill).
- Set atomically by the collect-sample transaction (`collected_by = actor`, `collected_at = NOW()`); immutable afterwards (status guard prevents re-collection).
- Covered by tests: migration idempotency, provenance populated exactly once, second collect attempt → 409.
- Audit-only provenance was rejected: collection time/actor must be queryable/displayable in the lab workflow, not reconstructed from an append-only log.

### 5. Lab queue read path — `GET /api/v1/diagnostic-orders`

Approved as a flagged extension of §2.6:

- Permission: `diagnostic_order:read`.
- **Department scope enforced server-side from the caller's JWT** (`department_id` claim) — query parameters cannot bypass it; there is no cross-department access path.
- Offset pagination (shared contracts); filters: `status`, `priority`, `date`.
- Response exposes lab-workflow fields only: id, patientId, encounterId, testCode/testName, priority, status, collectedAt/By (post-migration), createdAt. No clinical indication beyond what `diagnostic_order:read` already permits.

### 6. Four-eyes verification

`POST …/result/verify`: `verifiedBy !== enteredBy` is enforced server-side.

- Violation → `403` (`AuthorizationError`) before any mutation.
- Rationale: the architecture assigns entry to the technician and verification to the pathologist function; within the single `lab_technician` role, distinct-user enforcement is the minimum faithful implementation of independent review. Self-verification would defeat the safety purpose of the `verified` state.

### 7. Critical-alert recipient — ordering physician only

Broader fan-out (assigned care team, department broadcast) is **M14**. M10 writes exactly one notification per critical result, recipient = `ordering_doctor_id`.

### 8. Creation requires ACTIVE encounter

`POST /encounters/:encounterId/diagnostic-orders` requires the encounter to exist and be `active`. `patientId` and department are inherited **server-side from the encounter** — client-supplied patient/department values are ignored/rejected (mirrors the M9 pattern). Orders inherit the encounter's department, which anchors every downstream scope check.

---

## Alternatives Considered

| Decision point | Alternatives rejected |
|---|---|
| Alert persistence | (A) bare in-tx writer without outbox framing — identical mechanics but undocumented contract; (B) pull M14 forward — drags dispatcher/BullMQ/Redis scope into a safety slice; (D) separate `jobs_outbox` table — duplicates the sanctioned notifications sink |
| Cancellation | Admin override — widens authority, no accountability link; lab-tech cancel — wrong clinical ownership; auto-cancel TTL — invents policy |
| Lifecycle | Dedicated `/advance` endpoints — public surface for states nothing consumes; skipping statuses via direct updates — bypasses guards |
| Provenance | Audit-log-only — not queryable, not displayable |
| Queue path | Per-encounter listing only — lab techs cannot discover their work |
| Verification | Allow self-verification — defeats independent review |
| Recipients | Multi-role fan-out — M14 scope |
| Version columns on orders/results | Unnecessary — insert-once results and guarded transitions make row locks strictly stronger; database-design §5 scopes optimistic concurrency to encounters/clinical_records |

## Security Implications

- Fail-closed service-level scope checks on every route (department parity, assigned-doctor, ordering-doctor, four-eyes).
- Evaluator is pure code with no network/system access; AI structurally excluded from classification (`ai_summary` untouched/null).
- The single matrix amendment is additive, narrowly conditioned, and mirrored in the frontend UX matrix (which is never a security control).

## RBAC Impact

Exactly the diff in Decision 2. All seven roles re-tested against all ~9 M10 routes (401/403/non-403 assertions) in the mandated RBAC matrix suite. `security-architecture.md §2.3` table updated accordingly.

## PHI Implications

- Result values: only behind `diagnostic_result:read` gates; never in URLs/query strings/audit/notification bodies.
- Notification bodies: test name + pointers only (see Decision 1) — stricter than the historical "MRN acceptable" reading; aligns with domain-model §2.12's no-raw-PHI requirement.
- Evaluation snapshots live in the gated result row.
- ADR-013 preserved: encounter detail embeds nothing; diagnostics accessed solely via gated sub-endpoints.

## Audit Implications

Catalog used by M10: `DIAGNOSTIC_ORDER_CREATED`, `DIAGNOSTIC_ORDER_CANCELLED`, `SAMPLE_COLLECTED`, `LAB_RESULT_ENTERED`, `LAB_RESULT_VERIFIED`, `CRITICAL_VALUE_DETECTED`, `CRITICAL_VALUE_NOTIFIED`. `CRITICAL_RULE_UPDATED` remains reserved (rule CRUD deferred). Payloads: ids, testCode, parameter NAMES, verdicts, versions — never numeric values or narratives. All write events join business transactions.

## Transaction Boundaries

Per-flow BEGIN/COMMIT shapes in Decision 1 and the Transactions section of the review; every multi-entity flow (enter-with-critical, verify-with-complete) is a single transaction with induced-failure rollback tests covering rows, audits, AND notification absence.

## Concurrency Model

Row locks (`FOR UPDATE` on collect) + status-guarded UPDATEs + unique(`order_id`) constraint replace version counters (justification above). Mandated tests: 20 parallel collects → 1; duplicate result insert → 409; parallel verifies → 1; enter-vs-cancel race deterministic.

## Migration Impact

Migration **0004** only (next free number after 0003): the two nullable provenance columns per Decision 4. Idempotency and clean-database application tested. No enum changes; `amended`-style reserved values unaffected.

## M14 Boundary

Dispatcher, delivery fan-out, acknowledgement endpoints, escalation, reminders, task creation (`lab_review` tasks), and the tasks/notifications API surface are M14. M10 only persists rows.

## M11/M12 Boundary

`ai_summary` stays null; no AI invocation anywhere in M10; evaluator is deterministic code per ADR-010.

## M13 Boundary

Discharge-related result workflows and any late-stage ordering policy belong to M13; verified results feed discharge summaries as gated reads only.

## Testing Implications

Full strategy per the approved review: exhaustive evaluator boundary battery (inclusive thresholds ±ε, multi-rule, unit mismatch → unevaluated, non-numeric → unevaluated, inactive rules excluded, determinism), lifecycle matrix tests, scope/concurrency/audit-rollback suites, 7×route RBAC matrix, migration idempotency, and the `m10_gate_verify.ts` live HTTP gate walking order→collect→enter(normal+critical)→verify with notification-row assertions.

## Rejected Alternatives

Consolidated in the table above; notably: AI-assisted classification (PROHIBITED by product spec), stored-procedure evaluation (engineering rules), external rules engine (ADR-010), self-verification, audit-only provenance, global unscoped queue.

## Consequences

- M10 implementation is fully unblocked with zero ambiguity.
- The M5 matrix changes for the first time — deliberately, once, in one cell, with permanent documentation.
- Critical alerts gain a no-loss persistence guarantee ahead of any delivery infrastructure.
- `collected_*` columns land via one small additive migration.

## Explicit Acceptance Criteria

1. Order created only by assigned physician on active encounter; patient/dept inherited server-side; audited.
2. Cancellation only by ordering physician, own order, `status='ordered'`; post-collection cancel → 409; audited.
3. Collection exactly once (20 parallel collects → 1 success); `collected_at/by` populated atomically; audited.
4. Result entry only post-collection; duplicate → 409 via unique constraint; evaluator output byte-deterministic; boundary suite green at every threshold.
5. Critical result ⇒ result + `CRITICAL_VALUE_DETECTED` + notification row + `LAB_RESULT_ENTERED` all-or-nothing; notification body contains no MRN/values; recipient = ordering doctor.
6. Verification only by lab_technician ≠ enterer, from `preliminary|critical_flagged`; order → `completed` atomically; verified results immutable.
7. RBAC matrix exact across 7 roles × all routes incl. the amended cancel grant; unauthorized cancels → 403 even for physicians who did not place the order.
8. Lab queue returns only same-department orders regardless of query parameters.
9. Induced audit/notification failure rolls back the entire entry transaction.
10. Gates: install/build/lint/format PASS; suites green; migration idempotent; live gate PASS.
