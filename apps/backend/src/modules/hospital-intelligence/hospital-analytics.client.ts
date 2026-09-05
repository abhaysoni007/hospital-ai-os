import { z } from 'zod';
import { logger } from '../../logger';

export const signalTypeEnumSchema = z.enum([
  'PENDING_DIAGNOSTIC_RESULT',
  'CRITICAL_RESULT_UNACKNOWLEDGED',
  'ENCOUNTER_WITHOUT_CLINICAL_RECORD',
  'TASK_ESCALATION_RISK',
  'DEPARTMENT_SATURATION',
]);

export const signalSeverityEnumSchema = z.enum([
  'CRITICAL',
  'HIGH',
  'MEDIUM',
  'LOW',
]);

export const riskLevelEnumSchema = z.enum([
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL',
]);

export const signalInputSchema = z.object({
  signal_id: z.string().optional().nullable(),
  signal_type: signalTypeEnumSchema,
  severity: signalSeverityEnumSchema,
  age_minutes: z.number().min(0),
  metadata: z.record(z.string(), z.any()).default({}), // Keep it minimal, zero-phi
});

export const operationalFeaturesInputSchema = z.object({
  active_encounters: z.number().int().min(0).default(0),
  pending_diagnostic_orders: z.number().int().min(0).default(0),
  unacknowledged_critical_results: z.number().int().min(0).default(0),
  encounters_without_clinical_record: z.number().int().min(0).default(0),
  stalled_orders_over_sla: z.number().int().min(0).default(0),
  average_pending_age_minutes: z.number().min(0).default(0),
});

export const analyzeRequestSchema = z.object({
  analysis_id: z.string().optional(),
  correlation_id: z.string().optional(),
  scope: z.string().default('department'),
  department_id: z.string().optional().nullable(),
  signals: z.array(signalInputSchema).default([]),
  operational_features: operationalFeaturesInputSchema,
});

export const factorContributionSchema = z.object({
  name: z.string(),
  contribution: z.number(),
  observed_value: z.any(),
  description: z.string(),
});

export const modelMetadataSchema = z.object({
  engine: z.string(),
  ml_enabled: z.boolean(),
  algorithm_version: z.string(),
  training_provenance: z.string().optional().nullable(),
});

export const analyzeResponseSchema = z.object({
  analysis_id: z.string(),
  correlation_id: z.string(),
  timestamp: z.string(),
  risk_score: z.number().min(0).max(1),
  risk_level: riskLevelEnumSchema,
  confidence: z.number().min(0).max(1).optional().nullable(),
  factors: z.array(factorContributionSchema),
  analysis_type: z.string(),
  model_info: modelMetadataSchema,
  limitations: z.array(z.string()),
});

export type AnalyzeRequest = z.infer<typeof analyzeRequestSchema>;
export type AnalyzeResponse = z.infer<typeof analyzeResponseSchema>;
export type SignalInput = z.infer<typeof signalInputSchema>;
export type OperationalFeaturesInput = z.infer<typeof operationalFeaturesInputSchema>;

export class HospitalAnalyticsClient {
  private baseUrl: string;
  private readonly timeoutMs = 3000;

  constructor(baseUrl?: string) {
    const configured = baseUrl !== undefined
      ? baseUrl
      : (process.env.HOSPITAL_ANALYTICS_URL ?? 'http://localhost:8001');
    this.baseUrl = (configured || '').trim();
    if (this.baseUrl.endsWith('/')) {
      this.baseUrl = this.baseUrl.slice(0, -1);
    }
  }

  setBaseUrl(url: string) {
    this.baseUrl = (url || '').trim();
    if (this.baseUrl.endsWith('/')) {
      this.baseUrl = this.baseUrl.slice(0, -1);
    }
  }

  /**
   * Safely calls Python Analytics Sidecar.
   * Supports both object-based AnalyzeRequest and (signals, operationalFeatures) arguments.
   * Enforces 3000ms timeout and catches all errors to never throw in main workflow.
   * Performs Zod validation of input and output.
   */
  async analyze(
    requestOrSignals: AnalyzeRequest | SignalInput[],
    operationalFeatures?: OperationalFeaturesInput,
    options?: { analysisId?: string; correlationId?: string; scope?: string; departmentId?: string | null }
  ): Promise<AnalyzeResponse | null> {
    const correlationId = Array.isArray(requestOrSignals)
      ? options?.correlationId
      : requestOrSignals?.correlation_id;

    if (!this.baseUrl) {
      logger.warn({ correlationId }, 'HospitalAnalyticsClient: missing URL configuration, skipping sidecar analysis');
      return null;
    }

    try {
      let rawRequest: AnalyzeRequest;
      if (Array.isArray(requestOrSignals)) {
        rawRequest = {
          analysis_id: options?.analysisId,
          correlation_id: options?.correlationId,
          scope: options?.scope || 'department',
          department_id: options?.departmentId,
          signals: requestOrSignals,
          operational_features: operationalFeatures || {
            active_encounters: 0,
            pending_diagnostic_orders: 0,
            unacknowledged_critical_results: 0,
            encounters_without_clinical_record: 0,
            stalled_orders_over_sla: 0,
            average_pending_age_minutes: 0,
          },
        };
      } else {
        rawRequest = requestOrSignals;
      }

      // 1. Validate request (ensures zero-PHI at the boundary)
      const validatedRequest = analyzeRequestSchema.parse(rawRequest);

      // 2. Timeout controller (hard 3000ms SLA)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const response = await fetch(`${this.baseUrl}/analyze`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // DO NOT pass Authorization or any secret headers
          },
          body: JSON.stringify(validatedRequest),
          signal: controller.signal,
        });

        if (!response.ok) {
          logger.warn(
            { correlationId, status: response.status },
            'HospitalAnalyticsClient: non-2xx response from sidecar',
          );
          return null;
        }

        const rawJson = await response.json();
        
        // 3. Validate response
        const validatedResponse = analyzeResponseSchema.parse(rawJson);
        return validatedResponse;
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        logger.warn({ correlationId }, 'HospitalAnalyticsClient: timeout after 3000ms');
      } else if (error instanceof z.ZodError) {
        logger.warn({ correlationId }, 'HospitalAnalyticsClient: schema validation failed');
      } else {
        logger.warn(
          { correlationId, error: error?.message || 'unknown' },
          'HospitalAnalyticsClient: unhandled fetch error',
        );
      }
      return null;
    }
  }
}

export const hospitalAnalyticsClient = new HospitalAnalyticsClient();
