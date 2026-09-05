import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { config } from '../config';
import { redisService } from '../utils/redis';

export const securityHeadersMiddleware = helmet();

// Explicit trusted origins only (comma-separated list supported via CORS_ORIGIN).
// Wildcards are rejected by the config schema because credentials are enabled
// (HTTP-only refresh cookie must be scoped to trusted origins).
const ALLOWED_ORIGINS = config.CORS_ORIGIN.split(',')
  .map((o) => o.trim())
  .filter(Boolean);

export const corsMiddleware = cors({
  origin: (requestOrigin, callback) => {
    // Allow same-origin / non-browser requests (no Origin header).
    if (!requestOrigin || ALLOWED_ORIGINS.includes(requestOrigin)) {
      callback(null, true);
    } else {
      callback(null, false); // no CORS headers emitted for unknown origins
    }
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id'],
  credentials: true,
});

export const rateLimitMiddleware = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: config.RATE_LIMIT_MAX_REQUESTS,
  message: {
    error: {
      code: 'RATE_LIMIT_ERROR',
      message: 'Too many requests, please try again later.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Use Redis store if Redis is configured and available; otherwise fallback to memory.
  // rate-limit-redis handles the Redis interaction. If the client is disconnected, we shouldn't pass it.
  store: config.REDIS_URL && redisService.getClient() 
    ? new RedisStore({
        // @ts-expect-error - rate-limit-redis types might not perfectly align with ioredis, but it works
        sendCommand: (...args: string[]) => redisService.getClient()?.call(...args),
        prefix: 'hospital-ai-os:rate-limit:',
      })
    : undefined, // undefined falls back to MemoryStore
});
