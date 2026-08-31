/**
 * Phase 4 — Clinical Intelligence E2E Verification
 *
 * Auth: global-setup logs in once as demo.physician. storageState is injected
 * by playwright.config.ts so NO test re-logs in (avoids auth rate-limit of 6 req/window).
 *
 * All navigation uses relative URLs (baseURL = http://localhost:3000).
 */
import { test, expect } from '@playwright/test';

// ─── Flow A: Clinical Timeline ───────────────────────────────────────────────
test('Flow A: Clinical Timeline renders for authorized patient', async ({ page }) => {
  await page.goto('/encounters');

  await page.getByText('Margaret Chen').first().click();
  await page.waitForURL('**/encounters/**');

  // Timeline heading rendered by ClinicalTimeline component
  await expect(page.getByRole('heading', { name: /Clinical Timeline/i })).toBeVisible({ timeout: 15000 });
  // At least one ENCOUNTER START event from seed
  await expect(page.getByText(/ENCOUNTER START/i).first()).toBeVisible({ timeout: 10000 });
});

// ─── Flow B: Chart Brief ─────────────────────────────────────────────────────
test('Flow B: Chart Brief generates and renders citations', async ({ page }) => {
  await page.goto('/encounters');
  await page.getByText('Margaret Chen').first().click();
  await page.waitForURL('**/encounters/**');

  const generateBtn = page.getByRole('button', { name: /Generate Brief/i });
  await expect(generateBtn).toBeVisible({ timeout: 15000 });

  await generateBtn.click();
  // Loading spinner text
  await expect(page.getByText(/Generating\.\.\./i)).toBeVisible({ timeout: 5000 });
  // Citations section after AI responds
  await expect(page.getByText(/Citations/i).first()).toBeVisible({ timeout: 20000 });
});

// ─── Flow C: Chart Brief graceful failure ────────────────────────────────────
test('Flow C: Chart Brief shows error state on AI failure', async ({ page }) => {
  // Intercept BEFORE navigation so the route handler is registered early
  await page.route('**/intelligence/chart-brief/**', route =>
    route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: { code: 'AI_ERROR', message: 'Simulated failure' } }),
    })
  );

  await page.goto('/encounters');
  await page.getByText('Margaret Chen').first().click();
  await page.waitForURL('**/encounters/**');

  const generateBtn = page.getByRole('button', { name: /Generate Brief/i });
  await expect(generateBtn).toBeVisible({ timeout: 15000 });
  await generateBtn.click();

  // ChartBrief component shows the error div (class contains "red" or "error")
  // The component renders: <div className="text-sm text-red-600 bg-red-50 ...">
  await expect(
    page.locator('div').filter({ hasText: /failed to generate|simulated failure|ai error/i }).first()
  ).toBeVisible({ timeout: 10000 });

  // Encounter page must still be usable
  await expect(page.getByRole('heading', { name: /Clinical Timeline/i })).toBeVisible();
});

// ─── Flow D: Diagnostic Trend ────────────────────────────────────────────────
test('Flow D: Historical Diagnostic Trend renders on CBC result page', async ({ page }) => {
  await page.goto('/encounters');
  await page.getByText('Margaret Chen').first().click();
  await page.waitForURL('**/encounters/**');

  // Wait for diagnostic orders list to load
  await page.waitForSelector('text=Complete Blood Count', { timeout: 15000 });

  // Click the first CBC button — STAT order with a result entered during seed
  await page.getByRole('button', { name: /Complete Blood Count/i }).first().click();
  await page.waitForURL('**/diagnostics/**', { timeout: 10000 });

  // DiagnosticTrend renders a div (not a heading) containing "Historical Trend (CBC)"
  await expect(page.getByText(/Historical Trend/i).first()).toBeVisible({ timeout: 15000 });
});

// ─── Flow E: Break-Glass ─────────────────────────────────────────────────────
test('Flow E: Break-Glass banner appears for out-of-scope patient', async ({ page }) => {
  // demo.physician (Rajan Mehta, Cardiology) owns Margaret Chen's encounter.
  // James Okonkwo belongs to phy2 (Internal Medicine) — accessing any of
  // his encounters from demo.physician triggers a 403 → Break-Glass prompt.
  await page.goto('/patients');
  await page.waitForLoadState('networkidle', { timeout: 20000 });

  const james = page.getByText('James Okonkwo').first();
  await expect(james).toBeVisible({ timeout: 15000 });
  await james.click();

  // BreakGlassModal renders: <h2>Emergency Access Required</h2> inside role="dialog"
  await expect(
    page.getByRole('heading', { name: /Emergency Access Required/i }).or(
      page.getByText(/Restricted Access|Emergency Access Required/i).first()
    )
  ).toBeVisible({ timeout: 15000 });
});
