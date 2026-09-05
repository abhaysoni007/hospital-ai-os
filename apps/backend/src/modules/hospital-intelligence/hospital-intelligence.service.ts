import {
  DetectedSignal,
  HospitalIntelligenceAnalysisResponse,
  AnalyzeHospitalIntelligenceRequest,
  hospitalBottleneckOutputSchema,
  HospitalBottleneckOutput,
  EvidenceRef,
  Recommendation,
  AiExplanation,
  GovernedActionResult,
  isValidId,
} from 'shared';
import {
  AuthorizationError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from 'shared/src/errors/AppError';
import { randomUUID } from 'crypto';
import { eq, and, sql, desc } from 'drizzle-orm';
import { db } from '../../db';
import {
  hospitalIntelligenceSignals,
  intelligenceApprovedActions,
} from '../../db/schema/hospital-intelligence';
import { AuditService, auditService } from '../audit/audit.service';
import { AIOrchestrator } from '../ai/orchestrator';
import { aiOrchestrator as defaultAiOrchestrator } from '../ai/ai.container';
import {
  buildHospitalIntelligenceAuditEvent,
  HOSPITAL_INTELLIGENCE_AUDIT_EVENTS,
  IntelligenceAuditActor,
} from './hospital-intelligence.audit';
import {
  detectAllBottlenecks,
  DetectorScope,
} from './hospital-intelligence.detector';
import { buildContextBlocksForSignal } from './hospital-intelligence.context';
import {
  HospitalIntelligencePolicyEngine,
  hospitalIntelligencePolicyEngine,
} from './hospital-intelligence.policy';
import {
  HospitalIntelligenceExecutor,
  hospitalIntelligenceExecutor,
} from './hospital-intelligence.executor';
import { hospitalAnalyticsClient, SignalInput, OperationalFeaturesInput, AnalyzeResponse } from './hospital-analytics.client';

/**
 * M19.2/M19.3 — Hospital Intelligence Service
 * SOURCE OF TRUTH: docs/architecture/M19_INTELLIGENCE_ARCHITECTURE.md §6, §7, §8, §14
 *
 * Core Principle: Deterministic detection first!
 * Database -> Deterministic queries -> Evidence Collection -> AI Explanation -> Persisted Signal
 *
 * AI recommends. Policy validates. Human authorizes. Existing services execute. Audit records everything.
 */
export class HospitalIntelligenceService {
  constructor(
    private readonly audit: AuditService = auditService,
    private readonly ai: AIOrchestrator = defaultAiOrchestrator,
    private readonly policy: HospitalIntelligencePolicyEngine = hospitalIntelligencePolicyEngine,
    private readonly executor: HospitalIntelligenceExecutor = hospitalIntelligenceExecutor,
  ) {}

  private async resolveValidStaffId(staffId: string): Promise<string | null> {
    if (!staffId || !isValidId(staffId)) return null;
    try {
      const [row] = (await db.execute(sql`
        SELECT id FROM staff WHERE id = ${staffId} LIMIT 1;
      `)) as unknown as Array<{ id: string }>;
      return row?.id ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Runs end-to-end bottleneck analysis:
   * 1. Deterministic detection of pending orders, critical alerts, and encounters without notes.
   * 2. Evidence assembly with real database record IDs.
   * 3. AI explanation generation through AIOrchestrator (with safe degradation if AI is unavailable).
   * 4. Persistence of detected signals and proposed recommendations.
   * 5. Hash-chained audit logging.
   */
  async analyzeHospitalOperations(
    request: AnalyzeHospitalIntelligenceRequest,
    actor: IntelligenceAuditActor,
    correlationId: string,
  ): Promise<HospitalIntelligenceAnalysisResponse> {
    const analysisId = randomUUID();
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      correlationId,
    );
    const analysisCorrelationId = isUuid ? correlationId : randomUUID();

    // 1. Audit Log: ANALYSIS_REQUESTED
    await this.audit.logEvent(
      buildHospitalIntelligenceAuditEvent({
        eventType: HOSPITAL_INTELLIGENCE_AUDIT_EVENTS.ANALYSIS_REQUESTED,
        actor,
        targetType: 'HOSPITAL_INTELLIGENCE_ANALYSIS',
        targetId: analysisId,
        actionDetail: {
          scope: request.scope,
          departmentId: actor.role === 'hospital_admin' ? null : actor.departmentId,
        },
      }),
      correlationId,
    );

    // 2. Resolve Scope: Physicians and nurses see only their department; hospital_admin can see all
    const detectorScope: DetectorScope = {
      departmentId:
        actor.role === 'hospital_admin'
          ? request.scope === 'hospital_admin'
            ? undefined
            : actor.departmentId
          : actor.departmentId,
    };

    // 3. Deterministic Detection (NEVER invented by AI)
    const limit = request.limit ?? 10;
    const allSignals = await detectAllBottlenecks(
      detectorScope,
      analysisCorrelationId,
    );
    const detectedSignals = allSignals.slice(0, limit);

    // 3.5. Zero-PHI Operational Analytics (Safe Fallback if Python is unavailable)
    let analyticsResult: AnalyzeResponse | null = null;
    try {
      const analyticsSignals: SignalInput[] = detectedSignals.map((s) => ({
        signal_id: s.signalId,
        signal_type: (s.signalType || (s as any).type) as SignalInput['signal_type'],
        severity: s.severity as SignalInput['severity'],
        age_minutes: s.detectedAt ? Math.max(0, (Date.now() - new Date(s.detectedAt).getTime()) / 60000) : 0,
        metadata: {}, // strict zero-PHI boundary: no patient or clinical data
      }));

      // Calculate operational features based on authoritative detection
      const pendingOrders = detectedSignals.filter((s) => (s.signalType || (s as any).type) === 'PENDING_DIAGNOSTIC_RESULT');
      const criticalResults = detectedSignals.filter((s) => (s.signalType || (s as any).type) === 'CRITICAL_RESULT_UNACKNOWLEDGED');
      const undocumentedEncounters = detectedSignals.filter((s) => (s.signalType || (s as any).type) === 'ENCOUNTER_WITHOUT_CLINICAL_RECORD');

      let activeEncounters = 0;
      try {
        const deptFilter = detectorScope.departmentId
          ? sql`AND department_id = ${detectorScope.departmentId}`
          : sql``;
        const res = (await db.execute(
          sql`SELECT COUNT(*)::int AS count FROM encounters WHERE status = 'active' ${deptFilter}`,
        )) as unknown as { count: number }[];
        if (res && res[0]?.count !== undefined) {
          activeEncounters = Number(res[0].count);
        }
      } catch {
        // Safe fallback in mock or non-Postgres test environments
      }

      const features: OperationalFeaturesInput = {
        active_encounters: activeEncounters,
        pending_diagnostic_orders: pendingOrders.length,
        unacknowledged_critical_results: criticalResults.length,
        encounters_without_clinical_record: undocumentedEncounters.length,
        stalled_orders_over_sla: pendingOrders.filter((s) => s.severity === 'CRITICAL' || s.severity === 'HIGH').length,
        average_pending_age_minutes:
          analyticsSignals.length > 0
            ? analyticsSignals.reduce((acc, curr) => acc + curr.age_minutes, 0) / analyticsSignals.length
            : 0,
      };

      analyticsResult = await hospitalAnalyticsClient.analyze({
        analysis_id: analysisId,
        correlation_id: analysisCorrelationId,
        scope: request.scope,
        department_id: actor.role === 'hospital_admin' ? null : actor.departmentId,
        signals: analyticsSignals,
        operational_features: features,
      });

      // Python output is strictly advisory:
      // We do NOT modify safety semantics or clinical authority.
    } catch {
      // Sidecar failure must never crash Hospital Intelligence
      analyticsResult = null;
    }

    let aiSuccesses = 0;
    let aiAttempts = 0;

    // 4. For each detected signal: assemble context and request AI explanation
    for (const signal of detectedSignals) {
      // Idempotency / Deduplication check:
      // If an active signal already exists for this exact condition, reuse its ID to prevent duplicates
      const existing = await this.findActiveSignal(signal);
      if (existing) {
        signal.signalId = existing.id;
      }

      // Build bounded, authorized context blocks
      const blocks = await buildContextBlocksForSignal(signal);

      // Attempt AI explanation
      aiAttempts++;
      let interactionId: string | null = null;

      try {
        const aiResult = await this.ai.invokeStructured<HospitalBottleneckOutput>({
          capability: 'hospital_bottleneck',
          principal: {
            staffId: actor.staffId,
            role: actor.role,
            departmentId: actor.departmentId,
          },
          patientId: signal.patientId ?? undefined,
          encounterId: signal.encounterId ?? undefined,
          blocks,
          instructions: `Analyze workflow bottleneck: ${signal.title}. Deterministic reason: ${signal.deterministicReason}`,
          outputSchema: hospitalBottleneckOutputSchema,
          correlationId: analysisCorrelationId,
        });

        interactionId = aiResult.interactionId;

        if (aiResult.status === 'grounded' && aiResult.parsed) {
          const parsed = aiResult.parsed;
          const recommendationId = randomUUID();

          signal.aiExplanation = {
            summary: parsed.summary,
            clinicalImpact: parsed.clinicalImpact,
            citations: parsed.citations,
            disclaimers: parsed.disclaimers,
            informationGaps: parsed.informationGaps,
            groundingStatus: 'grounded',
          };

          const recommendation: Recommendation = {
            recommendationId,
            signalId: signal.signalId,
            actionType: parsed.recommendation.actionType,
            rationale: parsed.recommendation.rationale,
            evidenceRefs: [signal.evidenceRefs[0].evidenceId],
            uncertaintyNote: parsed.recommendation.uncertaintyNote,
            limitationsNote: parsed.recommendation.limitationsNote,
            requiresHumanApproval: true,
            policyStatus: 'proposed',
            executableStatus: 'proposed',
            createdAt: new Date().toISOString(),
          };

          signal.recommendation = recommendation;
          signal.status = 'analyzed';
          aiSuccesses++;

          // Audit Log: RECOMMENDATION_PROPOSED
          await this.audit.logEvent(
            buildHospitalIntelligenceAuditEvent({
              eventType: HOSPITAL_INTELLIGENCE_AUDIT_EVENTS.RECOMMENDATION_PROPOSED,
              actor,
              targetType: 'INTELLIGENCE_RECOMMENDATION',
              targetId: recommendationId,
              patientId: signal.patientId,
              actionDetail: {
                signalId: signal.signalId,
                actionType: recommendation.actionType,
                requiresApproval: true,
                policyStatus: 'proposed',
              },
            }),
            correlationId,
          );
        } else {
          // AI validation failed -> safe degradation
          signal.aiExplanation = null;
          signal.recommendation = null;
        }
      } catch (err) {
        // AI error, timeout, or circuit breaker -> safe degradation
        signal.aiExplanation = null;
        signal.recommendation = null;
      }

      // 5. Persist signal and proposed recommendation
      await this.persistSignal(signal, actor.staffId, analysisCorrelationId, interactionId);
    }

    // 6. Overall AI status
    let aiStatus: 'grounded' | 'degraded' | 'unavailable' = 'grounded';
    if (detectedSignals.length > 0) {
      if (aiSuccesses === 0) {
        aiStatus = 'unavailable';
      } else if (aiSuccesses < aiAttempts) {
        aiStatus = 'degraded';
      }
    }

    // 7. Audit Log: ANALYSIS_COMPLETED
    await this.audit.logEvent(
      buildHospitalIntelligenceAuditEvent({
        eventType: HOSPITAL_INTELLIGENCE_AUDIT_EVENTS.ANALYSIS_COMPLETED,
        actor,
        targetType: 'HOSPITAL_INTELLIGENCE_ANALYSIS',
        targetId: analysisId,
        actionDetail: {
          signalCount: detectedSignals.length,
          aiStatus,
          criticalCount: detectedSignals.filter((s) => s.severity === 'CRITICAL').length,
        },
      }),
      correlationId,
    );

    return {
      analysisId,
      requestedAt: new Date().toISOString(),
      signals: detectedSignals,
      aiStatus,
      correlationId: analysisCorrelationId,
      ...(analyticsResult && { analytics: analyticsResult }),
    };
  }

  /**
   * Retrieves active signals for the actor's authorized scope.
   */
  async getSignals(
    actor: IntelligenceAuditActor,
    _scope?: string,
  ): Promise<DetectedSignal[]> {
    const rows = await db
      .select()
      .from(hospitalIntelligenceSignals)
      .where(
        actor.role === 'hospital_admin'
          ? sql`status != 'resolved'`
          : and(
              sql`status != 'resolved'`,
              // Department filter: join encounters or check staff department
              sql`EXISTS (
                SELECT 1 FROM encounters e
                WHERE e.id = ${hospitalIntelligenceSignals.encounterId}
                AND e.department_id = ${actor.departmentId}
              )`,
            ),
      )
      .orderBy(desc(hospitalIntelligenceSignals.detectedAt));

    return rows.map((r) => this.mapDbRowToSignal(r));
  }

  /**
   * Retrieves a single signal by ID, verifying department scope authorization.
   */
  async getSignalById(
    signalId: string,
    actor: IntelligenceAuditActor,
  ): Promise<DetectedSignal | null> {
    const [row] = await db
      .select()
      .from(hospitalIntelligenceSignals)
      .where(eq(hospitalIntelligenceSignals.id, signalId))
      .limit(1);

    if (!row) return null;

    // If not hospital_admin, verify department authorization
    if (actor.role !== 'hospital_admin' && row.encounterId) {
      const authCheck = (await db.execute(sql`
        SELECT 1 FROM encounters WHERE id = ${row.encounterId} AND department_id = ${actor.departmentId} LIMIT 1;
      `)) as unknown as Array<{ '1': number }>;

      if (authCheck.length === 0) {
        return null; // Deny cross-department read
      }
    }

    return this.mapDbRowToSignal(row);
  }

  /**
   * Approves a recommendation under human authorization.
   * Runs deterministic policy validation, executes atomic transaction with row-level locking,
   * enforces idempotency, audits RECOMMENDATION_APPROVED, and optionally executes immediately.
   */
  async approveRecommendation(
    recommendationId: string,
    idempotencyKey: string,
    actor: IntelligenceAuditActor,
    correlationId: string,
    options?: {
      executeImmediately?: boolean;
      targetAssigneeId?: string;
      isBreakGlassActive?: boolean;
    },
  ): Promise<GovernedActionResult> {
    // 1. Evaluate deterministic policy
    const policy = await this.policy.evaluatePolicy(actor, recommendationId, 'approve', {
      isBreakGlassActive: options?.isBreakGlassActive,
      targetAssigneeId: options?.targetAssigneeId,
      idempotencyKey,
    });

    if (!policy.allowed) {
      await this.audit.logEvent(
        buildHospitalIntelligenceAuditEvent({
          eventType: HOSPITAL_INTELLIGENCE_AUDIT_EVENTS.RECOMMENDATION_POLICY_REJECTED,
          actor,
          targetType: 'INTELLIGENCE_RECOMMENDATION',
          targetId: recommendationId,
          actionDetail: {
            reasonCode: policy.reasonCode,
            reason: policy.reason,
            phase: 'approve',
          },
        }),
        correlationId,
      );

      if (
        policy.reasonCode === 'UNAUTHORIZED_ROLE' ||
        policy.reasonCode === 'CROSS_DEPARTMENT_ACCESS_DENIED' ||
        policy.reasonCode === 'BREAK_GLASS_PROHIBITED'
      ) {
        throw new AuthorizationError(policy.reason, { code: policy.reasonCode });
      }
      if (
        policy.reasonCode === 'RECOMMENDATION_NOT_FOUND' ||
        policy.reasonCode === 'SIGNAL_NOT_FOUND'
      ) {
        throw new NotFoundError(policy.reason, { code: policy.reasonCode });
      }
      if (
        policy.reasonCode === 'ALREADY_EXECUTED' ||
        policy.reasonCode === 'ALREADY_REJECTED' ||
        policy.reasonCode === 'INVALID_STATUS_TRANSITION'
      ) {
        throw new ConflictError(policy.reason, { code: policy.reasonCode });
      }
      throw new ValidationError(policy.reason, { code: policy.reasonCode });
    }

    const validStaffId = (await this.resolveValidStaffId(actor.staffId)) || null;

    // 2. Transaction with row-level locking for concurrency and idempotency safety
    return await db.transaction(async (tx) => {
      const [rec] = await tx
        .select()
        .from(intelligenceApprovedActions)
        .where(eq(intelligenceApprovedActions.id, recommendationId))
        .for('update');

      if (!rec) {
        throw new NotFoundError(`Recommendation '${recommendationId}' not found.`, {
          code: 'RECOMMENDATION_NOT_FOUND',
        });
      }

      // Idempotency: if already executed with the same key, return previous result
      if (rec.policyStatus === 'executed') {
        if (rec.idempotencyKey === idempotencyKey) {
          const cachedResult = (rec.executionResult as Record<string, unknown>) || {};
          return {
            recommendationId: rec.id,
            signalId: rec.signalId,
            actionType: rec.actionType as any,
            policyStatus: 'executed',
            executableStatus: 'executed',
            executedBy: rec.approvedBy || actor.staffId,
            executedAt: (rec.updatedAt || new Date()).toISOString(),
            idempotent: true,
            serviceInvoked: (cachedResult.serviceInvoked as string) || 'ExistingService',
            details: (cachedResult.details as Record<string, unknown>) || {},
          };
        }
        throw new ConflictError(
          'Recommendation has already been executed under a different idempotency key.',
          { code: 'RECOMMENDATION_ALREADY_ACTED' },
        );
      }

      if (rec.policyStatus === 'rejected') {
        throw new ConflictError('Recommendation has already been rejected.', {
          code: 'ALREADY_REJECTED',
        });
      }

      const now = new Date();

      // Persist approval
      await tx
        .update(intelligenceApprovedActions)
        .set({
          policyStatus: 'approved',
          approvedBy: validStaffId,
          approvedAt: now,
          idempotencyKey,
          updatedAt: now,
        })
        .where(eq(intelligenceApprovedActions.id, recommendationId));

      await this.audit.logEvent(
        buildHospitalIntelligenceAuditEvent({
          eventType: HOSPITAL_INTELLIGENCE_AUDIT_EVENTS.RECOMMENDATION_APPROVED,
          actor,
          targetType: 'INTELLIGENCE_RECOMMENDATION',
          targetId: recommendationId,
          patientId: policy.context?.signal.patientId,
          actionDetail: {
            idempotencyKey,
            actionType: rec.actionType,
            signalId: rec.signalId,
          },
        }),
        correlationId,
        tx,
      );

      // If immediate execution is not requested, return the approved state
      if (options?.executeImmediately === false) {
        return {
          recommendationId: rec.id,
          signalId: rec.signalId,
          actionType: rec.actionType as any,
          policyStatus: 'approved',
          executableStatus: 'approved',
          executedBy: actor.staffId,
          executedAt: now.toISOString(),
          idempotent: false,
          serviceInvoked: 'None',
          details: { stage: 'approved_pending_execution' },
        };
      }

      // Execute through existing authorized service
      const execResult = await this.executor.execute({
        recommendation: rec,
        signal: policy.context!.signal,
        actor,
        correlationId,
        tx,
        targetAssigneeId: options?.targetAssigneeId,
      });

      // Update to executed
      await tx
        .update(intelligenceApprovedActions)
        .set({
          policyStatus: 'executed',
          executableStatus: 'executed',
          idempotencyKey,
          executionResult: execResult,
          updatedAt: now,
        })
        .where(eq(intelligenceApprovedActions.id, recommendationId));

      // Update parent signal to actioned
      await tx
        .update(hospitalIntelligenceSignals)
        .set({
          status: 'actioned',
          resolvedAt: now,
          updatedAt: now,
        })
        .where(eq(hospitalIntelligenceSignals.id, rec.signalId));

      // Audit action execution
      await this.audit.logEvent(
        buildHospitalIntelligenceAuditEvent({
          eventType: HOSPITAL_INTELLIGENCE_AUDIT_EVENTS.ACTION_EXECUTED,
          actor,
          targetType: 'INTELLIGENCE_RECOMMENDATION',
          targetId: recommendationId,
          patientId: policy.context?.signal.patientId,
          actionDetail: {
            idempotencyKey,
            actionType: rec.actionType,
            signalId: rec.signalId,
            serviceInvoked: execResult.serviceInvoked,
          },
        }),
        correlationId,
        tx,
      );

      return {
        recommendationId: rec.id,
        signalId: rec.signalId,
        actionType: rec.actionType as any,
        policyStatus: 'executed',
        executableStatus: 'executed',
        executedBy: actor.staffId,
        executedAt: now.toISOString(),
        idempotent: false,
        serviceInvoked: execResult.serviceInvoked,
        details: execResult.details,
      };
    });
  }

  /**
   * Executes an already approved recommendation.
   * Used for the two-phase approval/execution flow.
   */
  async executeRecommendation(
    recommendationId: string,
    idempotencyKey: string,
    actor: IntelligenceAuditActor,
    correlationId: string,
    options?: {
      targetAssigneeId?: string;
      isBreakGlassActive?: boolean;
    },
  ): Promise<GovernedActionResult> {
    const policy = await this.policy.evaluatePolicy(actor, recommendationId, 'execute', {
      isBreakGlassActive: options?.isBreakGlassActive,
      targetAssigneeId: options?.targetAssigneeId,
      idempotencyKey,
    });

    if (!policy.allowed) {
      await this.audit.logEvent(
        buildHospitalIntelligenceAuditEvent({
          eventType: HOSPITAL_INTELLIGENCE_AUDIT_EVENTS.RECOMMENDATION_POLICY_REJECTED,
          actor,
          targetType: 'INTELLIGENCE_RECOMMENDATION',
          targetId: recommendationId,
          actionDetail: {
            reasonCode: policy.reasonCode,
            reason: policy.reason,
            phase: 'execute',
          },
        }),
        correlationId,
      );

      if (
        policy.reasonCode === 'UNAUTHORIZED_ROLE' ||
        policy.reasonCode === 'CROSS_DEPARTMENT_ACCESS_DENIED' ||
        policy.reasonCode === 'BREAK_GLASS_PROHIBITED'
      ) {
        throw new AuthorizationError(policy.reason, { code: policy.reasonCode });
      }
      if (
        policy.reasonCode === 'RECOMMENDATION_NOT_FOUND' ||
        policy.reasonCode === 'SIGNAL_NOT_FOUND'
      ) {
        throw new NotFoundError(policy.reason, { code: policy.reasonCode });
      }
      if (
        policy.reasonCode === 'ALREADY_EXECUTED' ||
        policy.reasonCode === 'ALREADY_REJECTED' ||
        policy.reasonCode === 'INVALID_STATUS_TRANSITION'
      ) {
        throw new ConflictError(policy.reason, { code: policy.reasonCode });
      }
      throw new ValidationError(policy.reason, { code: policy.reasonCode });
    }

    return await db.transaction(async (tx) => {
      const [rec] = await tx
        .select()
        .from(intelligenceApprovedActions)
        .where(eq(intelligenceApprovedActions.id, recommendationId))
        .for('update');

      if (!rec) {
        throw new NotFoundError(`Recommendation '${recommendationId}' not found.`, {
          code: 'RECOMMENDATION_NOT_FOUND',
        });
      }

      if (rec.policyStatus === 'executed') {
        if (rec.idempotencyKey === idempotencyKey) {
          const cachedResult = (rec.executionResult as Record<string, unknown>) || {};
          return {
            recommendationId: rec.id,
            signalId: rec.signalId,
            actionType: rec.actionType as any,
            policyStatus: 'executed',
            executableStatus: 'executed',
            executedBy: rec.approvedBy || actor.staffId,
            executedAt: (rec.updatedAt || new Date()).toISOString(),
            idempotent: true,
            serviceInvoked: (cachedResult.serviceInvoked as string) || 'ExistingService',
            details: (cachedResult.details as Record<string, unknown>) || {},
          };
        }
        throw new ConflictError(
          'Recommendation has already been executed under a different idempotency key.',
          { code: 'RECOMMENDATION_ALREADY_ACTED' },
        );
      }

      const now = new Date();
      const execResult = await this.executor.execute({
        recommendation: rec,
        signal: policy.context!.signal,
        actor,
        correlationId,
        tx,
        targetAssigneeId: options?.targetAssigneeId,
      });

      await tx
        .update(intelligenceApprovedActions)
        .set({
          policyStatus: 'executed',
          executableStatus: 'executed',
          idempotencyKey,
          executionResult: execResult,
          updatedAt: now,
        })
        .where(eq(intelligenceApprovedActions.id, recommendationId));

      await tx
        .update(hospitalIntelligenceSignals)
        .set({
          status: 'actioned',
          resolvedAt: now,
          updatedAt: now,
        })
        .where(eq(hospitalIntelligenceSignals.id, rec.signalId));

      await this.audit.logEvent(
        buildHospitalIntelligenceAuditEvent({
          eventType: HOSPITAL_INTELLIGENCE_AUDIT_EVENTS.ACTION_EXECUTED,
          actor,
          targetType: 'INTELLIGENCE_RECOMMENDATION',
          targetId: recommendationId,
          patientId: policy.context?.signal.patientId,
          actionDetail: {
            idempotencyKey,
            actionType: rec.actionType,
            signalId: rec.signalId,
            serviceInvoked: execResult.serviceInvoked,
          },
        }),
        correlationId,
        tx,
      );

      return {
        recommendationId: rec.id,
        signalId: rec.signalId,
        actionType: rec.actionType as any,
        policyStatus: 'executed',
        executableStatus: 'executed',
        executedBy: actor.staffId,
        executedAt: now.toISOString(),
        idempotent: false,
        serviceInvoked: execResult.serviceInvoked,
        details: execResult.details,
      };
    });
  }

  /**
   * Rejects a proposed recommendation.
   */
  async rejectRecommendation(
    recommendationId: string,
    reason: string,
    actor: IntelligenceAuditActor,
    correlationId: string,
  ): Promise<{ status: 'rejected'; recommendationId: string; rejectionReason?: string }> {
    const policy = await this.policy.evaluatePolicy(actor, recommendationId, 'reject');

    if (!policy.allowed) {
      await this.audit.logEvent(
        buildHospitalIntelligenceAuditEvent({
          eventType: HOSPITAL_INTELLIGENCE_AUDIT_EVENTS.RECOMMENDATION_POLICY_REJECTED,
          actor,
          targetType: 'INTELLIGENCE_RECOMMENDATION',
          targetId: recommendationId,
          actionDetail: {
            reasonCode: policy.reasonCode,
            reason: policy.reason,
            phase: 'reject',
          },
        }),
        correlationId,
      );

      if (
        policy.reasonCode === 'UNAUTHORIZED_ROLE' ||
        policy.reasonCode === 'CROSS_DEPARTMENT_ACCESS_DENIED' ||
        policy.reasonCode === 'BREAK_GLASS_PROHIBITED'
      ) {
        throw new AuthorizationError(policy.reason, { code: policy.reasonCode });
      }
      if (
        policy.reasonCode === 'RECOMMENDATION_NOT_FOUND' ||
        policy.reasonCode === 'SIGNAL_NOT_FOUND'
      ) {
        throw new NotFoundError(policy.reason, { code: policy.reasonCode });
      }
      if (
        policy.reasonCode === 'ALREADY_EXECUTED' ||
        policy.reasonCode === 'ALREADY_REJECTED' ||
        policy.reasonCode === 'INVALID_STATUS_TRANSITION'
      ) {
        throw new ConflictError(policy.reason, { code: policy.reasonCode });
      }
      throw new ValidationError(policy.reason, { code: policy.reasonCode });
    }

    const validStaffId = (await this.resolveValidStaffId(actor.staffId)) || null;

    return await db.transaction(async (tx) => {
      const [rec] = await tx
        .select()
        .from(intelligenceApprovedActions)
        .where(eq(intelligenceApprovedActions.id, recommendationId))
        .for('update');

      if (!rec) {
        throw new NotFoundError(`Recommendation '${recommendationId}' not found.`, {
          code: 'RECOMMENDATION_NOT_FOUND',
        });
      }

      if (rec.policyStatus === 'rejected') {
        return { status: 'rejected', recommendationId, rejectionReason: rec.rejectionReason || reason };
      }

      if (rec.policyStatus === 'executed') {
        throw new ConflictError('Executed recommendations cannot be rejected.', {
          code: 'ALREADY_EXECUTED',
        });
      }

      const now = new Date();

      await tx
        .update(intelligenceApprovedActions)
        .set({
          policyStatus: 'rejected',
          rejectedBy: validStaffId,
          rejectedAt: now,
          rejectionReason: reason,
          updatedAt: now,
        })
        .where(eq(intelligenceApprovedActions.id, recommendationId));

      await tx
        .update(hospitalIntelligenceSignals)
        .set({
          status: 'dismissed',
          resolvedAt: now,
          updatedAt: now,
        })
        .where(eq(hospitalIntelligenceSignals.id, rec.signalId));

      await this.audit.logEvent(
        buildHospitalIntelligenceAuditEvent({
          eventType: HOSPITAL_INTELLIGENCE_AUDIT_EVENTS.RECOMMENDATION_REJECTED,
          actor,
          targetType: 'INTELLIGENCE_RECOMMENDATION',
          targetId: recommendationId,
          patientId: policy.context?.signal.patientId,
          actionDetail: { reason, signalId: rec.signalId },
        }),
        correlationId,
        tx,
      );

      return { status: 'rejected', recommendationId, rejectionReason: reason };
    });
  }

  /**
   * Finds an existing active signal to prevent duplicate rows on repeated analysis.
   */
  private async findActiveSignal(
    signal: DetectedSignal,
  ): Promise<{ id: string } | null> {
    const primaryRef = signal.evidenceRefs[0];
    if (!primaryRef) return null;

    try {
      const condition = signal.encounterId
        ? sql`(encounter_id = ${signal.encounterId} OR evidence_refs @> ${JSON.stringify([{ sourceRecordId: primaryRef.sourceRecordId }])}::jsonb)`
        : sql`evidence_refs @> ${JSON.stringify([{ sourceRecordId: primaryRef.sourceRecordId }])}::jsonb`;

      const rows = (await db.execute(sql`
        SELECT id FROM hospital_intelligence_signals
        WHERE signal_type = ${signal.signalType}
          AND status IN ('detected', 'analyzed')
          AND ${condition}
        LIMIT 1;
      `)) as unknown as Array<{ id: string }>;

      return rows.length > 0 ? rows[0] : null;
    } catch {
      return null;
    }
  }

  /**
   * Persists detected signal and proposed recommendation.
   */
  private async persistSignal(
    signal: DetectedSignal,
    staffId: string,
    correlationId: string,
    interactionId: string | null,
  ): Promise<void> {
    const now = new Date();
    const isUuid = (val: string) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val);

    let requestedBy = staffId;
    if (!isUuid(requestedBy)) {
      const [staffRow] = (await db.execute(sql`
        SELECT id FROM staff LIMIT 1;
      `)) as unknown as Array<{ id: string }>;
      if (staffRow) {
        requestedBy = staffRow.id;
      }
    }

    let validInteractionId: string | null = null;
    if (interactionId && isUuid(interactionId)) {
      const [aiRow] = (await db.execute(sql`
        SELECT id FROM ai_interactions WHERE id = ${interactionId} LIMIT 1;
      `)) as unknown as Array<{ id: string }>;
      if (aiRow) {
        validInteractionId = aiRow.id;
      }
    }

    await db
      .insert(hospitalIntelligenceSignals)
      .values({
        id: signal.signalId,
        signalType: signal.signalType,
        severity: signal.severity,
        title: signal.title,
        description: signal.description,
        detectedAt: new Date(signal.detectedAt),
        status: signal.status,
        patientId: signal.patientId,
        encounterId: signal.encounterId,
        evidenceRefs: signal.evidenceRefs,
        deterministicReason: signal.deterministicReason,
        aiInteractionId: validInteractionId,
        aiExplanation: signal.aiExplanation,
        recommendationId: signal.recommendation?.recommendationId ?? null,
        analysisCorrelationId: correlationId,
        requestedBy,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: hospitalIntelligenceSignals.id,
        set: {
          severity: signal.severity,
          title: signal.title,
          description: signal.description,
          status: signal.status,
          evidenceRefs: signal.evidenceRefs,
          aiInteractionId: validInteractionId,
          aiExplanation: signal.aiExplanation,
          recommendationId: signal.recommendation?.recommendationId ?? null,
          analysisCorrelationId: correlationId,
          updatedAt: now,
        },
      });

    // If recommendation proposal exists, persist to intelligence_approved_actions table
    if (signal.recommendation) {
      await db
        .insert(intelligenceApprovedActions)
        .values({
          id: signal.recommendation.recommendationId,
          signalId: signal.signalId,
          actionType: signal.recommendation.actionType,
          rationale: signal.recommendation.rationale,
          evidenceRefs: signal.evidenceRefs,
          requiresHumanApproval: true,
          policyStatus: 'proposed',
          executableStatus: 'proposed',
          idempotencyKey: randomUUID(),
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoNothing();
    }
  }

  /**
   * Helper to map DB record to DetectedSignal contract.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mapDbRowToSignal(r: any): DetectedSignal {
    return {
      signalId: r.id,
      signalType: r.signalType,
      severity: r.severity,
      title: r.title,
      description: r.description,
      detectedAt: new Date(r.detectedAt).toISOString(),
      status: r.status,
      patientId: r.patientId ?? null,
      encounterId: r.encounterId ?? null,
      evidenceRefs: r.evidenceRefs as EvidenceRef[],
      deterministicReason: r.deterministicReason,
      aiExplanation: (r.aiExplanation as AiExplanation) ?? null,
      recommendation: r.recommendationId
        ? {
            recommendationId: r.recommendationId,
            signalId: r.id,
            actionType: 'NOTIFY_ATTENDING_PHYSICIAN',
            rationale: 'Review pending operational bottleneck',
            evidenceRefs: [],
            requiresHumanApproval: true,
            policyStatus: 'proposed',
            executableStatus: 'proposed',
            createdAt: new Date(r.createdAt).toISOString(),
          }
        : null,
      correlationId: r.analysisCorrelationId,
    };
  }
}

export const hospitalIntelligenceService = new HospitalIntelligenceService();
