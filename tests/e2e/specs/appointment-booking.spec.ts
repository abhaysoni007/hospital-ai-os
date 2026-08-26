import { test, expect } from '@playwright/test';

test.describe('Appointment Booking Flow', () => {
  test('Receptionist can book a new appointment', async ({ page }) => {
    // 1. Log in as receptionist
    await page.goto('/login');
    await page.fill('input[type="email"]', 'receptionist@hospital.test');
    await page.fill('input[type="password"]', 'Test@12345678');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/.*dashboard/);

    // 2. Navigate to appointments
    await page.goto('/appointments');
    await expect(page.locator('text="Appointments"').first()).toBeVisible();

    // 3. Click 'Book appointment'
    await page.click('button:has-text("Book appointment")');
    await expect(page).toHaveURL(/.*appointments\/new/);

    // 4. Fill out the patient search
    await page.fill('#patientSearch', 'Hateem');
    // Wait for the dropdown results to appear and click the first one
    const result = page.locator('ul#booking-patient-results li button').first();
    await expect(result).toBeVisible();
    await result.click();

    // 5. Fill out the rest of the form
    // Select Department (use label or select directly if we know a value, but we can select by index)
    await page.locator('select#departmentId').selectOption({ index: 1 });
    
    // Select Physician
    await page.locator('select#doctorId').selectOption({ index: 1 });

    // Ensure Date and Time have valid inputs (defaults are usually fine but we can set them)
    await page.fill('#scheduledDate', '2026-10-15');
    await page.fill('#scheduledTime', '10:00');

    // 6. Go to Review step
    await page.click('button[type="submit"]');
    
    // Verify Review step loaded
    await expect(page.locator('text="Review before confirming"')).toBeVisible();

    // 7. Confirm booking
    await page.click('button:has-text("Confirm booking")');

    // Verify it redirects back to appointments page
    await expect(page).toHaveURL(/.*appointments/);
  });
});
