import { and, eq, gte, sql } from 'drizzle-orm';
import { db } from '../../db';
import { aiInteractions } from '../../db/schema/ai';

/**
 * AI interaction persistence (ADR-020). Respects the existing M2 schema —
 * zero migrations. `contextSummary` carries the metadata-only payload:
 * input manifest + computed gaps + block counts (never narrative).
 */
export interface CreateInteractionValues {
  interactionType: 'note_draft' | 'chart_search' | 'discharge_draft' | 'ocr';
  initiatedBy: string;
  patientId?: string | null;
  encounterId?: string | null;
  promptTemplateId: string;
  contextSummary: Record<string, unknown>;
  modelProvider: string;
  modelName: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  rawResponseEncrypted: string;
  parsedOutput: Record<string, unknown> | null;
  groundingStatus: 'grounded' | 'validation_failed';
}

export const aiInteractionRepository = {
  async create(values: CreateInteractionValues, tx?: unknown): Promise<string> {
    const executor = (tx ?? db) as typeof db;
    const [row] = await executor
      .insert(aiInteractions)
      .values({
        interactionType: values.interactionType,
        initiatedBy: values.initiatedBy,
        patientId: values.patientId ?? null,
        encounterId: values.encounterId ?? null,
        promptTemplateId: values.promptTemplateId,
        contextSummary: values.contextSummary,
        modelProvider: values.modelProvider,
        modelName: values.modelName,
        inputTokens: values.inputTokens,
        outputTokens: values.outputTokens,
        latencyMs: values.latencyMs,
        // ADR-020 §2: ciphertext envelope only — never plaintext provider output.
        rawResponse: values.rawResponseEncrypted,
        parsedOutput: values.parsedOutput,
        groundingStatus: values.groundingStatus,
        userAction: 'pending',
      })
      .returning({ id: aiInteractions.id });
    return row.id;
  },

  /** Globally-correct daily token accounting (ADR-017 §7) — committed rows only. */
  async sumTokensSince(initiatedBy: string, sinceUtc: Date): Promise<number> {
    const rows = await db
      .select({
        total: sql<number>`coalesce(sum(${aiInteractions.inputTokens} + ${aiInteractions.outputTokens}), 0)::int`,
      })
      .from(aiInteractions)
      .where(
        and(eq(aiInteractions.initiatedBy, initiatedBy), gte(aiInteractions.createdAt, sinceUtc)),
      );
    return rows[0]?.total ?? 0;
  },

  async findById(id: string) {
    return db.query.aiInteractions.findFirst({ where: eq(aiInteractions.id, id) });
  },

  /**
   * Guarded lifecycle transitions (ADR-019 B5/B10 mechanics). Zero-row result
   * means "not in expected state" → callers must roll back their transaction.
   */
  async transitionGuarded(
    id: string,
    from: 'pending',
    to: 'pending' | 'accepted' | 'rejected' | 'edited',
    patch?: { rejectionReasonCategory?: string },
    tx?: unknown,
  ): Promise<number> {
    const executor = (tx ?? db) as typeof db;
    const result = await executor
      .update(aiInteractions)
      .set({
        userAction: to,
        ...(patch?.rejectionReasonCategory
          ? { rejectionReason: patch.rejectionReasonCategory }
          : {}),
      })
      .where(and(eq(aiInteractions.id, id), eq(aiInteractions.userAction, from)))
      .returning({ id: aiInteractions.id });
    return result.length;
  },
};

/** UTC day boundary for budget accounting (documented; ADR-017 §7). */
export function startOfUtcDay(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}
