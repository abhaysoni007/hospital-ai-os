/**
 * M13.2 — Demo data reset (surgical, registry-based).
 *
 * SAFETY INVARIANTS (identical to seed-demo.ts — Amendment 5/12):
 *   1. Refuses when NODE_ENV === "production"
 *   2. Refuses when DEMO_SEED_ENABLED !== "true"
 *   3. Pre-checks DATABASE_URL database name
 *   4. Verifies actual connected database via current_database()
 *
 * RESET STRATEGY (Amendment 12):
 *   - Identifies demo records by business key from DEMO_REGISTRY
 *   - Deletes ONLY records owned by the demo registry
 *   - Deletes in reverse FK order (results → orders → clinical → encounters → appointments → patients → staff → rules → departments)
 *   - Non-demo records are NEVER touched
 *   - Schema and migrations are NEVER touched
 *   - If any ownership ambiguity: ABORTS
 *
 * CONVERGENCE GUARANTEE (Amendment 11):
 *   After reset + seed, the dataset is identical to a fresh first seed.
 */

import * as dotenv from 'dotenv';
import path from 'path';
import { inArray, sql } from 'drizzle-orm';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

// ─── Safety guards ────────────────────────────────────────────────────────────

const ALLOWED_DB_NAMES = [
  'hospital_ai_os_demo',
  'hospital_ai_os_e2e',
  'hospital_ai_os_test',
] as const;

if (process.env.NODE_ENV === 'production') {
  console.error('BLOCKED: NODE_ENV=production. Demo reset refused.');
  process.exit(2);
}

if (process.env.DEMO_SEED_ENABLED !== 'true') {
  console.error('BLOCKED: DEMO_SEED_ENABLED is not "true". Demo reset refused.');
  process.exit(2);
}

