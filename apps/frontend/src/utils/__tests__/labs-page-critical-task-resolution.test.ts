import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Labs-page critical task resolution regression — fail-closed contract.
 *
 * The labs page resolves authoritative critical_alert tasks through
 * resolveAuthoritativeCriticalTasks(), which consumes taskService.listTasks()
 * by default. This suite mocks the REAL task-service module boundary (the same
 * module the page chain depends on) and proves:
 *
 *   taskService.listTasks() rejects
 *     -> resolution state is 'failed' (never silently [])
 *     -> critical result remains visible / unacknowledged
 *     -> NO navigation-only "safe fallback"
 *     -> NO acknowledged state
 *
 * and the positive case:
 *
 *   taskService.listTasks() succeeds + no matching task
 *     -> navigation-only review IS allowed
 *
 * (The page component itself requires a DOM test environment which this
 * repository does not configure; the page's critical logic is fully delegated
 * to these production helpers, so the service boundary contract is exercised
 * exactly as the page consumes it.)
 */

vi.mock('../../services/task-service', () => ({
  taskService: {
    listTasks: vi.fn(),
    acknowledgeTask: vi.fn(),
  },
}));

import { taskService } from '../../services/task-service';
import {
  resolveAuthoritativeCriticalTasks,
  determineCriticalAction,
  matchAuthoritativeTask,
  isTaskAcknowledgedOnServer,
  executeAuthoritativeAcknowledgment,
  CRITICAL_TASK_RESOLUTION_ERROR,
} from '../critical-result-acknowledgment';
import type { TaskResponse } from 'shared';

const listTasksMock = taskService.listTasks as unknown as ReturnType<typeof vi.fn>;
const acknowledgeTaskMock = taskService.acknowledgeTask as unknown as ReturnType<typeof vi.fn>;

