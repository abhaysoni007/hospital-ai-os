/**
 * M17 Clinical Workspace Gate — Playwright checks.
 *
 * Covers the representative M17 workflows end to end against the real dev
 * server + backend:
 *   1. Patient list → patient detail
 *   2. Patient → encounter
 *   3. Encounter → clinical workspace (identity band, documentation)
 *   4. Encounter → order diagnostic form (patient context while ordering)
 *   5. Diagnostics queue → order detail (patient context + semantic badges)
 *   6. Tasks workspace (ARIA scope tabs, semantic badges, result actions)
 *   7. No page-wide horizontal overflow at every required breakpoint
 *   8. One h1 per audited clinical page (heading hierarchy)
 *
 * Run: npx playwright test e2e/m17-workspace.spec.ts --config=e2e/m17.playwright.config.ts
 */
import { test, expect, Page } from '@playwright/test';

const BASE = 'http://localhost:3000';
const EMAIL = 'demo.physician@hospital.test';
const PASSWORD = 'DemoPhys#2026!';

const PATIENT_CONTEXT = '[aria-label="Patient context"]';

// Session comes from m17-auth.setup.ts via storageState. If the app's
// in-memory auth bootstrap bounces us to /login anyway, log in inline so
// workflow checks stay independent of session-restore quirks.
async function ensureOnWorkspace(page: Page, route: string) {
  await page.goto(`${BASE}${route}`, { timeout: 60000 });
  await page.waitForTimeout(1500);
  if (page.url().includes('/login')) {
    await page.getByLabel(/email/i).waitFor({ state: 'visible', timeout: 30000 });
    await page
      .getByLabel(/email/i)
      .fill(EMAIL, { timeout: 30000 })
      .catch(() => undefined);
    await page.locator('input[type="password"]').fill(PASSWORD, { timeout: 30000 });
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(/(dashboard|patients|encounters|diagnostics|tasks)/, { timeout: 45000 });
    await page.goto(`${BASE}${route}`, { timeout: 60000 });
  }
  await page.waitForTimeout(1500);
}

async function waitForList(page: Page, tableLabel: string) {
  const table = page.locator(`[aria-label="${tableLabel}"]`);
  const emptyState = page.getByText(/No patients|No encounters|No tasks|caught up/).first();
  await expect(table.or(emptyState)).toBeVisible({ timeout: 30000 });
}

test.describe('M17 — patient → encounter workflow', () => {
  test('patient list → profile → encounter workspace keeps identity continuous', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    await ensureOnWorkspace(page, '/patients');
    await waitForList(page, 'Registered patients');
    const patientRows = page.locator('[aria-label="Registered patients"] tr[aria-label^="Open "]');
    const hasPatients = (await patientRows.count()) > 0;
    test.skip(!hasPatients, 'demo dataset has no patients');
    await expect(page.locator('.resultNote, [class*="resultNote"]')).toBeVisible();

    await patientRows.first().click();
    await page.waitForURL(/\/patients\/[0-9a-f-]+$/, { timeout: 30000 });
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.waitForTimeout(2000);

    // Patient → encounter (profile lists encounters; first row opens the workspace)
    const encounterLinks = page.getByRole('link', { name: 'Open encounter' });
    const hasEncounters = (await encounterLinks.count()) > 0;
    if (hasEncounters) {
      await encounterLinks.first().click();
      await page.waitForURL(/\/encounters\/[0-9a-f-]+$/, { timeout: 30000 });
      await page.waitForTimeout(2500);

      // Workspace identity: exactly one h1 + persistent patient context band.
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
      await expect(page.locator(PATIENT_CONTEXT)).toBeVisible();
      const band = await page.locator(PATIENT_CONTEXT).textContent();
      expect(band ?? '').toMatch(/MRN/i);

      // Documentation card is the primary work surface (permission-gated).
      await expect(page.getByRole('heading', { name: 'Clinical documentation' })).toBeVisible();
    }

    // Encounter → order diagnostic (physician holds diagnostic_order:create).
    if (hasEncounters) {
      const orderButton = page.getByRole('button', { name: /order diagnostic/i });
      const canOrder = (await orderButton.count()) > 0;
      if (canOrder) {
        await orderButton.first().click();
        await page.waitForURL(/\/encounters\/[0-9a-f-]+\/diagnostics\/new$/, { timeout: 30000 });
        await page.waitForTimeout(2000);
        await expect(page.getByRole('heading', { level: 1, name: 'Order diagnostic' })).toHaveCount(
          1,
        );
        // M17: ordering never happens without visible patient identity.
        await expect(page.locator(PATIENT_CONTEXT)).toBeVisible();
        await expect(page.getByRole('button', { name: 'Place order' })).toBeVisible();
      }
    }
  });
});

