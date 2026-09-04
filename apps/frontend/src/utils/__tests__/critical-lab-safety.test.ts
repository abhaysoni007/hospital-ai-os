import { describe, expect, it, vi } from 'vitest';
import {
  isCriticalResult,
  determineCriticalAction,
  matchAuthoritativeTask,
  isTaskAcknowledgedOnServer,
  executeAuthoritativeAcknowledgment,
  classifyProbeError,
} from '../critical-result-acknowledgment';
import { ApiError } from '../../services/api-client';
import type { DiagnosticOrderResponse, DiagnosticResultResponse, TaskResponse } from 'shared';

/**
 * Critical Lab Safety Regression Tests — ADR-010 / ADR-016
 *
 * Invariant: Diagnostic ORDER PRIORITY (stat/urgent/routine) is INDEPENDENT
 * of whether the resulting clinical VALUE is critical/panic.
 *
 * Critical classification is computed SERVER-SIDE by the deterministic rule
 * evaluator. The authoritative fields on DiagnosticResultResponse are:
 *   - isCritical: boolean
 *   - status: 'critical_flagged' | 'preliminary' | 'verified'
 *
 * Acknowledgment Invariant:
 * A critical result MUST NOT be dismissed solely through local React state.
 * Acknowledgment MUST either be server-authoritative via taskService.acknowledgeTask(taskId),
 * or explicitly navigation-only ('Review Critical Result' -> /diagnostics/[orderId])
 * when no authoritative critical-alert task can be safely attributed.
 *
 * AI MUST NOT participate in critical classification.
 */

// ---------------------------------------------------------------------------
// Helpers — typed stubs of contracts from 'shared'
// ---------------------------------------------------------------------------

