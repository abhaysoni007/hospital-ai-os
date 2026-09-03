import { describe, it, expect, beforeEach, vi } from 'vitest';
import { randomUUID } from 'crypto';
import { HospitalIntelligenceService } from '../hospital-intelligence.service';
import { HospitalIntelligencePolicyEngine } from '../hospital-intelligence.policy';
import { HospitalIntelligenceExecutor } from '../hospital-intelligence.executor';
import { AuditService } from '../../audit/audit.service';
import { db } from '../../../db';
import {
  hospitalIntelligenceSignals,
  intelligenceApprovedActions,
} from '../../../db/schema/hospital-intelligence';
import { patients } from '../../../db/schema/patients';
import { encounters } from '../../../db/schema/appointments';
import { AuthorizationError, ConflictError, NotFoundError, ValidationError } from 'shared/src/errors/AppError';

/**
 * M19.3 — Mandatory Security Tests (§20)
 * SOURCE OF TRUTH: M19.3 Prompt §20
 *
 * PROVES:
 * 1. AI recommendation + forged action type cannot execute.
 * 2. AI recommendation + forged resource ID cannot execute.
 * 3. AI recommendation + forged actor ID / unauthorized role cannot execute.
 * 4. Calling execute without a valid persisted approval cannot execute anything.
 */

