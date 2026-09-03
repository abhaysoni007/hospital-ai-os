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
import { encounters } from '../../../db/schema/appointments';
import { patients } from '../../../db/schema/patients';
import { notifications } from '../../../db/schema/tasks';
import { diagnosticOrders } from '../../../db/schema/diagnostics';
import { eq } from 'drizzle-orm';
import { ConflictError } from 'shared/src/errors/AppError';

/**
 * M19.3 — Governed Action Execution Integration Tests
 * SOURCE OF TRUTH: docs/architecture/M19_INTELLIGENCE_ARCHITECTURE.md §14, §15, §16
 *
 * Verifies that:
 * 1. Approved recommendations execute through existing authorized services.
 * 2. Navigation actions remain read-only with zero database mutations.
 * 3. Database-enforced idempotency prevents duplicate execution.
 * 4. Audit events are recorded without PHI.
 */

describe('M19.3 Governed Action Execution Integration', () => {
  const deptA = '0b14c48d-9a5e-4f6e-b2f0-3a7d1c9e8f00';
  const mockAudit = {
    logEvent: vi.fn().mockResolvedValue(undefined),
  } as unknown as AuditService;

  const physicianActor = {
    staffId: '63daab1f-ac27-494c-8257-daa6dac11796',
    role: 'physician',
    departmentId: deptA,
  };

  let service: HospitalIntelligenceService;
  let validSignalId: string;
  let validRecId: string;
  let validPatientId: string;
  let validEncounterId: string;
  let validNotifId: string;
  let validOrderId: string;

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
    physicianActor.departmentId = enc.departmentId;

    const [ord] = await db.select().from(diagnosticOrders).limit(1);
    validOrderId = ord.id;

    const [notif] = await db
      .insert(notifications)
      .values({
        recipientId: physicianActor.staffId,
        notificationType: 'critical_lab_alert',
        title: 'Execution Test Alert',
        body: 'Alert awaiting acknowledgment',
        priority: 'critical',
        status: 'dispatched',
      })
      .returning();
    validNotifId = notif.id;

    await db.insert(hospitalIntelligenceSignals).values({
      id: validSignalId,
      signalType: 'CRITICAL_RESULT_UNACKNOWLEDGED',
      severity: 'CRITICAL',
      title: 'Execution Test Signal',
      description: 'Test signal for execution',
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
        {
          evidenceId: randomUUID(),
          sourceType: 'DIAGNOSTIC_ORDER',
          sourceRecordId: validOrderId,
          relevantAt: new Date().toISOString(),
          evidenceStatus: 'present',
          authorizedVisibility: true,
          relationToSignal: 'Diagnostic order',
        },
      ],
      deterministicReason: 'critical alert SLA breach',
      recommendationId: validRecId,
      analysisCorrelationId: randomUUID(),
      requestedBy: physicianActor.staffId,
    });

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

  describe('Action: ACKNOWLEDGE_CRITICAL_ALERT', () => {
    it('approves and executes acknowledgment on notification table', async () => {
      const idempotencyKey = randomUUID();
      const correlationId = randomUUID();

      const result = await service.approveRecommendation(
        validRecId,
        idempotencyKey,
        physicianActor,
        correlationId,
        { executeImmediately: true },
      );

      expect(result.policyStatus).toBe('executed');
      expect(result.executableStatus).toBe('executed');
      expect(result.serviceInvoked).toBe('NotificationService');
      expect(result.idempotent).toBe(false);

      // Verify DB record updated
      const [rec] = await db
        .select()
        .from(intelligenceApprovedActions)
        .where(eq(intelligenceApprovedActions.id, validRecId));
      expect(rec.policyStatus).toBe('executed');

      // Verify target notification was marked acknowledged
      const [notif] = await db
        .select()
        .from(notifications)
        .where(eq(notifications.id, validNotifId));
      expect(notif.status).toBe('acknowledged');
      expect(notif.acknowledgedAt).not.toBeNull();

      // Verify parent signal is marked actioned
      const [sig] = await db
        .select()
        .from(hospitalIntelligenceSignals)
        .where(eq(hospitalIntelligenceSignals.id, validSignalId));
      expect(sig.status).toBe('actioned');

      // Verify audit events recorded
      expect(mockAudit.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'RECOMMENDATION_APPROVED' }),
        correlationId,
        expect.anything(),
      );
      expect(mockAudit.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'ACTION_EXECUTED' }),
        correlationId,
        expect.anything(),
      );
    });
  });

  describe('Action: NOTIFY_ATTENDING_PHYSICIAN', () => {
    it('dispatches a notification to attending doctor of encounter', async () => {
      const recId = randomUUID();
      await db.insert(intelligenceApprovedActions).values({
        id: recId,
        signalId: validSignalId,
        actionType: 'NOTIFY_ATTENDING_PHYSICIAN',
        rationale: 'Notify attending of bottleneck',
        evidenceRefs: [],
        requiresHumanApproval: true,
        policyStatus: 'proposed',
        executableStatus: 'proposed',
        idempotencyKey: randomUUID(),
      });

      const result = await service.approveRecommendation(
        recId,
        randomUUID(),
        physicianActor,
        randomUUID(),
        { executeImmediately: true },
      );

      expect(result.policyStatus).toBe('executed');
      expect(result.serviceInvoked).toBe('NotificationService');
      expect(result.details.notificationType).toBe('system_alert');
    });
  });

  describe('Navigation Actions (Read-Only)', () => {
    it('executes VIEW_PATIENT_RECORD as a read-only action with zero mutations', async () => {
      const recId = randomUUID();
      await db.insert(intelligenceApprovedActions).values({
        id: recId,
        signalId: validSignalId,
        actionType: 'VIEW_PATIENT_RECORD',
        rationale: 'Inspect patient chart',
        evidenceRefs: [],
        requiresHumanApproval: true,
        policyStatus: 'proposed',
        executableStatus: 'proposed',
        idempotencyKey: randomUUID(),
      });

      const result = await service.approveRecommendation(
        recId,
        randomUUID(),
        physicianActor,
        randomUUID(),
        { executeImmediately: true },
      );

      expect(result.policyStatus).toBe('executed');
      expect(result.serviceInvoked).toBe('FrontendNavigation');
      expect(result.details.isReadOnly).toBe(true);
      expect(result.details.mutationPerformed).toBe(false);
      expect(result.details.targetUrl).toBe(`/patients/${validPatientId}`);
    });

    it('executes VIEW_DIAGNOSTIC_ORDER as a read-only action with zero mutations', async () => {
      const recId = randomUUID();
      await db.insert(intelligenceApprovedActions).values({
        id: recId,
        signalId: validSignalId,
        actionType: 'VIEW_DIAGNOSTIC_ORDER',
        rationale: 'Inspect diagnostic order details',
        evidenceRefs: [],
        requiresHumanApproval: true,
        policyStatus: 'proposed',
        executableStatus: 'proposed',
        idempotencyKey: randomUUID(),
      });

      const result = await service.approveRecommendation(
        recId,
        randomUUID(),
        physicianActor,
        randomUUID(),
        { executeImmediately: true },
      );

      expect(result.policyStatus).toBe('executed');
      expect(result.serviceInvoked).toBe('FrontendNavigation');
      expect(result.details.isReadOnly).toBe(true);
      expect(result.details.targetUrl).toBe(`/diagnostics/${validOrderId}`);
    });
  });

  describe('Idempotency & Concurrency Guarantees', () => {
    it('returns cached execution result when repeated with same idempotency key', async () => {
      const idempotencyKey = randomUUID();

      const firstRun = await service.approveRecommendation(
        validRecId,
        idempotencyKey,
        physicianActor,
        randomUUID(),
        { executeImmediately: true },
      );
      expect(firstRun.idempotent).toBe(false);

      const secondRun = await service.approveRecommendation(
        validRecId,
        idempotencyKey,
        physicianActor,
        randomUUID(),
        { executeImmediately: true },
      );
      expect(secondRun.idempotent).toBe(true);
      expect(secondRun.policyStatus).toBe('executed');
    });

    it('throws 409 Conflict when attempting to execute with a different idempotency key', async () => {
      const key1 = randomUUID();
      const key2 = randomUUID();

      await service.approveRecommendation(
        validRecId,
        key1,
        physicianActor,
        randomUUID(),
        { executeImmediately: true },
      );

      await expect(
        service.approveRecommendation(
          validRecId,
          key2, // Different key
          physicianActor,
          randomUUID(),
          { executeImmediately: true },
        ),
      ).rejects.toThrow(ConflictError);
    });
  });

  describe('Rejection Flow', () => {
    it('rejection marks action rejected and signal dismissed', async () => {
      const result = await service.rejectRecommendation(
        validRecId,
        'Clinician determined alert already addressed verbally',
        physicianActor,
        randomUUID(),
      );

      expect(result.status).toBe('rejected');

      const [rec] = await db
        .select()
        .from(intelligenceApprovedActions)
        .where(eq(intelligenceApprovedActions.id, validRecId));
      expect(rec.policyStatus).toBe('rejected');
      expect(rec.rejectionReason).toContain('addressed verbally');

      const [sig] = await db
        .select()
        .from(hospitalIntelligenceSignals)
        .where(eq(hospitalIntelligenceSignals.id, validSignalId));
      expect(sig.status).toBe('dismissed');
    });
  });

  describe('Audit Trail Verification', () => {
    it('audits actions without containing raw PHI in actionDetail', async () => {
      const correlationId = randomUUID();
      await service.approveRecommendation(
        validRecId,
        randomUUID(),
        physicianActor,
        correlationId,
        { executeImmediately: true },
      );

      for (const call of (mockAudit.logEvent as any).mock.calls) {
        const auditEvent = call[0];
        const detailStr = JSON.stringify(auditEvent.actionDetail || {});
        // Confirm no patient name or clinical note free text in detail
        expect(detailStr).not.toContain('patientName');
        expect(detailStr).not.toContain('freeText');
      }
    });
  });
});
