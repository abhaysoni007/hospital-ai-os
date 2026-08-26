import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  AIProviderAdapter,
  AIProviderResponse,
  GenerateStructuredParams,
  classifyProviderError,
} from './provider.interface';

/**
 * Google Gemini adapter (ADR-005/017). The ONLY module permitted to import the
 * provider SDK (ADR-017 §11 import boundary, lint-enforced). Thin by design:
 * request construction + response/error mapping. All orchestration, validation
 * and persistence live outside this file.
 *
 * M12.1 P0-2 — SINGLE RENDERING PATH (ADR-018 §11 / PROMPT_ARCHITECTURE §4):
 * The versioned prompt template produces the complete, canonicalized
 * `userPrompt` (trusted task layer + delimited untrusted slots with
 * delimiter-neutralized clinical content). The adapter MUST NOT re-render
 * raw context blocks itself — doing so previously bypassed canonicalization
 * on the real provider wire and duplicated token cost. `params.context`
 * remains part of the ADR-005 interface for provider-agnostic transport
 * metadata but is NEVER serialized into a prompt by any adapter.
 */
export class GeminiAdapter implements AIProviderAdapter {
  readonly name = 'google-gemini';
  private readonly model;

  constructor(apiKey: string, modelName: string) {
    const client = new GoogleGenerativeAI(apiKey);
    this.model = client.getGenerativeModel({ model: modelName });
  }

  async generateStructuredOutput<T>(
    params: GenerateStructuredParams<T>,
  ): Promise<AIProviderResponse<T>> {
    try {
      const started = Date.now();
      const request = buildGeminiRequest(params);
      const result = await this.model.generateContent(request);
      const response = result.response;
      const text = response.text();
      const usage = response.usageMetadata;
      // Adapter-level parse is best-effort; the orchestrator pipeline re-validates
      // the raw text against the schema independently (never trusts this parse).
      let parsed: T;
      try {
        parsed = params.outputSchema.parse(JSON.parse(text));
      } catch {
        parsed = text as unknown as T;
      }
      return {
        parsedOutput: parsed,
        rawResponse: text,
        inputTokens: usage?.promptTokenCount ?? 0,
        outputTokens: usage?.candidatesTokenCount ?? 0,
        latencyMs: Date.now() - started,
        modelName: this.model.model ?? 'unknown',
        modelVersion: (response as { modelVersion?: string }).modelVersion,
      };
    } catch (err) {
      throw classifyProviderError(err);
    }
  }

  /**
   * Experimental-unused in v1 (ADR-017 §11): no M12 capability consumes
   * embeddings; interface completeness per ADR-005 only.
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const embedder = this.model;
      const { embedding } = await embedder.embedContent(text);
      return embedding.values;
    } catch (err) {
      throw classifyProviderError(err);
    }
  }
}

/**
 * Pure request construction — the deterministic seam for adversarial wire-format
 * tests (no SDK client required). Exports stay inside adapters/ per ADR-017 §11.
 *
 * Invariant tested by M12.1: the user content is EXACTLY `params.userPrompt`.
 * No adapter-side re-rendering of `params.context` may exist.
 */
export function buildGeminiRequest(params: GenerateStructuredParams<unknown>): {
  systemInstruction: string;
  contents: Array<{ role: 'user'; parts: Array<{ text: string }> }>;
  generationConfig: {
    responseMimeType: 'application/json';
    temperature: number;
    topP: number;
    maxOutputTokens: number;
  };
} {
  return {
    systemInstruction: params.systemInstruction,
    contents: [{ role: 'user', parts: [{ text: params.userPrompt }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: params.config.temperature,
      topP: params.config.topP,
      maxOutputTokens: params.config.maxOutputTokens,
    },
  };
}
