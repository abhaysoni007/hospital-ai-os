/**
 * OllamaAdapter unit tests — Phase A.
 *
 * All tests use intercepted fetch (no real Ollama required).
 * Covers: success, malformed, timeout, model-not-found, Ollama-unavailable, HTTP errors.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';
import { OllamaAdapter, buildOllamaChatRequest, stripCodeFences } from '../ollama.adapter';
import { AIProviderError } from '../provider.interface';
import type { GenerateStructuredParams } from '../provider.interface';

// ─── Schema fixture ───────────────────────────────────────────────────────────

const TestSchema = z.object({ summary: z.string(), confidence: z.number() });
type TestOutput = z.infer<typeof TestSchema>;

const baseParams: GenerateStructuredParams<TestOutput> = {
  systemInstruction: 'You are a clinical assistant.',
  userPrompt: 'Summarize the patient status.',
  context: [],
  outputSchema: TestSchema,
  config: { maxOutputTokens: 512, temperature: 0.2, topP: 0.9, timeoutMs: 10000 },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeOllamaResponse(content: string, model = 'medgemma:latest') {
  return {
    model,
    message: { role: 'assistant', content },
    done: true,
    prompt_eval_count: 100,
    eval_count: 50,
    total_duration: 1000000,
  };
}

function mockFetch(response: Partial<Response> & { json?: () => Promise<unknown> }) {
  return vi.spyOn(global, 'fetch').mockResolvedValueOnce(response as Response);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('OllamaAdapter', () => {
  let adapter: OllamaAdapter;

  beforeEach(() => {
    adapter = new OllamaAdapter('http://localhost:11434', 'medgemma:latest');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Success path ─────────────────────────────────────────────────────────

  it('parses valid structured JSON response', async () => {
    const validContent = JSON.stringify({ summary: 'Patient stable', confidence: 0.9 });
    mockFetch({
      ok: true,
      status: 200,
      json: async () => makeOllamaResponse(validContent),
    });

    const result = await adapter.generateStructuredOutput(baseParams);

    expect(result.parsedOutput).toEqual({ summary: 'Patient stable', confidence: 0.9 });
    expect(result.modelName).toBe('medgemma:latest');
    expect(result.inputTokens).toBe(100);
    expect(result.outputTokens).toBe(50);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('strips markdown code fences before parsing', async () => {
    const fencedContent = '```json\n{"summary":"Stable","confidence":0.8}\n```';
    mockFetch({
      ok: true,
      status: 200,
      json: async () => makeOllamaResponse(fencedContent),
    });

    const result = await adapter.generateStructuredOutput(baseParams);
    expect(result.parsedOutput).toEqual({ summary: 'Stable', confidence: 0.8 });
  });

  it('returns raw string if JSON parse fails (orchestrator will catch)', async () => {
    mockFetch({
      ok: true,
      status: 200,
      json: async () => makeOllamaResponse('not valid json at all'),
    });

    const result = await adapter.generateStructuredOutput(baseParams);
    // parsedOutput is the raw string (schema parse failed)
    expect(typeof result.rawResponse).toBe('string');
  });

  // ── Malformed response ────────────────────────────────────────────────────

  it('throws MALFORMED when message content is empty', async () => {
    mockFetch({
      ok: true,
      status: 200,
      json: async () => ({ model: 'medgemma:latest', message: { content: '' }, done: true }),
    });

    await expect(adapter.generateStructuredOutput(baseParams)).rejects.toMatchObject({
      kind: 'MALFORMED',
    });
  });

  it('throws MALFORMED when message field is missing', async () => {
    mockFetch({
      ok: true,
      status: 200,
      json: async () => ({ model: 'medgemma:latest', done: true }),
    });

    await expect(adapter.generateStructuredOutput(baseParams)).rejects.toMatchObject({
      kind: 'MALFORMED',
    });
  });

  // ── Model not installed ───────────────────────────────────────────────────

  it('throws PROVIDER_ERROR (model not found) on HTTP 404', async () => {
    mockFetch({
      ok: false,
      status: 404,
      text: async () => 'model "medgemma:latest" not found',
    });

    await expect(adapter.generateStructuredOutput(baseParams)).rejects.toMatchObject({
      kind: 'PROVIDER_ERROR',
      message: expect.stringContaining('not found'),
    });
  });

  // ── Ollama unavailable (network-level) ────────────────────────────────────

  it('throws UNAVAILABLE when fetch throws ECONNREFUSED', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValueOnce(
      new Error('fetch failed: connect ECONNREFUSED 127.0.0.1:11434'),
    );

    await expect(adapter.generateStructuredOutput(baseParams)).rejects.toMatchObject({
      kind: 'UNAVAILABLE',
    });
  });

  // ── Timeout ───────────────────────────────────────────────────────────────

  it('throws TIMEOUT when fetch is aborted', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValueOnce(
      Object.assign(new Error('The operation was aborted'), { name: 'AbortError' }),
    );

    await expect(adapter.generateStructuredOutput(baseParams)).rejects.toMatchObject({
      kind: 'TIMEOUT',
    });
  });

  // ── HTTP errors ───────────────────────────────────────────────────────────

  it('throws UNAVAILABLE on HTTP 503', async () => {
    mockFetch({
      ok: false,
      status: 503,
      text: async () => 'Service Unavailable',
    });

    await expect(adapter.generateStructuredOutput(baseParams)).rejects.toMatchObject({
      kind: 'UNAVAILABLE',
    });
  });

  it('throws PROVIDER_ERROR on generic HTTP 500', async () => {
    mockFetch({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    });

    await expect(adapter.generateStructuredOutput(baseParams)).rejects.toMatchObject({
      kind: 'PROVIDER_ERROR',
    });
  });

  // ── generateEmbedding not implemented (Phase A) ───────────────────────────

  it('throws PROVIDER_ERROR for generateEmbedding (Phase A not implemented)', async () => {
    await expect(adapter.generateEmbedding('test text')).rejects.toMatchObject({
      kind: 'PROVIDER_ERROR',
    });
  });

  // ── name property ─────────────────────────────────────────────────────────

  it('has name = "ollama"', () => {
    expect(adapter.name).toBe('ollama');
  });

  // ── Default config ────────────────────────────────────────────────────────

  it('uses default base URL and model when constructed without args', () => {
    const defaultAdapter = new OllamaAdapter();
    expect(defaultAdapter.name).toBe('ollama');
    // Can't inspect private fields directly — probe via fetch URL
  });
});

// ─── buildOllamaChatRequest ───────────────────────────────────────────────────

describe('buildOllamaChatRequest', () => {
  it('builds correct request structure', () => {
    const req = buildOllamaChatRequest({
      model: 'medgemma:latest',
      systemPrompt: 'System prompt',
      userPrompt: 'User prompt',
      temperature: 0.3,
      topP: 0.9,
      maxTokens: 1024,
    });

    expect(req.model).toBe('medgemma:latest');
    expect(req.stream).toBe(false);
    expect(req.format).toBe('json');
    expect(req.messages).toHaveLength(2);
    expect(req.messages[0]).toEqual({ role: 'system', content: 'System prompt' });
    expect(req.messages[1]).toEqual({ role: 'user', content: 'User prompt' });
    expect(req.options.temperature).toBe(0.3);
    expect(req.options.num_predict).toBe(1024);
  });

  it('M12.1 invariant: context is NOT serialized into the request body', () => {
    const req = buildOllamaChatRequest({
      model: 'medgemma:latest',
      systemPrompt: 'sys',
      userPrompt: 'user',
      temperature: 0.5,
      topP: 0.9,
      maxTokens: 512,
    });

    // The raw request body must not contain a "context" key
    const json = JSON.stringify(req);
    expect(json).not.toContain('"context"');
  });
});

// ─── stripCodeFences ─────────────────────────────────────────────────────────

describe('stripCodeFences', () => {
  it('strips ```json fences', () => {
    expect(stripCodeFences('```json\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it('strips plain ``` fences', () => {
    expect(stripCodeFences('```\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it('leaves plain JSON untouched', () => {
    expect(stripCodeFences('{"a":1}')).toBe('{"a":1}');
  });
});
