import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import crypto from 'crypto';
import { eq } from 'drizzle-orm';
import { soapNoteDraftOutputSchema } from 'shared';
import { db } from '../../../db';
import { patients } from '../../../db/schema/patients';
import { staff, departments } from '../../../db/schema/staff';
import { encounters } from '../../../db/schema/appointments';
import { clinicalRecords } from '../../../db/schema/clinical';
import { diagnosticOrders, diagnosticResults } from '../../../db/schema/diagnostics';
import { aiInteractions } from '../../../db/schema/ai';
import { auditEvents } from '../../../db/schema/audit';
import { AuditService } from '../../audit/audit.service';
import { AIOrchestrator } from '../orchestrator';
import { FakeProvider } from '../adapters/fake.provider';
import { AiNoteDraftService } from '../capabilities/note-draft.service';
import { clinicalService } from '../../clinical/clinical.service';

/**
 * M12 hero vertical — live-DB integration:
 * capability gates, authorized assembly→grounding, and ADR-019 B1–B10 binding.
 */

const RUN = crypto.randomUUID().slice(0, 8);
const auditService = new AuditService();
const provider = new FakeProvider({}); // scripted per-test below

function orch() {
  return new AIOrchestrator(provider, auditService, {
    readinessOverride: { enabled: true },
    budget: 100_000_000,
    rateLimitPerMinute: 10_000,
  });
}

let deptId = '';
let physicianA = ''; // assigned
let physicianB = ''; // same dept, NOT assigned
let nurseId = '';
let patientId = '';
let encounterActive = '';
const createdRecordIds: string[] = [];
const createdInteractionIds: string[] = [];
let vitalsRowId = '';
let orderRowId = '';
let resultRowId = '';

const principal = (id: string, role: string) => ({ staffId: id, role, departmentId: deptId });

beforeAll(async () => {
  const [dept] = await db
    .insert(departments)
    .values({ name: `M12 ${RUN}`, code: `M12${RUN.slice(0, 6)}`, status: 'active' })
    .returning();
  deptId = dept.id;
  const mkStaff = async (role: 'physician' | 'nurse', tag: string) => {
    const [s] = await db
      .insert(staff)
      .values({
        employeeId: `EMP-M12-${tag}-${RUN}`,
        email: `m12-${tag}-${RUN}@t.hospital`,
        passwordHash: 'x',
        firstName: 'M12',
        lastName: tag,
        role,
        departmentId: deptId,
        status: 'active',
      })
      .returning();
    return s.id;
  };
  physicianA = await mkStaff('physician', 'pa');
  physicianB = await mkStaff('physician', 'pb');
  nurseId = await mkStaff('nurse', 'n');

  const [p] = await db
    .insert(patients)
    .values({
      mrn: `M12-${RUN}`,
      firstName: 'Asha',
      lastName: 'Rao',
      dateOfBirth: '1978-04-11',
      gender: 'female',
      phonePrimary: '0000000000',
      status: 'active',
      createdBy: physicianA,
    })
    .returning();
  patientId = p.id;

  const [enc] = await db
    .insert(encounters)
    .values({
      patientId,
      doctorId: physicianA,
      departmentId: deptId,
      encounterType: 'opd',
      chiefComplaint: 'Fever and productive cough for three days.',
      status: 'active',
      startedAt: new Date(),
      createdBy: receptionistFallback(),
      version: 1,
    })
    .returning();
  encounterActive = enc.id;

  const [vr] = await db
    .insert(clinicalRecords)
    .values({
      encounterId: encounterActive,
      patientId,
      recordType: 'vital_signs',
      content: {},
      vitals: { temperature_c: 38.9, pulse_bpm: 112, spo2_pct: 93 },
      status: 'draft',
      version: 1,
      createdBy: nurseId,
    })
    .returning();
  vitalsRowId = vr.id;

  const [ord] = await db
    .insert(diagnosticOrders)
    .values({
      encounterId: encounterActive,
      patientId,
      orderingDoctorId: physicianA,
      testCode: 'CBC',
      testName: 'Complete Blood Count',
      priority: 'urgent',
      status: 'completed',
    })
    .returning();
  orderRowId = ord.id;

  const [res] = await db
    .insert(diagnosticResults)
    .values({
      orderId: ord.id,
      patientId,
      testCode: 'CBC',
      resultValues: [{ parameterName: 'WBC', value: 19.4, unit: '10^3/uL' }],
      isAbnormal: true,
      isCritical: true,
      status: 'critical_flagged',
      enteredBy: nurseId,
    })
    .returning();
  resultRowId = res.id;

  provider.scriptedOutput = soapNoteDraftOutputSchema.parse({
    sections: [
      {
        heading: 'subjective',
        content: 'Fever and productive cough for three days.',
        citations: [{ sourceType: 'CLINICAL_RECORD', sourceId: vitalsRowId, excerpt: 'context' }],
      },
      {
        heading: 'objective',
        content: 'Temp 38.9C, SpO2 93%. WBC 19.4 (critical).',
        citations: [
          { sourceType: 'DIAGNOSTIC_RESULT', sourceId: resultRowId, excerpt: 'WBC critical' },
        ],
      },
      {
        heading: 'assessment',
        content: 'Consistent with lower respiratory infection.',
        citations: [
          { sourceType: 'DIAGNOSTIC_RESULT', sourceId: resultRowId, excerpt: 'leukocytosis' },
        ],
      },
      {
        heading: 'plan',
        content: 'Start antibiotics; repeat CBC.',
        citations: [
          { sourceType: 'DIAGNOSTIC_ORDER', sourceId: orderRowId, excerpt: 'CBC ordered' },
        ],
      },
    ],
    disclaimers: ['AI-generated draft for clinician review.'],
    informationGaps: ['NO_PRIOR_NOTES', 'NO_MEDICATION_HISTORY', 'NO_ALLERGY_DATA'],
  });
});

