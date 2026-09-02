import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { taskService } from '../task-service';
import type { TaskResponse } from 'shared';

/**
 * M17 — task service contract.
 *
 * Scope selection and the reassign/escalate actions MUST reach the backend:
 * the M17 tasks workspace previously dropped the `scope` query param (all
 * three queue tabs fetched identical data) and called reassign/escalate via
 * raw ad-hoc client requests outside the service layer.
 */

const task: TaskResponse = {
  id: '11111111-1111-1111-1111-111111111111',
  taskType: 'lab_review',
  title: 'Review critical result',
  priority: 'critical',
  status: 'created',
  patientId: null,
  encounterId: null,
  referenceType: null,
  referenceId: null,
  assignedTo: null,
  dueAt: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

describe('taskService (M17 scope + workflow actions)', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ data: task }),
      })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('forwards the selected scope to the backend', async () => {
    let capturedUrl = '';
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: RequestInfo | URL) => {
        capturedUrl = String(url);
        return { ok: true, status: 200, json: async () => ({ data: [task] }) };
      }),
    );

    await taskService.listTasks({ page: 1, pageSize: 100, scope: 'department' });
    expect(capturedUrl).toContain('scope=department');
  });

  it('omits the scope param when not requested (backend default)', async () => {
    let capturedUrl = '';
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: RequestInfo | URL) => {
        capturedUrl = String(url);
        return { ok: true, status: 200, json: async () => ({ data: [task] }) };
      }),
    );

    await taskService.listTasks({ page: 1, pageSize: 100 });
    expect(capturedUrl).not.toContain('scope=');
  });

  it('reassign posts newAssigneeId to the reassign endpoint', async () => {
    let capturedUrl = '';
    let capturedMethod = '';
    let capturedBody = '';
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
        capturedUrl = String(url);
        capturedMethod = init?.method ?? '';
        capturedBody = String(init?.body ?? '');
        // The task controller responds with the bare task (no envelope).
        return { ok: true, status: 200, json: async () => task };
      }),
    );

    const assigneeId = '22222222-2222-2222-2222-222222222222';
    const res = await taskService.reassignTask(task.id, assigneeId);
    expect(res.id).toBe(task.id);
    expect(capturedUrl).toContain(`/tasks/${task.id}/reassign`);
    expect(capturedMethod).toBe('POST');
    expect(capturedBody).toContain(assigneeId);
  });

  it('escalate posts to the escalate endpoint with no body fields', async () => {
    let capturedUrl = '';
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
        capturedUrl = String(url);
        expect(init?.method).toBe('POST');
        return { ok: true, status: 200, json: async () => task };
      }),
    );

    await taskService.escalateTask(task.id);
    expect(capturedUrl).toContain(`/tasks/${task.id}/escalate`);
  });
});
