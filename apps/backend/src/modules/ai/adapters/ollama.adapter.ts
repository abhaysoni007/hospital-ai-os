import {
  AIProviderAdapter,
  AIProviderError,
  AIProviderResponse,
  GenerateStructuredParams,
  classifyProviderError,
} from './provider.interface';

/**
 * Ollama local-model adapter (Phase A — Local AI).
 *
 * Implements the existing AIProviderAdapter contract verbatim.
 * Provider SDK: native fetch only — no external packages.
 *
 * Configuration (all env-driven, no hardcoded values):
 *   AI_PROVIDER=ollama
 *   AI_BASE_URL=http://localhost:11434   (default)
 *   AI_MODEL_NAME=medgemma:latest        (default)
 *   AI_TIMEOUT_MS=60000                  (longer for local inference)
 *
 * Safety invariants (unchanged from ADR-017/018):
 *   - Authorization happens BEFORE context projection, BEFORE this adapter.
 *   - This adapter receives ONLY pre-projected authorized context.
 *   - Critical-value evaluation is deterministic — NOT delegated to any LLM.
 *   - All output is returned as DRAFT — never auto-signed.
 *   - No prompt content is written to audit logs.
 *
 * Failure behavior — maps to existing AIProviderFailureKind taxonomy:
 *   - Ollama not running          → UNAVAILABLE
 *   - Model not installed         → PROVIDER_ERROR
 *   - Timeout                     → TIMEOUT
 *   - Malformed/non-JSON response → MALFORMED
 *   - HTTP error                  → PROVIDER_ERROR / UNAVAILABLE
 */

const OLLAMA_DEFAULT_BASE_URL = 'http://localhost:11434';
const OLLAMA_DEFAULT_MODEL = 'medgemma:latest';

export class OllamaAdapter implements AIProviderAdapter {
  readonly name = 'ollama';

  private readonly baseUrl: string;
  private readonly model: string;

  constructor(baseUrl?: string, model?: string) {
    this.baseUrl = (baseUrl ?? OLLAMA_DEFAULT_BASE_URL).replace(/\/$/, '');
    this.model = model ?? OLLAMA_DEFAULT_MODEL;
  }

  async generateStructuredOutput<T>(
    params: GenerateStructuredParams<T>,
  ): Promise<AIProviderResponse<T>> {
    const started = Date.now();

    try {
      // Build system + user prompt
      const systemPrompt = params.systemInstruction;
      const userPrompt = params.userPrompt;

      // Ollama /api/chat endpoint — supports structured JSON output via `format`
      const requestBody = buildOllamaChatRequest({
        model: this.model,
        systemPrompt,
        userPrompt,
        temperature: params.config.temperature,
        topP: params.config.topP,
        maxTokens: params.config.maxOutputTokens,
      });

      const endpoint = `${this.baseUrl}/api/chat`;

      let response: Response;
      try {
        response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
          signal: params.signal,
        });
      } catch (fetchErr) {
        // Network-level failure (Ollama not running, ECONNREFUSED)
        const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
        if (/ECONNREFUSED|fetch failed|network|ENOTFOUND/i.test(msg)) {
          throw new AIProviderError(
            'UNAVAILABLE',
            `Ollama is not reachable at ${this.baseUrl}. Ensure Ollama is running. (${msg})`,
          );
        }
        if (/aborted|timeout|timed out/i.test(msg)) {
          throw new AIProviderError('TIMEOUT', `Ollama request timed out: ${msg}`);
        }
        throw classifyProviderError(fetchErr);
      }

      if (response.status === 404) {
        // Model not installed — 404 from Ollama for unknown model
        const body = await response.text();
        throw new AIProviderError(
          'PROVIDER_ERROR',
          `Ollama model "${this.model}" not found. Run: ollama pull ${this.model}. (${body})`,
        );
      }

      if (!response.ok) {
        const body = await response.text();
        if (response.status === 503 || response.status === 502) {
          throw new AIProviderError('UNAVAILABLE', `Ollama HTTP ${response.status}: ${body}`);
        }
        throw new AIProviderError('PROVIDER_ERROR', `Ollama HTTP ${response.status}: ${body}`);
      }