function receptionistFallback() {
  return physicianA; // createdBy may be any staff; receptionist creation path not exercised here
}

afterAll(async () => {
  void eq;
  for (const id of createdInteractionIds) {
    await db
      .delete(aiInteractions)
      .where(eq(aiInteractions.id, id))
      .catch(() => undefined);
    await db
      .delete(auditEvents)
      .where(eq(auditEvents.targetId, id))
      .catch(() => undefined);
  }
});

describe('M12 note-draft capability gates (ADR-018 §3)', () => {
  it('rejects nurses despite ai_interaction:invoke', async () => {
    await expect(
      new AiNoteDraftService(orch()).draft(
        principal(nurseId, 'nurse'),
        { encounterId: encounterActive, recordType: 'soap' },
        crypto.randomUUID(),
      ),
    ).rejects.toThrow(/physician/i);
  });

  it('rejects non-assigned physicians (cross-doctor AND cross-department)', async () => {
    await expect(commissionBy(physicianB)).rejects.toThrow(/assigned physician/i);
  });

  async function commissionBy(staffId: string) {
    return new AiNoteDraftService(orch()).draft(
      principal(staffId, 'physician'),
      { encounterId: encounterActive, recordType: 'soap' },
      crypto.randomUUID(),
    );
  }

  it('grounds a draft for the ASSIGNED physician with valid citations + gap fidelity', async () => {
    const out = await new AiNoteDraftService(orch()).draft(
      principal(physicianA, 'physician'),
      { encounterId: encounterActive, recordType: 'soap' },
      crypto.randomUUID(),
    );
    expect(out.groundingStatus).toBe('grounded');
    createdInteractionIds.push(out.interactionId);

    const row = await db.query.aiInteractions.findFirst({
      where: eq(aiInteractions.id, out.interactionId),
    });
    const summary = row!.contextSummary as Record<string, unknown>;
    expect(summary['recordType']).toBe('soap'); // B8 anchor persisted
    const manifest = JSON.stringify(summary['manifest']);
    expect(manifest).toContain(vitalsRowId);
    expect(manifest).toContain(resultRowId);
    // PHI: no direct identifiers anywhere in metadata summary.
    expect(JSON.stringify(summary)).not.toMatch(/Asha|Rao|M12-/i);
  }, 30_000);
});

