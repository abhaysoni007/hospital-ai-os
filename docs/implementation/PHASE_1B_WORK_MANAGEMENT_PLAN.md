# PHASE 1B FORENSIC ARCHITECTURE REPORT

## Findings
A forensic review of the repository reveals that the primitive foundations for Clinical Work Management are already present in the database but remain unintegrated at the service/API layer. 
- The `tasks` table exists in `apps/backend/src/db/schema/tasks.ts` alongside `notifications`. It possesses fields for ownership (`assignedTo`, `assignedBy`), context (`patientId`, `encounterId`), priority, and lifecycle state (`status`).
- The `taskTypeEnum` explicitly includes `'critical_alert'`, `'lab_review'`, `'discharge_draft'`, and `'general'`.
- The `taskStatusEnum` defines the primitive lifecycle: `'created'`, `'assigned'`, `'in_progress'`, `'awaiting_approval'`, `'completed'`, `'cancelled'`.
- Notifications are actively utilized as a transactional outbox. In `diagnostics.service.ts`, entering a critical result inserts a notification in the same transaction as the result. However, it *does not* create a task currently.

## Existing Reusable Infrastructure
- **Identity & Context:** The robust `AuthContext` (role, department) and `encounter` contextual inheritances can be reused directly to assign and scope tasks without creating parallel logic.
- **Transactional Outbox:** The existing strategy of inserting `notifications` inside the same Drizzle `db.transaction(async (tx) => { ... })` as the domain event (like `LAB_RESULT_ENTERED`) should be extended to `tasks`.
- **Concurrency:** Optimistic concurrency via explicit `version` column is heavily favored. While the `tasks` table does not currently have a `version` column, the state transition guards and `.for('update')` locking strategies used in `diagnostics.service.ts` can be utilized.
- **Auditing:** The `auditEvents` table and `auditService.logEvent` with strict correlation hashes are fully capable of recording task lifecycle events natively without schema changes.

## Proposed Domain Model
- **Work Item (Task):** An authoritative, stateful entity representing an action that MUST be completed by a specific owner or role.
- **Notification:** A stateless pointer alerting a user to an event.
- **Alert:** A high-priority notification (e.g., `priority: 'critical'`).
- **Assignment:** The structural link assigning a Task to a specific `staffId` or `departmentId` + `role`.
- **Acknowledgement:** A user's explicit assertion that they have seen and accepted responsibility for a Task.
- **Escalation:** An action taken upon a task (e.g., reassigning to a supervisor or changing priority) when SLA limits are breached; this is an *action*, not a parallel state.

### State Machine
`created` → `assigned` → `in_progress` (equivalent to acknowledged) → `completed`
(Alternatively, `cancelled` as a terminal state). Escalation and Reassignment transition the ownership, not the fundamental lifecycle state, although they emit unique audit events.

## RBAC
- **Physician:** View own tasks, Acknowledge, Start, Complete, Reassign (within same department/specialty), Cancel.
- **Nurse:** View assigned tasks, Acknowledge, Start, Complete, Escalate (to Physician).
- **Lab Technician:** View dept tasks, Complete (e.g., lab collection).
- **Receptionist:** View administrative tasks, Complete, Reassign.
- **Pharmacist:** View assigned tasks, Complete.
- **Hospital Admin:** View all tasks for operational visibility. Cannot execute/complete clinical tasks.
- **Security Admin:** View audit trails only.

## First Vertical Slice
**Critical Result Loop Integration**
We will intercept the M12.2 Critical Result workflow in `diagnostics.service.ts` (`enterResult` method).
1. Lab Tech enters a Critical Result.
2. In the same transaction, a `Task` (type: `critical_alert`) is created, assigned to the ordering physician.
3. A `Notification` is dispatched pointing to the Task (or Result).
4. Physician sees the Task in their queue.
5. Physician acknowledges the Task (transitions to `in_progress`).
6. Physician completes the Task (transitions to `completed`).
7. All steps emit audit events (`TASK_CREATED`, `TASK_ACKNOWLEDGED`, `TASK_COMPLETED`).

