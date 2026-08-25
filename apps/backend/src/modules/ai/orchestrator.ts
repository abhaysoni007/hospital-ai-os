import { randomUUID } from 'crypto';
import { z } from 'zod';
import { AiCapability, ContextBlock, GapCode, InputManifestEntry } from 'shared';

import { AuditService } from '../audit/audit.service';
import { encryptField } from '../../utils/encryption';
import { config } from '../../config';
import { AIProviderAdapter, AIProviderError } from './adapters/provider.interface';
import { buildInputManifest, computeInformationGaps } from './context/projections';
import { getPromptTemplate } from './prompts';
import { CircuitBreaker } from './resilience/circuit-breaker';
import { Semaphore, AiBusyError } from './resilience/semaphore';
import { PerUserRateLimiter } from './resilience/rate-limiter';
import { aiShutdownRegistry, withProviderTimeout } from './resilience/timeout';
import { PipelineResult, runValidationPipeline } from './validation/output-pipeline';
import { startOfUtcDay, aiInteractionRepository } from './ai.persistence';
import { AI_AUDIT_EVENTS, AiAuditActor, buildAiInteractionAuditEvent } from './ai.audit';
import { computeAiSubsystemState, resolveReadinessInputs } from './ai.readiness';
import { AIServiceError } from 'shared';
import { RateLimitError } from 'shared';

/**
 * Governed AI orchestration (ADR-017/018/020).
 *
 * Invocation order: readiness → daily token budget (GLOBAL, DB-backed) →
 * per-user limiter → semaphore → provider call OUTSIDE any DB transaction →
 * validation pipeline → SHORT TAIL TX: interaction + audit event.
 *
 * Provider hard-failure ⇒ ZERO rows (no telemetry row for transport failures);
 * validation failure ⇒ telemetry persisted as `validation_failed`; neither can
 * affect any clinical workflow.
 */

/** Actor principal for AI invocations (audit-identity shape). */
export type AiPrincipal = AiAuditActor;

export interface InvokeStructuredParams<T> {
  capability: AiCapability;
  principal: AiPrincipal;
  patientId?: string;
  encounterId?: string;
  /** Already-projected authorized context blocks (ADR-018 §2). */
  blocks: readonly ContextBlock[];
  /** Bounded clinician slot. */
  instructions?: string;
  /** Capability request metadata persisted in contextSummary (e.g., recordType — ADR-019 B8). */
  requestMeta?: Record<string, unknown>;
  outputSchema: z.ZodType<T>;
  correlationId?: string;
}

export type InvokeStructuredResult<T> =
  | {
      status: 'grounded';
      interactionId: string;
      parsed: T;
      manifest: InputManifestEntry[];
      gaps: GapCode[];
      inputTokens: number;
      outputTokens: number;
      latencyMs: number;
    }
  | {
      status: 'validation_failed';
      interactionId: string;
      failures: PipelineResult<never>['failures'];
      gaps: GapCode[];
    };

/** Test/DI seam: overrides for env-derived inputs (unit + gate harness use). */
export type OrchestratorOptions = {
  budget?: number;
  rateLimitPerMinute?: number;
  semaphoreSize?: number;
  timeoutMs?: number;
  /** Deterministic clock for breaker timing tests. */
  clockNow?: () => number;
  /** When provided, replaces env-derived readiness inputs entirely. */
  readinessOverride?: { enabled: boolean };
};

export class AIOrchestrator {
  private readonly breaker: CircuitBreaker;
  private readonly semaphore: Semaphore;
  private readonly limiter: PerUserRateLimiter;
  private readonly budget: number;
  private readonly timeoutMs: number;
  private readonly readinessOverride?: { enabled: boolean };

