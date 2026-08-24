# MILESTONE 8 REPORT — Encounter Module, Slice 1

> **Scope:** BOOK → CHECK-IN → ENCOUNTER → CONSULTATION START only.
> M9 Clinical / M10 Lab / AI / Discharge / Break-glass intentionally NOT started.
> **ADRs honored:** ADR-011 (MRN, untouched), ADR-012 (token allocation), ADR-013 (encounter-detail PHI boundary).
> **Status:** IMPLEMENTED — all verification gates green.

---

## 1. Delivered

### Shared contracts (`packages/shared`)
| File | Content |
|---|---|
| `src/api/appointment.schemas.ts` | `createAppointmentSchema`, `getAppointmentsQuerySchema`, `cancelAppointmentSchema`, status/time primitives, `bookingOptionsResponseSchema`, response types |
| `src/api/encounter.schemas.ts` | DB-aligned `encounterStatusSchema` (`registered…closed`), `createEncounterSchema`, `getEncountersQuerySchema`, `activateEncounterSchema` (optimistic-concurrency guard), ADR-013 `encounterDetailResponseSchema` |
| `src/domain/primitives.ts` | Legacy `EncounterStatus` enum **retired**: values realigned to the pgEnum and marked `@deprecated`; zero usages existed (grep-verified) |
| `src/errors/AppError.ts` | `ConflictError` extended additively: optional `{ code }` sub-code (`SLOT_UNAVAILABLE`, `VERSION_CONFLICT`, `INVALID_TRANSITION`) surfaced in the API envelope; default `'CONFLICT_ERROR'` preserved. No existing callers broken (154 Phase-4 tests still pass) |

### Database
- **One migration:** `0003_appointment_token_counters.sql` — the ADR-012 counter table,
  PK `(doctor_id, scheduled_date)`, `last_token INTEGER NOT NULL DEFAULT 0 CHECK >= 0`.
- Re-run of `db:migrate` verified idempotent ("Migrations applied successfully", table present).
- **No other schema changes.** Existing partial unique index `idx_appointments_token`
  retained as defense-in-depth.

### Backend — Appointment module (`apps/backend/src/modules/appointment/`)
- `POST /api/v1/appointments` (`appointment:create`) — validations (patient active; doctor is
  active physician in requested department; date ≥ today; no double booking), then per ADR-012:
  atomic upsert-increment token allocation inside the transaction → insert → audit → COMMIT.
- `GET /api/v1/appointments` (`appointment:read`) — department-scoped for non-admin roles
  (query params cannot bypass); rows enriched with bounded patient block + doctor names.
- `PATCH /appointments/:id/cancel` (`appointment:cancel`) — only from `booked`;
  `FOR UPDATE` row lock; token never reused.
- `PATCH /appointments/:id/check-in` (`appointment:update`) — `SELECT … FOR UPDATE`,
  creates encounter `registered`, links it, flips appointment to `checked_in`, writes
  `APPOINTMENT_CHECKED_IN` + `ENCOUNTER_CREATED` in the SAME transaction.
- `GET /appointments/booking-options` (`appointment:create`) — read-only departments +
  physicians directory. **Flagged deviation:** required because staff-management endpoints
  (§2.10, M20) don't exist yet and receptionist lacks `staff:manage`. Exposes names/ids only;
  no new permission invented. Needs ratification at next architecture review.
- Routes mounted in `app.ts`.

### Backend — Encounter module (`apps/backend/src/modules/encounter/`)
- `encounter.state-machine.ts`: pure transition map; slice allows ONLY `registered → active`.
- `POST /encounters` (`encounter:create`) — walk-in creation; receptionist scoped to own dept.
- `GET /encounters` (`encounter:read`) — forced department scope except `hospital_admin`.
- `GET /encounters/:id` (`encounter:read`) — **ADR-013 contract enforced server-side**:
  metadata + bounded demographics only; `chiefComplaint` key omitted entirely unless caller
  holds `clinical_record:read`; clinical/diagnostic collections never embedded.
- `PATCH /encounters/:id/activate` (`encounter:update`) — assigned physician or same-department
  nurse (service-level scope check); single version-guarded UPDATE; stale → `409 VERSION_CONFLICT`,
  illegal state → `409 INVALID_TRANSITION`, wrong actor → `403`.

### Frontend (`apps/frontend`, existing design system unchanged)
- `services/appointment-service.ts`, `services/encounter-service.ts` via existing `apiClient`
  (in-memory access token; refresh cookie untouched).
