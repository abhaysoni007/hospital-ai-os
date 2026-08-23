/**
 * M5 Authorization — Infrastructure Test Probe Routes
 *
 * PURPOSE: These routes exist SOLELY to enable integration testing of the
 * M5 authorization layer. They contain NO hospital business functionality,
 * NO patient data, NO clinical functionality.
 *
 * Each route requires a specific permission and returns a minimal JSON
 * response when the authorization layer allows the request through.
 *
 * IMPORTANT: These routes are TEST INFRASTRUCTURE ONLY.
 * They must NEVER become production business endpoints.
 * They expose no sensitive data.
 */

import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';

export const authorizationProbeRoutes = Router();

// Each endpoint requires authMiddleware then a specific permission.
// The controller simply returns { data: { permitted: true, permission: '...' } }.
// This lets integration tests verify the full pipeline end-to-end.

const probeHandler =
  (permission: string) => (_req: unknown, res: { json: (v: unknown) => void }) => {
    res.json({ data: { permitted: true, permission } });
  };

// Patient permissions
authorizationProbeRoutes.get(
  '/patient-read',
  authMiddleware,
  requirePermission('patient:read'),
  probeHandler('patient:read'),
);
authorizationProbeRoutes.post(
  '/patient-create',
  authMiddleware,
  requirePermission('patient:create'),
  probeHandler('patient:create'),
);
authorizationProbeRoutes.patch(
  '/patient-update',
  authMiddleware,
  requirePermission('patient:update'),
  probeHandler('patient:update'),
);

// Clinical record permissions
authorizationProbeRoutes.get(
  '/clinical-record-read',
  authMiddleware,
  requirePermission('clinical_record:read'),
  probeHandler('clinical_record:read'),
);
authorizationProbeRoutes.post(
  '/clinical-record-write',
  authMiddleware,
  requirePermission('clinical_record:write'),
  probeHandler('clinical_record:write'),
);
authorizationProbeRoutes.post(
  '/clinical-record-sign',
  authMiddleware,
  requirePermission('clinical_record:sign'),
  probeHandler('clinical_record:sign'),
);

// Diagnostic permissions
authorizationProbeRoutes.post(
  '/diagnostic-order-create',
  authMiddleware,
  requirePermission('diagnostic_order:create'),
  probeHandler('diagnostic_order:create'),
);
authorizationProbeRoutes.post(
  '/diagnostic-result-enter',
  authMiddleware,
  requirePermission('diagnostic_result:enter'),
  probeHandler('diagnostic_result:enter'),
);

// Encounter permissions
authorizationProbeRoutes.post(
  '/encounter-create',
  authMiddleware,
  requirePermission('encounter:create'),
  probeHandler('encounter:create'),
);
authorizationProbeRoutes.patch(
  '/encounter-discharge',
  authMiddleware,
  requirePermission('encounter:discharge'),
  probeHandler('encounter:discharge'),
);

// Appointment permissions
authorizationProbeRoutes.post(
  '/appointment-create',
  authMiddleware,
  requirePermission('appointment:create'),
  probeHandler('appointment:create'),
);

// Staff management
authorizationProbeRoutes.get(
  '/staff-manage',
  authMiddleware,
  requirePermission('staff:manage'),
  probeHandler('staff:manage'),
);

// Audit events
authorizationProbeRoutes.get(
  '/audit-event-read',
  authMiddleware,
  requirePermission('audit_event:read'),
  probeHandler('audit_event:read'),
);

// AI interaction
authorizationProbeRoutes.post(
  '/ai-interaction-invoke',
  authMiddleware,
  requirePermission('ai_interaction:invoke'),
  probeHandler('ai_interaction:invoke'),
);

// Break-glass permissions (M15 will implement the workflow)
authorizationProbeRoutes.post(
  '/break-glass-activate',
  authMiddleware,
  requirePermission('break_glass:activate'),
  probeHandler('break_glass:activate'),
);
authorizationProbeRoutes.get(
  '/break-glass-review',
  authMiddleware,
  requirePermission('break_glass:review'),
  probeHandler('break_glass:review'),
);
