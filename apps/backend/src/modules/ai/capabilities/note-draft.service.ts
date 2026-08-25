import { randomUUID } from 'crypto';
import {
  ContextBlock,
  ProgressNoteDraftOutput,
  SoapNoteDraftOutput,
  progressNoteDraftOutputSchema,
  soapNoteDraftOutputSchema,
} from 'shared';

import { config } from '../../../config';
import { AuthorizationError, ConflictError } from 'shared';
import { AuthorizationContext } from '../../../middleware/rbac/authorization-context';
import { clinicalService } from '../../clinical/clinical.service';
import { diagnosticsService } from '../../diagnostics/diagnostics.service';
import { encounterService } from '../../encounter/encounter.service';
import { patientService } from '../../patient/patient.service';
import { AIOrchestrator } from '../orchestrator';

/**
 * M12 HERO — physician-commissioned AI SOAP/progress-note drafting.
 *
 * ADR-018 binding: capability gate → AUTHORIZED READERS → ALLOWLIST
 * PROJECTIONS → deterministic gaps → orchestrator. No direct clinical-table
 * queries; no client-supplied context; encounter-scoped only.
 */

const MAX_VITALS_BLOCKS = 10;
const MAX_NOTE_BLOCKS = 5;
const MAX_ORDER_BLOCKS = 20;
const MAX_RESULT_BLOCKS = 20;

export interface NoteDraftRequest {
  encounterId: string;
  recordType: 'soap' | 'progress_note';
  instructions?: string;
}

export class AiNoteDraftService {
  constructor(private readonly orchestrator: AIOrchestrator) {}

  async draft(
    principal: { staffId: string; role: string; departmentId: string },
    request: NoteDraftRequest,
    correlationId: string,
  ): Promise<{
    interactionId: string;
    groundingStatus: 'grounded';
    promptTemplateId: string;
    provider: string;
    model: string;
    latencyMs: number;
    computedGaps: string[];
    draft: SoapNoteDraftOutput | ProgressNoteDraftOutput;
  }> {
    const authContext: AuthorizationContext = {
      staffId: principal.staffId,
      role: principal.role as AuthorizationContext['role'],
      departmentId: principal.departmentId,
    };

    // ---- Capability gate (ADR-018 §3) — mirrors ADR-015 D7 create predicates.
    if (principal.role !== 'physician') {
      throw new AuthorizationError('AI note drafting is restricted to physicians.');
    }
    const detail = await encounterService.getEncounterDetail(request.encounterId, authContext);
    if (detail.doctorId !== principal.staffId) {
      throw new AuthorizationError('Only the assigned physician may commission an AI note draft.');
    }
    if (detail.status !== 'active') {
      throw new ConflictError('AI note drafts require an active encounter.', {
        code: 'ENCOUNTER_NOT_ACTIVE',
      });
    }

    // ---- Authorized context assembly (encounter-scoped).
    const correlation = correlationId ?? randomUUID();
    const [patient, recordsPage, ordersPage] = await Promise.all([
      patientService.getPatientById(detail.patientId, principal.staffId, authContext, correlation),
      clinicalService.listClinicalRecords(
        request.encounterId,
        { page: 1, pageSize: 50 },
        principal.staffId,
        correlation,
        authContext,
      ),
      diagnosticsService.listEncounterOrders(
        request.encounterId,
        principal.staffId,
        correlation,
        authContext,
      ),
    ]);

    const blocks: ContextBlock[] = [];
    // Demographics allowlist — age computed server-side; DOB never projected.
    const ageYears = computeAge(patient.dateOfBirth);
    if (ageYears !== null) {
      blocks.push({ blockType: 'patient_demographics', ageYears, gender: patient.gender });
    }
    blocks.push({
      blockType: 'encounter_metadata',
      encounterType: detail.encounterType,
      status: detail.status,
      startedAt: detail.startedAt ?? null,
      departmentName: 'treating department',
      chiefComplaint: detail.chiefComplaint ?? undefined,
    });

    const notes = recordsPage.data
      .filter((r) => r.recordType === 'soap' || r.recordType === 'progress_note')
      .slice(0, MAX_NOTE_BLOCKS);
    const vitals = recordsPage.data
      .filter((r) => r.recordType === 'vital_signs')
      .slice(0, MAX_VITALS_BLOCKS);
    for (const r of [...vitals, ...notes]) {
      blocks.push({
        blockType: 'clinical_record',
        sourceId: r.id,
        recordType: r.recordType,
        version: r.version,
        recordedAt: r.createdAt,
        textContent: projectRecordText(r),
      });
    }

    const orders = ordersPage.data.slice(0, MAX_ORDER_BLOCKS);
    for (const o of orders) {
      blocks.push({
        blockType: 'diagnostic_order',
        sourceId: o.id,
        testCode: o.testCode,
        testName: o.testName,
        priority: o.priority,
        status: o.status,
        createdAt: o.createdAt,
      });
    }

    let resultCount = 0;
    for (const o of orders) {
      if (resultCount >= MAX_RESULT_BLOCKS) break;
      try {
        const result = await diagnosticsService.getResult(o.id, principal.staffId, authContext);
        blocks.push(projectResult(result));
        resultCount += 1;
      } catch {
        // No result yet for this order — the gap detector reflects that honestly.
      }
    }

    // Fail closed on any malformed projection before any cost is incurred.
    const { parseContextBlocks } = await import('../context/projections');
    const validatedBlocks = parseContextBlocks(blocks);

    // ---- Governed invocation (budget → limiter → semaphore → provider → pipeline).
    // Union of capability schemas under an erased element type; validation is
    // identical via the M11 pipeline and the parsed value is re-typed at return.
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    const outputSchema: any =
      request.recordType === 'soap' ? soapNoteDraftOutputSchema : progressNoteDraftOutputSchema;
    const result = await this.orchestrator.invokeStructured({
      capability: 'note_draft',
      principal,
      patientId: detail.patientId,
      encounterId: request.encounterId,
      blocks: validatedBlocks,
      instructions: request.instructions,
      requestMeta: { recordType: request.recordType },
      outputSchema,
      correlationId: correlation,
    });

    if (result.status !== 'grounded') {
      throw new ConflictError(
        'AI produced an unusable draft. You can retry or continue manually.',
        {
          code: 'AI_VALIDATION_FAILED',
        },
      );
    }

    return {
      interactionId: result.interactionId,
      groundingStatus: 'grounded',
      promptTemplateId: 'note_draft@1',
      provider: config.AI_PROVIDER,
      model: config.AI_MODEL_NAME,
      latencyMs: result.latencyMs,
      computedGaps: result.gaps,
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
      draft: result.parsed as any,
    };
  }
}

