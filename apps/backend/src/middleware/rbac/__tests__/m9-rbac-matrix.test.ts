/**
 * M9 RBAC Matrix — all 7 canonical roles × all 5 clinical routes.
 * Real RS256 JWT pipeline: authMiddleware → rbacMiddleware → route.
 *
 * Allowed roles receive any non-403/non-401 status on synthetic ids
 * (typically 400 validation or 404 not-found); every other role receives
 * exactly 403. Unauthenticated → 401.
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
    { sub: `synth-m9-${role}`, role, department_id: '0b14c48d-9a5e-4f6e-b2f0-3a7d1c9e8f00' },
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
const REC = crypto.randomUUID();

interface RouteSpec {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  call: (token: string) => request.Test;
  allowed: StaffRole[];
}

const ROUTES: Array<[string, RouteSpec]> = [
  [
    'POST /encounters/:encounterId/clinical-records',
    {
      allowed: ['physician', 'nurse'],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      call: (t) =>
        request(app)
          .post(`/api/v1/encounters/${ENC}/clinical-records`)
          .set('Authorization', `Bearer ${t}`),
    },
  ],
  [
    'GET /encounters/:encounterId/clinical-records',
    {
      allowed: ['physician', 'nurse', 'pharmacist', 'lab_technician'],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      call: (t) =>
        request(app)
          .get(`/api/v1/encounters/${ENC}/clinical-records`)
          .set('Authorization', `Bearer ${t}`),
    },
  ],
  [
    'GET /encounters/:encounterId/clinical-records/:recordId',
    {
      allowed: ['physician', 'nurse', 'pharmacist', 'lab_technician'],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      call: (t) =>
        request(app)
          .get(`/api/v1/encounters/${ENC}/clinical-records/${REC}`)
          .set('Authorization', `Bearer ${t}`),
    },
  ],
  [
    'PATCH /encounters/:encounterId/clinical-records/:recordId',
    {
      allowed: ['physician', 'nurse'],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      call: (t) =>
        request(app)
          .patch(`/api/v1/encounters/${ENC}/clinical-records/${REC}`)
          .set('Authorization', `Bearer ${t}`)
          .send({ expectedVersion: 1 }),
    },
  ],
  [
    'POST /encounters/:encounterId/clinical-records/:recordId/sign',
    {
      allowed: ['physician'],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      call: (t) =>
        request(app)
          .post(`/api/v1/encounters/${ENC}/clinical-records/${REC}/sign`)
          .set('Authorization', `Bearer ${t}`)
          .send({ expectedVersion: 1 }),
    },
  ],
];

describe.each(ROUTES)('M9 RBAC Matrix — %s', (name, { call, allowed }) => {
  void name;
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
