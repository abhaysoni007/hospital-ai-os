/**
 * M13.2 — Deterministic, idempotent, rollback-safe demo data seed.
 *
 * SAFETY INVARIANTS (Amendment 5):
 *   1. Refuses when NODE_ENV === "production"
 *   2. Refuses when DEMO_SEED_ENABLED !== "true"
 *   3. Parses DATABASE_URL and pre-checks the DB name
 *   4. After connecting, queries current_database() and verifies again
 *      (ALLOWED: hospital_ai_os_demo | hospital_ai_os_e2e | hospital_ai_os_test)
 *      (REJECTED: hospital_ai_os — the normal dev DB)
 *
 * IDEMPOTENCY (Amendment 3):
 *   All demo records identified by deterministic business keys:
 *   - departments  → code  (e.g. DEMO-CARD)
 *   - staff        → email (e.g. demo.physician@hospital.test)
 *   - patients     → mrn   (e.g. DEMO-2026-00001)
 *   - appointments → (doctor_id, scheduled_date, scheduled_time, patient_id)
 *   - encounters   → (patient_id, doctor_id, department_id)
 *   - orders       → (encounter_id, test_code)
 *   locate → insert if absent → skip if present → integrity-verify
 *
 * DEMO OWNERSHIP REGISTRY (Amendment 4):
 *   Every demo entity is recorded by business key in DEMO_REGISTRY below.
 *   seed-demo-reset.ts uses the same registry to delete ONLY owned rows.
 *
 * WORKFLOW-GENERATED DATA (Amendment 1/8):
 *   - encounterService.activateEncounter() — generates ENCOUNTER_ACTIVATED audit
 *   - clinicalService.createClinicalRecord() — generates CLINICAL_RECORD_CREATED audit
 *   - clinicalService.signRecord() — generates CLINICAL_RECORD_SIGNED audit
 *   - DiagnosticsService.collectSample() — generates SAMPLE_COLLECTED audit
 *   - DiagnosticsService.enterResult() — runs evaluator + creates notification
 *     (THE ONLY path for critical notification — no duplicate logic)
 *
 * CRITICAL VALUE RULES (Amendment 2):
 *   Insert only if no active rule for (test_code, parameter_name) exists.
 *
 * ENCOUNTER STATES (Amendment 6):
 *   Only 'registered' and 'active'. 'discharged'/'closed' NOT seeded —
 *   M8 state machine marks those transitions as owned by future M13 discharge.
 *
 * AUDIT EVENTS (Amendment 7):
 *   Generated ONLY by real service calls. Base entities inserted directly
 *   do NOT produce fabricated audit events.
 *
 * CREDENTIALS (Amendment 16):
 *   Written ONLY to .demo-credentials.txt (gitignored). Never printed to stdout.
 */

import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { eq, and, sql } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

// ─── Safety guards — run BEFORE any DB import ────────────────────────────────

/** Allowlisted demo/test database names. 'hospital_ai_os' is explicitly rejected. */
export const ALLOWED_DB_NAMES = [
  'hospital_ai_os_demo',
  'hospital_ai_os_e2e',
  'hospital_ai_os_test',
] as const;

if (process.env.NODE_ENV === 'production') {
  console.error('BLOCKED: NODE_ENV=production. Demo seed refused.');
  process.exit(2);
}

if (process.env.DEMO_SEED_ENABLED !== 'true') {
  console.error(
    'BLOCKED: DEMO_SEED_ENABLED is not "true".\n' +
      'Set DEMO_SEED_ENABLED=true in your local .env for demo/E2E environments only.\n' +
      'Never set this in the production or shared development environment.',
  );
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
    `BLOCKED: DATABASE_URL database name "${parsedDbName ?? '(could not parse)'}" is not in the allowlist.\n` +
      `Allowed: ${ALLOWED_DB_NAMES.join(', ')}\n\n` +
      `To run the demo seed:\n` +
      `  1. Create a dedicated demo database:  createdb hospital_ai_os_demo\n` +
      `  2. Run migrations:                    DATABASE_URL=...hospital_ai_os_demo pnpm --filter backend db:migrate\n` +
      `  3. Seed:                              DATABASE_URL=...hospital_ai_os_demo DEMO_SEED_ENABLED=true pnpm seed:demo`,
  );
  process.exit(2);
}

// ─── DB + domain imports (after safety guards pass) ──────────────────────────

import { db } from './index';
import { departments, staff } from './schema/staff';
import { patients } from './schema/patients';
import { appointments, encounters } from './schema/appointments';
import { clinicalRecords } from './schema/clinical';
import { diagnosticOrders, diagnosticResults, criticalValueRules } from './schema/diagnostics';
import { notifications } from './schema/tasks';
import { DiagnosticsService } from '../modules/diagnostics/diagnostics.service';
import { encounterService } from '../modules/encounter/encounter.service';
import { clinicalService } from '../modules/clinical/clinical.service';

// ─── Demo Ownership Registry (Amendment 4) ───────────────────────────────────
// Deterministic business-key identity for every demo entity.
// seed-demo-reset.ts uses these same keys for surgical deletion.

export const DEMO_DEPT_CODES = [
  'DEMO-CARD', 'DEMO-IM', 'DEMO-EM', 'DEMO-PED', 'DEMO-GS', 'DEMO-LAB', 'DEMO-RAD',
] as const;

export const DEMO_STAFF_EMAILS = [
  'demo.physician@hospital.test',   // DEMO-PHY-001  Cardiology physician (DEMO-CRITICAL-001 ordering)
  'demo.physician2@hospital.test',  // DEMO-PHY-002  Internal Medicine physician
  'demo.physician3@hospital.test',  // DEMO-PHY-003  Emergency physician
  'demo.physician4@hospital.test',  // DEMO-PHY-004  Pediatrics physician
  'demo.physician5@hospital.test',  // DEMO-PHY-005  Cardiology physician #2
  'demo.nurse@hospital.test',       // DEMO-NUR-001  Cardiology nurse
  'demo.nurse2@hospital.test',      // DEMO-NUR-002  Internal Medicine nurse
  'demo.labtech@hospital.test',     // DEMO-LAB-001  Cardiology lab tech (DEMO-CRITICAL-001 collector+entry)
  'demo.labtech2@hospital.test',    // DEMO-LAB-002  Laboratory lab tech
  'demo.receptionist@hospital.test',// DEMO-REC-001  Cardiology receptionist
  'demo.pharmacist@hospital.test',  // DEMO-PHA-001  Cardiology pharmacist
  'demo.admin@hospital.test',       // DEMO-ADM-001  Hospital admin
  'demo.security@hospital.test',    // DEMO-SEC-001  Security admin
] as const;

