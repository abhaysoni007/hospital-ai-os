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

  CORS_ORIGIN: z.string().default('http://localhost:3000'),

  JWT_PRIVATE_KEY_PATH: z.string(),
  JWT_PUBLIC_KEY_PATH: z.string(),
  JWT_ACCESS_EXPIRATION: z.string().default('15m'),
  JWT_REFRESH_EXPIRATION_DAYS: z.coerce.number().default(7),
});

const _config = configSchema.safeParse(process.env);

if (!_config.success) {
  console.error('❌ Invalid backend configuration:', _config.error.format());
  process.exit(1);
}

export const config = _config.data;
