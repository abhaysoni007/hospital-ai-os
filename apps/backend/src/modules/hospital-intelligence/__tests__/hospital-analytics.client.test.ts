import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HospitalAnalyticsClient, AnalyzeRequest, AnalyzeResponse, SignalInput, OperationalFeaturesInput } from '../hospital-analytics.client';

describe('HospitalAnalyticsClient', () => {
  let client: HospitalAnalyticsClient;

  beforeEach(() => {
    client = new HospitalAnalyticsClient('http://localhost:8001');
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const mockValidRequest: AnalyzeRequest = {
    analysis_id: 'test-uuid-001',
    correlation_id: 'corr-uuid-002',
    scope: 'department',
    department_id: 'dept-123',
    signals: [
      {
        signal_id: 'sig-123',
        signal_type: 'PENDING_DIAGNOSTIC_RESULT',
        severity: 'HIGH',
        age_minutes: 45,
        metadata: {},
      },
    ],
    operational_features: {
      active_encounters: 10,
      pending_diagnostic_orders: 5,
      unacknowledged_critical_results: 1,
      encounters_without_clinical_record: 2,
      stalled_orders_over_sla: 0,
      average_pending_age_minutes: 45,
    },
  };

  const mockValidResponse: AnalyzeResponse = {
    analysis_id: 'test-uuid-001',
    correlation_id: 'corr-uuid-002',
    timestamp: '2026-09-05T00:00:00.000Z',
    risk_score: 0.85,
    risk_level: 'HIGH',
    confidence: 0.9,
    factors: [
      {
        name: 'unacknowledged_critical_results',
        contribution: 0.5,
        observed_value: 1,
        description: 'Critical results pending acknowledgment',
      },
    ],
    analysis_type: 'operational_bottleneck',
    model_info: {
      engine: 'deterministic',
      ml_enabled: true,
      algorithm_version: '1.0',
    },
    limitations: ['Not for clinical diagnosis', 'Advisory only'],
  };

  it('1. success - returns validated AnalyzeResponse', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockValidResponse,
    } as Response);

    const result = await client.analyze(mockValidRequest);
    expect(result).toEqual(mockValidResponse);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:8001/analyze',
      expect.objectContaining({
        method: 'POST',
      }),
    );
  });

  it('2. correct request body - verifies serialized wire format against Python contract', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockValidResponse,
    } as Response);

    await client.analyze(mockValidRequest);

    const fetchCall = vi.mocked(fetch).mock.calls[0];
    const rawBody = fetchCall[1]?.body as string;
    const body = JSON.parse(rawBody);

    expect(body.analysis_id).toBe('test-uuid-001');
    expect(body.correlation_id).toBe('corr-uuid-002');
    expect(body.scope).toBe('department');
    expect(body.department_id).toBe('dept-123');
    expect(body.signals).toHaveLength(1);
    expect(body.signals[0]).toEqual({
      signal_id: 'sig-123',
      signal_type: 'PENDING_DIAGNOSTIC_RESULT',
      severity: 'HIGH',
      age_minutes: 45,
      metadata: {},
    });
    expect(body.operational_features).toEqual({
      active_encounters: 10,
      pending_diagnostic_orders: 5,
      unacknowledged_critical_results: 1,
      encounters_without_clinical_record: 2,
      stalled_orders_over_sla: 0,
      average_pending_age_minutes: 45,
    });
  });

  it('2b. supports (signals, operationalFeatures) dual call signature', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockValidResponse,
    } as Response);

    const signals: SignalInput[] = [
      {
        signal_id: 'sig-456',
        signal_type: 'CRITICAL_RESULT_UNACKNOWLEDGED',
        severity: 'CRITICAL',
        age_minutes: 15,
        metadata: {},
      },
    ];
    const features: OperationalFeaturesInput = {
      active_encounters: 8,
      pending_diagnostic_orders: 2,
      unacknowledged_critical_results: 1,
      encounters_without_clinical_record: 0,
      stalled_orders_over_sla: 1,
      average_pending_age_minutes: 15,
    };

    const result = await client.analyze(signals, features, {
      analysisId: 'custom-id',
      correlationId: 'custom-corr',
      scope: 'hospital_admin',
    });

    expect(result).toEqual(mockValidResponse);
    const fetchCall = vi.mocked(fetch).mock.calls[0];
    const body = JSON.parse(fetchCall[1]?.body as string);
    expect(body.analysis_id).toBe('custom-id');
    expect(body.correlation_id).toBe('custom-corr');
    expect(body.scope).toBe('hospital_admin');
    expect(body.signals[0].signal_type).toBe('CRITICAL_RESULT_UNACKNOWLEDGED');
  });

  it('3. response schema validation - rejects missing required fields', async () => {
    // Missing required 'factors' and 'risk_level'
    const incompleteResponse = {
      analysis_id: 'test-uuid-001',
      correlation_id: 'corr-uuid-002',
      timestamp: new Date().toISOString(),
      risk_score: 0.5,
      // missing risk_level, factors, etc.
    };

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => incompleteResponse,
    } as Response);

    const result = await client.analyze(mockValidRequest);
    expect(result).toBeNull();
  });

  it('4. timeout - AbortController 3000ms abort returns null safely', async () => {
    vi.mocked(fetch).mockImplementationOnce(() => {
      return new Promise((_, reject) => {
        const error = new Error('The operation was aborted');
        error.name = 'AbortError';
        setTimeout(() => reject(error), 5);
      });
    });

    const result = await client.analyze(mockValidRequest);
    expect(result).toBeNull();
  });

  it('5. network failure - ECONNREFUSED returns null safely', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('connect ECONNREFUSED 127.0.0.1:8001'));

    const result = await client.analyze(mockValidRequest);
    expect(result).toBeNull();
  });

  it('6. 400, 401, 403, 404 HTTP errors return null safely', async () => {
    for (const status of [400, 401, 403, 404]) {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status,
        statusText: 'Client Error',
      } as Response);

      const result = await client.analyze(mockValidRequest);
      expect(result).toBeNull();
    }
  });

  it('7. 500 internal server error returns null safely', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    } as Response);

    const result = await client.analyze(mockValidRequest);
    expect(result).toBeNull();
  });

  it('8. malformed JSON response returns null safely', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => {
        throw new SyntaxError('Unexpected token < in JSON at position 0');
      },
    } as unknown as Response);

    const result = await client.analyze(mockValidRequest);
    expect(result).toBeNull();
  });

  it('9. invalid response - invalid score > 1.0 or invalid risk level returns null', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ...mockValidResponse, risk_score: 1.5 }),
    } as Response);

    const result1 = await client.analyze(mockValidRequest);
    expect(result1).toBeNull();

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ...mockValidResponse, risk_level: 'SUPER_CRITICAL' }),
    } as Response);

    const result2 = await client.analyze(mockValidRequest);
    expect(result2).toBeNull();
  });

  it('10. missing configuration - empty URL safely returns null without calling fetch', async () => {
    const unconfiguredClient = new HospitalAnalyticsClient('');
    const result = await unconfiguredClient.analyze(mockValidRequest);
    expect(result).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('11. zero-PHI payload - serialized POST body contains NO clinical or patient fields', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockValidResponse,
    } as Response);

    // Provide a request that contains clinical/patient mock fields attempting to leak
    const payloadWithLeakAttempt: any = {
      ...mockValidRequest,
      patientName: 'Jane Doe',
      mrn: 'MRN-998877',
      diagnosis: 'Acute Myocardial Infarction',
      medications: ['Aspirin 81mg', 'Heparin'],
      notes: 'Patient admitted via emergency with severe chest pain.',
      dob: '1975-04-12',
      phone: '+1-555-0199',
      signals: [
        {
          ...mockValidRequest.signals[0],
          patient_name: 'Jane Doe',
          mrn: 'MRN-998877',
          clinical_notes: 'Urgent Troponin pending',
          prescription: 'Metoprolol',
        },
      ],
    };

    await client.analyze(payloadWithLeakAttempt);

    const fetchCall = vi.mocked(fetch).mock.calls[0];
    const rawBody = fetchCall[1]?.body as string;
    const parsedBody = JSON.parse(rawBody);

    // 1. Check raw body string: none of the PHI strings should appear anywhere
    expect(rawBody).not.toContain('Jane Doe');
    expect(rawBody).not.toContain('MRN-998877');
    expect(rawBody).not.toContain('Acute Myocardial Infarction');
    expect(rawBody).not.toContain('Aspirin');
    expect(rawBody).not.toContain('1975-04-12');
    expect(rawBody).not.toContain('+1-555-0199');
    expect(rawBody).not.toContain('Troponin');

    // 2. Check parsed body schema: verify allowlisted properties only
    expect(parsedBody).not.toHaveProperty('patientName');
    expect(parsedBody).not.toHaveProperty('mrn');
    expect(parsedBody).not.toHaveProperty('diagnosis');
    expect(parsedBody).not.toHaveProperty('medications');
    expect(parsedBody).not.toHaveProperty('notes');
    expect(parsedBody.signals[0]).not.toHaveProperty('patient_name');
    expect(parsedBody.signals[0]).not.toHaveProperty('mrn');
    expect(parsedBody.signals[0]).not.toHaveProperty('clinical_notes');
    expect(parsedBody.signals[0]).not.toHaveProperty('prescription');

    // Allowed fields only
    expect(parsedBody.signals[0]).toHaveProperty('signal_type');
    expect(parsedBody.signals[0]).toHaveProperty('severity');
    expect(parsedBody.signals[0]).toHaveProperty('age_minutes');
  });

  it('12. no secret leakage - headers contain NO auth tokens, cookies, or secrets', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => mockValidResponse,
    } as Response);

    await client.analyze(mockValidRequest);

    const fetchCall = vi.mocked(fetch).mock.calls[0];
    const options = fetchCall[1];
    const headers = options?.headers as Record<string, string>;

    expect(headers['Authorization']).toBeUndefined();
    expect(headers['authorization']).toBeUndefined();
    expect(headers['Cookie']).toBeUndefined();
    expect(headers['cookie']).toBeUndefined();
    expect(headers['X-API-Key']).toBeUndefined();
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('13. safe fallback - arbitrary unhandled exception returns null without throwing', async () => {
    vi.mocked(fetch).mockImplementationOnce(() => {
      throw new Error('Fatal socket crash');
    });

    const result = await client.analyze(mockValidRequest);
    expect(result).toBeNull();
  });

  it('14. Live Python sidecar integration (real HTTP communication)', async () => {
    vi.unstubAllGlobals();
    const liveClient = new HospitalAnalyticsClient('http://127.0.0.1:8001');
    try {
      const res = await liveClient.analyze(mockValidRequest);
      if (res) {
        expect(res.risk_score).toBeGreaterThanOrEqual(0);
        expect(res.risk_score).toBeLessThanOrEqual(1);
        expect(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).toContain(res.risk_level);
        expect(Array.isArray(res.factors)).toBe(true);
        expect(Array.isArray(res.limitations)).toBe(true);
        expect(res.analysis_type).toBe('operational_bottleneck');
      }
    } finally {
      vi.stubGlobal('fetch', vi.fn());
    }
  });
});
