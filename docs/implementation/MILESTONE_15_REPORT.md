# Phase 4 — Milestone 15 Break-Glass Report

## Status

VERIFIED

## Existing Implementation

Break-glass was already implemented and previously verified/frozen (PHASE_2_BREAK_GLASS_REPORT.md):

* `apps/backend/src/modules/break-glass/` — service, routes, controller, 29-test verification gate.
* `apps/backend/src/middleware/rbac/resource-auth.ts` — `authorizeBreakGlassResourceAccess` read-only fallback used by Encounter/Clinical/Diagnostics services.
* Frontend: `BreakGlassModal.tsx`, `BreakGlassBanner.tsx`, `break-glass-service.ts`, `/admin/security` console; 403 interception at page level on patients/encounters routes.
* Schema `break_glass_sessions` (M2/0007 migration, unchanged).

## Changes Made

1. **Security Admin notification on activation** (was missing — required by `security-architecture.md` §2.5 and the M15 acceptance "Security Admin notified"). `activateSession` now inserts a `break_glass_alert` notification (priority `urgent`) for each active `security_admin` of the activating user's department, inside the same transaction as the session + audit event (outbox semantics — no lost alert). Body carries reason + session pointer only; no PHI, no justification (justification remains review-API-only).
2. **Expiry policy moved to configuration.** The hardcoded `BREAK_GLASS_MAX_DURATION_HOURS = 4` is now `BREAK_GLASS_MAX_DURATION_HOURS` in the typed zod config (default 4), per security-architecture "policy decision, NOT hardcoded". Server-set expiry semantics unchanged; client cannot control it.
3. Two new tests (12a, 12b) in `break-glass.verification.test.ts` covering the notification persistence, recipient scoping, priority, and PHI/justification-free body.

## Activation

POST `/api/v1/break-glass/sessions` (`break_glass:activate` + hard physician/nurse check). Zod validation, explicit reason enum, justification 20–2000 chars, patient existence + encounter-ownership checks, advisory lock `pg_advisory_xact_lock(hashtext(actorId||patientId))` against duplicate activation, single transaction: session insert + `BREAK_GLASS_ACTIVATED` audit + security-admin notifications.

## Eligibility

Only physician and nurse can activate (M5 permission `break_glass:activate` + explicit role check; tested for nurse allow, receptionist/security_admin deny). Reviewer/revoke/list require `break_glass:review` (security_admin only per M5 mapping) — structural reviewer separation: security_admin cannot activate, physician/nurse cannot review.

## Justification

Min 20 / max 2000 chars enforced in route zod and service; missing/short rejected (tested). Persisted on the session; stripped from activation/list/audit responses; readable only via `reviewSession`.

## Reason

Enum: `emergency_care | patient_safety | continuity_of_care`. Invalid/missing rejected by zod.

## Scope

`grantedScope = { patientId, encounterId?, operation: 'read' }`. Access fallback (`authorizeBreakGlassResourceAccess`) applies only to the session's patient (and encounter when pinned); different patient/department → DENY (tested).

## Expiration

Server-computed `expiresAt = activation + config.BREAK_GLASS_MAX_DURATION_HOURS` (default 4h). Expired session → access DENY (SQL `expires_at > now()` check); expired session cannot be revoked (409 `ALREADY_EXPIRED`); client-supplied expiry/duration ignored (not accepted by schema).

## Revocation

POST `/sessions/:id/revoke` (`break_glass:review`), `FOR UPDATE` row lock, already-revoked → 409, immediate access denial (tested), `BREAK_GLASS_REVOKED` audit in same tx.

## Review

POST `/sessions/:id/review` (`break_glass:review`), one-time (`reviewed_at` set → 409), records reviewer identity + timestamp, exposes justification to reviewer, emits `BREAK_GLASS_REVIEWED` audit; does not rewrite historical audit events (append-only ledger with hash chain).

## Audit

Tamper-evident `audit_events` (sequence + previousHash + recordHash) via existing `auditService.logEvent`, transactional with each mutation. Event types: `BREAK_GLASS_ACTIVATED`, `BREAK_GLASS_REVOKED`, `BREAK_GLASS_REVIEWED`; record-access events link `break_glass_session_id`. Justification deliberately excluded from audit `actionDetail` (privacy by design).

## Notification

NEW (see Changes Made): `break_glass_alert` to department security_admins, priority `urgent`, same-transaction persistence; verified by tests 12a/12b. Review signalling is the Security Admin console + review endpoint.

## Read/Write Restrictions

Read-only: `operation: 'read'` in granted scope; write attempts under break-glass fallback → DENY (tested §6). Sign/delete/privilege-escalation paths do not exist under break-glass.

## Concurrency

Advisory lock per (actor, patient): concurrent activations yield exactly one session (tested §4). Revoke/review use `FOR UPDATE` row locks with state guards; no double-revoke, no access after revoke, no expiry extension race.

## Frontend

`BreakGlassModal` (reason + justification, min-length, submit/failure states), `BreakGlassBanner` (active-session state), `/admin/security` console (list/review/revoke). Covered by frontend vitest suite; no frontend authentication or separate emergency mechanism exists.

## E2E

NOT CONFIGURED for M15 (Playwright spec exists only for appointment-booking). M15 verification is the 30-test backend verification gate against real Postgres. Listed under Issues.

## Security

Adversarial coverage in `break-glass.verification.test.ts`: non-eligible roles denied, duplicate activation blocked, out-of-scope patient denied, write under break-glass denied, security_admin direct clinical access denied, physician review/revoke denied, expired-session access denied, justification hidden from non-reviewer surfaces, no PHI in audit/notification bodies. 401/403 semantics via M4 middleware + M5 `requirePermission`.

## PHI Safety

Notification bodies, audit `actionDetail`, and standard API responses contain no PHI and no justification text. Patient MRN never appears in break-glass API payloads (session responses carry IDs + reason + scope only).

## Tests

`npx vitest run src/modules/break-glass` → 1 file, 30 passed (was 29; +2 new, one consolidated). Full monorepo: shared 51, frontend 58, backend 652 — all passed.

## Build

PASS (`pnpm run build`)

## Lint

PASS (`pnpm run lint`)

## Format

PASS (prettier; also normalized `resource-auth.ts` style in the M5 commit series)

## Regression

PASS — full suite green after changes (backend 650 → 652).

## Architecture

PASS — M4/M5 ownership untouched; break-glass reuses M5 permissions and the shared audit ledger; no schema changes; no new tables; config follows the existing typed configuration system.

## Scope

PASS — no M16+ functionality added; only the notification gap and config policy were touched.

## Issues

1. No Playwright e2e spec for the break-glass flow (infra covers appointment-booking only).
2. Audit event naming: code uses `BREAK_GLASS_REVOKED`/`BREAK_GLASS_REVIEWED` where security-architecture §2.5 names `BREAK_GLASS_DEACTIVATED`; the implemented vocabulary is consistent across code/tests/frontend and left unchanged to avoid churn — flagged as a documented deviation.
3. `reviewNotes` column exists but is unused by the review endpoint (not required by the implemented review contract).

## Commit

feat(m15): security-admin notification + configurable expiry (SHA recorded in git log)

## Next Milestone

M16 — Frontend Shell
