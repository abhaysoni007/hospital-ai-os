# PHASE 1C — OPERATIONAL WORK MANAGEMENT PLAN

## 1. Forensic Findings

**Existing Phase 1B Baseline**:
- **Schema**: `tasks` table exists with `assignedTo`, `assignedBy`, `status`, `priority`, `dueAt`, `completedAt`. Does NOT contain `departmentId` directly (department is implied by the `assignedTo` staff member or the linked `encounterId`).
- **Service layer**: `reassignTask` and `escalateTask` are already implemented in `task.service.ts` using `FOR UPDATE` concurrency control. Both emit audit events (`TASK_REASSIGNED`, `TASK_ESCALATED`).
- **UI**: `/tasks` currently only lists tasks specifically assigned to the logged-in user. Reassign/Escalate are NOT exposed in the frontend.
- **RBAC**: M5 grants `task:read` to operational roles (`hospital_admin`, `receptionist`), but Phase 1B's strict `assignedTo = actorId` filter blocks them from seeing any tasks.
- **Infrastructure**: No existing cron or event-scheduler infrastructure exists in the codebase.

---

## 2. Reassignment Model

**Business Semantics**:
- **Who can reassign?** The current task assignee (peer-to-peer). Must hold `task:update`.
- **To whom?** Any active staff member in the **same department**. Server-side validation will require `newAssignee.departmentId === authContext.departmentId`.
- **State Impact**: Task `status` reverts to `assigned` to force the new owner to acknowledge it. `updatedAt` is modified.
- **Notification**: Reassignment triggers a `TASK_REASSIGNED` notification delivered to the *new* assignee's inbox. The old owner receives nothing (they initiated it).
- **SLA Impact**: Reassignment **does not** reset the SLA. `createdAt` and `dueAt` remain unchanged.
- **Reversibility**: Yes, the new assignee can reassign it back or to someone else.

---

## 3. Escalation Model

**Business Semantics**:
- **Definition**: Escalation is an **ACTION** that modifies priority, not a new lifecycle state.
- **Triggers**: 
  - *Manual*: The task assignee determines they cannot handle the task or it requires urgent attention.
  - *Automatic*: Overdue detection (see below).
- **Who may escalate?** The current task assignee.
- **Who receives escalation?** Because there is no supervisor hierarchy, escalation elevates `priority = 'critical'`. This forces the task to the top of the Operational Queue for the department. A notification is sent to the original `assignedBy` (if one exists).
- **Duplicate Prevention**: Idempotency guard: `if (task.priority === 'critical') throw ConflictError`.
- **Audit**: `TASK_ESCALATED` event generated (already implemented).

---

## 4. Reminder / Overdue Model

**Design Approach**:
- **Overdue Detection**: Derived dynamically on read. A task is overdue if `dueAt < NOW()` and `status IN ('created', 'assigned', 'in_progress')`. This avoids state-churn in the database.
- **Reminders**: Because we must "not introduce cron if an existing scheduler... can be reused" and none exists, we will NOT implement a complex backend cron daemon. Instead:
  1. The Operational Queue UI will explicitly flag overdue tasks dynamically.
  2. If a proactive notification push is strictly required, we will implement a lightweight single-node interval tick (e.g., checking every 5 minutes for tasks that just crossed `dueAt` and emitting a notification), but this risks cluster concurrency issues. 
  *Decision*: Favor dynamic UI derivation for overdue visibility.

---

## 5. Operational Queue Behavior

To solve the visibility gap for operational roles, `GET /api/v1/tasks` will support a `scope` query parameter (or implicit auth derivation):
- `scope=me` (default): `assignedTo = actorId`.
- `scope=department`: Returns all tasks assigned to staff within `authContext.departmentId`. Requires `task:read`.
- `scope=hospital`: Returns all tasks. Allowed ONLY for `hospital_admin` and `security_admin`.

This allows charge nurses and admins to see department bottlenecks without modifying the underlying task schema.

---

## 6. Notification Relationship

Task remains the authoritative state. Notifications act purely as communication envelopes.
- **Action**: Task Reassigned → **Notification**: `task_reassigned` sent to `newAssigneeId`.
- **Action**: Task Escalated → **Notification**: `task_escalated` sent to `assignedBy` (if not null).
- **Action**: Task Overdue → **Notification**: `task_overdue` (if we implement the background tick).

