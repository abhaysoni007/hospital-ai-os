import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { db } from './index';
import postgres from 'postgres';
import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

async function runMigrations() {
  const connectionString =
    process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:55432/hospital_ai_os';

  // We need a specific client for migration to close it later properly
  const sql = postgres(connectionString, { max: 1 });

  try {
    console.log('Running migrations...');
    // manually execute the extensions sql if not already executed by drizzle
    // (Drizzle migration doesn't pick up loose sql files unless they are in its journal)
    // Actually, we can just run the 0000_enable_extensions.sql directly here before drizzle migrates.
    const extSql = fs.readFileSync(
      path.resolve(__dirname, './migrations/0000_enable_extensions.sql'),
      'utf-8',
    );
    await sql.unsafe(extSql);
    console.log('Extensions ensured.');

    await migrate(db, { migrationsFolder: path.resolve(__dirname, './migrations') });
    console.log('Migrations applied successfully.');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

runMigrations();
