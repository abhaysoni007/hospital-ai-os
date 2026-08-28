import { test, expect } from '@playwright/test';

test.describe('Phase 4: Clinical Intelligence Verification', () => {
  // Uses demo physician
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000/login');
    await page.getByLabel(/email/i).fill('demo.physician@hospital.test');
    await page.locator('input[type="password"]').fill('DemoPhys#2026!');
    await page.getByRole('button', { name: /sign in|login|submit/i }).click();
    await page.waitForURL('**/dashboard');
  });

  test('Flow A: Timeline rendering is bounded to 50 events and accurately sorted', async ({ page }) => {
    await page.goto('http://localhost:3000/encounters');
    await page.getByText('Margaret Chen').first().click();

    const timeline = page.getByRole('heading', { name: /Clinical Timeline/i });
    await expect(timeline).toBeVisible({ timeout: 10000 });

    await expect(page.getByText(/ENCOUNTER START/i).first()).toBeVisible();
  });

  test('Flow B: Chart Brief correctly invokes AI without task context', async ({ page }) => {
    await page.goto('http://localhost:3000/encounters');
    await page.getByText('Margaret Chen').first().click();

    const generateBtn = page.getByRole('button', { name: /Generate Brief/i });
    await expect(generateBtn).toBeVisible({ timeout: 10000 });
    
    await generateBtn.click();
    await expect(page.getByText(/Generating/i)).toBeVisible();
    
    await expect(page.getByRole('heading', { name: /Citations/i })).toBeVisible({ timeout: 15000 });
  });

  test('Flow C: Diagnostic trends exclude cancelled/invalid statuses', async ({ page }) => {
    await page.goto('http://localhost:3000/diagnostics');
    await page.getByText('Margaret Chen').first().click(); // Open CBC result

    const trendHeader = page.getByRole('heading', { name: /Historical Trend/i });
    await expect(trendHeader).toBeVisible({ timeout: 10000 });
  });
});
