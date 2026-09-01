# Phase 4 — Milestone 14 Task & Notification Report

## Status

VERIFIED

## Existing Implementation

M14 was already implemented in the repository (originally delivered via the Phase 1B/1C work-management reports):

* `apps/backend/src/modules/task/` — `task.service.ts`, `task.controller.ts`, `task.routes.ts`, integration + concurrency test suites.
* `apps/backend/src/modules/notification/` — `notification.service.ts`, `notification.routes.ts`, integration test suite.
* `apps/backend/src/db/schema/tasks.ts` — `tasks` and `notifications` tables (M2 schema, unchanged).
* `apps/frontend/src/app/tasks/page.tsx` + `task-service.ts` — `/tasks` UI with scope selector (me/department/hospital), acknowledge, complete, reassign, escalate.
* Critical-value diagnostics → notification sink already in place (`diagnostics.service.ts`, outbox pattern per ADR-016).

## Changes Made

None (code-level). Verification only; no defects requiring M14 fixes were found. One cosmetic formatting commit exists on an M15 file (see MILESTONE_15_REPORT.md).

## Tasks

* States: `created, assigned, in_progress, awaiting_approval, completed, cancelled` (schema enum).
* Transitions: `created|assigned → in_progress` (acknowledge, assignee-only); `in_progress → completed` (complete, sets `completedAt`); reassignment resets to `assigned`; terminal states protected (re-acknowledge/re-complete → 409 `INVALID_TRANSITION`).
* Creation is system-driven only (critical diagnostics results create tasks + `TASK_CREATED` audit); no public task-create endpoint.
* Scope: `me` (default), `department` (clinical roles only), `hospital` (hospital_admin only) — server-derived, client cannot widen.
* Concurrency: pessimistic `SELECT … FOR UPDATE` row locks + conditional `WHERE status IN (…)` guards; concurrent duplicate operations yield exactly one success, others 409 (tested).

## Assignment

* Reassignment: current assignee only; target must be active staff in the same department; non-terminal tasks only; audited; emits `task_assignment` notification in the same transaction.
* Non-owner interaction → 404/403; wrong-department target rejected; unknown user rejected.

## Notifications

* Types: `critical_lab_alert`, `task_assignment`, `break_glass_alert`, `system_alert`. Priorities: `normal, urgent, critical`. States: `dispatched → delivered → acknowledged`.
* List is always scoped to the JWT-derived `recipientId` (no client filter). Owner-only acknowledgement with row lock; duplicate ack → 409; `NOTIFICATION_ACKNOWLEDGED` audit in same tx. Foreign notification invisible/unacknowledgeable (tested).
* Notification routes intentionally have no `requirePermission` (API catalog: any authenticated role, self-scoped).

## Critical Alerts

Diagnostics result-entry transaction inserts the `critical_lab_alert` notification (recipient = ordering doctor; body = test name + test code only, no MRN/values) and the `CRITICAL_VALUE_NOTIFIED` audit event inside the same DB transaction (outbox pattern, ADR-016). Classification is deterministic; no LLM involvement.

## Authorization

M5 `requirePermission` reused: `task:read` for reads, `task:update` for acknowledge/complete/reassign/escalate. No second authorization framework. JWT-derived identity only; client role/department values ignored.

## Security

* 401 unauthenticated on all task/notification routes (tested).
* Server-derived scope; no client-controlled recipient or scope widening (tested).
* Optimistic-vs-pessimistic note: concurrency is enforced via row locks rather than a `version` column — architecturally acceptable, documented here.

## PHI Safety

Notification bodies carry test name/code and task context only; no MRN, no clinical values, no tokens. Verified by diagnostics + notification tests asserting body contents.

## Frontend

`/tasks` page verified by frontend vitest suite (8 files / 58 tests passing) plus existing component tests: loading/empty/error states, filters, acknowledge/complete/reassign/escalate flows.

## E2E

NOT CONFIGURED for M14. `tests/e2e/specs/` contains only `appointment-booking.spec.ts`; no Playwright spec exercises tasks/notifications. Verification is via the backend integration suites (real Postgres, real transactions). Listed under Issues.

## Tests

* `pnpm -r run test` → shared 51 passed, frontend 58 passed, backend 652 passed.
* Backend suites: `task.integration.test.ts`, `task.concurrency.test.ts`, `notification.integration.test.ts`, plus RBAC matrix suites.

## Build

PASS (`pnpm run build`)

## Lint

PASS (`pnpm run lint`)

## Format

PASS (prettier)

## Regression

PASS — full monorepo suite green (761 tests total).

## Architecture

PASS — routes → middleware → controller → service → repository; M5 authorization reused; no schema changes; no business logic in authorization layer.

## Scope

PASS — no M16+ functionality added.

## Issues

1. No Playwright e2e spec for task/notification flows (infra covers appointment-booking only).
2. `awaiting_approval` state exists in the enum but has no service path or test (unused state, not a defect).
3. No task `cancel` endpoint (not in the implemented lifecycle; creation is system-driven).

## Commit

See M15 report commit series (M14 required no code change; this report ships in the docs commit).

## Next Milestone

M15 — Break-Glass
