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
      const model = this.model;
      const started = Date.now();
      const result = await model.generateContent({
        systemInstruction: params.systemInstruction,
        contents: [
          { role: 'user', parts: [{ text: buildUserPrompt(params.userPrompt, params.context) }] },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: params.config.temperature,
          topP: params.config.topP,
          maxOutputTokens: params.config.maxOutputTokens,
        },
      });
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

/** Context blocks are rendered into the user prompt as delimited data sections. */
function buildUserPrompt(taskPrompt: string, context: unknown[]): string {
  const rendered = context.length ? JSON.stringify(context, null, 2) : '(no context blocks)';
  return `${rendered}\n\n${taskPrompt}`;
}
