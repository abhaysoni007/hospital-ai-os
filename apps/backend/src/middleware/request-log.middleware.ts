import pinoHttp from 'pino-http';
import { logger } from '../logger';

export const requestLogMiddleware = pinoHttp({
  logger,
  // Automatically add the correlation ID to all logs
  customProps: (req) => {
    return {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      correlationId: (req as any).correlationId,
    };
  },
  // Avoid logging health checks to prevent log spam
  autoLogging: {
    ignore: (req) => req.url === '/api/v1/health',
  },
});
