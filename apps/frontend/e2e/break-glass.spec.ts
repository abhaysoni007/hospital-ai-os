import { test, expect, request } from '@playwright/test';

// ─── Flow: Break-Glass Activation ──────────────────────────────────────────
test('Break-Glass flow: Unauthorized clinician activates emergency access', async ({ page }) => {
  // 1. Get the encounter ID for James Okonkwo (out-of-scope for demo.physician)
  // We need hospital_admin to fetch the encounter ID since it's filtered for others.
  const apiContext = await request.newContext({ baseURL: 'http://localhost:3001' });
  const loginRes = await apiContext.post('/api/v1/auth/login', {
    data: { email: 'demo.admin@hospital.test', password: 'DemoAdm#2026!' },
  });
  expect(loginRes.ok()).toBeTruthy();

  // Extract access token for admin
  const loginData = await loginRes.json();
  const token = loginData.data.accessToken;

  // Get patients to find James Okonkwo (DEMO-2026-00002)
  const patientsRes = await apiContext.get('/api/v1/patients?query=DEMO-2026-00002', { headers: { Authorization: `Bearer ${token}` } });
  const patientsData = await patientsRes.json();
  const jamesId = patientsData.data[0].id;

  // Get encounter for James Okonkwo
  const encountersRes = await apiContext.get(`/api/v1/encounters?patientId=${jamesId}`, { headers: { Authorization: `Bearer ${token}` } });
  const encountersData = await encountersRes.json();
  const targetEncounterId = encountersData.data[0].id;

  // 2. demo.physician (who is already logged in via global-setup) navigates to the out-of-scope encounter directly
  await page.goto(`/encounters/${targetEncounterId}`);

  // 3. Unauthorized chart access displays Break-Glass option
  await expect(page.getByRole('heading', { name: /Emergency Access Required/i })).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(/Restricted Access/i)).toBeVisible();

  // 4. User cannot activate without required justification
  const submitBtn = page.getByTestId('bg-submit-btn');
  const justificationInput = page.getByTestId('bg-justification-input');

  await justificationInput.fill('Too short');
  await submitBtn.click();
  // Wait for the custom inline error banner in the modal
  await expect(page.getByText(/Justification must be at least 20 characters/i)).toBeVisible();

  // 5. Activation submits the correct backend payload and successful activation updates UI state
  await justificationInput.fill('Emergency access required for patient safety due to acute condition. Need history.');
  await submitBtn.click();

  // 6. Active Break-Glass state displays correctly (Banner appears, page content loads)
  await expect(page.getByRole('heading', { name: /Emergency Access Required/i })).not.toBeVisible({ timeout: 10000 });
  
  // Verify banner
  await expect(page.getByText(/BREAK-GLASS ACTIVE/i)).toBeVisible({ timeout: 10000 });
  
  // Verify the patient/chart becomes accessible (shows patient name)
  await expect(page.getByRole('heading', { name: /James Okonkwo/i })).toBeVisible({ timeout: 10000 });
});

test('Break-Glass flow: Backend rejection renders an inline error', async ({ page }) => {
  const apiContext = await request.newContext({ baseURL: 'http://localhost:3001' });
  const loginRes = await apiContext.post('/api/v1/auth/login', {
    data: { email: 'demo.admin@hospital.test', password: 'DemoAdm#2026!' },
  });
  const loginData = await loginRes.json();
  const token = loginData.data.accessToken;
  const patientsRes = await apiContext.get('/api/v1/patients?query=DEMO-2026-00002', { headers: { Authorization: `Bearer ${token}` } });
  const patientsData = await patientsRes.json();
  const jamesId = patientsData.data[0].id;

  const encountersRes = await apiContext.get(`/api/v1/encounters?patientId=${jamesId}`, { headers: { Authorization: `Bearer ${token}` } });
  const encountersData = await encountersRes.json();
  const targetEncounterId = encountersData.data[0].id;

  // Intercept the Break-Glass POST request and mock a 500 error
  await page.route('**/break-glass/sessions', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: { message: 'Mock backend rejection' } }),
      });
    } else {
      route.continue();
    }
  });

  await page.goto(`/encounters/${targetEncounterId}`);

  await expect(page.getByRole('heading', { name: /Emergency Access Required/i })).toBeVisible({ timeout: 15000 });
  
  const submitBtn = page.getByTestId('bg-submit-btn');
  const justificationInput = page.getByTestId('bg-justification-input');

  await justificationInput.fill('Emergency access required for patient safety due to acute condition.');
  await submitBtn.click();

  // 4. Backend rejection renders an inline error
  await expect(page.getByText(/Mock backend rejection/i)).toBeVisible();
});

test('Break-Glass flow: Existing authorized users do not unnecessarily trigger the modal', async ({ page }) => {
  await page.goto('/encounters');
  await page.getByText('Margaret Chen').first().click();
  await page.waitForURL('**/encounters/**');

  // Modal should NOT be visible
  await expect(page.getByRole('heading', { name: /Emergency Access Required/i })).not.toBeVisible();
  
  // Content should load directly
  await expect(page.getByRole('heading', { name: /Clinical Timeline/i })).toBeVisible({ timeout: 15000 });
});
