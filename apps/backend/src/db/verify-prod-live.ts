import postgres from 'postgres';
import * as dotenv from 'dotenv';
import { createHash } from 'crypto';

dotenv.config();

import https from 'https';

async function getDatabaseUrl(): Promise<string> {
  if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost')) {
    return process.env.DATABASE_URL;
  }
  const renderApiKey = process.env.RENDER_API_KEY;
  if (!renderApiKey) {
    throw new Error('DATABASE_URL or RENDER_API_KEY must be provided.');
  }
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.render.com',
      path: '/v1/services/srv-dadrmbqd0e5s73e3bvc0/env-vars',
      headers: { 'Authorization': `Bearer ${renderApiKey}` },
    };
    https.get(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const dbVar = json.find((item: any) => item.envVar.key === 'DATABASE_URL');
          if (dbVar) resolve(dbVar.envVar.value);
          else reject(new Error('DATABASE_URL not found on Render'));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

let sql: postgres.Sql;

function jsonbCanonical(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(jsonbCanonical);
  }
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => {
      if (a.length !== b.length) return a.length - b.length;
      return a < b ? -1 : a > b ? 1 : 0;
    });
    return Object.fromEntries(entries.map(([k, v]) => [k, jsonbCanonical(v)]));
  }
  return value;
}

async function runIntegrityChecks() {
  console.log('='.repeat(65));
  console.log('PART 1: DATABASE ORPHAN & INTEGRITY CHECKS');
  console.log('='.repeat(65));

  const orphanAppts = await sql`
    SELECT count(*)::int as count FROM appointments a
    LEFT JOIN patients p ON a.patient_id = p.id
    LEFT JOIN staff s ON a.doctor_id = s.id
    LEFT JOIN departments d ON a.department_id = d.id
    WHERE p.id IS NULL OR s.id IS NULL OR d.id IS NULL
  `;
  console.log(`- Orphan appointments: ${orphanAppts[0].count}`);

  const orphanEncs = await sql`
    SELECT count(*)::int as count FROM encounters e
    LEFT JOIN patients p ON e.patient_id = p.id
    LEFT JOIN staff s ON e.doctor_id = s.id
    LEFT JOIN departments d ON e.department_id = d.id
    WHERE p.id IS NULL OR s.id IS NULL OR d.id IS NULL
  `;
  console.log(`- Orphan encounters: ${orphanEncs[0].count}`);

  const orphanDiagOrders = await sql`
    SELECT count(*)::int as count FROM diagnostic_orders o
    LEFT JOIN encounters e ON o.encounter_id = e.id
    LEFT JOIN patients p ON o.patient_id = p.id
    WHERE e.id IS NULL OR p.id IS NULL
  `;
  console.log(`- Orphan diagnostic orders: ${orphanDiagOrders[0].count}`);

  const orphanDiagResults = await sql`
    SELECT count(*)::int as count FROM diagnostic_results r
    LEFT JOIN diagnostic_orders o ON r.order_id = o.id
    LEFT JOIN patients p ON r.patient_id = p.id
    WHERE o.id IS NULL OR p.id IS NULL
  `;
  console.log(`- Orphan diagnostic results: ${orphanDiagResults[0].count}`);

  const orphanRecords = await sql`
    SELECT count(*)::int as count FROM clinical_records cr
    LEFT JOIN encounters e ON cr.encounter_id = e.id
    LEFT JOIN patients p ON cr.patient_id = p.id
    WHERE e.id IS NULL OR p.id IS NULL
  `;
  console.log(`- Orphan clinical records: ${orphanRecords[0].count}`);

  const orphanTasks = await sql`
    SELECT count(*)::int as count FROM tasks t
    LEFT JOIN staff s1 ON t.assigned_to = s1.id
    LEFT JOIN staff s2 ON t.assigned_by = s2.id
    WHERE s1.id IS NULL OR s2.id IS NULL
  `;
  console.log(`- Orphan tasks: ${orphanTasks[0].count}`);

  const orphanNotifs = await sql`
    SELECT count(*)::int as count FROM notifications n
    LEFT JOIN staff s ON n.recipient_id = s.id
    WHERE s.id IS NULL
  `;
  console.log(`- Orphan notifications: ${orphanNotifs[0].count}`);

  const duplicateStaff = await sql`
    SELECT email, count(*) FROM staff GROUP BY email HAVING count(*) > 1
  `;
  console.log(`- Duplicate staff emails: ${duplicateStaff.length}`);

  const duplicateEmpIds = await sql`
    SELECT employee_id, count(*) FROM staff GROUP BY employee_id HAVING count(*) > 1
  `;
  console.log(`- Duplicate employee IDs: ${duplicateEmpIds.length}`);

  const duplicateMrn = await sql`
    SELECT mrn, count(*) FROM patients GROUP BY mrn HAVING count(*) > 1
  `;
  console.log(`- Duplicate patient MRNs: ${duplicateMrn.length}`);

  // Cryptographic audit chain verification
  console.log('\n--- Cryptographic Audit Chain Verification ---');
  const auditRows = await sql`
    SELECT sequence_number, event_type, actor_id, actor_role, actor_department,
           target_type, target_id, patient_id, action_detail, justification,
           ip_address, correlation_id, previous_hash, record_hash
    FROM audit_events
    ORDER BY sequence_number ASC
  `;

  let chainValid = true;
  for (let i = 0; i < auditRows.length; i++) {
    const row = auditRows[i];
    if (i > 0) {
      if (row.previous_hash !== auditRows[i - 1].record_hash) {
        console.error(`Broken link at seq ${row.sequence_number}: previous_hash does not match prior record_hash`);
        chainValid = false;
      }
    }
    const payloadString = JSON.stringify({
      eventType: row.event_type,
      actorId: row.actor_id,
      actorRole: row.actor_role,
      actorDepartment: row.actor_department,
      targetType: row.target_type || null,
      targetId: row.target_id || null,
      patientId: row.patient_id || null,
      actionDetail: jsonbCanonical(row.action_detail) || null,
      justification: row.justification || null,
      ipAddress: row.ip_address || null,
      correlationId: row.correlation_id,
    });
    const expectedHash = createHash('sha256')
      .update(row.previous_hash + payloadString)
      .digest('hex');

    if (expectedHash !== row.record_hash) {
      console.error(`Hash mismatch at seq ${row.sequence_number}: expected ${expectedHash}, stored ${row.record_hash}`);
      chainValid = false;
    }
  }
  if (chainValid) {
    console.log(`Audit hash chain: 100% VALID (${auditRows.length} events verified)`);
  } else {
    throw new Error('Audit hash chain verification failed!');
  }
}

