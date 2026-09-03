import { Request, Response, NextFunction } from 'express';
import { clinicalService } from './clinical.service';
import {
  createClinicalRecordSchema,
  updateClinicalRecordSchema,
  signClinicalRecordSchema,
  getClinicalRecordsQuerySchema,
  uuidSchema,
} from 'shared';
import { AuthenticationError, ValidationError } from 'shared/src/errors/AppError';

function requireUser(req: Request) {
  const user = req.user;
  if (!user) throw new AuthenticationError('Unauthorized');
  return user;
}

function correlation(req: Request): string {
  return req.correlationId || (req.headers['x-correlation-id'] as string) || crypto.randomUUID();
}

/** Path params are validated to be UUIDs — no clinical data ever in URLs/queries. */
function uuidParam(value: unknown, name: string): string {
  const parsed = uuidSchema.safeParse(value);
  if (!parsed.success) {
    throw new ValidationError(`Invalid ${name} parameter.`, { code: 'VALIDATION_ERROR' });
  }
  return parsed.data;
}

export class ClinicalController {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const user = requireUser(req);
      const encounterId = uuidParam(req.params.encounterId, 'encounterId');
      const payload = createClinicalRecordSchema.parse(req.body);
      const result = await clinicalService.createClinicalRecord(
        encounterId,
        payload,
        user.staffId,
        correlation(req),
        { role: user.role, departmentId: user.departmentId },
      );
      res.status(201).json({ data: result });
    } catch (error) {
      next(error);
    }
  }

  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const user = requireUser(req);
      const encounterId = uuidParam(req.params.encounterId, 'encounterId');
      const query = getClinicalRecordsQuerySchema.parse(req.query);
      const result = await clinicalService.listClinicalRecords(
        encounterId,
        query,
        user.staffId,
        correlation(req),
        { role: user.role, departmentId: user.departmentId },
      );
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async getSingle(req: Request, res: Response, next: NextFunction) {
    try {
      const user = requireUser(req);
      const encounterId = uuidParam(req.params.encounterId, 'encounterId');
      const recordId = uuidParam(req.params.recordId, 'recordId');
      const result = await clinicalService.getClinicalRecord(
        encounterId,
        recordId,
        user.staffId,
        correlation(req),
        { role: user.role, departmentId: user.departmentId },
      );
      res.status(200).json({ data: result });
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const user = requireUser(req);
      const encounterId = uuidParam(req.params.encounterId, 'encounterId');
      const recordId = uuidParam(req.params.recordId, 'recordId');
      const payload = updateClinicalRecordSchema.parse(req.body);
      const result = await clinicalService.updateClinicalRecord(
        encounterId,
        recordId,
        payload,
        user.staffId,
        correlation(req),
        { role: user.role, departmentId: user.departmentId },
      );
      res.status(200).json({ data: result });
    } catch (error) {
      next(error);
    }
  }

  async sign(req: Request, res: Response, next: NextFunction) {
    try {
      const user = requireUser(req);
      const encounterId = uuidParam(req.params.encounterId, 'encounterId');
      const recordId = uuidParam(req.params.recordId, 'recordId');
      const payload = signClinicalRecordSchema.parse(req.body);
      const result = await clinicalService.signClinicalRecord(
        encounterId,
        recordId,
        payload.expectedVersion,
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

export const clinicalController = new ClinicalController();
