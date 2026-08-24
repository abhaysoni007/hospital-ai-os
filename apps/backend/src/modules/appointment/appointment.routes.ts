import { Router } from 'express';
import { appointmentController } from './appointment.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/rbac.middleware';

export const appointmentRoutes = Router();

// All appointment endpoints require authentication
appointmentRoutes.use(authMiddleware);

// Read-only booking support data (must be registered before parameterized routes)
appointmentRoutes.get(
  '/booking-options',
  requirePermission('appointment:create'),
  appointmentController.getBookingOptions.bind(appointmentController),
);

appointmentRoutes.post(
  '/',
  requirePermission('appointment:create'),
  appointmentController.bookAppointment.bind(appointmentController),
);

appointmentRoutes.get(
  '/',
  requirePermission('appointment:read'),
  appointmentController.listAppointments.bind(appointmentController),
);

appointmentRoutes.patch(
  '/:id/cancel',
  requirePermission('appointment:cancel'),
  appointmentController.cancelAppointment.bind(appointmentController),
);

appointmentRoutes.patch(
  '/:id/check-in',
  requirePermission('appointment:update'),
  appointmentController.checkInAppointment.bind(appointmentController),
);