---

## 7. RBAC Re-Audit

M5 Permissions are sufficient. No gaps found.
- `task:read`: Valid for viewing "My Work" and Operational Queues.
- `task:update`: Valid for executing Acknowledge, Complete, Reassign, Escalate.

No client-supplied scopes will be trusted. Operational queue visibility is bound entirely to the decoded JWT `departmentId` and `role`.

---

## 8. Concurrency Proof

All actions (Reassign, Escalate) rely on the frozen Phase 1B lock:
```typescript
const rows = await tx.select().from(tasks).where(eq(tasks.id, id)).for('update');
```
- **Simultaneous Reassignment**: Request A wins, Request B reads the updated `assignedTo`, determines the actor is no longer the assignee, and throws `404 Not Found` or `403 Forbidden`.
- **Simultaneous Escalation**: Request A wins, changes priority to `critical`. Request B reads `critical`, throws `409 Conflict` (already escalated).
- **No duplicate audits or notifications** occur because they are generated inside the identical transaction boundary AFTER the lock is secured and state verified.

---

## 9. Frontend Strategy

Extend `/tasks` page:
- Add a tabs/toggle: "My Work" vs "Department Queue" (if role permits).
- **Status/Priority**: Visual styling for `priority = critical` (red/urgent indicators).
- **Overdue**: If `dueAt` is passed, show red timer icon.
- **Actions**:
  - Add "Reassign" button (opens a modal to select active staff in same department).
  - Add "Escalate" button (opens a confirmation dialog).
- Enforce M13 Design System (no `alert()`, use inline ActionErrors).

---

## 10. Role Workflows

- **PHYSICIAN / NURSE / LAB_TECH**:
  - Views "My Work".
  - Can Reassign to peers in their department if overloaded.
  - Can Escalate if blocked.
  - Acknowledge → Complete.
- **RECEPTIONIST**:
  - Views "Department Queue" (read-only). Cannot reassign or complete clinical tasks.
- **HOSPITAL_ADMIN**:
  - Views "Hospital Queue" (all departments) for SLA monitoring. Read-only.

---

## 11. Demo Data

Extend M13.2 seed with new synthetic scenarios:
- `DEMO-WORK-REASSIGNED-001`: A task initially assigned to Dr. A, reassigned to Dr. B.
- `DEMO-WORK-ESCALATED-001`: A task manually escalated to `critical`.
- `DEMO-WORK-OVERDUE-001`: A task injected with a `dueAt` of yesterday to prove operational queue red-flagging.

---

## 12. Audit

Phase 1C relies on Phase 1B's events:
- `TASK_REASSIGNED`
- `TASK_ESCALATED`

Both exist and maintain hash-chain continuity. No PHI is included.

---

## 13. Test Strategy

- **Unit**: Service logic enforcing same-department constraints for reassignment.
- **Integration**: API endpoints for reassign/escalate (ensure 403 when not assignee). Queue scope testing (department vs hospital).
- **Concurrency**: `Promise.allSettled` for concurrent escalation (1 success, 1 conflict).
- **RBAC**: Enforce receptionist cannot update tasks.
- **Frontend**: Overdue visual rendering.

---

## 14. Acceptance Criteria

1. **Reassignment**: Assignee can transfer a task to an active peer in the same department. Old owner loses access. New owner sees it in "My Work". Notification is generated.
2. **Escalation**: Assignee can escalate task priority to critical. Notification is generated.
3. **Operational Queue**: Admins and departmental staff can view tasks not assigned directly to them, strictly bounded by their M5 roles.
4. **Overdue**: UI visually flags tasks where `dueAt < NOW()`.
5. **Concurrency**: Simultaneous modifications resolve deterministically with zero data corruption.
6. **No UI alerts**: Frontend uses standard M13 error banners.

---

## 15. Deferred Scope (Explicitly NOT Phase 1C)

- M15 Break-glass
- M20 Staff Administration
- Autonomous AI task generation / SLA configurable rules engine
- Background CRON daemon for reminders (using dynamic UI detection instead)
- Supervisor Hierarchy (peer-to-peer only)

---

## FINAL VERDICT

```
READY FOR IMPLEMENTATION
```
