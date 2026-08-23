export abstract class AppError extends Error {
  abstract readonly statusCode: number;
  abstract readonly code: string;
  abstract readonly isOperational: boolean;

  constructor(
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this);
  }
}

export class ValidationError extends AppError {
  readonly statusCode = 400;
  readonly code = 'VALIDATION_ERROR';
  readonly isOperational = true;
}

export class AuthenticationError extends AppError {
  readonly statusCode = 401;
  readonly code = 'AUTHENTICATION_ERROR';
  readonly isOperational = true;
}

export class AuthorizationError extends AppError {
  readonly statusCode = 403;
  readonly code = 'AUTHORIZATION_ERROR';
  readonly isOperational = true;
}

export class NotFoundError extends AppError {
  readonly statusCode = 404;
  readonly code = 'NOT_FOUND_ERROR';
  readonly isOperational = true;
}

export class ConflictError extends AppError {
  readonly statusCode = 409;
  readonly code = 'CONFLICT_ERROR';
  readonly isOperational = true;
}

export class RateLimitError extends AppError {
  readonly statusCode = 429;
  readonly code = 'RATE_LIMIT_ERROR';
  readonly isOperational = true;
}

export class InternalError extends AppError {
  readonly statusCode = 500;
  readonly code = 'INTERNAL_ERROR';
  readonly isOperational = false;
}

export class ExternalServiceError extends AppError {
  readonly statusCode = 502;
  readonly code = 'EXTERNAL_SERVICE_ERROR';
  readonly isOperational = true;
}

export class AIServiceError extends AppError {
  readonly statusCode = 503;
  readonly code = 'AI_SERVICE_UNAVAILABLE';
  readonly isOperational = true;
}

export class DatabaseUnavailableError extends AppError {
  readonly statusCode = 503;
  readonly code = 'DATABASE_UNAVAILABLE';
  readonly isOperational = true;
}

export class AuditWriteError extends AppError {
  readonly statusCode = 500;
  readonly code = 'AUDIT_WRITE_ERROR';
  readonly isOperational = false;
}
