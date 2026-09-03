# M19.3 — Governed Actions / Human-Approved Execution Report

> **Status:** M19.3 — COMPLETE  
> **Authority:** Lead Implementation Engineer  
> **Date:** 2026-09-04  
> **Branch:** `main`  
> **Scope:** Governed Recommendation Actions + Human-Approved Execution according to locked architecture in `docs/architecture/M19_INTELLIGENCE_ARCHITECTURE.md`.

---

## 1. Status

**M19.3 — COMPLETE**

The deterministic policy engine, governed action executor, database-backed idempotency protection, row-level locking concurrency control, two-phase and atomic execution pipelines, audit logging, and frontend approval interface are fully implemented, verified, and passing 100% of workspace tests (1,037 tests passed across 83 test suites).

---

## 2. Objective

Establish a secure, governed action pipeline for operational recommendations generated in M19.2. Ensure that AI never executes any action autonomously; human authorization is mandatory; deterministic policy validates every execution request; existing authorized services perform the mutations; database-backed idempotency prevents duplicate execution; and complete SHA-256 hash-chained audit trails record the lifecycle.

---

## 3. Architecture Adherence & Core Safety Principle

The implementation strictly satisfies the core governed execution principle:

$$\text{AI Recommends} \longrightarrow \text{Policy Validates} \longrightarrow \text{Human Explicitly Approves} \longrightarrow \text{Existing Service Executes} \longrightarrow \text{Audit Records}$$

### Strict Safety Boundaries Preserved
- **Zero Autonomous Execution:** No recommendation is executed without an explicit authenticated HTTP request from a human actor holding `intelligence:approve`.
- **Zero Clinical Mutations:** AI does not prescribe, diagnose, adjust medication dosages, sign clinical records, or discharge patients.
- **Zero RBAC Bypasses:** Break-glass tokens are explicitly forbidden from bypassing governed action policy.
- **Zero LLM in Execution:** The execution phase does not call an LLM or depend on model availability.

---

## 4. Governed Action Lifecycle & State Transitions

The lifecycle is persisted in `intelligence_approved_actions` and parent `hospital_intelligence_signals`:

```text
               [ AI Recommendation ]
                         │
                         ▼
                     proposed
                    ╱        ╲
      (Human Approves)      (Human Rejects)
                  ▼            ▼
               approved     rejected  (Signal: dismissed)
                  │
                  ▼
              executing
             ╱         ╲
       (Success)     (Failure)
           ▼             ▼
       executed     execution_failed
  (Signal: actioned)
```

- **Two-Phase Flow:** `POST /recommendations/:id/approve` (`executeImmediately: false`) moves state to `approved`. Subsequent `POST /recommendations/:id/execute` runs execution.
- **Atomic Flow:** `POST /recommendations/:id/approve` (default `executeImmediately: true`) validates policy, records approval, executes via existing service, updates state to `executed`, and updates parent signal to `actioned` in a single ACID transaction.
- **Rejection Flow:** `POST /recommendations/:id/reject` records rejection reason, updates recommendation state to `rejected`, and parent signal state to `dismissed`.

---

## 5. Deterministic Policy Engine

