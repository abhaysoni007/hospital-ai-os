import { Request, Response, NextFunction } from 'express';
import { AppError, ErrorDetail, ErrorResponse } from 'shared';
import { logger } from '../logger';

export const errorHandlerMiddleware = (
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction,
) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const correlationId = (req as any).correlationId;

  // Cross-module boundary check for AppError
  const errRecord = err as unknown as Record<string, unknown>;
  const isAppError =
    err instanceof AppError ||
    errRecord.name === 'AppError' ||
    typeof errRecord.statusCode === 'number';

  if (isAppError) {
    const appErr = err as AppError;
    if (!appErr.isOperational) {
      logger.error({ err, correlationId }, 'Non-operational error occurred');
    }

    const details = Array.isArray(appErr.details)
      ? (appErr.details as ErrorDetail[])
      : Array.isArray(errRecord.details)
        ? (errRecord.details as ErrorDetail[])
        : undefined;

    const response: ErrorResponse = {
      error: {
        code: appErr.code || (errRecord.code as string) || 'INTERNAL_ERROR',
        message: appErr.message,
        requestId: correlationId,
        details,
      },
    };

    return res.status(appErr.statusCode || (errRecord.statusCode as number) || 500).json(response);
  }

  // Handle ZodError from body parsing / validation
  if (err.name === 'ZodError') {
    const zodIssues =
      (err as unknown as { issues?: Array<{ path: (string | number)[]; message: string }> })
        .issues || [];
    const details: ErrorDetail[] = zodIssues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));

    const response: ErrorResponse = {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        requestId: correlationId,
        details: details.length > 0 ? details : undefined,
      },
    };
    return res.status(400).json(response);
  }

  // Unhandled internal error
  logger.error({ err, correlationId }, 'Unhandled exception');

  const response: ErrorResponse = {
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
      requestId: correlationId,
    },
  };

  return res.status(500).json(response);
};
