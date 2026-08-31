import { defineConfig, devices } from '@playwright/test';
import path from 'path';

const STORAGE_STATE_PATH = path.join(__dirname, 'e2e', '.auth', 'physician.json');

export default defineConfig({
  testDir: './e2e',
  timeout: 60000,
  globalSetup: './e2e/global-setup.ts',
  use: {
    storageState: STORAGE_STATE_PATH,
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run dev',
    port: 3002,
    reuseExistingServer: true,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
