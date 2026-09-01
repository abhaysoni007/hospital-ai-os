import { test, expect, request } from '@playwright/test';

const ADMIN = { email: 'demo.admin@hospital.test', password: 'DemoAdm#2026!' };
const PHYSICIAN = { email: 'demo.physician@hospital.test', password: 'DemoPhys#2026!' };

async function resolveEncounterId(patientMrn: string): Promise<string> {
  const ctx = await request.newContext({ baseURL: 'http://localhost:3001' });
  const loginRes = await ctx.post('/api/v1/auth/login', { data: ADMIN });
  const token = (await loginRes.json()).data.accessToken as string;
  const pRes = await ctx.get(`/api/v1/patients?query=${patientMrn}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const patientId = (await pRes.json()).data[0].id as string;
  const eRes = await ctx.get(`/api/v1/encounters?patientId=${patientId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return (await eRes.json()).data[0].id as string;
}

async function getPhysicianAuthData() {
  const ctx = await request.newContext({ baseURL: 'http://localhost:3001' });
  const res = await ctx.post('/api/v1/auth/login', { data: PHYSICIAN });
  return (await res.json()).data;
}

test.beforeEach(async ({ page }) => {
  const authData = await getPhysicianAuthData();
  await page.route('**/api/v1/auth/refresh', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: authData }),
    });
  });
});

test('Break-Glass flow: Unauthorized clinician activates emergency access', async ({ page }) => {
  const encounterId = await resolveEncounterId('DEMO-2026-00006');
  await page.goto(`/encounters/${encounterId}`);
  await expect(page.getByRole('heading', { name: /Emergency Access Required/i })).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(/Restricted Access/i)).toBeVisible();
  const justificationInput = page.getByTestId('bg-justification-input');
  await justificationInput.fill('Too short');
  await page.getByTestId('bg-submit-btn').click();
  await expect(page.getByText(/Justification must be at least 20 characters/i)).toBeVisible({ timeout: 10000 });
  await justificationInput.fill('Emergency access required for patient safety due to acute condition. Need history.');
  await page.getByTestId('bg-submit-btn').click();
  await expect(page.getByRole('heading', { name: /Emergency Access Required/i })).not.toBeVisible({ timeout: 10000 });
  await expect(page.getByText(/BREAK-GLASS ACTIVE/i)).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole('heading', { name: /Carlos Santos/i })).toBeVisible({ timeout: 10000 });
});

test('Break-Glass flow: Backend rejection renders an inline error', async ({ page }) => {
  const encounterId = await resolveEncounterId('DEMO-2026-00016');
  await page.route('**/break-glass/sessions', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: { message: 'Mock backend rejection' } }),
      });
    } else {
      await route.continue();
    }
  });
  await page.goto(`/encounters/${encounterId}`);
  await expect(page.getByRole('heading', { name: /Emergency Access Required/i })).toBeVisible({ timeout: 15000 });
  const justificationInput = page.getByTestId('bg-justification-input');
  await justificationInput.fill('Emergency access required for patient safety due to acute condition.');
  await page.getByTestId('bg-submit-btn').click();
  await expect(page.getByText(/Mock backend rejection/i)).toBeVisible({ timeout: 10000 });
});

test('Break-Glass flow: Existing authorized users do not unnecessarily trigger the modal', async ({ page }) => {
  const encounterId = await resolveEncounterId('DEMO-2026-00001');
  await page.goto(`/encounters/${encounterId}`);
  await expect(page.getByRole('heading', { name: /Emergency Access Required/i })).not.toBeVisible({ timeout: 5000 });
  await expect(page.getByRole('heading', { name: /Margaret Chen/i })).toBeVisible({ timeout: 15000 });
});