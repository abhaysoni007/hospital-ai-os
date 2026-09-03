import { ApiError } from '../services/api-client';

export interface ParsedError {
  title: string;
  message: string;
  code: string;
  statusCode?: number;
  requestId?: string;
  fieldErrors: Record<string, string>;
  isAuthError: boolean;
  isConflict: boolean;
  isRateLimit: boolean;
  isNotFound: boolean;
  isNetworkError: boolean;
}

/**
 * Extracts structured field errors from validation error details.
 * Supports Zod error arrays [{ path: ['field'], message: '...' }] or key-value objects.
 */
function extractFieldErrors(details: unknown): Record<string, string> {
  const result: Record<string, string> = {};
  if (!details) return result;

  if (Array.isArray(details)) {
    for (const item of details) {
      if (item && typeof item === 'object') {
        const record = item as Record<string, unknown>;
        const path = Array.isArray(record.path)
          ? record.path.join('.')
          : typeof record.path === 'string'
            ? record.path
            : typeof record.field === 'string'
              ? record.field
              : '';
        const msg = typeof record.message === 'string' ? record.message : '';
        if (path && msg) {
          result[path] = msg;
        }
      }
    }
  } else if (typeof details === 'object') {
    for (const [k, v] of Object.entries(details as Record<string, unknown>)) {
      if (typeof v === 'string') {
        result[k] = v;
      }
    }
  }

  return result;
}

/**
 * Normalizes any caught error into a human-actionable, clinically safe error descriptor
 * with requestId preservation and honest state classification.
 */
export function parseApiError(err: unknown): ParsedError {
  if (err instanceof ApiError) {
    const code = err.code || 'UNKNOWN_ERROR';
    const statusCode = err.statusCode;
    const requestId = err.requestId;
    const fieldErrors = extractFieldErrors(err.details);

    const isAuthError = statusCode === 401 || statusCode === 403 || code === 'AUTHENTICATION_ERROR' || code === 'AUTHORIZATION_ERROR';
    const isConflict = statusCode === 409 || code === 'VERSION_CONFLICT' || code === 'CONFLICT';
    const isRateLimit = statusCode === 429 || code === 'RATE_LIMIT_ERROR';
    const isNotFound = statusCode === 404 || code === 'NOT_FOUND';

    let title = 'Operation Failed';
    let message = err.message || 'An unexpected error occurred.';
    if (code === 'UNRESOLVED_DIAGNOSTICS') {
      title = 'Active Diagnostics Pending';
      message = 'Cannot complete encounter discharge while active diagnostic orders or pending results remain.';
    } else if (isConflict) {
      title = 'Record Conflict Detected';
      message =
        code === 'VERSION_CONFLICT'
          ? 'This record was updated by another clinical staff member. Please refresh to load the latest state before saving changes.'
          : 'A conflicting record or state transition prevented this operation. Please review the current state.';
    } else if (isRateLimit) {
      title = 'System Rate Limit Exceeded';
      message = 'Too many requests were sent in a short window. Please wait a moment before trying again.';
    } else if (isAuthError) {
      if (statusCode === 401 || code === 'AUTHENTICATION_ERROR') {
        title = 'Session Expired';
        message = 'Your session has expired. Please sign in again to continue.';
      } else {
        title = 'Permission Denied';
        message = 'Your clinical role or assigned department does not permit this action.';
      }
    } else if (isNotFound) {
      title = 'Resource Not Found';
      message = 'The requested patient, encounter, or clinical record could not be found.';
    } else if (statusCode === 400 || code === 'VALIDATION_ERROR') {
      title = 'Form Validation Error';
      message =
        Object.keys(fieldErrors).length > 0
          ? 'Please review the highlighted fields and correct the errors before submitting.'
          : err.message || 'The submitted data was invalid. Please check your inputs.';
    } else if (statusCode >= 500) {
      title = 'Hospital System Service Error';
      message = 'A server error occurred while processing your request. Please try again or reference the Incident ID if contacting IT support.';
    }

    return {
      title,
      message,
      code,
      statusCode,
      requestId,
      fieldErrors,
      isAuthError,
      isConflict,
      isRateLimit,
      isNotFound,
      isNetworkError: false,
    };
  }

  // Network / fetch failures (e.g. Failed to fetch, offline)
  if (err instanceof TypeError && err.message.includes('fetch')) {
    return {
      title: 'Connection Failure',
      message: 'Unable to reach the hospital server. Please check your network connection and retry.',
      code: 'NETWORK_ERROR',
      fieldErrors: {},
      isAuthError: false,
      isConflict: false,
      isRateLimit: false,
      isNotFound: false,
      isNetworkError: true,
    };
  }

  if (err instanceof Error) {
    return {
      title: 'Unexpected Error',
      message: err.message || 'An unexpected client-side error occurred.',
      code: 'CLIENT_ERROR',
      fieldErrors: {},
      isAuthError: false,
      isConflict: false,
      isRateLimit: false,
      isNotFound: false,
      isNetworkError: false,
    };
  }

  return {
    title: 'Unknown Error',
    message: 'An unknown error occurred. Please retry.',
    code: 'UNKNOWN_ERROR',
    fieldErrors: {},
    isAuthError: false,
    isConflict: false,
    isRateLimit: false,
    isNotFound: false,
    isNetworkError: false,
  };
}
