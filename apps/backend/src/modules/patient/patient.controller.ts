import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { patientService } from './patient.service';
import {
  registerPatientSchema,
  getPatientsQuerySchema,
  updatePatientSchema,
  createIdentitySchema,
  verifyIdentitySchema,
} from 'shared';
import { AuthenticationError } from 'shared/src/errors/AppError';

function correlation(req: Request): string {
  return req.correlationId || (req.headers['x-correlation-id'] as string) || randomUUID();
}

export class PatientController {
  async registerPatient(req: Request, res: Response, next: NextFunction) {
    try {
      const payload = registerPatientSchema.parse(req.body);
      const user = req.user; // Set by authMiddleware

      if (!user) {
        throw new AuthenticationError('Unauthorized');
      }

      const correlationId = correlation(req);

      const newPatient = await patientService.registerPatient(
        payload,
        user.staffId,
        correlationId,
        {
          role: user.role,
          departmentId: user.departmentId,
        },
      );

      res.status(201).json({
        data: newPatient,
      });
    } catch (error) {
      next(error);
    }
  }

  async searchPatients(req: Request, res: Response, next: NextFunction) {
    try {
      const query = getPatientsQuerySchema.parse(req.query);
      const result = await patientService.searchPatients(query);

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async getPatientById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const user = req.user;
      const correlationId = correlation(req);

      const patient = await patientService.getPatientById(
        id,
        user?.staffId,
        user ? { role: user.role, departmentId: user.departmentId } : undefined,
        correlationId,
      );

      res.status(200).json({
        data: patient,
      });
    } catch (error) {
      next(error);
    }
  }

  async updatePatient(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const payload = updatePatientSchema.parse(req.body);
      const user = req.user;

      if (!user) {
        throw new AuthenticationError('Unauthorized');
      }

      const correlationId = correlation(req);

      const updated = await patientService.updatePatient(id, payload, user.staffId, correlationId, {
        role: user.role,
        departmentId: user.departmentId,
      });

      res.status(200).json({
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  async addIdentity(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const payload = createIdentitySchema.parse(req.body);
      const user = req.user;

      if (!user) {
        throw new AuthenticationError('Unauthorized');
      }

      const correlationId = correlation(req);

      const identity = await patientService.addIdentity(id, payload, user.staffId, correlationId, {
        role: user.role,
        departmentId: user.departmentId,
      });

      res.status(201).json({
        data: identity,
      });
    } catch (error) {
      next(error);
    }
  }

  async verifyIdentity(req: Request, res: Response, next: NextFunction) {
    try {
      const { id, identityId } = req.params;
      const payload = verifyIdentitySchema.parse(req.body);
      const user = req.user;

      if (!user) {
        throw new AuthenticationError('Unauthorized');
      }

      const correlationId = correlation(req);

      const identity = await patientService.verifyIdentity(
        id,
        identityId,
        payload.decision,
        user.staffId,
        correlationId,
        {
          role: user.role,
          departmentId: user.departmentId,
        },
      );

      res.status(200).json({
        data: identity,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const patientController = new PatientController();
