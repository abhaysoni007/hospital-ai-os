import { randomUUID } from 'crypto';
import { z } from 'zod';
import {
  AIProviderAdapter,
  AIProviderError,
  AIProviderResponse,
  GenerateStructuredParams,
  GenerationConfig,
} from './provider.interface';

/**
 * Deterministic FakeProvider (ADR-017 §11). Implements the ADR-005 interface
 * exactly, with fault-injection modes so every resilience/validation test —
 * and the M11 live gate — runs without network access or credentials.
 *
 * Modes:
 *  ok            → returns scripted JSON output (default: valid per schema)
 *  timeout       → rejects with TIMEOUT after delayMs
 *  server_error  → rejects with PROVIDER_ERROR (simulated 5xx)
 *  rate_limited  → rejects with RATE_LIMITED (simulated 429)
 *  unavailable   → rejects with UNAVAILABLE (connection-refused simulation)
 *  malformed     → resolves with non-JSON raw text (pipeline PARSE stage fails)
 *  invalid_schema→ resolves with valid JSON of the wrong shape (SCHEMA stage fails)
 */
export type FakeProviderMode =
  | 'ok'
  | 'timeout'
  | 'server_error'
  | 'rate_limited'
  | 'unavailable'
  | 'malformed'
  | 'invalid_schema';

export interface FakeProviderOptions {
  mode?: FakeProviderMode;
  delayMs?: number;
  /** Scripted JSON payload for `ok` mode. Defaults to a schema-derived minimal object. */
  scriptedOutput?: unknown;
  inputTokens?: number;
  outputTokens?: number;
}

export class FakeProvider implements AIProviderAdapter {
  readonly name = 'fake';
  mode: FakeProviderMode;
  delayMs: number;
  scriptedOutput?: unknown;
  calls = 0;
  lastParams: GenerateStructuredOutputCapture | null = null;

  constructor(options: FakeProviderOptions = {}) {
    this.mode = options.mode ?? 'ok';
    this.delayMs = options.delayMs ?? 0;
    this.scriptedOutput = options.scriptedOutput;
    this.inputTokens = options.inputTokens ?? 120;
    this.outputTokens = options.outputTokens ?? 240;
  }

  private inputTokens: number;
  private outputTokens: number;

  async generateStructuredOutput<T>(
    params: GenerateStructuredParams<T>,
  ): Promise<AIProviderResponse<T>> {
    this.calls += 1;
    this.lastParams = {
      systemInstruction: params.systemInstruction,
      userPrompt: params.userPrompt,
    };
    const latencyMs = 5 + this.delayMs;

    // Respect cooperative cancellation (timeout / graceful shutdown).
    const abortAsRejected = new Promise<never>((_, reject) => {
      if (params.signal?.aborted)
        reject(new AIProviderError('UNAVAILABLE', 'aborted before start'));
      else
        params.signal?.addEventListener(
          'abort',
          () => reject(new AIProviderError('UNAVAILABLE', 'aborted')),
          { once: true },
        );
    });
    abortAsRejected.catch(() => undefined);
    await Promise.race([sleep(this.delayMs), abortAsRejected]);

    switch (this.mode) {
      case 'timeout':
        throw new AIProviderError('TIMEOUT', 'simulated provider timeout');
      case 'server_error':
        throw new AIProviderError('PROVIDER_ERROR', 'simulated 500 from provider');
      case 'rate_limited':
        throw new AIProviderError('RATE_LIMITED', 'simulated 429 from provider');
      case 'unavailable':
        throw new AIProviderError('UNAVAILABLE', 'simulated connection refused');
      case 'malformed':
        return this.respond<T>('{not-json-at-all', undefined, params.config, latencyMs);
      case 'invalid_schema':
        return this.respond(
          JSON.stringify({ totally: 'wrong shape' }),
          { totally: 'wrong shape' } as unknown as T,
          params.config,
          latencyMs,
        );
      case 'ok':
      default: {
        const payload = this.scriptedOutput ?? minimalValidOutput(params.outputSchema);
        return this.respond(JSON.stringify(payload), payload as T, params.config, latencyMs);
      }
    }
  }

  private respond<T>(
    rawText: string,
    parsed: T | undefined,
    config: GenerationConfig,
    latencyMs: number,
  ): AIProviderResponse<T> {
    void config;
    return {
      // Adapter-level parse is best-effort; the orchestrator pipeline re-validates.
      parsedOutput: (parsed ?? rawText) as T,
      rawResponse: rawText,
      inputTokens: this.inputTokens,
      outputTokens: this.outputTokens,
      latencyMs,
      modelName: 'fake-model',
      modelVersion: 'fake-model@1',
    };
  }

  async generateEmbedding(text: string): Promise<number[]> {
    // Experimental-unused in v1 (ADR-017 §11). Deterministic pseudo-embedding.
    void text;
    return Array.from({ length: 8 }, () => 0.5);
  }
}

export interface GenerateStructuredOutputCapture {
  systemInstruction: string;
  userPrompt: string;
}

function sleep(ms: number): Promise<void> {
  if (!ms) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Derives a minimal object satisfying "object-shaped" schemas well enough for
 * generic tests; capability tests always pass explicit scripted outputs.
 */
function minimalValidOutput(schema: z.ZodType): unknown {
  void schema;
  return { disclaimers: ['AI-generated draft for clinician review.'], informationGaps: [] };
}

/** Convenience id for telemetry assertions. */
export const fakeRunId = (): string => randomUUID();
