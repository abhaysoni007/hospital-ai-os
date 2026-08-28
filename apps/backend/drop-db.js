require('dotenv').config({ path: '../../.env' });
const postgres = require('postgres');
const sql = postgres(process.env.DATABASE_URL);

async function run() {
  try {
    console.log('Connecting to:', process.env.DATABASE_URL);
    console.log('Dropping public and drizzle schemas...');
    await sql`DROP SCHEMA IF EXISTS public CASCADE;`;
    await sql`CREATE SCHEMA public;`;
    await sql`DROP SCHEMA IF EXISTS drizzle CASCADE;`;
    console.log('Schemas dropped and public recreated.');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await sql.end();
  }
}

run();
