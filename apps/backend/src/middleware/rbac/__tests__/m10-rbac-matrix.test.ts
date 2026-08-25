/**
 * M10 RBAC Matrix — all 7 canonical roles × all 9 diagnostic routes.
 * Real RS256 JWT pipeline. Includes regression coverage for the ADR-016
 * `diagnostic_order:cancel` grant (physician only).
 */

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import crypto from 'crypto';
import { app } from '../../../app';
import { resolveKeyPath } from '../../../modules/auth/auth.service';
import { config } from '../../../config';
import type { StaffRole } from '../../rbac/permissions';

function makeToken(role: StaffRole | string): string {
  const keyPath = resolveKeyPath(config.JWT_PRIVATE_KEY_PATH);
  const privateKey = fs.readFileSync(keyPath, 'utf-8');
  return jwt.sign(
    { sub: `synth-m10-${role}`, role, department_id: '0b14c48d-9a5e-4f6e-b2f0-3a7d1c9e8f00' },
    privateKey,
    { algorithm: 'RS256', expiresIn: '15m' },
  );
}

const ROLES: StaffRole[] = [
  'physician',
  'nurse',
  'pharmacist',
  'lab_technician',
  'receptionist',
  'hospital_admin',
  'security_admin',
];

const tokens = Object.fromEntries(ROLES.map((r) => [r, makeToken(r)])) as Record<StaffRole, string>;

const ENC = crypto.randomUUID();
const ORD = crypto.randomUUID();

interface RouteSpec {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  call: (token: string) => request.Test;
  allowed: StaffRole[];
}

const READ_ROLES: StaffRole[] = ['physician', 'nurse', 'lab_technician'];

const ROUTES: Array<[string, RouteSpec]> = [
  [
    'POST /encounters/:encounterId/diagnostic-orders',
    {
      allowed: ['physician'],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      call: (t) =>
        request(app)
          .post(`/api/v1/encounters/${ENC}/diagnostic-orders`)
          .set('Authorization', `Bearer ${t}`),
    },
  ],
  [
    'GET /encounters/:encounterId/diagnostic-orders',
    {
      allowed: READ_ROLES,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      call: (t) =>
        request(app)
          .get(`/api/v1/encounters/${ENC}/diagnostic-orders`)
          .set('Authorization', `Bearer ${t}`),
    },
  ],
  [
    'GET /diagnostic-orders (lab queue)',
    {
      allowed: READ_ROLES,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      call: (t) =>
        request(app).get('/api/v1/diagnostic-orders').set('Authorization', `Bearer ${t}`),
    },
  ],
  [
    'GET /diagnostic-orders/:id',
    {
      allowed: READ_ROLES,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      call: (t) =>
        request(app).get(`/api/v1/diagnostic-orders/${ORD}`).set('Authorization', `Bearer ${t}`),
    },
  ],
  [
    'PATCH /diagnostic-orders/:id/collect-sample',
    {
      allowed: ['lab_technician'],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      call: (t) =>
        request(app)
          .patch(`/api/v1/diagnostic-orders/${ORD}/collect-sample`)
          .set('Authorization', `Bearer ${t}`),
    },
  ],
  [
    'PATCH /diagnostic-orders/:id/cancel (ADR-016 grant)',
    {
      allowed: ['physician'],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      call: (t) =>
        request(app)
          .patch(`/api/v1/diagnostic-orders/${ORD}/cancel`)
          .set('Authorization', `Bearer ${t}`),
    },
  ],
  [
    'POST /diagnostic-orders/:orderId/result',
    {
      allowed: ['lab_technician'],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      call: (t) =>
        request(app)
          .post(`/api/v1/diagnostic-orders/${ORD}/result`)
          .set('Authorization', `Bearer ${t}`),
    },
  ],
  [
    'GET /diagnostic-orders/:orderId/result',
    // ADR-015/016 note: pharmacist holds diagnostic_result:read (meds_related)
    {
      allowed: [...READ_ROLES, 'pharmacist'],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      call: (t) =>
        request(app)
          .get(`/api/v1/diagnostic-orders/${ORD}/result`)
          .set('Authorization', `Bearer ${t}`),
    },
  ],
  [
    'POST /diagnostic-orders/:orderId/result/verify',
    {
      allowed: ['lab_technician'],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      call: (t) =>
        request(app)
          .post(`/api/v1/diagnostic-orders/${ORD}/result/verify`)
          .set('Authorization', `Bearer ${t}`)
          .send({}),
    },
  ],
];

describe.each(ROUTES)('M10 RBAC Matrix — %s', (_name, { call, allowed }) => {
  it('unauthenticated → 401', async () => {
    const res = await call('');
    expect(res.status).toBe(401);
  });

  it.each(allowed)('allowed role %s → NOT 403', async (role) => {
    const res = await call(tokens[role]);
    expect(res.status).not.toBe(403);
    expect(res.status).not.toBe(401);
  });

  it.each(ROLES.filter((r) => !allowed.includes(r)))('denied role %s → 403', async (role) => {
    const res = await call(tokens[role]);
    expect(res.status).toBe(403);
  });
});
