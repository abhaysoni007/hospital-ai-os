import { sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import {
  DetectedSignal,
  EvidenceRef,
  SignalSeverity,
} from 'shared';
import { db } from '../../db';
import { HOSPITAL_INTELLIGENCE_THRESHOLDS } from './hospital-intelligence.config';

/**
 * M19.2 — Deterministic Bottleneck Detection Engine
 * SOURCE OF TRUTH: docs/architecture/M19_INTELLIGENCE_ARCHITECTURE.md §6
 *
 * All signals are computed via deterministic database queries and pure rules.
 * AI never decides whether a signal exists. If AI is unavailable, these signals
 * are still fully detected, evidence-grounded, and returned.
 */

export interface DetectorScope {
  departmentId?: string;
}

export interface RawOrderRow {
  order_id: string;
  encounter_id: string;
  patient_id: string | null;
  test_code: string;
  test_name: string;
  priority: string;
  status: string;
  ordered_at: Date | string;
  hours_pending: string | number;
  doctor_id: string;
  department_id: string;
}

export interface RawCriticalAlertRow {
  notification_id: string;
  recipient_id: string;
  result_id: string;
  critical_at: Date | string;
  minutes_unacknowledged: string | number;
  patient_id: string | null;
  order_id: string;
  test_code: string;
  test_name: string;
  encounter_id: string;
  department_id: string;
}

export interface RawEncounterRow {
  encounter_id: string;
  patient_id: string | null;
  doctor_id: string;
  department_id: string;
  encounter_type: string;
  status: string;
  started_at: Date | string;
  hours_active: string | number;
}

/**
 * Signal Family 1: PENDING_DIAGNOSTIC_RESULT
 * Detects diagnostic orders pending without results past operational threshold.
 */
export async function detectPendingDiagnosticOrders(
  scope: DetectorScope,
  correlationId: string,
  thresholds = HOSPITAL_INTELLIGENCE_THRESHOLDS,
): Promise<DetectedSignal[]> {
  const statHours = thresholds.PENDING_DIAGNOSTIC_STAT_HOURS;
  const routineHours = thresholds.PENDING_DIAGNOSTIC_ROUTINE_HOURS;

  const departmentFilter = scope.departmentId
    ? sql`AND e.department_id = ${scope.departmentId}`
    : sql``;

  const rows = (await db.execute(sql`
    SELECT
      o.id AS order_id,
      o.encounter_id,
      o.patient_id,
      o.test_code,
      o.test_name,
      o.priority,
      o.status,
      o.created_at AS ordered_at,
      EXTRACT(EPOCH FROM (NOW() - o.created_at)) / 3600 AS hours_pending,
      e.doctor_id,
      e.department_id
    FROM diagnostic_orders o
    JOIN encounters e ON e.id = o.encounter_id
    WHERE
      o.status IN ('ordered', 'sample_collected')
      AND e.status = 'active'
      AND (
        (o.priority = 'stat' AND o.created_at < NOW() - (${statHours} || ' hours')::interval)
        OR (o.priority != 'stat' AND o.created_at < NOW() - (${routineHours} || ' hours')::interval)
      )
      AND NOT EXISTS (SELECT 1 FROM diagnostic_results r WHERE r.order_id = o.id)
      ${departmentFilter}
    ORDER BY
      CASE o.priority WHEN 'stat' THEN 1 WHEN 'urgent' THEN 2 ELSE 3 END,
      o.created_at ASC;
  `)) as unknown as RawOrderRow[];

  return rows.map((r) => {
    const hoursPending = Math.max(0, Number(r.hours_pending));
    const hoursFormatted = hoursPending.toFixed(1);
    const orderedAtIso = new Date(r.ordered_at).toISOString();

    let severity: SignalSeverity = 'LOW';
    if (r.priority === 'stat') {
      severity = hoursPending >= 2 ? 'CRITICAL' : 'HIGH';
    } else if (r.priority === 'urgent') {
      severity = 'HIGH';
    } else if (hoursPending >= 8) {
      severity = 'MEDIUM';
    }

    const evidenceRefs: EvidenceRef[] = [
      {
        evidenceId: randomUUID(),
        sourceType: 'DIAGNOSTIC_ORDER',
        sourceRecordId: r.order_id,
        relevantAt: orderedAtIso,
        evidenceStatus: 'present',
        authorizedVisibility: true,
        relationToSignal: `Order ${r.test_name} (${r.priority.toUpperCase()}) placed ${hoursFormatted}h ago in status '${r.status}'`,
      },
      {
        evidenceId: randomUUID(),
        sourceType: 'ENCOUNTER',
        sourceRecordId: r.encounter_id,
        relevantAt: orderedAtIso,
        evidenceStatus: 'present',
        authorizedVisibility: true,
        relationToSignal: `Active encounter associated with diagnostic order`,
      },
      {
        evidenceId: randomUUID(),
        sourceType: 'DIAGNOSTIC_RESULT',
        sourceRecordId: r.order_id,
        relevantAt: orderedAtIso,
        evidenceStatus: 'missing',
        authorizedVisibility: true,
        relationToSignal: `No diagnostic result recorded for order placed ${hoursFormatted}h ago`,
      },
    ];

    return {
      signalId: randomUUID(),
      signalType: 'PENDING_DIAGNOSTIC_RESULT',
      severity,
      title: `${r.priority.toUpperCase()} ${r.test_name} Order Pending ${hoursFormatted}h`,
      description: `Diagnostic order ${r.order_id} (${r.test_name}) has been pending without results for ${hoursFormatted} hours under active encounter.`,
      detectedAt: new Date().toISOString(),
      status: 'detected',
      patientId: r.patient_id,
      encounterId: r.encounter_id,
      evidenceRefs,
      deterministicReason: `diagnostic_orders.status IN ('ordered','sample_collected') AND created_at < NOW() - INTERVAL '${r.priority === 'stat' ? statHours : routineHours} hours' AND no diagnostic_results`,
      aiExplanation: null,
      recommendation: null,
      correlationId,
    };
  });
}

/**
 * Signal Family 2: CRITICAL_RESULT_UNACKNOWLEDGED
 * Detects unacknowledged critical lab results exceeding acknowledgment SLA threshold.
 */
export async function detectUnacknowledgedCriticalResults(
  scope: DetectorScope,
  correlationId: string,
  thresholds = HOSPITAL_INTELLIGENCE_THRESHOLDS,
): Promise<DetectedSignal[]> {
  const criticalMinutes = thresholds.CRITICAL_RESULT_UNACKNOWLEDGED_MINUTES;

  const departmentFilter = scope.departmentId
    ? sql`AND e.department_id = ${scope.departmentId}`
    : sql``;

  const rows = (await db.execute(sql`
    SELECT
      n.id AS notification_id,
      n.recipient_id,
      n.reference_id AS result_id,
      n.created_at AS critical_at,
      EXTRACT(EPOCH FROM (NOW() - n.created_at)) / 60 AS minutes_unacknowledged,
      dr.patient_id,
      dr.order_id,
      dr.test_code,
      o.test_name,
      o.encounter_id,
      e.department_id
    FROM notifications n
    JOIN diagnostic_results dr ON dr.id = n.reference_id
    JOIN diagnostic_orders o ON o.id = dr.order_id
    JOIN encounters e ON e.id = o.encounter_id
    WHERE
      n.notification_type = 'critical_lab_alert'
      AND n.status != 'acknowledged'
      AND n.created_at < NOW() - (${criticalMinutes} || ' minutes')::interval
      ${departmentFilter}
    ORDER BY n.created_at ASC;
  `)) as unknown as RawCriticalAlertRow[];

  return rows.map((r) => {
    const minutesUnacknowledged = Math.round(Number(r.minutes_unacknowledged));
    const criticalAtIso = new Date(r.critical_at).toISOString();

    const evidenceRefs: EvidenceRef[] = [
      {
        evidenceId: randomUUID(),
        sourceType: 'NOTIFICATION',
        sourceRecordId: r.notification_id,
        relevantAt: criticalAtIso,
        evidenceStatus: 'present',
        authorizedVisibility: true,
        relationToSignal: `Critical lab alert notification unacknowledged for ${minutesUnacknowledged} minutes`,
      },
      {
        evidenceId: randomUUID(),
        sourceType: 'DIAGNOSTIC_RESULT',
        sourceRecordId: r.result_id,
        relevantAt: criticalAtIso,
        evidenceStatus: 'present',
        authorizedVisibility: true,
        relationToSignal: `Critical laboratory result flagged for ${r.test_name} (${r.test_code})`,
      },
      {
        evidenceId: randomUUID(),
        sourceType: 'DIAGNOSTIC_ORDER',
        sourceRecordId: r.order_id,
        relevantAt: criticalAtIso,
        evidenceStatus: 'present',
        authorizedVisibility: true,
        relationToSignal: `Diagnostic order associated with critical result`,
      },
    ];

    return {
      signalId: randomUUID(),
      signalType: 'CRITICAL_RESULT_UNACKNOWLEDGED',
      severity: 'CRITICAL',
      title: `Critical Result Unacknowledged (${r.test_name} > ${minutesUnacknowledged}m)`,
      description: `Critical diagnostic result for ${r.test_name} has remained unacknowledged for ${minutesUnacknowledged} minutes past the safety threshold.`,
      detectedAt: new Date().toISOString(),
      status: 'detected',
      patientId: r.patient_id,
      encounterId: r.encounter_id,
      evidenceRefs,
      deterministicReason: `notifications.notification_type = 'critical_lab_alert' AND status != 'acknowledged' AND created_at < NOW() - INTERVAL '${criticalMinutes} minutes'`,
      aiExplanation: null,
      recommendation: null,
      correlationId,
    };
  });
}

/**
 * Signal Family 3: ENCOUNTER_WITHOUT_CLINICAL_RECORD
 * Detects active encounters without any signed clinical record past operational threshold.
 */
export async function detectEncountersWithoutNotes(
  scope: DetectorScope,
  correlationId: string,
  thresholds = HOSPITAL_INTELLIGENCE_THRESHOLDS,
): Promise<DetectedSignal[]> {
  const noteHours = thresholds.ENCOUNTER_WITHOUT_NOTE_HOURS;

  const departmentFilter = scope.departmentId
    ? sql`AND e.department_id = ${scope.departmentId}`
    : sql``;

  const rows = (await db.execute(sql`
    SELECT
      e.id AS encounter_id,
      e.patient_id,
      e.doctor_id,
      e.department_id,
      e.encounter_type,
      e.status,
      e.started_at,
      EXTRACT(EPOCH FROM (NOW() - e.started_at)) / 3600 AS hours_active
    FROM encounters e
    WHERE
      e.status = 'active'
      AND e.started_at < NOW() - (${noteHours} || ' hours')::interval
      AND NOT EXISTS (
        SELECT 1 FROM clinical_records cr
        WHERE cr.encounter_id = e.id AND cr.status = 'signed'
      )
      ${departmentFilter}
    ORDER BY e.started_at ASC;
  `)) as unknown as RawEncounterRow[];

  return rows.map((r) => {
    const hoursActive = Math.max(0, Number(r.hours_active));
    const hoursFormatted = hoursActive.toFixed(1);
    const startedAtIso = r.started_at ? new Date(r.started_at).toISOString() : new Date().toISOString();

    let severity: SignalSeverity = 'LOW';
    if (hoursActive >= 6) {
      severity = 'HIGH';
    } else if (hoursActive >= 2) {
      severity = 'MEDIUM';
    }

    const evidenceRefs: EvidenceRef[] = [
      {
        evidenceId: randomUUID(),
        sourceType: 'ENCOUNTER',
        sourceRecordId: r.encounter_id,
        relevantAt: startedAtIso,
        evidenceStatus: 'present',
        authorizedVisibility: true,
        relationToSignal: `Active ${r.encounter_type.toUpperCase()} encounter active for ${hoursFormatted} hours`,
      },
      {
        evidenceId: randomUUID(),
        sourceType: 'CLINICAL_RECORD',
        sourceRecordId: r.encounter_id,
        relevantAt: startedAtIso,
        evidenceStatus: 'missing',
        authorizedVisibility: true,
        relationToSignal: `No signed clinical note exists for active encounter started ${hoursFormatted}h ago`,
      },
    ];

    return {
      signalId: randomUUID(),
      signalType: 'ENCOUNTER_WITHOUT_CLINICAL_RECORD',
      severity,
      title: `Active Encounter Without Signed Note (${hoursFormatted}h)`,
      description: `Encounter ${r.encounter_id} has been active for ${hoursFormatted} hours without signed clinical documentation.`,
      detectedAt: new Date().toISOString(),
      status: 'detected',
      patientId: r.patient_id,
      encounterId: r.encounter_id,
      evidenceRefs,
      deterministicReason: `encounters.status = 'active' AND started_at < NOW() - INTERVAL '${noteHours} hours' AND NOT EXISTS signed clinical_records`,
      aiExplanation: null,
      recommendation: null,
      correlationId,
    };
  });
}

/**
 * Runs all three deterministic detection queries in parallel for the given scope.
 */
export async function detectAllBottlenecks(
  scope: DetectorScope,
  correlationId: string,
  thresholds = HOSPITAL_INTELLIGENCE_THRESHOLDS,
): Promise<DetectedSignal[]> {
  const [pendingOrders, criticalAlerts, missingNotes] = await Promise.all([
    detectPendingDiagnosticOrders(scope, correlationId, thresholds),
    detectUnacknowledgedCriticalResults(scope, correlationId, thresholds),
    detectEncountersWithoutNotes(scope, correlationId, thresholds),
  ]);

  const all = [...criticalAlerts, ...pendingOrders, ...missingNotes];

  // Deterministic ordering: CRITICAL -> HIGH -> MEDIUM -> LOW, then detectedAt ASC
  const severityRank: Record<SignalSeverity, number> = {
    CRITICAL: 1,
    HIGH: 2,
    MEDIUM: 3,
    LOW: 4,
  };

  all.sort((a, b) => {
    const rankDiff = severityRank[a.severity] - severityRank[b.severity];
    if (rankDiff !== 0) return rankDiff;
    return a.detectedAt.localeCompare(b.detectedAt);
  });

  return all;
}
