import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { appointmentService } from './appointment.service';
import {
  createAppointmentSchema,
  getAppointmentsQuerySchema,
  cancelAppointmentSchema,
} from 'shared';
import { AuthenticationError } from 'shared/src/errors/AppError';

function correlation(req: Request): string {
  return req.correlationId || (req.headers['x-correlation-id'] as string) || randomUUID();
}

export class AppointmentController {
  async bookAppointment(req: Request, res: Response, next: NextFunction) {
    try {
      const payload = createAppointmentSchema.parse(req.body);
      const user = req.user;
      if (!user) throw new AuthenticationError('Unauthorized');

      const correlationId = correlation(req);

      const appointment = await appointmentService.bookAppointment(
        payload,
        user.staffId,
        correlationId,
        { role: user.role, departmentId: user.departmentId },
      );

      res.status(201).json({ data: appointment });
    } catch (error) {
      next(error);
    }
  }

  async listAppointments(req: Request, res: Response, next: NextFunction) {
    try {
      const query = getAppointmentsQuerySchema.parse(req.query);
      const user = req.user;
      if (!user) throw new AuthenticationError('Unauthorized');

      const result = await appointmentService.listAppointments(query, {
        role: user.role,
        departmentId: user.departmentId,
      });

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async cancelAppointment(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const payload = cancelAppointmentSchema.parse(req.body ?? {});
      const user = req.user;
      if (!user) throw new AuthenticationError('Unauthorized');

      const correlationId = correlation(req);

      const appointment = await appointmentService.cancelAppointment(
        id,
        payload,
        user.staffId,
        correlationId,
        { role: user.role, departmentId: user.departmentId },
      );

      res.status(200).json({ data: appointment });
    } catch (error) {
      next(error);
    }
  }

  async checkInAppointment(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const user = req.user;
      if (!user) throw new AuthenticationError('Unauthorized');

      const correlationId = correlation(req);

      const result = await appointmentService.checkInAppointment(id, user.staffId, correlationId, {
        role: user.role,
        departmentId: user.departmentId,
      });

      res.status(200).json({ data: result });
    } catch (error) {
      next(error);
    }
  }

  async getBookingOptions(req: Request, res: Response, next: NextFunction) {
    try {
      const user = req.user;
      if (!user) throw new AuthenticationError('Unauthorized');

      const options = await appointmentService.getBookingOptions({
        role: user.role,
        departmentId: user.departmentId,
      });
      res.status(200).json({ data: options });
    } catch (error) {
      next(error);
    }
  }
}

export const appointmentController = new AppointmentController();
