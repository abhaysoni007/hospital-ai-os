/**
 * M14 — Tasks E2E Flow Coverage (Real Stack)
 *
 * Exercises the real backend (HTTP API, real Postgres, real JWT) and the
 * real frontend (/tasks page) to validate:
 *   1. Authenticated user opens /tasks → task list loads.
 *   2. Server-side scope: physician2 (different department) does NOT see
 *      physician1's tasks.
 *   3. Acknowledge: task assigned to user → user acks → status becomes
 *      in_progress (verified via API state).
 *   4. Complete: in_progress → completed.
 *   5. Invalid repeat completion → 409 INVALID_TRANSITION.
 *   6. Reassignment: physician reassigns to a same-department staff member;
 *      a `task_assignment` notification is generated.
 *   7. Authorization: foreign task → 404 (ownership protected at the API).
 *
 * All API calls hit the real backend (http://localhost:3001).
 * All UI calls hit the real frontend (http://localhost:3002).
 * No mocks for authorization. No mocks for the database.
 *
 * Synthetic data only — uses the demo seed (DEMO-2026-* + DEMO-WORK-* tasks).
 */

import { test, expect, request, type APIRequestContext, type Page } from '@playwright/test';

const API = 'http://localhost:3001';
const PHYSICIAN = { email: 'demo.physician@hospital.test', password: 'DemoPhys#2026!' };
const PHYSICIAN2 = { email: 'demo.physician2@hospital.test', password: 'DemoPhys#2026!' };
const NURSE = { email: 'demo.nurse@hospital.test', password: 'DemoNurs#2026!' };
const LABTECH = { email: 'demo.labtech@hospital.test', password: 'DemoLab#2026!' };

interface AuthData {
  accessToken: string;
  user: { id: string; role: string; departmentId: string };
}

async function login(creds: { email: string; password: string }): Promise<AuthData> {
  const ctx = await request.newContext({ baseURL: API });
  const res = await ctx.post('/api/v1/auth/login', { data: creds });
  expect(res.status(), `login ${creds.email}`).toBe(200);
  const body = await res.json();
  return body.data as AuthData;
}

async function authedCtx(token: string): Promise<APIRequestContext> {
  return request.newContext({
    baseURL: API,
    extraHTTPHeaders: { Authorization: `Bearer ${token}` },
  });
}

interface TaskRow {
  id: string;
  title: string;
  status: string;
  priority: string;
  assignedTo: string | null;
  patientId: string | null;
}

async function listMyTasks(ctx: APIRequestContext, status?: string): Promise<TaskRow[]> {
  const qs = status ? `?status=${status}` : '';
  const res = await ctx.get(`/api/v1/tasks${qs}`);
  expect(res.status(), 'list my tasks').toBe(200);
  const body = await res.json();
  return body.data as TaskRow[];
}

