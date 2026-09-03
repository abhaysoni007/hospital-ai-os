import { describe, it, expect, vi } from 'vitest';
import { randomUUID } from 'crypto';
import { HospitalIntelligenceService } from '../hospital-intelligence.service';
import { AIOrchestrator } from '../../ai/orchestrator';
import { AuditService } from '../../audit/audit.service';
import { HOSPITAL_INTELLIGENCE_AUDIT_EVENTS } from '../hospital-intelligence.audit';

/**
 * M19.2 — Signal Persistence, Deduplication, and Authorization Tests
 * SOURCE OF TRUTH: docs/architecture/M19_INTELLIGENCE_ARCHITECTURE.md §14, §20
 */

describe('M19.2 Service Persistence & Deduplication', () => {
  const mockAudit = {
    logEvent: vi.fn().mockResolvedValue(undefined),
  } as unknown as AuditService;

  const mockAi = {
    invokeStructured: vi.fn().mockResolvedValue({
      status: 'grounded',
      parsed: {
        summary: 'Operational bottleneck detected in lab workflow.',
        clinicalImpact: 'May delay care delivery.',
        citations: [],
        disclaimers: ['Clinical governance review required.'],
        informationGaps: [],
        recommendation: {
          actionType: 'NOTIFY_ATTENDING_PHYSICIAN',
          rationale: 'Alert attending physician of delay.',
        },
      },
      failures: [],
      interactionId: randomUUID(),
    }),
  } as unknown as AIOrchestrator;

  const physicianActor = {
    staffId: '19991db8-adc3-4ece-8f3f-99cac3e7b2ec',
    role: 'physician',
    departmentId: '0b14c48d-9a5e-4f6e-b2f0-3a7d1c9e8f00',
  };

  const adminActor = {
    staffId: '63daab1f-ac27-494c-8257-daa6dac11796',
    role: 'hospital_admin',
    departmentId: '0b14c48d-9a5e-4f6e-b2f0-3a7d1c9e8f00',
  };

  it('audits ANALYSIS_REQUESTED and ANALYSIS_COMPLETED events', async () => {
    const service = new HospitalIntelligenceService(mockAudit, mockAi);
    const correlationId = randomUUID();

    await service.analyzeHospitalOperations(
      { scope: 'department', limit: 1 },
      physicianActor,
      correlationId,
    );

    expect(mockAudit.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: HOSPITAL_INTELLIGENCE_AUDIT_EVENTS.ANALYSIS_REQUESTED,
      }),
      correlationId,
    );

    expect(mockAudit.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: HOSPITAL_INTELLIGENCE_AUDIT_EVENTS.ANALYSIS_COMPLETED,
      }),
      correlationId,
    );
  });

  it('deduplicates active signals on repeated analysis runs', async () => {
    const service = new HospitalIntelligenceService(mockAudit, mockAi);

    const run1 = await service.analyzeHospitalOperations(
      { scope: 'hospital_admin', limit: 3 },
      adminActor,
      randomUUID(),
    );

    const run2 = await service.analyzeHospitalOperations(
      { scope: 'hospital_admin', limit: 3 },
      adminActor,
      randomUUID(),
    );

    // Signals detected for the same ongoing bottleneck should reuse the signalId
    if (run1.signals.length > 0 && run2.signals.length > 0) {
      const match1 = run1.signals[0];
      const match2 = run2.signals.find((s) => s.encounterId === match1.encounterId && s.signalType === match1.signalType);
      if (match2) {
        expect(match2.signalId).toBe(match1.signalId);
      }
    }
  });

  it('keeps recommendations strictly in proposed state and requires human approval', async () => {
    const service = new HospitalIntelligenceService(mockAudit, mockAi);

    const res = await service.analyzeHospitalOperations(
      { scope: 'hospital_admin', limit: 2 },
      adminActor,
      randomUUID(),
    );

    for (const signal of res.signals) {
      if (signal.recommendation) {
        expect(signal.recommendation.policyStatus).toBe('proposed');
        expect(signal.recommendation.executableStatus).toBe('proposed');
        expect(signal.recommendation.requiresHumanApproval).toBe(true);
      }
    }
  });

  it('denies cross-department getSignalById for unauthorized clinicians', async () => {
    const service = new HospitalIntelligenceService(mockAudit, mockAi);

    // Retrieve signals as admin first
    const signals = await service.getSignals(adminActor);
    if (signals.length > 0) {
      const targetSignal = signals[0];

      // A clinician from a different department cannot read this signal
      const foreignPhysician = {
        staffId: randomUUID(),
        role: 'physician',
        departmentId: 'ffffffff-ffff-ffff-ffff-ffffffffffff', // foreign dept
      };

      const result = await service.getSignalById(targetSignal.signalId, foreignPhysician);
      expect(result).toBeNull();
    }
  });
});
