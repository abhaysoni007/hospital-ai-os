import { defineConfig, devices } from '@playwright/test';

/**
 * Minimal config for the dashboard redesign QA spec.
 * Targets the already-running dev server on port 3000.
 * No globalSetup — the spec does inline login itself.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60000,
  // No globalSetup — inline login per test
  use: {
    baseURL: 'http://localhost:3000',
    // No storageState — each test logs in
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  // No webServer — we target the already-running server
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
