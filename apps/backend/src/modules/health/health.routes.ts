import { Router } from 'express';
import { db } from '../../db'; // Assuming db connection is exported here
import { sql } from 'drizzle-orm';
import { logger } from '../../logger';

const router = Router();

router.get('/', async (req, res) => {
  // Liveness check: process is responding to HTTP
  // Readiness check: process can communicate with required dependencies (DB)

  const healthCheck = {
    status: 'unhealthy',
    version: '1.0.0', // Optionally pull from process.env or package.json
    checks: {
      database: { status: 'down', latencyMs: 0 },
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
    // If DB is down, readiness fails
    healthCheck.status = 'unhealthy';
    return res.status(503).json(healthCheck);
  }
});

export const healthRoutes = router;
