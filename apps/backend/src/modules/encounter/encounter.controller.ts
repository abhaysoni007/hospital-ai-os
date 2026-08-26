import { Request, Response, NextFunction } from 'express';
import { encounterService } from './encounter.service';
import { createEncounterSchema, getEncountersQuerySchema, activateEncounterSchema, dischargeEncounterSchema } from 'shared';
import { AuthenticationError } from 'shared/src/errors/AppError';

export class EncounterController {
  async createEncounter(req: Request, res: Response, next: NextFunction) {
    try {
      const payload = createEncounterSchema.parse(req.body);
      const user = req.user;
      if (!user) throw new AuthenticationError('Unauthorized');

      const correlationId = (req.headers['x-correlation-id'] as string) || crypto.randomUUID();

      const encounter = await encounterService.createEncounter(
        payload,
        user.staffId,
        correlationId,
        { role: user.role, departmentId: user.departmentId },
      );

      res.status(201).json({ data: encounter });
    } catch (error) {
      next(error);
    }
  }

  async listEncounters(req: Request, res: Response, next: NextFunction) {
    try {
      const query = getEncountersQuerySchema.parse(req.query);
      const user = req.user;
      if (!user) throw new AuthenticationError('Unauthorized');

      const result = await encounterService.listEncounters(query, {
        role: user.role,
        departmentId: user.departmentId,
      });

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async getEncounterDetail(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const user = req.user;
      if (!user) throw new AuthenticationError('Unauthorized');

      const detail = await encounterService.getEncounterDetail(id, {
        role: user.role,
        departmentId: user.departmentId,
      });

      res.status(200).json({ data: detail });
    } catch (error) {
      next(error);
    }
  }

  async activateEncounter(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const payload = activateEncounterSchema.parse(req.body);
      const user = req.user;
      if (!user) throw new AuthenticationError('Unauthorized');

      const correlationId = (req.headers['x-correlation-id'] as string) || crypto.randomUUID();

      const encounter = await encounterService.activateEncounter(
        id,
        payload.expectedVersion,
        user.staffId,
        correlationId,
        { role: user.role, departmentId: user.departmentId },
      );

      res.status(200).json({ data: encounter });
    } catch (error) {
      next(error);
    }
  }

  async dischargeEncounter(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const payload = dischargeEncounterSchema.parse(req.body);
      const user = req.user;
      if (!user) throw new AuthenticationError('Unauthorized');

      const correlationId = (req.headers['x-correlation-id'] as string) || crypto.randomUUID();

      const encounter = await encounterService.dischargeEncounter(
        id,
        payload,
        user.staffId,
        correlationId,
        { role: user.role, departmentId: user.departmentId },
      );

      res.status(200).json({ data: encounter });
    } catch (error) {
      next(error);
    }
  }
}

export const encounterController = new EncounterController();
