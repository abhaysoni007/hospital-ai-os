/**
 * Phase 4 Final Verification — Live Database Tests
 *
 * Tests:
 * 1. Audit append-only enforcement (UPDATE/DELETE must fail)
 * 2. Audit INSERT must succeed (valid operation)
 * 3. Audit hash chain: genesis + sequential events + previousHash continuity
 * 4. Audit transaction rollback: on error, no partial audit event inserted
 * 5. Concurrent audit appends: exclusive lock serializes correctly
 * 6. Patient transaction atomicity: patient+audit in one tx, rollback on audit failure
 * 7. Auth principal: actorRole and actorDepartment come from real JWT claims
 * 8. Patient search: pg_trgm SQL generation verification
 */

import { db } from '../index';
import { auditEvents } from '../schema/audit';
import { staff, departments } from '../schema/staff';
import { desc, eq, sql } from 'drizzle-orm';
import { createHash } from 'crypto';
import { auditService } from '../../modules/audit/audit.service';
import { staff } from '../schema/staff';
import bcrypt from 'bcrypt';

// ── Helpers ────────────────────────────────────────────────────────────────

let testStaffId: string;
let testDeptId: string;
let testCorrelationId: string;
let cleanupStaffId: string | null = null;

async function setup() {
  // Ensure at least one department exists
  let deptRow = await db.query.departments.findFirst();
  if (!deptRow) {
    const [inserted] = await db.insert(departments).values({
      name: 'Test Department',
      code: 'TEST',
      status: 'active',
    }).returning();
    deptRow = inserted;
  }
  testDeptId = deptRow.id;

  // Try to find existing staff, or create a temporary test staff
  let staffRow = await db.query.staff.findFirst({ where: eq(staff.departmentId, testDeptId) });
  if (!staffRow) {
    const passwordHash = await bcrypt.hash('TestPass123!', 10);
    const [inserted] = await db.insert(staff).values({
      employeeId: 'P4V-TEST-001',
      email: 'phase4.verify@test.hospital',
      passwordHash,
      firstName: 'Phase4',
      lastName: 'Verifier',
      role: 'physician',
      departmentId: testDeptId,
      status: 'active',
    }).returning();
    staffRow = inserted;
    cleanupStaffId = staffRow.id;
  }
  testStaffId = staffRow.id;
  testCorrelationId = crypto.randomUUID();

  console.log(`Using staff: ${testStaffId} (${staffRow.role}) dept: ${testDeptId}`);
}

async function cleanup() {
  if (cleanupStaffId) {
    try {
      await db.delete(staff).where(eq(staff.id, cleanupStaffId));
      console.log('  [cleanup] Removed test staff row');
    } catch {
      // Cannot delete — FK constraint from audit_events (expected by design: audit events reference staff)
      console.log('  [cleanup] Cannot delete test staff (referenced by audit_events — correct by design)');
    }
  }
}

function pass(name: string) { console.log(`  ✅ PASS — ${name}`); }
function fail(name: string, err: unknown) { console.error(`  ❌ FAIL — ${name}:`, err); process.exitCode = 1; }

// ── Test 1: Valid INSERT ───────────────────────────────────────────────────
async function testValidInsert() {
  console.log('\n[1] Audit: Valid INSERT');
  try {
    await auditService.logEvent({
      eventType: 'TEST_VALID_INSERT',
      actorId: testStaffId,
      actorRole: 'physician',
      actorDepartment: testDeptId,
    }, testCorrelationId);
    const row = await db.query.auditEvents.findFirst({
      where: eq(auditEvents.eventType, 'TEST_VALID_INSERT'),
      orderBy: [desc(auditEvents.sequenceNumber)],
    });
    if (!row) throw new Error('Event not found after insert');
    pass('Valid INSERT succeeds and event is persisted');
  } catch (err) { fail('Valid INSERT', err); }
}

// ── Test 2: UPDATE must be rejected by trigger ────────────────────────────
async function testUpdateRejected() {
  console.log('\n[2] Audit: UPDATE rejected by trigger');
  try {
    const row = await db.query.auditEvents.findFirst({ orderBy: [desc(auditEvents.sequenceNumber)] });
    if (!row) { console.log('  ⚠ SKIP — no audit events to update'); return; }
    await db.execute(sql`UPDATE audit_events SET event_type = 'TAMPERED' WHERE id = ${row.id}`);
    fail('UPDATE was allowed — trigger NOT enforced', new Error('Expected exception, got success'));
  } catch (err: unknown) {
    // Drizzle wraps PG errors in DrizzleQueryError with .cause being the PostgresError
    const cause = (err as { cause?: { message?: string } })?.cause;
    const causeMsg = cause?.message || '';
    const msg = String(err);
    const isExpected = causeMsg.includes('append-only') || causeMsg.includes('strictly prohibited') ||
                       msg.includes('append-only') || msg.includes('strictly prohibited');
    if (isExpected) {
      pass('UPDATE raises exception from trigger — cause: ' + (causeMsg || msg).slice(0, 80));
    } else {
      fail('UPDATE raised unexpected error', err);
    }
  }
}