## API
All endpoints follow `GET|POST /api/v1/tasks/...` 
- `GET /api/v1/tasks` (List tasks, scoped securely by actor token)
- `GET /api/v1/tasks/:id` (Get task detail)
- `POST /api/v1/tasks/:id/acknowledge` (Transition to `in_progress`)
- `POST /api/v1/tasks/:id/complete` (Terminal success)
- `POST /api/v1/tasks/:id/reassign` (Changes `assignedTo`)
- `POST /api/v1/tasks/:id/escalate` (Raises priority, triggers escalation notification)

## Frontend
- **Work Queue / My Work:** A new unified list view under `/tasks` accessible from the sidebar. 
- **Notification Panel:** Existing panel will link to the task detail or context.
- **Encounter Context:** Embed a "Pending Tasks" list inside `/encounters/[id]`.

## Audit
New event types mapped to `auditEvents`:
- `TASK_CREATED`
- `TASK_ACKNOWLEDGED`
- `TASK_COMPLETED`
- `TASK_REASSIGNED`
- `TASK_ESCALATED`
- `TASK_CANCELLED`
Payloads will be strictly metadata-only (task IDs, previous assignee, priority). No PHI.

## Concurrency
- Task transitions (`acknowledge`, `complete`, `reassign`) will utilize Drizzle's row-level locking (`.for('update')`) during the transition transaction.
- Status guards (e.g., ensuring a task is `assigned` before it can be `acknowledged`, or preventing a `completed` task from being `reassigned`) will prevent dual-execution.

## Demo Data
- Extend M13.2 seed data in `seed-demo.ts` with `DEMO-WORK-001`.
- Seed a critical lab result that correctly instantiates a task for `phys-a`.
- Seed one open task, one overdue task, and one completed task to ensure UI visibility immediately upon login.

## Testing
- **Integration:** Test the full vertical slice (Lab Tech critical result entry → Physician task queue).
- **Concurrency:** Implement `Promise.allSettled` to simulate simultaneous acknowledgements of the same task, proving exactly 1 succeeds.
- **RBAC:** Verify unauthorized roles (e.g., Receptionist) cannot complete a Physician's task.
- **Rollback:** Mock an audit failure during task completion to ensure DB rollback.

## Deferred Scope
- Recurring/automated task engines (cron).
- Complex SLA configurable policies.
- AI autonomous task generation.
- Break-glass overrides.

## File-by-File Plan
1. `apps/backend/src/modules/task/task.service.ts` (NEW) - Implements the core domain logic and state machine.
2. `apps/backend/src/modules/task/task.controller.ts` (NEW) - REST API bindings.
3. `apps/backend/src/modules/task/task.routes.ts` (NEW) - Express routes mapping.
4. `apps/backend/src/server.ts` - Mount `/api/v1/tasks`.
5. `packages/shared/src/api/task.schemas.ts` (NEW) - Zod schemas and types.
6. `apps/backend/src/modules/diagnostics/diagnostics.service.ts` - Modify `enterResult` to inject task creation into the critical outbox transaction.
7. `apps/frontend/src/services/task-service.ts` (NEW) - React frontend API client.
8. `apps/frontend/src/app/tasks/page.tsx` - Implement My Work dashboard.
9. `apps/backend/src/db/seed-demo.ts` - Add `DEMO-WORK-001` seed objects.
10. `apps/backend/src/modules/task/__tests__/task.integration.test.ts` (NEW) - Integration suite.

## Migration/ADR Requirements
- No schema migration is required since `tasks` and `taskTypeEnum` are already present in Drizzle definitions.
- An ADR update (`ADR-021-Clinical-Work-Management`) is recommended to formally document the separation of Tasks vs Notifications and the transactional outbox approach.

## Acceptance Criteria
- A Critical Result successfully generates a Task in the same transaction.
- Physician can retrieve their task queue reliably scoped by their authentication.
- Physician can acknowledge and complete the task.
- State transitions are strictly enforced and emit immutable audit events.
- Attempting to acknowledge a task twice results in a deterministic conflict.
- Unauthorized roles receive a 403.

