import { Router } from 'express';
import { db } from '../../db'; // Assuming db connection is exported here
import { sql } from 'drizzle-orm';
import { logger } from '../../logger';
import { getAiHealthSnapshot } from '../ai/ai.container';

const router = Router();

/**
 * Liveness probe: Answers "Is the Node process alive and able to accept HTTP traffic?"
 * Does NOT touch downstream databases or dependencies.
 */
router.get('/live', (_req, res) => {
  return res.status(200).json({
    status: 'alive',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

/**
 * Readiness probe: Answers "Can this instance serve clinical requests?"
 * Validates database connectivity. Returns 503 if primary DB is unavailable.
 */
router.get('/ready', async (_req, res) => {
  const readiness = {
    status: 'unready',
    checks: {
      database: { status: 'down', latencyMs: 0 },
      ai: getAiHealthSnapshot(),
    },
    timestamp: new Date().toISOString(),
  };

  try {
    const start = Date.now();
    await db.execute(sql`SELECT 1`);
    readiness.checks.database.latencyMs = Date.now() - start;
    readiness.checks.database.status = 'up';
    readiness.status = 'ready';

    return res.status(200).json(readiness);
  } catch (error) {
    logger.error({ err: error }, 'Readiness check failed');
    return res.status(503).json(readiness);
  }
});

/**
 * General health check summary (backward-compatible)
 */
router.get('/', async (req, res) => {
  const healthCheck = {
    status: 'unhealthy',
    version: '1.0.0',
    checks: {
      database: { status: 'down', latencyMs: 0 },
      ai: getAiHealthSnapshot(),
    },
    uptime: process.uptime(),
  };

  try {
    const start = Date.now();
    await db.execute(sql`SELECT 1`);
    healthCheck.checks.database.latencyMs = Date.now() - start;
    healthCheck.checks.database.status = 'up';
    healthCheck.status = 'healthy';

    return res.status(200).json(healthCheck);
  } catch (error) {
    logger.error({ err: error }, 'Health check failed');
    healthCheck.status = 'unhealthy';
    return res.status(503).json(healthCheck);
  }
});

export const healthRoutes = router;