export const DEMO_PATIENT_MRNS = [
  'DEMO-2026-00001', // Margaret Chen      — DEMO-CRITICAL-001
  'DEMO-2026-00002', // James Okonkwo      — DEMO-NORMAL-001
  'DEMO-2026-00003', // Priya Sharma       — DEMO-SIGNED-001
  'DEMO-2026-00004', // Aaron Mitchell     — DEMO-DRAFT-001
  'DEMO-2026-00005', // Lisa Fernandez     — DEMO-BOOKING-CONFLICT-001
  'DEMO-2026-00006', // Carlos Santos      — DEMO-MULTI-ROLE-001
  'DEMO-2026-00007', // Amara Diallo
  'DEMO-2026-00008', // Wei Zhang
  'DEMO-2026-00009', // Nadia Kowalski
  'DEMO-2026-00010', // Samuel Adeyemi
  'DEMO-2026-00011', // Ritu Agarwal
  'DEMO-2026-00012', // Dimitri Papadopoulos
  'DEMO-2026-00013', // Aisha Bakr
  'DEMO-2026-00014', // Pedro Almeida
  'DEMO-2026-00015', // Yuki Tanaka
  'DEMO-2026-00016', // Kwame Asante
  'DEMO-2026-00017', // Irina Volkov
  'DEMO-2026-00018', // Omar Hassan
  'DEMO-2026-00019', // Sunita Rao
  'DEMO-2026-00020', // Tobias Brandt
  'DEMO-2026-00021', // Fatou Camara
  'DEMO-2026-00022', // Hiroshi Nakamura
  'DEMO-2026-00023', // Chloe Dubois
  'DEMO-2026-00024', // Emeka Eze
  'DEMO-2026-00025', // Leila Ahmadi
  'DEMO-2026-00026', // Rafael Morales
  'DEMO-2026-00027', // Selin Yilmaz
  'DEMO-2026-00028', // Antoine Bernard
  'DEMO-2026-00029', // Keiko Ogawa
  'DEMO-2026-00030', // Ibrahim Diallo
] as const;

