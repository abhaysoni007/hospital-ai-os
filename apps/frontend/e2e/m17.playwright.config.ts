import { defineConfig, devices } from '@playwright/test';

// M17 gate config — runs against the already-running dev server on :3000.
// Login happens ONCE in the `setup` project and is reused via storageState;
// the app re-authenticates from the HTTP-only refresh cookie on page load.
// Workers stay serialized because the dev server recompiles between passes.
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
  projects: [
    { name: 'setup', testMatch: /m17-auth\.setup\.ts/ },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: __dirname + '/.m17-auth.json',
      },
      dependencies: ['setup'],
    },
  ],
});
