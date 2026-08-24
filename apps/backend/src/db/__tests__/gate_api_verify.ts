/**
 * M6/M17 FINAL ACCEPTANCE GATE — Live API verification
 * Run: pnpm --filter backend exec tsx src/db/__tests__/gate_api_verify.ts
 * Requires the backend dev server on :3001 and the seeded gate staff accounts.
 */
import { db } from '../index';
import { sql } from 'drizzle-orm';

const BASE = 'http://localhost:3001/api/v1';
const YEAR = new Date().getUTCFullYear();
const RUN = Math.floor(Math.random() * 900000) + 100000; // unique per run

let passed = 0;
let failed = 0;

function pass(name: string, detail = '') {
  passed++;
  console.log(`  PASS ${name}${detail ? ` — ${detail}` : ''}`);
}
function fail(name: string, detail = '') {
  failed++;
  console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`);
}
function check(condition: boolean, name: string, detail = '') {
  if (condition) {
    pass(name, detail);
  } else {
    fail(name, detail);
  }
}

interface ApiResult {
  status: number;
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  json: Record<string, any>;
}

async function login(email: string, password: string): Promise<{ token?: string; status: number }> {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) return { status: res.status };
  const body = (await res.json()) as { data?: { accessToken?: string } };
  return { token: body.data?.accessToken, status: res.status };
}

async function api(
  method: string,
  path: string,
  token?: string,
  body?: unknown,
): Promise<ApiResult> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'x-correlation-id': crypto.randomUUID(),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json: Record<string, any> = {}; // eslint-disable-line @typescript-eslint/no-explicit-any
  try {
    json = await res.json();
  } catch {
    // no body
  }
  return { status: res.status, json };
}

async function main() {
  console.log('='.repeat(60));
  console.log('M6/M17 ACCEPTANCE GATE — LIVE API TESTS');
  console.log('='.repeat(60));

  // ── Auth ──────────────────────────────────────────────────────────────
  console.log('\n[A] Authentication');
  const bad = await login('gate.receptionist@test.hospital', 'WrongPassword1!');
  check(bad.status === 401, 'Invalid credentials rejected', `status=${bad.status}`);

  const noToken = await api('GET', '/patients');
  check(noToken.status === 401, 'Unauthenticated request -> 401');

  const rec = await login('gate.receptionist@test.hospital', 'GatePass123!');
  const phy = await login('phase4.verify@test.hospital', 'TestPass123!');
  const sec = await login('gate.secadmin@test.hospital', 'GatePass123!');
  check(
    Boolean(rec.token && phy.token && sec.token),
    'Logins OK (receptionist, physician, security_admin)',
    `${rec.status}/${phy.status}/${sec.status}`,
  );

  // ── RBAC ──────────────────────────────────────────────────────────────
  console.log('\n[B] RBAC enforcement (backend authoritative)');
  const created = await api('POST', '/patients', rec.token, {
    firstName: `GF${RUN}`,
    lastName: 'GateLast',
    dateOfBirth: '1995-05-15',
    gender: 'female',
    phonePrimary: `97${RUN}01`,
  });
  check(created.status === 201, 'receptionist create patient -> 201', JSON.stringify(created.json));
  const patientId: string | undefined = created.json?.data?.id;
  const mrn: string = created.json?.data?.mrn ?? '';
  check(
    /^MRN-\d{4}-\d{5,}$/.test(mrn) && mrn.startsWith(`MRN-${YEAR}-`),
    'MRN format MRN-YYYY-NNNNN',
    mrn,
  );

  const phyCreate = await api('POST', '/patients', phy.token, {
    firstName: 'Nope',
    lastName: 'Denied',
    dateOfBirth: '1990-01-01',
    gender: 'male',
    phonePrimary: `97${RUN}02`,
  });
  check(phyCreate.status === 403, 'physician create patient -> 403');

  const secRead = await api('GET', '/patients', sec.token);
  check(secRead.status === 403, 'security_admin read patients -> 403');

  // ── Validation & conflict ─────────────────────────────────────────────
  console.log('\n[C] Validation and conflict handling');
  const invalid = await api('POST', '/patients', rec.token, { lastName: 'NoFirstName' });
  check(invalid.status === 400, 'validation error -> 400');

  const dup = await api('POST', '/patients', rec.token, {
    firstName: `ON${RUN}`,
    lastName: 'Different',
    dateOfBirth: '1988-08-08',
    gender: 'male',
    phonePrimary: `97${RUN}01`,
  });
  check(dup.status === 409, 'duplicate phone -> 409 conflict', `status=${dup.status}`);

  // ── Read / update / identity ─────────────────────────────────────────
  console.log('\n[D] Read, update, identity lifecycle');
  const got = await api('GET', `/patients/${patientId}`, rec.token);
  check(got.status === 200 && got.json?.data?.mrn === mrn, 'GET /patients/:id returns backend MRN');

  const patched = await api('PATCH', `/patients/${patientId}`, rec.token, {
    addressCity: 'Gate City',
  });
  check(
    patched.status === 200 && patched.json?.data?.addressCity === 'Gate City',
    'PATCH /patients/:id (patient:update)',
  );
  const patchPhy = await api('PATCH', `/patients/${patientId}`, phy.token, {
    addressCity: 'Denied',
  });
  check(patchPhy.status === 403, 'physician PATCH -> 403');

  const ident = await api('POST', `/patients/${patientId}/identities`, rec.token, {
    documentType: 'aadhaar',
    documentNumber: `XXXX-AAAA-${RUN}`,
  });
  check(ident.status === 201, 'identity upload (metadata) -> 201');
  const identityId: string | undefined = ident.json?.data?.id;
  check(
    !JSON.stringify(ident.json).includes(`XXXX-AAAA-${RUN}`),
    'document number NOT exposed in response',
  );

  const phyVerify = await api(
    'PATCH',
    `/patients/${patientId}/identities/${identityId}`,
    phy.token,
    {
      decision: 'verified',
    },
  );
  check(phyVerify.status === 403, 'physician verify identity -> 403 (patient:verify_identity)');

  const verified = await api(
    'PATCH',
    `/patients/${patientId}/identities/${identityId}`,
    rec.token,
    {
      decision: 'verified',
    },
  );
  check(
    verified.status === 200 && verified.json?.data?.verificationStatus === 'verified',
    'receptionist verifies identity -> 200',
  );
  const reVerify = await api(
    'PATCH',
    `/patients/${patientId}/identities/${identityId}`,
    rec.token,
    {
      decision: 'rejected',
    },
  );
  check(reVerify.status === 409, 're-verification of resolved identity -> 409');

  // ── Search ────────────────────────────────────────────────────────────
  console.log('\n[E] Patient search (pg_trgm, pagination, injection)');
  for (let i = 0; i < 8; i++) {
    await api('POST', '/patients', rec.token, {
      firstName: `Searchable${RUN}_${i}`,
      lastName: 'Triggam',
      dateOfBirth: '1992-02-02',
      gender: 'other',
      phonePrimary: `978${RUN}${i}`,
    });
  }
  const exact = await api(
    'GET',
    `/patients?query=${encodeURIComponent(`Searchable${RUN}_1 Triggam`)}&page=1&pageSize=50`,
    rec.token,
  );
  check(
    (exact.json?.meta?.total ?? 0) >= 1,
    'exact name search',
    `total=${exact.json?.meta?.total}`,
  );

  const fuzzy = await api(
    'GET',
    `/patients?query=${encodeURIComponent(`Searchble${RUN} Trigam`)}&page=1&pageSize=50`,
    rec.token,
  ); // typos on purpose
  check(
    (fuzzy.json?.meta?.total ?? 0) >= 1,
    'fuzzy (pg_trgm) search matches typos',
    `total=${fuzzy.json?.meta?.total}`,
  );

  const paged = await api('GET', '/patients?page=1&pageSize=3', rec.token);
  check(
    Array.isArray(paged.json?.data) &&
      paged.json.data.length === 3 &&
      paged.json?.meta?.totalPages >= 1,
    'pagination works',
    `page1 size=${paged.json?.data?.length} totalPages=${paged.json?.meta?.totalPages}`,
  );

  const injection = await api(
    'GET',
    `/patients?query=${encodeURIComponent("'; DROP TABLE patients; --")}`,
    rec.token,
  );
  check(injection.status === 200, 'SQL injection attempt safely handled -> 200');
  const patientsCount = await api('GET', '/patients?pageSize=1', rec.token);
  check(
    (patientsCount.json?.meta?.total ?? 0) > 0,
    'patients table intact after injection attempt',
  );

  // ── Concurrency via API ───────────────────────────────────────────────
  console.log('\n[F] Concurrent registration blast (20 parallel HTTP requests)');
  const concStart = Date.now();
  const results = await Promise.all(
    Array.from({ length: 20 }, (_, i) =>
      api('POST', '/patients', rec.token, {
        firstName: `Blast${RUN}_${i}`,
        lastName: `Concurrent${RUN}`,
        dateOfBirth: '1991-03-03',
        gender: i % 2 ? 'female' : 'male',
        phonePrimary: `979${RUN}${i}`,
      }),
    ),
  );
  const elapsed = Date.now() - concStart;
  const ok = results.filter((r) => r.status === 201);
  const mrns = ok.map((r) => r.json.data.mrn as string);
  const unique = new Set(mrns);
  const allFormat = mrns.every((m) => new RegExp(`^MRN-${YEAR}-\\d{5,}$`).test(m));
  check(ok.length === 20, '20/20 registrations succeeded', `${elapsed}ms`);
  check(unique.size === 20, '20 distinct MRNs — zero duplicates', `${unique.size}/20`);
  check(allFormat, 'all MRNs valid MRN-YYYY-NNNNN format');
  console.log(`    MRNs: ${mrns.sort().join(', ')}`);

  // ── Audit principal ───────────────────────────────────────────────────
  console.log('\n[G] Audit principal truthfulness (DB inspection)');
  const latestReg = (await db.execute(
    sql`SELECT actor_id, actor_role, actor_department, correlation_id, target_id FROM audit_events WHERE event_type='PATIENT_REGISTERED' ORDER BY sequence_number DESC LIMIT 1`,
  )) as unknown as Array<Record<string, unknown>>;
  const row = latestReg[0];
  const staffRows = (await db.execute(
    sql`SELECT id, role, department_id FROM staff WHERE email='gate.receptionist@test.hospital'`,
  )) as unknown as Array<{ id: string; role: string; department_id: string }>;
  const staff0 = staffRows[0];
  const auditOk =
    row &&
    row.actor_id === staff0.id &&
    row.actor_role === staff0.role &&
    row.actor_department === staff0.department_id &&
    typeof row.correlation_id === 'string' &&
    Boolean(row.target_id);
  check(
    Boolean(auditOk),
    'audit has real staffId, canonical role, departmentId, correlationId, targetId',
    `role=${String(row?.actor_role)}`,
  );
  const fabricated = (await db.execute(
    sql`SELECT count(*)::int AS c FROM audit_events WHERE actor_role IN ('SYSTEM_USER','ADMISSIONS','SYSTEM','system_user')`,
  )) as unknown as Array<{ c: number }>;
  check(
    fabricated[0].c === 0,
    'zero fabricated SYSTEM_USER/ADMISSIONS actors across entire audit log',
  );

  // ── Summary ───────────────────────────────────────────────────────────
  console.log(`\n${'='.repeat(60)}`);
  console.log(`RESULT: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(60));
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
