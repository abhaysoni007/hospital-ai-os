import { PostgresError } from 'postgres';
import { ConflictError, ValidationError, DatabaseUnavailableError } from 'shared';

export const handleDatabaseError = (error: unknown): never => {
  if (error instanceof PostgresError) {
    switch (error.code) {
      case '23505': // unique_violation
        throw new ConflictError('A record with this identifier already exists', {
          constraint: error.constraint_name,
        });
      case '23503': // foreign_key_violation
        throw new ValidationError('Invalid reference to a related record', {
          constraint: error.constraint_name,
        });
      case '08006': // connection_failure
      case '08001': // sqlclient_unable_to_establish_sqlconnection
      case '08004': // sqlserver_rejected_establishment_of_sqlconnection
        throw new DatabaseUnavailableError('Database connection failed');
      default:
        // Re-throw generic PostgresError so it can be handled globally as an InternalError
        throw error;
    }
  }

  if (
    error instanceof Error &&
    (error.message.includes('ECONNREFUSED') || error.message.includes('timeout'))
  ) {
    throw new DatabaseUnavailableError('Database connection failed');
  }

  throw error;
};
