import postgres from 'postgres';
import https from 'https';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

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
      headers: { 'Authorization': 'Bearer ' + renderApiKey },
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

async function rollback() {
  console.log('='.repeat(65));
  console.log('MEDORA — PRODUCTION DEMO DATA ROLLBACK');
  console.log('='.repeat(65));

  const dburl = await getDatabaseUrl();
  const sql = postgres(dburl, { max: 1, ssl: 'require' });

  try {
    const dbInfo = await sql`SELECT current_database(), current_user`;
    console.log(`Connected to database: ${dbInfo[0].current_database} as ${dbInfo[0].current_user}\n`);

    console.log('Rolling back synthetic demo dataset (preserving staff & departments)...');

    await sql.begin(async (tx) => {
      const delAudit = await tx`DELETE FROM audit_events`;
      console.log(`- Deleted ${delAudit.count} audit_events`);

      const delBg = await tx`DELETE FROM break_glass_sessions`;
      console.log(`- Deleted ${delBg.count} break_glass_sessions`);

      const delNotifs = await tx`DELETE FROM notifications`;
      console.log(`- Deleted ${delNotifs.count} notifications`);

      const delTasks = await tx`DELETE FROM tasks`;
      console.log(`- Deleted ${delTasks.count} tasks`);

      const delResults = await tx`DELETE FROM diagnostic_results`;
      console.log(`- Deleted ${delResults.count} diagnostic_results`);

      const delOrders = await tx`DELETE FROM diagnostic_orders`;
      console.log(`- Deleted ${delOrders.count} diagnostic_orders`);

      const delClinical = await tx`DELETE FROM clinical_records`;
      console.log(`- Deleted ${delClinical.count} clinical_records`);

      const delAppts = await tx`DELETE FROM appointments`;
      console.log(`- Deleted ${delAppts.count} appointments`);

      const tokenCounterCheck = await tx`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' AND table_name = 'appointment_token_counters'
        ) as exists
      `;
      if (tokenCounterCheck[0]?.exists) {
        const delTokens = await tx`DELETE FROM appointment_token_counters`;
        console.log(`- Deleted ${delTokens.count} appointment_token_counters`);
      }

      const delEnc = await tx`DELETE FROM encounters`;
      console.log(`- Deleted ${delEnc.count} encounters`);

      const delIdentities = await tx`DELETE FROM identities`;
      console.log(`- Deleted ${delIdentities.count} identities`);

      const delPatients = await tx`DELETE FROM patients`;
      console.log(`- Deleted ${delPatients.count} patients`);

      const delRules = await tx`DELETE FROM critical_value_rules`;
      console.log(`- Deleted ${delRules.count} critical_value_rules`);
    });

    console.log('\n--- Post-Rollback Integrity Verification ---');
    const counts = await sql`
      SELECT
        (SELECT count(*) FROM departments) as departments,
        (SELECT count(*) FROM staff) as staff,
        (SELECT count(*) FROM patients) as patients,
        (SELECT count(*) FROM identities) as identities,
        (SELECT count(*) FROM appointments) as appointments,
        (SELECT count(*) FROM encounters) as encounters,
        (SELECT count(*) FROM clinical_records) as clinical_records,
        (SELECT count(*) FROM diagnostic_orders) as diagnostic_orders,
        (SELECT count(*) FROM diagnostic_results) as diagnostic_results,
        (SELECT count(*) FROM tasks) as tasks,
        (SELECT count(*) FROM notifications) as notifications,
        (SELECT count(*) FROM break_glass_sessions) as break_glass_sessions,
        (SELECT count(*) FROM audit_events) as audit_events
    `;
    console.table(counts[0]);
    console.log('=== Rollback Complete: Staff & Departments Preserved ===\n');
  } catch (err) {
    console.error('CRITICAL ROLLBACK ERROR:', err);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

rollback();
