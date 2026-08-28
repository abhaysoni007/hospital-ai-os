import { Router } from 'express';
import { intelligenceController } from './intelligence.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';

export const intelligenceRoutes = Router();

intelligenceRoutes.use(authMiddleware);

intelligenceRoutes.get(
  '/timeline/:patientId',
  requirePermission('clinical_record:read'),
  intelligenceController.getTimeline.bind(intelligenceController),
);

intelligenceRoutes.post(
  '/chart-brief/:patientId',
  requirePermission('clinical_record:read'),
  intelligenceController.generateChartBrief.bind(intelligenceController),
);

intelligenceRoutes.get(
  '/diagnostic-trend/:patientId/:testCode',
  requirePermission('clinical_record:read'),
  intelligenceController.getDiagnosticTrend.bind(intelligenceController),
);