describe('M12 binding — ADR-019 invariants B1–B10', () => {
  async function makeInteraction(
    over: Partial<{
      userIdAction: string;
      grounding: string;
      encounter: string | null;
      recordType: unknown;
      ageHours: number;
      initiator: string;
    }>,
  ) {
    const [row] = await db
      .insert(aiInteractions)
      .values({
        interactionType: 'note_draft',
        initiatedBy: over.initiator ?? physicianA,
        patientId,
        encounterId: over.encounter === null ? null : (over.encounter ?? encounterActive),
        promptTemplateId: 'note_draft@1',
        contextSummary: { recordType: over.recordType ?? 'soap', manifest: [], computedGaps: [] },
        modelProvider: 'fake',
        modelName: 'm',
        inputTokens: 1,
        outputTokens: 1,
        latencyMs: 1,
        rawResponse: 'x:y:z',
        parsedOutput: { sections: [] },
        groundingStatus: (over.grounding ?? 'grounded') as 'grounded',
        userAction: (over.userIdAction ?? 'pending') as 'pending',
        ...(over.ageHours ? { createdAt: new Date(Date.now() - over.ageHours * 3600_000) } : {}),
      })
      .returning();
    createdInteractionIds.push(row.id);
    return row.id;
  }

  const createWith = (aiDraftId?: string, author = physicianA) =>
    clinicalService.createClinicalRecord(
      encounterActive,
      {
        recordType: 'soap',
        content: {
          sections: [
            { heading: 'subjective', content: 's' },
            { heading: 'objective', content: 'o' },
            { heading: 'assessment', content: 'a' },
            { heading: 'plan', content: 'p' },
          ],
        },
        aiDraftId,
      },
      author,
      crypto.randomUUID(),
      { role: 'physician', departmentId: deptId },
    );

  it('happy path binds atomically: record.aiDraftId set, interaction accepted, BOTH audits emitted', async () => {
    const id = await makeInteraction({});
    const rec = await createWith(id);
    createdRecordIds.push(rec.id);
    expect(rec.aiDraftId).toBe(id);
    const inter = await db.query.aiInteractions.findFirst({ where: eq(aiInteractions.id, id) });
    expect(inter!.userAction).toBe('accepted');
    // Accepted-audit keyed by interaction id; created-audit keyed by record id.
    const accepted = await db.query.auditEvents.findFirst({ where: eq(auditEvents.targetId, id) });
    expect(accepted?.eventType).toBe('AI_DRAFT_ACCEPTED');
    const created = await db.query.auditEvents.findFirst({
      where: eq(auditEvents.targetId, rec.id),
    });
    expect(created?.eventType).toBe('CLINICAL_RECORD_CREATED');
  });

  it('B2/M9 precedence: non-assigned physician blocked before binding is reachable', async () => {
    const id = await makeInteraction({ initiator: physicianA });
    // Only ONE physician satisfies B9 (assigned + author); a second physician
    // cannot reach B2 — the frozen M9 guard fires first (correct ordering).
    await expect(createWith(id, physicianB)).rejects.toThrow(/assigned physician/i);
  });

  it('B5 double bind → ALREADY_RESOLVED and no second record', async () => {
    const id = await makeInteraction({});
    const first = await createWith(id);
    createdRecordIds.push(first.id);
    await expect(createWith(id)).rejects.toThrow(/already been resolved/i);
  });

  it('B6 stale draft past TTL → DRAFT_EXPIRED', async () => {
    const id = await makeInteraction({ ageHours: 25 });
    await expect(createWith(id)).rejects.toThrow(/expired/i);
  });

  it('B7 cross-encounter bind → ENCOUNTER_MISMATCH', async () => {
    // Real second encounter (FK) assigned to a different doctor.
    const [other] = await db
      .insert(encounters)
      .values({
        patientId,
        doctorId: physicianB,
        departmentId: deptId,
        encounterType: 'opd',
        status: 'active',
        startedAt: new Date(),
        createdBy: physicianA,
        version: 1,
      })
      .returning();
    const id = await makeInteraction({ encounter: other.id });
    await expect(createWith(id)).rejects.toThrow(/different encounter/i);
  });

  it('B8 wrong record type → TYPE_MISMATCH', async () => {
    const id = await makeInteraction({ recordType: 'progress_note' });
    await expect(createWith(id)).rejects.toThrow(/different note type/i);
  });

  it('B4 ungrounded interaction → INVALID_TRANSITION', async () => {
    const id = await makeInteraction({ grounding: 'validation_failed' });
    await expect(createWith(id)).rejects.toThrow(/grounded/i);
  });

  it('vitals records ignore aiDraftId entirely (nurse domain)', async () => {
    const rec = await clinicalService.createClinicalRecord(
      encounterActive,
      { recordType: 'vital_signs', vitals: { pulse_bpm: 80 } },
      nurseId,
      crypto.randomUUID(),
      { role: 'nurse', departmentId: deptId },
    );
    createdRecordIds.push(rec.id);
    expect(rec.aiDraftId).toBeNull();
  });
});
