import { describe, it, expect, afterAll } from 'vitest';
import { randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';
import { soapNoteDraftOutputSchema } from 'shared';
import type { GapCode } from 'shared';

import { db } from '../../../db';
import { aiInteractions } from '../../../db/schema/ai';
import { auditEvents } from '../../../db/schema/audit';
import { staff } from '../../../db/schema/staff';
import { AuditService } from '../../audit/audit.service';
import { AIOrchestrator } from '../orchestrator';
import { FakeProvider } from '../adapters/fake.provider';
import { aiInteractionRepository, startOfUtcDay } from '../ai.persistence';
import { baseBlocks, validSoapOutput } from './fixtures';

/**
 * M12.1 P0-5 REGRESSION — the daily AI token budget is GLOBAL (hospital-wide),
 * per ADR-017 §8 control-scope table ("Daily token budget | GLOBAL (DB SUM)").
 *
 * Audit finding: sumTokensSince() filtered by initiated_by, silently turning
 * the documented global cap into a per-user cap. These tests prove the scope
 * ACROSS USERS: consumption by user A must count against user B's budget.
 */

const RUN = randomUUID().slice(0, 8);
const EXPECTED_GAPS: GapCode[] = ['NO_PRIOR_NOTES', 'NO_MEDICATION_HISTORY', 'NO_ALLERGY_DATA'];
const CALL_COST = 360; // FakeProvider default: inputTokens 120 + outputTokens 240

const createdInteractionIds: string[] = [];
const auditService = new AuditService();

function makeOrchestrator(provider: FakeProvider, budget: number) {
  return new AIOrchestrator(provider, auditService, {
    readinessOverride: { enabled: true },
    budget,
    rateLimitPerMinute: 1000,
    semaphoreSize: 4,
  });
}

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
});

describe('M12.1 P0-5 — daily token budget GLOBAL scope', () => {
  it('consumption by user A is charged against user B (cross-user enforcement)', async () => {
    const rows = await db.select({ id: staff.id }).from(staff).limit(2);
    if (rows.length < 2) throw new Error('P0-5 test requires at least two seeded staff rows');
    const [userA, userB] = rows;

    const providerA = new FakeProvider({ scriptedOutput: validSoapOutput(EXPECTED_GAPS) });

    // Budget anchored to CURRENT committed GLOBAL usage so this test is
    // deterministic no matter what other suites committed today. Parallel
    // workers may commit rows between anchoring and invocation, so user A's
    // call retries with a fresh anchor; once grounded, user B MUST block.
    let resultA: Awaited<ReturnType<AIOrchestrator['invokeStructured']>> | undefined;
    let orchB: AIOrchestrator | undefined;
    const providerB = new FakeProvider({ scriptedOutput: validSoapOutput(EXPECTED_GAPS) });
    for (let attempt = 0; attempt < 5 && !resultA; attempt++) {
      const usedNow = await aiInteractionRepository.sumTokensForUtcDay(startOfUtcDay());
      const budgetNow = usedNow + CALL_COST; // allows exactly ONE more call
      const orchA = makeOrchestrator(providerA, budgetNow);
      try {
        resultA = await orchA.invokeStructured({
          capability: 'note_draft',
          principal: { staffId: userA.id, role: 'physician', departmentId: 'dept' },
          blocks: baseBlocks,
          outputSchema: soapNoteDraftOutputSchema,
          instructions: `P0-5 run ${RUN} user A`,
        });
        // Same cap for user B — a different staffId, fresh limiter/breaker state.
        orchB = makeOrchestrator(providerB, budgetNow);
      } catch (err) {
        if (!(err instanceof Error && /budget/i.test(err.message)) || attempt === 4) throw err;
      }
    }
    expect(resultA?.status).toBe('grounded');
    if (resultA?.status === 'grounded') createdInteractionIds.push(resultA.interactionId);
    expect(providerA.calls).toBe(1);

    // User B is now blocked BEFORE any provider invocation because the GLOBAL
    // day total is exhausted by user A's committed consumption.
    await expect(
      orchB!.invokeStructured({
        capability: 'note_draft',
        principal: { staffId: userB.id, role: 'nurse', departmentId: 'dept' },
        blocks: baseBlocks,
        outputSchema: soapNoteDraftOutputSchema,
      }),
    ).rejects.toThrow(/budget/i);
    expect(providerB.calls).toBe(0); // never invoked
  }, 30_000);

  it('sumTokensForUtcDay aggregates across distinct initiated_by values', async () => {
    const before = await aiInteractionRepository.sumTokensForUtcDay(startOfUtcDay());
    const rows = await db.select({ id: staff.id }).from(staff).limit(2);
    const [userA, userB] = rows;

    const provider = new FakeProvider({ scriptedOutput: validSoapOutput(EXPECTED_GAPS) });
    const orch = makeOrchestrator(provider, Number.MAX_SAFE_INTEGER / 4);

    const r1 = await orch.invokeStructured({
      capability: 'note_draft',
      principal: { staffId: userA.id, role: 'physician', departmentId: 'dept' },
      blocks: baseBlocks,
      outputSchema: soapNoteDraftOutputSchema,
    });
    if (r1.status === 'grounded') createdInteractionIds.push(r1.interactionId);

    const r2 = await orch.invokeStructured({
      capability: 'note_draft',
      principal: { staffId: userB!.id, role: 'nurse', departmentId: 'dept' },
      blocks: baseBlocks,
      outputSchema: soapNoteDraftOutputSchema,
    });
    if (r2.status === 'grounded') createdInteractionIds.push(r2.interactionId);

    const after = await aiInteractionRepository.sumTokensForUtcDay(startOfUtcDay());
    expect(after - before).toBeGreaterThanOrEqual(CALL_COST * 2);
  }, 30_000);
});
