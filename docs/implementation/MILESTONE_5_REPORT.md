# Hospital AI OS — Milestone 5 Verification Report

> **Status:** Phase 4 Implementation
> **Authority:** security-architecture.md, backend-architecture.md, api-architecture.md, implementation-plan.md
> **Scope:** M5 Authorization & RBAC

---

## Status

**VERIFIED**

---

## Authorization Model

Role-Based Access Control (RBAC) with resource-level scoping.

```
Staff → Role → Permissions → Resource:Action[:Scope]
```

- **M5 evaluates:** "Does this authenticated role possess this `resource:action` permission?"
- **M6+ evaluates:** "Is this specific resource within the permitted scope (`:department`, `:assigned`)?"

Authorization is **static code configuration**. No database tables created.

Source of truth: [`security-architecture.md §2.1–2.3`](../architecture/security-architecture.md)

---

## Roles

Exactly 7 roles from the verified M2 `staff_role` enum:

1. `physician`
2. `nurse`
3. `pharmacist`
4. `lab_technician`
5. `receptionist`
6. `hospital_admin`
7. `security_admin`

No roles added, removed, or invented.

---

## Permissions

29 permissions derived from `security-architecture.md §2.3` and `api-architecture.md §2.*`:

| Resource | Actions |
|:---|:---|
| `patient` | `read`, `create`, `update`, `verify_identity` |
| `clinical_record` | `read`, `write`, `sign` |
| `diagnostic_order` | `create`, `read`, `update`, `cancel` |
| `diagnostic_result` | `read`, `enter`, `verify` |
| `encounter` | `create`, `read`, `update`, `discharge` |
| `appointment` | `create`, `read`, `update`, `cancel` |
| `ai_interaction` | `invoke` |
| `staff` | `manage` |
| `audit_event` | `read` |
| `break_glass` | `activate`, `review` |
| `task` | `read`, `update` |

---

## Role-Permission Matrix

| Permission | physician | nurse | pharmacist | lab_technician | receptionist | hospital_admin | security_admin |
|:---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| `patient:read` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| `patient:create` | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| `patient:update` | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| `patient:verify_identity` | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| `clinical_record:read` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `clinical_record:write` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `clinical_record:sign` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `diagnostic_order:create` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `diagnostic_order:read` | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| `diagnostic_order:update` | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| `diagnostic_order:cancel` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `diagnostic_result:read` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `diagnostic_result:enter` | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| `diagnostic_result:verify` | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| `encounter:create` | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| `encounter:read` | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ |
| `encounter:update` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `encounter:discharge` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `appointment:create` | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| `appointment:read` | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ | ❌ |
| `appointment:update` | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| `appointment:cancel` | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| `ai_interaction:invoke` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `staff:manage` | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| `audit_event:read` | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| `break_glass:activate` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `break_glass:review` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| `task:read` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `task:update` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |

> [!NOTE]
> `diagnostic_order:cancel` is defined in the permission vocabulary but not granted to any role in the locked M2 architecture matrix. Receptionist was not explicitly listed as having cancel access in `security-architecture.md §2.3`.

---

## Policy Engine

**File:** [`policy-engine.ts`](../../apps/backend/src/middleware/rbac/policy-engine.ts)

```
evaluatePermission(ctx: AuthorizationContext | null | undefined, permission: Permission | null | undefined): PolicyDecision
```

- **Pure function:** No Express, no DB, no network, no randomness, no side effects
- **Fail-closed:** Any unknown/null/undefined input → `{ allowed: false, code: 'DENIED' }`
- **Never throws:** `catch { return DENY }` — policy errors → DENY, never ALLOW
- **PolicyDecision:** `{ allowed: boolean; code: 'ALLOWED' | 'DENIED' }` — internal only, never surfaced to clients

**Fail-closed paths:**
- `null`/`undefined` context → DENY
- Unknown role → DENY (isValidRole check against VALID_ROLES readonly tuple)
- Unknown permission → DENY (isValidPermission check against VALID_PERMISSIONS Set)
- Role case variation (`PHYSICIAN`, `Physician`) → DENY
- Any thrown exception → DENY (catch block)

---

## Authorization Middleware

**File:** [`rbac.middleware.ts`](../../apps/backend/src/middleware/rbac.middleware.ts)

```typescript
requirePermission(permission: Permission): RequestHandler
```

**Pipeline:**
```
M4 authMiddleware (sets req.user)
  → requirePermission(...) [M5]
    → toAuthorizationContext(req.user)
      → evaluatePermission(ctx, permission)
        → ALLOW → next()
        → DENY  → next(new AuthorizationError(...)) → 403
```

