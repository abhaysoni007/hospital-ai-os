/**
 * Hospital AI OS — Frontend Typed API Client
 *
 * Handles HTTP requests, in-memory token injection, and structured error responses.
 * Never writes access tokens or secrets to persistent storage (localStorage / sessionStorage).
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';

// Strict in-memory access token storage (cleared on page reload/close)
let inMemoryAccessToken: string | null = null;

export function getAccessToken(): string | null {
  return inMemoryAccessToken;
}

export function setAccessToken(token: string | null): void {
  inMemoryAccessToken = token;
}

export interface ApiErrorPayload {
  code: string;
  message: string;
  details?: unknown;
  requestId?: string;
}

export class ApiError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: unknown;
  public readonly requestId?: string;

  constructor(statusCode: number, payload: ApiErrorPayload) {
    super(payload.message || 'An unexpected error occurred');
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = payload.code || 'UNKNOWN_ERROR';
    this.details = payload.details;
    this.requestId = payload.requestId;
  }
}

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  /** Structured request payload. apiClient OWNS serialization (M12.1 P0-1). */
  body?: unknown;
  skipAuth?: boolean;
  /** Internal: set when a request has already been retried after refresh (M12.2 Part C). */
  _retried?: boolean;
}

// ---------------------------------------------------------------------------
// M12.2 Part C — centralized 401 recovery
//
// Contract:
//   * On the FIRST 401 of an authenticated request, attempt EXACTLY ONE
//     cookie-based refresh (POST /auth/refresh, credentials include).
//   * Concurrent 401s share a single in-flight refresh (no storm).
//   * After successful refresh the original request is retried EXACTLY ONCE
//     (_retried flag prevents loops).
//   * Failed refresh clears auth state and emits 'auth:session-expired' so the
//     AuthContext resets and AuthGuard routes to /login.
//   * Refresh uses raw fetch (never apiClient) so it cannot recurse; tokens are
//     never logged and never placed in persistent storage.
// ---------------------------------------------------------------------------

let refreshInFlight: Promise<boolean> | null = null;

async function tryRefreshOnce(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
          method: 'POST',
          credentials: 'include', // HTTP-only refresh cookie — never a bearer token
        });
        if (!response.ok) return false;
        const payload = (await response.json()) as { data?: { accessToken?: string } };
        const token = payload?.data?.accessToken;
        if (!token) return false;
        inMemoryAccessToken = token;
        return true;
      } catch {
        return false;
      }
    })().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

const sessionExpiredListeners = new Set<() => void>();

/**
 * Subscribes to session-expiry notifications (failed refresh). Returns an
 * unsubscribe function. AuthContext uses this to reset auth state so
 * AuthGuard routes to /login.
 */
export function onSessionExpired(listener: () => void): () => void {
  sessionExpiredListeners.add(listener);
  return () => sessionExpiredListeners.delete(listener);
}

function notifySessionExpired(): void {
  for (const listener of sessionExpiredListeners) {
    try {
      listener();
    } catch {
      // A faulty listener must never break request handling.
    }
  }
}

/** Test seam: reset module-level auth/recovery state between tests. */
export function __resetAuthClientStateForTests(): void {
  inMemoryAccessToken = null;
  refreshInFlight = null;
}

/** Test seam: observe whether a refresh is currently in flight. */
export function __isRefreshInFlightForTests(): boolean {
  return refreshInFlight !== null;
}

export async function apiClient<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { body, skipAuth = false, headers = {}, _retried, ...customConfig } = options;

  // M12.1 P0-1 serialization contract: callers provide STRUCTURED objects;
  // apiClient performs the one and only JSON.stringify. A pre-stringified
  // body would reach Express as a JSON string and fail Zod validation.
  if (typeof body === 'string') {
    throw new TypeError(
      'apiClient serializes bodies itself — pass a structured object, not JSON.stringify(...) output',
    );
  }

  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(headers as Record<string, string>),
  };

  if (!skipAuth && inMemoryAccessToken) {
    requestHeaders['Authorization'] = `Bearer ${inMemoryAccessToken}`;
  }

  const config: RequestInit = {
    ...customConfig,
    headers: requestHeaders,
    credentials: 'include', // Ensures HTTP-only refresh cookies are sent
  };

  if (body !== undefined) {
    config.body = JSON.stringify(body);
  }

  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;

  let response: Response;
  try {
    response = await fetch(url, config);
  } catch {
    throw new ApiError(0, {
      code: 'NETWORK_ERROR',
      message: 'Unable to connect to Hospital AI OS server. Please check your network.',
    });
  }

  if (response.status === 204) {
    return {} as T;
  }

  // M12.2 Part C: centralized 401 recovery — refresh once, retry once.
  // A 401 after a successful refresh means the session is dead (revoked or
  // deactivated): end it instead of surfacing raw errors. Either way the
  // session-expired notification fires EXACTLY ONCE per expiration event.
  if (response.status === 401 && !skipAuth) {
    const refreshed = _retried ? false : await tryRefreshOnce();
    if (refreshed) {
      return apiClient<T>(endpoint, { ...options, _retried: true });
    }
    setAccessToken(null);
    notifySessionExpired();
    // fall through to the standard non-OK handling below
  }

  let data: Record<string, unknown> | null = null;
  try {
    data = (await response.json()) as Record<string, unknown>;
  } catch {
    if (!response.ok) {
      throw new ApiError(response.status, {
        code: 'SERVER_ERROR',
        message: `HTTP error ${response.status}: Server returned an unreadable response.`,
      });
    }
    return {} as T;
  }

  if (!response.ok) {
    const headerReqId =
      response.headers?.get?.('x-request-id') ||
      response.headers?.get?.('x-correlation-id') ||
      undefined;

    const errorPayload: ApiErrorPayload = (data?.error as ApiErrorPayload) || {
      code: 'API_ERROR',
      message: (data?.message as string) || `Request failed with status ${response.status}`,
      requestId: headerReqId,
    };
    if (!errorPayload.requestId && headerReqId) {
      errorPayload.requestId = headerReqId;
    }
    throw new ApiError(response.status, errorPayload);
  }

  return data as T;
}
