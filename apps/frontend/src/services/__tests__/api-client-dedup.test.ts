import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  __getInFlightGetRequestsCountForTests,
  __resetAuthClientStateForTests,
  apiClient,
  setAccessToken,
} from '../api-client';

describe('M18 Part 2.1 — In-flight GET Promise Deduplication', () => {
  type Call = { url: string; init: RequestInit };
  let calls: Call[] = [];

  function jsonResponse(status: number, body: unknown) {
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
      headers: {
        get: () => null,
      },
    };
  }

  beforeEach(() => {
    __resetAuthClientStateForTests();
    calls = [];
    setAccessToken('test-token');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    __resetAuthClientStateForTests();
  });

  it('1. two simultaneous identical GET requests share exactly one HTTP request and both callers receive the correct result', async () => {
    let resolveFirstFetch!: (value: unknown) => void;
    const fetchDeferred = new Promise((resolve) => {
      resolveFirstFetch = resolve;
    });

    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
        calls.push({ url: String(url), init: init ?? {} });
        await fetchDeferred;
        return jsonResponse(200, { data: { message: 'shared payload' } });
      }),
    );

    // Issue two simultaneous GET requests for the same endpoint
    const promise1 = apiClient<{ data: { message: string } }>('/notifications?page=1');
    const promise2 = apiClient<{ data: { message: string } }>('/notifications?page=1');

    // In-flight map should contain 1 active entry
    expect(__getInFlightGetRequestsCountForTests()).toBe(1);
    expect(calls.length).toBe(1);

    // Resolve fetch
    resolveFirstFetch(null);

    const [res1, res2] = await Promise.all([promise1, promise2]);

    expect(res1.data.message).toBe('shared payload');
    expect(res2.data.message).toBe('shared payload');
    expect(calls.length).toBe(1); // ONLY 1 HTTP call occurred!

    // After completion, the map must be empty
    expect(__getInFlightGetRequestsCountForTests()).toBe(0);
  });

  it('2. a rejected/failed request is removed from the in-flight map', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('Network failure');
      }),
    );

    await expect(apiClient('/notifications')).rejects.toThrow();

    // Map must be clean after rejection
    expect(__getInFlightGetRequestsCountForTests()).toBe(0);
  });

  it('3. a subsequent request after completion starts a new HTTP request (no stale cache)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
        calls.push({ url: String(url), init: init ?? {} });
        return jsonResponse(200, { data: { count: calls.length } });
      }),
    );

    const first = await apiClient<{ data: { count: number } }>('/patients');
    expect(first.data.count).toBe(1);
    expect(calls.length).toBe(1);
    expect(__getInFlightGetRequestsCountForTests()).toBe(0);

    // Subsequent request after first is completed: must fire a fresh HTTP request
    const second = await apiClient<{ data: { count: number } }>('/patients');
    expect(second.data.count).toBe(2);
    expect(calls.length).toBe(2);
    expect(__getInFlightGetRequestsCountForTests()).toBe(0);
  });

  it('4. different URLs do not share promises', async () => {
    let resolveFetches!: () => void;
    const fetchDeferred = new Promise<void>((resolve) => {
      resolveFetches = resolve;
    });

    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
        calls.push({ url: String(url), init: init ?? {} });
        await fetchDeferred;
        return jsonResponse(200, { data: { url: String(url) } });
      }),
    );

    const p1 = apiClient('/patients');
    const p2 = apiClient('/encounters');

    expect(__getInFlightGetRequestsCountForTests()).toBe(2);
    expect(calls.length).toBe(2);

    resolveFetches();
    await Promise.all([p1, p2]);
    expect(__getInFlightGetRequestsCountForTests()).toBe(0);
  });

  it('5. skipDedup option bypasses deduplication', async () => {
    let resolveFetches!: () => void;
    const fetchDeferred = new Promise<void>((resolve) => {
      resolveFetches = resolve;
    });

    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
        calls.push({ url: String(url), init: init ?? {} });
        await fetchDeferred;
        return jsonResponse(200, { data: {} });
      }),
    );

    const p1 = apiClient('/notifications', { skipDedup: true });
    const p2 = apiClient('/notifications', { skipDedup: true });

    // Both should trigger separate fetch calls
    expect(calls.length).toBe(2);
    expect(__getInFlightGetRequestsCountForTests()).toBe(0);

    resolveFetches();
    await Promise.all([p1, p2]);
  });

  it('6. POST and mutations are never deduplicated', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
        calls.push({ url: String(url), init: init ?? {} });
        return jsonResponse(200, { data: {} });
      }),
    );

    await apiClient('/tasks', { method: 'POST', body: { title: 'New task' } });
    await apiClient('/tasks', { method: 'POST', body: { title: 'New task' } });

    expect(calls.length).toBe(2);
    expect(__getInFlightGetRequestsCountForTests()).toBe(0);
  });
});
