import { app } from './app';
import { config } from './config';
import { logger } from './logger';
import { setupGracefulShutdown } from './graceful-shutdown';

const server = app.listen(config.PORT, () => {
  logger.info(`Server is running in ${config.NODE_ENV} mode on port ${config.PORT}`);
});

setupGracefulShutdown(server);
