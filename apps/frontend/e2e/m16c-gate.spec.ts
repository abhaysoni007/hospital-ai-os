/**
 * M16C Final Frontend Gate — Playwright checks.
 *
 * Complements dashboard-redesign-qa.spec.ts with the M16C-specific gates:
 *   - horizontal overflow audit on the dashboard + representative routes
 *   - equal-height card rows (KPI, analytics, table vs side rail)
 *   - sparkline containment inside metric tiles
 *   - mobile drawer: <main inert>, Escape close, focus restoration
 *   - prefers-reduced-motion: entrance animation / live dot disabled
 *
 * Run: npx playwright test e2e/m16c-gate.spec.ts --config playwright.config.ts
 */
import { test, expect, Page } from '@playwright/test';

const BASE = 'http://localhost:3000';
const EMAIL = 'demo.physician@hospital.test';
const PASSWORD = 'DemoPhys#2026!';

async function login(page: Page) {
  // The dev server recompiles between viewport passes and can miss the
  // first login navigation — retry once before giving up.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await page.goto(`${BASE}/login`, { timeout: 60000 });
      // The form disables its inputs while probing server health — wait
      // for the email field to be enabled before filling.
      await page.getByLabel(/email/i).waitFor({ state: 'visible', timeout: 30000 });
      await page
        .getByLabel(/email/i)
        .fill(EMAIL, { timeout: 30000 })
        .catch(() => undefined);
      await page.locator('input[type="password"]').fill(PASSWORD, { timeout: 30000 });
      await page.getByRole('button', { name: /sign in|login|submit/i }).click();
      await page.waitForURL(`${BASE}/dashboard`, { timeout: 45000 });
      await page.waitForTimeout(2000);
      return;
    } catch {
      if (attempt === 1) throw new Error('login failed after retry');
    }
  }
}

/** Geometry assertions must wait out the staggered entrance animation. */
async function settle(page: Page) {
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    // The live indicator pulses forever (iterations: Infinity) — its
    // `finished` promise never resolves, so only await finite animations.
    const finite = document
      .getAnimations()
      .filter((a) => a.effect?.getTiming().iterations !== Infinity);
    return Promise.all(finite.map((a) => a.finished.catch(() => undefined)));
  });
  await page.waitForTimeout(300);
}

test.describe('M16C — horizontal overflow audit', () => {
  for (const width of [1440, 1280, 1024, 768, 375]) {
    test(`no horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await login(page);
    for (const route of ['/dashboard', '/patients', '/encounters', '/diagnostics', '/tasks']) {
      await page.goto(`${BASE}${route}`);
      await page.waitForTimeout(2500);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow, `${route} overflows by ${overflow}px at ${width}px`).toBeLessThanOrEqual(2);
      }
    });
  }
});

test.describe('M16C — dashboard layout gates', () => {
  test('KPI cards share one row height; sparklines stay inside their tiles', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page);
    await settle(page);
    const bottoms = await page.evaluate(() =>
      [...document.querySelectorAll('[aria-label="Operational summary"] > *')].map(
        (c) => Math.round(c.getBoundingClientRect().bottom),
      ),
    );
    expect(bottoms.length).toBeGreaterThan(1);
    expect(new Set(bottoms).size, `KPI bottoms differ: ${bottoms}`).toBeLessThanOrEqual(1);

    // Sparklines must be clipped inside their card (no bleed past the border).
    const bleeds = await page.evaluate(() => {
      const out: Array<{ label: string; bleedR: number; bleedB: number }> = [];
      document
        .querySelectorAll('[aria-label="Operational summary"] [class*="trendWrap"] svg')
        .forEach((svg) => {
          const card = svg.closest('a, div[class*="card"]');
          if (!card) return;
          const cr = card.getBoundingClientRect();
          const sr = svg.getBoundingClientRect();
          const label = card.querySelector('[class*="label"]')?.textContent ?? 'unknown';
          out.push({
            label,
            bleedR: Math.max(0, Math.round(sr.right - cr.right)),
            bleedB: Math.max(0, Math.round(sr.bottom - cr.bottom)),
          });
        });
      return out;
    });
    for (const b of bleeds) {
      expect(b.bleedR, `${b.label} sparkline bleeds ${b.bleedR}px right`).toBe(0);
      expect(b.bleedB, `${b.label} sparkline bleeds ${b.bleedB}px bottom`).toBe(0);
    }
  });

  test('analytics cards align: volume vs status, table vs side rail', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page);
    await settle(page);
    const edges = await page.evaluate(() => {
      const grid = document.querySelector('[class*="analyticsGrid"]');
      if (!grid) return null;
      const children = [...grid.children];
      const vol = children[0]?.getBoundingClientRect();
      const status = children[1]?.getBoundingClientRect();
      const table = children[3]?.getBoundingClientRect();
      const railLast = children[2]?.lastElementChild?.getBoundingClientRect();
      return {
        volumeBottom: Math.round(vol?.bottom ?? 0),
        statusBottom: Math.round(status?.bottom ?? 0),
        tableBottom: Math.round(table?.bottom ?? 0),
        railLastBottom: Math.round(railLast?.bottom ?? 0),
      };
    });
    expect(edges).not.toBeNull();
    expect(edges!.statusBottom, 'status card must match volume card height').toBe(
      edges!.volumeBottom,
    );
    expect(edges!.railLastBottom, 'side rail must end with the table card').toBe(
      edges!.tableBottom,
    );
  });
});

test.describe('M16C — mobile drawer accessibility', () => {
  test('drawer sets main inert, Escape closes, focus restores', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await login(page);
    const menu = page.getByRole('button', { name: /toggle navigation drawer/i });
    await menu.click();
    await expect(page.locator('main')).toHaveAttribute('inert', '');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    await expect(page.locator('main')).not.toHaveAttribute('inert');
    await expect(menu).toBeFocused();
  });
});

test.describe('M16C — reduced motion', () => {
  test('entrance animation and live indicator are disabled', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'reducedMotion emulation is Chromium-supported');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page);
    const running = await page.evaluate(() =>
      document.getAnimations().filter((a) => a.playState === 'running').length,
    );
    expect(running, 'no CSS animations should be running under reduced motion').toBe(0);
  });
});
