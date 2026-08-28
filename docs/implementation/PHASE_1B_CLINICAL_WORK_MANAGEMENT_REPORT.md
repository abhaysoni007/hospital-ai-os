# PHASE 1B — CLINICAL WORK MANAGEMENT REPORT

## 1. Forensic Findings

### Existing Schema (Verified — NOT recreated)

**`tasks` table** (`apps/backend/src/db/schema/tasks.ts`):
- Fields: `id`, `taskType`, `title`, `description`, `patientId`, `encounterId`, `assignedTo`, `assignedBy`, `priority`, `status`, `dueAt`, `completedAt`, `referenceType`, `referenceId`, `createdAt`, `updatedAt`
- Enum `taskTypeEnum`: `lab_review`, `discharge_draft`, `critical_alert`, `general`
- Enum `taskPriorityEnum`: `low`, `medium`, `high`, `critical`
- Enum `taskStatusEnum`: `created`, `assigned`, `in_progress`, `awaiting_approval`, `completed`, `cancelled`
- Index: `uniqueReferenceIdx` on `(referenceType, referenceId, taskType) WHERE referenceId IS NOT NULL`

**M5 Permission Matrix** (no gaps found, no new permissions created):
- `task:read` — physician, nurse, pharmacist, lab_technician, receptionist, hospital_admin, security_admin
- `task:update` — physician, nurse, pharmacist, lab_technician

**Audit service**: Accepts any `eventType` string — new task event types plug in without schema changes.

**Migration `0006_damp_shaman.sql`**: Already applied — adds `reference_type` + `reference_id` columns and unique partial index.

---

## 2. Task vs Notification Distinction

> NOTIFICATION = informs a user that something happened.
> TASK = authoritative actionable work assigned to an owner.

These are **not merged**. When a critical lab result is entered:

1. A **`Task`** record is created → the physician's authoritative work item with lifecycle.
2. A **`Notification`** record is created → an ephemeral inbox alert linking to the task context.

The notification panel navigates to `/tasks` — not the diagnostic result — confirming the task as the actionable artifact.

---

## 3. Task State Machine

```
             created
               |
               | acknowledge (created|assigned → in_progress)
               ▼
           assigned  ←──────────────── reassign (returns to assigned)
               |
               | acknowledge
               ▼
           in_progress
               |
               | complete (in_progress → completed)
               ▼
           completed  [TERMINAL — immutable]
```

Escalation is an **action** (priority → `critical`), NOT a state change.

**Forbidden transitions** (enforced by row-lock + status guard → 409 INVALID_TRANSITION):
- `completed → *`
- `cancelled → *`
- Re-acknowledging `in_progress`
- Re-completing `completed`

---

## 4. API

**Mounted at**: `/api/v1/tasks`

| Method | Path | Permission | Description |
|--------|------|-----------|-------------|
| GET | `/api/v1/tasks` | `task:read` | List tasks scoped to actor |
| GET | `/api/v1/tasks/:id` | `task:read` | Get single task (own only) |
| POST | `/api/v1/tasks/:id/acknowledge` | `task:update` | created/assigned → in_progress |
| POST | `/api/v1/tasks/:id/complete` | `task:update` | in_progress → completed |
| POST | `/api/v1/tasks/:id/reassign` | `task:update` | Transfer to another active staff |
| POST | `/api/v1/tasks/:id/escalate` | `task:update` | Elevate priority to critical |

Foreign task IDs return 404 (indistinguishable from not found).

---

## 5. RBAC

No new permissions created. Existing M5 matrix used as-is:

| Role | task:read | task:update |
|------|-----------|------------|
| physician | ✓ | ✓ |
| nurse | ✓ | ✓ |
| pharmacist | ✓ | ✓ |
| lab_technician | ✓ | ✓ |
| receptionist | ✓ | ✗ |
| hospital_admin | ✓ | ✗ |
| security_admin | ✓ | ✗ |

**M5 PERMISSION GAPS**: None detected.

---

## 6. Critical-Result Atomic Transaction

All of the following commit or roll back together in **one database transaction**:

```
tx.BEGIN
  INSERT diagnostic_result
  INSERT audit_event (LAB_RESULT_ENTERED)
  INSERT audit_event (CRITICAL_VALUE_DETECTED)
  INSERT task (critical_alert, priority=critical, assignedTo=orderingDoctorId)
  INSERT audit_event (TASK_CREATED)
  INSERT notification (critical_lab_alert)
  INSERT audit_event (CRITICAL_VALUE_NOTIFIED)
tx.COMMIT
```

**Duplicate protection**: unique partial index `idx_tasks_unique_reference` on `(referenceType, referenceId, taskType) WHERE referenceId IS NOT NULL` prevents two `critical_alert` tasks for the same `DiagnosticOrder`.

---

## 7. Audit Behavior

