/**
 * M5 Authorization — Real Express Integration Tests
 *
 * Tests the full pipeline:
 *   authenticated principal (real JWT via RS256)
 *     → auth.middleware (M4)
 *       → rbac.middleware (M5)
 *         → probe route handler
 *
 * Uses synthetic staff identities. No real healthcare data.
 * Uses real Express app with authorization-probe routes.
 *
 * Covers:
 *   - 401: no authentication → blocked before authorization
 *   - 403: authenticated but wrong role/permission → blocked at authorization
 *   - 200: authenticated + correct permission → allowed through
 *   - Cross-role permission denial (privilege escalation prevention)
 *   - Principal integrity: forged role/permission in body/query cannot escalate
 */

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import { app } from '../../../app';
import { resolveKeyPath } from '../../../modules/auth/auth.service';
import { config } from '../../../config';
import type { StaffRole } from '../../rbac/permissions';

// ---------------------------------------------------------------------------
// Helper: generate a valid RS256 JWT for a synthetic staff member
// ---------------------------------------------------------------------------
function makeToken(
  staffId: string,
  role: StaffRole | string,
  departmentId = 'dept-test-abc-123',
): string {
  const keyPath = resolveKeyPath(config.JWT_PRIVATE_KEY_PATH);
  const privateKey = fs.readFileSync(keyPath, 'utf-8');
  return jwt.sign({ sub: staffId, role, department_id: departmentId }, privateKey, {
    algorithm: 'RS256',
    expiresIn: '15m',
  });
}

// Synthetic staff tokens (no real healthcare data)
const tokens: Record<StaffRole, string> = {
  physician: makeToken('synth-physician-001', 'physician'),
  nurse: makeToken('synth-nurse-001', 'nurse'),
  pharmacist: makeToken('synth-pharmacist-001', 'pharmacist'),
  lab_technician: makeToken('synth-labtech-001', 'lab_technician'),
  receptionist: makeToken('synth-receptionist-001', 'receptionist'),
  hospital_admin: makeToken('synth-hospital-admin-001', 'hospital_admin'),
  security_admin: makeToken('synth-security-admin-001', 'security_admin'),
};

const BASE = '/api/v1/_test/authz-probe';

