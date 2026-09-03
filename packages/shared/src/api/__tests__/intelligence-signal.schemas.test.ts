import { describe, expect, it } from 'vitest';
import {
  signalTypeSchema,
  signalSeveritySchema,
  signalStatusSchema,
  evidenceRefSchema,
  recommendationSchema,
  recommendationActionTypeSchema,
  detectedSignalSchema,
  analyzeHospitalIntelligenceRequestSchema,
  hospitalIntelligenceAnalysisResponseSchema,
  approveRecommendationRequestSchema,
  rejectRecommendationRequestSchema,
} from '../intelligence-signal.schemas';
import { aiCapabilitySchema, gapCodeSchema } from '../ai.schemas';

const VALID_UUID_1 = '3f2504e0-4f89-11d3-9a0c-0305e82c3301';
const VALID_UUID_2 = '3f2504e0-4f89-11d3-9a0c-0305e82c3302';
const VALID_UUID_3 = '3f2504e0-4f89-11d3-9a0c-0305e82c3303';
const VALID_DATETIME = '2026-09-04T10:00:00.000Z';

const VALID_EVIDENCE = {
  evidenceId: VALID_UUID_1,
  sourceType: 'DIAGNOSTIC_ORDER' as const,
  sourceRecordId: VALID_UUID_2,
  relevantAt: VALID_DATETIME,
  evidenceStatus: 'present' as const,
  authorizedVisibility: true,
  relationToSignal: 'STAT CBC order pending without result for 6 hours',
};

const VALID_RECOMMENDATION = {
  recommendationId: VALID_UUID_3,
  signalId: VALID_UUID_1,
  actionType: 'NOTIFY_ATTENDING_PHYSICIAN' as const,
  rationale: 'Attending physician must be alerted to expedite processing.',
  evidenceRefs: [VALID_UUID_1],
  uncertaintyNote: 'Lab processing time depends on specimen status.',
  limitationsNote: 'Operational recommendation, not a clinical treatment directive.',
  requiresHumanApproval: true,
  policyStatus: 'proposed' as const,
  executableStatus: 'proposed' as const,
  createdAt: VALID_DATETIME,
};

