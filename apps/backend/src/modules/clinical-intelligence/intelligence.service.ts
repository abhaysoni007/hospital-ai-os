import { db } from '../../db';
import { eq, desc, and, inArray } from 'drizzle-orm';
import { encounters, clinicalRecords, diagnosticOrders, diagnosticResults, tasks } from '../../db/schema';
import {
  TimelineEvent,
  TimelineMetadata,
  DiagnosticTrendPoint,
  ChartAnswerOutput,
  chartAnswerOutputSchema,
  ContextBlock,
} from 'shared';
import { AIOrchestrator, AiPrincipal } from '../ai/orchestrator';

export class ClinicalIntelligenceService {
  constructor(private readonly aiOrchestrator: AIOrchestrator) {}

  async getClinicalTimeline(
    patientId: string,
    limit: number = 50,
  ): Promise<{ events: TimelineEvent[]; metadata: TimelineMetadata }> {
    const generatedAt = new Date().toISOString();

    const [encs, notes, orders, results, taskDocs] = await Promise.all([
      db.select().from(encounters).where(eq(encounters.patientId, patientId)),
      db.select().from(clinicalRecords).where(eq(clinicalRecords.patientId, patientId)),
      db.select().from(diagnosticOrders).where(eq(diagnosticOrders.patientId, patientId)),
      db.select().from(diagnosticResults).where(eq(diagnosticResults.patientId, patientId)),
      db.select().from(tasks).where(eq(tasks.patientId, patientId)),
    ]);

    const events: TimelineEvent[] = [];

    // Map Encounters
    for (const e of encs) {
      events.push({
        id: `ENCOUNTER:${e.id}`,
        type: 'ENCOUNTER_START',
        sourceType: 'ENCOUNTER',
        sourceId: e.id,
        occurredAt: (e.startedAt || e.createdAt).toISOString(),
        status: e.status,
        metadata: {
          departmentId: e.departmentId,
          chiefComplaint: e.chiefComplaint,
          type: e.encounterType,
        },
      });
    }

    // Map Clinical Records
    for (const n of notes) {
      events.push({
        id: `CLINICAL_RECORD:${n.id}`,
        type: 'NOTE_SIGNED',
        sourceType: 'CLINICAL_RECORD',
        sourceId: n.id,
        occurredAt: (n.signedAt || n.createdAt).toISOString(),
        status: n.status,
        metadata: {
          recordType: n.recordType,
          version: n.version,
          textContent: typeof n.content === 'object' ? JSON.stringify(n.content) : String(n.content),
        },
      });
    }

    // Map Diagnostic Orders
    for (const o of orders) {
      events.push({
        id: `DIAGNOSTIC_ORDER:${o.id}`,
        type: 'ORDER_PLACED',
        sourceType: 'DIAGNOSTIC_ORDER',
        sourceId: o.id,
        occurredAt: o.createdAt.toISOString(),
        status: o.status,
        metadata: {
          testCode: o.testCode,
          testName: o.testName,
          priority: o.priority,
        },
      });
    }

    // Map Diagnostic Results
    for (const r of results) {
      events.push({
        id: `DIAGNOSTIC_RESULT:${r.id}`,
        type: 'RESULT_ENTERED',
        sourceType: 'DIAGNOSTIC_RESULT',
        sourceId: r.id,
        occurredAt: (r.verifiedAt || r.createdAt).toISOString(),
        status: r.status,
        metadata: {
          testCode: r.testCode,
          isCritical: r.isCritical,
          isAbnormal: r.isAbnormal,
          values: r.resultValues,
          relatedOrderSourceId: r.orderId,
        },
      });
    }

    // Map Tasks
    for (const t of taskDocs) {
      events.push({
        id: `TASK:${t.id}`,
        type: 'TASK_CREATED',
        sourceType: 'TASK',
        sourceId: t.id,
        occurredAt: t.createdAt.toISOString(),
        status: t.status,
        metadata: {
          title: t.title,
          priority: t.priority,
          taskType: t.taskType,
        },
      });
    }

    // Deterministic Sort
    events.sort((a, b) => {
      if (a.occurredAt !== b.occurredAt) {
        return b.occurredAt.localeCompare(a.occurredAt); // DESC
      }
      return b.sourceId.localeCompare(a.sourceId);
    });

    const truncated = events.length > limit;
    const boundedEvents = events.slice(0, limit);
    const latestTimestamp = boundedEvents.length > 0 ? boundedEvents[0].occurredAt : null;

    return {
      events: boundedEvents,
      metadata: {
        generatedAt,
        latestSourceTimestamp: latestTimestamp,
        includedEventCount: boundedEvents.length,
        truncated,
      },
    };
  }