  constructor(
    private readonly adapter: AIProviderAdapter,
    private readonly auditService: AuditService,
    options: OrchestratorOptions = {},
  ) {
    this.budget = options.budget ?? config.AI_DAILY_TOKEN_BUDGET;
    this.limiter = new PerUserRateLimiter(
      options.rateLimitPerMinute ?? config.AI_PER_USER_RATE_LIMIT,
    );
    this.semaphore = new Semaphore(options.semaphoreSize ?? config.AI_SEMAPHORE_SIZE);
    this.timeoutMs = options.timeoutMs ?? config.AI_TIMEOUT_MS;
    this.readinessOverride = options.readinessOverride;
    this.breaker = new CircuitBreaker(options.clockNow ? { now: options.clockNow } : {});
  }

  get breakerState() {
    return this.breaker.getState();
  }

  async invokeStructured<T>(params: InvokeStructuredParams<T>): Promise<InvokeStructuredResult<T>> {
    const correlationId = params.correlationId ?? randomUUID();
    const capability = params.capability;

    // 1) Readiness gate — before ANY cost is incurred.
    let state: ReturnType<typeof computeAiSubsystemState>;
    if (this.readinessOverride) {
      state = this.readinessOverride.enabled ? 'ready' : 'disabled';
    } else {
      state = computeAiSubsystemState(resolveReadinessInputs(config), this.breaker.getState());
    }
    if (state !== 'ready') {
      throw new AIServiceError(`AI subsystem unavailable (${state})`);
    }

    // 2) GLOBAL daily token budget — DB-backed, correct across replicas.
    const used = await aiInteractionRepository.sumTokensSince(
      params.principal.staffId,
      startOfUtcDay(),
    );
    if (used >= this.budget) {
      throw new RateLimitError('Daily AI token budget exhausted');
    }

    // 3) Per-user invocation limiter.
    const rl = this.limiter.check(params.principal.staffId);
    if (!rl.allowed) {
      throw new RateLimitError(`AI invocation rate limit reached; retry in ${rl.retryAfterSec}s`);
    }

    // 4) Context → deterministic gaps + mechanical manifest (ADR-018).
    const capturedAt = new Date();
    const manifest = buildInputManifest(params.blocks, capturedAt);
    const gaps = computeInformationGaps(capability, params.blocks);

    // 5) Prompt assembly (versioned template; pure module).
    const template = getPromptTemplate(capability);
    const prompt = template.build({
      blocks: params.blocks,
      gaps,
      instructions: params.instructions,
    });

    // 6) Semaphore + breaker + timeout around the provider call — NO DB tx held.
    let providerRaw: unknown = null;
    let tokensIn = 0;
    let tokensOut = 0;
    let latencyMs = 0;

    try {
      await this.semaphore.run(async () => {
        const response = await this.breaker.execute(() =>
          withProviderTimeout(this.timeoutMs, async (signal) => {
            return this.adapter.generateStructuredOutput<T>({
              systemInstruction: prompt.systemInstruction,
              userPrompt: prompt.userPrompt,
              context: params.blocks as unknown[],
              outputSchema: params.outputSchema,
              signal,
              config: {
                maxOutputTokens: config.AI_MAX_TOKENS,
                temperature: 0.2,
                topP: 0.9,
                timeoutMs: this.timeoutMs,
              },
            });
          }),
        );
        providerRaw = response.rawResponse;
        tokensIn = response.inputTokens;
        tokensOut = response.outputTokens;
        latencyMs = response.latencyMs;
      });
    } catch (err) {
      // Transport-level failure ⇒ zero rows; mapped to safe typed errors.
      throw mapTransportError(err);
    }

    // 7) Validation pipeline — invalid output NEVER enters application state.
    const result = runValidationPipeline(providerRaw as string, {
      schema: params.outputSchema,
      manifest,
      requiredGaps: gaps,
    });

    // 8) SHORT TAIL TX: interaction persistence + metadata-only audit event.
    const rawText = typeof providerRaw === 'string' ? providerRaw : JSON.stringify(providerRaw);
    const interactionId = await persistInteractionAndAudit(this.adapter, this.auditService, {
      capability,
      principal: params.principal,
      patientId: params.patientId ?? null,
      encounterId: params.encounterId ?? null,
      promptTemplateId: prompt.templateId,
      contextSummary: {
        manifest,
        computedGaps: gaps,
        blockCounts: countBlocks(params.blocks),
        ...(params.requestMeta ?? {}),
      },
      rawResponseEncrypted: encryptField(rawText),
      parsedOutput:
        result.status === 'grounded' ? (result.parsed as Record<string, unknown>) : null,
      groundingStatus: result.status === 'grounded' ? 'grounded' : 'validation_failed',
      inputTokens: tokensIn,
      outputTokens: tokensOut,
      latencyMs: latencyMs,
      failures: result.failures,
      correlationId,
    });

    return result.status === 'grounded'
      ? {
          status: 'grounded',
          interactionId,
          parsed: result.parsed as T,
          manifest,
          gaps,
          inputTokens: tokensIn,
          outputTokens: tokensOut,
          latencyMs: latencyMs,
        }
      : { status: 'validation_failed', interactionId, failures: result.failures, gaps };
  }
}

