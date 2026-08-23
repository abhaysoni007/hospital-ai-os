import { Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';
import { ValidationError } from 'shared';

export const validate =
  (schema: z.ZodTypeAny) => async (req: Request, res: Response, next: NextFunction) => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      return next();
    } catch (error) {
      if (error instanceof ZodError) {
        const details = error.issues.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        }));
        return next(new ValidationError('Request validation failed', details));
      }
      return next(error);
    }
  };
