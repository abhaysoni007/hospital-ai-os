import { Router } from 'express';
import { breakGlassService } from './break-glass.service';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';
import { validate } from '../../middleware/validation.middleware';
import { z } from 'zod';
export const breakGlassRouter = Router();

breakGlassRouter.use(authMiddleware);

const activateSchema = z.object({
  body: z.object({
    patientId: z.string().uuid(),
    encounterId: z.string().uuid().optional(),
    reason: z.enum(['emergency_care', 'patient_safety', 'continuity_of_care']),
    justification: z.string().min(20).max(2000),
  })
});

breakGlassRouter.post(
  '/sessions',
  requirePermission('break_glass:activate'),
  validate(activateSchema),
  async (req, res, next) => {
    try {
      const u = req.user!;
      const authCtx = {
        role: u.role,
        departmentId: u.departmentId,
      };
      const correlationId = (req as any).correlationId || (req.headers['x-correlation-id'] as string) || crypto.randomUUID();
      const session = await breakGlassService.activateSession(
        req.body,
        u.staffId,
        correlationId,
        authCtx
      );
      // We deliberately strip justification from the response just to be safe, though client sent it
      const { justification: _just, ...safeSession } = session as unknown as Record<string, unknown> & { justification?: string };
      void _just;
      res.status(201).json(safeSession);
    } catch (err) {
      next(err);
    }
  }
);

breakGlassRouter.get(
  '/sessions',
  requirePermission('break_glass:review'),
  async (req, res, next) => {
    try {
      const u = req.user!;
      const authCtx = {
        role: u.role,
        departmentId: u.departmentId,
      };
      const sessions = await breakGlassService.listSessions(authCtx);
      res.status(200).json(sessions);
    } catch (err) {
      next(err);
    }
  }
);

breakGlassRouter.post(
  '/sessions/:id/revoke',
  requirePermission('break_glass:review'),
  async (req, res, next) => {
    try {
      const u = req.user!;
      const authCtx = {
        role: u.role,
        departmentId: u.departmentId,
      };
      const correlationId = (req as any).correlationId || (req.headers['x-correlation-id'] as string) || crypto.randomUUID();
      const session = await breakGlassService.revokeSession(
        req.params.id,
        u.staffId,
        correlationId,
        authCtx
      );
      res.status(200).json(session);
    } catch (err) {
      next(err);
    }
  }
);

breakGlassRouter.post(
  '/sessions/:id/review',
  requirePermission('break_glass:review'),
  async (req, res, next) => {
    try {
      const u = req.user!;
      const authCtx = {
        role: u.role,
        departmentId: u.departmentId,
      };
      const correlationId = (req as any).correlationId || (req.headers['x-correlation-id'] as string) || crypto.randomUUID();
      const session = await breakGlassService.reviewSession(
        req.params.id,
        u.staffId,
        correlationId,
        authCtx
      );
      res.status(200).json(session);
    } catch (err) {
      next(err);
    }
  }
);
