import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { intelligenceService } from '../intelligence.service';
import type {
  HospitalIntelligenceAnalysisResponse,
  DetectedSignal,
} from 'shared';

const mockSignal: DetectedSignal = {
  signalId: '3f2504e0-4f89-11d3-9a0c-0305e82c3301',
  signalType: 'PENDING_DIAGNOSTIC_RESULT',
  severity: 'CRITICAL',
  title: 'Stat Diagnostic Result Pending > 1h SLA',
  description: 'Stat blood panel order has exceeded the 1-hour turnaround SLA.',
  detectedAt: '2026-03-01T12:00:00Z',
  status: 'detected',
  patientId: '0b14c48d-9a5e-4f6e-b2f0-3a7d1c9e8f00',
  encounterId: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
  evidenceRefs: [
    {
      evidenceId: 'e1111111-1111-1111-1111-111111111111',
      sourceType: 'DIAGNOSTIC_ORDER',
      sourceRecordId: 'd1111111-1111-1111-1111-111111111111',
      relevantAt: '2026-03-01T10:00:00Z',
      evidenceStatus: 'present',
      authorizedVisibility: true,
      relationToSignal: 'Unresulted stat lab order placed 2 hours ago',
    },
  ],
  deterministicReason: 'Routine/stat turnaround exceeded: Stat diagnostic order pending 120 minutes (SLA threshold: 60 minutes).',
  aiExplanation: {
    summary: 'Stat laboratory order for patient remains unresulted, delaying critical clinical decision-making.',
    clinicalImpact: 'Potential diagnostic delay for acute inpatient condition.',
    citations: [{ sourceType: 'DIAGNOSTIC_ORDER', sourceId: 'd1111111-1111-1111-1111-111111111111', excerpt: 'Stat order' }],
    disclaimers: ['Advisory operational intelligence only. Clinical decisions remain the sole responsibility of the physician.'],
    informationGaps: [],
    groundingStatus: 'grounded',
  },
  recommendation: {
    recommendationId: 'r1111111-1111-1111-1111-111111111111',
    signalId: '3f2504e0-4f89-11d3-9a0c-0305e82c3301',
    actionType: 'ESCALATE_ALERT',
    rationale: 'Escalate unresulted stat diagnostic to laboratory supervisor.',
    evidenceRefs: ['e1111111-1111-1111-1111-111111111111'],
    requiresHumanApproval: true,
    policyStatus: 'proposed',
    executableStatus: 'proposed',
    createdAt: '2026-03-01T12:00:00Z',
  },
  correlationId: 'c1111111-1111-1111-1111-111111111111',
};

const mockAnalysisResponse: HospitalIntelligenceAnalysisResponse = {
  analysisId: 'a9999999-9999-9999-9999-999999999999',
  requestedAt: '2026-03-01T12:00:00Z',
  signals: [mockSignal],
  aiStatus: 'grounded',
  correlationId: 'c1111111-1111-1111-1111-111111111111',
};

describe('intelligenceService (M19.4 Operational Integration)', () => {
  let capturedUrl = '';
  let capturedOptions: RequestInit | undefined;

  beforeEach(() => {
    capturedUrl = '';
    capturedOptions = undefined;

    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: RequestInfo | URL, options?: RequestInit) => {
        capturedUrl = String(url);
        capturedOptions = options;
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: mockAnalysisResponse }),
        };
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('analyzeOperations', () => {
    it('sends POST to /hospital-intelligence/analyze with department scope by default', async () => {
      const res = await intelligenceService.analyzeOperations();
      expect(capturedUrl).toContain('/hospital-intelligence/analyze');
      expect(capturedOptions?.method).toBe('POST');
      expect(JSON.parse(capturedOptions?.body as string)).toEqual({ scope: 'department' });
      expect(res.analysisId).toBe('a9999999-9999-9999-9999-999999999999');
      expect(res.signals).toHaveLength(1);
    });

    it('sends hospital_admin scope when requested by an administrator', async () => {
      await intelligenceService.analyzeOperations('hospital_admin');
      expect(JSON.parse(capturedOptions?.body as string)).toEqual({ scope: 'hospital_admin' });
    });
  });

  describe('getHospitalSignals', () => {
    it('sends GET to /hospital-intelligence/signals', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async (url: RequestInfo | URL, options?: RequestInit) => {
          capturedUrl = String(url);
          capturedOptions = options;
          return {
            ok: true,
            status: 200,
            json: async () => ({ data: [mockSignal] }),
          };
        }),
      );

      const res = await intelligenceService.getHospitalSignals();
      expect(capturedUrl).toContain('/hospital-intelligence/signals');
      expect(capturedOptions?.method).toBe('GET');
      expect(res).toHaveLength(1);
      expect(res[0].signalId).toBe(mockSignal.signalId);
    });
  });

  describe('getSignalById', () => {
    it('sends GET to /hospital-intelligence/signals/:id', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async (url: RequestInfo | URL, options?: RequestInit) => {
          capturedUrl = String(url);
          capturedOptions = options;
          return {
            ok: true,
            status: 200,
            json: async () => ({ data: mockSignal }),
          };
        }),
      );

      const res = await intelligenceService.getSignalById(mockSignal.signalId);
      expect(capturedUrl).toContain(`/hospital-intelligence/signals/${mockSignal.signalId}`);
      expect(res?.signalId).toBe(mockSignal.signalId);
    });
  });

  describe('approveRecommendation', () => {
    it('sends POST with idempotencyKey to /hospital-intelligence/recommendations/:id/approve', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async (url: RequestInfo | URL, options?: RequestInit) => {
          capturedUrl = String(url);
          capturedOptions = options;
          return {
            ok: true,
            status: 200,
            json: async () => ({
              data: {
                status: 'approved',
                recommendationId: 'r1111111-1111-1111-1111-111111111111',
              },
            }),
          };
        }),
      );

      const idempotencyKey = 'idem-test-uuid-456';
      const res = await intelligenceService.approveRecommendation(
        'r1111111-1111-1111-1111-111111111111',
        idempotencyKey,
      );

      expect(capturedUrl).toContain('/hospital-intelligence/recommendations/r1111111-1111-1111-1111-111111111111/approve');
      expect(capturedOptions?.method).toBe('POST');
      expect(JSON.parse(capturedOptions?.body as string)).toEqual({ idempotencyKey });
      expect(res.status).toBe('approved');
      expect(res.recommendationId).toBe('r1111111-1111-1111-1111-111111111111');
    });
  });

  describe('rejectRecommendation', () => {
    it('sends POST with rejectionReason to /hospital-intelligence/recommendations/:id/reject', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async (url: RequestInfo | URL, options?: RequestInit) => {
          capturedUrl = String(url);
          capturedOptions = options;
          return {
            ok: true,
            status: 200,
            json: async () => ({
              data: {
                status: 'rejected',
                recommendationId: 'r1111111-1111-1111-1111-111111111111',
              },
            }),
          };
        }),
      );

      const rejectionReason = 'Superseded by urgent clinical discussion';
      const res = await intelligenceService.rejectRecommendation(
        'r1111111-1111-1111-1111-111111111111',
        rejectionReason,
      );

      expect(capturedUrl).toContain('/hospital-intelligence/recommendations/r1111111-1111-1111-1111-111111111111/reject');
      expect(capturedOptions?.method).toBe('POST');
      expect(JSON.parse(capturedOptions?.body as string)).toEqual({ rejectionReason });
      expect(res.status).toBe('rejected');
    });
  });
});
