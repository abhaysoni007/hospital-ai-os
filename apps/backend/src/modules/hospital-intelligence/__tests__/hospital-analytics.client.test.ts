import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HospitalAnalyticsClient, AnalyzeRequest, AnalyzeResponse } from '../hospital-analytics.client';
import { z } from 'zod';

describe('HospitalAnalyticsClient', () => {
  let client: HospitalAnalyticsClient;
  
  beforeEach(() => {
    client = new HospitalAnalyticsClient();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const mockValidRequest: AnalyzeRequest = {
    analysis_id: 'test-uuid',
    correlation_id: 'corr-uuid',
    scope: 'department',
    department_id: 'dept-123',
    signals: [
      {
        signal_id: 'sig-123',
        signal_type: 'PENDING_DIAGNOSTIC_RESULT',
        severity: 'HIGH',
        age_minutes: 45,
        metadata: {}, // Zero-PHI
      }
    ],
    operational_features: {
      active_encounters: 10,
      pending_diagnostic_orders: 5,
      unacknowledged_critical_results: 1,
      encounters_without_clinical_record: 2,
      stalled_orders_over_sla: 0,
      average_pending_age_minutes: 45,
    }
  };

  const mockValidResponse: AnalyzeResponse = {
    analysis_id: 'test-uuid',
    correlation_id: 'corr-uuid',
    timestamp: new Date().toISOString(),
    risk_score: 0.85,
    risk_level: 'HIGH',
    confidence: 0.9,
    factors: [
      {
        name: 'unacknowledged_critical_results',
        contribution: 0.5,
        observed_value: 1,
        description: 'Critical results pending',
      }
    ],
    analysis_type: 'operational_bottleneck',
    model_info: {
      engine: 'deterministic',
      ml_enabled: true,
      algorithm_version: '1.0',
    },
    limitations: ['Not for clinical diagnosis'],
  };

  it('1. Successful request/response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockValidResponse,
    } as Response);

    const result = await client.analyze(mockValidRequest);
    expect(result).toEqual(mockValidResponse);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('2. Correct request schema - drops PHI automatically via Zod strictness/parsing', async () => {
    const maliciousRequest = {
      ...mockValidRequest,
      signals: [
        {
          ...mockValidRequest.signals[0],
          patient_name: 'John Doe', // PHI
        }
      ]
    };
    
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockValidResponse,
    } as Response);

    await client.analyze(maliciousRequest as any);
    const fetchCall = vi.mocked(fetch).mock.calls[0];
    const bodyStr = fetchCall[1]?.body as string;
    const body = JSON.parse(bodyStr);
    
    // Assert PHI is stripped
    expect(body.signals[0]).not.toHaveProperty('patient_name');
    expect(body.signals[0]).toHaveProperty('signal_type');
  });

  it('4. 3000ms timeout', async () => {
    vi.mocked(fetch).mockImplementationOnce(() => {
      return new Promise((resolve, reject) => {
        const error = new Error('AbortError');
        error.name = 'AbortError';
        setTimeout(() => reject(error), 10); // Simulate abort
      });
    });

    const result = await client.analyze(mockValidRequest);
    expect(result).toBeNull();
  });

  it('5. Network failure falls back to null', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const result = await client.analyze(mockValidRequest);
    expect(result).toBeNull();
  });

  it('6. HTTP 500 falls back to null', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
    } as Response);

    const result = await client.analyze(mockValidRequest);
    expect(result).toBeNull();
  });

  it('8. Malformed JSON falls back to null', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => { throw new Error('Unexpected token'); },
    } as Response);

    const result = await client.analyze(mockValidRequest);
    expect(result).toBeNull();
  });

  it('9. Invalid response schema falls back to null', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ...mockValidResponse, risk_score: 1.5 }), // Invalid score > 1
    } as Response);

    const result = await client.analyze(mockValidRequest);
    expect(result).toBeNull();
  });

  it('11/12. Zero-PHI request payload and no auth tokens', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockValidResponse,
    } as Response);

    await client.analyze(mockValidRequest);
    const fetchCall = vi.mocked(fetch).mock.calls[0];
    const options = fetchCall[1];
    
    // Check headers
    const headers = options?.headers as Record<string, string>;
    expect(headers['Authorization']).toBeUndefined();
    expect(headers['Cookie']).toBeUndefined();
  });
});
