import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';
import { hospitalIntelligenceController } from './hospital-intelligence.controller';

/**
 * M19 — Hospital Intelligence Routes
 * Base: /api/v1/hospital-intelligence
 * SOURCE OF TRUTH: docs/architecture/M19_INTELLIGENCE_ARCHITECTURE.md §15, §16
 *
 * All routes require authentication and least-privilege permission gating.
 * Deny-by-default is strictly enforced.
 */
export const hospitalIntelligenceRoutes = Router();

hospitalIntelligenceRoutes.use(authMiddleware);

hospitalIntelligenceRoutes.post(
  '/analyze',
  requirePermission('intelligence:analyze'),
  hospitalIntelligenceController.analyze.bind(hospitalIntelligenceController),
);

hospitalIntelligenceRoutes.get(
  '/signals',
  requirePermission('intelligence:read'),
  hospitalIntelligenceController.getSignals.bind(hospitalIntelligenceController),
);

hospitalIntelligenceRoutes.get(
  '/signals/:id',
  requirePermission('intelligence:read'),
  hospitalIntelligenceController.getSignalById.bind(hospitalIntelligenceController),
);

hospitalIntelligenceRoutes.post(
  '/recommendations/:id/approve',
  requirePermission('intelligence:approve'),
  hospitalIntelligenceController.approveRecommendation.bind(hospitalIntelligenceController),
);

hospitalIntelligenceRoutes.post(
  '/recommendations/:id/reject',
  requirePermission('intelligence:approve'),
  hospitalIntelligenceController.rejectRecommendation.bind(hospitalIntelligenceController),
);
