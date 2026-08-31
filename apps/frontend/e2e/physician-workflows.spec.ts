/**
 * Physician Workflows E2E
 */
import { test, expect } from '@playwright/test';

test.describe('Physician Diagnostics Workflow', () => {
  test('Flow: Physician can order and cancel a diagnostic', async ({ page }) => {
    // 1. Login is handled by global-setup (demo.physician)
    
    // 2. Go to active encounter
    await page.goto('/encounters');
    await page.getByText('Margaret Chen').first().click();
    await page.waitForURL('**/encounters/**');

    // 3. Order Diagnostic
    await page.getByRole('button', { name: /Order diagnostic/i }).click();
    await page.waitForURL('**/diagnostics/new');

    // Fill form
    await page.getByLabel('Test code').fill('TEST-123');
    await page.getByLabel('Test name').fill('Automated Test Panel');
    await page.getByLabel('Routine').check(); // Priority
    await page.getByRole('button', { name: 'Place Order' }).click();

    // 4. Return to encounter page
    await page.waitForURL('**/encounters/**');
    await expect(page.getByText('Automated Test Panel').first()).toBeVisible({ timeout: 15000 });

    // 5. Cancel the order
    const orderRow = page.locator('li').filter({ hasText: 'Automated Test Panel' }).first();
    await orderRow.getByRole('button', { name: 'Cancel' }).click();

    // Dialog pops up
    await expect(page.getByRole('dialog', { name: /Cancel diagnostic order/i })).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel order' }).click();

    // Expect status to change to Cancelled
    await expect(orderRow.getByText('Cancelled')).toBeVisible({ timeout: 15000 });
  });
});

