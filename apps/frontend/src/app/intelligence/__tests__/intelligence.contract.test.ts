import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve as resolveAbsolute } from 'node:path';

const PAGE_SRC = resolveAbsolute(__dirname, '../page.tsx');
const HEADER_SRC = resolveAbsolute(__dirname, '../components/IntelligenceHeader.tsx');
const SUMMARY_SRC = resolveAbsolute(__dirname, '../components/OperationalSummaryBar.tsx');
const STREAM_SRC = resolveAbsolute(__dirname, '../components/SignalStream.tsx');
const DETAIL_SRC = resolveAbsolute(__dirname, '../components/SignalDetailPane.tsx');
const APPROVE_MODAL_SRC = resolveAbsolute(__dirname, '../components/ApproveActionModal.tsx');
const REJECT_MODAL_SRC = resolveAbsolute(__dirname, '../components/RejectActionModal.tsx');
const STATES_SRC = resolveAbsolute(__dirname, '../components/IntelligenceStates.tsx');

describe('M19.4 Hospital Intelligence Center — Architecture & Contract Test', () => {
  const pageTsx = readFileSync(PAGE_SRC, 'utf8');
  const headerTsx = readFileSync(HEADER_SRC, 'utf8');
  const summaryTsx = readFileSync(SUMMARY_SRC, 'utf8');
  const streamTsx = readFileSync(STREAM_SRC, 'utf8');
  const detailTsx = readFileSync(DETAIL_SRC, 'utf8');
  const approveModalTsx = readFileSync(APPROVE_MODAL_SRC, 'utf8');
  const rejectModalTsx = readFileSync(REJECT_MODAL_SRC, 'utf8');
  const statesTsx = readFileSync(STATES_SRC, 'utf8');

  describe('1. Zero-Fake Policy & Real M19 Data Integrity', () => {
    it('does not contain any fabricated scores or fake confidence metrics', () => {
      // Must not contain fake health scores or fake predictive metrics
      expect(pageTsx).not.toMatch(/healthScore|riskScore|efficiencyPercentage|aiConfidence/i);
      expect(summaryTsx).not.toMatch(/healthScore|riskScore|efficiencyPercentage|aiConfidence/i);
      expect(detailTsx).not.toMatch(/healthScore|riskScore|efficiencyPercentage|aiConfidence/i);
    });

    it('computes summary metrics strictly from detected signals array', () => {
      // Total count
      expect(summaryTsx).toMatch(/totalCount\s*=\s*signals\.length/);
      // Critical SLA count
      expect(summaryTsx).toMatch(/criticalCount\s*=\s*signals\.filter\(\(s\)\s*=>\s*s\.severity\s*===\s*['"]CRITICAL['"]\)\.length/);
      // Diagnostic blockers count
      expect(summaryTsx).toMatch(/diagnosticCount\s*=\s*signals\.filter\(\s*\(s\)\s*=>\s*s\.signalType\s*===\s*['"]PENDING_DIAGNOSTIC_RESULT['"]/);
      // Documentation gaps count
      expect(summaryTsx).toMatch(/documentationCount\s*=\s*signals\.filter\(\s*\(s\)\s*=>\s*s\.signalType\s*===\s*['"]ENCOUNTER_WITHOUT_CLINICAL_RECORD['"]/);
    });

    it('triggers analysis on-demand only without automated polling or mount-time auto-fetch', () => {
      // Must not have an automated fetch in useEffect on mount
      expect(pageTsx).not.toMatch(/useEffect\(\(\)\s*=>\s*\{\s*[^}]*intelligenceService\.analyzeOperations/);
      // Analysis is triggered via user action on the primary button
      expect(pageTsx).toMatch(/const\s+handleRunAnalysis\s*=\s*async/);
      expect(headerTsx).toMatch(/onClick=\{onRunAnalysis\}/);
    });
  });

  describe('2. The Three Hero Signals Representation', () => {
    it('documents and surfaces all 3 deterministic hero signal types', () => {
      // PENDING_DIAGNOSTIC_RESULT
      expect(streamTsx).toMatch(/PENDING_DIAGNOSTIC_RESULT/);
      expect(statesTsx).toMatch(/Pending Diagnostic Results/);

      // CRITICAL_RESULT_UNACKNOWLEDGED
      expect(streamTsx).toMatch(/CRITICAL_RESULT_UNACKNOWLEDGED/);
      expect(statesTsx).toMatch(/Critical Alerts Unacknowledged/);

      // ENCOUNTER_WITHOUT_CLINICAL_RECORD
      expect(streamTsx).toMatch(/ENCOUNTER_WITHOUT_CLINICAL_RECORD/);
      expect(statesTsx).toMatch(/Active Encounters Without Notes/);
    });
  });

  describe('3. Evidence as First-Class Ground Truth', () => {
    it('displays inspectable evidence table distinct from AI interpretations', () => {
      // Evidence stage in detail pane
      expect(detailTsx).toMatch(/Deterministic Rule Engine \(Ground Truth\)/);
      expect(detailTsx).toMatch(/Supporting Audit Evidence/);
      expect(detailTsx).toMatch(/evidenceRefs\.map/);
      expect(detailTsx).toMatch(/ref\.sourceType/);
      expect(detailTsx).toMatch(/ref\.evidenceStatus/);
      expect(detailTsx).toMatch(/ref\.relationToSignal/);
    });

    it('provides read-only deep links to authorized application resources', () => {
      expect(detailTsx).toMatch(/href=\{`\/diagnostics`\}/);
      expect(detailTsx).toMatch(/href=\{`\/encounters`\}/);
      expect(detailTsx).toMatch(/href=\{`\/patients\/\$\{signal\.patientId\}`\}/);
    });
  });

  describe('4. Bounded AI Operational Briefing & Safe Degradation', () => {
    it('labels AI explanations as advisory only and disclaims autonomous clinical judgment', () => {
      expect(detailTsx).toMatch(/Bounded AI Operational Briefing \(Advisory Only\)/);
      expect(detailTsx).toMatch(/aiExplanation\.disclaimers/);
    });

    it('gracefully degrades when aiExplanation is null while preserving deterministic signals', () => {
      expect(detailTsx).toMatch(/signal\.aiExplanation\s*\?/);
      expect(detailTsx).toMatch(/AI Advisory Subsystem Degraded or Offline/);
      expect(detailTsx).toMatch(/Deterministic bottleneck detection and supporting audit evidence remain fully authoritative/);
    });
  });

  describe('5. Governed Human Authorization & Bounded Vocabulary', () => {
    it('enforces human approval permission (intelligence:approve)', () => {
      // Permission check in page
      expect(pageTsx).toMatch(/canApprove\s*=\s*hasPermission\(user\?\.role,\s*['"]intelligence:approve['"]\)/);
      // Disabled state in detail pane when unauthorized
      expect(detailTsx).toMatch(/disabled=\{!canApprove\}/);
      expect(detailTsx).toMatch(/Approval restricted to Attending Physicians and Hospital Administrators/);
    });

    it('generates an idempotencyKey for every approval submission', () => {
      expect(approveModalTsx).toMatch(/crypto\.randomUUID\(\)/);
      expect(approveModalTsx).toMatch(/onConfirm\(idempotencyKey\)/);
      expect(pageTsx).toMatch(/intelligenceService\.approveRecommendation\(recId,\s*idempotencyKey\)/);
    });

    it('captures an optional rejection reason during human decline workflow', () => {
      expect(rejectModalTsx).toMatch(/reason/);
      expect(rejectModalTsx).toMatch(/onConfirm\(reason\.trim\(\)/);
      expect(pageTsx).toMatch(/intelligenceService\.rejectRecommendation\(recId,\s*reason\)/);
    });

    it('does NOT contain unauthorized autonomous clinical actions', () => {
      // Must not prescribe, diagnose, discharge or sign clinical records
      expect(pageTsx).not.toMatch(/ACTION_PRESCRIBE|ACTION_DISCHARGE|ACTION_SIGN_NOTE/);
      expect(detailTsx).not.toMatch(/ACTION_PRESCRIBE|ACTION_DISCHARGE|ACTION_SIGN_NOTE/);
    });
  });

  describe('6. State Handling & Accessibility', () => {
    it('provides distinct states for idle, loading, zero-signals, and error', () => {
      expect(statesTsx).toMatch(/function IdleState/);
      expect(statesTsx).toMatch(/function LoadingState/);
      expect(statesTsx).toMatch(/function ZeroSignalsState/);
      expect(statesTsx).toMatch(/function ErrorBanner/);
    });

    it('uses accessible landmarks, tabs, and ARIA roles', () => {
      expect(summaryTsx).toMatch(/role="region"/);
      expect(streamTsx).toMatch(/role="tablist"/);
      expect(streamTsx).toMatch(/role="tab"/);
      expect(streamTsx).toMatch(/aria-selected/);
      expect(approveModalTsx).toMatch(/role="dialog"/);
      expect(approveModalTsx).toMatch(/aria-modal="true"/);
      expect(rejectModalTsx).toMatch(/role="dialog"/);
      expect(rejectModalTsx).toMatch(/aria-modal="true"/);
    });
  });
});