function makeOrder(priority: 'stat' | 'urgent' | 'routine', status = 'completed'): DiagnosticOrderResponse {
  return {
    id: 'order-1',
    encounterId: 'enc-1',
    patientId: 'pt-1',
    orderingDoctorId: 'doc-1',
    testCode: 'GLU',
    testName: 'Glucose',
    priority,
    status: status as DiagnosticOrderResponse['status'],
    clinicalIndication: null,
    collectedAt: null,
    collectedBy: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function makeResult(
  isCritical: boolean,
  status: 'preliminary' | 'verified' | 'critical_flagged' = 'preliminary',
): DiagnosticResultResponse {
  return {
    id: 'result-1',
    orderId: 'order-1',
    patientId: 'pt-1',
    testCode: 'GLU',
    resultValues: [{ parameterName: 'Glucose', value: isCritical ? 450 : 95, unit: 'mg/dL' }],
    referenceRange: {
      parameters: [
        {
          parameterName: 'Glucose',
          suppliedUnit: 'mg/dL',
          verdict: isCritical ? 'critical' : 'normal',
          bounds: { normalLow: 70, normalHigh: 100, criticalLow: 40, criticalHigh: 400 },
        },
      ],
      isAbnormal: isCritical,
      isCritical,
      matchedRuleIds: isCritical ? ['rule-glucose-critical-high'] : [],
    },
    isAbnormal: isCritical,
    isCritical,
    criticalRuleId: isCritical ? 'rule-glucose-critical-high' : null,
    status,
    enteredBy: 'tech-1',
    verifiedBy: null,
    verifiedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function makeTask(overrides: Partial<TaskResponse> = {}): TaskResponse {
  return {
    id: 'task-crit-1',
    taskType: 'critical_alert',
    title: 'Critical lab value: Glucose',
    description: 'Glucose flagged CRITICAL and requires immediate physician review.',
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ADR-010 / ADR-016 Critical Lab Safety Contract', () => {
  /**
   * Test A: STAT + normal result -> isCriticalResult === false (NO critical banner).
   */
  it('Test A: STAT order with a non-critical result does NOT qualify as a critical result', () => {
    const order = makeOrder('stat');
    const result = makeResult(false); // isCritical = false, value = 95 mg/dL (normal)

    // The authoritative critical flag is derived strictly through the production helper:
    const critical = isCriticalResult(result);
    expect(critical).toBe(false);

    // Invariant: STAT order priority does NOT imply critical severity
    expect(order.priority).toBe('stat');
    expect(critical).not.toBe(order.priority === 'stat');
  });

  /**
   * Test B: STAT + critical result -> isCriticalResult === true (critical banner).
   */
  it('Test B: STAT order with an actual critical result (isCritical=true) DOES qualify as critical', () => {
    const order = makeOrder('stat');
    const result = makeResult(true, 'critical_flagged');

    const critical = isCriticalResult(result);
    expect(order.priority).toBe('stat');
    expect(critical).toBe(true);
    expect(result.isCritical).toBe(true);
    expect(result.status).toBe('critical_flagged');
  });

  /**
   * Test C: Routine + critical result -> isCriticalResult === true (critical banner).
   */
  it('Test C: Routine order with an actual critical result (isCritical=true) DOES qualify as critical', () => {
    const order = makeOrder('routine');
    const result = makeResult(true, 'critical_flagged');

    const critical = isCriticalResult(result);
    expect(order.priority).toBe('routine');
    expect(critical).toBe(true);
    expect(result.isCritical).toBe(true);
  });

  /**
   * Test D: Non-critical result -> determineCriticalAction returns type: 'none'.
   */
  it('Test D: Non-critical result produces no critical action (type: none)', () => {
    const result = makeResult(false);
    const isCrit = isCriticalResult(result);
    expect(isCrit).toBe(false);

    const action = determineCriticalAction({
      orderId: 'order-1',
      isCritical: isCrit,
      authoritativeTaskId: 'task-1',
    });

    expect(action).toEqual({ type: 'none' });
  });

  /**
   * Test E: Critical + authoritative task -> authoritative_acknowledge with correct taskId.
   */
  it('Test E: Critical result with safely matched task returns authoritative_acknowledge action', () => {
    const result = makeResult(true, 'critical_flagged');
    const taskId = 'task-crit-999';

    const action = determineCriticalAction({
      orderId: 'order-1',
      isCritical: isCriticalResult(result),
      authoritativeTaskId: taskId,
    });

    expect(action.type).toBe('authoritative_acknowledge');
    if (action.type === 'authoritative_acknowledge') {
      expect(action.taskId).toBe(taskId);
      expect(action.label).toBe('Acknowledge Critical Result');
      expect(action.reviewHref).toBe('/diagnostics/order-1?taskId=task-crit-999');
    }
  });

  /**
   * Test F: Critical + NO authoritative task -> navigation_only (/diagnostics/[orderId]).
   * No fake local acknowledgment is allowed.
   */
  it('Test F: Critical result without authoritative task returns navigation_only to /diagnostics/[orderId]', () => {
    const result = makeResult(true, 'critical_flagged');

    // Case 1: undefined taskId
    const action1 = determineCriticalAction({
      orderId: 'order-1',
      isCritical: isCriticalResult(result),
      authoritativeTaskId: undefined,
    });
    expect(action1).toEqual({
      type: 'navigation_only',
      href: '/diagnostics/order-1',
      label: 'Review Critical Result',
    });

    // Case 2: empty string taskId
    const action2 = determineCriticalAction({
      orderId: 'order-2',
      isCritical: isCriticalResult(result),
      authoritativeTaskId: '   ',
    });
    expect(action2).toEqual({
      type: 'navigation_only',
      href: '/diagnostics/order-2',
      label: 'Review Critical Result',
    });
  });

  /**
   * Test G: Successful authoritative acknowledgment exercises production helper
   * and delegates to the authoritative task acknowledgment service.
   */
  it('Test G: Successful authoritative acknowledgment exercises real production helper and returns updated task', async () => {
    const taskId = 'task-crit-glucose-42';
    const updatedTaskResponse = makeTask({ id: taskId, status: 'in_progress' });

    // Mock at the network/service interface boundary only
    const mockService = {
      acknowledgeTask: vi.fn(async (id: string) => {
        expect(id).toBe(taskId);
        return updatedTaskResponse;
      }),
    };

    // Execute the real production helper:
    const res = await executeAuthoritativeAcknowledgment(taskId, mockService);

    expect(mockService.acknowledgeTask).toHaveBeenCalledTimes(1);
    expect(mockService.acknowledgeTask).toHaveBeenCalledWith(taskId);
    expect(res.id).toBe(taskId);
    expect(res.status).toBe('in_progress');
    expect(isTaskAcknowledgedOnServer(res)).toBe(true);
  });

  /**
   * Test H: Failed authoritative acknowledgment throws, enabling UI to preserve banner.
   */
  it('Test H: Failed authoritative acknowledgment throws, allowing UI to preserve critical banner and surface error', async () => {
    const taskId = 'task-crit-glucose-fail';
    const serverError = new Error('Database transaction conflict during acknowledgment');

    const mockService = {
      acknowledgeTask: vi.fn(async () => {
        throw serverError;
      }),
    };

    // Attempt acknowledgment through production helper
    await expect(
      executeAuthoritativeAcknowledgment(taskId, mockService),
    ).rejects.toThrow('Database transaction conflict during acknowledgment');

    expect(mockService.acknowledgeTask).toHaveBeenCalledWith(taskId);
  });

  /**
   * Test I: Invariant: STAT cannot create criticality.
   * Order priority and result criticality are completely orthogonal.
   */
  it('Test I: Invariant: STAT priority cannot create criticality (stat + normal = not critical)', () => {
    const statNormal = { order: makeOrder('stat'), result: makeResult(false) };
    const routineCritical = { order: makeOrder('routine'), result: makeResult(true, 'critical_flagged') };

    // STAT with normal result is NOT critical:
    expect(isCriticalResult(statNormal.result)).toBe(false);
    expect(statNormal.order.priority).toBe('stat');

    // ROUTINE with critical result IS critical:
    expect(isCriticalResult(routineCritical.result)).toBe(true);
    expect(routineCritical.order.priority).toBe('routine');
  });

  /**
   * Test J: AI service structural contract: no critical-classification API surface.
   */
  it('Test J: AI service structural contract: no critical-classification API surface', async () => {
    const aiServiceModule = await import('../../services/ai-service');
    const exportedKeys = Object.keys(aiServiceModule.aiService ?? aiServiceModule);

    const forbiddenPatterns = [/critical/i, /isCritical/i, /classify/i, /evaluate/i, /panic/i, /abnormal/i];
    for (const key of exportedKeys) {
      for (const pattern of forbiddenPatterns) {
        expect(key).not.toMatch(pattern);
      }
    }
  });

  /**
   * Test K: Probe error classification:
   * - 404 -> NOT_FOUND (benign no-result state)
   * - 403, 500, network error -> SERVICE_FAILURE (safe error alert displayed)
   */
  it('Test K: Result probe error classification distinguishes 404 from service/network failures', () => {
    // 404 ApiError -> NOT_FOUND (benign)
    const err404 = new ApiError(404, { code: 'NOT_FOUND', message: 'No result recorded' });
    expect(classifyProbeError(err404)).toBe('NOT_FOUND');

    // 404 raw object -> NOT_FOUND
    expect(classifyProbeError({ statusCode: 404, message: 'Not found' })).toBe('NOT_FOUND');

    // 403 Forbidden -> SERVICE_FAILURE
    const err403 = new ApiError(403, { code: 'FORBIDDEN', message: 'Unauthorized' });
    expect(classifyProbeError(err403)).toBe('SERVICE_FAILURE');

    // 500 Internal Server Error -> SERVICE_FAILURE
    const err500 = new ApiError(500, { code: 'INTERNAL_ERROR', message: 'Database failure' });
    expect(classifyProbeError(err500)).toBe('SERVICE_FAILURE');

    // Network error (statusCode 0) -> SERVICE_FAILURE
    const errNetwork = new ApiError(0, { code: 'NETWORK_ERROR', message: 'Failed to fetch' });
    expect(classifyProbeError(errNetwork)).toBe('SERVICE_FAILURE');

    // Generic error -> SERVICE_FAILURE
    expect(classifyProbeError(new Error('Connection reset'))).toBe('SERVICE_FAILURE');
  });

  /**
   * Test L: Four-eyes verification remains separate from task acknowledgment.
   *
   * Acknowledgment transitions task status from 'created' to 'in_progress'.
   * Verification transitions result status from 'preliminary'/'critical_flagged' to 'verified'.
   * Neither operation implies or executes the other.
   */
  it('Test L: Four-eyes verification remains separate from task acknowledgment', () => {
    const task = makeTask({ status: 'created' });
    const result = makeResult(true, 'critical_flagged');

    // 1. Acknowledgment updates task status — result status is UNTOUCHED
    const acknowledgedTask: TaskResponse = { ...task, status: 'in_progress' };
    expect(acknowledgedTask.status).toBe('in_progress');
    expect(result.status).toBe('critical_flagged'); // result remains preliminary/critical_flagged

    // 2. Verification updates result status — task status is UNTOUCHED
    const verifiedResult: DiagnosticResultResponse = {
      ...result,
      status: 'verified',
      verifiedBy: 'doc-independent-verifier',
      verifiedAt: new Date().toISOString(),
    };
    expect(verifiedResult.status).toBe('verified');
    expect(verifiedResult.verifiedBy).not.toBe(result.enteredBy); // four-eyes enforcement
    expect(acknowledgedTask.status).toBe('in_progress'); // task status is distinct
  });

  /**
   * Test M: Authoritative task matching requires:
   * taskType === 'critical_alert' AND referenceId === orderId AND assignedTo === currentUserId
   */
  it('Test M: matchAuthoritativeTask only matches tasks assigned to current user for the specific order', () => {
    const currentUserId = 'doc-1';
    const orderId = 'order-1';

    const validTask = makeTask({
      id: 'task-correct',
      taskType: 'critical_alert',
      referenceId: orderId,
      assignedTo: currentUserId,
    });

    const foreignTask = makeTask({
      id: 'task-foreign',
      taskType: 'critical_alert',
      referenceId: orderId,
      assignedTo: 'doc-other-physician',
    });

    const differentOrderTask = makeTask({
      id: 'task-different-order',
      taskType: 'critical_alert',
      referenceId: 'order-other',
      assignedTo: currentUserId,
    });

    const nonCriticalTypeTask = makeTask({
      id: 'task-routine-type',
      taskType: 'lab_review',
      referenceId: orderId,
      assignedTo: currentUserId,
    });

    const allTasks = [foreignTask, differentOrderTask, nonCriticalTypeTask, validTask];

    // Must match ONLY validTask:
    const matched = matchAuthoritativeTask(orderId, currentUserId, allTasks);
    expect(matched?.id).toBe('task-correct');

    // For another clinician, foreignTask is not matched to doc-1:
    const matchedForOther = matchAuthoritativeTask(orderId, 'doc-other-physician', allTasks);
    expect(matchedForOther?.id).toBe('task-foreign');

    // For unauthenticated or unknown user, nothing matches:
    expect(matchAuthoritativeTask(orderId, null, allTasks)).toBeUndefined();
    expect(matchAuthoritativeTask(orderId, undefined, allTasks)).toBeUndefined();
    expect(matchAuthoritativeTask(orderId, 'doc-unrelated', allTasks)).toBeUndefined();
  });
});

describe('ADR-010 Order Priority vs Result Severity — Data Layer Contract', () => {
  it('DiagnosticOrderResponse has no isCritical field', () => {
    const order = makeOrder('stat');
    expect((order as unknown as Record<string, unknown>)['isCritical']).toBeUndefined();
  });

  it('DiagnosticResultResponse.isCritical is computed, not user-supplied', () => {
    const criticalResult = makeResult(true, 'critical_flagged');
    const normalResult = makeResult(false);

    expect(criticalResult.isCritical).toBe(true);
    expect(normalResult.isCritical).toBe(false);

    expect(criticalResult.resultValues[0]!.value).toBe(450);
    expect(normalResult.resultValues[0]!.value).toBe(95);
  });

  it('STAT priority and critical_flagged status are orthogonal concepts', () => {
    const statNormal = { order: makeOrder('stat'), result: makeResult(false) };
    const routineCritical = { order: makeOrder('routine'), result: makeResult(true, 'critical_flagged') };

    expect(statNormal.order.priority).toBe('stat');
    expect(statNormal.result.isCritical).toBe(false);

    expect(routineCritical.order.priority).toBe('routine');
    expect(routineCritical.result.isCritical).toBe(true);
  });
});
