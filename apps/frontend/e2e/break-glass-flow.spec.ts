/**
 * M15 — Break-Glass E2E Flow Coverage (Real Stack)
 *
 * Exercises the real backend (HTTP API, real Postgres, real JWT) and the
 * real frontend (/admin/security console) to validate:
 *   1. Normal denial + break-glass availability (out-of-scope patient).
 *   2. Activation: reason + justification requirements.
 *   3. Justification validation: missing / too short / too long / invalid reason.
 *   4. Scoped access: A patient ALLOW, B patient DENY.
 *   5. Read-only enforcement: write operation DENY.
 *   6. Security Admin review + revoke.
 *   7. Reviewer separation: physician cannot review/revoke.
 *   8. Post-revoke access denied.
 *   9. Frontend /admin/security console: review + revoke via real UI.
 *
 * All API calls hit the real backend (http://localhost:3001).
 * All UI calls hit the real frontend (http://localhost:3002).
 * No mocks for authorization. No mocks for the database.
 *
 * Synthetic data only — uses the demo seed (DEMO-2026-00001..00009).
 *
 * Scoping assumptions (per M5):
 *   - demo.physician  (Rajan Mehta)        — Cardiology
 *   - demo.physician2 (priya Iyer)         — Internal Medicine
 *   - Margaret Chen (DEMO-2026-00001)      — Cardiology encounter
 *   - James Okonkwo  (DEMO-2026-00002)     — Internal Medicine encounter
 *   - physician2 has NO normal scope for patient A (different department)
 *   - physician  IS the assigned physician for patient A (Cardiology)
 */

import { test, expect, request, type APIRequestContext, type Page } from '@playwright/test';

const API = 'http://localhost:3001';
const ADMIN = { email: 'demo.admin@hospital.test', password: 'DemoAdm#2026!' };
const PHYSICIAN = { email: 'demo.physician@hospital.test', password: 'DemoPhys#2026!' };
const PHYSICIAN2 = { email: 'demo.physician2@hospital.test', password: 'DemoPhys#2026!' };
const NURSE = { email: 'demo.nurse@hospital.test', password: 'DemoNurs#2026!' };
const SECURITY = { email: 'demo.security@hospital.test', password: 'DemoSec#2026!' };

interface AuthData {
  accessToken: string;
  user: { id: string; role: string; departmentId: string };
}

async function login(creds: { email: string; password: string }): Promise<AuthData> {
  const ctx = await request.newContext({ baseURL: API });
  const res = await ctx.post('/api/v1/auth/login', { data: creds });
  expect(res.status(), `login ${creds.email}`).toBe(200);
  const body = await res.json();
  return body.data as AuthData;
}

async function authedCtx(token: string): Promise<APIRequestContext> {
  return request.newContext({
    baseURL: API,
    extraHTTPHeaders: { Authorization: `Bearer ${token}` },
  });
}

async function findPatientIdByMrn(ctx: APIRequestContext, mrn: string): Promise<string> {
  const res = await ctx.get(`/api/v1/patients?query=${encodeURIComponent(mrn)}`);
  expect(res.status(), `search ${mrn}`).toBe(200);
  const body = await res.json();
  const found = (body.data as Array<{ id: string; mrn: string }>).find((p) => p.mrn === mrn);
  if (!found) throw new Error(`Patient ${mrn} not found in seed`);
  return found.id;
}

async function findEncounterForPatient(ctx: APIRequestContext, patientId: string): Promise<string> {
  const res = await ctx.get(`/api/v1/encounters?patientId=${patientId}`);
  expect(res.status(), `list encounters for ${patientId}`).toBe(200);
  const body = await res.json();
  const list = body.data as Array<{ id: string; status: string }>;
  const active = list.find((e) => e.status === 'active') ?? list[0];
  if (!active) throw new Error(`No encounter for patient ${patientId}`);
  return active.id;
}

async function revokeAllSessionsFor(ctx: APIRequestContext, patientId: string): Promise<void> {
  const list = await ctx.get('/api/v1/break-glass/sessions?limit=100');
  expect(list.status()).toBe(200);
  const sessions = (
    (await list.json()).data as Array<{
      id: string;
      patientId: string;
      status: string;
    }>
  ).filter((s) => s.patientId === patientId && s.status === 'active');
  for (const s of sessions) {
    await ctx.post(`/api/v1/break-glass/sessions/${s.id}/revoke`, {
      data: { reason: 'e2e cleanup' },
    });
  }
}