      // Ollama /api/chat streams by default; with stream:false returns full JSON object.
      const raw = (await response.json()) as OllamaChatResponse;

      const content = raw.message?.content;
      if (typeof content !== 'string' || content.trim() === '') {
        throw new AIProviderError(
          'MALFORMED',
          'Ollama returned empty or non-string message content.',
        );
      }

      // Strip markdown code fences (some models emit ```json...```)
      const cleaned = stripCodeFences(content);

      // Best-effort parse + Zod validation (orchestrator re-validates)
      let parsedOutput: T;
      try {
        parsedOutput = params.outputSchema.parse(JSON.parse(cleaned));
      } catch {
        // Return raw string; orchestrator's validation pipeline will catch
        parsedOutput = cleaned as unknown as T;
      }

      const inputTokens = raw.prompt_eval_count ?? 0;
      const outputTokens = raw.eval_count ?? 0;

      return {
        parsedOutput,
        rawResponse: cleaned,
        inputTokens,
        outputTokens,
        latencyMs: Date.now() - started,
        modelName: raw.model ?? this.model,
        modelVersion: undefined,
      };
    } catch (err) {
      if (err instanceof AIProviderError) throw err;
      throw classifyProviderError(err);
    }
  }

  /**
   * Embedding via nomic-embed-text or similar.
   * Phase A: not yet wired to production — reserved for Phase B semantic search.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async generateEmbedding(_text: string): Promise<number[]> {
    throw new AIProviderError(
      'PROVIDER_ERROR',
      'generateEmbedding is not implemented for the Ollama adapter in Phase A. Reserved for Phase B (semantic retrieval).',
    );
  }

  /**
   * Health probe — calls Ollama /api/tags to verify reachability and model presence.
   * Used by the evaluation harness and readiness gate.
   */
  async probe(): Promise<{ reachable: boolean; modelInstalled: boolean; latencyMs: number }> {
    const started = Date.now();
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) {
        return { reachable: false, modelInstalled: false, latencyMs: Date.now() - started };
      }
      const data = (await response.json()) as { models?: Array<{ name: string }> };
      const modelInstalled = (data.models ?? []).some(
        (m) => m.name === this.model || m.name.startsWith(this.model.split(':')[0]),
      );
      return { reachable: true, modelInstalled, latencyMs: Date.now() - started };
    } catch {
      return { reachable: false, modelInstalled: false, latencyMs: Date.now() - started };
    }
  }
}

// ─── Request builder ─────────────────────────────────────────────────────────

interface OllamaChatRequestBody {
  model: string;
  messages: Array<{ role: 'system' | 'user'; content: string }>;
  stream: false;
  format: 'json';
  options: {
    temperature: number;
    top_p: number;
    num_predict: number;
  };
}

export function buildOllamaChatRequest(params: {
  model: string;
  systemPrompt: string;
  userPrompt: string;
  temperature: number;
  topP: number;
  maxTokens: number;
}): OllamaChatRequestBody {
  return {
    model: params.model,
    messages: [
      { role: 'system', content: params.systemPrompt },
      { role: 'user', content: params.userPrompt },
    ],
    stream: false,
    format: 'json', // Ollama structured output — forces JSON response
    options: {
      temperature: params.temperature,
      top_p: params.topP,
      num_predict: params.maxTokens,
    },
  };
}

// ─── Response type ────────────────────────────────────────────────────────────

interface OllamaChatResponse {
  model?: string;
  message?: { role?: string; content?: string };
  done?: boolean;
  prompt_eval_count?: number;
  eval_count?: number;
  total_duration?: number;
}

// ─── Utility ─────────────────────────────────────────────────────────────────

/**
 * Strips markdown code fences that some models emit around JSON output.
 * e.g. ```json\n{...}\n``` → {...}
 */
export function stripCodeFences(text: string): string {
  return text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
}
