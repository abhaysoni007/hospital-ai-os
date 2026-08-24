import { Router } from 'express';
import { auditController } from './audit.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';

export const auditRoutes = Router();

// Only security admins should be able to view audit logs
auditRoutes.use(authMiddleware);
auditRoutes.use(requirePermission('audit_event:read'));

auditRoutes.get('/', auditController.getEvents.bind(auditController));
