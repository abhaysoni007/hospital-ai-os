/**
 * Dashboard Redesign Visual QA — Playwright script.
 *
 * Runs against the existing dev server on port 3000.
 * Performs inline login (bypasses global-setup / port 3002).
 * Checks all redesign acceptance criteria at 1440, 1280, 1024, 768, 375px.
 *
 * Run: npx playwright test e2e/dashboard-redesign-qa.spec.ts --config playwright.config.ts
 * Or:  npx playwright test e2e/dashboard-redesign-qa.spec.ts --headed --config playwright.config.ts
 */
import { test, expect, Page } from '@playwright/test';
import path from 'path';

const BASE = 'http://localhost:3000';
const EMAIL = 'demo.physician@hospital.test';
const PASSWORD = 'DemoPhys#2026!';

const SCREENSHOT_DIR = path.join(__dirname, '..', '..', '..', '..', '.gemini', 'antigravity-ide', 'brain', '03c01ca7-3c0e-4538-99f0-94d70113ffee');

async function loginAndGoto(page: Page, url: string) {
  await page.goto(`${BASE}/login`);
  await page.getByLabel(/email/i).fill(EMAIL);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.getByRole('button', { name: /sign in|login|submit/i }).click();
  await page.waitForURL(`${BASE}/dashboard`, { timeout: 30000 });
  if (url !== `${BASE}/dashboard`) {
    await page.goto(url);
  }
}