**Security invariants:**
- Reads **only** from `req.user` (set by M4 JWT validation)
- Does NOT read from `req.body`, `req.query`, `req.params`, or any header
- Does NOT decode JWTs
- Does NOT implement authentication
- `PolicyDecision.code` is never forwarded to clients

**Logging (M3 logger):**
- DENY: `logger.warn({ role, permission, allowed: false }, 'Authorization denied')`
- ALLOW: `logger.debug({ role, permission, allowed: true }, 'Authorization granted')`
- **Never logged:** staffId, departmentId, PHI, tokens, passwords, headers

---

## Department Boundary

> [!IMPORTANT]
> **M5 does NOT perform resource-level department filtering.**

`departmentId` is retained in `AuthorizationContext` because downstream M6+ service/controller layers require it for scoped queries (e.g., `patient:read:department`).

M5 answers only: "Does this role have the `patient:read` permission?"
M6+ answers: "Is this patient in the physician's department?"

The `departmentId` field in M5 context is **metadata for downstream use only** — it is NOT used to verify that a resource belongs to the user's department.

---

## Resource Scope Boundary

The following scope checks are **deferred to M6+**:

| Scope | Who implements |
|:---|:---|
| `:department` — "patients within own department" | M6 Patient Module |
| `:assigned` — "patients assigned to this staff member" | M6/M8/M9 |
| `:own_draft` — "clinical records authored by self" | M9 Clinical Module |
| `:meds_only`, `:orders_only` — "limited clinical views" | M9 Clinical Module |

---

## Privilege Escalation Tests

**File:** [`policy-engine.test.ts`](../../apps/backend/src/middleware/rbac/__tests__/policy-engine.test.ts) + [`authorization.integration.test.ts`](../../apps/backend/src/middleware/rbac/__tests__/authorization.integration.test.ts)

Results: **All PASS**

| Test | Result |
|:---|:---:|
| physician CANNOT `staff:manage` (hospital_admin only) | PASS |
| nurse CANNOT `clinical_record:sign` (physician only) | PASS |
| nurse CANNOT `diagnostic_order:create` (physician only) | PASS |
| nurse CANNOT `encounter:discharge` (physician only) | PASS |
| receptionist CANNOT `clinical_record:write` | PASS |
| receptionist CANNOT `clinical_record:sign` | PASS |
| pharmacist CANNOT `diagnostic_result:enter` | PASS |
| pharmacist CANNOT `diagnostic_order:create` | PASS |
| hospital_admin does NOT automatically receive clinical permissions | PASS |
| security_admin does NOT automatically receive all permissions | PASS |
| unknown role receives ZERO permissions | PASS |

---

## Principal Integrity Tests

| Test | Result |
|:---|:---:|
| Forged role in `req.body` cannot escalate | PASS |
| Forged role in `req.query` cannot escalate | PASS |
| Injected `permissions` field on `req.user` cannot grant access | PASS |
| Forged `staffId` in `req.body` has no effect on RBAC | PASS |
| Tampered `req.user.role` with trailing space → DENY | PASS |

---

## Fail-Closed Tests

| Scenario | Expected | Result |
|:---|:---:|:---:|
| `null` context | DENY | PASS |
| `undefined` context | DENY | PASS |
| Unknown role (`unknown_role`) | DENY | PASS |
| Empty role (`""`) | DENY | PASS |
| Uppercase role (`PHYSICIAN`) | DENY | PASS |
| Mixed case role (`Physician`) | DENY | PASS |
| Role with whitespace (`" physician "`) | DENY | PASS |
| SQL injection in role field | DENY | PASS |
| Unknown permission (`patient:delete`) | DENY | PASS |
| Empty permission (`""`) | DENY | PASS |
| Malformed permission (no colon) | DENY | PASS |
| Permission with extra scope (`patient:read:department`) | DENY | PASS |
| `null` permission | DENY | PASS |
| `undefined` permission | DENY | PASS |
| Unknown role in JWT token → 403 integration | DENY | PASS |

---

## Integration Tests

**File:** [`authorization.integration.test.ts`](../../apps/backend/src/middleware/rbac/__tests__/authorization.integration.test.ts)

Real Express integration via supertest. Synthetic staff identities, no healthcare data.

**Results: 42 tests, all PASS**

| Category | Tests | Result |
|:---|:---:|:---:|
| Authentication boundary (401 without/bad token) | 5 | PASS |
| ALLOW paths (correct role + permission → 200) | 15 | PASS |
| DENY paths (authenticated but wrong role → 403) | 17 | PASS |
| Principal integrity (forged body/query cannot escalate) | 3 | PASS |
| Safe error responses (no policy internals exposed) | 2 | PASS |

---

## Security Audit

Searched M5 diff for fail-open patterns:

