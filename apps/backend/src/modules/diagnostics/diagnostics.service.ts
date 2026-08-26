import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../../db';
import { diagnosticOrders, diagnosticResults } from '../../db/schema/diagnostics';
import { encounters } from '../../db/schema/appointments';
import {
  CreateDiagnosticOrderRequest,
  GetDiagnosticOrdersQuery,
  CancelDiagnosticOrderRequest,
  EnterResultRequest,
  DiagnosticOrderResponse,
  DiagnosticResultResponse,
  EvaluationSnapshot,
} from 'shared';
import { AuthorizationError, ConflictError, NotFoundError } from 'shared/src/errors/AppError';
import { auditService } from '../audit/audit.service';
import { criticalValueRules } from '../../db/schema/diagnostics';
import { notifications as notificationsTable } from '../../db/schema/tasks';
import { evaluateCriticalValues, type EvaluatorRule } from './critical-value-evaluator';
import { RESULT_ENTRY_ALLOWED } from './diagnostics.state-machine';

type AuthContext = { role: string; departmentId: string };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toOrderResponse(row: any): DiagnosticOrderResponse {
  return {
    id: row.id,
    encounterId: row.encounterId,
    patientId: row.patientId,
    orderingDoctorId: row.orderingDoctorId,
    testCode: row.testCode,
    testName: row.testName,
    priority: row.priority,
    status: row.status,
    clinicalIndication: row.clinicalIndication ?? null,
    collectedAt: row.collectedAt ? new Date(row.collectedAt).toISOString() : null,
    collectedBy: row.collectedBy ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toResultResponse(row: any): DiagnosticResultResponse {
  return {
    id: row.id,
    orderId: row.orderId,
    patientId: row.patientId,
    testCode: row.testCode,
    resultValues: row.resultValues,
    referenceRange: row.referenceRange ?? null,
    isAbnormal: row.isAbnormal,
    isCritical: row.isCritical,
    criticalRuleId: row.criticalRuleId ?? null,
    status: row.status,
    enteredBy: row.enteredBy,
    verifiedBy: row.verifiedBy ?? null,
    verifiedAt: row.verifiedAt ? new Date(row.verifiedAt).toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class DiagnosticsService {
  /**
   * Places a lab order on an ACTIVE encounter.
   * Physician must be the assigned doctor; patient/department inherited
   * server-side from the encounter (ADR-016 Decision 8).
   */
  async createOrder(
    encounterId: string,
    payload: CreateDiagnosticOrderRequest,
    doctorId: string,
    correlationId: string,
    authContext: AuthContext,
  ) {
    if (authContext.role !== 'physician') {
      throw new AuthorizationError('Only physicians may place diagnostic orders.');
    }

    const encounter = await db.query.encounters.findFirst({
      where: eq(encounters.id, encounterId),
    });
    if (!encounter) {
      throw new NotFoundError('Encounter not found', { code: 'ENCOUNTER_NOT_FOUND' });
    }
    if (encounter.doctorId !== doctorId) {
      throw new AuthorizationError('Only the assigned physician may order for this encounter.');
    }
    if (encounter.status !== 'active') {
      throw new ConflictError(
        `Diagnostic orders require an active encounter (current: ${encounter.status}).`,
        { code: 'ENCOUNTER_NOT_ACTIVE' },
      );
    }

    return await db.transaction(async (tx) => {
      const [order] = await tx
        .insert(diagnosticOrders)
        .values({
          encounterId,
          patientId: encounter.patientId, // server-side inheritance only
          orderingDoctorId: doctorId,
          testCode: payload.testCode,
          testName: payload.testName,
          priority: payload.priority,
          clinicalIndication: payload.clinicalIndication,
          status: 'ordered',
        })
        .returning();

      await auditService.logEvent(
        {
          eventType: 'DIAGNOSTIC_ORDER_CREATED',
          actorId: doctorId,
          actorRole: authContext.role,
          actorDepartment: authContext.departmentId,
          targetType: 'DIAGNOSTIC_ORDER',
          targetId: order.id,
          patientId: order.patientId,
          actionDetail: {
            encounterId,
            testCode: order.testCode,
            priority: order.priority,
          },
        },
        correlationId,
        tx,
      );

      return toOrderResponse(order);
    });
  }

  /** Orders attached to one encounter (department parity). */
  async listEncounterOrders(
    encounterId: string,
    actorId: string,
    correlationId: string,
    authContext: AuthContext,
  ) {
    const encounter = await db.query.encounters.findFirst({
      where: eq(encounters.id, encounterId),
    });
    if (!encounter) {
      throw new NotFoundError('Encounter not found', { code: 'ENCOUNTER_NOT_FOUND' });
    }
    this.assertReadScope(encounter.departmentId, authContext);
    void actorId;
    void correlationId;

    const rows = await db.query.diagnosticOrders.findMany({
      where: eq(diagnosticOrders.encounterId, encounterId),
      orderBy: [desc(diagnosticOrders.createdAt)],
    });
    return { data: rows.map(toOrderResponse) };
  }

  /**
   * ADR-016 lab queue. Department scope forced from the JWT — query
   * parameters cannot bypass it (orders carry no department; joined via the
   * encounter).
   */
  async listLabQueue(query: GetDiagnosticOrdersQuery, authContext: AuthContext) {
    const page = query.page || 1;
    const limit = query.pageSize || 50;
    const offset = (page - 1) * limit;

    const conditions = [sql`${encounters.departmentId} = ${authContext.departmentId}`];
    if (query.status) conditions.push(eq(diagnosticOrders.status, query.status));
    if (query.priority) conditions.push(eq(diagnosticOrders.priority, query.priority));
    if (query.date) conditions.push(sql`${diagnosticOrders.createdAt}::date = ${query.date}::date`);

    const rows = await db
      .select({ order: diagnosticOrders })
      .from(diagnosticOrders)
      .innerJoin(encounters, eq(diagnosticOrders.encounterId, encounters.id))
      .where(and(...conditions))
      .orderBy(desc(diagnosticOrders.createdAt))
      .limit(limit)
      .offset(offset);

    const total = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(diagnosticOrders)
      .innerJoin(encounters, eq(diagnosticOrders.encounterId, encounters.id))
      .where(and(...conditions));

    return {
      data: rows.map((r) => toOrderResponse(r.order)),
      meta: {
        total: total[0]?.count ?? 0,
        page,
        limit,
        totalPages: Math.ceil((total[0]?.count ?? 0) / limit),
      },
    };
  }

  /** Single order detail. */
  async getOrder(id: string, _actorId: string, authContext: AuthContext) {
    const row = await db
      .select({ order: diagnosticOrders, dept: encounters.departmentId })
      .from(diagnosticOrders)
      .innerJoin(encounters, eq(diagnosticOrders.encounterId, encounters.id))
      .where(eq(diagnosticOrders.id, id))
      .limit(1);

    if (row.length === 0) {
      throw new NotFoundError('Diagnostic order not found', { code: 'ORDER_NOT_FOUND' });
    }
    this.assertReadScope(row[0].dept, authContext);
    void _actorId;
    return toOrderResponse(row[0].order);
  }

  /**
   * Sample collection — exactly once. Row lock + status guard; provenance
   * columns set atomically (ADR-016 Decision 4).
   */
  async collectSample(
    orderId: string,
    techId: string,
    correlationId: string,
    authContext: AuthContext,
  ) {
    if (authContext.role !== 'lab_technician') {
      throw new AuthorizationError('Only laboratory technicians may collect samples.');
    }

    return await db.transaction(async (tx) => {
      const rows = await tx
        .select({ order: diagnosticOrders, dept: encounters.departmentId })
        .from(diagnosticOrders)
        .innerJoin(encounters, eq(diagnosticOrders.encounterId, encounters.id))
        .where(eq(diagnosticOrders.id, orderId))
        .for('update');

      if (rows.length === 0) {
        throw new NotFoundError('Diagnostic order not found', { code: 'ORDER_NOT_FOUND' });
      }
      const order = rows[0].order;
      if (rows[0].dept !== authContext.departmentId) {
        throw new AuthorizationError('Order is outside your department.');
      }
      if (order.status !== 'ordered') {
        throw new ConflictError(
          `Only ordered samples can be collected (current: ${order.status}).`,
          { code: 'INVALID_TRANSITION' },
        );
      }

      const now = new Date();
      const updated = await tx
        .update(diagnosticOrders)
        .set({
          status: 'sample_collected',
          collectedAt: now,
          collectedBy: techId,
          updatedAt: now,
        })
        .where(and(eq(diagnosticOrders.id, orderId), eq(diagnosticOrders.status, 'ordered')))
        .returning();

      await auditService.logEvent(
        {
          eventType: 'SAMPLE_COLLECTED',
          actorId: techId,
          actorRole: authContext.role,
          actorDepartment: authContext.departmentId,
          targetType: 'DIAGNOSTIC_ORDER',
          targetId: orderId,
          patientId: order.patientId,
          actionDetail: { collectedAt: now.toISOString(), testCode: order.testCode },
        },
        correlationId,
        tx,
      );

      return toOrderResponse(updated[0]);
    });
  }

  /**
   * Ordering physician, own order, pre-collection only (ADR-016 Decision 2).
   */
  async cancelOrder(
    orderId: string,
    payload: CancelDiagnosticOrderRequest,
    cancellerId: string,
    correlationId: string,
    authContext: AuthContext,
  ) {
    if (authContext.role !== 'physician') {
      throw new AuthorizationError('Only physicians may cancel diagnostic orders.');
    }

    return await db.transaction(async (tx) => {
      const rows = await tx
        .select()
        .from(diagnosticOrders)
        .where(eq(diagnosticOrders.id, orderId))
        .for('update');

      if (rows.length === 0) {
        throw new NotFoundError('Diagnostic order not found', { code: 'ORDER_NOT_FOUND' });
      }
      const order = rows[0];
      if (order.orderingDoctorId !== cancellerId) {
        throw new AuthorizationError('Only the ordering physician may cancel this order.');
      }
      if (order.status !== 'ordered') {
        throw new ConflictError(
          `Only ordered orders can be cancelled (current: ${order.status}) — collection has started.`,
          { code: 'INVALID_TRANSITION' },
        );
      }

      const updated = await tx
        .update(diagnosticOrders)
        .set({ status: 'cancelled', updatedAt: new Date() })
        .where(and(eq(diagnosticOrders.id, orderId), eq(diagnosticOrders.status, 'ordered')))
        .returning();

      await auditService.logEvent(
        {
          eventType: 'DIAGNOSTIC_ORDER_CANCELLED',
          actorId: cancellerId,
          actorRole: authContext.role,
          actorDepartment: authContext.departmentId,
          targetType: 'DIAGNOSTIC_ORDER',
          targetId: orderId,
          patientId: order.patientId,
          actionDetail: { reason: payload.reason ?? null, testCode: order.testCode },
        },
        correlationId,
        tx,
      );

      return toOrderResponse(updated[0]);
    });
  }

  /**
   * Result entry. Lab technician, dept parity, order collectable, one result
   * per order. Evaluation is deterministic and SERVER-SIDE ONLY.
   * Critical ⇒ CRITICAL_VALUE_DETECTED audit + notification row in THIS tx.
   */
  async enterResult(
    orderId: string,
    payload: EnterResultRequest,
    techId: string,
    correlationId: string,
    authContext: AuthContext,
  ) {
    if (authContext.role !== 'lab_technician') {
      throw new AuthorizationError('Only laboratory technicians may enter results.');
    }

    return await db.transaction(async (tx) => {
      const rows = await tx
        .select({ order: diagnosticOrders, dept: encounters.departmentId })
        .from(diagnosticOrders)
        .innerJoin(encounters, eq(diagnosticOrders.encounterId, encounters.id))
        .where(eq(diagnosticOrders.id, orderId))
        .for('update');

      if (rows.length === 0) {
        throw new NotFoundError('Diagnostic order not found', { code: 'ORDER_NOT_FOUND' });
      }
      const order = rows[0].order;
      if (rows[0].dept !== authContext.departmentId) {
        throw new AuthorizationError('Order is outside your department.');
      }
      // Duplicate guard (unique index remains authoritative backstop).
      const existing = await tx.query.diagnosticResults.findFirst({
        where: eq(diagnosticResults.orderId, orderId),
      });
      if (existing) {
        throw new ConflictError('A result already exists for this order.', {
          code: 'RESULT_ALREADY_EXISTS',
        });
      }
      if (!RESULT_ENTRY_ALLOWED.includes(order.status)) {
        throw new ConflictError(
          `Results can only be entered after sample collection (current: ${order.status}).`,
          { code: 'INVALID_TRANSITION' },
        );
      }

      // Load ACTIVE rules for this test — pure evaluation happens in-memory.
      const rules = await tx.query.criticalValueRules.findMany({
        where: eq(criticalValueRules.isActive, true),
      });
      const applicable: EvaluatorRule[] = rules.filter((r) => r.testCode === order.testCode);

      const evaluation = evaluateCriticalValues(order.testCode, payload.resultValues, applicable);

      const insertValues = {
        orderId,
        patientId: order.patientId,
        testCode: order.testCode,
        resultValues: payload.resultValues,
        referenceRange: evaluation as unknown as EvaluationSnapshot,
        isAbnormal: evaluation.isAbnormal,
        isCritical: evaluation.isCritical,
        criticalRuleId: evaluation.criticalRuleId,
        status: (evaluation.isCritical ? 'critical_flagged' : 'preliminary') as
          'critical_flagged' | 'preliminary',
        enteredBy: techId,
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let inserted: any;
      try {
        const rows = await tx.insert(diagnosticResults).values(insertValues).returning();
        inserted = rows[0];
      } catch (err) {
        // Unique(order_id) is the authoritative duplicate backstop under races.
        if ((err as { code?: string }).code === '23505') {
          throw new ConflictError('A result already exists for this order.', {
            code: 'RESULT_ALREADY_EXISTS',
          });
        }
        throw err;
      }
      const result = inserted;

      await auditService.logEvent(
        {
          eventType: 'LAB_RESULT_ENTERED',
          actorId: techId,
          actorRole: authContext.role,
          actorDepartment: authContext.departmentId,
          targetType: 'DIAGNOSTIC_RESULT',
          targetId: result.id,
          patientId: order.patientId,
          actionDetail: {
            orderId,
            testCode: order.testCode,
            isCritical: evaluation.isCritical,
            parameterNames: payload.resultValues.map((v) => v.parameterName),
          },
        },
        correlationId,
        tx,
      );

      if (evaluation.isCritical) {
        await auditService.logEvent(
          {
            eventType: 'CRITICAL_VALUE_DETECTED',
            actorId: techId,
            actorRole: authContext.role,
            actorDepartment: authContext.departmentId,
            targetType: 'DIAGNOSTIC_RESULT',
            targetId: result.id,
            patientId: order.patientId,
            actionDetail: {
              orderId,
              testCode: order.testCode,
              matchedRuleIds: evaluation.matchedRuleIds,
              criticalParameterNames: evaluation.parameters
                .filter((p) => p.verdict === 'critical')
                .map((p) => p.parameterName),
            },
          },
          correlationId,
          tx,
        );

        // Outbox-via-notifications (ADR-016 Decision 1): same transaction.
        // Body carries test name + pointer metadata ONLY — no MRN/values.
        await tx.insert(notificationsTable).values({
          recipientId: order.orderingDoctorId,
          notificationType: 'critical_lab_alert',
          title: `Critical lab value: ${order.testName}`,
          body: `${order.testName} (${order.testCode}) flagged CRITICAL and requires immediate physician review.`,
          referenceType: 'DiagnosticResult',
          referenceId: result.id,
          priority: 'critical',
          status: 'dispatched',
        });

        await auditService.logEvent(
          {
            eventType: 'CRITICAL_VALUE_NOTIFIED',
            actorId: techId,
            actorRole: authContext.role,
            actorDepartment: authContext.departmentId,
            targetType: 'NOTIFICATION',
            targetId: result.id,
            patientId: order.patientId,
            actionDetail: {
              recipientId: order.orderingDoctorId,
              orderId,
              testCode: order.testCode,
            },
          },
          correlationId,
          tx,
        );
      }

      return toResultResponse(result);
    });
  }

  /** Result read. Department parity via the order's encounter. */
  async getResult(orderId: string, actorId: string, authContext: AuthContext) {
    const row = await db
      .select({ result: diagnosticResults, dept: encounters.departmentId })
      .from(diagnosticResults)
      .innerJoin(diagnosticOrders, eq(diagnosticResults.orderId, diagnosticOrders.id))
      .innerJoin(encounters, eq(diagnosticOrders.encounterId, encounters.id))
      .where(eq(diagnosticResults.orderId, orderId))
      .limit(1);

    if (row.length === 0) {
      throw new NotFoundError('Result not found', { code: 'RESULT_NOT_FOUND' });
    }
    this.assertReadScope(row[0].dept, authContext);
    void actorId;
    return toResultResponse(row[0].result);
  }

  /**
   * Verification: lab technician, four-eyes (verifier ≠ enterer), guarded
   * transition; atomically completes the order (ADR-016 Decision 3).
   * Verified results are immutable — no correction path exists in M10.
   */
  async verifyResult(
    orderId: string,
    verifierId: string,
    correlationId: string,
    authContext: AuthContext,
  ) {
    if (authContext.role !== 'lab_technician') {
      throw new AuthorizationError('Only laboratory technicians may verify results.');
    }

    return await db.transaction(async (tx) => {
      const rows = await tx
        .select({ result: diagnosticResults, dept: encounters.departmentId })
        .from(diagnosticResults)
        .innerJoin(diagnosticOrders, eq(diagnosticResults.orderId, diagnosticOrders.id))
        .innerJoin(encounters, eq(diagnosticOrders.encounterId, encounters.id))
        .where(eq(diagnosticResults.orderId, orderId))
        .for('update');

      if (rows.length === 0) {
        throw new NotFoundError('Result not found', { code: 'RESULT_NOT_FOUND' });
      }
      const result = rows[0].result;
      if (rows[0].dept !== authContext.departmentId) {
        throw new AuthorizationError('Result is outside your department.');
      }
      // Four-eyes (ADR-016 Decision 6).
      if (result.enteredBy === verifierId) {
        throw new AuthorizationError(
          'Verification requires a second person: the enterer may not verify their own result.',
        );
      }
      if (result.status !== 'preliminary' && result.status !== 'critical_flagged') {
        throw new ConflictError(
          `Cannot verify a result in status '${result.status}' — verified results are immutable.`,
          { code: 'INVALID_TRANSITION' },
        );
      }

      const now = new Date();
      const updated = await tx
        .update(diagnosticResults)
        .set({
          status: 'verified',
          verifiedBy: verifierId,
          verifiedAt: now,
          updatedAt: now,
        })
        .where(
          and(
            eq(diagnosticResults.id, result.id),
            inArray(diagnosticResults.status, ['preliminary', 'critical_flagged']),
          ),
        )
        .returning();

      // Derived transition: verification completes the order (ADR-016 Decision 3).
      await tx
        .update(diagnosticOrders)
        .set({ status: 'completed', updatedAt: now })
        .where(
          and(
            eq(diagnosticOrders.id, orderId),
            inArray(diagnosticOrders.status, ['sample_collected', 'in_progress']),
          ),
        );

      await auditService.logEvent(
        {
          eventType: 'LAB_RESULT_VERIFIED',
          actorId: verifierId,
          actorRole: authContext.role,
          actorDepartment: authContext.departmentId,
          targetType: 'DIAGNOSTIC_RESULT',
          targetId: result.id,
          patientId: result.patientId,
          actionDetail: {
            orderId,
            previousStatus: result.status,
            enteredBy: result.enteredBy,
          },
        },
        correlationId,
        tx,
      );

      return toResultResponse(updated[0]);
    });
  }

  private assertReadScope(departmentId: string, authContext: AuthContext): void {
    // M12.1: pharmacist added — the frozen M5 matrix grants pharmacists
    // diagnostic_result:read; the previous exclusion made that grant dead.
    const allowed = ['physician', 'nurse', 'lab_technician', 'pharmacist'];
    if (!allowed.includes(authContext.role) || departmentId !== authContext.departmentId) {
      throw new AuthorizationError('Not permitted to access diagnostics for this department.');
    }
  }
}

export const diagnosticsService = new DiagnosticsService();
