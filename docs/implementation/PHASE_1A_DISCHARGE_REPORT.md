# Phase 1A Discharge Implementation Report

## Overview
Phase 1A involved implementing the discharge functionality for the M13 encounter module. This phase specifically addresses the atomic creation of a discharge summary, strict immutability post-discharge, and RBAC-governed UI workflows, ensuring all clinical constraints from M8, M9, and M10 are met.

## Implementation Details

### 1. Backend Service (`apps/backend/src/modules/encounter/encounter.service.ts`)
- Added `dischargeEncounter` method using a Drizzle atomic transaction.
- **Validations Enforced:**
  - `expectedVersion` matches current version (Optimistic Concurrency).
  - Actor role is exactly `physician` and the actor is the `assigned physician`.
  - Encounter state is `active` (Frozen Gate M12).
  - **Diagnostic Resolution:** Blocks if any orders are in `ordered` or `collecting` state.
- **Atomic Operations:**
  - Updated encounter status to `discharged` and incremented `version`.
  - Inserted a signed `discharge_summary` clinical record directly without a `draft` phase.
  - Emitted `CLINICAL_RECORD_CREATED` and `ENCOUNTER_DISCHARGED` audit events bound to the exact correlation ID.

### 2. API Contract & Controllers (`apps/backend/src/modules/encounter/encounter.controller.ts`)
- Bound `POST /encounters/:id/discharge` with the payload schema `{ expectedVersion, summary }`.
- Route protected by `authMiddleware` and `requirePermission('encounter:discharge')`.

### 3. Frontend UI Integration (`apps/frontend/src/app/encounters/[id]/page.tsx`)
- Added `Discharge patient` button in the `PageHeader`, conditionally rendered for the assigned physician on an `active` encounter with the `encounter:discharge` permission.
- Created an irreversible, explicit confirmation modal containing a `dischargeSummary` required textarea.
- Graceful error mapping for specific error codes:
  - `UNRESOLVED_DIAGNOSTICS`
  - `VERSION_CONFLICT` (Optimistic concurrency fallback)
  - `INVALID_TRANSITION` (State race conditions)
- Enforced permanent locked UI state once discharged.

### 4. Integration Tests (`apps/backend/src/modules/encounter/__tests__/discharge.integration.test.ts`)
- Created full test harness mapping to all frozen gate constraints:
  1. **Schema Validation:** Ensure `expectedVersion` and `summary` are passed.
  2. **Authorization:** Validate strict physician-only scoping.
  3. **Diagnostic Resolution:** Assert that pending orders block discharge, but cancelled or completed orders allow it.
  4. **Optimistic Concurrency:** Verify `VERSION_CONFLICT` behavior on parallel state modification.
  5. **Atomic Audit:** Confirm the signed clinical record and dual audit log are committed atomically.
  6. **Immutability (M9 & M10):** Verify new SOAP notes, vitals, or diagnostic orders cannot be added to a discharged encounter.
  7. **Rollback:** Force-mocked an audit layer failure to guarantee transaction rollback.

## Verification & Execution Notes
- **Local Environment DB Verification:** Executed fully against the local PostgreSQL `55432` test environment. 
- **Concurrency Proof Updated:** Added a REAL concurrent test utilizing `Promise.allSettled` to fire two exact simultaneous requests with the same expectedVersion. Proved exactly 1 succeeds and exactly 1 fails with `VERSION_CONFLICT` / `INVALID_TRANSITION`.
- **M13 Playwright Verification:** NOT EXECUTED for the Discharge Flow. There are currently no Playwright tests written for the discharge workflow in `tests/e2e/specs/`. We did not manufacture E2E tests for Phase 1A. All backend verification passed.
