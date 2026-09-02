import { test as setup, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = 'http://localhost:3000';
const EMAIL = 'demo.physician@hospital.test';
const PASSWORD = 'DemoPhys#2026!';
const STATE_FILE = __dirname + '/.m17-auth.json';

/**
 * M17 setup — log in ONCE and persist the auth cookies. Every subsequent
 * test reuses storageState; the app re-authenticates from the HTTP-only
 * refresh cookie on page load, so no per-test login is needed.
 */
setup('authenticate as demo physician', async ({ page }) => {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await page.goto(`${BASE}/login`, { timeout: 60000 });
      await page.getByLabel(/email/i).waitFor({ state: 'visible', timeout: 30000 });
      await page
        .getByLabel(/email/i)
        .fill(EMAIL, { timeout: 30000 })
        .catch(() => undefined);
      await page.locator('input[type="password"]').fill(PASSWORD, { timeout: 30000 });
      await page.getByRole('button', { name: /sign in|login|submit/i }).click();
      await page.waitForURL(`${BASE}/dashboard`, { timeout: 45000 });
      await page.waitForTimeout(1500);

      mkdirSync(__dirname, { recursive: true });
      await page.context().storageState({ path: STATE_FILE });
      await expect(page).toHaveURL(`${BASE}/dashboard`);
      return;
    } catch {
      if (attempt === 1) throw new Error('login failed after retry');
    }
  }
});
