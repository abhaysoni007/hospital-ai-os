import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['dist/**', 'node_modules/**'],
    env: {
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/hospital_ai_os',
      NODE_ENV: 'test',
    },
  },
});