## Risks
- Transaction scope bloat during `enterResult`. The transaction is already logging multiple audit events and notifications; adding task creation increases the commit payload size. Mitigation: No external network calls within the transaction boundary.

## ARCHITECTURE DECISIONS BEFORE IMPLEMENTATION

### 1. Task Schema Sufficiency
The existing `tasks` schema is **NOT** fully sufficient for the first vertical slice. While it supports ownership, context, and state, it currently lacks `reference_id` (UUID) and `reference_type` (varchar). This means there is no way at the database level to deterministically link a critical-alert task to a specific `diagnosticResult.id`. Without these fields, we cannot enforce database-level idempotency to prevent duplicate tasks per result.

### 2. Lifecycle & Acknowledgement Semantics
We will NOT introduce a new `acknowledged` status. The existing `taskStatusEnum` transition from `assigned` to `in_progress` perfectly encapsulates "I have seen this and taken ownership/started work". Acknowledgement represents this exact transition.

### 3. Critical-Result Idempotency
To prevent duplicate tasks if a critical result is re-processed, we will enforce idempotency purely at the database level. We will add a unique index: `UNIQUE(reference_type, reference_id, task_type)`. This guarantees exactly one `critical_alert` task can exist for a given `DiagnosticResult`.

### 4. Task/Notification Transaction Boundary
Task creation will be injected directly into the **existing `enterResult` Drizzle transaction** in `diagnostics.service.ts`. The transaction remains strictly database-internal:
- Evaluate result (in-memory)
- Insert `diagnostic_results`
- Insert `audit_events` (Result created + Critical detected)
- **Insert `tasks`**
- **Insert `notifications`**
If any insertion fails, the entire block rolls back atomically. No external network calls are present.

### 5. Audit Event Minimum Set
We will prune the proposed audit taxonomy to only the events required for the Phase 1B first vertical slice:
- `TASK_CREATED`
- `TASK_ACKNOWLEDGED`
- `TASK_COMPLETED`
No future vocabulary (e.g. `TASK_ESCALATED`) will be added prematurely.

### 6. RBAC & Permission Impact
The frozen M5 matrix in `permissions.ts` already grants `task:read` to all roles, and `task:update` to clinical roles (Physician, Nurse, Pharmacist, Lab Tech). 
- **Physician:** possesses `task:update`, so they are fully authorized to acknowledge and complete the critical-alert task.
- No new permissions are required. We will strictly utilize `task:read` and `task:update`. 

### 7. Concurrency Strategy
We will utilize the `SELECT FOR UPDATE` (`.for('update')`) combined with strict status guards (`where status = 'assigned'`). This perfectly aligns with the established M12.2 concurrency patterns in `diagnostics.service.ts` and `notification.service.ts`. Simultaneous acknowledgements will result in exactly one successful `in_progress` update and one deterministic `ConflictError: INVALID_TRANSITION`.

### 8. PHI Projection
Task list and detail responses will project ONLY metadata: `id, taskType, title, priority, status, patientId, encounterId, referenceId`. The title will simply read "Critical lab value: CBC". No MRN, DOB, or clinical narrative/values will be exposed on the task object itself. The frontend will use the `referenceId` pointer to deep-link into the authorized clinical view.

### 9. Migration Requirement
**OPTION B:** Minimal schema additions are required.
We must run a Drizzle migration to add:
- `reference_id` (uuid)
- `reference_type` (varchar(50))
- `UNIQUE(reference_id, reference_type, task_type)` index.
This requires an ADR update (ADR-021) to justify the schema change for strict DB-level task idempotency.

### 10. Exact Phase 1B Scope
ONLY: Critical Result → Atomically create Physician Task + Notification → Physician My Work List (server-derived scope) → Acknowledge → Complete → Audit. No AI tasks, no recurring tasks, no generic task creation UI.

## Final Recommendation
READY FOR IMPLEMENTATION