// ---------------------------------------------------------------------------
// 1. Authentication boundary (no token → 401)
// ---------------------------------------------------------------------------
describe('Authorization Integration — Authentication Boundary', () => {
  it('GET /patient-read without token → 401', async () => {
    const res = await request(app).get(`${BASE}/patient-read`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('GET /audit-event-read without token → 401', async () => {
    const res = await request(app).get(`${BASE}/audit-event-read`);
    expect(res.status).toBe(401);
  });

  it('POST /clinical-record-write without token → 401', async () => {
    const res = await request(app).post(`${BASE}/clinical-record-write`);
    expect(res.status).toBe(401);
  });

  it('invalid (HS256) token → 401 (caught by M4 before reaching M5)', async () => {
    const hs256Token = jwt.sign(
      { sub: 'attacker', role: 'physician', department_id: 'dept-x' },
      'not-the-real-key',
      { algorithm: 'HS256' },
    );
    const res = await request(app)
      .get(`${BASE}/patient-read`)
      .set('Authorization', `Bearer ${hs256Token}`);
    expect(res.status).toBe(401);
  });

  it('expired token → 401', async () => {
    const keyPath = resolveKeyPath(config.JWT_PRIVATE_KEY_PATH);
    const privateKey = fs.readFileSync(keyPath, 'utf-8');
    const expiredToken = jwt.sign(
      { sub: 'synth-expired', role: 'physician', department_id: 'dept-test' },
      privateKey,
      { algorithm: 'RS256', expiresIn: '-10s' },
    );
    const res = await request(app)
      .get(`${BASE}/patient-read`)
      .set('Authorization', `Bearer ${expiredToken}`);
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// 2. Authorization — ALLOW paths (authenticated + correct permission)
// ---------------------------------------------------------------------------
describe('Authorization Integration — ALLOW (correct permission)', () => {
  it('physician can read patients → 200', async () => {
    const res = await request(app)
      .get(`${BASE}/patient-read`)
      .set('Authorization', `Bearer ${tokens.physician}`);
    expect(res.status).toBe(200);
    expect(res.body.data.permitted).toBe(true);
  });

  it('receptionist can create patients → 200', async () => {
    const res = await request(app)
      .post(`${BASE}/patient-create`)
      .set('Authorization', `Bearer ${tokens.receptionist}`);
    expect(res.status).toBe(200);
    expect(res.body.data.permitted).toBe(true);
  });

  it('physician can write clinical records → 200', async () => {
    const res = await request(app)
      .post(`${BASE}/clinical-record-write`)
      .set('Authorization', `Bearer ${tokens.physician}`);
    expect(res.status).toBe(200);
  });

  it('physician can sign clinical records → 200', async () => {
    const res = await request(app)
      .post(`${BASE}/clinical-record-sign`)
      .set('Authorization', `Bearer ${tokens.physician}`);
    expect(res.status).toBe(200);
  });

  it('lab_technician can enter diagnostic results → 200', async () => {
    const res = await request(app)
      .post(`${BASE}/diagnostic-result-enter`)
      .set('Authorization', `Bearer ${tokens.lab_technician}`);
    expect(res.status).toBe(200);
  });

  it('physician can discharge encounters → 200', async () => {
    const res = await request(app)
      .patch(`${BASE}/encounter-discharge`)
      .set('Authorization', `Bearer ${tokens.physician}`);
    expect(res.status).toBe(200);
  });

  it('hospital_admin can manage staff → 200', async () => {
    const res = await request(app)
      .get(`${BASE}/staff-manage`)
      .set('Authorization', `Bearer ${tokens.hospital_admin}`);
    expect(res.status).toBe(200);
  });

  it('security_admin can read audit events → 200', async () => {
    const res = await request(app)
      .get(`${BASE}/audit-event-read`)
      .set('Authorization', `Bearer ${tokens.security_admin}`);
    expect(res.status).toBe(200);
  });

  it('hospital_admin can read audit events → 200', async () => {
    const res = await request(app)
      .get(`${BASE}/audit-event-read`)
      .set('Authorization', `Bearer ${tokens.hospital_admin}`);
    expect(res.status).toBe(200);
  });

  it('physician can invoke AI → 200', async () => {
    const res = await request(app)
      .post(`${BASE}/ai-interaction-invoke`)
      .set('Authorization', `Bearer ${tokens.physician}`);
    expect(res.status).toBe(200);
  });

  it('nurse can invoke AI → 200', async () => {
    const res = await request(app)
      .post(`${BASE}/ai-interaction-invoke`)
      .set('Authorization', `Bearer ${tokens.nurse}`);
    expect(res.status).toBe(200);
  });

  it('physician can activate break-glass → 200', async () => {
    const res = await request(app)
      .post(`${BASE}/break-glass-activate`)
      .set('Authorization', `Bearer ${tokens.physician}`);
    expect(res.status).toBe(200);
  });

  it('nurse can activate break-glass → 200', async () => {
    const res = await request(app)
      .post(`${BASE}/break-glass-activate`)
      .set('Authorization', `Bearer ${tokens.nurse}`);
    expect(res.status).toBe(200);
  });

  it('security_admin can review break-glass → 200', async () => {
    const res = await request(app)
      .get(`${BASE}/break-glass-review`)
      .set('Authorization', `Bearer ${tokens.security_admin}`);
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// 3. Authorization — DENY paths (authenticated but wrong role → 403)
// ---------------------------------------------------------------------------
describe('Authorization Integration — DENY (403 Forbidden)', () => {
  it('nurse CANNOT sign clinical records → 403', async () => {
    const res = await request(app)
      .post(`${BASE}/clinical-record-sign`)
      .set('Authorization', `Bearer ${tokens.nurse}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('AUTHORIZATION_ERROR');
    // Must NOT expose policy internals
    expect(JSON.stringify(res.body)).not.toContain('ROLE_PERMISSIONS');
    expect(JSON.stringify(res.body)).not.toContain('DENIED');
  });

  it('nurse CANNOT create diagnostic orders → 403', async () => {
    const res = await request(app)
      .post(`${BASE}/diagnostic-order-create`)
      .set('Authorization', `Bearer ${tokens.nurse}`);
    expect(res.status).toBe(403);
  });

  it('nurse CANNOT discharge encounters → 403', async () => {
    const res = await request(app)
      .patch(`${BASE}/encounter-discharge`)
      .set('Authorization', `Bearer ${tokens.nurse}`);
    expect(res.status).toBe(403);
  });

  it('receptionist CANNOT write clinical records → 403', async () => {
    const res = await request(app)
      .post(`${BASE}/clinical-record-write`)
      .set('Authorization', `Bearer ${tokens.receptionist}`);
    expect(res.status).toBe(403);
  });

  it('receptionist CANNOT sign clinical records → 403', async () => {
    const res = await request(app)
      .post(`${BASE}/clinical-record-sign`)
      .set('Authorization', `Bearer ${tokens.receptionist}`);
    expect(res.status).toBe(403);
  });

  it('pharmacist CANNOT enter diagnostic results → 403', async () => {
    const res = await request(app)
      .post(`${BASE}/diagnostic-result-enter`)
      .set('Authorization', `Bearer ${tokens.pharmacist}`);
    expect(res.status).toBe(403);
  });

  it('pharmacist CANNOT create diagnostic orders → 403', async () => {
    const res = await request(app)
      .post(`${BASE}/diagnostic-order-create`)
      .set('Authorization', `Bearer ${tokens.pharmacist}`);
    expect(res.status).toBe(403);
  });

  it('hospital_admin CANNOT write clinical records → 403', async () => {
    const res = await request(app)
      .post(`${BASE}/clinical-record-write`)
      .set('Authorization', `Bearer ${tokens.hospital_admin}`);
    expect(res.status).toBe(403);
  });

  it('hospital_admin CANNOT sign clinical records → 403', async () => {
    const res = await request(app)
      .post(`${BASE}/clinical-record-sign`)
      .set('Authorization', `Bearer ${tokens.hospital_admin}`);
    expect(res.status).toBe(403);
  });

  it('hospital_admin CANNOT discharge encounters → 403', async () => {
    const res = await request(app)
      .patch(`${BASE}/encounter-discharge`)
      .set('Authorization', `Bearer ${tokens.hospital_admin}`);
    expect(res.status).toBe(403);
  });

  it('hospital_admin CANNOT activate break-glass → 403', async () => {
    const res = await request(app)
      .post(`${BASE}/break-glass-activate`)
      .set('Authorization', `Bearer ${tokens.hospital_admin}`);
    expect(res.status).toBe(403);
  });

  it('security_admin CANNOT read patients → 403', async () => {
    const res = await request(app)
      .get(`${BASE}/patient-read`)
      .set('Authorization', `Bearer ${tokens.security_admin}`);
    expect(res.status).toBe(403);
  });

  it('security_admin CANNOT manage staff → 403', async () => {
    const res = await request(app)
      .get(`${BASE}/staff-manage`)
      .set('Authorization', `Bearer ${tokens.security_admin}`);
    expect(res.status).toBe(403);
  });

  it('security_admin CANNOT invoke AI → 403', async () => {
    const res = await request(app)
      .post(`${BASE}/ai-interaction-invoke`)
      .set('Authorization', `Bearer ${tokens.security_admin}`);
    expect(res.status).toBe(403);
  });

  it('receptionist CANNOT invoke AI → 403', async () => {
    const res = await request(app)
      .post(`${BASE}/ai-interaction-invoke`)
      .set('Authorization', `Bearer ${tokens.receptionist}`);
    expect(res.status).toBe(403);
  });

  it('receptionist CANNOT review break-glass → 403', async () => {
    const res = await request(app)
      .get(`${BASE}/break-glass-review`)
      .set('Authorization', `Bearer ${tokens.receptionist}`);
    expect(res.status).toBe(403);
  });

  it('lab_technician CANNOT manage staff → 403', async () => {
    const res = await request(app)
      .get(`${BASE}/staff-manage`)
      .set('Authorization', `Bearer ${tokens.lab_technician}`);
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// 4. Principal integrity — forged role/permission in body/query CANNOT escalate
// ---------------------------------------------------------------------------
describe('Authorization Integration — Principal Integrity', () => {
  it('forged role in request body cannot escalate privileges', async () => {
    // nurse token; body attempts to inject hospital_admin role
    const res = await request(app)
      .get(`${BASE}/staff-manage`)
      .set('Authorization', `Bearer ${tokens.nurse}`)
      .send({ role: 'hospital_admin' });
    // Still 403 — authorization uses req.user from JWT, not req.body
    expect(res.status).toBe(403);
  });

  it('forged role in query param cannot escalate privileges', async () => {
    const res = await request(app)
      .get(`${BASE}/staff-manage?role=hospital_admin`)
      .set('Authorization', `Bearer ${tokens.nurse}`);
    expect(res.status).toBe(403);
  });

  it('injected permissions in body cannot grant extra access', async () => {
    const res = await request(app)
      .post(`${BASE}/clinical-record-sign`)
      .set('Authorization', `Bearer ${tokens.receptionist}`)
      .send({ permissions: ['clinical_record:sign'], role: 'physician' });
    expect(res.status).toBe(403);
  });

  it('unknown role in JWT → fail-closed (403, not 200)', async () => {
    const unknownRoleToken = makeToken('synth-unknown-001', 'super_admin');
    const res = await request(app)
      .get(`${BASE}/patient-read`)
      .set('Authorization', `Bearer ${unknownRoleToken}`);
    // Unknown role → policy engine denies → 403
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// 5. Error response structure — must not expose internals
// ---------------------------------------------------------------------------
describe('Authorization Integration — Safe Error Responses', () => {
  it('403 response does not expose policy internals', async () => {
    const res = await request(app)
      .post(`${BASE}/clinical-record-sign`)
      .set('Authorization', `Bearer ${tokens.nurse}`);

    expect(res.status).toBe(403);
    const body = JSON.stringify(res.body);
    expect(body).not.toContain('ROLE_PERMISSIONS');
    expect(body).not.toContain('PolicyDecision');
    expect(body).not.toContain('DENIED');
    expect(body).not.toContain('evaluatePermission');
    expect(body).not.toContain('stack');
    expect(body).not.toContain('node_modules');
    // Must have safe error structure
    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe('AUTHORIZATION_ERROR');
  });

  it('401 response code is UNAUTHORIZED (not AUTHORIZATION_ERROR)', async () => {
    const res = await request(app).get(`${BASE}/patient-read`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});
