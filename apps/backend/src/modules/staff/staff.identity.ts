import { Router } from 'express';
import { inArray } from 'drizzle-orm';
import { z } from 'zod';
import { authMiddleware } from '../../middleware/auth.middleware';
import { db } from '../../db';
import { staff } from '../../db/schema/staff';
import { ValidationError } from 'shared';

/**
 * M12.2 Part D — Minimum staff identity projection (NOT M20 staff management).
 *
 * Purpose: replace raw UUIDs with human-readable identity in existing clinical
 * UI (diagnostic enteredBy/verifiedBy, record authorship). Read-only, any
 * authenticated role (same posture as /auth/me), bounded to 50 ids per call,
 * projects ONLY id/displayName/role — never email, credentials, status or
 * department assignment. No CRUD, no administration.
 */

const MAX_IDS = 50;

const staffIdentityQuerySchema = z.object({
  ids: z.string().min(1),
});

export interface StaffIdentityItem {
  id: string;
  displayName: string;
  role: string;
}

export async function resolveStaffIdentities(rawIds: string[]): Promise<StaffIdentityItem[]> {
  const unique = [...new Set(rawIds)].slice(0, MAX_IDS);
  if (unique.length === 0) return [];
  const rows = await db
    .select({
      id: staff.id,
      firstName: staff.firstName,
      lastName: staff.lastName,
      role: staff.role,
    })
    .from(staff)
    .where(inArray(staff.id, unique));
  return rows.map((r) => ({
    id: r.id,
    displayName: `${r.firstName} ${r.lastName}`.trim(),
    role: r.role,
  }));
}

export const staffIdentityRoutes = Router();

staffIdentityRoutes.use(authMiddleware);

staffIdentityRoutes.get('/identity', async (req, res, next) => {
  try {
    const parsed = staffIdentityQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new ValidationError('ids query parameter is required.', { code: 'VALIDATION_ERROR' });
    }
    const ids = parsed.data.ids.split(',').map((s) => s.trim());
    if (ids.length > MAX_IDS) {
      throw new ValidationError(`A maximum of ${MAX_IDS} ids per request is allowed.`, {
        code: 'VALIDATION_ERROR',
      });
    }
    const data = await resolveStaffIdentities(ids);
    res.status(200).json({ data });
  } catch (error) {
    next(error);
  }
});
