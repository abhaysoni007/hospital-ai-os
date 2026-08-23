import { describe, it, expect } from 'vitest';
import { handleDatabaseError } from '../errors';
import { PostgresError } from 'postgres';
import { ConflictError, ValidationError, DatabaseUnavailableError } from 'shared';

describe('Database Error Translator', () => {
  it('translates unique_violation (23505) to ConflictError', () => {
    const pgError = new PostgresError('duplicate key');
    pgError.code = '23505';
    pgError.constraint_name = 'users_email_unique';

    expect(() => handleDatabaseError(pgError)).toThrowError(ConflictError);
  });

  it('translates foreign_key_violation (23503) to ValidationError', () => {
    const pgError = new PostgresError('violates foreign key');
    pgError.code = '23503';

    expect(() => handleDatabaseError(pgError)).toThrowError(ValidationError);
  });

  it('translates connection failure (08006) to DatabaseUnavailableError', () => {
    const pgError = new PostgresError('connection failed');
    pgError.code = '08006';

    expect(() => handleDatabaseError(pgError)).toThrowError(DatabaseUnavailableError);
  });

  it('translates generic node ECONNREFUSED', () => {
    const err = new Error('connect ECONNREFUSED 127.0.0.1:5432');
    expect(() => handleDatabaseError(err)).toThrowError(DatabaseUnavailableError);
  });

  it('re-throws unhandled errors', () => {
    const err = new Error('something else');
    expect(() => handleDatabaseError(err)).toThrowError('something else');
  });
});