function computeAge(dateOfBirth: string): number | null {
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  const m = now.getUTCMonth() - dob.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < dob.getUTCDate())) age -= 1;
  return Math.max(0, Math.min(130, age));
}

function projectRecordText(record: {
  recordType: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  content: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vitals: any | null;
}): string {
  if (record.recordType === 'soap' && Array.isArray(record.content?.sections)) {
    return record.content.sections
      .map((s: { heading: string; content: string }) => `${s.heading}: ${s.content}`)
      .join('\n');
  }
  if (record.recordType === 'vital_signs' && record.vitals) {
    const v = record.vitals as Record<string, unknown>;
    const parts = Object.entries(v)
      .filter(([k]) => k !== 'note')
      .map(([k, val]) => `${k}=${String(val)}`);
    const note = typeof v['note'] === 'string' ? ` note=${v['note']}` : '';
    return parts.join('; ') + note;
  }
  return typeof record.content?.narrative === 'string'
    ? record.content.narrative
    : JSON.stringify(record.content);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function projectResult(result: any): ContextBlock {
  type Param = { parameterName: string; value: number; unit: string };
  const values = (result.resultValues ?? []) as Param[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const snapParams = new Map<string, any>(
    ((result.referenceRange?.parameters ?? []) as Array<Record<string, unknown>>).map((p) => [
      String(p['parameterName']),
      p,
    ]),
  );
  return {
    blockType: 'diagnostic_result',
    sourceId: result.id,
    relatedOrderSourceId: result.orderId,
    status: result.status,
    isCritical: Boolean(result.isCritical),
    parameters: values.map((v) => {
      const sp = snapParams.get(v.parameterName);
      return {
        parameterName: v.parameterName,
        valueNumber: Number(v.value),
        unit: v.unit,
        verdict:
          (sp?.verdict as 'normal' | 'abnormal' | 'critical' | 'unevaluated') ?? 'unevaluated',
        referenceRangeText: referenceText(sp),
      };
    }),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function referenceText(sp: any): string {
  if (!sp) return 'not evaluated';
  const low = sp.criticalLow ?? sp.normalLow ?? '?';
  const high = sp.criticalHigh ?? sp.normalHigh ?? '?';
  return `${low} – ${high} ${sp.unit ?? ''}`.trim();
}
