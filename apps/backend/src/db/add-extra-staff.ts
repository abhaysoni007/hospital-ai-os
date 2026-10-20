import postgres from 'postgres';
import bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const dbUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:55432/hospital_ai_os_demo';
const sql = postgres(dbUrl);

async function addUsers() {
  const users = [
    { email: 'dr.reynolds@hospital.org', pass: 'Physician@Pass123', first: 'Alex', last: 'Reynolds', role: 'physician', emp: 'PHY-REY' },
    { email: 'nurse.chen@hospital.org', pass: 'Nurse@Pass123', first: 'Sarah', last: 'Chen', role: 'nurse', emp: 'NUR-CHEN' },
    { email: 'admin@hospital.org', pass: 'Admin@Pass123', first: 'David', last: 'Admin', role: 'hospital_admin', emp: 'ADM-SYS' },
    { email: 'lab.tech@hospital.org', pass: 'LabTech@Pass123', first: 'Viktor', last: 'Tech', role: 'lab_technician', emp: 'LAB-TECH' },
  ];

  const dept = await sql`SELECT id FROM departments WHERE code = 'DEMO-CARD' LIMIT 1`;
  const deptId = dept[0].id;

  for (const u of users) {
    const hash = await bcrypt.hash(u.pass, 10);
    await sql`
      INSERT INTO staff (id, employee_id, email, password_hash, first_name, last_name, role, department_id, status, created_at, updated_at)
      VALUES (gen_random_uuid(), ${u.emp}, ${u.email}, ${hash}, ${u.first}, ${u.last}, ${u.role}, ${deptId}, 'active', now(), now())
      ON CONFLICT (email) DO UPDATE SET password_hash = ${hash}
    `;
    console.log(`✓ Inserted/updated ${u.email}`);
  }

  await sql.end();
  console.log('Done');
}

addUsers().catch(console.error);
