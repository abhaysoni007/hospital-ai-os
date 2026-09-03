import { describe, expect, it } from 'vitest';
import { parseApiError } from '../error-parser';
import { ApiError } from '../../services/api-client';

describe('error-parser utility', () => {
  it('parses VERSION_CONFLICT cleanly and identifies conflict state', () => {
    const error = new ApiError(409, {
      code: 'VERSION_CONFLICT',
      message: 'Resource has been modified by another request.',
      requestId: 'req-conflict-123',
    });

    const parsed = parseApiError(error);

    expect(parsed.isConflict).toBe(true);
    expect(parsed.code).toBe('VERSION_CONFLICT');
    expect(parsed.statusCode).toBe(409);
    expect(parsed.requestId).toBe('req-conflict-123');
    expect(parsed.title).toBe('Record Conflict Detected');
    expect(parsed.message).toContain('Please refresh');
  });

  it('parses UNRESOLVED_DIAGNOSTICS for encounter discharge safety', () => {
    const error = new ApiError(409, {
      code: 'UNRESOLVED_DIAGNOSTICS',
      message: 'Cannot discharge encounter while diagnostic orders remain unresolved.',
      requestId: 'req-diag-456',
    });

    const parsed = parseApiError(error);

    expect(parsed.code).toBe('UNRESOLVED_DIAGNOSTICS');
    expect(parsed.requestId).toBe('req-diag-456');
    expect(parsed.title).toBe('Active Diagnostics Pending');
    expect(parsed.message).toContain('active diagnostic orders');
  });

  it('extracts structured fieldErrors from Zod validation issue arrays', () => {
    const error = new ApiError(400, {
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      requestId: 'req-val-789',
      details: [
        { path: ['phonePrimary'], message: 'Must be E.164 format' },
        { path: ['dateOfBirth'], message: 'Date of birth is required' },
      ],
    });

    const parsed = parseApiError(error);

    expect(parsed.statusCode).toBe(400);
    expect(parsed.title).toBe('Form Validation Error');
    expect(parsed.fieldErrors).toEqual({
      phonePrimary: 'Must be E.164 format',
      dateOfBirth: 'Date of birth is required',
    });
    expect(parsed.requestId).toBe('req-val-789');
  });

  it('handles RATE_LIMIT_ERROR (429)', () => {
    const error = new ApiError(429, {
      code: 'RATE_LIMIT_ERROR',
      message: 'Too many requests.',
      requestId: 'req-rl-101',
    });

    const parsed = parseApiError(error);

    expect(parsed.isRateLimit).toBe(true);
    expect(parsed.statusCode).toBe(429);
    expect(parsed.title).toBe('System Rate Limit Exceeded');
  });

  it('handles 401 Authentication and 403 Authorization errors honestly', () => {
    const authError = new ApiError(401, {
      code: 'AUTHENTICATION_ERROR',
      message: 'Invalid or expired token',
    });
    const parsedAuth = parseApiError(authError);
    expect(parsedAuth.isAuthError).toBe(true);
    expect(parsedAuth.title).toBe('Session Expired');

    const forbiddenError = new ApiError(403, {
      code: 'AUTHORIZATION_ERROR',
      message: 'Insufficient role permissions',
    });
    const parsedForbidden = parseApiError(forbiddenError);
    expect(parsedForbidden.isAuthError).toBe(true);
    expect(parsedForbidden.title).toBe('Permission Denied');
  });

  it('identifies network failures cleanly', () => {
    const netErr = new TypeError('Failed to fetch');
    const parsed = parseApiError(netErr);

    expect(parsed.isNetworkError).toBe(true);
    expect(parsed.code).toBe('NETWORK_ERROR');
    expect(parsed.title).toBe('Connection Failure');
    expect(parsed.message).toContain('network connection');
  });
});
