import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import { OpenAICompatibleAdapter } from '../openai-compatible.adapter';

describe('OpenAICompatibleAdapter', () => {
  const apiKey = 'test-api-key';
  const baseUrl = 'https://integrate.api.nvidia.com/v1';
  const model = 'nvidia/nemotron-3.5-lightning-30b-a3b';
  let adapter: OpenAICompatibleAdapter;

  const mockFetch = vi.fn();
  global.fetch = mockFetch;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new OpenAICompatibleAdapter(apiKey, baseUrl, model);
  });

  const baseParams = {
    systemInstruction: 'You are a medical assistant.',
    userPrompt: 'Write a note.',
    context: [{ type: 'dummy', text: 'SHOULD BE IGNORED BY WIRE FORMAT' }], // M12.1 INVARIANT
    outputSchema: z.object({ note: z.string() }),
    config: {
      maxOutputTokens: 100,
      temperature: 0.2,
      topP: 0.9,
      timeoutMs: 30000,
    },
  };

  it('1. correct endpoint construction, method, headers, and payload', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 'test-id',
        model: 'test-model',
        choices: [{ message: { content: '{"note":"test note"}' } }],
        usage: { prompt_tokens: 10, completion_tokens: 20 },
      }),
    });

    const res = await adapter.generateStructuredOutput(baseParams);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];

    expect(url).toBe('https://integrate.api.nvidia.com/v1/chat/completions');
    expect(options.method).toBe('POST');
    expect(options.headers).toEqual({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    });

    const body = JSON.parse(options.body);
    expect(body.model).toBe(model);
    expect(body.temperature).toBe(0.2);
    expect(body.top_p).toBe(0.9);
    expect(body.max_tokens).toBe(100);
    expect(body.response_format).toEqual({ type: 'json_object' });

    // Canonical userPrompt preserved exactly.
    expect(body.messages).toEqual([
      { role: 'system', content: baseParams.systemInstruction },
      { role: 'user', content: baseParams.userPrompt },
    ]);

    // Context is NEVER serialized (M12.1 INVARIANT).
    expect(options.body).not.toContain('SHOULD BE IGNORED BY WIRE FORMAT');

    expect(res.parsedOutput).toEqual({ note: 'test note' });
    expect(res.rawResponse).toBe('{"note":"test note"}');
    expect(res.inputTokens).toBe(10);
    expect(res.outputTokens).toBe(20);
    expect(res.modelName).toBe('test-model');
    expect(res.modelVersion).toBe('test-id');
  });

  it('2. handles empty response gracefully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [],
      }),
    });

    await expect(adapter.generateStructuredOutput(baseParams)).rejects.toThrow(
      /missing choices\[0\].message.content/,
    );
  });

  it('3. malformed JSON falls back to raw string (orchestrator re-validates)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'invalid json' } }],
      }),
    });

    const res = await adapter.generateStructuredOutput(baseParams);
    expect(res.parsedOutput).toBe('invalid json'); // Schema parse fails, falls back to string.
    expect(res.rawResponse).toBe('invalid json');
  });

  it('4. maps 401/403 to UNAVAILABLE (auth failures are deterministic config errors)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized',
    });

    await expect(adapter.generateStructuredOutput(baseParams)).rejects.toMatchObject({
      kind: 'UNAVAILABLE',
    });
  });

  it('5. maps 429 to RATE_LIMITED', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      text: async () => 'Too Many Requests',
    });

    await expect(adapter.generateStructuredOutput(baseParams)).rejects.toMatchObject({
      kind: 'RATE_LIMITED',
    });
  });

  it('6. maps 5xx to UNAVAILABLE', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 503,
      text: async () => 'Service Unavailable',
    });

    await expect(adapter.generateStructuredOutput(baseParams)).rejects.toMatchObject({
      kind: 'UNAVAILABLE',
    });
  });

  it('7. maps timeouts to TIMEOUT', async () => {
    mockFetch.mockRejectedValueOnce(new Error('The operation was aborted'));

    await expect(adapter.generateStructuredOutput(baseParams)).rejects.toMatchObject({
      kind: 'TIMEOUT',
    });
  });

  it('8. generateEmbedding is not implemented', async () => {
    await expect(adapter.generateEmbedding('test')).rejects.toThrow(/not implemented/);
  });
});
