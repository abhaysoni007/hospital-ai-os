import {
  AIProviderAdapter,
  AIProviderResponse,
  GenerateStructuredParams,
  classifyProviderError,
} from './provider.interface';

/**
 * OpenAI-compatible API adapter (ADR-017).
 * Built with native fetch. Maps M12 internal requests (systemInstruction, userPrompt)
 * into standard Chat Completion JSON payload.
 *
 * M12.1 INVARIANT STRICTLY PRESERVED:
 * `params.userPrompt` is transmitted exactly as-is. `params.context` is explicitly
 * ignored by the wire format (it is merely transport metadata) and MUST NOT be
 * serialized or appended.
 */
export class OpenAICompatibleAdapter implements AIProviderAdapter {
  readonly name = 'openai-compatible';

  constructor(
    private readonly apiKey: string,
    private readonly baseUrl: string,
    private readonly model: string,
  ) {}

  async generateStructuredOutput<T>(
    params: GenerateStructuredParams<T>,
  ): Promise<AIProviderResponse<T>> {
    try {
      const started = Date.now();
      const request = buildOpenAIRequest(params, this.model);

      const endpoint = this.baseUrl.endsWith('/')
        ? `${this.baseUrl}chat/completions`
        : `${this.baseUrl}/chat/completions`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(request),
        signal: params.signal,
      });

      if (response.status === 401 || response.status === 403) {
        throw new Error(`unavailable: HTTP ${response.status} ${await response.text()}`);
      }
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      const result = (await response.json()) as {
        id?: string;
        model?: string;
        choices?: Array<{ message?: { content?: string } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };

      const content = result.choices?.[0]?.message?.content;
      if (typeof content !== 'string') {
        throw new Error('Malformed response: missing choices[0].message.content');
      }

      // Strip markdown code fences (e.g. ```json ... ```) that some models emit.
      const cleanContent = stripCodeFences(content);

      // Adapter-level parse is best-effort. The orchestrator re-validates.
      let parsed: T;
      try {
        parsed = params.outputSchema.parse(JSON.parse(cleanContent));
      } catch {
        parsed = cleanContent as unknown as T;
      }

      return {
        parsedOutput: parsed,
        rawResponse: cleanContent,
        inputTokens: result.usage?.prompt_tokens ?? 0,
        outputTokens: result.usage?.completion_tokens ?? 0,
        latencyMs: Date.now() - started,
        modelName: result.model ?? this.model,
        modelVersion: result.id,
      };
    } catch (err) {
      throw classifyProviderError(err);
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    throw new Error('generateEmbedding is not implemented for openai-compatible adapter.');
  }
}

/**
 * Pure request construction.
 * M12.1 INVARIANT: exactly one canonical userPrompt is sent.
 */
export function buildOpenAIRequest(
  params: GenerateStructuredParams<unknown>,
  model: string,
): {
  model: string;
  messages: Array<{ role: 'system' | 'user'; content: string }>;
  temperature: number;
  top_p: number;
  max_tokens: number;
  response_format: { type: 'json_object' };
} {
  return {
    model,
    messages: [
      { role: 'system', content: params.systemInstruction },
      { role: 'user', content: params.userPrompt },
    ],
    temperature: params.config.temperature,
    top_p: params.config.topP,
    max_tokens: params.config.maxOutputTokens,
    response_format: { type: 'json_object' },
  };
}

/**
 * Strips markdown code fences that some models emit around JSON output.
 * e.g. ```json\n{...}\n``` → {...}
 */
export function stripCodeFences(text: string): string {
  return text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
}
