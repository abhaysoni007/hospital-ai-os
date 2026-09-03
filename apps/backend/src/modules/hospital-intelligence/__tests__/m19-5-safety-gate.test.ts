import { describe, it, expect } from 'vitest';
import {
  evaluateScenarioA,
  evaluateScenarioB,
  evaluateScenarioC,
  evaluateScenarioD,
  evaluateScenarioE,
  evaluateScenarioF,
  evaluateScenarioG,
  evaluateScenarioH,
  evaluateScenarioI,
  evaluateScenarioJ,
  evaluateScenarioK,
  evaluateScenarioL,
  evaluateScenarioM,
  evaluateScenarioN,
  evaluateSafetyInvariants,
  runFullEvaluationBattery,
} from './m19-5-scenarios';

/**
 * M19.5 — Hospital Intelligence Safety Gate Suite
 * SOURCE OF TRUTH: M19.5 Objective, Scenarios A-N, Invariants 1-10
 *
 * Demonstrates:
 * 1. The three Hospital Intelligence signals are detected correctly.
 * 2. Evidence references are grounded in real records.
 * 3. AI explanations cannot override deterministic signals.
 * 4. Unauthorized users cannot access or act on intelligence.
 * 5. Recommendations remain within the bounded action vocabulary.
 * 6. Human approval remains mandatory for governed actions.
 * 7. AI failure does not destroy deterministic intelligence.
 * 8. Invalid/hallucinated AI citations are rejected or safely degraded.
 * 9. Duplicate approval/execution is safely handled.
 * 10. Failure states are observable and explainable.
 * 11. The system produces measurable evaluation results without fabricated percentages.
 */