async function runApiVerification() {
  console.log('\n' + '='.repeat(65));
  console.log('PART 2: LIVE ROLE AUTHENTICATION & API VERIFICATION');
  console.log(`Target URL: ${API_BASE_URL}`);
  console.log('='.repeat(65));

  const credentials = [
    { email: 'rajan.mehta@hospital.test', pass: 'DemoPhys#2026!', role: 'physician', dept: 'CARD' },
    { email: 'sneha.patel@hospital.test', pass: 'DemoPhys#2026!', role: 'physician', dept: 'CARD' },
    { email: 'priya.verma@hospital.test', pass: 'DemoNurs#2026!', role: 'nurse', dept: 'CARD' },
    { email: 'neha.gupta@hospital.test', pass: 'DemoNurs#2026!', role: 'nurse', dept: 'CARD' },
    { email: 'karan.malhotra@hospital.test', pass: 'DemoLab#2026!', role: 'lab_technician', dept: 'PATH' },
    { email: 'pooja.iyer@hospital.test', pass: 'DemoRec#2026!', role: 'receptionist', dept: 'FRONT' },
    { email: 'suresh.joshi@hospital.test', pass: 'DemoPha#2026!', role: 'pharmacist', dept: 'PHARM' },
    { email: 'amit.yadav@hospital.test', pass: 'DemoSec#2026!', role: 'security_admin', dept: 'SEC' },
    { email: 'deepak.chopra@hospital.test', pass: 'DemoAdm#2026!', role: 'hospital_admin', dept: 'ADMIN' },
  ];

  const results: any[] = [];

  for (const cred of credentials) {
    console.log(`\nTesting user: ${cred.email} (${cred.role})...`);
    
    // 1. Login
    const loginRes = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cred.email, password: cred.pass }),
    });

    if (!loginRes.ok) {
      const errText = await loginRes.text();
      console.error(`FAIL: Login failed for ${cred.email} (HTTP ${loginRes.status}): ${errText}`);
      results.push({ email: cred.email, role: cred.role, login: 'FAILED', endpoints: {} });
      continue;
    }

    const loginData = await loginRes.json();
    const token = loginData.data?.accessToken || loginData.accessToken;
    const user = loginData.data?.user || loginData.user;

    console.log(`  Login OK: Role=${user?.role}, DeptId=${user?.departmentId}`);

    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    const endpointResults: Record<string, any> = {};

    // 2. Role-specific query verification
    if (cred.role === 'physician') {
      // Encounters
      const encRes = await fetch(`${API_BASE_URL}/api/v1/encounters`, { headers });
      const encData = await encRes.json();
      const encCount = Array.isArray(encData.data) ? encData.data.length : (encData.data?.items?.length || 0);
      endpointResults['encounters'] = { status: encRes.status, count: encCount };

      // Diagnostic Orders (Physicians can read diagnostic orders)
      const diagRes = await fetch(`${API_BASE_URL}/api/v1/diagnostic-orders`, { headers });
      const diagData = await diagRes.json();
      const diagCount = Array.isArray(diagData.data) ? diagData.data.length : (diagData.data?.items?.length || 0);
      endpointResults['diagnostic_orders'] = { status: diagRes.status, count: diagCount };

      // Tasks
      const taskRes = await fetch(`${API_BASE_URL}/api/v1/tasks`, { headers });
      const taskData = await taskRes.json();
      const taskCount = Array.isArray(taskData.data) ? taskData.data.length : (taskData.data?.items?.length || 0);
      endpointResults['tasks'] = { status: taskRes.status, count: taskCount };

      // Negative RBAC: Physician does not have appointment:read
      const apptRes = await fetch(`${API_BASE_URL}/api/v1/appointments`, { headers });
      endpointResults['negative_rbac_appointments'] = { status: apptRes.status, expected: 403 };
    }

    if (cred.role === 'nurse') {
      // Encounters
      const encRes = await fetch(`${API_BASE_URL}/api/v1/encounters`, { headers });
      const encData = await encRes.json();
      const encCount = Array.isArray(encData.data) ? encData.data.length : (encData.data?.items?.length || 0);
      endpointResults['encounters'] = { status: encRes.status, count: encCount };

      // Tasks
      const taskRes = await fetch(`${API_BASE_URL}/api/v1/tasks`, { headers });
      const taskData = await taskRes.json();
      const taskCount = Array.isArray(taskData.data) ? taskData.data.length : (taskData.data?.items?.length || 0);
      endpointResults['tasks'] = { status: taskRes.status, count: taskCount };
    }

    if (cred.role === 'lab_technician') {
      // Queue
      const queueRes = await fetch(`${API_BASE_URL}/api/v1/diagnostic-orders`, { headers });
      const queueData = await queueRes.json();
      const queueCount = Array.isArray(queueData.data) ? queueData.data.length : (queueData.data?.items?.length || 0);
      endpointResults['diagnostic_orders'] = { status: queueRes.status, count: queueCount };

      // Tasks
      const taskRes = await fetch(`${API_BASE_URL}/api/v1/tasks`, { headers });
      const taskData = await taskRes.json();
      const taskCount = Array.isArray(taskData.data) ? taskData.data.length : (taskData.data?.items?.length || 0);
      endpointResults['tasks'] = { status: taskRes.status, count: taskCount };
    }

    if (cred.role === 'receptionist') {
      // Appointments
      const apptRes = await fetch(`${API_BASE_URL}/api/v1/appointments`, { headers });
      const apptData = await apptRes.json();
      const apptCount = Array.isArray(apptData.data) ? apptData.data.length : (apptData.data?.items?.length || 0);
      endpointResults['appointments'] = { status: apptRes.status, count: apptCount };

      // Negative RBAC: Receptionist attempting to access break-glass sessions
      const rbacRes = await fetch(`${API_BASE_URL}/api/v1/break-glass/sessions`, { headers });
      endpointResults['negative_rbac_break_glass'] = { status: rbacRes.status, expected: 403 };
    }

    if (cred.role === 'pharmacist') {
      // Tasks
      const taskRes = await fetch(`${API_BASE_URL}/api/v1/tasks`, { headers });
      const taskData = await taskRes.json();
      const taskCount = Array.isArray(taskData.data) ? taskData.data.length : (taskData.data?.items?.length || 0);
      endpointResults['tasks'] = { status: taskRes.status, count: taskCount };
    }

    if (cred.role === 'security_admin') {
      // Break-glass sessions (returns direct array)
      const bgRes = await fetch(`${API_BASE_URL}/api/v1/break-glass/sessions`, { headers });
      const bgData = await bgRes.json();
      const bgCount = Array.isArray(bgData) ? bgData.length : (Array.isArray(bgData?.data) ? bgData.data.length : 0);
      endpointResults['break_glass_sessions'] = { status: bgRes.status, count: bgCount };
    }

    if (cred.role === 'hospital_admin') {
      // Encounters
      const encRes = await fetch(`${API_BASE_URL}/api/v1/encounters`, { headers });
      const encData = await encRes.json();
      const encCount = Array.isArray(encData.data) ? encData.data.length : (encData.data?.items?.length || 0);
      endpointResults['encounters'] = { status: encRes.status, count: encCount };

      // Appointments
      const apptRes = await fetch(`${API_BASE_URL}/api/v1/appointments`, { headers });
      const apptData = await apptRes.json();
      const apptCount = Array.isArray(apptData.data) ? apptData.data.length : (apptData.data?.items?.length || 0);
      endpointResults['appointments'] = { status: apptRes.status, count: apptCount };
    }

    console.log(`  Endpoints: ${JSON.stringify(endpointResults)}`);
    results.push({ email: cred.email, role: cred.role, login: 'SUCCESS', endpoints: endpointResults });
  }

  console.log('\n' + '='.repeat(65));
  console.log('LIVE ROLE VERIFICATION TABLE');
  console.log('='.repeat(65));
  console.table(
    results.map((r) => ({
      Email: r.email,
      Role: r.role,
      Login: r.login,
      Endpoints: Object.entries(r.endpoints)
        .map(([k, v]: [string, any]) => `${k}:${v.status}(${v.count ?? (v.expected === 403 ? 'RBAC-403' : '')})`)
        .join('; '),
    }))
  );
}

const API_BASE_URL = process.env.API_BASE_URL || 'https://hospital-ai-os-backend.onrender.com';

async function main() {
  const dbUrl = await getDatabaseUrl();
  sql = postgres(dbUrl, { max: 5, ssl: 'require' });
  try {
    await runIntegrityChecks();
    await runApiVerification();
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error('Verification script failed:', err);
  process.exit(1);
});
