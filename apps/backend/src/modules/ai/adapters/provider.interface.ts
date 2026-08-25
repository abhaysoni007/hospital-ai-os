import { z } from 'zod';

/**
 * AI provider abstraction — ADR-005 interface preserved verbatim.
 * Provider SDKs may be imported ONLY inside `modules/ai/adapters/**` (ADR-017 §11).
 */

export interface GenerationConfig {
  maxOutputTokens: number;
  temperature: number;
  topP: number;
  timeoutMs: number;
}

export interface AIProviderResponse<T> {
  parsedOutput: T;
  rawResponse: unknown;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  modelName: string;
  modelVersion?: string;
}

export interface GenerateStructuredParams<T> {
  systemInstruction: string;
  userPrompt: string;
  context: unknown[];
  outputSchema: z.ZodType<T>;
  config: GenerationConfig;
  /** Cooperative cancellation (timeout / graceful shutdown). */
  signal?: AbortSignal;
}

export interface AIProviderAdapter {
  /** Provider identifier persisted on every interaction (e.g., 'google-gemini'). */
  readonly name: string;
  generateStructuredOutput<T>(params: GenerateStructuredParams<T>): Promise<AIProviderResponse<T>>;
  generateEmbedding(text: string): Promise<number[]>;
}

/**
 * Provider failure taxonomy (ADR-017 §3). Every failure kind is breaker-counted;
 * none is ever retried automatically.
 */
export type AIProviderFailureKind =
  'TIMEOUT' | 'RATE_LIMITED' | 'PROVIDER_ERROR' | 'MALFORMED' | 'UNAVAILABLE';

export class AIProviderError extends Error {
  readonly kind: AIProviderFailureKind;
  constructor(kind: AIProviderFailureKind, message: string) {
    super(`[${kind}] ${message}`);
    this.name = 'AIProviderError';
    this.kind = kind;
  }
}

/**
 * Pure classifier for adapter-level catch blocks. Unit-tested without network
 * access; maps SDK/HTTP failures onto the failure taxonomy.
 */
export function classifyProviderError(err: unknown): AIProviderError {
  if (err instanceof AIProviderError) return err;
  const msg = err instanceof Error ? err.message : String(err);
  if (/aborted|timeout|timed out|ETIMEDOUT/i.test(msg)) {
    return new AIProviderError('TIMEOUT', msg);
  }
  if (/rate.?limit|429|quota|resource_exhausted/i.test(msg)) {
    return new AIProviderError('RATE_LIMITED', msg);
  }
  if (/fetch failed|ECONNREFUSED|ENOTFOUND|network|unavailable|503|502/i.test(msg)) {
    return new AIProviderError('UNAVAILABLE', msg);
  }
  return new AIProviderError('PROVIDER_ERROR', msg);
}