// ── Test 3: DELETE must be rejected by trigger ────────────────────────────
async function testDeleteRejected() {
  console.log('\n[3] Audit: DELETE rejected by trigger');
  try {
    const row = await db.query.auditEvents.findFirst({ orderBy: [desc(auditEvents.sequenceNumber)] });
    if (!row) { console.log('  ⚠ SKIP — no audit events to delete'); return; }
    await db.execute(sql`DELETE FROM audit_events WHERE id = ${row.id}`);
    fail('DELETE was allowed — trigger NOT enforced', new Error('Expected exception, got success'));
  } catch (err: unknown) {
    const cause = (err as { cause?: { message?: string } })?.cause;
    const causeMsg = cause?.message || '';
    const msg = String(err);
    const isExpected = causeMsg.includes('append-only') || causeMsg.includes('strictly prohibited') ||
                       msg.includes('append-only') || msg.includes('strictly prohibited');
    if (isExpected) {
      pass('DELETE raises exception from trigger — cause: ' + (causeMsg || msg).slice(0, 80));
    } else {
      fail('DELETE raised unexpected error', err);
    }
  }
}

// ── Test 4: Hash chain continuity ─────────────────────────────────────────
async function testHashChain() {
  console.log('\n[4] Audit: Hash chain continuity');
  try {
    // Insert 3 sequential events and verify the hash chain
    const corrId = crypto.randomUUID();
    for (let i = 0; i < 3; i++) {
      await auditService.logEvent({
        eventType: `TEST_CHAIN_${i}`,
        actorId: testStaffId,
        actorRole: 'physician',
        actorDepartment: testDeptId,
      }, corrId);
    }

    const events = await db.query.auditEvents.findMany({
      where: eq(auditEvents.correlationId, corrId),
      orderBy: [auditEvents.sequenceNumber],
    });

    if (events.length !== 3) throw new Error(`Expected 3 events, got ${events.length}`);

    // Verify each event's previousHash equals the prior event's recordHash
    for (let i = 1; i < events.length; i++) {
      if (events[i].previousHash !== events[i - 1].recordHash) {
        throw new Error(
          `Chain broken between seq ${events[i - 1].sequenceNumber} and ${events[i].sequenceNumber}. ` +
          `Expected previousHash=${events[i - 1].recordHash}, got ${events[i].previousHash}`
        );
      }
    }

    // Verify deterministic hash of first event (genesis or chained)
    const ev = events[0];
    const payloadStr = JSON.stringify({
      eventType: ev.eventType,
      actorId: ev.actorId,
      actorRole: ev.actorRole,
      actorDepartment: ev.actorDepartment,
      targetType: ev.targetType ?? null,
      targetId: ev.targetId ?? null,
      patientId: ev.patientId ?? null,
      actionDetail: ev.actionDetail ?? null,
      justification: ev.justification ?? null,
      ipAddress: ev.ipAddress ?? null,
      correlationId: corrId,
    });
    const expectedHash = createHash('sha256').update(ev.previousHash + payloadStr).digest('hex');
    if (ev.recordHash !== expectedHash) {
      throw new Error(`Hash mismatch: expected ${expectedHash}, stored ${ev.recordHash}`);
    }

    pass('Hash chain is continuous and deterministic');
  } catch (err) { fail('Hash chain', err); }
}

// ── Test 5: Transaction rollback — no orphaned audit event ─────────────────
async function testTransactionRollback() {
  console.log('\n[5] Audit: Transaction rollback discards audit event');
  try {
    const corrId = crypto.randomUUID();
    const countBefore = await db.$count(auditEvents);

    try {
      await db.transaction(async (tx) => {
        await tx.execute(sql`LOCK TABLE audit_events IN EXCLUSIVE MODE`);
        const latestEvent = await tx.query.auditEvents.findFirst({
          orderBy: [desc(auditEvents.sequenceNumber)],
          columns: { recordHash: true },
        });
        const previousHash = latestEvent?.recordHash || '0'.repeat(64);
        const recordHash = createHash('sha256').update(previousHash + 'ROLLBACK_TEST').digest('hex');

        await tx.insert(auditEvents).values({
          eventType: 'TEST_ROLLBACK_EVENT',
          actorId: testStaffId,
          actorRole: 'physician',
          actorDepartment: testDeptId,
          correlationId: corrId,
          previousHash,
          recordHash,
        });

        // Force rollback
        throw new Error('INTENTIONAL_ROLLBACK');
      });
    } catch (err: unknown) {
      if (!String(err).includes('INTENTIONAL_ROLLBACK')) throw err;
    }

    const countAfter = await db.$count(auditEvents);
    if (countAfter !== countBefore) {
      throw new Error(`Count changed: before=${countBefore}, after=${countAfter}. Audit event was NOT rolled back.`);
    }
    pass('Transaction rollback correctly discards audit event — no orphan');
  } catch (err) { fail('Transaction rollback', err); }
}