// ---------------------------------------------------------------------------

function countBlocks(blocks: readonly ContextBlock[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const b of blocks) counts[b.blockType] = (counts[b.blockType] ?? 0) + 1;
  return counts;
}

function mapTransportError(err: unknown): Error {
  if (err instanceof RateLimitError || err instanceof AIServiceError) return err;
  if (err instanceof AiBusyError) return new AIServiceError('AI subsystem busy');
  if (err instanceof AIProviderError) {
    if (err.kind === 'RATE_LIMITED') return new RateLimitError('AI provider rate limited');
    return new AIServiceError(`AI service unavailable (${err.kind})`);
  }
  if (err instanceof Error && err.name === 'AiCircuitOpenError') {
    return new AIServiceError('AI circuit breaker open');
  }
  return new AIServiceError('AI service unavailable');
}

async function persistInteractionAndAudit(
  adapter: AIProviderAdapter,
  auditService: AuditService,
  args: {
    capability: AiCapability;
    principal: AiPrincipal;
    patientId: string | null;
    encounterId: string | null;
    promptTemplateId: string;
    contextSummary: Record<string, unknown>;
    rawResponseEncrypted: string;
    parsedOutput: Record<string, unknown> | null;
    groundingStatus: 'grounded' | 'validation_failed';
    inputTokens: number;
    outputTokens: number;
    latencyMs: number;
    failures: PipelineResult<never>['failures'];
    correlationId: string;
  },
): Promise<string> {
  const eventType =
    args.capability === 'note_draft'
      ? AI_AUDIT_EVENTS.DRAFT_GENERATED
      : AI_AUDIT_EVENTS.SEARCH_EXECUTED;

  const interactionId = await aiInteractionRepository.create({
    interactionType: args.capability,
    initiatedBy: args.principal.staffId,
    patientId: args.patientId,
    encounterId: args.encounterId,
    promptTemplateId: args.promptTemplateId,
    contextSummary: args.contextSummary,
    modelProvider: adapter.name,
    modelName: config.AI_MODEL_NAME,
    inputTokens: args.inputTokens,
    outputTokens: args.outputTokens,
    latencyMs: args.latencyMs,
    rawResponseEncrypted: args.rawResponseEncrypted,
    parsedOutput: args.parsedOutput,
    groundingStatus: args.groundingStatus,
  });

  await auditService.logEvent(
    buildAiInteractionAuditEvent({
      eventType,
      actor: args.principal,
      interactionId,
      patientId: args.patientId,
      detail: {
        capability: args.capability,
        promptTemplateId: args.promptTemplateId,
        modelProvider: adapter.name,
        modelName: config.AI_MODEL_NAME,
        inputTokens: args.inputTokens,
        outputTokens: args.outputTokens,
        latencyMs: args.latencyMs,
        groundingStatus: args.groundingStatus,
      },
    }),
    args.correlationId,
  );

  return interactionId;
}

/** Abort all in-flight provider calls — wired into graceful shutdown (ADR-017 §9). */
export function abortInFlightAiCalls(reason = 'graceful-shutdown'): number {
  return aiShutdownRegistry.abortAll(reason);
}
