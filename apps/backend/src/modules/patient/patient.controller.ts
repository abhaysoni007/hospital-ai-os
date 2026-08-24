import { Request, Response, NextFunction } from 'express';
import { patientService } from './patient.service';
import { registerPatientSchema, getPatientsQuerySchema } from 'shared';
import { AuthenticationError } from 'shared/src/errors/AppError';

export class PatientController {
  async registerPatient(req: Request, res: Response, next: NextFunction) {
    try {
      const payload = registerPatientSchema.parse(req.body);
      const user = req.user; // Set by authMiddleware

      if (!user) {
        throw new AuthenticationError('Unauthorized');
      }

      const correlationId = (req.headers['x-correlation-id'] as string) || crypto.randomUUID();

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
      const patient = await patientService.getPatientById(id);

      res.status(200).json({
        data: patient,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const patientController = new PatientController();
