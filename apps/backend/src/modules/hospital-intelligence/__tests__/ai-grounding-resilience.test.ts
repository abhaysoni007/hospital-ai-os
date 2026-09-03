import { describe, it, expect, vi } from 'vitest';
import { randomUUID } from 'crypto';
import { HospitalIntelligenceService } from '../hospital-intelligence.service';
import { AIOrchestrator } from '../../ai/orchestrator';
import { AuditService } from '../../audit/audit.service';
import { buildContextBlocksForSignal } from '../hospital-intelligence.context';
import { DetectedSignal } from 'shared';

/**
 * M19.2 — AI Explanation, Grounding, and Resilience Tests
 * SOURCE OF TRUTH: docs/architecture/M19_INTELLIGENCE_ARCHITECTURE.md §8, §10, §15
 *
 * Verifies that:
 * 1. AI receives only authorized bounded context blocks.
 * 2. Grounded explanations and proposed recommendations are attached properly.
 * 3. Any AI failure (network error, timeout, validation failure, hallucinated citation)
 *    degrades safely WITHOUT erasing the deterministic signal.
 */

describe('M19.2 AI Grounding & Resilience', () => {
  const mockAudit = {
    logEvent: vi.fn().mockResolvedValue(undefined),
  } as unknown as AuditService;

  const mockActor = {
    staffId: '63daab1f-ac27-494c-8257-daa6dac11796',
    role: 'hospital_admin',
    departmentId: '0b14c48d-9a5e-4f6e-b2f0-3a7d1c9e8f00',
  };

  const sampleSignal: DetectedSignal = {
    signalId: randomUUID(),
    signalType: 'PENDING_DIAGNOSTIC_RESULT',
    severity: 'HIGH',
    title: 'STAT Potassium Order Pending 4.2h',
    description: 'Diagnostic order pending past SLA',
    detectedAt: new Date().toISOString(),
    status: 'detected',
    patientId: '328abfc0-6d2f-4f6e-a5a9-39d366c2eb34',
    encounterId: '76443e13-51b4-4fd9-9017-a10b7dd89160',
    evidenceRefs: [
      {
        evidenceId: randomUUID(),
        sourceType: 'DIAGNOSTIC_ORDER',
        sourceRecordId: '19edaeef-cc37-4171-b54e-674aacf85943',
        relevantAt: new Date().toISOString(),
        evidenceStatus: 'present',
        authorizedVisibility: true,
        relationToSignal: 'Diagnostic order pending',
      },
    ],
    deterministicReason: 'pending order > threshold',
    aiExplanation: null,
    recommendation: null,
    correlationId: randomUUID(),
  };

  describe('Context Builder', () => {
    it('builds bounded, non-PHI context blocks for a signal', async () => {
      const blocks = await buildContextBlocksForSignal(sampleSignal);

      expect(Array.isArray(blocks)).toBe(true);
      expect(blocks.length).toBeGreaterThan(0);

      // Verify no patient name or free narrative is included
      for (const block of blocks) {
        expect((block as Record<string, unknown>).patientName).toBeUndefined();
        expect((block as Record<string, unknown>).ssn).toBeUndefined();
      }
    });
  });

  describe('Successful AI Explanation & Recommendation Proposal', () => {
    it('attaches grounded explanation and proposed recommendation when AI succeeds', async () => {
      const mockAi = {
        invokeStructured: vi.fn().mockResolvedValue({
          status: 'grounded',
          parsed: {
            summary: 'Potassium lab order pending past turnaround threshold.',
            clinicalImpact: 'May delay electrolyte imbalance treatment.',
            citations: [
              {
                sourceType: 'DIAGNOSTIC_ORDER',
                sourceId: '19edaeef-cc37-4171-b54e-674aacf85943',
                excerpt: 'STAT Potassium order',
              },
            ],
            disclaimers: ['Operational recommendation only.'],
            informationGaps: [],
            recommendation: {
              actionType: 'NOTIFY_ATTENDING_PHYSICIAN',
              rationale: 'Notify doctor of laboratory queue delay.',
            },
          },
          failures: [],
          interactionId: randomUUID(),
        }),
      } as unknown as AIOrchestrator;

      const service = new HospitalIntelligenceService(mockAudit, mockAi);
      const res = await service.analyzeHospitalOperations(
        { scope: 'department', limit: 1 },
        mockActor,
        randomUUID(),
      );

      expect(res.analysisId).toBeDefined();
      if (res.signals.length > 0) {
        const sig = res.signals[0];
        expect(sig.status).toBe('analyzed');
        expect(sig.aiExplanation).not.toBeNull();
        expect(sig.aiExplanation?.summary).toBe(
          'Potassium lab order pending past turnaround threshold.',
        );
        expect(sig.recommendation).not.toBeNull();
        expect(sig.recommendation?.actionType).toBe('NOTIFY_ATTENDING_PHYSICIAN');
        expect(sig.recommendation?.policyStatus).toBe('proposed');
        expect(sig.recommendation?.requiresHumanApproval).toBe(true);
      }
    });
  });

  describe('Safe Degradation on AI Failures', () => {
    it('preserves deterministic signals when AI provider throws a network error', async () => {
      const mockAi = {
        invokeStructured: vi.fn().mockRejectedValue(new Error('AI Provider connection timeout (ECONNREFUSED)')),
      } as unknown as AIOrchestrator;

      const service = new HospitalIntelligenceService(mockAudit, mockAi);
      const res = await service.analyzeHospitalOperations(
        { scope: 'hospital_admin', limit: 2 },
        mockActor,
        randomUUID(),
      );

      expect(res.analysisId).toBeDefined();
      expect(res.signals.length).toBeGreaterThan(0);
      expect(res.aiStatus).toBe('unavailable');

      for (const sig of res.signals) {
        // Deterministic signal remains fully intact!
        expect(sig.status).toBe('detected');
        expect(sig.deterministicReason).toBeDefined();
        expect(sig.evidenceRefs.length).toBeGreaterThan(0);
        // AI explanation is safely null
        expect(sig.aiExplanation).toBeNull();
        expect(sig.recommendation).toBeNull();
      }
    });

    it('preserves deterministic signals when AI output fails validation (e.g. malformed schema)', async () => {
      const mockAi = {
        invokeStructured: vi.fn().mockResolvedValue({
          status: 'validation_failed',
          failures: [{ stage: 'SCHEMA', message: 'Missing required summary' }],
          interactionId: randomUUID(),
        }),
      } as unknown as AIOrchestrator;

      const service = new HospitalIntelligenceService(mockAudit, mockAi);
      const res = await service.analyzeHospitalOperations(
        { scope: 'hospital_admin', limit: 2 },
        mockActor,
        randomUUID(),
      );

      expect(res.analysisId).toBeDefined();
      expect(res.signals.length).toBeGreaterThan(0);
      expect(res.aiStatus).toBe('unavailable');

      for (const sig of res.signals) {
        expect(sig.status).toBe('detected');
        expect(sig.aiExplanation).toBeNull();
        expect(sig.recommendation).toBeNull();
      }
    });

    it('preserves deterministic signals when AI cites hallucinated/unauthorized record IDs', async () => {
      const mockAi = {
        invokeStructured: vi.fn().mockResolvedValue({
          status: 'validation_failed',
          failures: [{ stage: 'CITATION', message: 'Foreign citation rejected' }],
          interactionId: randomUUID(),
        }),
      } as unknown as AIOrchestrator;

      const service = new HospitalIntelligenceService(mockAudit, mockAi);
      const res = await service.analyzeHospitalOperations(
        { scope: 'hospital_admin', limit: 1 },
        mockActor,
        randomUUID(),
      );

      expect(res.signals.length).toBeGreaterThan(0);
      for (const sig of res.signals) {
        expect(sig.aiExplanation).toBeNull();
        expect(sig.recommendation).toBeNull();
      }
    });
  });
});
