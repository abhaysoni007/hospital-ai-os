import { describe, it, expect } from 'vitest';
import { ValidationError, InternalError } from '../AppError';

describe('AppError', () => {
  it('should correctly set properties for ValidationError', () => {
    const error = new ValidationError('Invalid input', { field: 'name' });
    expect(error.message).toBe('Invalid input');
    expect(error.details).toEqual({ field: 'name' });
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.isOperational).toBe(true);
  });

  it('should correctly set properties for InternalError', () => {
    const error = new InternalError('Database failure');
    expect(error.message).toBe('Database failure');
    expect(error.statusCode).toBe(500);
    expect(error.code).toBe('INTERNAL_ERROR');
    expect(error.isOperational).toBe(false);
  });
});