describe('M19 Hospital Intelligence Shared Schemas', () => {
  describe('Signal vocabulary', () => {
    it('accepts all ratified signal types', () => {
      expect(signalTypeSchema.parse('PENDING_DIAGNOSTIC_RESULT')).toBe('PENDING_DIAGNOSTIC_RESULT');
      expect(signalTypeSchema.parse('CRITICAL_RESULT_UNACKNOWLEDGED')).toBe('CRITICAL_RESULT_UNACKNOWLEDGED');
      expect(signalTypeSchema.parse('ENCOUNTER_WITHOUT_CLINICAL_RECORD')).toBe('ENCOUNTER_WITHOUT_CLINICAL_RECORD');
    });

    it('rejects unknown signal types', () => {
      expect(() => signalTypeSchema.parse('ARBITRARY_AI_SIGNAL')).toThrow();
    });

    it('accepts all ratified severity levels', () => {
      expect(signalSeveritySchema.parse('CRITICAL')).toBe('CRITICAL');
      expect(signalSeveritySchema.parse('HIGH')).toBe('HIGH');
      expect(signalSeveritySchema.parse('MEDIUM')).toBe('MEDIUM');
      expect(signalSeveritySchema.parse('LOW')).toBe('LOW');
    });

    it('rejects unknown severities', () => {
      expect(() => signalSeveritySchema.parse('MODERATE')).toThrow();
    });

    it('accepts all ratified signal statuses', () => {
      const statuses = ['detected', 'analyzed', 'actioned', 'dismissed', 'resolved', 'stale'] as const;
      for (const s of statuses) {
        expect(signalStatusSchema.parse(s)).toBe(s);
      }
    });
  });

  describe('Evidence model', () => {
    it('accepts a valid evidence reference', () => {
      const parsed = evidenceRefSchema.parse(VALID_EVIDENCE);
      expect(parsed.sourceType).toBe('DIAGNOSTIC_ORDER');
      expect(parsed.evidenceStatus).toBe('present');
    });

    it('supports missing evidence as a valid status (ADR-018/M19.0)', () => {
      const missingEvidence = {
        ...VALID_EVIDENCE,
        evidenceStatus: 'missing',
        relationToSignal: 'Diagnostic result not yet entered',
      };
      const parsed = evidenceRefSchema.parse(missingEvidence);
      expect(parsed.evidenceStatus).toBe('missing');
    });

    it('rejects evidence with unknown source type', () => {
      expect(() =>
        evidenceRefSchema.parse({
          ...VALID_EVIDENCE,
          sourceType: 'EXTERNAL_WEB_SOURCE',
        }),
      ).toThrow();
    });

    it('rejects unknown fields (strict allowlist)', () => {
      expect(() =>
        evidenceRefSchema.parse({
          ...VALID_EVIDENCE,
          arbitraryNote: 'injected field',
        }),
      ).toThrow();
    });
  });

  describe('Recommendation model', () => {
    it('accepts a valid recommendation with bounded action type', () => {
      const parsed = recommendationSchema.parse(VALID_RECOMMENDATION);
      expect(parsed.actionType).toBe('NOTIFY_ATTENDING_PHYSICIAN');
      expect(parsed.requiresHumanApproval).toBe(true);
    });

    it('accepts all ratified recommendation action types', () => {
      const actions = [
        'ESCALATE_ALERT',
        'NOTIFY_ATTENDING_PHYSICIAN',
        'ACKNOWLEDGE_CRITICAL_ALERT',
        'REASSIGN_TASK',
        'VIEW_PATIENT_RECORD',
        'VIEW_DIAGNOSTIC_ORDER',
      ] as const;
      for (const action of actions) {
        expect(recommendationActionTypeSchema.parse(action)).toBe(action);
      }
    });

    it('rejects clinical diagnosis or prescribing actions (forbidden actions)', () => {
      expect(() => recommendationActionTypeSchema.parse('PRESCRIBE_MEDICATION')).toThrow();
      expect(() => recommendationActionTypeSchema.parse('DIAGNOSE_CONDITION')).toThrow();
      expect(() => recommendationActionTypeSchema.parse('DISCHARGE_PATIENT')).toThrow();
    });
  });

  describe('Detected signal contract', () => {
    it('accepts a fully formed detected signal', () => {
      const signal = {
        signalId: VALID_UUID_1,
        signalType: 'PENDING_DIAGNOSTIC_RESULT' as const,
        severity: 'HIGH' as const,
        title: 'Stat CBC Order Pending 6h',
        description: 'A STAT CBC order has been pending without a result for 6 hours.',
        detectedAt: VALID_DATETIME,
        status: 'detected' as const,
        patientId: VALID_UUID_2,
        encounterId: VALID_UUID_3,
        evidenceRefs: [VALID_EVIDENCE],
        deterministicReason: 'diagnostic_orders.status = ordered AND priority = stat AND created_at < NOW() - 4h',
        correlationId: VALID_UUID_1,
      };
      const parsed = detectedSignalSchema.parse(signal);
      expect(parsed.signalType).toBe('PENDING_DIAGNOSTIC_RESULT');
      expect(parsed.severity).toBe('HIGH');
      expect(parsed.evidenceRefs).toHaveLength(1);
    });

    it('requires at least one evidence reference', () => {
      const signal = {
        signalId: VALID_UUID_1,
        signalType: 'PENDING_DIAGNOSTIC_RESULT' as const,
        severity: 'HIGH' as const,
        title: 'Stat CBC Order Pending 6h',
        description: 'A STAT CBC order has been pending without a result for 6 hours.',
        detectedAt: VALID_DATETIME,
        status: 'detected' as const,
        patientId: null,
        encounterId: null,
        evidenceRefs: [],
        deterministicReason: 'test reason',
        correlationId: VALID_UUID_1,
      };
      expect(() => detectedSignalSchema.parse(signal)).toThrow();
    });
  });

  describe('AI capability and gap codes extension', () => {
    it('accepts hospital_bottleneck in aiCapabilitySchema', () => {
      expect(aiCapabilitySchema.parse('hospital_bottleneck')).toBe('hospital_bottleneck');
    });

    it('accepts hospital workflow gap codes in gapCodeSchema', () => {
      expect(gapCodeSchema.parse('NO_ACTIVE_ENCOUNTERS')).toBe('NO_ACTIVE_ENCOUNTERS');
      expect(gapCodeSchema.parse('NO_PENDING_ORDERS')).toBe('NO_PENDING_ORDERS');
      expect(gapCodeSchema.parse('NO_CRITICAL_ALERTS')).toBe('NO_CRITICAL_ALERTS');
    });

    it('rejects unknown gap codes', () => {
      expect(() => gapCodeSchema.parse('NO_INTERNET_CONNECTION')).toThrow();
    });
  });

  describe('API request / response primitives', () => {
    it('validates analyze hospital intelligence request', () => {
      const def = analyzeHospitalIntelligenceRequestSchema.parse({});
      expect(def.scope).toBe('department');

      const admin = analyzeHospitalIntelligenceRequestSchema.parse({ scope: 'hospital_admin' });
      expect(admin.scope).toBe('hospital_admin');
    });

    it('validates analysis response envelope', () => {
      const resp = {
        analysisId: VALID_UUID_1,
        requestedAt: VALID_DATETIME,
        signals: [],
        aiStatus: 'grounded' as const,
        correlationId: VALID_UUID_2,
      };
      const parsed = hospitalIntelligenceAnalysisResponseSchema.parse(resp);
      expect(parsed.aiStatus).toBe('grounded');
    });

    it('validates approve and reject recommendation requests', () => {
      const approve = approveRecommendationRequestSchema.parse({ idempotencyKey: 'idem-key-123' });
      expect(approve.idempotencyKey).toBe('idem-key-123');

      const reject = rejectRecommendationRequestSchema.parse({ rejectionReason: 'Clinically irrelevant' });
      expect(reject.rejectionReason).toBe('Clinically irrelevant');
    });
  });
});