// Canonical critical-value rule keys (test_code:parameter_name).
// Used to verify no duplicate rules are created (Amendment 2).
export const DEMO_CRITICAL_RULE_KEYS = [
  'CBC:Hemoglobin', 'CBC:WBC', 'CBC:Platelets',
  'BMP:Sodium', 'BMP:Potassium', 'BMP:Glucose', 'BMP:Creatinine',
  'LFT:ALT', 'LFT:Bilirubin',
  'TROP:Troponin I',
] as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Role-specific demo passwords. Deterministic per role. Never printed to stdout. */
function makePassword(role: string): string {
  const map: Record<string, string> = {
    physician: 'DemoPhys#2026!',
    nurse: 'DemoNurs#2026!',
    lab_technician: 'DemoLab#2026!',
    receptionist: 'DemoRec#2026!',
    pharmacist: 'DemoPha#2026!',
    hospital_admin: 'DemoAdm#2026!',
    security_admin: 'DemoSec#2026!',
  };
  return map[role] ?? 'Demo#2026!';
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysFromToday(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

// ─── Seed ─────────────────────────────────────────────────────────────────────

async function seed() {
  console.log('='.repeat(60));
  console.log('M13.2 DEMO DATA SEED');
  console.log('='.repeat(60));

  // ── Safety: verify actual connected database name (Amendment 5) ──────────
  const dbNameRows = await db.execute(sql`SELECT current_database() AS dbname`);
  const actualDb = (dbNameRows as unknown as Array<{ dbname: string }>)[0]?.dbname;
  if (!actualDb || !(ALLOWED_DB_NAMES as readonly string[]).includes(actualDb)) {
    console.error(
      `BLOCKED: Connected database is "${actualDb ?? 'unknown'}" — not in allowlist.\n` +
        `Allowed: ${ALLOWED_DB_NAMES.join(', ')}\n` +
        `This check prevents accidental seed of the dev database.`,
    );
    process.exit(2);
  }
  console.log(`Connected DB verified: ${actualDb}`);
  console.log('');

  // ── [1] Departments ──────────────────────────────────────────────────────
  console.log('[1] Departments...');
  const DEPT_DEFS = [
    { code: 'DEMO-CARD', name: 'Cardiology' },
    { code: 'DEMO-IM',   name: 'Internal Medicine' },
    { code: 'DEMO-EM',   name: 'Emergency' },
    { code: 'DEMO-PED',  name: 'Pediatrics' },
    { code: 'DEMO-GS',   name: 'General Surgery' },
    { code: 'DEMO-LAB',  name: 'Laboratory' },
    { code: 'DEMO-RAD',  name: 'Radiology' },
  ] as const;

  const deptIdMap = new Map<string, string>();
  for (const d of DEPT_DEFS) {
    let row = await db.query.departments.findFirst({ where: eq(departments.code, d.code) });
    if (!row) {
      const [ins] = await db.insert(departments).values({ code: d.code, name: d.name, status: 'active' }).returning();
      row = ins;
      console.log(`  + ${d.name} (${d.code})`);
    } else {
      console.log(`  . ${d.name} (${d.code})`);
    }
    deptIdMap.set(d.code, row.id);
  }

  // ── [2] Bootstrap admin (needed as updatedBy FK on criticalValueRules) ───
  console.log('\n[2] Critical value rules...');
  const ADMIN_EMAIL = 'demo.admin@hospital.test';
  let adminRow = await db.query.staff.findFirst({ where: eq(staff.email, ADMIN_EMAIL) });
  if (!adminRow) {
    const [ins] = await db.insert(staff).values({
      employeeId: 'DEMO-ADM-001',
      email: ADMIN_EMAIL,
      passwordHash: await bcrypt.hash(makePassword('hospital_admin'), 10),
      firstName: 'Linda',
      lastName: 'Torres',
      role: 'hospital_admin',
      departmentId: deptIdMap.get('DEMO-CARD')!,
      status: 'active',
    }).returning();
    adminRow = ins;
    console.log(`  + Bootstrap admin (${ADMIN_EMAIL})`);
  }

  // Canonical M10 critical-value rules. Amendment 2: only insert if absent.
  type CritRuleDef = {
    testCode: string; parameterName: string; unit: string;
    normalLow: string | null; normalHigh: string | null;
    criticalLow: string | null; criticalHigh: string | null;
  };
  const RULE_DEFS: CritRuleDef[] = [
    { testCode: 'CBC',  parameterName: 'Hemoglobin',  unit: 'g/dL',       normalLow: '12.0', normalHigh: '17.5', criticalLow: '7.0',  criticalHigh: '20.0'  },
    { testCode: 'CBC',  parameterName: 'WBC',         unit: '10^3/uL',    normalLow: '4.5',  normalHigh: '11.0', criticalLow: '2.0',  criticalHigh: '30.0'  },
    { testCode: 'CBC',  parameterName: 'Platelets',   unit: '10^3/uL',    normalLow: '150.0',normalHigh: '400.0',criticalLow: '50.0', criticalHigh: '1000.0'},
    { testCode: 'BMP',  parameterName: 'Sodium',      unit: 'mEq/L',      normalLow: '136.0',normalHigh: '145.0',criticalLow: '120.0',criticalHigh: '160.0' },
    { testCode: 'BMP',  parameterName: 'Potassium',   unit: 'mEq/L',      normalLow: '3.5',  normalHigh: '5.0',  criticalLow: '2.8',  criticalHigh: '6.5'   },
    { testCode: 'BMP',  parameterName: 'Glucose',     unit: 'mg/dL',      normalLow: '70.0', normalHigh: '100.0',criticalLow: '40.0', criticalHigh: '500.0' },
    { testCode: 'BMP',  parameterName: 'Creatinine',  unit: 'mg/dL',      normalLow: '0.6',  normalHigh: '1.2',  criticalLow: null,   criticalHigh: '10.0'  },
    { testCode: 'LFT',  parameterName: 'ALT',         unit: 'U/L',        normalLow: '7.0',  normalHigh: '56.0', criticalLow: null,   criticalHigh: '1000.0'},
    { testCode: 'LFT',  parameterName: 'Bilirubin',   unit: 'mg/dL',      normalLow: '0.1',  normalHigh: '1.2',  criticalLow: null,   criticalHigh: '15.0'  },
    { testCode: 'TROP', parameterName: 'Troponin I',  unit: 'ng/mL',      normalLow: null,   normalHigh: '0.04', criticalLow: null,   criticalHigh: '2.0'   },
  ];

  for (const r of RULE_DEFS) {
    const existing = await db.query.criticalValueRules.findFirst({
      where: and(
        eq(criticalValueRules.testCode, r.testCode),
        eq(criticalValueRules.parameterName, r.parameterName),
        eq(criticalValueRules.isActive, true),
      ),
    });
    if (!existing) {
      await db.insert(criticalValueRules).values({
        testCode: r.testCode,
        parameterName: r.parameterName,
        unit: r.unit,
        normalLow: r.normalLow,
        normalHigh: r.normalHigh,
        criticalLow: r.criticalLow,
        criticalHigh: r.criticalHigh,
        isActive: true,
        updatedBy: adminRow.id,
      });
      console.log(`  + Rule: ${r.testCode}:${r.parameterName}`);
    } else {
      console.log(`  . Rule: ${r.testCode}:${r.parameterName} (exists)`);
    }
  }

  // ── [3] All staff ─────────────────────────────────────────────────────────
  console.log('\n[3] Staff...');
  type StaffDef = {
    email: string; employeeId: string;
    firstName: string; lastName: string;
    role: 'physician'|'nurse'|'lab_technician'|'receptionist'|'pharmacist'|'hospital_admin'|'security_admin';
    deptCode: string;
  };
  const STAFF_DEFS: StaffDef[] = [
    { email: 'demo.physician@hospital.test',    employeeId: 'DEMO-PHY-001', firstName: 'Rajan',   lastName: 'Mehta',      role: 'physician',       deptCode: 'DEMO-CARD' },
    { email: 'demo.physician2@hospital.test',   employeeId: 'DEMO-PHY-002', firstName: 'Sarah',   lastName: 'Williams',   role: 'physician',       deptCode: 'DEMO-IM'   },
    { email: 'demo.physician3@hospital.test',   employeeId: 'DEMO-PHY-003', firstName: 'Ananya',  lastName: 'Krishnan',   role: 'physician',       deptCode: 'DEMO-EM'   },
    { email: 'demo.physician4@hospital.test',   employeeId: 'DEMO-PHY-004', firstName: 'Thomas',  lastName: 'Obi',        role: 'physician',       deptCode: 'DEMO-PED'  },
    { email: 'demo.physician5@hospital.test',   employeeId: 'DEMO-PHY-005', firstName: 'Elena',   lastName: 'Vasquez',    role: 'physician',       deptCode: 'DEMO-CARD' },
    { email: 'demo.nurse@hospital.test',        employeeId: 'DEMO-NUR-001', firstName: 'Fatima',  lastName: 'Al-Rashid',  role: 'nurse',           deptCode: 'DEMO-CARD' },
    { email: 'demo.nurse2@hospital.test',       employeeId: 'DEMO-NUR-002', firstName: 'Grace',   lastName: 'Osei',       role: 'nurse',           deptCode: 'DEMO-IM'   },
    { email: 'demo.labtech@hospital.test',      employeeId: 'DEMO-LAB-001', firstName: 'Viktor',  lastName: 'Romanov',    role: 'lab_technician',  deptCode: 'DEMO-CARD' },
    { email: 'demo.labtech2@hospital.test',     employeeId: 'DEMO-LAB-002', firstName: 'Meera',   lastName: 'Nair',       role: 'lab_technician',  deptCode: 'DEMO-LAB'  },
    { email: 'demo.receptionist@hospital.test', employeeId: 'DEMO-REC-001', firstName: 'Clara',   lastName: 'Santos',     role: 'receptionist',    deptCode: 'DEMO-CARD' },
    { email: 'demo.pharmacist@hospital.test',   employeeId: 'DEMO-PHA-001', firstName: 'Arjun',   lastName: 'Patel',      role: 'pharmacist',      deptCode: 'DEMO-CARD' },
    { email: 'demo.security@hospital.test',     employeeId: 'DEMO-SEC-001', firstName: 'Marcus',  lastName: 'Webb',       role: 'security_admin',  deptCode: 'DEMO-CARD' },
    { email: 'demo.admin@hospital.test',        employeeId: 'DEMO-ADM-001', firstName: 'Linda',   lastName: 'Torres',     role: 'hospital_admin',  deptCode: 'DEMO-CARD' },
  ];

  const staffIdMap = new Map<string, string>();
  staffIdMap.set(ADMIN_EMAIL, adminRow.id);

  const credList: Array<{ email: string; role: string; pw: string }> = [];

  for (const s of STAFF_DEFS) {
    let row = await db.query.staff.findFirst({ where: eq(staff.email, s.email) });
    if (!row) {
      const pw = makePassword(s.role);
      const [ins] = await db.insert(staff).values({
        employeeId: s.employeeId,
        email: s.email,
        passwordHash: await bcrypt.hash(pw, 10),
        firstName: s.firstName,
        lastName: s.lastName,
        role: s.role,
        departmentId: deptIdMap.get(s.deptCode)!,
        status: 'active',
      }).returning();
      row = ins;
      credList.push({ email: s.email, role: s.role, pw });
      console.log(`  + ${s.email} (${s.role})`);
    } else {
      credList.push({ email: s.email, role: s.role, pw: makePassword(s.role) });
      console.log(`  . ${s.email} (${s.role})`);
    }
    staffIdMap.set(s.email, row.id);
  }

  // Write credentials file (gitignored, never printed to stdout)
  const credPath = path.resolve(__dirname, '../../../../.demo-credentials.txt');
  const credLines = [
    '# M13.2 DEMO CREDENTIALS',
    '# LOCAL ONLY — gitignored — DO NOT COMMIT',
    `# Generated: ${new Date().toISOString()}`,
    `# Database: ${actualDb}`,
    '',
    '# ROLE             | EMAIL                                       | PASSWORD',
    ...credList.map(
      (c) => `${c.role.padEnd(17)}| ${c.email.padEnd(44)}| ${c.pw}`,
    ),
    '',
    '# SCENARIO MAP',
    '# DEMO-CRITICAL-001       demo.physician@hospital.test  +  demo.labtech@hospital.test',
    '# DEMO-NORMAL-001         demo.physician2@hospital.test +  demo.labtech2@hospital.test',
    '# DEMO-SIGNED-001         demo.physician@hospital.test',
    '# DEMO-DRAFT-001          demo.physician@hospital.test',
    '# DEMO-BOOKING-CONFLICT   demo.receptionist@hospital.test',
    '# DEMO-MULTI-ROLE-001     demo.receptionist -> demo.physician2 -> demo.labtech2',
    '',
    '# Critical notification was generated by real M10 DiagnosticsService.enterResult()',
    '# Not a fabricated insert.',
  ].join('\n');
  fs.writeFileSync(credPath, credLines, 'utf-8');
  console.log('\n  Demo credentials written to .demo-credentials.txt (gitignored)');

  // ── [4] Patients ──────────────────────────────────────────────────────────
  console.log('\n[4] Patients...');
  type PatDef = { mrn: string; fn: string; ln: string; dob: string; gender: 'male'|'female'|'other'|'undisclosed'; phone: string };
  const PAT_DEFS: PatDef[] = [
    { mrn: 'DEMO-2026-00001', fn: 'Margaret',  ln: 'Chen',          dob: '1958-03-12', gender: 'female', phone: '+919800100001' },
    { mrn: 'DEMO-2026-00002', fn: 'James',     ln: 'Okonkwo',       dob: '1971-07-22', gender: 'male',   phone: '+919800100002' },
    { mrn: 'DEMO-2026-00003', fn: 'Priya',     ln: 'Sharma',        dob: '1985-11-05', gender: 'female', phone: '+919800100003' },
    { mrn: 'DEMO-2026-00004', fn: 'Aaron',     ln: 'Mitchell',      dob: '1990-04-18', gender: 'male',   phone: '+919800100004' },
    { mrn: 'DEMO-2026-00005', fn: 'Lisa',      ln: 'Fernandez',     dob: '1978-09-30', gender: 'female', phone: '+919800100005' },
    { mrn: 'DEMO-2026-00006', fn: 'Carlos',    ln: 'Santos',        dob: '1965-01-14', gender: 'male',   phone: '+919800100006' },
    { mrn: 'DEMO-2026-00007', fn: 'Amara',     ln: 'Diallo',        dob: '1992-06-25', gender: 'female', phone: '+919800100007' },
    { mrn: 'DEMO-2026-00008', fn: 'Wei',       ln: 'Zhang',         dob: '1955-12-08', gender: 'male',   phone: '+919800100008' },
    { mrn: 'DEMO-2026-00009', fn: 'Nadia',     ln: 'Kowalski',      dob: '1988-08-17', gender: 'female', phone: '+919800100009' },
    { mrn: 'DEMO-2026-00010', fn: 'Samuel',    ln: 'Adeyemi',       dob: '1975-03-29', gender: 'male',   phone: '+919800100010' },
    { mrn: 'DEMO-2026-00011', fn: 'Ritu',      ln: 'Agarwal',       dob: '1982-10-11', gender: 'female', phone: '+919800100011' },
    { mrn: 'DEMO-2026-00012', fn: 'Dimitri',   ln: 'Papadopoulos',  dob: '1947-05-03', gender: 'male',   phone: '+919800100012' },
    { mrn: 'DEMO-2026-00013', fn: 'Aisha',     ln: 'Bakr',          dob: '1999-02-28', gender: 'female', phone: '+919800100013' },
    { mrn: 'DEMO-2026-00014', fn: 'Pedro',     ln: 'Almeida',       dob: '1963-07-15', gender: 'male',   phone: '+919800100014' },
    { mrn: 'DEMO-2026-00015', fn: 'Yuki',      ln: 'Tanaka',        dob: '1993-11-22', gender: 'female', phone: '+919800100015' },
    { mrn: 'DEMO-2026-00016', fn: 'Kwame',     ln: 'Asante',        dob: '1970-04-07', gender: 'male',   phone: '+919800100016' },
    { mrn: 'DEMO-2026-00017', fn: 'Irina',     ln: 'Volkov',        dob: '1986-09-01', gender: 'female', phone: '+919800100017' },
    { mrn: 'DEMO-2026-00018', fn: 'Omar',      ln: 'Hassan',        dob: '1952-12-25', gender: 'male',   phone: '+919800100018' },
    { mrn: 'DEMO-2026-00019', fn: 'Sunita',    ln: 'Rao',           dob: '1980-06-14', gender: 'female', phone: '+919800100019' },
    { mrn: 'DEMO-2026-00020', fn: 'Tobias',    ln: 'Brandt',        dob: '1968-01-30', gender: 'male',   phone: '+919800100020' },
    { mrn: 'DEMO-2026-00021', fn: 'Fatou',     ln: 'Camara',        dob: '1997-08-19', gender: 'female', phone: '+919800100021' },
    { mrn: 'DEMO-2026-00022', fn: 'Hiroshi',   ln: 'Nakamura',      dob: '1944-03-05', gender: 'male',   phone: '+919800100022' },
    { mrn: 'DEMO-2026-00023', fn: 'Chloe',     ln: 'Dubois',        dob: '1995-10-10', gender: 'female', phone: '+919800100023' },
    { mrn: 'DEMO-2026-00024', fn: 'Emeka',     ln: 'Eze',           dob: '1973-05-21', gender: 'male',   phone: '+919800100024' },
    { mrn: 'DEMO-2026-00025', fn: 'Leila',     ln: 'Ahmadi',        dob: '1988-02-14', gender: 'female', phone: '+919800100025' },
    { mrn: 'DEMO-2026-00026', fn: 'Rafael',    ln: 'Morales',       dob: '1961-11-08', gender: 'male',   phone: '+919800100026' },
    { mrn: 'DEMO-2026-00027', fn: 'Selin',     ln: 'Yilmaz',        dob: '2001-07-03', gender: 'female', phone: '+919800100027' },
    { mrn: 'DEMO-2026-00028', fn: 'Antoine',   ln: 'Bernard',       dob: '1959-04-16', gender: 'male',   phone: '+919800100028' },
    { mrn: 'DEMO-2026-00029', fn: 'Keiko',     ln: 'Ogawa',         dob: '1984-09-27', gender: 'female', phone: '+919800100029' },
    { mrn: 'DEMO-2026-00030', fn: 'Ibrahim',   ln: 'Diallo',        dob: '1977-12-03', gender: 'male',   phone: '+919800100030' },
  ];

  const recId  = staffIdMap.get('demo.receptionist@hospital.test')!;
  const patMap = new Map<string, string>(); // mrn → id
  const cities = ['Mumbai', 'Delhi', 'Bangalore', 'Pune', 'Chennai', 'Hyderabad'];

  for (let i = 0; i < PAT_DEFS.length; i++) {
    const p = PAT_DEFS[i];
    let row = await db.query.patients.findFirst({ where: eq(patients.mrn, p.mrn) });
    if (!row) {
      const [ins] = await db.insert(patients).values({
        mrn: p.mrn,
        firstName: p.fn,
        lastName: p.ln,
        dateOfBirth: p.dob,
        gender: p.gender,
        phonePrimary: p.phone,
        addressLine1: `${100 + i} Demo Street`,
        addressCity: cities[i % 6],
        addressState: 'Maharashtra',
        addressPostalCode: `400${String(i + 1).padStart(3, '0')}`,
        status: 'active',
        createdBy: recId,
      }).returning();
      row = ins;
      console.log(`  + ${p.fn} ${p.ln} (${p.mrn})`);
    } else {
      console.log(`  . ${p.fn} ${p.ln} (${p.mrn})`);
    }
    patMap.set(p.mrn, row.id);
  }

  // Convenience refs
  const phy1Id  = staffIdMap.get('demo.physician@hospital.test')!;
  const phy2Id  = staffIdMap.get('demo.physician2@hospital.test')!;
  const phy3Id  = staffIdMap.get('demo.physician3@hospital.test')!;
  const phy4Id  = staffIdMap.get('demo.physician4@hospital.test')!;
  const phy5Id  = staffIdMap.get('demo.physician5@hospital.test')!;
  const nur1Id  = staffIdMap.get('demo.nurse@hospital.test')!;
  const lab1Id  = staffIdMap.get('demo.labtech@hospital.test')!;
  const lab2Id  = staffIdMap.get('demo.labtech2@hospital.test')!;
  const cardId  = deptIdMap.get('DEMO-CARD')!;
  const imId    = deptIdMap.get('DEMO-IM')!;
  const emId    = deptIdMap.get('DEMO-EM')!;
  const pedId   = deptIdMap.get('DEMO-PED')!;

  const pt = (mrn: string) => patMap.get(mrn)!;

  // ── [5] Appointments ─────────────────────────────────────────────────────
  console.log('\n[5] Appointments...');
  type ApptDef = {
    key: string; patId: string; docId: string; deptId: string;
    date: string; time: string; tok: number;
    status: 'booked'|'checked_in'|'in_consult'|'completed'|'cancelled';
  };
  const APPT_DEFS: ApptDef[] = [
    // Today Cardiology phy1
    { key: 'DEMO-APPT-001', patId: pt('DEMO-2026-00001'), docId: phy1Id, deptId: cardId, date: todayStr(),         time: '09:00', tok: 1, status: 'checked_in' },
    { key: 'DEMO-APPT-002', patId: pt('DEMO-2026-00003'), docId: phy1Id, deptId: cardId, date: todayStr(),         time: '09:30', tok: 2, status: 'booked' },
    { key: 'DEMO-APPT-003', patId: pt('DEMO-2026-00004'), docId: phy1Id, deptId: cardId, date: todayStr(),         time: '10:00', tok: 3, status: 'booked' },
    { key: 'DEMO-APPT-004', patId: pt('DEMO-2026-00007'), docId: phy1Id, deptId: cardId, date: todayStr(),         time: '10:30', tok: 4, status: 'booked' },
    // Today Cardiology phy5
    { key: 'DEMO-APPT-005', patId: pt('DEMO-2026-00005'), docId: phy5Id, deptId: cardId, date: todayStr(),         time: '09:00', tok: 1, status: 'booked' },
    { key: 'DEMO-APPT-006', patId: pt('DEMO-2026-00008'), docId: phy5Id, deptId: cardId, date: todayStr(),         time: '09:30', tok: 2, status: 'booked' },
    // Today Internal Medicine phy2
    { key: 'DEMO-APPT-007', patId: pt('DEMO-2026-00002'), docId: phy2Id, deptId: imId,   date: todayStr(),         time: '09:00', tok: 1, status: 'checked_in' },
    { key: 'DEMO-APPT-008', patId: pt('DEMO-2026-00006'), docId: phy2Id, deptId: imId,   date: todayStr(),         time: '09:30', tok: 2, status: 'booked' },
    // Today Emergency phy3 / Pediatrics phy4
    { key: 'DEMO-APPT-009', patId: pt('DEMO-2026-00018'), docId: phy3Id, deptId: emId,   date: todayStr(),         time: '10:00', tok: 1, status: 'booked' },
    { key: 'DEMO-APPT-010', patId: pt('DEMO-2026-00019'), docId: phy4Id, deptId: pedId,  date: todayStr(),         time: '09:00', tok: 1, status: 'booked' },
    // Tomorrow Cardiology phy1
    { key: 'DEMO-APPT-011', patId: pt('DEMO-2026-00009'), docId: phy1Id, deptId: cardId, date: daysFromToday(1),   time: '09:00', tok: 1, status: 'booked' },
    { key: 'DEMO-APPT-012', patId: pt('DEMO-2026-00010'), docId: phy1Id, deptId: cardId, date: daysFromToday(1),   time: '09:30', tok: 2, status: 'booked' },
    // Tomorrow IM phy2
    { key: 'DEMO-APPT-013', patId: pt('DEMO-2026-00011'), docId: phy2Id, deptId: imId,   date: daysFromToday(1),   time: '10:00', tok: 1, status: 'booked' },
    // Future +3
    { key: 'DEMO-APPT-014', patId: pt('DEMO-2026-00012'), docId: phy1Id, deptId: cardId, date: daysFromToday(3),   time: '11:00', tok: 1, status: 'booked' },
    { key: 'DEMO-APPT-015', patId: pt('DEMO-2026-00013'), docId: phy3Id, deptId: emId,   date: daysFromToday(3),   time: '08:00', tok: 1, status: 'booked' },
    { key: 'DEMO-APPT-016', patId: pt('DEMO-2026-00014'), docId: phy4Id, deptId: pedId,  date: daysFromToday(3),   time: '09:00', tok: 1, status: 'booked' },
    // Future +7
    { key: 'DEMO-APPT-017', patId: pt('DEMO-2026-00015'), docId: phy1Id, deptId: cardId, date: daysFromToday(7),   time: '10:00', tok: 1, status: 'booked' },
    { key: 'DEMO-APPT-018', patId: pt('DEMO-2026-00016'), docId: phy2Id, deptId: imId,   date: daysFromToday(7),   time: '14:00', tok: 1, status: 'booked' },
    // Cancelled
    { key: 'DEMO-APPT-019', patId: pt('DEMO-2026-00017'), docId: phy1Id, deptId: cardId, date: daysFromToday(2),   time: '11:30', tok: 1, status: 'cancelled' },
    // Future +5
    { key: 'DEMO-APPT-020', patId: pt('DEMO-2026-00020'), docId: phy1Id, deptId: cardId, date: daysFromToday(5),   time: '09:00', tok: 1, status: 'booked' },
    { key: 'DEMO-APPT-021', patId: pt('DEMO-2026-00021'), docId: phy2Id, deptId: imId,   date: daysFromToday(5),   time: '11:00', tok: 1, status: 'booked' },
    { key: 'DEMO-APPT-022', patId: pt('DEMO-2026-00022'), docId: phy1Id, deptId: cardId, date: daysFromToday(10),  time: '14:00', tok: 1, status: 'booked' },
  ];

  const apptMap = new Map<string, string>();
  for (const a of APPT_DEFS) {
    const existing = await db.query.appointments.findFirst({
      where: and(
        eq(appointments.doctorId, a.docId),
        eq(appointments.scheduledDate, a.date),
        eq(appointments.scheduledTime, a.time),
        eq(appointments.patientId, a.patId),
      ),
    });
    if (!existing) {
      const [ins] = await db.insert(appointments).values({
        patientId: a.patId, doctorId: a.docId, departmentId: a.deptId,
        scheduledDate: a.date, scheduledTime: a.time,
        tokenNumber: a.tok, status: a.status, createdBy: recId,
      }).returning();
      apptMap.set(a.key, ins.id);
      console.log(`  + ${a.key}: ${a.date} ${a.time} (${a.status})`);
    } else {
      apptMap.set(a.key, existing.id);
      console.log(`  . ${a.key}`);
    }
  }

  // Sync token counters (ADR-012)
  console.log('\n[6] Token counters...');
  const tokGroups = new Map<string, { docId: string; date: string; max: number }>();
  for (const a of APPT_DEFS) {
    // ADR-012: cancelled tokens are not decremented — include all in counter sync
    const k = `${a.docId}:${a.date}`;
    const cur = tokGroups.get(k);
    if (!cur || a.tok > cur.max) tokGroups.set(k, { docId: a.docId, date: a.date, max: a.tok });
  }
  for (const [, g] of tokGroups) {
    await db.execute(sql`
      INSERT INTO appointment_token_counters AS c (doctor_id, scheduled_date, last_token)
      VALUES (${g.docId}::uuid, ${g.date}::date, ${g.max})
      ON CONFLICT (doctor_id, scheduled_date)
      DO UPDATE SET last_token = GREATEST(c.last_token, ${g.max})
    `);
  }
  console.log(`  Synced ${tokGroups.size} token counter rows`);

  // ── [7] Encounters (Amendment 6: only registered + active) ───────────────
  console.log('\n[7] Encounters...');
  type EncDef = {
    key: string; mrn: string; docId: string; deptId: string;
    type: 'opd'|'follow_up'; complaint: string;
    target: 'registered'|'active'; apptKey?: string;
  };
  const ENC_DEFS: EncDef[] = [
    { key: 'DEMO-ENC-001', mrn: 'DEMO-2026-00001', docId: phy1Id, deptId: cardId, type: 'opd',       complaint: 'Severe fatigue pallor shortness of breath on exertion',               target: 'active',     apptKey: 'DEMO-APPT-001' },
    { key: 'DEMO-ENC-002', mrn: 'DEMO-2026-00002', docId: phy2Id, deptId: imId,   type: 'opd',       complaint: 'Annual check-up mild hypertension follow-up',                         target: 'active',     apptKey: 'DEMO-APPT-007' },
    { key: 'DEMO-ENC-003', mrn: 'DEMO-2026-00003', docId: phy1Id, deptId: cardId, type: 'opd',       complaint: 'Chest pain atypical rule out ACS',                                    target: 'active' },
    { key: 'DEMO-ENC-004', mrn: 'DEMO-2026-00004', docId: phy1Id, deptId: cardId, type: 'opd',       complaint: 'Palpitations intermittent 3 days',                                    target: 'active' },
    { key: 'DEMO-ENC-005', mrn: 'DEMO-2026-00006', docId: phy2Id, deptId: imId,   type: 'opd',       complaint: 'Diabetes management review poor glycaemic control',                   target: 'active',     apptKey: 'DEMO-APPT-008' },
    { key: 'DEMO-ENC-006', mrn: 'DEMO-2026-00007', docId: phy1Id, deptId: cardId, type: 'opd',       complaint: 'Dyspnoea on exertion',                                                target: 'registered' },
    { key: 'DEMO-ENC-007', mrn: 'DEMO-2026-00009', docId: phy1Id, deptId: cardId, type: 'follow_up', complaint: 'Post-MI follow-up 3 months',                                          target: 'registered' },
    { key: 'DEMO-ENC-008', mrn: 'DEMO-2026-00010', docId: phy1Id, deptId: cardId, type: 'opd',       complaint: 'Hypertensive urgency evaluation',                                     target: 'registered' },
    { key: 'DEMO-ENC-009', mrn: 'DEMO-2026-00011', docId: phy2Id, deptId: imId,   type: 'opd',       complaint: 'Fever cough 5 days suspected pneumonia',                              target: 'registered' },
    { key: 'DEMO-ENC-010', mrn: 'DEMO-2026-00012', docId: phy1Id, deptId: cardId, type: 'follow_up', complaint: 'Anticoagulation monitoring atrial fibrillation',                      target: 'registered' },
    { key: 'DEMO-ENC-011', mrn: 'DEMO-2026-00013', docId: phy3Id, deptId: emId,   type: 'opd',       complaint: 'Abdominal pain right lower quadrant',                                 target: 'registered' },
    { key: 'DEMO-ENC-012', mrn: 'DEMO-2026-00014', docId: phy4Id, deptId: pedId,  type: 'opd',       complaint: 'Fever rash 7-year-old rule out viral exanthem',                      target: 'registered' },
    { key: 'DEMO-ENC-013', mrn: 'DEMO-2026-00015', docId: phy1Id, deptId: cardId, type: 'opd',       complaint: 'Newly diagnosed hypertension initiating therapy',                     target: 'registered' },
    { key: 'DEMO-ENC-014', mrn: 'DEMO-2026-00016', docId: phy2Id, deptId: imId,   type: 'follow_up', complaint: 'Chronic kidney disease monitoring eGFR trending down',                target: 'registered' },
  ];

  const encMap = new Map<string, string>();
  for (const e of ENC_DEFS) {
    const patId = patMap.get(e.mrn)!;
    const existing = await db.query.encounters.findFirst({
      where: and(
        eq(encounters.patientId, patId),
        eq(encounters.doctorId, e.docId),
        eq(encounters.departmentId, e.deptId),
      ),
    });

    let encRow: Awaited<ReturnType<typeof db.query.encounters.findFirst>>;
    if (!existing) {
      const [ins] = await db.insert(encounters).values({
        patientId: patId, doctorId: e.docId, departmentId: e.deptId,
        encounterType: e.type, chiefComplaint: e.complaint,
        status: 'registered', createdBy: recId,
      }).returning();
      encRow = ins;
      // Link appointment
      if (e.apptKey) {
        const aid = apptMap.get(e.apptKey);
        if (aid) {
          await db.update(appointments)
            .set({ encounterId: ins.id, updatedAt: new Date() })
            .where(eq(appointments.id, aid));
        }
      }
      console.log(`  + ${e.key}`);
    } else {
      encRow = existing;
      console.log(`  . ${e.key}`);
    }
    encMap.set(e.key, encRow!.id);

    // Activate via real service (Amendment 7: generates real audit event)
    if (e.target === 'active' && encRow!.status === 'registered') {
      await encounterService.activateEncounter(
        encRow!.id, encRow!.version, e.docId,
        crypto.randomUUID(),
        { role: 'physician', departmentId: e.deptId },
      );
      console.log(`    -> activated (real encounterService.activateEncounter)`);
    }
  }

  // ── [8] Clinical records ─────────────────────────────────────────────────
  console.log('\n[8] Clinical records...');

  // DEMO-DRAFT-001 — Aaron Mitchell — SOAP draft + progress note draft
  const enc004 = encMap.get('DEMO-ENC-004')!;
  const hasDraftSoap = await db.query.clinicalRecords.findFirst({
    where: and(eq(clinicalRecords.encounterId, enc004), eq(clinicalRecords.recordType, 'soap'), eq(clinicalRecords.status, 'draft')),
  });
  if (!hasDraftSoap) {
    await clinicalService.createClinicalRecord(enc004, {
      recordType: 'soap',
      content: {
        sections: [
          { heading: 'subjective', content: 'Palpitations 3 days. No syncope. Increased caffeine recently.' },
          { heading: 'objective',  content: 'HR 88 irregular, BP 128/82, SpO2 98%. Lungs clear. No murmurs.' },
          { heading: 'assessment', content: 'Palpitations under investigation. Caffeine-induced vs paroxysmal AF.' },
          { heading: 'plan',       content: 'Order ECG and Holter monitor. Reduce caffeine. Return in 1 week.' },
        ],
      },
    }, phy1Id, crypto.randomUUID(), { role: 'physician', departmentId: cardId });
    console.log('  + DEMO-DRAFT-001 SOAP draft (clinicalService.createClinicalRecord)');
  } else { console.log('  . DEMO-DRAFT-001 SOAP draft'); }

  const hasDraftProgress = await db.query.clinicalRecords.findFirst({
    where: and(eq(clinicalRecords.encounterId, enc004), eq(clinicalRecords.recordType, 'progress_note'), eq(clinicalRecords.status, 'draft')),
  });
  if (!hasDraftProgress) {
    await clinicalService.createClinicalRecord(enc004, {
      recordType: 'progress_note',
      content: { narrative: 'Awaiting ECG results. Patient for observation. Symptoms mild and stable.' },
    }, phy1Id, crypto.randomUUID(), { role: 'physician', departmentId: cardId });
    console.log('  + DEMO-DRAFT-001 progress note draft');
  } else { console.log('  . DEMO-DRAFT-001 progress note draft'); }

  // DEMO-SIGNED-001 — Priya Sharma — signed SOAP
  const enc003 = encMap.get('DEMO-ENC-003')!;
  const hasSignedSoap = await db.query.clinicalRecords.findFirst({
    where: and(eq(clinicalRecords.encounterId, enc003), eq(clinicalRecords.recordType, 'soap'), eq(clinicalRecords.status, 'signed')),
  });
  if (!hasSignedSoap) {
    const draft = await clinicalService.createClinicalRecord(enc003, {
      recordType: 'soap',
      content: {
        sections: [
          { heading: 'subjective', content: 'Chest pain atypical 2 days. Left arm radiation. Diaphoresis.' },
          { heading: 'objective',  content: 'HR 94, BP 145/90. ECG no ST-elevation. Troponin I pending.' },
          { heading: 'assessment', content: 'Possible NSTEMI. Cardiology workup initiated.' },
          { heading: 'plan',       content: 'Admit for observation. Serial troponins. Aspirin 325mg stat. Heparin infusion.' },
        ],
      },
    }, phy1Id, crypto.randomUUID(), { role: 'physician', departmentId: cardId });
    // signClinicalRecord(encounterId, recordId, expectedVersion, signerId, correlationId, authContext)
    await clinicalService.signClinicalRecord(enc003, draft.id, draft.version, phy1Id, crypto.randomUUID(), { role: 'physician', departmentId: cardId });
    console.log('  + DEMO-SIGNED-001 SOAP (create + sign via real clinicalService.signClinicalRecord)');
  } else { console.log('  . DEMO-SIGNED-001 SOAP signed'); }

  // DEMO-CRITICAL-001 — Margaret Chen — vital signs (must be nurse role per ADR-015 D7)
  const enc001 = encMap.get('DEMO-ENC-001')!;
  const hasVitals = await db.query.clinicalRecords.findFirst({
    where: and(eq(clinicalRecords.encounterId, enc001), eq(clinicalRecords.recordType, 'vital_signs')),
  });
  if (!hasVitals) {
    await clinicalService.createClinicalRecord(enc001, {
      recordType: 'vital_signs',
      content: { note: 'Admission vitals. Patient pale and fatigued.' },
      vitals: { pulse_bpm: 112, bp_systolic: 90, bp_diastolic: 60, spo2_pct: 94, temperature_c: 37.4, resp_rate: 22 },
    }, nur1Id, crypto.randomUUID(), { role: 'nurse', departmentId: cardId });
    console.log('  + DEMO-CRITICAL-001 vital signs (entered by demo nurse DEMO-NUR-001)');
  } else { console.log('  . DEMO-CRITICAL-001 vital signs'); }

  // ── [9] Diagnostic orders + M10 workflows (Amendment 1) ──────────────────
  console.log('\n[9] Diagnostic orders + M10 workflows...');

  const diagSvc = new DiagnosticsService();

  type OrdDef = {
    key: string; encKey: string; docId: string; patMrn: string;
    testCode: string; testName: string; priority: 'routine'|'urgent'|'stat'; indication: string; deptId: string;
    collectWith?: string;
    enterResult?: { labId: string; labDept: string; values: Array<{ parameterName: string; value: number; unit: string }> };
  };

  const ORD_DEFS: OrdDef[] = [
    // DEMO-CRITICAL-001: CBC stat — Hgb 5.8 g/dL (CRITICAL LOW < 7.0) — MUST use real enterResult
    { key: 'DEMO-ORDER-001', encKey: 'DEMO-ENC-001', docId: phy1Id, patMrn: 'DEMO-2026-00001', testCode: 'CBC',  testName: 'Complete Blood Count',  priority: 'stat',    indication: 'Severe anaemia suspected. Fatigue pallor tachycardia.',       deptId: cardId,
      collectWith: lab1Id,
      enterResult: { labId: lab1Id, labDept: cardId, values: [{ parameterName: 'Hemoglobin', value: 5.8, unit: 'g/dL' }, { parameterName: 'WBC', value: 6.2, unit: '10^3/uL' }, { parameterName: 'Platelets', value: 210, unit: '10^3/uL' }] } },
    // DEMO-NORMAL-001: BMP routine — all normal
    { key: 'DEMO-ORDER-002', encKey: 'DEMO-ENC-002', docId: phy2Id, patMrn: 'DEMO-2026-00002', testCode: 'BMP',  testName: 'Basic Metabolic Panel', priority: 'routine', indication: 'Hypertension monitoring electrolytes renal function.',         deptId: imId,
      collectWith: lab2Id,
      enterResult: { labId: lab2Id, labDept: imId, values: [{ parameterName: 'Sodium', value: 139.0, unit: 'mEq/L' }, { parameterName: 'Potassium', value: 4.1, unit: 'mEq/L' }, { parameterName: 'Glucose', value: 92.0, unit: 'mg/dL' }, { parameterName: 'Creatinine', value: 1.0, unit: 'mg/dL' }] } },
    // Troponin urgent — ordered only
    { key: 'DEMO-ORDER-003', encKey: 'DEMO-ENC-003', docId: phy1Id, patMrn: 'DEMO-2026-00003', testCode: 'TROP', testName: 'Troponin I',             priority: 'urgent',  indication: 'Possible NSTEMI serial troponin required.',                   deptId: cardId },
    // BMP routine — ordered
    { key: 'DEMO-ORDER-004', encKey: 'DEMO-ENC-005', docId: phy2Id, patMrn: 'DEMO-2026-00006', testCode: 'BMP',  testName: 'Basic Metabolic Panel', priority: 'routine', indication: 'Diabetes follow-up HbA1c renal panel.',                       deptId: imId },
    // LFT routine — ordered
    { key: 'DEMO-ORDER-005', encKey: 'DEMO-ENC-001', docId: phy1Id, patMrn: 'DEMO-2026-00001', testCode: 'LFT',  testName: 'Liver Function Tests',   priority: 'routine', indication: 'Baseline liver function.',                                     deptId: cardId },
    // CBC routine — ordered
    { key: 'DEMO-ORDER-006', encKey: 'DEMO-ENC-003', docId: phy1Id, patMrn: 'DEMO-2026-00003', testCode: 'CBC',  testName: 'Complete Blood Count',   priority: 'routine', indication: 'Baseline haematology.',                                        deptId: cardId },
    // CBC urgent pneumonia — collected
    { key: 'DEMO-ORDER-007', encKey: 'DEMO-ENC-009', docId: phy2Id, patMrn: 'DEMO-2026-00011', testCode: 'CBC',  testName: 'Complete Blood Count',   priority: 'urgent',  indication: 'Suspected CAP WBC count required.',                           deptId: imId,
      collectWith: lab2Id },
    // BMP CKD
    { key: 'DEMO-ORDER-008', encKey: 'DEMO-ENC-014', docId: phy2Id, patMrn: 'DEMO-2026-00016', testCode: 'BMP',  testName: 'Basic Metabolic Panel', priority: 'routine', indication: 'CKD monitoring track creatinine.',                             deptId: imId },
    // CBC stat EM (appendicitis)
    { key: 'DEMO-ORDER-009', encKey: 'DEMO-ENC-011', docId: phy3Id, patMrn: 'DEMO-2026-00013', testCode: 'CBC',  testName: 'Complete Blood Count',   priority: 'stat',    indication: 'Acute abdominal pain rule out appendicitis.',                 deptId: emId },
    // LFT routine IM
    { key: 'DEMO-ORDER-010', encKey: 'DEMO-ENC-002', docId: phy2Id, patMrn: 'DEMO-2026-00002', testCode: 'LFT',  testName: 'Liver Function Tests',   priority: 'routine', indication: 'Liver function monitoring medication review.',                 deptId: imId },
  ];

  const ordMap = new Map<string, string>();
  for (const o of ORD_DEFS) {
    const encId = encMap.get(o.encKey)!;
    const patId = patMap.get(o.patMrn)!;

    const existing = await db.query.diagnosticOrders.findFirst({
      where: and(eq(diagnosticOrders.encounterId, encId), eq(diagnosticOrders.testCode, o.testCode)),
    });

    let ordId: string;
    if (!existing) {
      const [ins] = await db.insert(diagnosticOrders).values({
        encounterId: encId, patientId: patId,
        orderingDoctorId: o.docId,
        testCode: o.testCode, testName: o.testName,
        priority: o.priority, clinicalIndication: o.indication,
        status: 'ordered',
      }).returning();
      ordId = ins.id;
      console.log(`  + ${o.key}: ${o.testName} (${o.priority})`);
    } else {
      ordId = existing.id;
      console.log(`  . ${o.key}: ${o.testName}`);
    }
    ordMap.set(o.key, ordId);

    // Sample collection via real service (Amendment 7)
    if (o.collectWith) {
      const cur = await db.query.diagnosticOrders.findFirst({ where: eq(diagnosticOrders.id, ordId) });
      if (cur?.status === 'ordered') {
        await diagSvc.collectSample(ordId, o.collectWith, crypto.randomUUID(), { role: 'lab_technician', departmentId: o.deptId });
        console.log(`    -> collected (real DiagnosticsService.collectSample)`);
      }
    }

    // Result entry via real service — Amendment 1: MUST use real enterResult()
    if (o.enterResult) {
      const cur = await db.query.diagnosticOrders.findFirst({ where: eq(diagnosticOrders.id, ordId) });
      const resultExists = await db.query.diagnosticResults.findFirst({ where: eq(diagnosticResults.orderId, ordId) });
      if (!resultExists && cur?.status === 'sample_collected') {
        await diagSvc.enterResult(
          ordId,
          { resultValues: o.enterResult.values },
          o.enterResult.labId,
          crypto.randomUUID(),
          { role: 'lab_technician', departmentId: o.enterResult.labDept },
        );
        console.log(`    -> result entered (real DiagnosticsService.enterResult — evaluator ran)`);

        // Verify critical notification for DEMO-CRITICAL-001
        if (o.key === 'DEMO-ORDER-001') {
          const notif = await db.query.notifications.findFirst({
            where: and(
              eq(notifications.recipientId, phy1Id),
              eq(notifications.notificationType, 'critical_lab_alert'),
            ),
          });
          if (notif) {
            console.log(`    -> CRITICAL notification confirmed (M10 workflow, id=${notif.id.slice(0, 8)}...)`);
            console.log(`       provenance: DiagnosticsService.enterResult -> evaluateCriticalValues -> notification insert`);
          } else {
            console.warn(`    -> WARNING: critical notification not found for DEMO-CRITICAL-001`);
            console.warn(`       Check that CBC:Hemoglobin rule with criticalLow=7.0 exists and is active`);
          }
        }
      } else if (resultExists) {
        console.log(`    . result already exists`);
      }
    }
  }

  // ── [10] Post-seed integrity audit ────────────────────────────────────────
  console.log('\n[10] Post-seed integrity audit...');
  let aPass = 0, aFail = 0;
  const chk = (name: string, ok: boolean, detail?: string) => {
    if (ok) { aPass++; console.log(`  PASS ${name}${detail ? ` (${detail})` : ''}`); }
    else { aFail++; console.error(`  FAIL ${name}${detail ? ` (${detail})` : ''}`); }
  };

  chk('7 departments',   deptIdMap.size === 7,  `got ${deptIdMap.size}`);
  chk('13 staff',        staffIdMap.size === 13, `got ${staffIdMap.size}`);
  chk('30 patients',     patMap.size === 30,     `got ${patMap.size}`);
  chk('22 appointments', apptMap.size === 22,    `got ${apptMap.size}`);
  chk('14 encounters',   encMap.size === 14,     `got ${encMap.size}`);
  chk('10 orders',       ordMap.size === 10,     `got ${ordMap.size}`);

  const critEnc = await db.query.encounters.findFirst({ where: eq(encounters.id, encMap.get('DEMO-ENC-001')!) });
  chk('DEMO-ENC-001 status=active', critEnc?.status === 'active', `got ${critEnc?.status}`);

  const critResult = await db.query.diagnosticResults.findFirst({ where: eq(diagnosticResults.orderId, ordMap.get('DEMO-ORDER-001')!) });
  chk('DEMO-ORDER-001 result exists', !!critResult);
  chk('DEMO-ORDER-001 isCritical=true',  critResult?.isCritical === true, `got ${critResult?.isCritical}`);
  chk('DEMO-ORDER-001 status=critical_flagged', critResult?.status === 'critical_flagged', `got ${critResult?.status}`);
  chk('DEMO-ORDER-001 criticalRuleId set', !!critResult?.criticalRuleId);

  const critNotif = await db.query.notifications.findFirst({
    where: and(
      eq(notifications.recipientId, phy1Id),
      eq(notifications.notificationType, 'critical_lab_alert'),
      eq(notifications.priority, 'critical'),
    ),
  });
  chk('Critical notification exists for ordering physician', !!critNotif);
  chk('Critical notification status=dispatched', critNotif?.status === 'dispatched', `got ${critNotif?.status}`);

  // Orphan checks
  const orphEnc = await db.execute(sql`SELECT count(*)::int AS n FROM encounters e WHERE NOT EXISTS (SELECT 1 FROM patients p WHERE p.id = e.patient_id)`);
  chk('No orphan encounters', (orphEnc as unknown as Array<{ n: number }>)[0]?.n === 0);
  const orphOrd = await db.execute(sql`SELECT count(*)::int AS n FROM diagnostic_orders o WHERE NOT EXISTS (SELECT 1 FROM encounters e WHERE e.id = o.encounter_id)`);
  chk('No orphan diagnostic orders', (orphOrd as unknown as Array<{ n: number }>)[0]?.n === 0);
  const orphRes = await db.execute(sql`SELECT count(*)::int AS n FROM diagnostic_results r WHERE NOT EXISTS (SELECT 1 FROM diagnostic_orders o WHERE o.id = r.order_id)`);
  chk('No orphan diagnostic results', (orphRes as unknown as Array<{ n: number }>)[0]?.n === 0);

  // Critical result rule reference
  if (critResult?.criticalRuleId) {
    const rule = await db.query.criticalValueRules.findFirst({ where: eq(criticalValueRules.id, critResult.criticalRuleId) });
    chk('Critical result references valid rule', !!rule, `${rule?.testCode}:${rule?.parameterName}`);
  }

  console.log(`\n  Integrity audit: ${aPass} passed, ${aFail} failed`);
  if (aFail > 0) {
    console.error(`\n  ${aFail} integrity check(s) FAILED.`);
    process.exit(1);
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(60));
  console.log('M13.2 SEED COMPLETE');
  console.log('='.repeat(60));
  console.log('  Departments : 7');
  console.log('  Staff       : 13 (all 7 roles covered)');
  console.log('  Patients    : 30');
  console.log('  Appointments: 22');
  console.log('  Encounters  : 14 (5 active, 9 registered)');
  console.log('  Orders      : 10');
  console.log('');
  console.log('  DEMO-CRITICAL-001');
  console.log('    Patient:  Margaret Chen (DEMO-2026-00001)');
  console.log('    Doctor:   Dr. Rajan Mehta (demo.physician@hospital.test)');
  console.log('    LabTech:  Viktor Romanov (demo.labtech@hospital.test)');
  console.log('    Test:     CBC stat — Hgb 5.8 g/dL (critical low < 7.0 g/dL)');
  console.log('    Notification: generated by real M10 DiagnosticsService.enterResult()');
  console.log('');
  console.log('  Credentials: .demo-credentials.txt (gitignored)');
  console.log('  Reset:       pnpm seed:demo:reset');
  console.log('='.repeat(60));
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\nSeed FAILED:', err);
    process.exit(1);
  });