import postgres from 'postgres';
import path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const connectionString =
  process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:55432/hospital_ai_os';

const sql = postgres(connectionString, { max: 1 });

async function run() {
  try {
    await sql`ALTER TABLE break_glass_sessions ADD COLUMN IF NOT EXISTS encounter_id uuid`;
    console.log('✓ encounter_id');
    // Ensure enum type exists first
    await sql`DO $$ BEGIN CREATE TYPE break_glass_reason AS ENUM ('emergency_care', 'patient_safety', 'continuity_of_care'); EXCEPTION WHEN duplicate_object THEN null; END $$`;
    console.log('✓ break_glass_reason enum');
    await sql`ALTER TABLE break_glass_sessions ADD COLUMN IF NOT EXISTS reason break_glass_reason DEFAULT 'emergency_care' NOT NULL`;
    console.log('✓ reason');
    await sql`ALTER TABLE break_glass_sessions ADD COLUMN IF NOT EXISTS expires_at timestamptz DEFAULT now() NOT NULL`;
    console.log('✓ expires_at');
    await sql`ALTER TABLE break_glass_sessions ADD COLUMN IF NOT EXISTS revoked_at timestamptz`;
    console.log('✓ revoked_at');
    console.log('All break_glass columns applied.');
  } catch (e: any) {
    console.error('Error:', e.message);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

void run();