  async generateChartBrief(
    patientId: string,
    principal: AiPrincipal,
    question?: string,
  ): Promise<{ metadata: TimelineMetadata; brief: ChartAnswerOutput; interactionId: string }> {
    // 1. Fetch Timeline (bounded to 50 events)
    const { events, metadata } = await this.getClinicalTimeline(patientId, 50);

    // 2. Map to ContextBlocks (Exclude Tasks for AI safety)
    const blocks: ContextBlock[] = [];
    
    for (const e of events) {
      if (e.sourceType === 'ENCOUNTER') {
        blocks.push({
          blockType: 'encounter_metadata',
          encounterType: (e.metadata?.type as 'opd' | 'follow_up') || 'opd',
          status: (e.metadata?.status as 'active' | 'registered' | 'discharge_initiated' | 'discharged' | 'closed') || 'active',
          startedAt: e.occurredAt,
          departmentName: (e.metadata?.departmentId as string) || 'General',
          chiefComplaint: e.metadata?.chiefComplaint as string | undefined,
        });
      } else if (e.sourceType === 'CLINICAL_RECORD') {
        blocks.push({
          blockType: 'clinical_record',
          sourceId: e.sourceId,
          recordType: e.metadata?.recordType as 'soap' | 'progress_note' | 'vital_signs' | 'discharge_summary',
          version: e.metadata?.version as number,
          recordedAt: e.occurredAt,
          textContent: e.metadata?.textContent as string || '',
        });
      } else if (e.sourceType === 'DIAGNOSTIC_ORDER') {
        blocks.push({
          blockType: 'diagnostic_order',
          sourceId: e.sourceId,
          testCode: e.metadata?.testCode as string,
          testName: e.metadata?.testName as string,
          priority: e.metadata?.priority as 'routine' | 'urgent' | 'stat',
          status: e.status as 'ordered' | 'sample_collected' | 'in_progress' | 'completed' | 'cancelled',
          createdAt: e.occurredAt,
        });
      } else if (e.sourceType === 'DIAGNOSTIC_RESULT') {
        let parameters = e.metadata?.values as Record<string, unknown>[];
        if (!Array.isArray(parameters)) {
           parameters = [{
             parameterName: 'Result',
             valueNumber: 0,
             unit: 'N/A',
             verdict: e.metadata?.isCritical ? 'critical' : (e.metadata?.isAbnormal ? 'abnormal' : 'normal'),
             referenceRangeText: 'N/A'
           }];
        } else {
           parameters = parameters.map(p => ({
             parameterName: (p.parameterName as string) || 'Unknown',
             valueNumber: typeof p.value === 'number' ? p.value : 0,
             unit: (p.unit as string) || 'N/A',
             verdict: (p.verdict as 'normal' | 'abnormal' | 'critical') || 'normal',
             referenceRangeText: (p.referenceRange as string) || 'N/A'
           }));
        }

        blocks.push({
          blockType: 'diagnostic_result',
          sourceId: e.sourceId,
          relatedOrderSourceId: e.metadata?.relatedOrderSourceId as string,
          status: e.status as 'preliminary' | 'verified' | 'critical_flagged',
          isCritical: e.metadata?.isCritical as boolean,
          parameters: parameters.length > 0 ? parameters as { parameterName: string; valueNumber: number; unit: string; verdict: 'normal' | 'abnormal' | 'critical'; referenceRangeText: string; }[] : [{ parameterName: 'Unknown', valueNumber: 0, unit: 'N/A', verdict: 'normal', referenceRangeText: 'N/A' }]
        });
      }
    }

    // 3. Invoke AI using chart_search capability
    const result = await this.aiOrchestrator.invokeStructured<ChartAnswerOutput>({
      capability: 'chart_search',
      principal,
      patientId,
      blocks,
      instructions: question ? `CLINICIAN QUESTION: ${question}` : undefined,
      outputSchema: chartAnswerOutputSchema,
    });

    if (result.status === 'validation_failed') {
      throw new Error('Chart brief generation failed validation: ' + JSON.stringify(result.failures));
    }

    // 4. Citation Validation (The orchestrator's validation pipeline checks against manifest, but we enforce here too)
    const validSourceIds = new Set(events.map(e => e.sourceId));
    for (const citation of result.parsed.citations) {
      if (!validSourceIds.has(citation.sourceId)) {
        throw new Error(`AI generated invalid citation: ${citation.sourceId} is not in the authorized context.`);
      }
    }

    return { metadata, brief: result.parsed, interactionId: result.interactionId };
  }

  async getDiagnosticTrend(
    patientId: string,
    testCode: string,
  ): Promise<DiagnosticTrendPoint[]> {
    const results = await db
      .select({
        resultId: diagnosticResults.id,
        orderId: diagnosticResults.orderId,
        occurredAt: diagnosticResults.verifiedAt,
        createdAt: diagnosticResults.createdAt,
        testCode: diagnosticResults.testCode,
        isAbnormal: diagnosticResults.isAbnormal,
        isCritical: diagnosticResults.isCritical,
        resultValues: diagnosticResults.resultValues,
        referenceRange: diagnosticResults.referenceRange,
      })
      .from(diagnosticResults)
      .where(
        and(
          eq(diagnosticResults.patientId, patientId),
          eq(diagnosticResults.testCode, testCode),
          inArray(diagnosticResults.status, ['preliminary', 'verified', 'critical_flagged']) // Exclude cancelled/invalid
        )
      )
      .orderBy(desc(diagnosticResults.verifiedAt)) // Or createdAt as fallback
      .limit(5);

    const points: DiagnosticTrendPoint[] = [];

    for (const r of results) {
      // Find the first numerical parameter in the JSON
      const values = r.resultValues as Record<string, unknown>[];
      if (Array.isArray(values) && values.length > 0) {
        // Take the main parameter for the trend
        const primaryParam = values[0];
        points.push({
          resultId: r.resultId,
          orderId: r.orderId,
          occurredAt: (r.occurredAt || r.createdAt).toISOString(),
          testCode: r.testCode,
          parameterName: (primaryParam.parameterName as string) || r.testCode,
          valueNumber: Number(primaryParam.value) || 0,
          unit: (primaryParam.unit as string) || '',
          isAbnormal: r.isAbnormal,
          isCritical: r.isCritical,
          referenceRangeText: ((r.referenceRange as Record<string, unknown>)?.text as string) || (primaryParam.referenceRange as string) || '',
        });
      }
    }

    return points;
  }
}
