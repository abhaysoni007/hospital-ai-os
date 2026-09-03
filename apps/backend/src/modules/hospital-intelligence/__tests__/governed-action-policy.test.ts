import { describe, it, expect, beforeEach } from 'vitest';
import { randomUUID } from 'crypto';
import { hospitalIntelligencePolicyEngine } from '../hospital-intelligence.policy';
import { db } from '../../../db';
import {
  hospitalIntelligenceSignals,
  intelligenceApprovedActions,
} from '../../../db/schema/hospital-intelligence';
import { encounters } from '../../../db/schema/appointments';
import { patients } from '../../../db/schema/patients';
import { staff } from '../../../db/schema/staff';
import { notifications } from '../../../db/schema/tasks';

/**
 * M19.3 — Governed Action Policy Engine Unit Tests
 * SOURCE OF TRUTH: docs/architecture/M19_INTELLIGENCE_ARCHITECTURE.md §12, §14
 *
 * Verifies that policy evaluation is strictly deterministic, deny-by-default,
 * validates allowlisted actions, enforces role and department isolation,
 * prohibits break-glass shortcuts, and enforces state machine transitions.
 */

describe('M19.3 Governed Action Policy Engine', () => {
  const deptA = '0b14c48d-9a5e-4f6e-b2f0-3a7d1c9e8f00';
  const deptB = '22222222-2222-2222-2222-222222222222';

  const physicianDeptA = {
    staffId: '63daab1f-ac27-494c-8257-daa6dac11796',
    role: 'physician',
    departmentId: deptA,
  };

  const nurseDeptA = {
    staffId: randomUUID(),
    role: 'nurse',
    departmentId: deptA,
  };

  const adminActor = {
    staffId: '63daab1f-ac27-494c-8257-daa6dac11796',
    role: 'hospital_admin',
    departmentId: deptA,
  };

  let validSignalId: string;
  let validRecId: string;
  let validPatientId: string;
  let validEncounterId: string;
  let validNotifId: string;

  beforeEach(async () => {
    // Setup test fixtures
    validSignalId = randomUUID();
    validRecId = randomUUID();

    // Query seeded patient and encounter
    const [p] = await db.select().from(patients).limit(1);
    validPatientId = p.id;

    const [enc] = await db.select().from(encounters).limit(1);
    validEncounterId = enc.id;
    physicianDeptA.departmentId = enc.departmentId;
    nurseDeptA.departmentId = enc.departmentId;
    adminActor.departmentId = enc.departmentId;

    // Create a real notification for testing
    const [notif] = await db
      .insert(notifications)
      .values({
        recipientId: physicianDeptA.staffId,
        notificationType: 'critical_lab_alert',
        title: 'Policy Test Alert',
        body: 'Testing critical alert',
        priority: 'critical',
        status: 'dispatched',
      })
      .returning();
    validNotifId = notif.id;

    // Insert test signal
    await db.insert(hospitalIntelligenceSignals).values({
      id: validSignalId,
      signalType: 'CRITICAL_RESULT_UNACKNOWLEDGED',
      severity: 'CRITICAL',
      title: 'Policy Test Signal',
      description: 'Test signal for policy validation',
      status: 'analyzed',
      patientId: validPatientId,
      encounterId: validEncounterId,
      evidenceRefs: [
        {
          evidenceId: randomUUID(),
          sourceType: 'NOTIFICATION',
          sourceRecordId: validNotifId,
          relevantAt: new Date().toISOString(),
          evidenceStatus: 'present',
          authorizedVisibility: true,
          relationToSignal: 'Critical alert notification',
        },
      ],
      deterministicReason: 'notification SLA breach',
      recommendationId: validRecId,
      analysisCorrelationId: randomUUID(),
      requestedBy: physicianDeptA.staffId,
    });

    // Insert test recommendation
    await db.insert(intelligenceApprovedActions).values({
      id: validRecId,
      signalId: validSignalId,
      actionType: 'ACKNOWLEDGE_CRITICAL_ALERT',
      rationale: 'Acknowledge alert per SLA protocol',
      evidenceRefs: [],
      requiresHumanApproval: true,
      policyStatus: 'proposed',
      executableStatus: 'proposed',
      idempotencyKey: randomUUID(),
    });
  });

  describe('Permission & Role Enforcement', () => {
    it('allows physicians and hospital admins to approve', async () => {
      const resDoctor = await hospitalIntelligencePolicyEngine.evaluatePolicy(
        physicianDeptA,
        validRecId,
        'approve',
      );
      expect(resDoctor.allowed).toBe(true);
      expect(resDoctor.reasonCode).toBe('ALLOWED');

      const resAdmin = await hospitalIntelligencePolicyEngine.evaluatePolicy(
        adminActor,
        validRecId,
        'approve',
      );
      expect(resAdmin.allowed).toBe(true);
    });

    it('rejects roles lacking intelligence:approve (e.g. nurse, receptionist)', async () => {
      const resNurse = await hospitalIntelligencePolicyEngine.evaluatePolicy(
        nurseDeptA,
        validRecId,
        'approve',
      );
      expect(resNurse.allowed).toBe(false);
      expect(resNurse.reasonCode).toBe('UNAUTHORIZED_ROLE');
    });
  });

  describe('Break-Glass Prohibition', () => {
    it('denies governed action execution when break-glass is active', async () => {
      const res = await hospitalIntelligencePolicyEngine.evaluatePolicy(
        physicianDeptA,
        validRecId,
        'approve',
        { isBreakGlassActive: true },
      );
      expect(res.allowed).toBe(false);
      expect(res.reasonCode).toBe('BREAK_GLASS_PROHIBITED');
      expect(res.reason).toContain('Break-glass access cannot be used to bypass');
    });
  });

  describe('Department Isolation', () => {
    it('denies approval when a clinician belongs to a different department than the encounter', async () => {
      const foreignPhysician = {
        staffId: randomUUID(),
        role: 'physician',
        departmentId: deptB, // Different department
      };

      const res = await hospitalIntelligencePolicyEngine.evaluatePolicy(
        foreignPhysician,
        validRecId,
        'approve',
      );
      expect(res.allowed).toBe(false);
      expect(res.reasonCode).toBe('CROSS_DEPARTMENT_ACCESS_DENIED');
    });

    it('allows hospital admin to approve across departments', async () => {
      const foreignAdmin = {
        staffId: randomUUID(),
        role: 'hospital_admin',
        departmentId: deptB,
      };

      const res = await hospitalIntelligencePolicyEngine.evaluatePolicy(
        foreignAdmin,
        validRecId,
        'approve',
      );
      expect(res.allowed).toBe(true);
    });
  });

  describe('Action Allowlist Enforcement', () => {
    it('rejects recommendations with non-allowlisted action types', async () => {
      const invalidActionId = randomUUID();
      await db.insert(intelligenceApprovedActions).values({
        id: invalidActionId,
        signalId: validSignalId,
        actionType: 'UNAUTHORIZED_MEDICATION_CHANGE',
        rationale: 'Forged action',
        evidenceRefs: [],
        requiresHumanApproval: true,
        policyStatus: 'proposed',
        executableStatus: 'proposed',
        idempotencyKey: randomUUID(),
      });

      const res = await hospitalIntelligencePolicyEngine.evaluatePolicy(
        physicianDeptA,
        invalidActionId,
        'approve',
      );
      expect(res.allowed).toBe(false);
      expect(res.reasonCode).toBe('ACTION_TYPE_NOT_ALLOWLISTED');
    });
  });

  describe('State Machine Transitions', () => {
    it('denies approving a recommendation that is already executed', async () => {
      const executedRecId = randomUUID();
      await db.insert(intelligenceApprovedActions).values({
        id: executedRecId,
        signalId: validSignalId,
        actionType: 'ACKNOWLEDGE_CRITICAL_ALERT',
        rationale: 'Already done',
        evidenceRefs: [],
        requiresHumanApproval: true,
        policyStatus: 'executed',
        executableStatus: 'executed',
        idempotencyKey: randomUUID(),
      });

      const res = await hospitalIntelligencePolicyEngine.evaluatePolicy(
        physicianDeptA,
        executedRecId,
        'approve',
      );
      expect(res.allowed).toBe(false);
      expect(res.reasonCode).toBe('ALREADY_EXECUTED');
    });

    it('denies approving a recommendation that is already rejected', async () => {
      const rejectedRecId = randomUUID();
      await db.insert(intelligenceApprovedActions).values({
        id: rejectedRecId,
        signalId: validSignalId,
        actionType: 'ACKNOWLEDGE_CRITICAL_ALERT',
        rationale: 'Rejected',
        evidenceRefs: [],
        requiresHumanApproval: true,
        policyStatus: 'rejected',
        executableStatus: 'proposed',
        idempotencyKey: randomUUID(),
      });

      const res = await hospitalIntelligencePolicyEngine.evaluatePolicy(
        physicianDeptA,
        rejectedRecId,
        'approve',
      );
      expect(res.allowed).toBe(false);
      expect(res.reasonCode).toBe('ALREADY_REJECTED');
    });

    it('denies rejecting a recommendation that is already executed', async () => {
      const executedRecId = randomUUID();
      await db.insert(intelligenceApprovedActions).values({
        id: executedRecId,
        signalId: validSignalId,
        actionType: 'ACKNOWLEDGE_CRITICAL_ALERT',
        rationale: 'Executed',
        evidenceRefs: [],
        requiresHumanApproval: true,
        policyStatus: 'executed',
        executableStatus: 'executed',
        idempotencyKey: randomUUID(),
      });

      const res = await hospitalIntelligencePolicyEngine.evaluatePolicy(
        physicianDeptA,
        executedRecId,
        'reject',
      );
      expect(res.allowed).toBe(false);
      expect(res.reasonCode).toBe('ALREADY_EXECUTED');
    });
  });
});
