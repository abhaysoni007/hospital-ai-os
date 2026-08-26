import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  __resetAuthClientStateForTests,
  apiClient,
  onSessionExpired,
  setAccessToken,
} from '../api-client';

/**
 * M12.2 Part C REGRESSION — centralized 401 recovery in apiClient.
 *
 * Contract under test:
 *   - one 401 → exactly ONE cookie-based refresh → original retried ONCE
 *   - concurrent 401s share a single refresh (no storm)
 *   - failed refresh clears auth state + emits 'auth:session-expired'
 *   - retried request that 401s again does NOT loop
 *   - skipAuth requests never trigger recovery
 *   - tokens are only ever sent via Authorization headers we assert on
 */

type Call = { url: string; init: RequestInit };

let calls: Call[] = [];
const sessionExpiredHandler = vi.fn();
let unsubscribe: (() => void) | null = null;

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

/** Fetch simulator driven per-test. */
let responder: (url: string, init: RequestInit) => ResponseLike | Promise<ResponseLike>;
interface ResponseLike {
  status: number;
  body?: unknown;
}

beforeEach(() => {
  __resetAuthClientStateForTests();
  calls = [];
  setAccessToken('token-a');
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      const u = String(url);
      const i = init ?? {};
      calls.push({ url: u, init: i });
      const r = await responder(u, i);
      return jsonResponse(r.status, r.body ?? { data: {} });
    }),
  );
  if (typeof window !== 'undefined') {
    window.addEventListener('auth:session-expired', sessionExpiredHandler);
  }
  unsubscribe = onSessionExpired(sessionExpiredHandler);
});

afterEach(() => {
  vi.unstubAllGlobals();
  unsubscribe?.();
  unsubscribe = null;
  sessionExpiredHandler.mockClear();
});

describe('P0-C: 401 recovery', () => {
  it('refreshes once and retries the original request with the new token', async () => {
    let originalCalls = 0;
    responder = (url, init) => {
      if (url.endsWith('/auth/refresh')) {
        return { status: 200, body: { data: { accessToken: 'token-b' } } };
      }
      originalCalls += 1;
      const auth = (init.headers as Record<string, string>)?.Authorization;
      if (originalCalls === 1) return { status: 401 }; // expired token-a
      expect(auth).toBe('Bearer token-b'); // retry carries refreshed token
      return { status: 200, body: { data: { value: 42 } } };
    };

    const result = await apiClient<{ data: { value: number } }>('/encounters', { method: 'GET' });
    expect(result.data.value).toBe(42);
    expect(originalCalls).toBe(2);
    expect(calls.filter((c) => c.url.endsWith('/auth/refresh'))).toHaveLength(1);
    // Refresh is cookie-based: no Authorization header on the refresh call.
    const refreshCall = calls.find((c) => c.url.endsWith('/auth/refresh'));
    expect((refreshCall?.init.headers as Record<string, string>)?.Authorization).toBeUndefined();
    expect(sessionExpiredHandler).not.toHaveBeenCalled();
  });

  it('failed refresh clears auth state, emits session-expired, surfaces the 401', async () => {
    responder = (url) => (url.endsWith('/auth/refresh') ? { status: 401 } : { status: 401 });

    await expect(apiClient('/patients')).rejects.toMatchObject({ statusCode: 401 });
    expect(sessionExpiredHandler).toHaveBeenCalledTimes(1);
    expect(calls.filter((c) => c.url.endsWith('/auth/refresh'))).toHaveLength(1);

    // Subsequent request must NOT carry a token (state cleared).
    await apiClient('/patients').catch(() => undefined);
    const last = calls[calls.length - 1];
    expect((last.init.headers as Record<string, string>)?.Authorization).toBeUndefined();
  });

  it('concurrent 401s trigger EXACTLY ONE shared refresh (no storm)', async () => {
    responder = (url, init) => {
      if (url.endsWith('/auth/refresh')) {
        // Simulate latency so all three 401s arrive while refresh is pending.
        return { status: 200, body: { data: { accessToken: 'token-b' } } };
      }
      void init;
      return { status: 401, body: { data: {} } };
    };
    // Make every retried request succeed so all promises settle cleanly.
    responder = (url) => {
      if (url.endsWith('/auth/refresh')) {
        return { status: 200, body: { data: { accessToken: 'token-b' } } };
      }
      const seen = calls.filter((c) => !c.url.endsWith('/auth/refresh'));
      if (seen.length <= 3) return { status: 401 };
      return { status: 200 };
    };

    await Promise.allSettled([apiClient('/a'), apiClient('/b'), apiClient('/c')]);
    expect(calls.filter((c) => c.url.endsWith('/auth/refresh'))).toHaveLength(1);
  });

  it('does not loop: a retry that 401s again is NOT refreshed or retried again', async () => {
    responder = (url) =>
      url.endsWith('/auth/refresh')
        ? { status: 200, body: { data: { accessToken: 'token-b' } } }
        : { status: 401 };

    await expect(apiClient('/encounters')).rejects.toMatchObject({ statusCode: 401 });
    const originalAttempts = calls.filter((c) => c.url.endsWith('/encounters'));
    expect(originalAttempts).toHaveLength(2); // initial + exactly one retry
    expect(calls.filter((c) => c.url.endsWith('/auth/refresh'))).toHaveLength(1);
    expect(sessionExpiredHandler).toHaveBeenCalledTimes(1); // second 401 ends the session
  });

  it('skipAuth endpoints never trigger recovery', async () => {
    responder = () => ({ status: 401 });
    await expect(
      apiClient('/auth/login', { method: 'POST', skipAuth: true, body: {} }),
    ).rejects.toMatchObject({ statusCode: 401 });
    expect(calls.filter((c) => c.url.includes('/auth/refresh'))).toHaveLength(0);
    expect(sessionExpiredHandler).not.toHaveBeenCalled();
  });

  it('network-level refresh failure behaves like a rejected refresh', async () => {
    responder = (url) => {
      if (url.endsWith('/auth/refresh')) throw new Error('network down');
      return { status: 401 };
    };
    await expect(apiClient('/patients')).rejects.toMatchObject({ statusCode: 401 });
    expect(sessionExpiredHandler).toHaveBeenCalledTimes(1);
  });
});
