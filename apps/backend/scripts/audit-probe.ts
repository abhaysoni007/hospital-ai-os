import { db } from '../src/db';
import { auditEvents } from '../src/db/schema/audit';
import { eq } from 'drizzle-orm';
async function main() {
  const rows = await db
    .select()
    .from(auditEvents)
    .where(eq(auditEvents.eventType, 'AI_DRAFT_ACCEPTED'));
  console.log('ACCEPTED count=', rows.length);
  for (const r of rows) console.log(r.targetType, r.targetId, JSON.stringify(r.actionDetail));
  process.exit(0);
}
main();
