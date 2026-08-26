import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import { notificationController } from './notification.controller';

/**
 * M12.2 — Critical notification read/workflow routes.
 * Chain: authentication → server-derived recipient scope (service layer).
 * Permission: any authenticated role, matching the ratified API catalog
 * ("Any") — no new M5 permission is introduced.
 */
export const notificationRoutes = Router();

notificationRoutes.use(authMiddleware);

notificationRoutes.get('/', notificationController.list.bind(notificationController));
notificationRoutes.patch(
  '/:id/acknowledge',
  notificationController.acknowledge.bind(notificationController),
);