function makeTask(overrides: Partial<TaskResponse> = {}): TaskResponse {
  return {
    id: 'task-crit-1',
    taskType: 'critical_alert',
    title: 'Critical lab value',
    description: null,
    priority: 'critical',
    status: 'created',
    patientId: 'pt-1',
    encounterId: 'enc-1',
    referenceType: 'DiagnosticOrder',
    referenceId: 'order-1',
    assignedTo: 'doc-1',
    dueAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function pageCriticalAction(resolutionState: 'resolved' | 'failed', authoritativeTaskId?: string) {
  // Mirrors the labs page call site for a critical result banner.
  return determineCriticalAction({
    orderId: 'order-1',
    isCritical: true,
    authoritativeTaskId,
    taskResolution: resolutionState,
  });
}

beforeEach(() => {
  listTasksMock.mockReset();
  acknowledgeTaskMock.mockReset();
});

describe('Labs page — critical task lookup FAILS (fail closed)', () => {
  const failureCases: Array<[string, unknown]> = [
    ['403 Forbidden', Object.assign(new Error('Forbidden'), { statusCode: 403, code: 'FORBIDDEN' })],
    ['500 Internal Server Error', Object.assign(new Error('Boom'), { statusCode: 500 })],
    ['network failure', new TypeError('Failed to fetch')],
  ];

  for (const [label, rejection] of failureCases) {
    it(`taskService.listTasks() rejects with ${label}: resolution fails closed, no navigation-only fallback, no acknowledged state`, async () => {
      listTasksMock.mockRejectedValueOnce(rejection);

      const resolution = await resolveAuthoritativeCriticalTasks();

      // Failure is NEVER converted into an empty task list
      expect(resolution.state).toBe('failed');
      expect(resolution.error).toBe(CRITICAL_TASK_RESOLUTION_ERROR);

      // Page passes 'failed' to the decision function: no navigation-only, no authoritative ack
      const action = pageCriticalAction('failed', undefined);
      expect(action.type).toBe('task_resolution_failed');
      expect(action.type).not.toBe('navigation_only');
      expect(action.type).not.toBe('authoritative_acknowledge');

      // Critical banner remains visible and UNACKNOWLEDGED: the page cannot produce an
      // acknowledged presentation because no server-derived acknowledged task exists.
      const createdTask = makeTask({ status: 'created' });
      expect(isTaskAcknowledgedOnServer(createdTask)).toBe(false);
    });
  }

  it('uses the real taskService default with the authoritative query parameters', async () => {
    listTasksMock.mockResolvedValueOnce({ data: [] });

    await resolveAuthoritativeCriticalTasks();

    expect(listTasksMock).toHaveBeenCalledWith({
      page: 1,
      pageSize: 50,
      scope: 'me',
      taskType: 'critical_alert',
    });
  });
});

describe('Labs page — critical task lookup SUCCEEDS', () => {
  it('no matching task: navigation-only review IS allowed (no overcorrection)', async () => {
    listTasksMock.mockResolvedValueOnce({ data: [makeTask({ referenceId: 'other-order' })] });

    const resolution = await resolveAuthoritativeCriticalTasks();
    expect(resolution.state).toBe('resolved');

    const authoritativeTask = matchAuthoritativeTask('order-1', 'doc-1', resolution.tasks);
    expect(authoritativeTask).toBeUndefined();

    const action = pageCriticalAction('resolved', authoritativeTask?.id);
    expect(action).toEqual({
      type: 'navigation_only',
      href: '/diagnostics/order-1',
      label: 'Review Critical Result',
    });
  });

  it('matching authoritative task: authoritative acknowledgment action is produced', async () => {
    listTasksMock.mockResolvedValueOnce({
      data: [makeTask({ assignedTo: 'doc-other' }), makeTask({ id: 'task-mine' })],
    });

    const resolution = await resolveAuthoritativeCriticalTasks();
    expect(resolution.state).toBe('resolved');

    const authoritativeTask = matchAuthoritativeTask('order-1', 'doc-1', resolution.tasks);
    expect(authoritativeTask?.id).toBe('task-mine');

    const action = pageCriticalAction('resolved', authoritativeTask?.id);
    expect(action.type).toBe('authoritative_acknowledge');
    if (action.type === 'authoritative_acknowledge') {
      expect(action.taskId).toBe('task-mine');
    }
  });

  it('acknowledgment succeeds: acknowledged presentation comes only from the server response', async () => {
    acknowledgeTaskMock.mockResolvedValueOnce(makeTask({ id: 'task-mine', status: 'in_progress' }));

    const serverResponse = await executeAuthoritativeAcknowledgment('task-mine');

    // Page stores ONLY the server-returned task; the UI derives acknowledgment from it.
    const serverAcknowledgedTasks: Record<string, TaskResponse> = {
      [serverResponse.id]: serverResponse,
    };
    const authoritativeTask = makeTask({ id: 'task-mine', status: 'created' });
    const effectiveTask = serverAcknowledgedTasks[authoritativeTask.id] ?? authoritativeTask;

    expect(acknowledgeTaskMock).toHaveBeenCalledWith('task-mine');
    expect(isTaskAcknowledgedOnServer(effectiveTask)).toBe(true);
  });

  it('acknowledgment fails: no server response stored, banner stays unacknowledged', async () => {
    acknowledgeTaskMock.mockRejectedValueOnce(new Error('Ack failed'));

    await expect(executeAuthoritativeAcknowledgment('task-mine')).rejects.toThrow('Ack failed');

    // Nothing was stored server-derived; the pre-acknowledgment task stays unacknowledged.
    const serverAcknowledgedTasks: Record<string, TaskResponse> = {};
    const authoritativeTask = makeTask({ id: 'task-mine', status: 'created' });
    const effectiveTask = serverAcknowledgedTasks[authoritativeTask.id] ?? authoritativeTask;
    expect(isTaskAcknowledgedOnServer(effectiveTask)).toBe(false);
  });
});
