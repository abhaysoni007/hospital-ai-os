import { z } from 'zod';
import * as dotenv from 'dotenv';
import path from 'path';

// Load .env relative to project root
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3001),
  API_BASE_URL: z.string().url().default('http://localhost:3001'),

  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url().optional(),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),

  // CORS origin must be an explicit trusted origin.
  // Wildcards are forbidden because CORS credentials are enabled (HTTP-only refresh cookie).
  CORS_ORIGIN: z
    .string()
    .refine((v) => v !== '*' && !v.includes('*'), {
      message:
        'CORS_ORIGIN must be an explicit trusted origin — wildcard is forbidden while credentials are enabled',
    })
    .default('http://localhost:3000'),

  JWT_PRIVATE_KEY_PATH: z.string(),
  JWT_PUBLIC_KEY_PATH: z.string(),
  JWT_ACCESS_EXPIRATION: z.string().default('15m'),
  JWT_REFRESH_EXPIRATION_DAYS: z.coerce.number().default(7),

  // --- AI subsystem (ADR-017/018/019/020 ratified defaults) -----------------
  // All keys are optional-with-defaults: the app ALWAYS boots without AI.
  // AI_ENABLED=false or absent AI_API_KEY ⇒ subsystem `disabled`; core
  // clinical workflows never depend on it.
  AI_ENABLED: z.preprocess((v) => v === true || v === 'true', z.boolean()).default(false),
  AI_PROVIDER: z.enum(['google-gemini', 'fake']).default('google-gemini'),
  AI_API_KEY: z.string().optional(),
  AI_MODEL_NAME: z.string().min(1).default('gemini-2.0-flash'),
  AI_TIMEOUT_MS: z.coerce.number().int().positive().max(120000).default(30000),
  AI_MAX_TOKENS: z.coerce.number().int().positive().default(4096),
  AI_DAILY_TOKEN_BUDGET: z.coerce.number().int().positive().default(200000),
  AI_PER_USER_RATE_LIMIT: z.coerce.number().int().positive().default(6),
  AI_SEMAPHORE_SIZE: z.coerce.number().int().positive().default(4),
  AI_DRAFT_TTL_HOURS: z.coerce.number().int().positive().default(24),
});

const _config = configSchema.safeParse(process.env);

if (!_config.success) {
  console.error('❌ Invalid backend configuration:', _config.error.format());
  process.exit(1);
}

export const config = _config.data;
