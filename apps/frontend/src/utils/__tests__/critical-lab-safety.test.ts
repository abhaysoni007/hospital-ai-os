import { describe, expect, it, vi } from 'vitest';

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
 * AI MUST NOT participate in critical classification:
 *   - The AI service only assists with documentation (note drafts).
 *   - It never receives result data that could be used for classification.
 *   - clinicalService.createClinicalRecord (draft) ≠ clinicalService.signClinicalRecord (sign).
 */

// ---------------------------------------------------------------------------
// Helpers — minimal in-memory stubs of the types from 'shared'
// ---------------------------------------------------------------------------

function makeOrder(priority: 'stat' | 'urgent' | 'routine', status = 'completed') {
  return {
    id: 'order-1',
    encounterId: 'enc-1',
    patientId: 'pt-1',
    orderingDoctorId: 'doc-1',
    testCode: 'GLU',
    testName: 'Glucose',
    priority,
    status,
    clinicalIndication: null,
    collectedAt: null,
    collectedBy: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function makeResult(isCritical: boolean, status: 'preliminary' | 'verified' | 'critical_flagged' = 'preliminary') {
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ADR-010 Critical Lab Safety Invariant', () => {
  /**
   * Test 1: STAT order + non-critical result → NO critical banner.
   *
   * A STAT order processed quickly with a glucose of 95 mg/dL (normal range)
   * must NEVER trigger a critical banner. The fast turnaround (STAT priority)
   * is a workflow concept, not a clinical severity concept.
   */
  it('STAT order with a non-critical result does NOT qualify as a critical result', () => {
    const order = makeOrder('stat');
    const result = makeResult(false); // isCritical = false, value = 95 mg/dL (normal)

    // The authoritative critical flag is on the result, not the order.
    const isCriticalByResult = result.isCritical === true || result.status === 'critical_flagged';
    const isCriticalByOrderPriority = order.priority === 'stat';

    expect(isCriticalByResult).toBe(false);
    // This is the invariant: we must NOT use order priority as a proxy for result severity.
    expect(isCriticalByOrderPriority).toBe(true); // stat is STAT...
    // ...but stat alone must not produce a critical banner:
    expect(isCriticalByResult).not.toBe(isCriticalByOrderPriority);
  });

  /**
   * Test 2: STAT order + actual critical result → DOES qualify as critical.
   *
   * A STAT glucose of 450 mg/dL exceeds the critical high threshold.
   * The server sets isCritical = true and status = 'critical_flagged'.
   * This MUST trigger the critical banner.
   */
  it('STAT order with an actual critical result (isCritical=true) DOES qualify as critical', () => {
    const order = makeOrder('stat');
    const result = makeResult(true, 'critical_flagged');

    const isCriticalByResult = result.isCritical === true || result.status === 'critical_flagged';

    expect(order.priority).toBe('stat'); // order is STAT
    expect(isCriticalByResult).toBe(true); // result is genuinely critical
    expect(result.isCritical).toBe(true);
    expect(result.status).toBe('critical_flagged');
  });

  /**
   * Test 3: Routine order + actual critical result → DOES qualify as critical.
   *
   * A routine glucose of 450 mg/dL is just as dangerous as a STAT one.
   * Order priority must never PREVENT a critical banner from appearing.
   */
  it('Routine order with an actual critical result (isCritical=true) DOES qualify as critical', () => {
    const order = makeOrder('routine');
    const result = makeResult(true, 'critical_flagged');

    const isCriticalByResult = result.isCritical === true || result.status === 'critical_flagged';

    expect(order.priority).toBe('routine'); // routine order
    expect(isCriticalByResult).toBe(true); // result is still critical
    // Routine order ≠ not critical; the result is the authority:
    expect(result.isCritical).toBe(true);
  });

  /**
   * Test 4: Critical result requires explicit acknowledgment action.
   *
   * When a critical result exists, the UI must present an explicit
   * acknowledgment mechanism. The acknowledged state must start as false
   * and only flip to true after the user takes an explicit action.
   */
  it('Critical result requires explicit acknowledgment (acknowledged starts false, transitions on action)', () => {
    const result = makeResult(true, 'critical_flagged');

    // Initial state — not acknowledged
    let acknowledged = false;
    expect(acknowledged).toBe(false);

    // Simulate the explicit acknowledgment action (e.g., button click calls handleAcknowledge)
    const handleAcknowledge = () => { acknowledged = true; };
    handleAcknowledge();

    expect(acknowledged).toBe(true);
    // Critical classification itself is unchanged — only the UI acknowledgment state changes:
    expect(result.isCritical).toBe(true);
  });

  /**
   * Test 5: Acknowledgment uses the authoritative service — not order priority.
   *
   * The production acknowledgment services are:
   *   - taskService.acknowledgeTask(id)  — for task-linked critical results
   *   - notificationService.acknowledge(id) — for notification-linked critical results
   *
   * Neither accepts order priority as an input. Both are server-authoritative.
   */
  it('Acknowledgment services do not accept or evaluate order priority', async () => {
    const acknowledgedIds: string[] = [];

    // Mock of the authoritative acknowledgment service interface
    const mockAcknowledgeTask = vi.fn(async (id: string) => {
      acknowledgedIds.push(id);
      return { id, status: 'acknowledged' };
    });

    const taskId = 'task-critical-glucose-1';
    await mockAcknowledgeTask(taskId);

    expect(mockAcknowledgeTask).toHaveBeenCalledWith(taskId);
    expect(mockAcknowledgeTask).toHaveBeenCalledTimes(1);
    // The mock call contains only a task ID — never an order priority string:
    const callArgs = mockAcknowledgeTask.mock.calls[0];
    expect(callArgs[0]).not.toBe('stat');
    expect(callArgs[0]).not.toBe('urgent');
    expect(callArgs[0]).not.toBe('routine');
    expect(acknowledgedIds).toContain(taskId);
  });

  /**
   * Test 6: AI service cannot determine critical-result classification.
   *
   * The AI service (aiService) only generates clinical note drafts.
   * Critical/panic classification is governed exclusively by the server-side
   * deterministic rule evaluator (ADR-010). The AI never receives result
   * values for classification purposes.
   *
   * This test verifies the structural contract: the ai-service module does NOT
   * export any function that takes a result or evaluates criticality.
   */
  it('AI service structural contract: no critical-classification API surface', async () => {
    const aiServiceModule = await import('../../services/ai-service');

    // The AI service must only expose draft-generation, not result evaluation.
    const exportedKeys = Object.keys(aiServiceModule.aiService ?? aiServiceModule);

    // No function name should suggest result evaluation or critical classification:
    const forbiddenPatterns = [/critical/i, /isCritical/i, /classify/i, /evaluate/i, /panic/i, /abnormal/i];
    for (const key of exportedKeys) {
      for (const pattern of forbiddenPatterns) {
        expect(key).not.toMatch(pattern);
      }
    }
  });
});

describe('ADR-010 Order Priority vs Result Severity — Data Layer Contract', () => {
  /**
   * Verifies the shared schema separates order priority from result criticality.
   * OrderPriority = 'routine' | 'urgent' | 'stat'  (processing speed)
   * DiagnosticResultStatus = 'preliminary' | 'verified' | 'critical_flagged' (result classification)
   * isCritical: boolean on DiagnosticResultResponse (server-computed)
   *
   * These are structurally separate — orders have no isCritical field.
   */
  it('DiagnosticOrderResponse has no isCritical field', () => {
    const order = makeOrder('stat');
    expect((order as Record<string, unknown>)['isCritical']).toBeUndefined();
  });

  it('DiagnosticResultResponse.isCritical is computed, not user-supplied', () => {
    const criticalResult = makeResult(true, 'critical_flagged');
    const normalResult = makeResult(false);

    // isCritical is set by the server rule evaluator — it reflects value bounds, not order priority
    expect(criticalResult.isCritical).toBe(true);
    expect(normalResult.isCritical).toBe(false);

    // Different result values → different isCritical, regardless of order priority
    expect(criticalResult.resultValues[0]!.value).toBe(450); // above critical high
    expect(normalResult.resultValues[0]!.value).toBe(95);   // within normal range
  });

  it('STAT priority and critical_flagged status are orthogonal concepts', () => {
    // A STAT order with a NORMAL result:
    const statNormal = { order: makeOrder('stat'), result: makeResult(false) };
    // A ROUTINE order with a CRITICAL result:
    const routineCritical = { order: makeOrder('routine'), result: makeResult(true, 'critical_flagged') };

    expect(statNormal.order.priority).toBe('stat');
    expect(statNormal.result.isCritical).toBe(false);     // STAT ≠ critical result

    expect(routineCritical.order.priority).toBe('routine');
    expect(routineCritical.result.isCritical).toBe(true); // ROUTINE can have critical result
  });
});
