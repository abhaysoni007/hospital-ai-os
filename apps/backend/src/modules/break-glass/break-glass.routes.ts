import { Router } from 'express';
import { breakGlassService } from './break-glass.service';
import { requirePermission } from '../../middleware/rbac.middleware';
import { validate } from '../../middleware/validation.middleware';
import { z } from 'zod';
import { AuthorizationContext } from '../../middleware/rbac/authorization-context';

export const breakGlassRouter = Router();

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
      const u = (req as any).user;
      const authCtx = {
        role: u.role,
        departmentId: u.departmentId,
      };
      const session = await breakGlassService.activateSession(
        req.body,
        u.userId || u.id,
        (req as any).correlationId || 'none',
        authCtx
      );
      // We deliberately strip justification from the response just to be safe, though client sent it
      const { justification, ...safeSession } = session as any;
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
      const u = (req as any).user;
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
      const u = (req as any).user;
      const authCtx = {
        role: u.role,
        departmentId: u.departmentId,
      };
      const session = await breakGlassService.revokeSession(
        req.params.id,
        u.userId || u.id,
        (req as any).correlationId || 'none',
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
      const u = (req as any).user;
      const authCtx = {
        role: u.role,
        departmentId: u.departmentId,
      };
      const session = await breakGlassService.reviewSession(
        req.params.id,
        u.userId || u.id,
        (req as any).correlationId || 'none',
        authCtx
      );
      res.status(200).json(session);
    } catch (err) {
      next(err);
    }
  }
);
