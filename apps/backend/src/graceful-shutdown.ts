import { Server } from 'http';
import { logger } from './logger';

// In a real app we might close postgres/redis connections here
// But since we use Drizzle with a postgres client, we can export the connection to close it if needed.
// For now, we simulate safe shutdown.

export const setupGracefulShutdown = (server: Server) => {
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Starting graceful shutdown...`);

    // Give it at most 10 seconds to finish requests
    setTimeout(() => {
      logger.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 10000);

    server.close(() => {
      logger.info('HTTP server closed.');
      // Add db connection close here if exposed
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
};
