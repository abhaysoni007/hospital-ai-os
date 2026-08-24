import { Router } from 'express';
import { encounterController } from './encounter.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';

export const encounterRoutes = Router();

// All encounter endpoints require authentication
encounterRoutes.use(authMiddleware);

encounterRoutes.post(
  '/',
  requirePermission('encounter:create'),
  encounterController.createEncounter.bind(encounterController),
);

encounterRoutes.get(
  '/',
  requirePermission('encounter:read'),
  encounterController.listEncounters.bind(encounterController),
);

// ADR-013: metadata-only detail; clinical/diagnostic data is never embedded.
encounterRoutes.get(
  '/:id',
  requirePermission('encounter:read'),
  encounterController.getEncounterDetail.bind(encounterController),
);

encounterRoutes.patch(
  '/:id/activate',
  requirePermission('encounter:update'),
  encounterController.activateEncounter.bind(encounterController),
);