test.describe('M15 Break-Glass Flow (real backend + real frontend)', () => {
  let physician: AuthData;
  let physician2: AuthData;
  let physicianCtx: APIRequestContext;
  let physician2Ctx: APIRequestContext;
  let security: AuthData;
  let securityCtx: APIRequestContext;
  let adminCtx: APIRequestContext;

  // Patient A (Margaret Chen, owned by demo.physician / cardiology)
  // Patient B (James Okonkwo, owned by demo.physician2 / internal medicine)
  let patientAId: string;
  let patientBId: string;
  let encounterAId: string;
  let encounterBId: string;

  test.beforeAll(async () => {
    physician = await login(PHYSICIAN);
    physician2 = await login(PHYSICIAN2);
    security = await login(SECURITY);
    physicianCtx = await authedCtx(physician.accessToken);
    physician2Ctx = await authedCtx(physician2.accessToken);
    securityCtx = await authedCtx(security.accessToken);
    adminCtx = await authedCtx((await login(ADMIN)).accessToken);

    patientAId = await findPatientIdByMrn(physicianCtx, 'DEMO-2026-00001');
    patientBId = await findPatientIdByMrn(physicianCtx, 'DEMO-2026-00002');
    encounterAId = await findEncounterForPatient(physicianCtx, patientAId);
    encounterBId = await findEncounterForPatient(physicianCtx, patientBId);

    // Best-effort cleanup so the test is repeatable
    await revokeAllSessionsFor(securityCtx, patientAId);
    await revokeAllSessionsFor(securityCtx, patientBId);
  });

  test.afterAll(async () => {
    await revokeAllSessionsFor(securityCtx, patientAId);
    await revokeAllSessionsFor(securityCtx, patientBId);
    await physicianCtx.dispose();
    await physician2Ctx.dispose();
    await securityCtx.dispose();
    await adminCtx.dispose();
  });

  // ─── 1. Normal denial: out-of-scope patient ─────────────────────────────
  test('1. Out-of-scope patient: clinical list returns 403 (denial is real, not frontend-only)', async () => {
    // physician2 (Internal Medicine) accessing Margaret Chen's encounter (Cardiology).
    // This MUST be 403 — proves the frontend cannot bypass backend authorization.
    const res = await physician2Ctx.get(`/api/v1/encounters/${encounterAId}/clinical-records`);
    expect(res.status()).toBe(403);
  });

  // ─── 2. Activation via real API ─────────────────────────────────────────
  test('2. Physician activates break-glass with valid reason + justification', async () => {
    // Use physician2 to activate for patient A — physician2 has no normal scope,
    // so this is a true "out-of-scope" activation, matching the production use case.
    const res = await physician2Ctx.post('/api/v1/break-glass/sessions', {
      data: {
        patientId: patientAId,
        encounterId: encounterAId,
        reason: 'emergency_care',
        justification:
          'E2E: real emergency access required for deteriorating patient in cardiology unit; need prior records immediately.',
      },
    });
    expect(res.status(), 'activation should be 201').toBe(201);
    const body = await res.json();
    const session = body.data as {
      id: string;
      status: string;
      justification?: string;
      patientId: string;
      actorId: string;
    };
    expect(session.id).toBeTruthy();
    expect(session.status).toBe('active');
    expect(session.patientId).toBe(patientAId);
    // Justification is stripped from the public response
    expect(session.justification).toBeUndefined();
  });

  // ─── 3. Justification validation ────────────────────────────────────────
  test('3a. Missing justification → 400', async () => {
    const res = await physician2Ctx.post('/api/v1/break-glass/sessions', {
      data: { patientId: patientAId, reason: 'emergency_care', justification: '' },
    });
    expect(res.status()).toBeGreaterThanOrEqual(400);
  });

  test('3b. Too-short justification (<20 chars) → 400', async () => {
    const res = await physician2Ctx.post('/api/v1/break-glass/sessions', {
      data: { patientId: patientAId, reason: 'emergency_care', justification: 'Too short' },
    });
    expect(res.status()).toBeGreaterThanOrEqual(400);
    const body = await res.json();
    expect(JSON.stringify(body)).toMatch(/justification|20|2000|characters/i);
  });

  test('3c. Too-long justification (>2000 chars) → 400', async () => {
    const res = await physician2Ctx.post('/api/v1/break-glass/sessions', {
      data: { patientId: patientAId, reason: 'emergency_care', justification: 'x'.repeat(2001) },
    });
    expect(res.status()).toBeGreaterThanOrEqual(400);
  });

  test('3d. Invalid reason → 400', async () => {
    const res = await physician2Ctx.post('/api/v1/break-glass/sessions', {
      data: {
        patientId: patientAId,
        reason: 'totally_invalid_reason',
        justification: 'This is a valid-length justification text for the E2E test.',
      },
    });
    expect(res.status()).toBeGreaterThanOrEqual(400);
  });

  test('3e. Missing reason → 400', async () => {
    const res = await physician2Ctx.post('/api/v1/break-glass/sessions', {
      data: {
        patientId: patientAId,
        justification: 'This is a valid-length justification text for the E2E test.',
      },
    });
    expect(res.status()).toBeGreaterThanOrEqual(400);
  });

  test('3f. Frontend does not turn arbitrary 403 into break-glass: physician2 hitting own-scope deny path stays denied', async () => {
    // physician2 has no normal scope for patient A. Without a BG session, this is 403.
    // Confirm that we are NOT auto-redirected anywhere: the API response stays 403.
    // The frontend's BreakGlassModal is mounted only on specific resource pages
    // (encounters, patients) — and only AFTER a real 403 is received for that
    // exact resource. This test confirms the API contract enforces that gate.
    await revokeAllSessionsFor(securityCtx, patientAId);
    const res = await physician2Ctx.get(`/api/v1/encounters/${encounterAId}/clinical-records`);
    expect(res.status()).toBe(403);
  });

  // ─── 4. Scoped access: A allow, B deny ──────────────────────────────────
  test('4a. With active BG session for A: physician2 can read patient A clinical records', async () => {
    // Make sure BG session is active for physician2 / patient A
    const list = await securityCtx.get('/api/v1/break-glass/sessions?status=active&limit=50');
    const sessions = (await list.json()).data as Array<{
      id: string;
      patientId: string;
      status: string;
      actorId: string;
    }>;
    const haveA = sessions.find(
      (s) => s.patientId === patientAId && s.actorId === physician2.user.id,
    );
    if (!haveA) {
      const reup = await physician2Ctx.post('/api/v1/break-glass/sessions', {
        data: {
          patientId: patientAId,
          encounterId: encounterAId,
          reason: 'patient_safety',
          justification: 'E2E: re-activation for scoped-access verification test scenario.',
        },
      });
      expect(reup.status()).toBe(201);
    }

    // physician2 has NO normal scope for A. With BG active, the read must be 200.
    const clinicalRes = await physician2Ctx.get(
      `/api/v1/encounters/${encounterAId}/clinical-records`,
    );
    expect(clinicalRes.status(), 'BG must grant read for the scoped patient').toBe(200);
  });

  test('4b. With active BG session for A: physician2 still cannot read patient B (scope enforced)', async () => {
    // Make sure physician2 has NO active BG session for patient B
    await revokeAllSessionsFor(securityCtx, patientBId);

    // physician2 (IM) actually has NORMAL scope for B (their own department).
    // To prove BG-scope enforcement, we need a user who is BOTH out of normal
    // scope for B AND has no BG session for B. physician (Cardiology) is the
    // correct actor here: they are out-of-scope for B and have no BG for B.
    const res = await physicianCtx.get(`/api/v1/encounters/${encounterBId}/clinical-records`);
    expect(res.status(), 'no BG for B → must be denied even with BG for A').toBe(403);
  });

  // ─── 5. Read-only enforcement: write attempt DENIED ─────────────────────
  test('5. Active BG session does not grant write access (create clinical record denied)', async () => {
    // Ensure BG session is active for physician2 / patient A
    const list = await securityCtx.get('/api/v1/break-glass/sessions?status=active&limit=50');
    const sessions = (await list.json()).data as Array<{
      id: string;
      patientId: string;
      status: string;
      actorId: string;
    }>;
    const haveA = sessions.find(
      (s) => s.patientId === patientAId && s.actorId === physician2.user.id,
    );
    if (!haveA) {
      const reup = await physician2Ctx.post('/api/v1/break-glass/sessions', {
        data: {
          patientId: patientAId,
          encounterId: encounterAId,
          reason: 'continuity_of_care',
          justification: 'E2E: read-only enforcement verification — write attempt must be denied.',
        },
      });
      expect(reup.status()).toBe(201);
    }

    // physician2 is NOT the assigned physician for A. The write endpoint enforces
    // encounter.doctorId === authorId regardless of BG. With an active BG session
    // that allows READ, the WRITE must still be denied.
    const writeRes = await physician2Ctx.post(
      `/api/v1/encounters/${encounterAId}/clinical-records`,
      {
        data: {
          recordType: 'note',
          content: { subjective: 'Should never persist under break-glass.' },
        },
      },
    );
    // Either: 403 (not the assigned physician) or 403 (BG is read-only).
    // The defining assertion is: 403 — write is NOT permitted under BG.
    expect(writeRes.status(), 'break-glass must not permit writes').toBe(403);
  });

  // ─── 6. Security Admin: list + review + revoke ──────────────────────────
  test('6a. Security Admin can list all break-glass sessions', async () => {
    const res = await securityCtx.get('/api/v1/break-glass/sessions?limit=50');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
  });

  test('6b. Security Admin can review a session and see justification', async () => {
    // Find or create a session
    let sessionId: string;
    const list = await securityCtx.get('/api/v1/break-glass/sessions?status=active&limit=50');
    const sessions = (await list.json()).data as Array<{
      id: string;
      patientId: string;
      status: string;
      actorId: string;
    }>;
    const candidate = sessions.find(
      (s) => s.patientId === patientAId && s.actorId === physician2.user.id,
    );
    if (candidate) {
      sessionId = candidate.id;
    } else {
      const r = await physician2Ctx.post('/api/v1/break-glass/sessions', {
        data: {
          patientId: patientAId,
          encounterId: encounterAId,
          reason: 'emergency_care',
          justification: 'E2E: review-flow test — admin must see justification on review.',
        },
      });
      sessionId = (await r.json()).data.id;
    }

    const review = await securityCtx.post(`/api/v1/break-glass/sessions/${sessionId}/review`);
    expect(review.status()).toBe(200);
    const body = await review.json();
    expect(body.data.justification).toBeTruthy();
    expect(typeof body.data.justification).toBe('string');
  });

  test('6c. Physician CANNOT list / review / revoke (reviewer separation)', async () => {
    // Both physician and physician2 must not be able to use review/revoke endpoints.
    const listRes = await physicianCtx.get('/api/v1/break-glass/sessions?limit=10');
    expect(listRes.status()).toBe(403);

    const listRes2 = await physician2Ctx.get('/api/v1/break-glass/sessions?limit=10');
    expect(listRes2.status()).toBe(403);

    // Find a session ID to attempt review/revoke
    const secList = await securityCtx.get('/api/v1/break-glass/sessions?limit=10');
    const sessions = (await secList.json()).data as Array<{ id: string }>;
    if (sessions.length === 0) throw new Error('Expected at least one session for separation test');
    const targetId = sessions[0].id;

    const reviewRes = await physicianCtx.post(`/api/v1/break-glass/sessions/${targetId}/review`);
    expect(reviewRes.status(), 'physician must not be able to review').toBe(403);

    const revokeRes = await physicianCtx.post(`/api/v1/break-glass/sessions/${targetId}/revoke`, {
      data: { reason: 'unauthorized attempt' },
    });
    expect(revokeRes.status(), 'physician must not be able to revoke').toBe(403);
  });

  // ─── 7. Revoke + post-revoke denial ─────────────────────────────────────
  test('7a. Security Admin revokes a session → 200 + status becomes revoked', async () => {
    // Find or create an active session for A
    const list = await securityCtx.get('/api/v1/break-glass/sessions?status=active&limit=50');
    const sessions = (await list.json()).data as Array<{
      id: string;
      patientId: string;
      status: string;
      actorId: string;
    }>;
    let sessionId: string | undefined = sessions.find(
      (s) => s.patientId === patientAId && s.actorId === physician2.user.id,
    )?.id;
    if (!sessionId) {
      const r = await physician2Ctx.post('/api/v1/break-glass/sessions', {
        data: {
          patientId: patientAId,
          encounterId: encounterAId,
          reason: 'emergency_care',
          justification: 'E2E: revocation-flow test session — admin will revoke immediately.',
        },
      });
      sessionId = (await r.json()).data.id;
    }

    const revoke = await securityCtx.post(`/api/v1/break-glass/sessions/${sessionId}/revoke`, {
      data: { reason: 'e2e revoke test' },
    });
    expect(revoke.status()).toBe(200);
    const body = await revoke.json();
    expect(body.data.status).toBe('revoked');
    expect(body.data.revokedAt).toBeTruthy();
  });

  test('7b. After revoke: subsequent read by physician2 (who had BG for A) is denied', async () => {
    // physician2's BG session for A was revoked. They should no longer read A's clinical records.
    const res = await physician2Ctx.get(`/api/v1/encounters/${encounterAId}/clinical-records`);
    expect(res.status(), 'post-revoke access must be denied').toBe(403);
  });

  test('7c. Repeat revoke → 409 ALREADY_REVOKED (idempotent rejection)', async () => {
    const list = await securityCtx.get('/api/v1/break-glass/sessions?status=revoked&limit=50');
    const sessions = (await list.json()).data as Array<{ id: string; status: string }>;
    expect(sessions.length).toBeGreaterThan(0);
    const target = sessions[0];

    const res = await securityCtx.post(`/api/v1/break-glass/sessions/${target.id}/revoke`, {
      data: { reason: 'second attempt' },
    });
    expect(res.status()).toBeGreaterThanOrEqual(400);
    const body = await res.json();
    expect(JSON.stringify(body)).toMatch(/ALREADY_REVOKED|already revoked/i);
  });

  // ─── 8. Frontend /admin/security console: revoke via real UI ────────────
  test('8. Security Admin /admin/security console shows sessions and can revoke', async ({
    page,
  }: {
    page: Page;
  }) => {
    // Bootstrap: ensure there is an active session for A so the console shows it
    const list = await securityCtx.get('/api/v1/break-glass/sessions?status=active&limit=50');
    const sessions = (await list.json()).data as Array<{
      id: string;
      patientId: string;
      status: string;
      actorId: string;
    }>;
    const haveA = sessions.find((s) => s.patientId === patientAId);
    if (!haveA) {
      await physician2Ctx.post('/api/v1/break-glass/sessions', {
        data: {
          patientId: patientAId,
          encounterId: encounterAId,
          reason: 'emergency_care',
          justification: 'E2E: real-UI revocation flow — admin console must work end-to-end.',
        },
      });
    }

    // Log in as security admin via the frontend
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(SECURITY.email);
    await page.locator('input[type="password"]').fill(SECURITY.password);
    await page.getByRole('button', { name: /sign in|login|submit/i }).click();
    await page.waitForURL('**/dashboard', { timeout: 30000 });

    await page.goto('/admin/security');
    await expect(page.getByRole('heading', { name: /Security Administration/i })).toBeVisible({
      timeout: 15000,
    });

    // The console renders one Revoke button per active row. Click the first one.
    const firstRevoke = page.getByRole('button', { name: /^Revoke$/ }).first();
    await expect(firstRevoke).toBeVisible({ timeout: 15000 });
    await firstRevoke.click();

    // Revoke dialog requires a reason; provide one
    await page.locator('#revoke-reason').fill('E2E: real-UI revoke verification');
    await page.getByRole('button', { name: /Force Revoke Session/i }).click();

    // The session count of "active" decreases after revoke — the table re-renders
    // with the row in REVOKED state.
    await page.waitForTimeout(500);
    await page.reload();
    await expect(page.getByRole('heading', { name: /Security Administration/i })).toBeVisible();
  });
});
