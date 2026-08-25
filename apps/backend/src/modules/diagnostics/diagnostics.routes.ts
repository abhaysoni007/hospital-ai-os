import { Router } from 'express';
import { diagnosticsController } from './diagnostics.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';

/**
 * M10 routes (ADR-016). Mounted at:
 *   /api/v1/encounters/:encounterId/diagnostic-orders  → encounter-scoped
 *   /api/v1/diagnostic-orders                          → lab queue + order ops
 */
export const diagnosticEncounterRoutes = Router({ mergeParams: true });

diagnosticEncounterRoutes.use(authMiddleware);

diagnosticEncounterRoutes.post(
  '/',
  requirePermission('diagnostic_order:create'),
  diagnosticsController.createOrder.bind(diagnosticsController),
);

diagnosticEncounterRoutes.get(
  '/',
  requirePermission('diagnostic_order:read'),
  diagnosticsController.listEncounterOrders.bind(diagnosticsController),
);

export const diagnosticOrderRoutes = Router();

diagnosticOrderRoutes.use(authMiddleware);

// Lab queue (ADR-016 Decision 5)
diagnosticOrderRoutes.get(
  '/',
  requirePermission('diagnostic_order:read'),
  diagnosticsController.listLabQueue.bind(diagnosticsController),
);

diagnosticOrderRoutes.get(
  '/:id',
  requirePermission('diagnostic_order:read'),
  diagnosticsController.getOrder.bind(diagnosticsController),
);

diagnosticOrderRoutes.patch(
  '/:id/collect-sample',
  requirePermission('diagnostic_order:update'),
  diagnosticsController.collectSample.bind(diagnosticsController),
);

diagnosticOrderRoutes.patch(
  '/:id/cancel',
  requirePermission('diagnostic_order:cancel'),
  diagnosticsController.cancelOrder.bind(diagnosticsController),
);

diagnosticOrderRoutes.post(
  '/:orderId/result',
  requirePermission('diagnostic_result:enter'),
  diagnosticsController.enterResult.bind(diagnosticsController),
);

diagnosticOrderRoutes.get(
  '/:orderId/result',
  requirePermission('diagnostic_result:read'),
  diagnosticsController.getResult.bind(diagnosticsController),
);

diagnosticOrderRoutes.post(
  '/:orderId/result/verify',
  requirePermission('diagnostic_result:verify'),
  diagnosticsController.verifyResult.bind(diagnosticsController),
);
