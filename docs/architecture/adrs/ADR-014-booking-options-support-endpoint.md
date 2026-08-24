# ADR-014: Booking-Options Support Endpoint (M8)

**Status:** ACCEPTED (ratified at M8 freeze gate)  
**Date:** 2026-08-25  
**Author:** Phase 5 — M8 Final Freeze & Verification  
**Supersedes:** None  
**References:** `api-architecture.md §2.3, §2.10`, `security-architecture.md §2.3`, `middleware/rbac/permissions.ts`, `ADR-012`, `docs/implementation/MILESTONE_8_REPORT.md`

---

## Context

The appointment booking workflow requires the receptionist to select a **department**
and a **physician**. The only endpoints that list staff/departments are the
administration endpoints (`GET /admin/staff`, `GET /admin/departments`, §2.10),
gated by `staff:manage` — scheduled for M20. The only role holding
`appointment:create` is the **receptionist**, who does not hold `staff:manage`.

Without a permitted source of physician/department options, the booking vertical
slice cannot be exercised end-to-end by its intended user.

## Decision

Ratify a single, strictly-bounded, read-only support endpoint inside the M8
appointment module:

| Property | Value |
|:---|:---|
| **Path** | `GET /api/v1/appointments/booking-options` |
| **Authentication** | Required — standard JWT (`authMiddleware`) |
| **Permission** | `appointment:create` (existing M5 permission; nothing invented) |
| **Department scope** | Server-enforced: non-admin callers receive ONLY their own department and that department's active physicians |
| **Response schema** | `{ departments: [{id, name, code}], physicians: [{id, firstName, lastName, departmentId}] }` |

### Why it exists

The booking form cannot function without a permitted directory read, and no such
read exists for the receptionist role before M20. This endpoint is the minimum
data necessary to complete the architecture-defined booking flow
(`api-architecture.md §2.3 POST /appointments`).

### Why it does NOT expose staff-management capabilities

- **Read-only.** No create/update/suspend/role-change operations exist on this path.
- **Field-minimal by design:** returns department id/name/code and physician
  id/name/departmentId ONLY. It never returns emails, employee IDs, phone numbers,
  account status, MFA flags, or any credential material.
- **No listing beyond need:** scoped to the caller's own department; a receptionist
  cannot enumerate staff of other departments.
- **No permission surface expansion:** reuses the existing `appointment:create`
  grant; the M5 matrix is untouched. Any caller able to invoke it could already
  book appointments, and the data returned is strictly what booking requires.

### Why it is temporary and limited to booking support

When §2.10 administration endpoints ship with M20 (or earlier if pulled forward),
this endpoint should be **retired or reduced to a thin alias** over them. It lives
inside the appointment module — not an admin module — precisely so it cannot grow
into staff management. Removal is tracked in `MILESTONE_8_REPORT.md → Remaining Issues`.

## Consequences

- The M8 booking vertical slice is complete for its intended user without
  inventing roles, permissions, or admin functionality.
- Enforcement is backend-authoritative; the frontend consumes the endpoint but
  applies no security logic of its own.
- Tests cover authentication (401), permission (403 matrix), and department scope.

## Alternatives Considered

| Alternative | Reason rejected |
|:---|:---|
| Grant receptionist `staff:manage` | Violates least privilege; modifies the frozen M5 matrix to serve UI convenience |
| Implement §2.10 admin endpoints now | Pulls M20 scope into M8; larger surface, same blocker |
| Free-text doctor entry in the booking form | Unusable and unsafe — bookings must target a validated physician UUID |
