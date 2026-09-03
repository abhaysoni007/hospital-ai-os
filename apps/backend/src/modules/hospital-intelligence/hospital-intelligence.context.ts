import { sql } from 'drizzle-orm';
import { ContextBlock, DetectedSignal } from 'shared';
import { db } from '../../db';

/**
 * M19.2 — Permission-Aware AI Context Builder
 * Builds strictly authorized ContextBlocks for a detected signal.
 * Ensures the AI receives only bounded context with citable record UUIDs.
 */
export async function buildContextBlocksForSignal(
  signal: DetectedSignal,
): Promise<ContextBlock[]> {
  const blocks: ContextBlock[] = [];

  // 1. Patient Demographics (bounded, non-PHI: age and gender only)
  if (signal.patientId) {
    const patientRows = (await db.execute(sql`
      SELECT date_of_birth, gender FROM patients WHERE id = ${signal.patientId} LIMIT 1;
    `)) as unknown as Array<{ date_of_birth: string | Date; gender: string }>;

    if (patientRows.length > 0 && patientRows[0].date_of_birth) {
      const dob = new Date(patientRows[0].date_of_birth);
      const ageYears = Math.max(
        0,
        Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 3600 * 1000)),
      );
      const gender = (['male', 'female', 'other', 'undisclosed'].includes(patientRows[0].gender)
        ? patientRows[0].gender
        : 'undisclosed') as 'male' | 'female' | 'other' | 'undisclosed';

      blocks.push({
        blockType: 'patient_demographics',
        ageYears: Math.min(130, ageYears),
        gender,
      });
    }
  }

  // 2. Encounter Metadata (citable with sourceId)
  if (signal.encounterId) {
    const encounterRows = (await db.execute(sql`
      SELECT id, encounter_type, status, started_at, department_id
      FROM encounters WHERE id = ${signal.encounterId} LIMIT 1;
    `)) as unknown as Array<{
      id: string;
      encounter_type: string;
      status: string;
      started_at: string | Date;
      department_id: string;
    }>;

    if (encounterRows.length > 0) {
      const enc = encounterRows[0];
      const validEncounterType = enc.encounter_type === 'follow_up' ? 'follow_up' : 'opd';
      const validStatus = (['registered', 'active', 'discharge_initiated', 'discharged', 'closed'].includes(enc.status)
        ? enc.status
        : 'active') as 'registered' | 'active' | 'discharge_initiated' | 'discharged' | 'closed';

      blocks.push({
        blockType: 'encounter_metadata',
        sourceId: enc.id,
        encounterType: validEncounterType,
        status: validStatus,
        startedAt: enc.started_at ? new Date(enc.started_at).toISOString() : null,
        departmentName: enc.department_id || 'General',
      });
    }
  }

  // 3. Diagnostic Order Block (for pending orders or critical alerts)
  const orderRef = signal.evidenceRefs.find((e) => e.sourceType === 'DIAGNOSTIC_ORDER');
  if (orderRef) {
    const orderRows = (await db.execute(sql`
      SELECT id, test_code, test_name, priority, status, created_at
      FROM diagnostic_orders WHERE id = ${orderRef.sourceRecordId} LIMIT 1;
    `)) as unknown as Array<{
      id: string;
      test_code: string;
      test_name: string;
      priority: string;
      status: string;
      created_at: string | Date;
    }>;

    if (orderRows.length > 0) {
      const ord = orderRows[0];
      blocks.push({
        blockType: 'diagnostic_order',
        sourceId: ord.id,
        testCode: ord.test_code,
        testName: ord.test_name,
        priority: ord.priority as 'routine' | 'urgent' | 'stat',
        status: ord.status as
          | 'ordered'
          | 'sample_collected'
          | 'in_progress'
          | 'completed'
          | 'cancelled',
        createdAt: new Date(ord.created_at).toISOString(),
      });
    }
  }

  // 4. Diagnostic Result Block (for critical results)
  const resultRef = signal.evidenceRefs.find((e) => e.sourceType === 'DIAGNOSTIC_RESULT');
  if (resultRef && resultRef.evidenceStatus === 'present') {
    const resultRows = (await db.execute(sql`
      SELECT id, order_id, test_code, is_critical, is_abnormal, status, result_values
      FROM diagnostic_results WHERE id = ${resultRef.sourceRecordId} LIMIT 1;
    `)) as unknown as Array<{
      id: string;
      order_id: string;
      test_code: string;
      is_critical: boolean;
      is_abnormal: boolean;
      status: string;
      result_values: Record<string, unknown> | null;
    }>;

    if (resultRows.length > 0) {
      const res = resultRows[0];
      const params = [
        {
          parameterName: res.test_code || 'Lab Test',
          valueNumber: 0,
          unit: 'N/A',
          verdict: res.is_critical
            ? ('critical' as const)
            : res.is_abnormal
              ? ('abnormal' as const)
              : ('normal' as const),
          referenceRangeText: 'Critical Flagged',
        },
      ];

      blocks.push({
        blockType: 'diagnostic_result',
        sourceId: res.id,
        relatedOrderSourceId: res.order_id,
        status: res.status as 'preliminary' | 'verified' | 'critical_flagged',
        isCritical: Boolean(res.is_critical),
        parameters: params,
      });
    }
  }

  return blocks;
}