| Event | Emitted In | Metadata |
|-------|-----------|---------|
| `TASK_CREATED` | Critical result tx | taskType, priority, referenceType, referenceId |
| `TASK_ACKNOWLEDGED` | acknowledge tx | taskType, priority |
| `TASK_COMPLETED` | complete tx | taskType |
| `TASK_REASSIGNED` | reassign tx | taskType, fromAssignee, toAssignee |
| `TASK_ESCALATED` | escalate tx | taskType, previousPriority, newPriority |

No PHI in audit metadata (no patient names, MRN, DOB, diagnoses, lab values).

---

## 8. Concurrency Proof

Every mutation uses `FOR UPDATE` row-level lock:

```typescript
tx.select().from(tasks).where(eq(tasks.id, id)).for('update')
```

Concurrent `POST /:id/acknowledge`:
- Request A acquires lock → transitions → commits
- Request B waits → lock released → reads updated row → status guard fires → **409 INVALID_TRANSITION**

Result: exactly 1 success, 1 conflict, 1 audit event, 1 state transition.

---

## 9. Frontend Work Queue

**File**: `apps/frontend/src/app/tasks/page.tsx`

- Real API data (no mock/hardcoded tasks)
- Status filter
- Loading skeleton
- Empty state
- Error state with retry
- Inline action error banner (no `alert()` / `window.confirm`)
- Acknowledge button for `created` tasks
- Complete button for `in_progress` tasks
- View Details link navigating to diagnostic order or encounter

---

## 10. Demo Data

The M13.2 seed exercises `DiagnosticsService.enterResult()` for `DEMO-ORDER-001` (CBC Hgb 5.8 g/dL — critical low). This atomically creates:
- Critical lab result (`isCritical = true`)
- `critical_alert` Task assigned to ordering physician
- Critical notification

Demo scenario visible after `pnpm seed:demo`:
- **DEMO-WORK-CRITICAL-001**: Critical alert for Dr. Rajan Mehta, status `created`, priority `critical`

---

## 11. Tests Executed

| Suite | Tests | Result |
|-------|-------|--------|
| Frontend (7 files) | 56 | ✅ PASSED |
| Shared (6 files) | 51 | ✅ PASSED |
| Backend unit tests (no DB) | - | 🚫 BLOCKED |
| Backend integration (require DB) | - | 🚫 BLOCKED |

**Execution Notes**: 
- `pnpm run lint`: Fixed unused variables (AIProviderError, _authContext, text). Passed.
- `pnpm run typecheck`: Passed.
- `pnpm run build`: Passed.
- `pnpm --filter frontend test`: Passed 56 tests.
- `pnpm --filter shared test`: Passed 51 tests.
- **Backend Tests**: Execution failed with `ECONNREFUSED 127.0.0.1:55432`. The test environment's PostgreSQL instance is offline.

A dedicated concurrency test file (`task.concurrency.test.ts`) was authored to execute `Promise.allSettled` requests for Duplicate Protection, Acknowledgement, and Completion. However, it cannot be run to verify the claims due to the database constraint.

---

## 12. Frozen Gate Regression

| Gate | Status |
|------|--------|
| shared test (51 tests) | ✅ PASSED |
| frontend test (56 tests) | ✅ PASSED |
| backend tsc build | ✅ PASSED |
| frontend next build | ✅ PASSED |
| M5 permission matrix | ✅ UNCHANGED |
| M8 diagnostics | ✅ UNMODIFIED |
| M9 clinical records | ✅ UNMODIFIED |
| M10 critical result evaluator | ✅ EXTENDED ONLY (atomic task creation added) |
| M11/M12 AI orchestration | ✅ UNMODIFIED |
| M13 design system | ✅ USED, NOT CHANGED |
| Phase 1A discharge | ✅ UNMODIFIED |
| Backend Tests (M6-M13) | 🚫 BLOCKED (ECONNREFUSED) |

---

## 13. Git History

```
fffe5e0  fix(qa): fix lint errors and add concurrency proof test for tasks
7ba8acc  feat(tasks): add reassign/escalate ops, fix alert() usage, add Phase 1B verification report
9b1130b  feat(tasks): implement Phase 1B Work Management, My Work hub, and critical diagnostics tasks
11d55de  feat(ai): add OpenAI-compatible provider adapter and multi-provider configuration
a765f36  fix(qa): fix AI note draft envelope unwrapping and lab queue diagnostics demo data
```

---

## 14. Known Limitations

1. Reassign/escalate not yet exposed in frontend UI (backend complete, deferred to Phase 1C).
2. Demo seed integrity audit checks critical notification but not the task row explicitly.

---

## 15. Deferred Scope

Not implemented (per spec): cron, SLA engine, autonomous AI task generation, supervisor hierarchy, M15 break-glass, M20 administration, chart brief, narration, load testing.

---

## FINAL VERDICT

```
PHASE 1B — BLOCKED
```

**Blockers:**
- Cannot execute backend integration tests due to `ECONNREFUSED ::1:55432` (PostgreSQL instance offline).
- The strict requirement to "Run REAL concurrent requests against the same task. Acknowledge: Promise.allSettled... Prove: 1 success 1 deterministic conflict" was authored in `task.concurrency.test.ts` but could not be executed to generate the required proof.
- Cannot claim PASS if not executed.
