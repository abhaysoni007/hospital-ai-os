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
}

export class ApiError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(statusCode: number, payload: ApiErrorPayload) {
    super(payload.message || 'An unexpected error occurred');
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = payload.code || 'UNKNOWN_ERROR';
    this.details = payload.details;
  }
}

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  /** Structured request payload. apiClient OWNS serialization (M12.1 P0-1). */
  body?: unknown;
  skipAuth?: boolean;
}

export async function apiClient<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { body, skipAuth = false, headers = {}, ...customConfig } = options;

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
    const errorPayload: ApiErrorPayload = (data?.error as ApiErrorPayload) || {
      code: 'API_ERROR',
      message: (data?.message as string) || `Request failed with status ${response.status}`,
    };
    throw new ApiError(response.status, errorPayload);
  }

  return data as T;
}
