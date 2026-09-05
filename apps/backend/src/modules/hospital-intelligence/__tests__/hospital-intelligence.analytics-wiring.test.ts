import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { randomUUID } from 'crypto';
import { HospitalIntelligenceService } from '../hospital-intelligence.service';
import { AIOrchestrator } from '../../ai/orchestrator';
import { AuditService } from '../../audit/audit.service';
import { AnalyzeResponse } from '../hospital-analytics.client';

describe('Hospital Intelligence -> Python Analytics Integration & Safe Degradation', () => {
  const mockAudit = {
    logEvent: vi.fn().mockResolvedValue(undefined),
  } as unknown as AuditService;

  const mockAi = {
    invokeStructured: vi.fn().mockResolvedValue({
      status: 'grounded',
      parsed: {
        summary: 'Operational bottleneck detected in lab turnaround.',
        clinicalImpact: 'May delay care delivery.',
        citations: [],
        disclaimers: ['Clinical governance review required.'],
        informationGaps: [],
        recommendation: {
          actionType: 'NOTIFY_ATTENDING_PHYSICIAN',
          rationale: 'Alert attending physician of order delay.',
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

  const mockPythonResponse: AnalyzeResponse = {
    analysis_id: 'py-analysis-001',
    correlation_id: 'corr-001',
    timestamp: '2026-09-05T00:00:00.000Z',
    risk_score: 0.72,
    risk_level: 'HIGH',
    confidence: 0.88,
    factors: [
      {
        name: 'pending_diagnostic_orders',
        contribution: 0.45,
        observed_value: 3,
        description: '3 diagnostic orders pending over turnaround threshold',
      },
    ],
    analysis_type: 'operational_bottleneck',
    model_info: {
      engine: 'deterministic',
      ml_enabled: false,
      algorithm_version: '1.0.0',
    },
    limitations: [
      'Operational advisory only; does not provide clinical diagnosis or direct medical advice.',
    ],
  };

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('1. Hospital Intelligence -> HospitalAnalyticsClient -> mocked Python /analyze -> validated response -> intelligence enrichment', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockPythonResponse,
    } as Response);

    const service = new HospitalIntelligenceService(mockAudit, mockAi);
    const correlationId = randomUUID();

    const result = await service.analyzeHospitalOperations(
      { scope: 'department', limit: 5 },
      physicianActor,
      correlationId,
    );

    // Verify Hospital Intelligence completed successfully
    expect(result).toBeDefined();
    expect(result.analysisId).toBeDefined();
    expect(result.correlationId).toBe(correlationId);
    expect(result.signals).toBeDefined();

    // Verify Python sidecar /analyze was invoked
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/analyze'),
      expect.objectContaining({
        method: 'POST',
      }),
    );

    // Verify intelligence response is enriched with validated advisory analytics
    expect(result.analytics).toBeDefined();
    expect(result.analytics?.risk_score).toBe(0.72);
    expect(result.analytics?.risk_level).toBe('HIGH');
    expect(result.analytics?.confidence).toBe(0.88);
    expect(result.analytics?.factors).toHaveLength(1);
    expect(result.analytics?.factors[0].name).toBe('pending_diagnostic_orders');
    expect(result.analytics?.limitations).toContain(
      'Operational advisory only; does not provide clinical diagnosis or direct medical advice.',
    );
  });

  it('2. Python timeout/failure -> deterministic intelligence still succeeds with zero disruption', async () => {
    // Simulate Python sidecar network failure / timeout
    vi.mocked(fetch).mockRejectedValueOnce(new Error('connect ECONNREFUSED 127.0.0.1:8001'));

    const service = new HospitalIntelligenceService(mockAudit, mockAi);
    const correlationId = randomUUID();

    const result = await service.analyzeHospitalOperations(
      { scope: 'department', limit: 5 },
      physicianActor,
      correlationId,
    );

    // Verify deterministic intelligence succeeds completely
    expect(result).toBeDefined();
    expect(result.analysisId).toBeDefined();
    expect(result.correlationId).toBe(correlationId);
    expect(Array.isArray(result.signals)).toBe(true);

    // Advisory analytics safely falls back to undefined or null, without crashing
    expect(result.analytics).toBeUndefined();
  });

  it('3. Python 500 error -> deterministic intelligence still succeeds', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    } as Response);

    const service = new HospitalIntelligenceService(mockAudit, mockAi);
    const correlationId = randomUUID();

    const result = await service.analyzeHospitalOperations(
      { scope: 'department', limit: 5 },
      physicianActor,
      correlationId,
    );

    expect(result).toBeDefined();
    expect(result.analysisId).toBeDefined();
    expect(result.analytics).toBeUndefined();
  });
});