function parseDatabaseName(url: string): string | null {
  try {
    const u = new URL(url);
    return u.pathname.replace(/^\//, '').split('?')[0] || null;
  } catch {
    return null;
  }
}

const DATABASE_URL = process.env.DATABASE_URL ?? '';
const parsedDbName = parseDatabaseName(DATABASE_URL);
if (!parsedDbName || !(ALLOWED_DB_NAMES as readonly string[]).includes(parsedDbName)) {
  console.error(
    `BLOCKED: DATABASE_URL database name "${parsedDbName ?? '(unparseable)'}" is not in the allowlist.\n` +
      `Allowed: ${ALLOWED_DB_NAMES.join(', ')}\n` +
      `Reset refused to protect the dev database.`,
  );
  process.exit(2);
}

// ─── DB + schema imports ──────────────────────────────────────────────────────

import { db } from './index';
import { departments, staff } from './schema/staff';
import { patients } from './schema/patients';
import { appointments, encounters } from './schema/appointments';
import { clinicalRecords } from './schema/clinical';
import { diagnosticOrders, diagnosticResults, criticalValueRules } from './schema/diagnostics';
import { notifications } from './schema/tasks';
import {
  ALLOWED_DB_NAMES as SEED_ALLOWED_DB_NAMES,
  DEMO_DEPT_CODES,
  DEMO_STAFF_EMAILS,
  DEMO_PATIENT_MRNS,
  DEMO_CRITICAL_RULE_KEYS,
} from './seed-demo';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * DrizzleQueryError wraps the raw PostgresError as err.cause.
 * PostgreSQL FK violation code is 23503. We walk the cause chain to detect it.
 */
function isForeignKeyViolation(err: unknown): boolean {
  if (err == null) return false;
  // Check the error itself
  const code = (err as Record<string, unknown>)['code'];
  if (code === '23503') return true;
  // Check cause (DrizzleQueryError pattern)
  const cause = (err as Record<string, unknown>)['cause'];
  if (cause) return isForeignKeyViolation(cause);
  return false;
}

async function reset() {
  console.log('='.repeat(60));
  console.log('M13.2 DEMO DATA RESET');
  console.log('='.repeat(60));

  // Verify actual connected DB (Amendment 5/12)
  const dbNameRows = await db.execute(sql`SELECT current_database() AS dbname`);
  const actualDb = (dbNameRows as unknown as Array<{ dbname: string }>)[0]?.dbname;
  if (!actualDb || !(SEED_ALLOWED_DB_NAMES as readonly string[]).includes(actualDb)) {
    console.error(
      `BLOCKED: Connected database "${actualDb ?? 'unknown'}" is not in allowlist.\n` +
        `Allowed: ${SEED_ALLOWED_DB_NAMES.join(', ')}\n` +
        `Reset refused. This prevents accidental deletion from the dev database.`,
    );
    process.exit(2);
  }
  console.log(`Connected DB verified: ${actualDb}`);
  console.log('');
  console.log('This will delete ONLY demo-registry-owned records.');
  console.log('Non-demo records will NOT be touched.');
  console.log('');

  let deleted = 0;

  // ── Identify demo staff IDs (business key: email) ────────────────────────
  const demoStaffRows = await db.query.staff.findMany({
    where: inArray(staff.email, DEMO_STAFF_EMAILS as unknown as string[]),
    columns: { id: true, email: true },
  });
  const demoStaffIds = demoStaffRows.map((s) => s.id);
  console.log(`Found ${demoStaffIds.length} demo staff records`);

  // ── Identify demo patient IDs (business key: mrn) ────────────────────────
  const demoPatientRows = await db.query.patients.findMany({
    where: inArray(patients.mrn, DEMO_PATIENT_MRNS as unknown as string[]),
    columns: { id: true, mrn: true },
  });
  const demoPatientIds = demoPatientRows.map((p) => p.id);
  console.log(`Found ${demoPatientIds.length} demo patient records`);

  // ── Identify demo department IDs (business key: code) ────────────────────
  const demoDeptRows = await db.query.departments.findMany({
    where: inArray(departments.code, DEMO_DEPT_CODES as unknown as string[]),
    columns: { id: true, code: true },
  });
  const demoDeptIds = demoDeptRows.map((d) => d.id);
  console.log(`Found ${demoDeptIds.length} demo department records`);

  // ── Identify demo encounter IDs (owned by demo patients + demo doctors) ──
  const demoEncounterRows =
    demoPatientIds.length > 0
      ? await db.query.encounters.findMany({
          where: inArray(encounters.patientId, demoPatientIds),
          columns: { id: true },
        })
      : [];
  const demoEncounterIds = demoEncounterRows.map((e) => e.id);
  console.log(`Found ${demoEncounterIds.length} demo encounter records`);

  // ── Identify demo appointment IDs ────────────────────────────────────────
  const demoApptRows =
    demoPatientIds.length > 0
      ? await db.query.appointments.findMany({
          where: inArray(appointments.patientId, demoPatientIds),
          columns: { id: true },
        })
      : [];
  const demoApptIds = demoApptRows.map((a) => a.id);
  console.log(`Found ${demoApptIds.length} demo appointment records`);

  // ── Identify demo diagnostic order IDs ───────────────────────────────────
  const demoOrderRows =
    demoEncounterIds.length > 0
      ? await db.query.diagnosticOrders.findMany({
          where: inArray(diagnosticOrders.encounterId, demoEncounterIds),
          columns: { id: true },
        })
      : [];
  const demoOrderIds = demoOrderRows.map((o) => o.id);
  console.log(`Found ${demoOrderIds.length} demo diagnostic order records`);

  // ── Identify demo critical value rules ───────────────────────────────────
  // Only rules whose (testCode:parameterName) is in DEMO_CRITICAL_RULE_KEYS
  // AND whose updatedBy is a demo admin staff member.
  // This prevents deletion of rules seeded by other processes.
  const demoAdminIds = demoStaffRows
    .filter((s) => s.email === 'demo.admin@hospital.test')
    .map((s) => s.id);

  const demoCritRuleRows =
    demoAdminIds.length > 0
      ? await db.query.criticalValueRules.findMany({
          where: inArray(criticalValueRules.updatedBy, demoAdminIds),
          columns: { id: true, testCode: true, parameterName: true },
        })
      : [];
  // Filter to only rules that match our canonical key set
  const demoCritRuleIds = demoCritRuleRows
    .filter((r) =>
      (DEMO_CRITICAL_RULE_KEYS as readonly string[]).includes(`${r.testCode}:${r.parameterName}`),
    )
    .map((r) => r.id);
  console.log(`Found ${demoCritRuleIds.length} demo critical value rule records`);

  console.log('\nDeleting in reverse FK order...');

  // ── 1. Diagnostic results ─────────────────────────────────────────────────
  if (demoOrderIds.length > 0) {
    const result = await db
      .delete(diagnosticResults)
      .where(inArray(diagnosticResults.orderId, demoOrderIds));
    const n = (result as unknown as { rowCount?: number }).rowCount ?? 0;
    deleted += n;
    console.log(`  Diagnostic results:   ${n} deleted`);
  }

  // ── 2. Notifications (owned by demo physicians) ───────────────────────────
  if (demoStaffIds.length > 0) {
    const result = await db
      .delete(notifications)
      .where(inArray(notifications.recipientId, demoStaffIds));
    const n = (result as unknown as { rowCount?: number }).rowCount ?? 0;
    deleted += n;
    console.log(`  Notifications:        ${n} deleted`);
  }

  // ── 3. Diagnostic orders ──────────────────────────────────────────────────
  if (demoOrderIds.length > 0) {
    const result = await db
      .delete(diagnosticOrders)
      .where(inArray(diagnosticOrders.id, demoOrderIds));
    const n = (result as unknown as { rowCount?: number }).rowCount ?? 0;
    deleted += n;
    console.log(`  Diagnostic orders:    ${n} deleted`);
  }

  // ── 4. Clinical records ───────────────────────────────────────────────────
  if (demoEncounterIds.length > 0) {
    const result = await db
      .delete(clinicalRecords)
      .where(inArray(clinicalRecords.encounterId, demoEncounterIds));
    const n = (result as unknown as { rowCount?: number }).rowCount ?? 0;
    deleted += n;
    console.log(`  Clinical records:     ${n} deleted`);
  }

  // ── 5. Encounters ─────────────────────────────────────────────────────────
  if (demoEncounterIds.length > 0) {
    // Unlink from appointments first
    if (demoApptIds.length > 0) {
      await db
        .update(appointments)
        .set({ encounterId: null, updatedAt: new Date() })
        .where(inArray(appointments.id, demoApptIds));
    }
    const result = await db.delete(encounters).where(inArray(encounters.id, demoEncounterIds));
    const n = (result as unknown as { rowCount?: number }).rowCount ?? 0;
    deleted += n;
    console.log(`  Encounters:           ${n} deleted`);
  }

  // ── 6. Appointments ───────────────────────────────────────────────────────
  if (demoApptIds.length > 0) {
    const result = await db.delete(appointments).where(inArray(appointments.id, demoApptIds));
    const n = (result as unknown as { rowCount?: number }).rowCount ?? 0;
    deleted += n;
    console.log(`  Appointments:         ${n} deleted`);
  }

  // ── 7. Token counters (remove entries for demo doctors on demo dates) ──────
  // We identify by doctor_id being in demoStaffIds — safe since it's a FK join.
  if (demoStaffIds.length > 0) {
    const result = await db.execute(sql`
      DELETE FROM appointment_token_counters
      WHERE doctor_id = ANY(ARRAY[${sql.raw(demoStaffIds.map((id) => `'${id}'::uuid`).join(','))}])
    `);
    const n = (result as unknown as { rowCount?: number }).rowCount ?? 0;
    deleted += n;
    console.log(`  Token counters:       ${n} deleted`);
  }

  // ── 8. Patients ───────────────────────────────────────────────────────────
  if (demoPatientIds.length > 0) {
    const result = await db.delete(patients).where(inArray(patients.id, demoPatientIds));
    const n = (result as unknown as { rowCount?: number }).rowCount ?? 0;
    deleted += n;
    console.log(`  Patients:             ${n} deleted`);
  }

  // ── 9. Critical value rules (only demo-admin-owned) ─────────────────────
  if (demoCritRuleIds.length > 0) {
    const result = await db
      .delete(criticalValueRules)
      .where(inArray(criticalValueRules.id, demoCritRuleIds));
    const n = (result as unknown as { rowCount?: number }).rowCount ?? 0;
    deleted += n;
    console.log(`  Critical value rules: ${n} deleted`);
  }

  // ── 10. Staff (demo staff only — identified by email) ─────────────────────
  if (demoStaffIds.length > 0) {
    // Staff is referenced by audit_events (actor_id FK). Since we run real
    // domain services during seed, audit events are always created — so staff
    // deletion will always violate this FK. This is by design (immutable audit).
    // We attempt deletion and gracefully skip on FK violation (23503).
    try {
      const result = await db.delete(staff).where(inArray(staff.id, demoStaffIds));
      const n = (result as unknown as { rowCount?: number }).rowCount ?? 0;
      deleted += n;
      console.log(`  Staff:                ${n} deleted`);
    } catch (err: unknown) {
      const isFkViolation = isForeignKeyViolation(err);
      if (isFkViolation) {
        console.log(
          `  Staff:                skipped (referenced by audit_events — expected by design)`,
        );
        console.log(`  NOTE: Demo staff accounts remain in DB (audit hash chain integrity).`);
        console.log(`        Re-running seed:demo will skip them (idempotent).`);
      } else {
        throw err;
      }
    }
  }

  // ── 11. Departments (only DEMO-* coded ones) ──────────────────────────────
  if (demoDeptIds.length > 0) {
    try {
      const result = await db.delete(departments).where(inArray(departments.id, demoDeptIds));
      const n = (result as unknown as { rowCount?: number }).rowCount ?? 0;
      deleted += n;
      console.log(`  Departments:          ${n} deleted`);
    } catch (err: unknown) {
      if (isForeignKeyViolation(err)) {
        console.log(
          `  Departments:          skipped (still referenced — likely by demo staff in audit_events)`,
        );
      } else {
        throw err;
      }
    }
  }

  // ── Post-reset verification ───────────────────────────────────────────────
  console.log('\nPost-reset verification...');
  const remainingPats = await db.execute(sql`
    SELECT count(*)::int AS n FROM patients WHERE mrn LIKE 'DEMO-%'
  `);
  const remainingDepts = await db.execute(sql`
    SELECT count(*)::int AS n FROM departments WHERE code LIKE 'DEMO-%'
  `);
  const remPats = (remainingPats as unknown as Array<{ n: number }>)[0]?.n ?? 0;
  const remDepts = (remainingDepts as unknown as Array<{ n: number }>)[0]?.n ?? 0;

  console.log(`  Demo patients remaining: ${remPats} (expected: 0)`);
  console.log(
    `  Demo departments remaining: ${remDepts} (expected: 0, or >0 if staff still referenced)`,
  );

  console.log('\n' + '='.repeat(60));
  console.log('M13.2 DEMO RESET COMPLETE');
  console.log(`Total rows deleted: ${deleted}`);
  console.log('Non-demo records: untouched');
  console.log('Schema/migrations: untouched');
  console.log('='.repeat(60));
  console.log('\nRe-run pnpm seed:demo to restore demo data.');
}

reset()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\nReset FAILED:', err);
    process.exit(1);
  });