- `/appointments` — schedule/queue: date+status filters, enriched table (time, token badge,
  patient→MRN UUID link, doctor, status), permission-gated Book/Check-In/Cancel actions;
  loading skeleton, empty, error+retry, unauthorized states.
- `/appointments/new` — patient debounced search (reuses M17 search API), department→physician
  cascading selects, shared-Zod client validation with field errors, `409 SLOT_UNAVAILABLE`
  rendered as warning AlertBanner, success redirect to `/appointments`. Token shown by backend
  data only — never computed client-side.
- `/encounters` — queue list with status filter; read-only for receptionist/admin.
- `/encounters/[id]` — identity block (MRN), metadata, appointment/token info, status timeline,
  Start Consultation (version-guarded, handles VERSION_CONFLICT by refreshing);
  chiefComplaint section renders only when the API returns it (`clinical_record:read` holders).

---

## 2. Verification evidence (actual runs)

| Gate | Command | Result |
|---|---|---|
| Install/build | `pnpm run build` | PASS — shared tsc, backend tsc, frontend `next build` (static prerender complete) |
| Lint | `pnpm run lint` | PASS — backend eslint clean; frontend "✔ No ESLint warnings or errors" |
| Format | `pnpm run format` | PASS (prettier applied; re-ran tests after) |
| Shared tests | `pnpm --filter shared run test` | **6/6 passed** |
| Backend tests | `pnpm -r run test` | **281/281 passed, 15 files** (Phase-4 154 + M8 127 new) |
| Frontend typecheck | `pnpm --filter frontend exec tsc --noEmit` | PASS (no output) |
| Migration | `pnpm --filter backend run db:migrate` (re-run) | PASS — idempotent |
| Live API gate | `tsx src/db/__tests__/m8_gate_verify.ts` | **13/13 PASS** |

### Test coverage added (127 tests)

| Suite | Coverage |
|---|---|
| `encounter/__tests__/encounter.state-machine.test.ts` | Exhaustive 5×5 transition matrix; legacy values rejected; terminal states closed |
| `appointment/__tests__/appointment.test.ts` (live DB) | Booking happy path + audit; past-date/not-physician/dept-mismatch rejection; double-booking `SLOT_UNAVAILABLE`; cancel rules + re-book with fresh token; check-in creates encounter + BOTH audits atomically; second check-in `INVALID_TRANSITION`; **audit-failure rollback incl. token-counter revert (no gap)**; **20 concurrent bookings → tokens exactly {1..20}, counter = 20**; cross-doctor independence (both start at 1); **20 concurrent check-ins → exactly 1 success**; department-scope denial; hash-chain continuity spot-check |
| `middleware/rbac/__tests__/m8-rbac-matrix.test.ts` | Full role × route matrix over real RS256 JWTs for all 9 M8 routes: unauth → 401; permitted roles never 403; every non-permitted role exactly 403 |
| `encounter/__tests__/encounter.test.ts` (live DB) | Creation + audit; activation (startedAt, version 2, audit); activate-active → `INVALID_TRANSITION`; stale version → `VERSION_CONFLICT`; non-assigned physician / cross-dept nurse → 403; same-dept nurse allowed; **ADR-013: chiefComplaint omitted without `clinical_record:read`, present with it; clinical/diagnostic keys absent for everyone**; detail includes linked appointment/token; list scope cannot be bypassed by query params |
| `db/__tests__/m8_gate_verify.ts` | HTTP-level gate: login → book (token 1) → 409 double-book → list → check-in (+409 re-checkin) → ADR-013 detail shape → activate v2 → stale 409 → RBAC 403 spot-checks |

---

## 3. Deviations & notes for review

1. **`GET /appointments/booking-options`** — minimal read-only support endpoint (see above).
   Recommend ratifying or replacing when §2.10 admin endpoints land in M20.
2. **`ConflictError` sub-codes** — additive change to shared kernel to honor the documented
   API envelope codes (`SLOT_UNAVAILABLE`, `VERSION_CONFLICT`, `INVALID_TRANSITION`).
3. **Seed script untouched** — Phase 4 rule against seeding credentials preserved; test/gate
   fixtures create their own idempotent staff rows (retained across runs because
   `audit_events.actor_id` FK prevents staff deletion — same policy as patient tests).
4. `PROJECT_STATUS.md` was stale (pre-Phase-4). Updated to current phase state.

## 4. Out of scope (frozen)

Discharge endpoints/state transitions, clinical records, diagnostic orders/results, tasks/
notifications worker, AI modules, break-glass, admin UI. Nothing beyond Slice 1 was started.