| Pattern | Found | Action |
|:---|:---:|:---|
| `catch { return next() }` | ❌ | None — catch returns DENY |
| `if (!role) allow` | ❌ | None — missing role → DENY |
| `if (!permission) allow` | ❌ | None — null permission → DENY |
| `unknown role → allow` | ❌ | None — unknown role → DENY |
| `policy error → allow` | ❌ | None — catch returns DENY |
| Single ALLOW path | ✅ | Inside `grantedPermissions.has(permission)` guard only |
| PHI in logs | ❌ | Logger only logs role+permission+allowed |
| Tokens in logs | ❌ | No token logging anywhere |
| Policy internals in error response | ❌ | Only `AuthorizationError('Insufficient permissions')` |

**Security audit: PASS**

---

## Database Changes

**NO DATABASE CHANGES.**

M5 uses exclusively:
- `staff.role` from the M4 JWT principal (`req.user.role`)
- `staff.departmentId` from the M4 JWT principal (`req.user.departmentId`)
- Static code configuration in `ROLE_PERMISSIONS`

The verified M2 schema was not modified.

---

## Build

```
pnpm install --frozen-lockfile  → PASS (exit 0)
npx tsc --noEmit (backend)      → PASS (exit 0, no errors)
pnpm run lint                   → PASS (exit 0, no lint errors)
pnpm run format                 → PASS (exit 0, files formatted)
```

---

## Tests

```
pnpm -r run test → PASS (exit 0)

packages/shared:  6 tests,  3 test files — PASS
apps/backend:   145 tests,  9 test files — PASS

M5 test files:
  policy-engine.test.ts              45 tests — PASS
  rbac.middleware.test.ts            21 tests — PASS
  authorization.integration.test.ts 42 tests — PASS

All pre-existing M4 tests:
  auth.test.ts                       14 tests — PASS
  auth.middleware.test.ts             8 tests — PASS
  middleware.test.ts                  7 tests — PASS
  health.test.ts                      2 tests — PASS
  errors.test.ts (db)                 5 tests — PASS
  logger.test.ts                      1 test  — PASS
```

---

## Architecture Conformance

| Item | Expected | Actual | Status |
|:---|:---|:---|:---:|
| Authorization model | RBAC with resource scoping | Static RBAC; scope deferred to M6+ | PASS |
| Middleware name | `rbac.middleware.ts` | `rbac.middleware.ts` | PASS |
| Middleware API | `requirePermission(...)` | `requirePermission(permission: Permission): RequestHandler` | PASS |
| Permission structure | `resource:action` | `resource:action` (29 permissions) | PASS |
| Roles | 7 exact roles from M2 enum | 7 exact roles | PASS |
| Static permissions | Static code config, no DB tables | Static `ROLE_PERMISSIONS` map, no DB tables | PASS |
| Error semantics | 401 unauthenticated, 403 unauthorized | 401 (auth guard), 403 (AuthorizationError) | PASS |
| Policy engine | Deterministic, testable, no Express/DB | Pure function, no Express/DB | PASS |
| Fail-closed | Default DENY | DENY on any error/unknown input | PASS |
| Break-glass | Permission primitives only (M15 owns workflow) | `break_glass:activate` + `break_glass:review` defined; no workflow | PASS |
| No M4 modification | Auth layer untouched | No M4 files modified | PASS |
| No DB schema changes | M2 schema intact | No schema files modified | PASS |

---

## Scope

- ✅ Authorization middleware (`rbac.middleware.ts`)
- ✅ Permission vocabulary (29 permissions, static)
- ✅ Role-permission matrix (7 roles, static)
- ✅ Authorization context (`AuthorizationContext`)
- ✅ Policy engine (deterministic, fail-closed, pure)
- ✅ Matrix-driven tests (every role × every permission)
- ✅ Fail-closed tests (unknown/null/malformed inputs)
- ✅ Privilege escalation tests
- ✅ Principal integrity tests
- ✅ Integration tests (real Express)
- ✅ Break-glass permissions defined (workflow deferred to M15)
- ❌ Patient CRUD — deferred to M6
- ❌ Clinical workflows — deferred to M9
- ❌ Break-glass workflow — deferred to M15
- ❌ Audit subsystem — deferred to M7
- ❌ Frontend — deferred to M16
- ❌ Resource-level department filtering — deferred to M6+
- ❌ Database schema changes — none made

---

## Issues

**None.** All tests pass. No unresolved architectural conflicts detected.

---

## Next Milestone

From [`implementation-plan.md`](../architecture/implementation-plan.md):

> **M6: Patient Module** — Patient registration, search, identity management
>
> - Patient CRUD; MRN generation; duplicate detection (trigram search); identity document upload + verification
> - Dependencies: M4, M5, M7
> - Acceptance: Register patient → assigned MRN; search by name/MRN/phone; upload + verify identity; duplicate warning
