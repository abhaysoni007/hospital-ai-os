import {
  DetectedSignal,
  HospitalIntelligenceAnalysisResponse,
  AnalyzeHospitalIntelligenceRequest,
  hospitalBottleneckOutputSchema,
  HospitalBottleneckOutput,
  EvidenceRef,
  Recommendation,
  AiExplanation,
} from 'shared';
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

/**
 * M19.2 — Hospital Intelligence Service
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
  ) {}

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
   * Approves a recommendation for execution under human authorization.
   * M19.1/M19.2 skeleton: human approval is recorded; execution lands in M19.3.
   */
  async approveRecommendation(
    recommendationId: string,
    idempotencyKey: string,
    actor: IntelligenceAuditActor,
    correlationId: string,
  ): Promise<{ status: 'approved' | 'executed'; recommendationId: string }> {
    await this.audit.logEvent(
      buildHospitalIntelligenceAuditEvent({
        eventType: HOSPITAL_INTELLIGENCE_AUDIT_EVENTS.RECOMMENDATION_APPROVED,
        actor,
        targetType: 'INTELLIGENCE_RECOMMENDATION',
        targetId: recommendationId,
        actionDetail: { idempotencyKey, stage: 'M19.2_APPROVAL_RECORDED' },
      }),
      correlationId,
    );

    return { status: 'approved', recommendationId };
  }

  /**
   * Rejects a proposed recommendation.
   */
  async rejectRecommendation(
    recommendationId: string,
    reason: string,
    actor: IntelligenceAuditActor,
    correlationId: string,
  ): Promise<{ status: 'rejected'; recommendationId: string }> {
    await this.audit.logEvent(
      buildHospitalIntelligenceAuditEvent({
        eventType: HOSPITAL_INTELLIGENCE_AUDIT_EVENTS.RECOMMENDATION_REJECTED,
        actor,
        targetType: 'INTELLIGENCE_RECOMMENDATION',
        targetId: recommendationId,
        actionDetail: { reason },
      }),
      correlationId,
    );

    return { status: 'rejected', recommendationId };
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
