import { db } from './index';
import { departments } from './schema';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

async function seed() {
  console.log('Running seed...');

  // Seed departments idempotently
  const defaultDepartments = [
    { name: 'Cardiology', code: 'CARD', status: 'active' as const },
    { name: 'Neurology', code: 'NEUR', status: 'active' as const },
    { name: 'Emergency', code: 'EMER', status: 'active' as const },
    { name: 'Orthopedics', code: 'ORTH', status: 'active' as const },
  ];

  for (const dept of defaultDepartments) {
    await db.insert(departments).values(dept).onConflictDoNothing({ target: departments.code });
  }

  // NOTE: Phase 3 forbids seeding auth credentials or fake patients in M2.
  // We only seed static reference data here.

  console.log('Seed completed successfully.');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
