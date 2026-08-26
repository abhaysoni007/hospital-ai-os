import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import crypto from 'crypto';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import { eq } from 'drizzle-orm';

import { app } from '../../../app';
import { db } from '../../../db';
import { departments, staff } from '../../../db/schema/staff';
import { resolveKeyPath } from '../../auth/auth.service';
import { config } from '../../../config';

/**
 * M12.2 Part D — staff identity projection.
 * Read-only, any-authenticated, bounded, minimal-field projection.
 */

const RUN = crypto.randomUUID().slice(0, 8);

function tokenFor(staffId: string, role: string, departmentId: string): string {
  const keyPath = resolveKeyPath(config.JWT_PRIVATE_KEY_PATH);
  const privateKey = fs.readFileSync(keyPath, 'utf-8');
  return jwt.sign({ sub: staffId, role, department_id: departmentId }, privateKey, {
    algorithm: 'RS256',
    expiresIn: '15m',
  });
}

describe('M12.2 Staff identity projection', () => {
  let deptId = '';
  let physicianA = '';
  let nurseId = '';
  const staffIds: string[] = [];

  beforeAll(async () => {
    const [dept] = await db
      .insert(departments)
      .values({ name: `M12.2S ${RUN}`, code: `M2S${RUN.slice(0, 5)}`, status: 'active' })
      .returning();
    deptId = dept.id;
    const mkStaff = async (role: string) => {
      const [s] = await db
        .insert(staff)
        .values({
          employeeId: `EMP-M122S-${role}-${RUN}`,
          email: `m122s-${role}-${RUN}@t.hospital`,
          passwordHash: 'super-secret-hash',
          firstName: 'Identity',
          lastName: `Probe${role}`,
          role: role as 'physician',
          departmentId: deptId,
          status: 'active',
        })
        .returning();
      staffIds.push(s.id);
      return s.id;
    };
    physicianA = await mkStaff('physician');
    nurseId = await mkStaff('nurse');
  });

  afterAll(async () => {
    if (staffIds.length) {
      await db
        .delete(staff)
        .where(eq(staff.departmentId, deptId))
        .catch(() => undefined);
    }
    await db
      .delete(departments)
      .where(eq(departments.id, deptId))
      .catch(() => undefined);
  });

  it('unauthenticated → 401', async () => {
    const res = await request(app).get(`/api/v1/staff/identity?ids=${physicianA}`);
    expect(res.status).toBe(401);
  });

  it('returns id/displayName/role ONLY — no email, credentials or department', async () => {
    const res = await request(app)
      .get(`/api/v1/staff/identity?ids=${physicianA},${nurseId}`)
      .set('Authorization', `Bearer ${tokenFor(nurseId, 'nurse', deptId)}`);
    expect(res.status).toBe(200);
    const items = res.body.data as Array<Record<string, unknown>>;
    expect(items).toHaveLength(2);
    for (const item of items) {
      expect(Object.keys(item).sort()).toEqual(['displayName', 'id', 'role']);
      expect(item.displayName).not.toContain('super-secret-hash');
      expect(item.displayName).not.toContain('@t.hospital');
    }
    const byId = new Map(items.map((i) => [i.id as string, i]));
    expect(byId.get(physicianA)?.role).toBe('physician');
    expect(byId.get(nurseId)?.displayName).toBe('Identity Probenurse');
  });

  it('unknown ids are omitted; duplicates deduplicated; >50 ids rejected', async () => {
    const unknown = crypto.randomUUID();
    const res = await request(app)
      .get(`/api/v1/staff/identity?ids=${physicianA},${unknown},${physicianA}`)
      .set('Authorization', `Bearer ${tokenFor(physicianA, 'physician', deptId)}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);

    const fiftyOne = Array.from({ length: 51 }, () => crypto.randomUUID()).join(',');
    const tooMany = await request(app)
      .get(`/api/v1/staff/identity?ids=${fiftyOne}`)
      .set('Authorization', `Bearer ${tokenFor(physicianA, 'physician', deptId)}`);
    expect(tooMany.status).toBe(400);
  });

  it('missing ids param → 400', async () => {
    const res = await request(app)
      .get('/api/v1/staff/identity')
      .set('Authorization', `Bearer ${tokenFor(physicianA, 'physician', deptId)}`);
    expect(res.status).toBe(400);
  });
});
