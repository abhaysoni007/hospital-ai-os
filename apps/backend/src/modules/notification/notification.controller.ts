import { Request, Response, NextFunction } from 'express';
import {
  AuthenticationError,
  getNotificationsQuerySchema,
  uuidSchema,
  ValidationError,
} from 'shared';

import { notificationService } from './notification.service';

function requireUser(req: Request) {
  const user = req.user;
  if (!user) throw new AuthenticationError('Unauthorized');
  return user;
}

function correlation(req: Request): string {
  return req.correlationId || (req.headers['x-correlation-id'] as string) || crypto.randomUUID();
}

export class NotificationController {
  /** GET /api/v1/notifications — actor scope derived server-side from JWT. */
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const user = requireUser(req);
      const query = getNotificationsQuerySchema.parse(req.query);
      const result = await notificationService.listNotifications(query, user.staffId, {
        role: user.role,
        departmentId: user.departmentId,
      });
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  /** PATCH /api/v1/notifications/:id/acknowledge — owner-only guarded transition. */
  async acknowledge(req: Request, res: Response, next: NextFunction) {
    try {
      const user = requireUser(req);
      const id = uuidSchema.safeParse(req.params.id);
      if (!id.success) {
        throw new ValidationError('Invalid notification id.', { code: 'VALIDATION_ERROR' });
      }
      const result = await notificationService.acknowledgeNotification(
        id.data,
        user.staffId,
        correlation(req),
        { role: user.role, departmentId: user.departmentId },
      );
      res.status(200).json({ data: result });
    } catch (error) {
      next(error);
    }
  }
}

export const notificationController = new NotificationController();
