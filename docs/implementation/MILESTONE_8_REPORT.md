# MILESTONE 8 REPORT — Encounter Module, Slice 1

> **Scope:** BOOK → CHECK-IN → ENCOUNTER → CONSULTATION START only.
> M9 Clinical / M10 Lab / AI / Discharge / Break-glass intentionally NOT started.
> **ADRs honored:** ADR-011 (MRN, untouched), ADR-012 (token allocation),
> ADR-013 (encounter-detail PHI boundary), ADR-014 (booking-options support endpoint).
>
> **Status: VERIFIED + FROZEN** (final freeze gate executed on commit following `5fcaba1`)

---

## Status

| Item | Result |
|---|---|
| Booking | ✅ VERIFIED |
| Token Allocation | ✅ VERIFIED (ADR-012) |
| Cancellation | ✅ VERIFIED |
| Check-in | ✅ VERIFIED |
| Encounter | ✅ VERIFIED |
| State Machine | ✅ VERIFIED (`registered → active` only) |
| Activation | ✅ VERIFIED (scope + optimistic concurrency) |
| Optimistic Concurrency | ✅ VERIFIED (stale → 409 VERSION_CONFLICT) |
| RBAC | ✅ VERIFIED (7 roles × 9 routes, real RS256 JWTs; matrix unchanged) |
| Department Scope | ✅ VERIFIED (server-side; query-param bypass blocked) |
| PHI Boundary | ✅ VERIFIED server-side per ADR-013 |
| Audit | ✅ VERIFIED (all 5 events in-tx; rollback proven; chain continuity) |
| Frontend | ✅ VERIFIED (4 screens, existing Phase-4 design system) |
| Concurrency | ✅ VERIFIED (live DB: 20 bookings / 20 check-ins) |
| Tests | ✅ shared 6/6 · backend **282/282** (15 files) |
| Build | ✅ `pnpm run build` + frontend build PASS |
| Lint | ✅ backend eslint clean; frontend "No ESLint warnings or errors" |
| Format | ✅ prettier applied; tests re-run green afterwards |
| Migration | ✅ `0003_appointment_token_counters.sql`; idempotent re-run verified |
| Booking-options decision | ✅ Ratified as ADR-014 (see below) |

---

## 1. Delivered

### Shared contracts (`packages/shared`)
| File | Content |
|---|---|
| `src/api/appointment.schemas.ts` | `createAppointmentSchema`, `getAppointmentsQuerySchema`, `cancelAppointmentSchema`, status/time primitives, ADR-014 `bookingOptionsResponseSchema` |
| `src/api/encounter.schemas.ts` | DB-aligned `encounterStatusSchema`, `createEncounterSchema`, `getEncountersQuerySchema`, `activateEncounterSchema`, ADR-013 detail contract |
| `src/domain/primitives.ts` | Legacy `EncounterStatus` retired (values realigned to pgEnum, `@deprecated`; zero prior usages) |
| `src/errors/AppError.ts` | Additive `ConflictError` sub-codes (`SLOT_UNAVAILABLE`, `VERSION_CONFLICT`, `INVALID_TRANSITION`); default `'CONFLICT_ERROR'` preserved; all Phase-4 tests unaffected |

### Database
- One migration: `0003_appointment_token_counters.sql` — ADR-012 counter table,
  PK `(doctor_id, scheduled_date)`. Re-run of `db:migrate` verified idempotent.
- No other schema changes; `idx_appointments_token` retained as defense-in-depth.

### Backend — Appointment module
- `POST /api/v1/appointments` (`appointment:create`) — full validation set;
  ADR-012 atomic upsert-increment token allocation inside the transaction.
- `GET /api/v1/appointments` (`appointment:read`) — department-scoped for non-admins;
  enriched rows (bounded patient block + doctor names).
- `PATCH /appointments/:id/cancel` (`appointment:cancel`) — only from `booked`;
  `FOR UPDATE`; committed tokens never reused.
- `PATCH /appointments/:id/check-in` (`appointment:update`) — row lock; encounter
  creation + link + status flip + BOTH audit events in ONE transaction.
- `GET /appointments/booking-options` (`appointment:create`) — **ratified by ADR-014**:
  read-only, department-scoped (non-admin callers see only their own department and
  its active physicians), fields limited to department id/name/code and physician
  id/name/departmentId. No emails, employee IDs, or account fields.

### Backend — Encounter module
- Pure state machine; slice allows ONLY `registered → active`.
- `POST /encounters` (`encounter:create`); receptionist scoped to own department.
- `GET /encounters` (`encounter:read`) — forced dept scope except `hospital_admin`.
- `GET /encounters/:id` (`encounter:read`) — ADR-013 enforced server-side:
  metadata + bounded demographics; `chiefComplaint` key omitted unless caller holds
  `clinical_record:read`; clinical/diagnostic collections never embedded.