Implemented in [`hospital-intelligence.policy.ts`](file:///c:/Users/yuvra/Downloads/NxtWave/Projects/AI-Med/hospital-ai-os/apps/backend/src/modules/hospital-intelligence/hospital-intelligence.policy.ts):

| Validation Rule | Description | Denial ReasonCode | HTTP Code |
|:---|:---|:---|:---:|
| **Break-Glass Prohibition** | Governed action execution cannot be combined with active break-glass tokens | `BREAK_GLASS_PROHIBITED` | 403 |
| **Permission Check** | Actor must hold `intelligence:approve` (`physician` or `hospital_admin`) | `UNAUTHORIZED_ROLE` | 403 |
| **Action Allowlist** | Action must be one of the 6 ratified actions | `ACTION_TYPE_NOT_ALLOWLISTED` | 400 |
| **Parent Signal Status** | Parent signal must exist and not be already dismissed | `SIGNAL_ALREADY_DISMISSED` | 409 |
| **Department Scope** | Clinicians cannot approve/execute actions outside their assigned department | `CROSS_DEPARTMENT_ACCESS_DENIED` | 403 |
| **State Machine Transition** | Cannot approve/execute already executed or rejected actions | `ALREADY_EXECUTED` / `ALREADY_REJECTED` | 409 |
| **Resource Existence** | Underlying encounter, notification, order, or patient must physically exist in DB | `UNDERLYING_RESOURCE_NOT_FOUND` | 404 |

---

## 6. Action Mapping to Existing Services

Implemented in [`hospital-intelligence.executor.ts`](file:///c:/Users/yuvra/Downloads/NxtWave/Projects/AI-Med/hospital-ai-os/apps/backend/src/modules/hospital-intelligence/hospital-intelligence.executor.ts):

| Action Type | Classification | Handled By | Operation Performed |
|:---|:---|:---|:---|
| `ACKNOWLEDGE_CRITICAL_ALERT` | Executable Mutation | `NotificationService` | Updates `notifications` row: `status = 'acknowledged'`, `acknowledgedAt = NOW()`. Audits `NOTIFICATION_ACKNOWLEDGED`. |
| `NOTIFY_ATTENDING_PHYSICIAN` | Executable Mutation | `NotificationService` | Looks up attending/ordering physician from active encounter, inserts priority `urgent` notification with type `system_alert`. |
| `ESCALATE_ALERT` | Executable Mutation | `NotificationService` | Updates notification priority to `critical`. |
| `REASSIGN_TASK` | Executable Mutation | `TaskService` | Calls `taskService.reassignTask()` verifying target assignee exists, is active, and in same department. |
| `VIEW_PATIENT_RECORD` | Navigation (Read-Only) | `FrontendNavigation` | **ZERO database mutations.** Returns verified navigation pointer: `{ targetUrl: '/patients/:id', isReadOnly: true }`. |
| `VIEW_DIAGNOSTIC_ORDER` | Navigation (Read-Only) | `FrontendNavigation` | **ZERO database mutations.** Returns verified navigation pointer: `{ targetUrl: '/diagnostics/:id', isReadOnly: true }`. |

---

## 7. Authorization & Department Isolation

- **Server-Side Enforcement:** Identity and roles are derived purely from validated JWT claims (`req.user.staffId`, `req.user.role`, `req.user.departmentId`).
- **Clinician Scope:** Clinicians can only approve recommendations for encounters belonging to their assigned department (`encounters.department_id = actor.departmentId`). Cross-department attempts are denied with `403 CROSS_DEPARTMENT_ACCESS_DENIED`.
- **Admin Scope:** `hospital_admin` can approve recommendations across all hospital departments.

---

## 8. Idempotency & Concurrency Guarantees

- **Unique Database Constraint:** `intelligence_approved_actions.idempotency_key` is backed by `uniqueIndex('idx_approved_actions_idempotency')`.
- **Row-Level Locking:** Transactions use `SELECT ... FROM intelligence_approved_actions WHERE id = :id FOR UPDATE`. This serializes double-clicks, concurrent tabs, and retries.
- **Idempotent Retry:** If a request is repeated with the **same** idempotency key on an already executed action, the system returns the cached execution result with `{ idempotent: true }` without executing side effects twice.
- **Conflict Protection:** If a request attempts to execute an already executed action with a **different** idempotency key, it is rejected with `409 Conflict (RECOMMENDATION_ALREADY_ACTED)`.

---

## 9. Audit Trail & Hash-Chain Integrity

All audit events route through `AuditService.logEvent()`:
- `RECOMMENDATION_APPROVED`: Logged upon valid human approval.
- `RECOMMENDATION_POLICY_REJECTED`: Logged when deterministic policy rejects an action.
- `RECOMMENDATION_REJECTED`: Logged upon human dismissal.
- `ACTION_EXECUTED`: Logged upon successful execution through an existing service.
- `ACTION_FAILED`: Logged if the underlying service returns an error.
- **Zero PHI:** Audit payloads contain IDs, enum values, and timestamps only. Patient names, national IDs, and free-text notes are never written to `actionDetail`.

---

## 10. API Endpoints

Mounted under `/api/v1/hospital-intelligence/*`:
- `POST /recommendations/:id/approve`
  - Body: `{ idempotencyKey: string, executeImmediately?: boolean }`
  - Permission: `intelligence:approve`
  - Response: `GovernedActionResult`
- `POST /recommendations/:id/execute`
  - Body: `{ idempotencyKey: string }`
  - Permission: `intelligence:approve`
  - Response: `GovernedActionResult`
- `POST /recommendations/:id/reject`
  - Body: `{ rejectionReason?: string }`
  - Permission: `intelligence:approve`
  - Response: `{ status: 'rejected', recommendationId: string, rejectionReason?: string }`

---

## 11. Frontend Verification UI

Enhanced [`apps/frontend/src/app/intelligence/page.tsx`](file:///c:/Users/yuvra/Downloads/NxtWave/Projects/AI-Med/hospital-ai-os/apps/frontend/src/app/intelligence/page.tsx):
- **Governed Action Card:** Replaced placeholder with live action cards showing action type, rationale, and status badge.
- **Interactive Controls:** "Approve & Execute" and "Reject" buttons active for `proposed` status.
- **Execution Feedback:** Status changes to green `EXECUTED` with details of the service invoked upon approval.
- **Rejection Feedback:** Status changes to `REJECTED` upon human dismissal.
- **Error Feedback:** Displays policy rejection message if denied.

---

## 12. Comprehensive Verification Results

### Test Suites
| Suite / Area | Tests | Status |
|:---|:---:|:---:|
| Shared Schemas (`packages/shared`) | 71 passed | **PASS** |
| Governed Action Policy Unit Tests | 9 passed | **PASS** |
| Governed Action Execution Integration Tests | 8 passed | **PASS** |
| Governed Action Mandatory Security Suite (§20) | 7 passed | **PASS** |
| Route Authorization Suite | 15 passed | **PASS** |
| Service Persistence & Deduplication | 4 passed | **PASS** |
| Deterministic Signal Detection | 5 passed | **PASS** |
| AI Grounding & Safe Degradation | 5 passed | **PASS** |
| Backend Full Regression Suite (`apps/backend`) | 743 passed | **PASS** |
| Frontend Full Regression Suite (`apps/frontend`) | 223 passed | **PASS** |
| **WORKSPACE TOTAL** | **1,037 passed (0 failed)** | **PASS** |

### Compilation & Build
- `packages/shared`: `npm run build` (`tsc`) — **EXIT 0**
- `apps/backend`: `npm run build` (`tsc`) — **EXIT 0**
- `apps/frontend`: `npm run build` (`next build`) — **EXIT 0** (19 pages compiled and prerendered)

---

## 13. Security Verification Summary

1. **Forged Action Types:** Actions outside the allowlist (e.g., `DISCHARGE_PATIENT`, `PRESCRIBE_MEDICATION`) fail policy validation (`ACTION_TYPE_NOT_ALLOWLISTED`) and cannot execute.
2. **Forged Resources:** Non-existent recommendation IDs return `404 Not Found`.
3. **Unauthorized Roles:** Requests from nurses, receptionists, or unauthorized staff return `403 Forbidden` (`UNAUTHORIZED_ROLE`).
4. **Cross-Department Denial:** Clinicians cannot approve actions on encounters outside their department (`403 CROSS_DEPARTMENT_ACCESS_DENIED`).
5. **Break-Glass Independence:** Intelligence actions cannot use active break-glass tokens as shortcuts (`403 BREAK_GLASS_PROHIBITED`).
6. **Execute Without Approval:** Directly calling execute on an unapproved/rejected recommendation fails (`409 Conflict`).

---

## 14. Known Limitations

- Task reassignment requires a pre-existing task associated with the active encounter.
- Navigation actions are advisory pointers for frontend routing rather than backend mutations.

---

## 15. Untouched Scope Confirmation

- [x] **M19.3 Governed Actions Completed**
- [ ] **M19.4 Intelligence Center Dashboard NOT started** (Minimal verification surface on `/intelligence` only)
- [ ] **M19.5 Evaluation Harness NOT started**
- [ ] **M19.6 Demo Submission Work NOT started**
