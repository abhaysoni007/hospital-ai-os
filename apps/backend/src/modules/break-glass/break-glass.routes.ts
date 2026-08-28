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
      const authCtx: AuthorizationContext = {
        role: req.user.role,
        departmentId: req.user.departmentId,
      };
      const session = await breakGlassService.activateSession(
        req.body,
        req.user.id,
        req.correlationId!,
        authCtx
      );
      // We deliberately strip justification from the response just to be safe, though client sent it
      const { justification, ...safeSession } = session;
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
      const authCtx: AuthorizationContext = {
        role: req.user.role,
        departmentId: req.user.departmentId,
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
      const authCtx: AuthorizationContext = {
        role: req.user.role,
        departmentId: req.user.departmentId,
      };
      const session = await breakGlassService.revokeSession(
        req.params.id,
        req.user.id,
        req.correlationId!,
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
      const authCtx: AuthorizationContext = {
        role: req.user.role,
        departmentId: req.user.departmentId,
      };
      const session = await breakGlassService.reviewSession(
        req.params.id,
        req.user.id,
        req.correlationId!,
        authCtx
      );
      res.status(200).json(session);
    } catch (err) {
      next(err);
    }
  }
);
