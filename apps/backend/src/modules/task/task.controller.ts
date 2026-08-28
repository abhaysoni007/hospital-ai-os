import { Request, Response, NextFunction } from 'express';
import { taskService } from './task.service';
import {
  getTasksQuerySchema,
  AuthenticationError,
  uuidSchema,
  ValidationError,
} from 'shared';
import { z } from 'zod';

function requireUser(req: Request) {
  const user = req.user;
  if (!user) throw new AuthenticationError('Unauthorized');
  return user;
}

function correlation(req: Request): string {
  return (req.headers['x-correlation-id'] as string) || crypto.randomUUID();
}

const reassignBodySchema = z.object({
  newAssigneeId: z.string().uuid('newAssigneeId must be a valid UUID'),
});

export class TaskController {
  async listTasks(req: Request, res: Response, next: NextFunction) {
    try {
      const user = requireUser(req);
      const query = getTasksQuerySchema.parse(req.query);
      const authContext = { role: user.role, departmentId: user.departmentId };
      const result = await taskService.listTasks(query, user.staffId, authContext);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  async getTask(req: Request, res: Response, next: NextFunction) {
    try {
      const user = requireUser(req);
      const id = uuidSchema.safeParse(req.params.id);
      if (!id.success) {
        throw new ValidationError('Invalid task id.', { code: 'VALIDATION_ERROR' });
      }
      const task = await taskService.getTask(id.data, user.staffId);
      res.json(task);
    } catch (err) {
      next(err);
    }
  }

  async acknowledgeTask(req: Request, res: Response, next: NextFunction) {
    try {
      const user = requireUser(req);
      const authContext = { role: user.role, departmentId: user.departmentId };
      const id = uuidSchema.safeParse(req.params.id);
      if (!id.success) {
        throw new ValidationError('Invalid task id.', { code: 'VALIDATION_ERROR' });
      }
      const task = await taskService.acknowledgeTask(
        id.data,
        user.staffId,
        correlation(req),
        authContext,
      );
      res.json(task);
    } catch (err) {
      next(err);
    }
  }

  async completeTask(req: Request, res: Response, next: NextFunction) {
    try {
      const user = requireUser(req);
      const authContext = { role: user.role, departmentId: user.departmentId };
      const id = uuidSchema.safeParse(req.params.id);
      if (!id.success) {
        throw new ValidationError('Invalid task id.', { code: 'VALIDATION_ERROR' });
      }
      const task = await taskService.completeTask(
        id.data,
        user.staffId,
        correlation(req),
        authContext,
      );
      res.json(task);
    } catch (err) {
      next(err);
    }
  }

  async reassignTask(req: Request, res: Response, next: NextFunction) {
    try {
      const user = requireUser(req);
      const authContext = { role: user.role, departmentId: user.departmentId };
      const id = uuidSchema.safeParse(req.params.id);
      if (!id.success) {
        throw new ValidationError('Invalid task id.', { code: 'VALIDATION_ERROR' });
      }
      const body = reassignBodySchema.parse(req.body);
      const task = await taskService.reassignTask(
        id.data,
        body.newAssigneeId,
        user.staffId,
        correlation(req),
        authContext,
      );
      res.json(task);
    } catch (err) {
      next(err);
    }
  }

  async escalateTask(req: Request, res: Response, next: NextFunction) {
    try {
      const user = requireUser(req);
      const authContext = { role: user.role, departmentId: user.departmentId };
      const id = uuidSchema.safeParse(req.params.id);
      if (!id.success) {
        throw new ValidationError('Invalid task id.', { code: 'VALIDATION_ERROR' });
      }
      const task = await taskService.escalateTask(
        id.data,
        user.staffId,
        correlation(req),
        authContext,
      );
      res.json(task);
    } catch (err) {
      next(err);
    }
  }
}

export const taskController = new TaskController();
