import { Router } from 'express';
import { clinicalController } from './clinical.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';

/**
 * M9 clinical record routes. Mounted at:
 *   /api/v1/encounters/:encounterId/clinical-records
 * (path param `encounterId` propagates from the mount point).
 */
export const clinicalRoutes = Router({ mergeParams: true });

clinicalRoutes.use(authMiddleware);

clinicalRoutes.post(
  '/',
  requirePermission('clinical_record:write'),
  clinicalController.create.bind(clinicalController),
);

clinicalRoutes.get(
  '/',
  requirePermission('clinical_record:read'),
  clinicalController.list.bind(clinicalController),
);

clinicalRoutes.get(
  '/:recordId',
  requirePermission('clinical_record:read'),
  clinicalController.getSingle.bind(clinicalController),
);

clinicalRoutes.patch(
  '/:recordId',
  requirePermission('clinical_record:write'),
  clinicalController.update.bind(clinicalController),
);

clinicalRoutes.post(
  '/:recordId/sign',
  requirePermission('clinical_record:sign'),
  clinicalController.sign.bind(clinicalController),
);
