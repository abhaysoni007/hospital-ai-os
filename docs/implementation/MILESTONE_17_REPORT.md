# Milestone 17 Report: Patient UI — Final Acceptance Gate

## Overview

Final acceptance verification of the M17 Patient UI (Patient Directory, registration
form, patient profile) against the running backend (`M6`) and the role-aware frontend
shell. Verified with the real Next.js app running on `http://localhost:3000`, the real
backend on `:3001`, and the real PostgreSQL instance.

**Verification commit base:** `dc421d7` (feat(patient): implement ADR-011 MRN generation)

## Flow Verification (real frontend + real backend)

```
login → Patient Directory → New Patient → registration form
      → backend patient creation → MRN returned → success state
      → redirect to /patients/:id (profile shows backend MRN)
```

| Step | Evidence | Result |
|:---|:---|:---:|
| `GET /login` renders | HTTP 200 from running dev server | PASS |
| `GET /patients` renders directory | HTTP 200, patient-directory markup present in SSR output | PASS |
| `GET /patients/new` renders registration form | HTTP 200 | PASS |
| Form submits via `patientService.registerPatient` → backend 201 | Backend logged the request; live API gate confirms 201 + MRN | PASS |
| Redirect to `/patients/{response.data.id}` | `router.push('/patients/${id}')` in form handler; profile page fetches by UUID and displays `patient.mrn` | PASS |
| No fabricated MRN anywhere in frontend | Repo-wide grep for MRN generation patterns: zero matches. All MRN displays bind to backend response fields (`patient.mrn`) | PASS |

## Error & Loading States

Verified by code path inspection of `services/api-client.ts`, `services/patient-service.ts`,
and page components, plus matching live API behaviour (each status actually produced
against the running backend during gate §6 of M6 report):

| Condition | Frontend behaviour | Backend (live) |
|:---|:---|:---:|
| Validation error | Inline error text from API message (`err.message`); loading state reset | 400 observed |
| Duplicate/conflict | Inline error text shown, form preserved | 409 `DUPLICATE_PATIENT` observed |
| 401 invalid credentials | Human-readable message via AuthContext mapping | 401 observed |
| 403 forbidden | `AuthGuard`/`AccessRestricted` component ("403 — Unauthorized"); direct API calls also rejected by backend | 403 observed |
| Network error | `ApiError(0, NETWORK_ERROR)` thrown by client, surfaced as inline error | — |
| Loading | Button/loading state during submission; skeleton states on directory/profile | — |

Token handling: access token held **in memory only**; refresh via HTTP-only cookie.

## Role-Aware Frontend

- Sidebar navigation filtered by `getNavItemsForRole()` (`utils/rbac.ts`);
  Patients entry requires `patient:read`.
- "Register Patient" control rendered only when
  `hasPermission(user.role, 'patient:create')` — receptionist sees it; roles without
  the permission (physician, nurse, hospital_admin, security_admin) do not.
- Pages wrapped in `<AppShell requiredPermission="…">` → unauthenticated users are
  redirected to `/login`; authenticated-but-unauthorized roles see `AccessRestricted`.
- Security remains backend-authoritative: a physician-level token sending a direct
  `POST /api/v1/patients` request receives **403** (verified live in M6 gate §6).
  Frontend visibility is never relied upon for security.

## Build / Type Checks

| Check | Result |
|:---|:---|
| `pnpm --filter frontend exec tsc --noEmit` | PASS |
| `pnpm --filter frontend build` (next build) | PASS — routes `/patients`, `/patients/[id]`, `/patients/new` built |
| `pnpm run lint` (frontend) | PASS |
| `pnpm install --frozen-lockfile` | PASS |

## Remaining Issues

- None blocking M17 Patient UI. Identity-document upload UI is intentionally out of
  scope for this gate (backend metadata endpoints exist; binary upload is future work).

## Status

**M17 STATUS = VERIFIED**