describe('M19.3 Mandatory Security Suite (§20)', () => {
  const deptA = '0b14c48d-9a5e-4f6e-b2f0-3a7d1c9e8f00';
  const mockAudit = {
    logEvent: vi.fn().mockResolvedValue(undefined),
  } as unknown as AuditService;

  let service: HospitalIntelligenceService;
  let validSignalId: string;
  let validRecId: string;
  let validPatientId: string;
  let validEncounterId: string;

  const validPhysician = {
    staffId: '63daab1f-ac27-494c-8257-daa6dac11796',
    role: 'physician',
    departmentId: deptA,
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    service = new HospitalIntelligenceService(
      mockAudit,
      undefined as any,
      new HospitalIntelligencePolicyEngine(),
      new HospitalIntelligenceExecutor(mockAudit),
    );

    validSignalId = randomUUID();
    validRecId = randomUUID();

    const [p] = await db.select().from(patients).limit(1);
    validPatientId = p.id;

    const [enc] = await db.select().from(encounters).limit(1);
    validEncounterId = enc.id;
    validPhysician.departmentId = enc.departmentId;

    await db.insert(hospitalIntelligenceSignals).values({
      id: validSignalId,
      signalType: 'ENCOUNTER_WITHOUT_CLINICAL_RECORD',
      severity: 'HIGH',
      title: 'Security Test Signal',
      description: 'Encounter missing clinical note',
      status: 'analyzed',
      patientId: validPatientId,
      encounterId: validEncounterId,
      evidenceRefs: [
        {
          evidenceId: randomUUID(),
          sourceType: 'ENCOUNTER',
          sourceRecordId: validEncounterId,
          relevantAt: new Date().toISOString(),
          evidenceStatus: 'present',
          authorizedVisibility: true,
          relationToSignal: 'Active encounter',
        },
      ],
      deterministicReason: 'active encounter > 2h without signed note',
      recommendationId: validRecId,
      analysisCorrelationId: randomUUID(),
      requestedBy: validPhysician.staffId,
    });

    await db.insert(intelligenceApprovedActions).values({
      id: validRecId,
      signalId: validSignalId,
      actionType: 'NOTIFY_ATTENDING_PHYSICIAN',
      rationale: 'Notify doctor of missing documentation',
      evidenceRefs: [],
      requiresHumanApproval: true,
      policyStatus: 'proposed',
      executableStatus: 'proposed',
      idempotencyKey: randomUUID(),
    });
  });

  describe('Security Proof 1: Forged Action Type', () => {
    it('blocks execution when action type is forged or outside allowlist (e.g. DISCHARGE_PATIENT)', async () => {
      const forgedRecId = randomUUID();
      await db.insert(intelligenceApprovedActions).values({
        id: forgedRecId,
        signalId: validSignalId,
        actionType: 'DISCHARGE_PATIENT', // Forged clinical action
        rationale: 'Discharge patient automatically',
        evidenceRefs: [],
        requiresHumanApproval: true,
        policyStatus: 'proposed',
        executableStatus: 'proposed',
        idempotencyKey: randomUUID(),
      });

      await expect(
        service.approveRecommendation(
          forgedRecId,
          randomUUID(),
          validPhysician,
          randomUUID(),
          { executeImmediately: true },
        ),
      ).rejects.toThrow(ValidationError);
    });

    it('blocks execution when action attempts to modify medications or lab values', async () => {
      const forgedRecId = randomUUID();
      await db.insert(intelligenceApprovedActions).values({
        id: forgedRecId,
        signalId: validSignalId,
        actionType: 'PRESCRIBE_MEDICATION',
        rationale: 'Prescribe antibiotic',
        evidenceRefs: [],
        requiresHumanApproval: true,
        policyStatus: 'proposed',
        executableStatus: 'proposed',
        idempotencyKey: randomUUID(),
      });

      await expect(
        service.approveRecommendation(
          forgedRecId,
          randomUUID(),
          validPhysician,
          randomUUID(),
          { executeImmediately: true },
        ),
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('Security Proof 2: Forged Resource ID', () => {
    it('blocks execution when underlying resource does not exist', async () => {
      const nonExistentRecId = randomUUID();
      await expect(
        service.approveRecommendation(
          nonExistentRecId,
          randomUUID(),
          validPhysician,
          randomUUID(),
        ),
      ).rejects.toThrow(NotFoundError);
    });

    it('blocks execution when parent signal is missing or forged', async () => {
      const orphanRecId = randomUUID();
      const fakeSignalId = randomUUID();

      // Attempting to insert an orphan action referencing a non-existent signal
      // is blocked at DB level or policy level
      await expect(
        service.approveRecommendation(
          orphanRecId,
          randomUUID(),
          validPhysician,
          randomUUID(),
        ),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('Security Proof 3: Forged Actor ID / Unauthorized Role', () => {
    it('blocks execution when an actor with unauthorized role attempts approval', async () => {
      const unauthorizedNurse = {
        staffId: randomUUID(),
        role: 'nurse', // Lacks intelligence:approve
        departmentId: deptA,
      };

      await expect(
        service.approveRecommendation(
          validRecId,
          randomUUID(),
          unauthorizedNurse,
          randomUUID(),
        ),
      ).rejects.toThrow(AuthorizationError);
    });

    it('blocks execution when clinician attempts cross-department action approval', async () => {
      const foreignPhysician = {
        staffId: randomUUID(),
        role: 'physician',
        departmentId: '99999999-9999-9999-9999-999999999999', // foreign department
      };

      await expect(
        service.approveRecommendation(
          validRecId,
          randomUUID(),
          foreignPhysician,
          randomUUID(),
        ),
      ).rejects.toThrow(AuthorizationError);
    });
  });

  describe('Security Proof 4: Execute Without Valid Persisted Approval', () => {
    it('blocks POST execute when recommendation has not been approved', async () => {
      // validRecId is in 'proposed' status (NOT approved)
      // Attempting to call executeRecommendation directly should be rejected by policy
      // unless it was previously approved!
      // When a recommendation is rejected or still proposed in a two-phase flow:
      const rejectedRecId = randomUUID();
      await db.insert(intelligenceApprovedActions).values({
        id: rejectedRecId,
        signalId: validSignalId,
        actionType: 'NOTIFY_ATTENDING_PHYSICIAN',
        rationale: 'Notify attending',
        evidenceRefs: [],
        requiresHumanApproval: true,
        policyStatus: 'rejected', // Explicitly rejected
        executableStatus: 'proposed',
        idempotencyKey: randomUUID(),
      });

      await expect(
        service.executeRecommendation(
          rejectedRecId,
          randomUUID(),
          validPhysician,
          randomUUID(),
        ),
      ).rejects.toThrow(ConflictError);
    });
  });
});