test.describe('M14 Tasks E2E (real backend + real frontend)', () => {
  let physician: AuthData;
  let physician2: AuthData;
  let physicianCtx: APIRequestContext;
  let physician2Ctx: APIRequestContext;
  let nurse: AuthData;
  let nurseCtx: APIRequestContext;
  let labtech: AuthData;
  let labtechCtx: APIRequestContext;

  test.beforeAll(async () => {
    physician = await login(PHYSICIAN);
    physician2 = await login(PHYSICIAN2);
    nurse = await login(NURSE);
    labtech = await login(LABTECH);
    physicianCtx = await authedCtx(physician.accessToken);
    physician2Ctx = await authedCtx(physician2.accessToken);
    nurseCtx = await authedCtx(nurse.accessToken);
    labtechCtx = await authedCtx(labtech.accessToken);
  });

  test.afterAll(async () => {
    await physicianCtx.dispose();
    await physician2Ctx.dispose();
    await nurseCtx.dispose();
    await labtechCtx.dispose();
  });

  // ─── 1. /tasks page renders and lists the user's tasks ──────────────────
  test('1. /tasks renders authenticated physician task list', async ({ page }: { page: Page }) => {
    await page.goto('/tasks');
    await expect(page.getByRole('heading', { name: /My Work/i }).first()).toBeVisible({
      timeout: 15000,
    });
    // At least one task row from the seed (DEMO-WORK-*) is expected.
    // If this is the first run after a fresh seed, the seeded "DEMO-WORK-REASSIGNED-001"
    // is `assigned` to demo.nurse — but demo.physician IS the assignedBy, so
    // they may not see it under "My Work" (default scope = me). Department scope
    // exposes it. We assert: the page renders without error and shows a table.
    await expect(page.locator('table').first()).toBeVisible({ timeout: 15000 });
  });

  // ─── 2. Server-side scope: physician2 (IM) does not see physician1 (Card) ─
  test('2. physician2 (IM) does NOT see physician1 (Cardiology) tasks via API', async () => {
    // Capture physician1's task list
    const p1Tasks = await listMyTasks(physicianCtx);
    const p1Ids = new Set(p1Tasks.map((t) => t.id));

    // physician2 lists their own tasks
    const p2Tasks = await listMyTasks(physician2Ctx);

    // None of physician1's task IDs should appear in physician2's list
    const leak = p2Tasks.filter((t) => p1Ids.has(t.id));
    expect(leak, 'physician2 must not see physician1 tasks').toEqual([]);
  });

  test('2b. physician2 department-scope still does not include physician1 tasks', async () => {
    // Use the explicit department scope param to confirm server-side enforcement
    const res = await physician2Ctx.get('/api/v1/tasks?scope=department');
    expect(res.status()).toBe(200);
    const body = await res.json();
    const tasks = body.data as TaskRow[];

    // Sample-check: confirm none of the well-known Card demo tasks appear
    const foreignTitles = [
      'DEMO-WORK-REASSIGNED-001',
      'DEMO-WORK-ESCALATED-001',
      'DEMO-WORK-OVERDUE-001',
    ];
    const foreign = tasks.filter((t) => foreignTitles.includes(t.title));
    expect(foreign, 'Cardiology tasks must not appear in IM department scope').toEqual([]);
  });

  // ─── 3. Authorization: foreign task → 404 ──────────────────────────────
  test('3. Foreign task GET → 404 (ownership enforced at the API)', async () => {
    // Get a task assigned to physician
    const physicianTasks = await listMyTasks(physicianCtx);
    if (physicianTasks.length === 0) {
      test.skip(true, 'no physician tasks in seed; cannot test ownership boundary');
    }
    const targetTask = physicianTasks[0];

    // physician2 attempts to read it
    const res = await physician2Ctx.get(`/api/v1/tasks/${targetTask.id}`);
    expect(res.status(), 'foreign task must be hidden (404 not 403)').toBe(404);
  });

  test('3b. Foreign task acknowledge attempt → 404', async () => {
    const physicianTasks = await listMyTasks(physicianCtx);
    if (physicianTasks.length === 0) {
      test.skip(true, 'no physician tasks');
    }
    const targetTask = physicianTasks[0];
    const res = await physician2Ctx.post(`/api/v1/tasks/${targetTask.id}/acknowledge`);
    expect(res.status()).toBe(404);
  });

  // ─── 4. Acknowledge: assigned → in_progress ─────────────────────────────
  test('4. Acknowledge a fresh task → status becomes in_progress', async () => {
    // Strategy: use the demo nurse to find the "DEMO-WORK-REASSIGNED-001" task
    // (assigned to demo.nurse) and acknowledge it. If the test was already run
    // and the task moved to a later state, fall back to creating a fresh task
    // by ordering a CBC and entering a critical result.
    let taskId: string | null = null;
    const nurseTasks = await listMyTasks(nurseCtx, 'assigned');
    const reassigned = nurseTasks.find((t) => t.title === 'DEMO-WORK-REASSIGNED-001');
    if (reassigned) {
      taskId = reassigned.id;
    } else {
      // Create a fresh task via the diagnostics → critical-result flow
      taskId = await createFreshTaskFor(physicianCtx, physician.user.id, labtechCtx);
    }
    expect(taskId, 'a task to acknowledge must exist').toBeTruthy();

    // Use the actor whose assignedTo === task.assignedTo
    // (the nurse for the seed task, the ordering physician for a fresh one)
    const targetActor = reassigned ? nurseCtx : physicianCtx;
    const ack = await targetActor.post(`/api/v1/tasks/${taskId}/acknowledge`);
    expect(ack.status(), 'acknowledge should be 200').toBe(200);
    const body = await ack.json();
    expect(body.data.status).toBe('in_progress');
  });

  // ─── 5. Complete: in_progress → completed ───────────────────────────────
  test('5a. Complete an in_progress task → status becomes completed', async () => {
    // Use the existing in_progress task "DEMO-WORK-ESCALATED-001" or the
    // task we just acknowledged in test 4 (if it's now in_progress).
    let taskId: string | null = null;

    // The task we acked in test 4 may now be in_progress for the right actor
    const myInProgress = await listMyTasks(physicianCtx, 'in_progress');
    const candidate =
      myInProgress.find((t) => t.title === 'DEMO-WORK-ESCALATED-001') ?? myInProgress[0];
    if (candidate) {
      taskId = candidate.id;
    } else {
      // No in_progress task available — create + ack
      const fresh = await createFreshTaskFor(physicianCtx, physician.user.id, labtechCtx);
      const ack = await physicianCtx.post(`/api/v1/tasks/${fresh}/acknowledge`);
      expect(ack.status()).toBe(200);
      taskId = fresh;
    }

    const complete = await physicianCtx.post(`/api/v1/tasks/${taskId}/complete`);
    expect(complete.status()).toBe(200);
    const body = await complete.json();
    expect(body.data.status).toBe('completed');
  });

  test('5b. Repeat completion → 409 INVALID_TRANSITION', async () => {
    // Find any completed task we own
    const myCompleted = await listMyTasks(physicianCtx, 'completed');
    if (myCompleted.length === 0) {
      test.skip(true, 'no completed task available');
    }
    const target = myCompleted[0];
    const res = await physicianCtx.post(`/api/v1/tasks/${target.id}/complete`);
    expect(res.status()).toBe(409);
    const body = await res.json();
    expect(JSON.stringify(body)).toMatch(/INVALID_TRANSITION|invalid transition|already/i);
  });

  // ─── 6. Reassignment: physician reassigns to a same-department staff ───
  test('6. Reassign a task to a same-department nurse → 200 + status=assigned + notification generated', async () => {
    // Create a fresh task to avoid disturbing the seed
    const freshTaskId = await createFreshTaskFor(physicianCtx, physician.user.id, labtechCtx);

    // Resolve the nurse in the same department (Cardiology)
    const deptRes = await physicianCtx.get('/api/v1/staff/department');
    expect(deptRes.status()).toBe(200);
    const deptStaff = (await deptRes.json()).data as Array<{
      id: string;
      displayName: string;
      role: string;
    }>;
    const targetNurse = deptStaff.find((s) => s.role === 'nurse' && s.id !== physician.user.id);
    if (!targetNurse) throw new Error('No nurse in same department for reassignment');

    // Acknowledge the fresh task so we can reassign
    const ack = await physicianCtx.post(`/api/v1/tasks/${freshTaskId}/acknowledge`);
    expect(ack.status()).toBe(200);

    // Capture the nurse's task_assignment notification count BEFORE reassignment
    const beforeCount = await listNotificationsCount(nurseCtx, 'task_assignment');

    // Reassign
    const reassign = await physicianCtx.post(`/api/v1/tasks/${freshTaskId}/reassign`, {
      data: { newAssigneeId: targetNurse.id },
    });
    expect(reassign.status(), 'reassign should be 200').toBe(200);
    const body = await reassign.json();
    expect(body.data.status).toBe('assigned');
    expect(body.data.assignedTo).toBe(targetNurse.id);

    // Verify: a task_assignment notification was generated for the new assignee
    const afterCount = await listNotificationsCount(nurseCtx, 'task_assignment');
    expect(afterCount, 'reassignment must add a task_assignment notification').toBeGreaterThan(
      beforeCount,
    );
  });

  test('6b. Cross-department reassignment target → 409 (denied)', async () => {
    const freshTaskId = await createFreshTaskFor(physicianCtx, physician.user.id, labtechCtx);
    const ack = await physicianCtx.post(`/api/v1/tasks/${freshTaskId}/acknowledge`);
    expect(ack.status()).toBe(200);

    // physician2 is in IM (different department) — reassign must be rejected
    const reassign = await physicianCtx.post(`/api/v1/tasks/${freshTaskId}/reassign`, {
      data: { newAssigneeId: physician2.user.id },
    });
    expect(reassign.status(), 'cross-department reassign must be 409').toBe(409);
  });
});

