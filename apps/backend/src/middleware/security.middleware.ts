import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { config } from '../config';
import { redisService } from '../utils/redis';
import { logger } from '../logger';

export const securityHeadersMiddleware = helmet();

function normalizeOrigin(origin: string): string {
  return origin.trim().replace(/^['"]|['"]$/g, '').replace(/\/+$/, '');
}

const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'https://medora.os.abhaysoni.app',
];

// Explicit trusted origins only (comma-separated list supported via CORS_ORIGIN).
// Wildcards are rejected by the config schema because credentials are enabled
// (HTTP-only refresh cookie must be scoped to trusted origins).
const CONFIG_ALLOWED_ORIGINS = config.CORS_ORIGIN.split(',')
  .map(normalizeOrigin)
  .filter(Boolean);

const ALLOWED_ORIGINS = Array.from(
  new Set([...DEFAULT_ALLOWED_ORIGINS.map(normalizeOrigin), ...CONFIG_ALLOWED_ORIGINS]),
);

export const corsMiddleware = cors({
  origin: (requestOrigin, callback) => {
    // Allow same-origin / non-browser requests (no Origin header).
    if (!requestOrigin) {
      return callback(null, true);
    }

    const normalized = normalizeOrigin(requestOrigin);
    if (ALLOWED_ORIGINS.includes(normalized)) {
      callback(null, true);
    } else {
      logger.warn(
        { origin: requestOrigin, allowedOrigins: ALLOWED_ORIGINS },
        'CORS rejected request from untrusted origin',
      );
      callback(null, false); // no CORS headers emitted for unknown origins
    }
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'x-request-id',
    'x-correlation-id',
    'Accept',
    'Origin',
  ],
  exposedHeaders: ['x-request-id', 'x-correlation-id'],
  credentials: true,
  maxAge: 86400,
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