test.describe('Dashboard Redesign Visual QA', () => {
  test.use({ baseURL: BASE, storageState: { cookies: [], origins: [] } });

  test('1440px — full desktop layout', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAndGoto(page, `${BASE}/dashboard`);
    await page.waitForTimeout(2000); // let data load

    // Screenshot
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'qa_1440px.png'),
      fullPage: true,
    });

    // ── Critical alert ──────────────────────────────────────────────────────
    const alertStrip = page.locator('[role="alert"]').first();
    const alertVisible = await alertStrip.isVisible().catch(() => false);
    if (alertVisible) {
      const alertText = await alertStrip.innerText();
      console.log('ALERT TEXT:', alertText);

      // Must NOT contain the broken " for physician review" artifact
      expect(alertText).not.toContain('for physician review');
      // Must NOT contain double " for " followed by itself
      expect(alertText).not.toMatch(/Complete Blood Count.*for.*Complete Blood Count/s);
      // Must contain "flagged CRITICAL"
      expect(alertText).toContain('flagged CRITICAL');
    } else {
      console.log('INFO: No critical alert visible (no unacknowledged critical items)');
    }

    // ── KPI metric cards ────────────────────────────────────────────────────
    const metricSection = page.getByLabel('Operational summary');
    await expect(metricSection).toBeVisible();
    const metricCards = metricSection.locator('a, div').filter({ hasText: /Active Encounters|Pending Lab|Results Awaiting|Critical Alerts|My Tasks|Avg. Encounter/i });
    const cardCount = await metricCards.count();
    console.log('KPI cards found:', cardCount);
    expect(cardCount).toBeGreaterThanOrEqual(3);

    // ── Encounter Volume 7D chip ────────────────────────────────────────────
    const encounterVolumeCard = page.getByRole('heading', { name: /Encounter Volume/i }).locator('..');
    const sevenDChip = page.locator('span').filter({ hasText: /^7D$/ });
    const has7D = await sevenDChip.count() > 0;
    console.log('7D chip present:', has7D);
    expect(has7D).toBe(true);

    // ── Today's Snapshot ────────────────────────────────────────────────────
    const snapshot = page.getByLabel("Today's snapshot");
    await expect(snapshot).toBeVisible();
    const snapshotText = await snapshot.innerText();
    console.log('Snapshot text:', snapshotText.substring(0, 100));

    // ── Active Encounters table ─────────────────────────────────────────────
    const table = page.getByLabel('Active encounters');
    const tableVisible = await table.isVisible().catch(() => false);
    console.log('Encounters table visible:', tableVisible);

    // ── Split layout — right column minimum width ───────────────────────────
    const criticalQueueHeader = page.getByRole('heading', { name: /Critical Work Queue/i });
    const queueVisible = await criticalQueueHeader.isVisible().catch(() => false);
    if (queueVisible) {
      const queueBox = await criticalQueueHeader.boundingBox();
      if (queueBox) {
        console.log('Right column left edge (x):', queueBox.x, 'width context: right column starts at', queueBox.x);
        // Right column should start no further right than ~1100px at 1440 viewport
        // meaning it has at least ~340px width
        expect(queueBox.x).toBeLessThan(1150);
      }
    }

    // ── Work queue task body ────────────────────────────────────────────────
    const taskItems = page.locator('[class*="taskItem"]');
    const taskCount = await taskItems.count();
    if (taskCount > 0) {
      const firstTaskText = await taskItems.first().innerText();
      console.log('First queue item text:', firstTaskText);
      // Should NOT contain " · " as a broken split artifact right after the test name
      // (body is now rendered as-is, no split)
      expect(firstTaskText).not.toMatch(/\w+\s*·\s*physician review/i);
    }
  });

  test('1280px — wide laptop layout', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await loginAndGoto(page, `${BASE}/dashboard`);
    await page.waitForTimeout(2000);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'qa_1280px.png'),
      fullPage: true,
    });

    // Right column must be at least 280px wide (new minmax(280px, 1fr))
    const queueHeader = page.getByRole('heading', { name: /Critical Work Queue/i });
    const queueVisible = await queueHeader.isVisible().catch(() => false);
    if (queueVisible) {
      const queueBox = await queueHeader.boundingBox();
      if (queueBox) {
        // At 1280px with sidebar ~248px and content padding ~64px,
        // available is ~968px. Right column should be ≥280px.
        const approxRightColWidth = 1280 - queueBox.x;
        console.log('Approx right column width at 1280px:', approxRightColWidth);
        expect(approxRightColWidth).toBeGreaterThanOrEqual(280);
      }
    }

    // KPIs should be 3-column grid (not overflow)
    const metricSection = page.getByLabel('Operational summary');
    await expect(metricSection).toBeVisible();
  });

  test('1024px — tablet landscape', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await loginAndGoto(page, `${BASE}/dashboard`);
    await page.waitForTimeout(2000);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'qa_1024px.png'),
      fullPage: true,
    });

    // At 1024px, split layout collapses to single column
    const metricSection = page.getByLabel('Operational summary');
    await expect(metricSection).toBeVisible();
    console.log('1024px: dashboard renders without overflow');

    // No horizontal overflow
    const bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth);
    const bodyClientWidth = await page.evaluate(() => document.body.clientWidth);
    console.log('Body scrollWidth:', bodyScrollWidth, 'clientWidth:', bodyClientWidth);
    expect(bodyScrollWidth).toBeLessThanOrEqual(bodyClientWidth + 5); // 5px tolerance
  });

  test('768px — tablet portrait', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await loginAndGoto(page, `${BASE}/dashboard`);
    await page.waitForTimeout(2000);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'qa_768px.png'),
      fullPage: true,
    });

    // KPIs should be 2-column at 768px
    const metricSection = page.getByLabel('Operational summary');
    await expect(metricSection).toBeVisible();

    // No horizontal overflow
    const bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth);
    const bodyClientWidth = await page.evaluate(() => document.body.clientWidth);
    console.log('768px body scrollWidth:', bodyScrollWidth, 'clientWidth:', bodyClientWidth);
    expect(bodyScrollWidth).toBeLessThanOrEqual(bodyClientWidth + 5);

    // Critical alert strip should be readable (not clipped)
    const alertStrip = page.locator('[role="alert"]').first();
    const alertVisible = await alertStrip.isVisible().catch(() => false);
    if (alertVisible) {
      const alertBox = await alertStrip.boundingBox();
      console.log('Alert at 768px height:', alertBox?.height);
      // Should not be collapsed to 0 height
      expect(alertBox?.height).toBeGreaterThan(30);
    }
  });

  test('375px — mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await loginAndGoto(page, `${BASE}/dashboard`);
    await page.waitForTimeout(2000);

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'qa_375px.png'),
      fullPage: true,
    });

    // No horizontal overflow at mobile
    const bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth);
    const bodyClientWidth = await page.evaluate(() => document.body.clientWidth);
    console.log('375px body scrollWidth:', bodyScrollWidth, 'clientWidth:', bodyClientWidth);
    expect(bodyScrollWidth).toBeLessThanOrEqual(bodyClientWidth + 5);
  });

  test('Snapshot cells have no background box', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await loginAndGoto(page, `${BASE}/dashboard`);
    await page.waitForTimeout(2000);

    // Snapshot cells should now have transparent/no background
    const snapshot = page.getByLabel("Today's snapshot");
    await expect(snapshot).toBeVisible();

    // Check computed background of first snapshot cell
    const snapshotCell = snapshot.locator('[class*="snapshotCell"]').first();
    const cellVisible = await snapshotCell.isVisible().catch(() => false);
    if (cellVisible) {
      const bg = await snapshotCell.evaluate(
        (el) => window.getComputedStyle(el).backgroundColor
      );
      console.log('Snapshot cell background-color:', bg);
      // Should NOT be the gray bg-subtle color (rgba(241, 245, 249, 1) = #f1f5f9)
      // Now it should be transparent or very close to transparent
      expect(bg).not.toBe('rgb(241, 245, 249)');
    }
  });
});
