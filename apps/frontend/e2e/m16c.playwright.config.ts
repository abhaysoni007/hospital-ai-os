import { defineConfig, devices } from '@playwright/test';

// M16C gate config — runs against the already-running dev server on :3000.
// The repository playwright.config.ts targets a :3002 webServer + global
// storage state; this spec logs in inline instead. Workers are serialized
// because the dev server recompiles between viewport passes and parallel
// logins intermittently starve it.
export default defineConfig({
  testDir: __dirname,
  timeout: 120000,
  workers: 1,
  retries: 1,
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'off',
    actionTimeout: 20000,
    navigationTimeout: 60000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
