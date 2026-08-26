import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import crypto from 'crypto';
import request from 'supertest';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';

import { app } from '../../../app';
import { db } from '../../../db';
import { departments, staff } from '../../../db/schema/staff';

/**
 * M12.2 Part C — session refresh CONTRACT test (real HTTP).
 *
 * The frontend 401-recovery orchestration is unit-tested separately; this suite
 * proves the frozen M4 backend contract the recovery mechanism relies on:
 *   - refresh via HTTP-only cookie issues a NEW access token
 *   - rotation revokes the old refresh token exactly once
 *   - refresh without cookie → 401
 *   - a stale/invalid access token yields 401 on protected routes
 * No authentication architecture changes are introduced.
 */

const RUN = crypto.randomUUID().slice(0, 8);
const EMAIL = `m122c-physician-${RUN}@t.hospital`;
const PASSWORD = 'Refresh-Passw0rd!';

describe('M12.2 Session refresh contract', () => {
  let deptId = '';
  let physicianId = '';

  beforeAll(async () => {
    const [dept] = await db
      .insert(departments)
      .values({ name: `M12.2C ${RUN}`, code: `M2C${RUN.slice(0, 5)}`, status: 'active' })
      .returning();
    deptId = dept.id;
    const [s] = await db
      .insert(staff)
      .values({
        employeeId: `EMP-M122C-${RUN}`,
        email: EMAIL,
        passwordHash: await bcrypt.hash(PASSWORD, 10),
        firstName: 'M122C',
        lastName: 'Physician',
        role: 'physician',
        departmentId: deptId,
        status: 'active',
      })
      .returning();
    physicianId = s.id;
  });

  afterAll(async () => {
    await db
      .delete(staff)
      .where(eq(staff.id, physicianId))
      .catch(() => undefined);
    await db
      .delete(departments)
      .where(eq(departments.id, deptId))
      .catch(() => undefined);
  });

  it('login → protected call OK; invalid access token → 401; cookie refresh → new working token', async () => {
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: EMAIL, password: PASSWORD });
    expect(login.status).toBe(200);

    const setCookie = login.headers['set-cookie'];
    expect(setCookie).toBeDefined();
    const refreshTokenCookie = Array.isArray(setCookie)
      ? setCookie.find((c: string) => c.startsWith('refreshToken='))
      : undefined;
    expect(refreshTokenCookie).toBeTruthy();

    // Valid access token works on a protected route.
    const ok = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${login.body.data.accessToken}`);
    expect(ok.status).toBe(200);

    // Invalid/stale access token → 401 (this is what triggers client recovery).
    const stale = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer not-a-real-token');
    expect(stale.status).toBe(401);

    // Cookie-based refresh issues a new access token + rotated cookie.
    const refresh = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', refreshTokenCookie as string);
    expect(refresh.status).toBe(200);
    expect(typeof refresh.body.data.accessToken).toBe('string');

    // New token works.
    const after = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${refresh.body.data.accessToken}`);
    expect(after.status).toBe(200);

    // Rotation revoked the old refresh token — replay fails.
    const replay = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', refreshTokenCookie as string);
    expect(replay.status).toBe(401);
  });

  it('refresh WITHOUT cookie → 401 (no anonymous refresh)', async () => {
    const res = await request(app).post('/api/v1/auth/refresh');
    expect(res.status).toBe(401);
  });

  it('forged JWT never authenticates (RS256 enforcement intact)', async () => {
    const forged = jwt.sign(
      { sub: physicianId, role: 'hospital_admin', department_id: deptId },
      'attacker-secret',
      { algorithm: 'HS256' },
    );
    const res = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${forged}`);
    expect(res.status).toBe(401);
  });
});
