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
  metadata: z.record(z.any()).default({}), // Keep it minimal, zero-phi
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

  constructor() {
    this.baseUrl = process.env.HOSPITAL_ANALYTICS_URL || 'http://localhost:8001';
    // Ensure no trailing slash
    if (this.baseUrl.endsWith('/')) {
      this.baseUrl = this.baseUrl.slice(0, -1);
    }
  }

  /**
   * Safely calls Python Analytics Sidecar.
   * Enforces 3000ms timeout and catches all errors to never throw in main workflow.
   * Performs Zod validation of input and output.
   */
  async analyze(request: AnalyzeRequest): Promise<AnalyzeResponse | null> {
    try {
      // 1. Validate request (ensures zero-PHI at the boundary)
      const validatedRequest = analyzeRequestSchema.parse(request);

      // 2. Timeout controller
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
          logger.warn(`HospitalAnalyticsClient: non-2xx response ${response.status}`, { correlationId: request.correlation_id });
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
        logger.warn('HospitalAnalyticsClient: timeout after 3000ms', { correlationId: request.correlation_id });
      } else if (error instanceof z.ZodError) {
        logger.warn('HospitalAnalyticsClient: schema validation failed', { 
          correlationId: request.correlation_id, 
        });
      } else {
        logger.warn(`HospitalAnalyticsClient: unhandled fetch error: ${error?.message || 'unknown'}`, { 
          correlationId: request.correlation_id 
        });
      }
      return null;
    }
  }
}

export const hospitalAnalyticsClient = new HospitalAnalyticsClient();
