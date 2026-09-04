/**
 * Critical Result Acknowledgment & Safety Utility — ADR-010 / ADR-016
 *
 * Enforces clinical safety invariants:
 * 1. Result criticality is derived EXCLUSIVELY from server-computed DiagnosticResultResponse
 *    (isCritical === true OR status === 'critical_flagged').
 *    Order priority (stat/urgent/routine) is NEVER inspected or conflated with result severity.
 * 2. Critical result acknowledgment MUST be server-authoritative via taskService.acknowledgeTask(taskId).
 *    A critical result MUST NEVER disappear solely because a local React state variable changed.
 * 3. When the task lookup RESOLVES and no authoritative task can be safely identified
 *    (e.g. current user is not the assigned physician), the action is strictly
 *    navigation-only ('Review Critical Result' -> /diagnostics/[orderId]).
 *    No fake local dismissal is ever presented.
 *    If the task lookup FAILS (403/500/network/malformed), the action fails closed
 *    ('task_resolution_failed') — unknown task state is never treated as absent task state.
 * 4. Probe errors distinguish benign 404 (no result yet) from 403/500/network service failures.
 */

import type { DiagnosticResultResponse, TaskListResponse, TaskResponse } from 'shared';
import { taskService } from '../services/task-service';
import { ApiError } from '../services/api-client';

export type CriticalAction =
  | { type: 'none' }
  | {
      type: 'authoritative_acknowledge';
      taskId: string;
      label: string;
      reviewHref: string;
    }
  | {
      type: 'navigation_only';
      href: string;
      label: string;
    }
  | { type: 'task_resolution_failed' };

/**
 * Resolution state of the authoritative critical-alert task lookup.
 *
 * 'failed' means the lookup itself errored (403/500/network/malformed response).
 * Unknown task state is NOT equivalent to absent task state, so a failed lookup
 * MUST NEVER be treated as "no matching task" (navigation-only).
 */
export type CriticalTaskResolutionState = 'loading' | 'resolved' | 'failed';

export const CRITICAL_TASK_RESOLUTION_ERROR =
  'Critical result acknowledgment status could not be verified. Please retry or review the associated task.';

export interface CriticalTaskResolution {
  state: CriticalTaskResolutionState;
  /** Populated only when state === 'resolved'; empty on failure. */
  tasks: TaskResponse[];
  error?: string;
}

export interface CriticalTaskListService {
  listTasks(query: {
    page: number;
    pageSize: number;
    scope: 'me';
    taskType: 'critical_alert';
  }): Promise<TaskListResponse>;
}

/**
 * Resolves the current clinician's authoritative critical_alert tasks.
 *
 * Fail-safe semantics:
 * - Successful response with a usable `data` array -> { state: 'resolved', tasks }.
 * - 403 / 500 / network / malformed response -> { state: 'failed', error }.
 * A failure is NEVER converted into an empty task list.
 */
export async function resolveAuthoritativeCriticalTasks(
  service: CriticalTaskListService = taskService,
): Promise<CriticalTaskResolution> {
  try {
    const res = await service.listTasks({
      page: 1,
      pageSize: 50,
      scope: 'me',
      taskType: 'critical_alert',
    });
    if (!res || typeof res !== 'object' || !Array.isArray(res.data)) {
      return { state: 'failed', tasks: [], error: CRITICAL_TASK_RESOLUTION_ERROR };
    }
    return { state: 'resolved', tasks: res.data };
  } catch {
    return { state: 'failed', tasks: [], error: CRITICAL_TASK_RESOLUTION_ERROR };
  }
}

/**
 * Evaluates whether a diagnostic result is critical.
 *
 * Invariant: Derived exclusively from the server-computed authoritative fields
 * on DiagnosticResultResponse. Order priority MUST NOT be accepted or evaluated.
 */
export function isCriticalResult(
  result: Pick<DiagnosticResultResponse, 'isCritical' | 'status'> | null | undefined,
): boolean {
  if (!result) return false;
  return result.isCritical === true || result.status === 'critical_flagged';
}

/**
 * Safely matches an authoritative critical alert task to a diagnostic order.
 *
 * Criteria:
 * - taskType === 'critical_alert'
 * - referenceId === orderId
 * - task is assigned to the current authenticated user (assignedTo === currentUserId)
 *
 * Tasks assigned to other clinicians or unrelated orders are NEVER matched.
 */