- `PATCH /encounters/:id/activate` (`encounter:update`) — assigned physician or
  same-department nurse; single version-guarded UPDATE; stale → `409 VERSION_CONFLICT`,
  illegal state → `409 INVALID_TRANSITION`, wrong actor → `403`.

### Frontend (`apps/frontend`, existing design system unchanged)
- `services/appointment-service.ts`, `services/encounter-service.ts` via existing
  `apiClient` (in-memory access token; refresh cookie untouched).
- `/appointments` — schedule/queue: date+status filters, token badges, patient→MRN
  UUID links, permission-gated Book/Check-In/Cancel; loading skeleton, empty,
  error+retry, unauthorized states.
- `/appointments/new` — debounced patient search, department→physician cascading
  selects fed by ADR-014 endpoint, shared-Zod client validation with field errors,
  `409 SLOT_UNAVAILABLE` warning banner, success redirect to `/appointments`;
  token displayed from backend response only — never computed client-side.
- `/encounters` — queue list with status filter; read-only for receptionist/admin.
- `/encounters/[id]` — identity block, metadata, appointment/token info, status
  timeline, Start Consultation with VERSION_CONFLICT recovery (view refresh);
  chiefComplaint renders only when the API returns it. No shell redesign.

---

## 2. Verification evidence (actual runs at freeze gate)

| Gate | Command | Result |
|---|---|---|
| Install | `pnpm install --frozen-lockfile` | Done in 2.3s |
| Build | `pnpm run build` | PASS — shared tsc, backend tsc, frontend `next build` |
| Lint | `pnpm run lint` | PASS — both apps clean |
| Format | `pnpm run format` | PASS (tests re-run afterwards) |
| Shared tests | `pnpm -r run test` | **6/6 passed** |
| Backend tests | `pnpm -r run test` | **282/282 passed, 15 files** |
| Frontend typecheck | `pnpm --filter frontend exec tsc --noEmit` | PASS (no output) |
| Frontend build | `pnpm --filter frontend run build` | PASS (static prerender complete) |
| Migration idempotency | `db:migrate` re-run | "Migrations applied successfully." |
| Live API gate | `tsx src/db/__tests__/m8_gate_verify.ts` | **13/13 PASS** |

### Acceptance mapping

| Requirement | Evidence |
|---|---|
| Appointment create/read/cancel/check-in | Unit suite A–G + API gate checks |
| 20 concurrent bookings same doctor/day → tokens exactly {1..20}, no duplicates, counter = max | appointment.test I (live DB, deterministic distinct times) |
| Different doctors independent, both start at 1 | appointment.test J |
| Rollback does not incorrectly consume/reuse committed tokens | appointment.test H (audit-failure rollback ⇒ counter reverted; next booking gets counter+1; committed numbers never reused after cancel) |
| Check-in row lock; exactly one success of 20 concurrent; repeat → 409; atomicity | appointment.test F, G, K |
| Encounter create/list/detail/activate; registered→active only; stale 409; wrong scope 403 | encounter.test A–F |
| RBAC: all 7 canonical roles × all M8 routes; unauth 401; unauthorized 403; matrix untouched | m8-rbac-matrix.test.ts (real JWT pipeline) |
| PHI: ADR-013 server-side; no clinicalRecords/diagnosticOrders leakage to `encounter:read`-only roles | encounter.test G + API gate detail check |
| Audit: 5 events via `logEvent(..., correlationId, tx)`; induced audit failure rolls back business tx + audit; hash-chain continuity | appointment.test F/H/M, encounter.test A/B, gate logs |

## 3. Booking-options decision

Ratified as **ADR-014** (`docs/architecture/adrs/ADR-014-booking-options-support-endpoint.md`)
and documented in `api-architecture.md §2.3`. Read-only; `appointment:create` gated;
department-scoped server-side (tightened at freeze gate); name-only fields; temporary
until §2.10 admin endpoints land at M20, after which it should be retired or reduced
to a thin alias.

## 4. Remaining Issues

1. Browser-level Playwright E2E deferred to M21 (no harness exists yet); the live HTTP
   gate walks login→book→check-in→activate end-to-end against the real app+DB.
2. Test staff fixtures persist by design (`audit_events.actor_id` FK is `ON DELETE no action`);
   fixtures are idempotently reused across runs.
3. Retire `GET /appointments/booking-options` when M20 admin endpoints ship (tracked here).

## 5. Out of scope (frozen)

Discharge transitions/endpoints, clinical records, diagnostic orders/results, tasks/
notifications worker, AI modules, break-glass, admin UI. Nothing beyond Slice 1 started.
