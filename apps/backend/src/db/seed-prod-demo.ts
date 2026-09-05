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

    // 1. Ensure required departments exist
    const departments = [
      { code: 'DEMO-CARD', name: 'Cardiology' },
      { code: 'DEMO-PATH', name: 'Pathology Lab' },
      { code: 'DEMO-FRONT', name: 'Front Desk' },
      { code: 'DEMO-PHARM', name: 'Pharmacy' },
      { code: 'DEMO-SEC', name: 'Security' },
      { code: 'DEMO-ADMIN', name: 'Administration' }
    ];

    const deptMap: Record<string, string> = {};

    for (const dept of departments) {
      let rows = await sql`SELECT id FROM departments WHERE code = ${dept.code} LIMIT 1`;
      if (rows.length === 0) {
        const inserted = await sql`
          INSERT INTO departments (id, code, name, status, created_at)
          VALUES (gen_random_uuid(), ${dept.code}, ${dept.name}, 'active', now())
          RETURNING id
        `;
        deptMap[dept.code] = (inserted[0] as { id: string }).id;
        console.log(`✓ Created department ${dept.code}`);
      } else {
        deptMap[dept.code] = (rows[0] as { id: string }).id;
      }
    }

    // 2. Seed demo users (idempotent: skip if exists)
    const demoUsers = [
      { email: 'demo.physician@hospital.test', password: 'DemoPhys#2026!', firstName: 'Rajan', lastName: 'Mehta', role: 'physician', empId: 'DEMO-PHY-001', dept: 'DEMO-CARD' },
      { email: 'demo.physician2@hospital.test', password: 'DemoPhys#2026!', firstName: 'Sneha', lastName: 'Patel', role: 'physician', empId: 'DEMO-PHY-002', dept: 'DEMO-CARD' },
      { email: 'demo.physician3@hospital.test', password: 'DemoPhys#2026!', firstName: 'Vikram', lastName: 'Singh', role: 'physician', empId: 'DEMO-PHY-003', dept: 'DEMO-CARD' },
      { email: 'demo.physician4@hospital.test', password: 'DemoPhys#2026!', firstName: 'Anjali', lastName: 'Desai', role: 'physician', empId: 'DEMO-PHY-004', dept: 'DEMO-CARD' },
      { email: 'demo.physician5@hospital.test', password: 'DemoPhys#2026!', firstName: 'Rahul', lastName: 'Sharma', role: 'physician', empId: 'DEMO-PHY-005', dept: 'DEMO-CARD' },
      
      { email: 'demo.nurse@hospital.test', password: 'DemoNurs#2026!', firstName: 'Priya', lastName: 'Verma', role: 'nurse', empId: 'DEMO-NUR-001', dept: 'DEMO-CARD' },
      { email: 'demo.nurse2@hospital.test', password: 'DemoNurs#2026!', firstName: 'Neha', lastName: 'Gupta', role: 'nurse', empId: 'DEMO-NUR-002', dept: 'DEMO-CARD' },
      
      { email: 'demo.labtech@hospital.test', password: 'DemoLab#2026!', firstName: 'Karan', lastName: 'Malhotra', role: 'lab_technician', empId: 'DEMO-LAB-001', dept: 'DEMO-PATH' },
      { email: 'demo.labtech2@hospital.test', password: 'DemoLab#2026!', firstName: 'Anita', lastName: 'Rao', role: 'lab_technician', empId: 'DEMO-LAB-002', dept: 'DEMO-PATH' },
      
      { email: 'demo.receptionist@hospital.test', password: 'DemoRec#2026!', firstName: 'Pooja', lastName: 'Iyer', role: 'receptionist', empId: 'DEMO-REC-001', dept: 'DEMO-FRONT' },
      
      { email: 'demo.pharmacist@hospital.test', password: 'DemoPha#2026!', firstName: 'Suresh', lastName: 'Joshi', role: 'pharmacist', empId: 'DEMO-PHA-001', dept: 'DEMO-PHARM' },
      
      { email: 'demo.security@hospital.test', password: 'DemoSec#2026!', firstName: 'Amit', lastName: 'Yadav', role: 'security_admin', empId: 'DEMO-SEC-001', dept: 'DEMO-SEC' },
      
      { email: 'demo.admin@hospital.test', password: 'DemoAdm#2026!', firstName: 'Deepak', lastName: 'Chopra', role: 'hospital_admin', empId: 'DEMO-ADM-001', dept: 'DEMO-ADMIN' }
    ];

    for (const user of demoUsers) {
      const existing = await sql`
        SELECT id, email FROM staff WHERE email = ${user.email} LIMIT 1
      `;
      if (existing.length === 0) {
        const hash = await bcrypt.hash(user.password, 10);
        await sql`
          INSERT INTO staff (id, employee_id, email, password_hash, first_name, last_name, role, department_id, status, created_at, updated_at)
          VALUES (gen_random_uuid(), ${user.empId}, ${user.email}, ${hash}, ${user.firstName}, ${user.lastName}, ${user.role}, ${deptMap[user.dept]}, 'active', now(), now())
        `;
        console.log(`✓ Demo account created: ${user.email} (${user.role}) - ${user.firstName} ${user.lastName}`);
      } else {
        console.log(`· Demo account already exists: ${user.email}`);
      }
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
