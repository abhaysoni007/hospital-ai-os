/**
 * Production demo account bootstrap.
 *
 * SAFETY: Only inserts the demo physician account if it doesn't exist.
 * NEVER deletes existing staff. NEVER overwrites existing passwords.
 * Idempotent: safe to run multiple times.
 *
 * Run manually when bootstrapping a fresh production database:
 *   DATABASE_URL=<prod-url> pnpm --filter backend exec tsx src/db/seed-prod-demo.ts
 */
import postgres from 'postgres';
import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const DATABASE_URL = process.env.DATABASE_URL!;
if (!DATABASE_URL) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

const sql = postgres(DATABASE_URL, { max: 1, ssl: 'require' });

async function seedProdDemo() {
  console.log('=== Production Demo Account Bootstrap ===');

  try {
    // Verify staff table exists
    const tableCheck = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'staff'
      ) as exists
    `;
    if (!(tableCheck[0] as { exists: boolean }).exists) {
      console.error('ERROR: staff table does not exist. Run migrations first.');
      process.exit(1);
    }

    // 1. Ensure demo department exists
    const DEPT_CODE = 'DEMO-CARD';
    let deptRows = await sql`
      SELECT id FROM departments WHERE code = ${DEPT_CODE} LIMIT 1
    `;
    let deptId: string;
    if (deptRows.length === 0) {
      const inserted = await sql`
        INSERT INTO departments (id, code, name, status, created_at)
        VALUES (gen_random_uuid(), ${DEPT_CODE}, 'Demo Cardiology', 'active', now())
        RETURNING id
      `;
      deptId = (inserted[0] as { id: string }).id;
      console.log('✓ Created department DEMO-CARD');
    } else {
      deptId = (deptRows[0] as { id: string }).id;
      console.log('· Department DEMO-CARD already exists');
    }

    // 2. Seed demo physician (idempotent: skip if exists)
    const DEMO_EMAIL = 'demo.physician@hospital.test';
    const existing = await sql`
      SELECT id, email FROM staff WHERE email = ${DEMO_EMAIL} LIMIT 1
    `;

    if (existing.length === 0) {
      const DEMO_PASSWORD = 'DemoPhys#2026!';
      const hash = await bcrypt.hash(DEMO_PASSWORD, 10);

      await sql`
        INSERT INTO staff (id, employee_id, email, password_hash, first_name, last_name, role, department_id, status, created_at, updated_at)
        VALUES (gen_random_uuid(), 'DEMO-PHY-001', ${DEMO_EMAIL}, ${hash}, 'Rajan', 'Mehta', 'physician', ${deptId}, 'active', now(), now())
      `;
      console.log('✓ Demo physician account created: demo.physician@hospital.test');
      console.log('  Password: DemoPhys#2026!');
    } else {
      console.log('· Demo physician already exists: demo.physician@hospital.test');
    }

    console.log('\n=== Bootstrap complete ===');
  } catch (e) {
    console.error('Bootstrap failed:', e);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

seedProdDemo();
