/**
 * M8 Slice 1 — RBAC matrix tests for the appointment + encounter routes.
 * Full pipeline: real RS256 JWT → auth.middleware → rbac.middleware → route.
 *
 * Assertions per route × role:
 *   - no token            → 401
 *   - permitted role      → any status EXCEPT 403 (validation/404 expected on synthetic ids)
 *   - non-permitted role  → 403 exactly
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
    { sub: `synth-${role}`, role, department_id: '0b14c48d-9a5e-4f6e-b2f0-3a7d1c9e8f00' },
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

const RANDOM_ID = crypto.randomUUID();

interface RouteSpec {
  name: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  call: (token?: string) => request.Test;
  allowed: StaffRole[];
}

const ROUTES: RouteSpec[] = [
  {
    name: 'POST /appointments',
    allowed: ['receptionist'],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    call: (t) => request(app).post('/api/v1/appointments').set('Authorization', `Bearer ${t}`),
  },
  {
    name: 'GET /appointments',
    allowed: ['receptionist', 'hospital_admin'],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    call: (t) => request(app).get('/api/v1/appointments').set('Authorization', `Bearer ${t}`),
  },
  {
    name: 'PATCH /appointments/:id/cancel',
    allowed: ['receptionist'],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    call: (t) =>
      request(app)
        .patch(`/api/v1/appointments/${RANDOM_ID}/cancel`)
        .set('Authorization', `Bearer ${t}`)
        .send({}),
  },
  {
    name: 'PATCH /appointments/:id/check-in',
    allowed: ['receptionist'],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    call: (t) =>
      request(app)
        .patch(`/api/v1/appointments/${RANDOM_ID}/check-in`)
        .set('Authorization', `Bearer ${t}`),
  },
  {
    name: 'GET /appointments/booking-options',
    allowed: ['receptionist'],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    call: (t) =>
      request(app).get('/api/v1/appointments/booking-options').set('Authorization', `Bearer ${t}`),
  },
  {
    name: 'POST /encounters',
    allowed: ['physician', 'receptionist'],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    call: (t) => request(app).post('/api/v1/encounters').set('Authorization', `Bearer ${t}`),
  },
  {
    name: 'GET /encounters',
    allowed: ['physician', 'nurse', 'receptionist', 'hospital_admin'],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    call: (t) => request(app).get('/api/v1/encounters').set('Authorization', `Bearer ${t}`),
  },
  {
    name: 'GET /encounters/:id',
    allowed: ['physician', 'nurse', 'receptionist', 'hospital_admin'],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    call: (t) =>
      request(app).get(`/api/v1/encounters/${RANDOM_ID}`).set('Authorization', `Bearer ${t}`),
  },
  {
    name: 'PATCH /encounters/:id/activate',
    allowed: ['physician', 'nurse'],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    call: (t) =>
      request(app)
        .patch(`/api/v1/encounters/${RANDOM_ID}/activate`)
        .set('Authorization', `Bearer ${t}`)
        .send({ expectedVersion: 1 }),
  },
];

describe.each(ROUTES)('M8 RBAC Matrix — $name', ({ call, allowed }) => {
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
    expect(res.body.error?.code ?? '').not.toBe('INTERNAL_ERROR');
  });
});