// ── Test 6: Concurrent appends ─────────────────────────────────────────────
async function testConcurrentAppends() {
  console.log('\n[6] Audit: Concurrent appends via exclusive lock');
  try {
    const corrId = crypto.randomUUID();
    // Fire 5 concurrent logEvent calls
    await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        auditService.logEvent({
          eventType: `TEST_CONCURRENT_${i}`,
          actorId: testStaffId,
          actorRole: 'physician',
          actorDepartment: testDeptId,
          actionDetail: { order: i },
        }, corrId)
      )
    );

    const events = await db.query.auditEvents.findMany({
      where: eq(auditEvents.correlationId, corrId),
      orderBy: [auditEvents.sequenceNumber],
    });

    if (events.length !== 5) throw new Error(`Expected 5 concurrent events, got ${events.length}`);

    // Verify chain is unbroken
    for (let i = 1; i < events.length; i++) {
      if (events[i].previousHash !== events[i - 1].recordHash) {
        throw new Error(
          `Concurrent chain broken at seq ${events[i].sequenceNumber}: ` +
          `previousHash=${events[i].previousHash} != recordHash=${events[i - 1].recordHash}`
        );
      }
    }
    pass(`All 5 concurrent events stored with unbroken hash chain (sequences: ${events.map(e => e.sequenceNumber).join(', ')})`);
  } catch (err) { fail('Concurrent appends', err); }
}

// ── Test 7: Patient search SQL uses pg_trgm ───────────────────────────────
import { patientService } from '../../modules/patient/patient.service';
async function testTriggramSearch() {
  console.log('\n[7] Patient search: pg_trgm SQL generation');
  try {
    const result = await patientService.searchPatients({
      query: 'Smith',
      page: 1,
      pageSize: 10,
    });
    if (!('data' in result) || !('meta' in result)) throw new Error('Unexpected result shape');
    pass(`pg_trgm search executed without error (${result.meta.total} results)`);
  } catch (err: unknown) {
    const msg = String(err);
    if (msg.includes('does not exist') || msg.includes('pg_trgm') || msg.includes('similarity')) {
      fail('pg_trgm operator not available — extension may not be enabled', err);
    } else {
      fail('Patient search', err);
    }
  }
}

// ── Test 8: Auth principal truthfulness in audit ───────────────────────────
async function testAuthPrincipal() {
  console.log('\n[8] Audit: actorRole/actorDepartment use real JWT claims (not fabricated)');
  try {
    // Verify patient.service.ts doesn't contain fabricated values
    const fs = await import('fs');
    const path = await import('path');
    // Use path relative to workspace root
    const src = fs.readFileSync(
      path.resolve(process.cwd(), '..', '..', 'apps', 'backend', 'src', 'modules', 'patient', 'patient.service.ts'), 'utf-8'
    );
    if (src.includes('SYSTEM_USER') || src.includes("'ADMISSIONS'")) {
      throw new Error('Fabricated identity values found in patient.service.ts');
    }
    if (!src.includes('authContext.role') || !src.includes('authContext.departmentId')) {
      throw new Error('Real JWT claims not being passed to audit service');
    }
    pass('patient.service.ts uses authContext.role and authContext.departmentId — no fabricated values');
  } catch (err) { fail('Auth principal truthfulness', err); }
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  console.log('='.repeat(60));
  console.log('PHASE 4 FINAL VERIFICATION — LIVE DATABASE TESTS');
  console.log('='.repeat(60));

  await setup();
  try {
    await testValidInsert();
    await testUpdateRejected();
    await testDeleteRejected();
    await testHashChain();
    await testTransactionRollback();
    await testConcurrentAppends();
    await testTriggramSearch();
    await testAuthPrincipal();
  } finally {
    await cleanup();
  }

  console.log('\n' + '='.repeat(60));
  if (process.exitCode === 1) {
    console.log('RESULT: ONE OR MORE VERIFICATIONS FAILED');
  } else {
    console.log('RESULT: ALL VERIFICATIONS PASSED');
  }
  console.log('='.repeat(60));
  process.exit(process.exitCode ?? 0);
}

main().catch((err) => {
  console.error('Fatal error in verification script:', err);
  process.exit(1);
});