export function matchAuthoritativeTask(
  orderId: string,
  currentUserId: string | null | undefined,
  tasks: TaskResponse[],
): TaskResponse | undefined {
  if (!orderId || !currentUserId || !tasks || tasks.length === 0) {
    return undefined;
  }

  return tasks.find(
    (t) =>
      t.taskType === 'critical_alert' &&
      t.referenceId === orderId &&
      t.assignedTo === currentUserId,
  );
}

/**
 * Checks whether an authoritative critical alert task has already been acknowledged
 * on the server (status is in_progress or completed).
 */
export function isTaskAcknowledgedOnServer(task: TaskResponse | null | undefined): boolean {
  if (!task) return false;
  return task.status === 'in_progress' || task.status === 'completed';
}

export interface DetermineActionParams {
  orderId: string;
  isCritical: boolean;
  authoritativeTaskId?: string | null;
  /**
   * Outcome of the authoritative task lookup. Required so callers cannot
   * silently treat a failed lookup as "no task exists".
   */
  taskResolution: Exclude<CriticalTaskResolutionState, 'loading'>;
}

/**
 * Pure decision function determining the clinical action for a critical result.
 *
 * - Non-critical: { type: 'none' }
 * - Critical + failed task lookup: { type: 'task_resolution_failed' } — fail closed;
 *   NEVER navigation-only, NEVER presented as acknowledged.
 * - Critical + authoritative task ID: { type: 'authoritative_acknowledge', taskId, label, reviewHref }
 * - Critical + resolved lookup with no authoritative task ID: { type: 'navigation_only', href, label: 'Review Critical Result' }
 */
export function determineCriticalAction({
  orderId,
  isCritical,
  authoritativeTaskId,
  taskResolution,
}: DetermineActionParams): CriticalAction {
  if (!isCritical) {
    return { type: 'none' };
  }

  if (taskResolution === 'failed') {
    return { type: 'task_resolution_failed' };
  }

  if (authoritativeTaskId && authoritativeTaskId.trim().length > 0) {
    return {
      type: 'authoritative_acknowledge',
      taskId: authoritativeTaskId,
      label: 'Acknowledge Critical Result',
      reviewHref: `/diagnostics/${orderId}?taskId=${authoritativeTaskId}`,
    };
  }

  return {
    type: 'navigation_only',
    href: `/diagnostics/${orderId}`,
    label: 'Review Critical Result',
  };
}

export interface TaskAcknowledgmentService {
  acknowledgeTask(id: string): Promise<TaskResponse>;
}

/**
 * Executes a server-authoritative task acknowledgment.
 * Calls taskService.acknowledgeTask(taskId) and returns the updated task.
 * Throws on failure so callers can retain critical banners and display error alerts.
 */
export async function executeAuthoritativeAcknowledgment(
  taskId: string,
  service: TaskAcknowledgmentService = taskService,
): Promise<TaskResponse> {
  if (!taskId || taskId.trim().length === 0) {
    throw new Error('Cannot acknowledge critical result without an authoritative task ID.');
  }

  return await service.acknowledgeTask(taskId);
}

export type ProbeErrorKind = 'NOT_FOUND' | 'SERVICE_FAILURE';

/**
 * Classifies result-probe errors.
 * 404 (NOT_FOUND) is benign because completed orders may not have entered results yet.
 * 403, 500, network errors (status 0), and unknown rejections are SERVICE_FAILURE
 * and must be surfaced so clinicians are not misled into believing no critical results exist.
 */
export function classifyProbeError(error: unknown): ProbeErrorKind {
  if (error instanceof ApiError) {
    if (error.statusCode === 404 || error.code === 'NOT_FOUND') {
      return 'NOT_FOUND';
    }
    return 'SERVICE_FAILURE';
  }

  if (typeof error === 'object' && error !== null) {
    const errObj = error as { statusCode?: number; code?: string; status?: number };
    if (
      errObj.statusCode === 404 ||
      errObj.status === 404 ||
      errObj.code === 'NOT_FOUND' ||
      errObj.code === 'RESULT_NOT_FOUND'
    ) {
      return 'NOT_FOUND';
    }
  }

  return 'SERVICE_FAILURE';
}