describe('M19.5 Hospital Intelligence Safety Gate', () => {
  describe('Required Evaluation Scenarios (A through N)', () => {
    it('Scenario A: Clear bottleneck (PENDING_DIAGNOSTIC_RESULT)', async () => {
      const result = await evaluateScenarioA();
      expect(result.passed).toBe(true);
      expect(result.evidence.signalType).toBe('PENDING_DIAGNOSTIC_RESULT');
      expect(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).toContain(result.evidence.severity);
      expect(result.evidence.orderId).toBeDefined();
      expect(result.evidence.resultEvidenceStatus).toBe('missing');
    });

    it('Scenario B: Critical alert (CRITICAL_RESULT_UNACKNOWLEDGED)', async () => {
      const result = await evaluateScenarioB();
      expect(result.passed).toBe(true);
      expect(result.evidence.signalType).toBe('CRITICAL_RESULT_UNACKNOWLEDGED');
      expect(result.evidence.severity).toBe('CRITICAL');
      expect(result.evidence.notificationId).toBeDefined();
    });

    it('Scenario C: Documentation gap (ENCOUNTER_WITHOUT_CLINICAL_RECORD)', async () => {
      const result = await evaluateScenarioC();
      expect(result.passed).toBe(true);
      expect(result.evidence.encounterId).toBeDefined();
      expect(result.evidence.noteStatus).toBe('missing');
    });

    it('Scenario D: No bottleneck (Honest Zero-State)', async () => {
      const result = await evaluateScenarioD();
      expect(result.passed).toBe(true);
      expect(result.evidence.signalCount).toBe(0);
    });

    it('Scenario E: Multiple bottlenecks (Ranking & Deduplication)', async () => {
      const result = await evaluateScenarioE();
      expect(result.passed).toBe(true);
      expect((result.evidence.types as string[]).length).toBeGreaterThanOrEqual(2);
      expect(result.evidence.uniqueIdCount).toBe(result.evidence.totalSignals);
    });

    it('Scenario F: Insufficient evidence (Explicit Missing State)', async () => {
      const result = await evaluateScenarioF();
      expect(result.passed).toBe(true);
      expect(result.evidence.missingStatus).toBe('missing');
      expect(result.evidence.aiExplanationStatus).toBeNull();
    });

    it('Scenario G: Invalid AI citation (Hallucination Rejection)', async () => {
      const result = await evaluateScenarioG();
      expect(result.passed).toBe(true);
      expect(result.evidence.pipelineStatus).toBe('validation_failed');
    });

    it('Scenario H: AI unavailable (Safe Degradation)', async () => {
      const result = await evaluateScenarioH();
      expect(result.passed).toBe(true);
      expect((result.evidence.networkFailureSignalsPreserved as number)).toBeGreaterThan(0);
      expect((result.evidence.timeoutSignalsPreserved as number)).toBeGreaterThan(0);
      expect((result.evidence.validationFailureSignalsPreserved as number)).toBeGreaterThan(0);
    });

    it('Scenario I: Unauthorized user (RBAC Server Enforcement)', async () => {
      const result = await evaluateScenarioI();
      expect(result.passed).toBe(true);
      expect(result.evidence.policyEvaluationReason).toBe('UNAUTHORIZED_ROLE');
    });

    it('Scenario J: Cross-department access isolation', async () => {
      const result = await evaluateScenarioJ();
      expect(result.passed).toBe(true);
      expect(result.evidence.detectorIsolated).toBe(true);
      expect(result.evidence.policyReasonCode).toBe('CROSS_DEPARTMENT_ACCESS_DENIED');
    });

    it('Scenario K: Forged recommendation / action rejection', async () => {
      const result = await evaluateScenarioK();
      expect(result.passed).toBe(true);
      expect(result.evidence.fakeIdReasonCode).toBe('RECOMMENDATION_NOT_FOUND');
      expect(result.evidence.forgedActionReasonCode).toBe('ACTION_TYPE_NOT_ALLOWLISTED');
    });

    it('Scenario L: Duplicate approval / execution (Idempotency Guard)', async () => {
      const result = await evaluateScenarioL();
      expect(result.passed).toBe(true);
      expect(result.evidence.run1Idempotent).toBe(false);
      expect(result.evidence.run2Idempotent).toBe(true);
      expect(result.evidence.conflictCaught).toBe(true);
    });

    it('Scenario M: Approval without authorization (Direct Execution Bypass)', async () => {
      const result = await evaluateScenarioM();
      expect(result.passed).toBe(true);
      expect(result.evidence.bypassRejected).toBe(true);
    });

    it('Scenario N: Forbidden clinical actions (Bounded Vocabulary Enforcement)', async () => {
      const result = await evaluateScenarioN();
      expect(result.passed).toBe(true);
      const schemaRejections = result.evidence.schemaRejections as boolean[];
      const policyRejections = result.evidence.policyRejections as boolean[];
      expect(schemaRejections.every(Boolean)).toBe(true);
      expect(policyRejections.every(Boolean)).toBe(true);
    });
  });

  describe('Ten Safety Invariants Verification', () => {
    it('verifies all 10 safety invariants evaluate to PASS', async () => {
      const invariants = await evaluateSafetyInvariants();
      expect(invariants).toHaveLength(10);
      for (const inv of invariants) {
        expect(inv.passed).toBe(true);
        expect(inv.verificationMethod).toBeDefined();
      }
    });

    it('Invariant 1: AI cannot create a deterministic signal', async () => {
      const invariants = await evaluateSafetyInvariants();
      const inv1 = invariants.find((i) => i.invariantNumber === 1);
      expect(inv1?.passed).toBe(true);
      expect(inv1?.evidence.aiCallsInDetector).toBe(0);
    });

    it('Invariant 2: AI cannot create evidence', async () => {
      const invariants = await evaluateSafetyInvariants();
      const inv2 = invariants.find((i) => i.invariantNumber === 2);
      expect(inv2?.passed).toBe(true);
      expect(inv2?.evidence.stage4CitationCheck).toBeDefined();
    });

    it('Invariant 3: AI cannot authorize an action', async () => {
      const invariants = await evaluateSafetyInvariants();
      const inv3 = invariants.find((i) => i.invariantNumber === 3);
      expect(inv3?.passed).toBe(true);
      expect(inv3?.evidence.requiresHumanApprovalDefault).toBe(true);
      expect(inv3?.evidence.autonomousExecutionPaths).toBe(0);
    });

    it('Invariant 4: AI cannot bypass RBAC', async () => {
      const invariants = await evaluateSafetyInvariants();
      const inv4 = invariants.find((i) => i.invariantNumber === 4);
      expect(inv4?.passed).toBe(true);
      expect(inv4?.evidence.denyByDefault).toBe(true);
    });

    it('Invariant 5: AI cannot mutate clinical records', async () => {
      const invariants = await evaluateSafetyInvariants();
      const inv5 = invariants.find((i) => i.invariantNumber === 5);
      expect(inv5?.passed).toBe(true);
      expect(inv5?.evidence.clinicalRecordMutations).toBe(0);
    });

    it('Invariant 6: AI failure cannot suppress deterministic operational signals', async () => {
      const invariants = await evaluateSafetyInvariants();
      const inv6 = invariants.find((i) => i.invariantNumber === 6);
      expect(inv6?.passed).toBe(true);
      expect(inv6?.evidence.deterministicSignalLoss).toBe(0);
    });

    it('Invariant 7: Invalid AI grounding cannot become an accepted recommendation', async () => {
      const invariants = await evaluateSafetyInvariants();
      const inv7 = invariants.find((i) => i.invariantNumber === 7);
      expect(inv7?.passed).toBe(true);
      expect(inv7?.evidence.stage4Rejection).toBe(true);
    });

    it('Invariant 8: Duplicate execution cannot produce duplicate mutation', async () => {
      const invariants = await evaluateSafetyInvariants();
      const inv8 = invariants.find((i) => i.invariantNumber === 8);
      expect(inv8?.passed).toBe(true);
      expect(inv8?.evidence.uniqueConstraint).toBe('idx_approved_actions_idempotency');
    });

    it('Invariant 9: Break-glass does not become an AI authorization mechanism', async () => {
      const invariants = await evaluateSafetyInvariants();
      const inv9 = invariants.find((i) => i.invariantNumber === 9);
      expect(inv9?.passed).toBe(true);
      expect(inv9?.evidence.bypassForbidden).toBe(true);
    });

    it('Invariant 10: Audit records remain server-generated and cannot be modified by AI output', async () => {
      const invariants = await evaluateSafetyInvariants();
      const inv10 = invariants.find((i) => i.invariantNumber === 10);
      expect(inv10?.passed).toBe(true);
      expect(inv10?.evidence.hashChainAlgorithm).toBe('SHA-256');
    });
  });

  describe('Measured Evaluation Battery Integration', () => {
    it('executes full evaluation battery and computes mathematically honest metrics', async () => {
      const report = await runFullEvaluationBattery();

      expect(report.summary.totalScenarios).toBe(14);
      expect(report.summary.passedScenarios).toBe(14);
      expect(report.summary.failedScenarios).toBe(0);
      expect(report.summary.totalInvariants).toBe(10);
      expect(report.summary.passedInvariants).toBe(10);

      // Verify each metric entry has exact non-fabricated numerator, denominator, and rate
      for (const [, metric] of Object.entries(report.metrics)) {
        expect(metric.denominator).toBeGreaterThan(0);
        expect(metric.numerator).toBeLessThanOrEqual(metric.denominator);
        expect(metric.rate).toBe(metric.numerator / metric.denominator);
        expect(metric.percentageString).toMatch(/^\d+\.\d+%$/);
      }
    });
  });
});
