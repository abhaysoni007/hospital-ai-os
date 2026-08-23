/**
 * M5 Authorization — RBAC Middleware Unit Tests
 *
 * Tests the requirePermission() Express middleware factory in isolation.
 * The policy engine is tested separately in policy-engine.test.ts.
 *
 * Covers:
 *   - Unauthenticated request (no req.user) → 401
 *   - Authorized request → next() called
 *   - Unauthorized request → next(AuthorizationError) → 403
 *   - Forged/injected principal fields → cannot escalate privileges
 *   - Unknown role → DENY (fail-closed via middleware)
 *   - Missing permission → DENY
 */

import { describe, it, expect, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { requirePermission } from '../rbac.middleware';
import type { AuthenticatedPrincipal } from '../../modules/auth/auth.service';
import { AuthorizationError } from 'shared';

// ---------------------------------------------------------------------------
// Helper builders
// ---------------------------------------------------------------------------
function makePrincipal(overrides: Partial<AuthenticatedPrincipal> = {}): AuthenticatedPrincipal {
  return {
    staffId: 'staff-abc-123',
    role: 'physician',
    departmentId: 'dept-abc-123',
    ...overrides,
  };
}

function makeReq(user?: AuthenticatedPrincipal, extraProps?: Record<string, unknown>): Request {
  return {
    user,
    headers: {},
    body: {},
    query: {},
    params: {},
    ...extraProps,
  } as unknown as Request;
}

function makeRes(): Response {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
}

// ---------------------------------------------------------------------------
// 1. Authentication boundary guard
// ---------------------------------------------------------------------------
describe('requirePermission — authentication boundary', () => {
  it('returns 401 when req.user is undefined (authMiddleware not applied)', () => {
    const middleware = requirePermission('patient:read');
    const req = makeReq(undefined);
    const res = makeRes();
    const next = vi.fn() as NextFunction;

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.objectContaining({ code: 'UNAUTHORIZED' }) }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when req.user is null', () => {
    const middleware = requirePermission('patient:read');
    // Force null as user (defensive guard)
    const req = { ...makeReq(undefined), user: null } as unknown as Request;
    const res = makeRes();
    const next = vi.fn() as NextFunction;

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 2. Authorization — ALLOW path
// ---------------------------------------------------------------------------
describe('requirePermission — ALLOW (permission granted)', () => {
  it('calls next() when physician has patient:read', () => {
    const middleware = requirePermission('patient:read');
    const req = makeReq(makePrincipal({ role: 'physician' }));
    const res = makeRes();
    const next = vi.fn() as NextFunction;

    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(); // no error argument
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('calls next() when receptionist has patient:create', () => {
    const middleware = requirePermission('patient:create');
    const req = makeReq(makePrincipal({ role: 'receptionist' }));
    const res = makeRes();
    const next = vi.fn() as NextFunction;

    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('calls next() when lab_technician has diagnostic_result:enter', () => {
    const middleware = requirePermission('diagnostic_result:enter');
    const req = makeReq(makePrincipal({ role: 'lab_technician' }));
    const res = makeRes();
    const next = vi.fn() as NextFunction;

    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('calls next() when security_admin has audit_event:read', () => {
    const middleware = requirePermission('audit_event:read');
    const req = makeReq(makePrincipal({ role: 'security_admin' }));
    const res = makeRes();
    const next = vi.fn() as NextFunction;

    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('calls next() when hospital_admin has staff:manage', () => {
    const middleware = requirePermission('staff:manage');
    const req = makeReq(makePrincipal({ role: 'hospital_admin' }));
    const res = makeRes();
    const next = vi.fn() as NextFunction;

    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });
});

// ---------------------------------------------------------------------------
// 3. Authorization — DENY path → next(AuthorizationError) → 403
// ---------------------------------------------------------------------------
describe('requirePermission — DENY (permission not granted)', () => {
  it('passes AuthorizationError to next() when nurse lacks clinical_record:sign', () => {
    const middleware = requirePermission('clinical_record:sign');
    const req = makeReq(makePrincipal({ role: 'nurse' }));
    const res = makeRes();
    const next = vi.fn() as NextFunction;

    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(AuthorizationError));
    const err = (next as ReturnType<typeof vi.fn>).mock.calls[0][0] as AuthorizationError;
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe('AUTHORIZATION_ERROR');
    // Must NOT expose internal reason or policy details
    expect(err.message).not.toContain('ROLE_PERMISSIONS');
    expect(err.message).not.toContain('DENIED');
  });

  it('passes AuthorizationError to next() when receptionist lacks clinical_record:write', () => {
    const middleware = requirePermission('clinical_record:write');
    const req = makeReq(makePrincipal({ role: 'receptionist' }));
    const res = makeRes();
    const next = vi.fn() as NextFunction;

    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(AuthorizationError));
  });

  it('passes AuthorizationError when security_admin lacks patient:create', () => {
    const middleware = requirePermission('patient:create');
    const req = makeReq(makePrincipal({ role: 'security_admin' }));
    const res = makeRes();
    const next = vi.fn() as NextFunction;

    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(AuthorizationError));
  });

  it('passes AuthorizationError when hospital_admin lacks clinical_record:write', () => {
    const middleware = requirePermission('clinical_record:write');
    const req = makeReq(makePrincipal({ role: 'hospital_admin' }));
    const res = makeRes();
    const next = vi.fn() as NextFunction;

    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(AuthorizationError));
  });
});

// ---------------------------------------------------------------------------
// 4. Fail-closed — unknown/invalid roles
// ---------------------------------------------------------------------------
describe('requirePermission — fail-closed on invalid roles', () => {
  it('unknown role → DENY', () => {
    const middleware = requirePermission('patient:read');
    const req = makeReq(makePrincipal({ role: 'unknown_role' as 'physician' }));
    const res = makeRes();
    const next = vi.fn() as NextFunction;

    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(AuthorizationError));
  });

  it('empty role → DENY', () => {
    const middleware = requirePermission('patient:read');
    const req = makeReq(makePrincipal({ role: '' as 'physician' }));
    const res = makeRes();
    const next = vi.fn() as NextFunction;

    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(AuthorizationError));
  });

  it('uppercase role case variation → DENY (no case folding)', () => {
    const middleware = requirePermission('patient:read');
    const req = makeReq(makePrincipal({ role: 'PHYSICIAN' as 'physician' }));
    const res = makeRes();
    const next = vi.fn() as NextFunction;

    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(AuthorizationError));
  });
});

// ---------------------------------------------------------------------------
// 5. Forged principal / privilege escalation via request
// ---------------------------------------------------------------------------
describe('requirePermission — principal integrity (no client-controlled escalation)', () => {
  it('ignores req.body.role — only req.user.role is authoritative', () => {
    const middleware = requirePermission('staff:manage');
    const req = makeReq(
      makePrincipal({ role: 'nurse' }), // real role: nurse (does not have staff:manage)
      { body: { role: 'hospital_admin' } }, // client attempts to inject admin role
    );
    const res = makeRes();
    const next = vi.fn() as NextFunction;

    middleware(req, res, next);

    // nurse should be denied — body.role must not influence the decision
    expect(next).toHaveBeenCalledWith(expect.any(AuthorizationError));
  });

  it('ignores req.query.role — only req.user.role is authoritative', () => {
    const middleware = requirePermission('staff:manage');
    const req = makeReq(makePrincipal({ role: 'receptionist' }), {
      query: { role: 'hospital_admin' },
    });
    const res = makeRes();
    const next = vi.fn() as NextFunction;

    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(AuthorizationError));
  });

  it('ignores extra permission fields on req.user — only role grants permissions', () => {
    const middleware = requirePermission('staff:manage');
    const req = makeReq(
      // Attempt to inject extra permissions field onto the principal
      {
        ...makePrincipal({ role: 'nurse' }),
        permissions: ['staff:manage'],
      } as unknown as AuthenticatedPrincipal,
    );
    const res = makeRes();
    const next = vi.fn() as NextFunction;

    middleware(req, res, next);

    // Extra permissions field must not be used — nurse still lacks staff:manage
    expect(next).toHaveBeenCalledWith(expect.any(AuthorizationError));
  });

  it('ignores forged staffId in req.body — RBAC decision does not depend on staffId', () => {
    // physician has patient:read — staffId doesn't change the RBAC outcome
    const middleware = requirePermission('patient:read');
    const req = makeReq(makePrincipal({ role: 'physician', staffId: 'real-staff-id' }), {
      body: { staffId: 'forged-staff-id' },
    });
    const res = makeRes();
    const next = vi.fn() as NextFunction;

    middleware(req, res, next);

    // ALLOW — because RBAC decision is based on role only; forged staffId in body ignored
    expect(next).toHaveBeenCalledWith();
  });

  it('modified req.user.role post-authentication does not create implicit grants', () => {
    const middleware = requirePermission('clinical_record:sign');
    // Simulate an attempted tamper: req.user has a role that looks like physician but is mangled
    const req = makeReq({
      ...makePrincipal({ role: 'physician' }),
      role: 'physician ',
    } as AuthenticatedPrincipal);
    const res = makeRes();
    const next = vi.fn() as NextFunction;

    middleware(req, res, next);

    // 'physician ' (trailing space) is not a known role → DENY
    expect(next).toHaveBeenCalledWith(expect.any(AuthorizationError));
  });
});

// ---------------------------------------------------------------------------
// 6. Error semantics — 401 vs 403
// ---------------------------------------------------------------------------
describe('requirePermission — error semantics (401 vs 403)', () => {
  it('no req.user → 401 (authentication failure, not authorization failure)', () => {
    const middleware = requirePermission('patient:read');
    const res = makeRes();
    const next = vi.fn() as NextFunction;

    middleware(makeReq(undefined), res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalledWith(expect.any(AuthorizationError));
  });

  it('authenticated but no permission → 403 via AuthorizationError', () => {
    const middleware = requirePermission('staff:manage');
    const req = makeReq(makePrincipal({ role: 'nurse' }));
    const res = makeRes();
    const next = vi.fn() as NextFunction;

    middleware(req, res, next);

    expect(res.status).not.toHaveBeenCalled();
    const err = (next as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(err).toBeInstanceOf(AuthorizationError);
    expect(err.statusCode).toBe(403);
  });
});
