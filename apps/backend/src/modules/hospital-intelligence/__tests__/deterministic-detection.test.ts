import { describe, it, expect } from 'vitest';
import {
  detectPendingDiagnosticOrders,
  detectUnacknowledgedCriticalResults,
  detectEncountersWithoutNotes,
  detectAllBottlenecks,
} from '../hospital-intelligence.detector';
import { HOSPITAL_INTELLIGENCE_THRESHOLDS } from '../hospital-intelligence.config';

/**
 * M19.2 — Deterministic Detection Engine Tests
 * SOURCE OF TRUTH: docs/architecture/M19_INTELLIGENCE_ARCHITECTURE.md §6
 *
 * Verifies that signals and severity levels are determined purely by database
 * state and deterministic rules — NEVER invented by an LLM.
 */

describe('M19.2 Deterministic Bottleneck Detection Engine', () => {
  const testCorrelationId = '00000000-0000-4000-8000-000000000001';

  describe('Signal 1: PENDING_DIAGNOSTIC_RESULT', () => {
    it('detects pending diagnostic orders past the operational threshold', async () => {
      const signals = await detectPendingDiagnosticOrders(
        {},
        testCorrelationId,
        HOSPITAL_INTELLIGENCE_THRESHOLDS,
      );

      expect(Array.isArray(signals)).toBe(true);
      for (const sig of signals) {
        expect(sig.signalType).toBe('PENDING_DIAGNOSTIC_RESULT');
        expect(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']).toContain(sig.severity);
        expect(sig.deterministicReason).toContain('diagnostic_orders.status IN');
        expect(sig.status).toBe('detected');

        // Evidence contract verification
        const orderRef = sig.evidenceRefs.find((e) => e.sourceType === 'DIAGNOSTIC_ORDER');
        const encRef = sig.evidenceRefs.find((e) => e.sourceType === 'ENCOUNTER');
        const resRef = sig.evidenceRefs.find((e) => e.sourceType === 'DIAGNOSTIC_RESULT');

        expect(orderRef).toBeDefined();
        expect(orderRef?.evidenceStatus).toBe('present');
        expect(encRef).toBeDefined();
        expect(encRef?.evidenceStatus).toBe('present');
        expect(resRef).toBeDefined();
        expect(resRef?.evidenceStatus).toBe('missing');
      }
    });

    it('applies department filter strictly', async () => {
      const nonExistentDept = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
      const signals = await detectPendingDiagnosticOrders(
        { departmentId: nonExistentDept },
        testCorrelationId,
      );
      expect(signals).toHaveLength(0);
    });
  });

  describe('Signal 2: CRITICAL_RESULT_UNACKNOWLEDGED', () => {
    it('detects unacknowledged critical alerts past SLA with CRITICAL severity', async () => {
      const signals = await detectUnacknowledgedCriticalResults(
        {},
        testCorrelationId,
        HOSPITAL_INTELLIGENCE_THRESHOLDS,
      );

      expect(Array.isArray(signals)).toBe(true);
      for (const sig of signals) {
        expect(sig.signalType).toBe('CRITICAL_RESULT_UNACKNOWLEDGED');
        // Critical alerts MUST always be CRITICAL severity
        expect(sig.severity).toBe('CRITICAL');
        expect(sig.deterministicReason).toContain('critical_lab_alert');

        // Evidence contract verification
        const notifRef = sig.evidenceRefs.find((e) => e.sourceType === 'NOTIFICATION');
        const resRef = sig.evidenceRefs.find((e) => e.sourceType === 'DIAGNOSTIC_RESULT');
        const orderRef = sig.evidenceRefs.find((e) => e.sourceType === 'DIAGNOSTIC_ORDER');

        expect(notifRef).toBeDefined();
        expect(notifRef?.evidenceStatus).toBe('present');
        expect(resRef).toBeDefined();
        expect(resRef?.evidenceStatus).toBe('present');
        expect(orderRef).toBeDefined();
        expect(orderRef?.evidenceStatus).toBe('present');
      }
    });
  });

  describe('Signal 3: ENCOUNTER_WITHOUT_CLINICAL_RECORD', () => {
    it('detects active encounters missing signed clinical notes', async () => {
      const signals = await detectEncountersWithoutNotes(
        {},
        testCorrelationId,
        HOSPITAL_INTELLIGENCE_THRESHOLDS,
      );

      expect(Array.isArray(signals)).toBe(true);
      for (const sig of signals) {
        expect(sig.signalType).toBe('ENCOUNTER_WITHOUT_CLINICAL_RECORD');
        expect(['HIGH', 'MEDIUM', 'LOW']).toContain(sig.severity);
        expect(sig.deterministicReason).toContain('encounters.status = \'active\'');

        // Evidence contract: encounter is present, clinical record is missing
        const encRef = sig.evidenceRefs.find((e) => e.sourceType === 'ENCOUNTER');
        const noteRef = sig.evidenceRefs.find((e) => e.sourceType === 'CLINICAL_RECORD');

        expect(encRef).toBeDefined();
        expect(encRef?.evidenceStatus).toBe('present');
        expect(noteRef).toBeDefined();
        expect(noteRef?.evidenceStatus).toBe('missing');
      }
    });
  });

  describe('detectAllBottlenecks ranking and ordering', () => {
    it('orders detected signals deterministically by severity (CRITICAL -> HIGH -> MEDIUM -> LOW)', async () => {
      const all = await detectAllBottlenecks({}, testCorrelationId);

      const rankMap = { CRITICAL: 1, HIGH: 2, MEDIUM: 3, LOW: 4 };
      for (let i = 0; i < all.length - 1; i++) {
        const currentRank = rankMap[all[i].severity];
        const nextRank = rankMap[all[i + 1].severity];
        expect(currentRank).toBeLessThanOrEqual(nextRank);
      }
    });
  });
});