// ─── Helpers ──────────────────────────────────────────────────────────────

async function createFreshTaskFor(
  ctx: APIRequestContext,
  orderingPhysicianId: string,
  labtechCtx: APIRequestContext,
): Promise<string> {
  // We need: an encounter owned by the ordering physician. Margaret Chen's
  // encounter is owned by demo.physician (Cardiology). Use that.

  // Discover the encounter via the patient search
  const ptRes = await ctx.get(`/api/v1/patients?query=DEMO-2026-00001`);
  expect(ptRes.status()).toBe(200);
  const patientId = ((await ptRes.json()).data as Array<{ id: string; mrn: string }>).find(
    (p) => p.mrn === 'DEMO-2026-00001',
  )?.id;
  if (!patientId) throw new Error('DEMO-2026-00001 not found');

  const encRes = await ctx.get(`/api/v1/encounters?patientId=${patientId}&status=active`);
  expect(encRes.status()).toBe(200);
  const encounter = ((await encRes.json()).data as Array<{ id: string; status: string }>).find(
    (e) => e.status === 'active',
  );
  if (!encounter) throw new Error('No active encounter for Margaret Chen');
  const encounterId = encounter.id;

  // Step 1: physician creates a CBC diagnostic order
  const orderRes = await ctx.post(`/api/v1/encounters/${encounterId}/diagnostic-orders`, {
    data: {
      testCode: 'CBC',
      testName: 'Complete Blood Count',
      priority: 'routine',
    },
  });
  expect(orderRes.status(), 'create order').toBe(201);
  const order = (await orderRes.json()).data as { id: string };

  // Step 2: lab tech collects the sample
  const collectRes = await labtechCtx.patch(`/api/v1/diagnostic-orders/${order.id}/collect-sample`);
  expect(collectRes.status(), 'collect sample').toBe(200);

  // Step 3: lab tech enters a CRITICAL result (Hemoglobin 5.8 g/dL, critical low)
  const resultRes = await labtechCtx.post(`/api/v1/diagnostic-orders/${order.id}/result`, {
    data: {
      resultValues: [{ parameterName: 'Hemoglobin', value: 5.8, unit: 'g/dL' }],
    },
  });
  expect(resultRes.status(), 'enter result').toBe(201);
  const result = (await resultRes.json()).data as { isCritical: boolean };
  expect(result.isCritical, 'CBC with Hgb 5.8 must be critical').toBe(true);

  // The critical-result flow creates a `critical_alert` task assigned to the
  // ordering physician. Find it.
  const tasksRes = await ctx.get('/api/v1/tasks?status=created');
  expect(tasksRes.status()).toBe(200);
  const createdTasks = (await tasksRes.json()).data as Array<{
    id: string;
    taskType: string;
    assignedTo: string;
    createdAt: string;
  }>;
  // Find the freshest critical_alert task assigned to ordering physician
  const candidates = createdTasks
    .filter((t) => t.taskType === 'critical_alert' && t.assignedTo === orderingPhysicianId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (candidates.length > 0) return candidates[0].id;
  const any = createdTasks
    .filter((t) => t.assignedTo === orderingPhysicianId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (any.length === 0) throw new Error('No created task available for fresh assignment');
  return any[0].id;
}

async function listNotificationsCount(ctx: APIRequestContext, type?: string): Promise<number> {
  const qs = type ? `?notificationType=${type}` : '';
  const res = await ctx.get(`/api/v1/notifications${qs}&pageSize=50`);
  expect(res.status(), 'list notifications').toBe(200);
  const body = await res.json();
  return ((body.meta?.total as number) ?? (body.data as unknown[]).length) as number;
}
