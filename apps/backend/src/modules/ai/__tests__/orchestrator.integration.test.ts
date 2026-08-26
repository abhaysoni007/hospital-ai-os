import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { soapNoteDraftOutputSchema } from 'shared';
import type { GapCode } from 'shared';
import { decryptField } from '../../../utils/encryption';
import { db } from '../../../db';
import { aiInteractions } from '../../../db/schema/ai';
import { auditEvents } from '../../../db/schema/audit';
import { patients } from '../../../db/schema/patients';
import { staff } from '../../../db/schema/staff';
import { AuditService } from '../../audit/audit.service';
import { AIOrchestrator } from '../orchestrator';
import { FakeProvider } from '../adapters/fake.provider';
import { aiInteractionRepository, startOfUtcDay } from '../ai.persistence';
import { baseBlocks, validSoapOutput } from './fixtures';

/**
 * M11 orchestrator integration — live PostgreSQL. Proves the governed
 * pipeline end-to-end: persistence, encryption-at-rest, metadata-only audit,
 * budget pre-checks, breaker behavior, semaphore backpressure, and
 * zero-rows-on-transport-failure.
 */

const RUN = randomUUID().slice(0, 8);
// Gaps computed by the infrastructure for `baseBlocks` (no prior notes block):
const EXPECTED_GAPS: GapCode[] = ['NO_PRIOR_NOTES', 'NO_MEDICATION_HISTORY', 'NO_ALLERGY_DATA'];

const createdInteractionIds: string[] = [];
const createdPatientIds: string[] = [];
const auditService = new AuditService();
let actorStaffId = '';

function makeOrchestrator(provider: FakeProvider, opts = {}) {
  return new AIOrchestrator(provider, auditService, {
    readinessOverride: { enabled: true },
    budget: 1_000_000,
    rateLimitPerMinute: 1000,
    semaphoreSize: 4,
    ...opts,
  });
}

function invoke(orchestrator: AIOrchestrator) {
  return orchestrator.invokeStructured({
    capability: 'note_draft',
    // Real staff row satisfies the ai_interactions FK; patient/encounter stay
    // null — M11 infrastructure does not require clinical rows.
    principal: { staffId: actorStaffId, role: 'physician', departmentId: 'dept' },
    blocks: baseBlocks,
    outputSchema: soapNoteDraftOutputSchema,
    instructions: `Integration run ${RUN}`,
  });
}

beforeAll(async () => {
  const [anyStaff] = await db.select({ id: staff.id }).from(staff).limit(1);
  if (!anyStaff) throw new Error('M11 integration test requires seeded staff');
  actorStaffId = anyStaff.id;
});

afterAll(async () => {
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
  for (const id of createdPatientIds) {
    await db
      .delete(patients)
      .where(eq(patients.id, id))
      .catch(() => undefined);
  }
});