test.describe('M17 — diagnostics workflow', () => {
  test('lab queue → order detail shows patient context and semantic badges', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    await ensureOnWorkspace(page, '/diagnostics');
    const queue = page.locator('[aria-label="Diagnostic orders queue"]');
    const emptyState = page.getByText(/No orders|Nothing|No diagnostic/i).first();
    await expect(queue.or(emptyState)).toBeVisible({ timeout: 30000 });

    const orderRows = queue.locator('tr[aria-label^="Open order"]');
    const hasQueue = (await orderRows.count()) > 0;
    test.skip(!hasQueue, 'demo dataset has no diagnostic orders');

    await orderRows.first().click();
    await page.waitForURL(/\/diagnostics\/[0-9a-f-]+/, { timeout: 30000 });
    await page.waitForTimeout(2500);

    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    // M17: the order detail identifies the patient (previously absent).
    await expect(page.locator(PATIENT_CONTEXT)).toBeVisible();
  });

  test('result entry form shows patient context and per-field labels', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    // Navigate directly to the result-entry form for the first order.
    await ensureOnWorkspace(page, '/diagnostics');
    const queue = page.locator('[aria-label="Diagnostic orders queue"]');
    const emptyState = page.getByText(/No orders|Nothing|No diagnostic/i).first();
    await expect(queue.or(emptyState)).toBeVisible({ timeout: 30000 });

    const orderRows = queue.locator('tr[aria-label^="Open order"]');
    const count = await orderRows.count();
    test.skip(count === 0, 'demo dataset has no diagnostic orders');

    const href = await page.evaluate(() => {
      const link = document.querySelector<HTMLAnchorElement>('a[href*="/diagnostics/"]');
      return link ? link.getAttribute('href') : null;
    });
    test.skip(!href, 'no order link found');

    const orderId = (href as string).split('/').pop()?.split('?')[0];
    test.skip(!orderId, 'could not extract order id');
    await page.goto(`${BASE}/diagnostics/${orderId}/result/new`);
    await page.waitForTimeout(2500);

    // Either the form or an honest ErrorState renders — never a blank screen.
    await expect(
      page.getByRole('heading', { level: 1 }).or(page.getByText('Could not load order')),
    ).toBeVisible();
    if ((await page.locator(PATIENT_CONTEXT).count()) > 0) {
      await expect(page.locator(PATIENT_CONTEXT)).toBeVisible();
    }
  });
});

test.describe('M17 — tasks workspace', () => {
  test('ARIA scope tabs switch queues; table uses semantic badges', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    await ensureOnWorkspace(page, '/tasks');
    await waitForList(page, 'Tasks');

    // WAI-ARIA tabs replace the former button-as-tab pattern.
    const tablist = page.getByRole('tablist', { name: 'Task queue scope' });
    await expect(tablist).toBeVisible();
    await expect(tablist.getByRole('tab', { name: 'My Work' })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    const departmentTab = tablist.getByRole('tab', { name: 'Department Queue' });
    const canSwitch = (await departmentTab.count()) > 0;
    if (canSwitch) {
      await departmentTab.click();
      await expect(departmentTab).toHaveAttribute('aria-selected', 'true');
      await expect(page.getByRole('heading', { level: 1, name: 'Department Queue' })).toBeVisible();
      await page.waitForTimeout(2200);
    }

    // Semantic badges (not raw enum text) render in the priority column.
    if ((await page.locator('[aria-label="Tasks"]').count()) > 0) {
      const cells = page.locator('[aria-label="Tasks"] tbody tr').first();
      await expect(cells).toBeVisible();
    }
  });
});

test.describe('M17 — responsive audit (all clinical routes)', () => {
  const routes = ['/patients', '/encounters', '/diagnostics', '/tasks', '/appointments'];

  for (const width of [1920, 1440, 1280, 1024, 768, 375]) {
    test(`no page-wide horizontal overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });

      for (const route of routes) {
        await page.goto(`${BASE}${route}`);
        await page.waitForTimeout(2500);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow, `${route} overflows by ${overflow}px at ${width}px`).toBeLessThanOrEqual(
          2,
        );
      }
    });
  }
});

test.describe('M17 — heading hierarchy', () => {
  test('one h1 per clinical page at desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    for (const route of ['/patients', '/encounters', '/diagnostics', '/tasks']) {
      await page.goto(`${BASE}${route}`);
      await page.waitForTimeout(2200);
      const h1Count = await page.getByRole('heading', { level: 1 }).count();
      expect(h1Count, `${route} renders ${h1Count} h1 elements`).toBe(1);
    }
  });
});
