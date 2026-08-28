/**
 * Phase 4 — Playwright global setup.
 * Logs in once as the demo physician, stores auth state so each test
 * does NOT re-login (avoids hitting the login rate-limit of 6 req/window).
 */
import { chromium } from '@playwright/test';
import path from 'path';

export const STORAGE_STATE_PATH = path.join(
  __dirname,
  '.auth',
  'physician.json',
);

export default async function globalSetup() {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('http://localhost:3000/login');
  await page.getByLabel(/email/i).fill('demo.physician@hospital.test');
  await page.locator('input[type="password"]').fill('DemoPhys#2026!');
  await page.getByRole('button', { name: /sign in|login|submit/i }).click();
  await page.waitForURL('**/dashboard', { timeout: 30000 });

  // Persist cookies so individual tests skip login.
  await context.storageState({ path: STORAGE_STATE_PATH });
  await browser.close();
}
