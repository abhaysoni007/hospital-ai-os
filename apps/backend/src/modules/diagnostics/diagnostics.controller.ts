import { Request, Response, NextFunction } from 'express';
import { diagnosticsService } from './diagnostics.service';
import {
  createDiagnosticOrderSchema,
  getDiagnosticOrdersQuerySchema,
  cancelDiagnosticOrderSchema,
  enterResultSchema,
  uuidSchema,
} from 'shared';
import { AuthenticationError, ValidationError } from 'shared/src/errors/AppError';

function requireUser(req: Request) {
  const user = req.user;
  if (!user) throw new AuthenticationError('Unauthorized');
  return user;
}

function correlation(req: Request): string {
  return (req.headers['x-correlation-id'] as string) || crypto.randomUUID();
}

function ctx(user: ReturnType<typeof requireUser>) {
  return { role: user.role, departmentId: user.departmentId };
}

function uuidParam(value: unknown, name: string): string {
  const parsed = uuidSchema.safeParse(value);
  if (!parsed.success) {
    throw new ValidationError(`Invalid ${name} parameter.`, { code: 'VALIDATION_ERROR' });
  }
  return parsed.data;
}

export class DiagnosticsController {
  // ---- Encounter-scoped ----------------------------------------------------

  async createOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const user = requireUser(req);
      const encounterId = uuidParam(req.params.encounterId, 'encounterId');
      const payload = createDiagnosticOrderSchema.parse(req.body);
      const order = await diagnosticsService.createOrder(
        encounterId,
        payload,
        user.staffId,
        correlation(req),
        ctx(user),
      );
      res.status(201).json({ data: order });
    } catch (error) {
      next(error);
    }
  }

  async listEncounterOrders(req: Request, res: Response, next: NextFunction) {
    try {
      const user = requireUser(req);
      const encounterId = uuidParam(req.params.encounterId, 'encounterId');
      const result = await diagnosticsService.listEncounterOrders(
        encounterId,
        user.staffId,
        correlation(req),
        ctx(user),
      );
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  // ---- Lab queue / order-scoped ---------------------------------------------

  async listLabQueue(req: Request, res: Response, next: NextFunction) {
    try {
      const user = requireUser(req);
      const query = getDiagnosticOrdersQuerySchema.parse(req.query);
      const result = await diagnosticsService.listLabQueue(query, ctx(user));
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async getOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const user = requireUser(req);
      const id = uuidParam(req.params.id, 'orderId');
      const order = await diagnosticsService.getOrder(id, user.staffId, ctx(user));
      res.status(200).json({ data: order });
    } catch (error) {
      next(error);
    }
  }

  async collectSample(req: Request, res: Response, next: NextFunction) {
    try {
      const user = requireUser(req);
      const id = uuidParam(req.params.id, 'orderId');
      const order = await diagnosticsService.collectSample(
        id,
        user.staffId,
        correlation(req),
        ctx(user),
      );
      res.status(200).json({ data: order });
    } catch (error) {
      next(error);
    }
  }

  async cancelOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const user = requireUser(req);
      const id = uuidParam(req.params.id, 'orderId');
      const payload = cancelDiagnosticOrderSchema.parse(req.body ?? {});
      const order = await diagnosticsService.cancelOrder(
        id,
        payload,
        user.staffId,
        correlation(req),
        ctx(user),
      );
      res.status(200).json({ data: order });
    } catch (error) {
      next(error);
    }
  }

  async enterResult(req: Request, res: Response, next: NextFunction) {
    try {
      const user = requireUser(req);
      const orderId = uuidParam(req.params.orderId, 'orderId');
      const payload = enterResultSchema.parse(req.body);
      const result = await diagnosticsService.enterResult(
        orderId,
        payload,
        user.staffId,
        correlation(req),
        ctx(user),
      );
      res.status(201).json({ data: result });
    } catch (error) {
      next(error);
    }
  }

  async getResult(req: Request, res: Response, next: NextFunction) {
    try {
      const user = requireUser(req);
      const orderId = uuidParam(req.params.orderId, 'orderId');
      const result = await diagnosticsService.getResult(orderId, user.staffId, ctx(user));
      res.status(200).json({ data: result });
    } catch (error) {
      next(error);
    }
  }

  async verifyResult(req: Request, res: Response, next: NextFunction) {
    try {
      const user = requireUser(req);
      const orderId = uuidParam(req.params.orderId, 'orderId');
      const result = await diagnosticsService.verifyResult(
        orderId,
        user.staffId,
        correlation(req),
        ctx(user),
      );
      res.status(200).json({ data: result });
    } catch (error) {
      next(error);
    }
  }
}

export const diagnosticsController = new DiagnosticsController();