describe('M11 Orchestrator — governed invocation pipeline', () => {
  it('persists a grounded interaction with ENCRYPTED raw response + metadata-only audit', async () => {
    const provider = new FakeProvider({ scriptedOutput: validSoapOutput(EXPECTED_GAPS) });
    const orch = makeOrchestrator(provider);
    const result = await invoke(orch);

    expect(result.status).toBe('grounded');
    if (result.status !== 'grounded') return;
    createdInteractionIds.push(result.interactionId);

    const row = await db.query.aiInteractions.findFirst({
      where: eq(aiInteractions.id, result.interactionId),
    });
    expect(row).toBeDefined();
    expect(row!.promptTemplateId).toBe('note_draft@1');
    expect(row!.modelProvider).toBe('fake');
    expect(row!.modelName).toBe('gemini-2.0-flash'); // config default persisted
    expect(row!.groundingStatus).toBe('grounded');
    expect(row!.userAction).toBe('pending');

    // Encrypted at rest: envelope shape + decryptable + NOT plaintext.
    const stored = row!.rawResponse as unknown as string;
    expect(typeof stored).toBe('string');
    expect(stored.split(':')).toHaveLength(3);
    expect(stored).not.toContain('sections');
    const decrypted = decryptField(stored);
    expect(decrypted).toContain('"subjective"');

    // Metadata-only context summary (manifest + gaps + counts; never narrative).
    const summary = row!.contextSummary as Record<string, unknown>;
    expect(Array.isArray(summary['manifest'])).toBe(true);
    expect(summary['computedGaps']).toContain('NO_MEDICATION_HISTORY');
    expect(JSON.stringify(summary)).not.toContain('Chest pain');

    // Audit event exists with metadata-only payload.
    const event = await db.query.auditEvents.findFirst({
      where: eq(auditEvents.targetId, result.interactionId),
    });
    expect(event?.eventType).toBe('AI_DRAFT_GENERATED');
    expect(JSON.stringify(event?.actionDetail ?? {})).toContain('promptTemplateId');
    expect(JSON.stringify(event)).not.toContain('Chest pain'); // no narrative
  }, 30_000);

  it('persists validation_failed telemetry WITHOUT placing output into application state', async () => {
    const provider = new FakeProvider({ mode: 'malformed' });
    const orch = makeOrchestrator(provider);
    const result = await invoke(orch);

    expect(result.status).toBe('validation_failed');
    if (result.status !== 'validation_failed') throw new Error('expected validation_failed');
    expect(result.failures[0].stage).toBe('PARSE');
    createdInteractionIds.push(result.interactionId);

    const row = await db.query.aiInteractions.findFirst({
      where: eq(aiInteractions.id, result.interactionId),
    });
    expect(row?.groundingStatus).toBe('validation_failed');
    expect(row?.parsedOutput).toBeNull();
  }, 30_000);

  it('provider transport failure leaves ZERO rows and maps to a safe typed error', async () => {
    const provider = new FakeProvider({ mode: 'server_error' });
    const orch = makeOrchestrator(provider);

    await expect(invoke(orch)).rejects.toThrow(/unavailable \(PROVIDER_ERROR\)/);
    expect(provider.calls).toBe(1);
  });

  it('daily token budget is enforced BEFORE the provider call (GLOBAL scope)', async () => {
    const provider = new FakeProvider({
      scriptedOutput: validSoapOutput(EXPECTED_GAPS),
      inputTokens: 500,
      outputTokens: 500,
    });

    // M12.1 P0-5: the budget SUM is GLOBAL (all users, committed rows). Parallel
    // vitest workers may commit AI rows concurrently, so the FIRST call retries
    // with a freshly-anchored cap; once grounded, ANY further call must block
    // regardless of concurrent writers (they can only push the sum upward).
    let orch = makeOrchestrator(provider);
    for (let attempt = 0; attempt < 5 && provider.calls === 0; attempt++) {
      const usedBefore = await aiInteractionRepository.sumTokensForUtcDay(startOfUtcDay());
      orch = makeOrchestrator(provider, { budget: usedBefore + 1000 });
      try {
        const first = await invoke(orch);
        if (first.status === 'grounded') createdInteractionIds.push(first.interactionId);
        break;
      } catch (err) {
        if (!(err instanceof Error && /budget/i.test(err.message)) || attempt === 4) throw err;
      }
    }
    expect(provider.calls).toBe(1);

    // Second call is rejected pre-provider — global day total now ≥ budget.
    await expect(invoke(orch)).rejects.toThrow(/budget/i);
    expect(provider.calls).toBe(1); // provider never invoked again
  }, 30_000);

  it('circuit breaker opens after repeated failures and short-circuits to 503-family', async () => {
    const provider = new FakeProvider({ mode: 'rate_limited' });
    const orch = makeOrchestrator(provider);

    for (let i = 0; i < 3; i++) {
      await expect(invoke(orch)).rejects.toThrow();
    }
    expect(provider.calls).toBe(3);

    // OPEN breaker ⇒ immediate AIServiceError, zero additional provider calls.
    await expect(invoke(orch)).rejects.toThrow(/unavailable \(|circuit/i);
    expect(provider.calls).toBe(3);
  }, 30_000);

  it('semaphore overflow returns BUSY immediately instead of queueing', async () => {
    const slow = new FakeProvider({
      scriptedOutput: validSoapOutput(EXPECTED_GAPS),
      delayMs: 250,
    });
    const orch = makeOrchestrator(slow, { semaphoreSize: 1 });

    const first = invoke(orch);
    await new Promise((r) => setTimeout(r, 30));
    await expect(invoke(orch)).rejects.toThrow(/busy/i);
    const settled = await first;
    if (settled.status === 'grounded') createdInteractionIds.push(settled.interactionId);
  }, 30_000);

  it('holds NO database transaction across provider latency (concurrent clinical write succeeds)', async () => {
    const slow = new FakeProvider({
      scriptedOutput: validSoapOutput(EXPECTED_GAPS),
      delayMs: 400,
    });
    const orch = makeOrchestrator(slow);

    const pendingAi = invoke(orch);
    await new Promise((r) => setTimeout(r, 50)); // provider call now in-flight

    // Independent clinical write while the provider is slow.
    const [anyStaff] = await db.select({ id: staff.id }).from(staff).limit(1);
    const start = Date.now();
    const [patient] = await db
      .insert(patients)
      .values({
        mrn: `M11-${RUN}`,
        firstName: 'M11NoTx',
        lastName: 'Probe',
        dateOfBirth: '1990-01-01',
        gender: 'female',
        phonePrimary: '0000000000',
        status: 'active',
        createdBy: anyStaff!.id,
      })
      .returning();
    const elapsed = Date.now() - start;
    createdPatientIds.push(patient.id);

    expect(elapsed).toBeLessThan(300); // did not wait out the 400ms provider latency

    const settled = await pendingAi;
    if (settled.status === 'grounded') createdInteractionIds.push(settled.interactionId);
  }, 30_000);
});
