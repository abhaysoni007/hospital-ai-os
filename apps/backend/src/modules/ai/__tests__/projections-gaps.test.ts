import { describe, expect, it } from 'vitest';
import {
  buildInputManifest,
  computeInformationGaps,
  parseContextBlock,
} from '../context/projections';
import { baseBlocks, ID_A, ID_B, ID_C } from './fixtures';

describe('Context projection enforcement (ADR-018 §2)', () => {
  it('FAILS CLOSED on unknown block types', () => {
    expect(() =>
      parseContextBlock({ blockType: 'insurance_records', policyNumber: 'X' }),
    ).toThrow();
  });

  it('rejects forbidden identifier fields via strict schemas', () => {
    expect(() =>
      parseContextBlock({
        blockType: 'clinical_record',
        sourceId: ID_A,
        recordType: 'soap',
        version: 1,
        recordedAt: new Date().toISOString(),
        textContent: 'text',
        authorName: 'Dr. House',
      }),
    ).toThrow();
  });

  it('accepts contract-valid blocks and derives the manifest mechanically', () => {
    const captured = new Date('2026-08-26T10:00:00Z');
    const manifest = buildInputManifest(baseBlocks, captured);
    expect(manifest).toEqual([
      {
        sourceType: 'CLINICAL_RECORD',
        sourceId: ID_A,
        version: 1,
        capturedAt: captured.toISOString(),
      },
      { sourceType: 'DIAGNOSTIC_ORDER', sourceId: ID_B, capturedAt: captured.toISOString() },
      { sourceType: 'DIAGNOSTIC_RESULT', sourceId: ID_C, capturedAt: captured.toISOString() },
    ]);
  });
});

describe('Deterministic gap detection (ADR-018 §6)', () => {
  it('soap note_draft computes gaps from missing blocks — deterministically ordered', () => {
    const minimal = baseBlocks.filter((b) => b.blockType === 'patient_demographics');
    expect(computeInformationGaps('note_draft', minimal)).toEqual([
      'NO_CHIEF_COMPLAINT',
      'NO_VITALS_SIGNS',
      'NO_PRIOR_NOTES',
      'NO_DIAGNOSTIC_ORDERS',
      'NO_DIAGNOSTIC_RESULTS',
      'NO_MEDICATION_HISTORY',
      'NO_ALLERGY_DATA',
    ]);
  });

  it('rich context reduces gaps; medication/allergy always surfaced (no module yet)', () => {
    expect(computeInformationGaps('note_draft', baseBlocks)).toEqual([
      'NO_PRIOR_NOTES',
      'NO_MEDICATION_HISTORY',
      'NO_ALLERGY_DATA',
    ]);
  });

  it('is deterministic across repeated invocations', () => {
    const a = computeInformationGaps('note_draft', baseBlocks);
    const b = computeInformationGaps('note_draft', baseBlocks);
    expect(a).toEqual(b);
  });

  it('chart_search uses the read-only gap rule set', () => {
    const empty = computeInformationGaps('chart_search', []);
    expect(empty).toContain('NO_PRIOR_NOTES');
    expect(empty).toContain('NO_DIAGNOSTIC_RESULTS');
    expect(empty).not.toContain('NO_CHIEF_COMPLAINT');
  });

  it('hospital_bottleneck computes gaps when encounters or orders are missing', () => {
    const empty = computeInformationGaps('hospital_bottleneck', []);
    expect(empty).toContain('NO_ACTIVE_ENCOUNTERS');
    expect(empty).toContain('NO_PENDING_ORDERS');

    const withEnc = computeInformationGaps('hospital_bottleneck', baseBlocks);
    expect(withEnc).not.toContain('NO_ACTIVE_ENCOUNTERS');
    expect(withEnc).not.toContain('NO_PENDING_ORDERS');
  });

  it('rejects unknown capabilities (fail closed)', () => {
    expect(() => computeInformationGaps('autonomous_diagnosis', baseBlocks)).toThrow();
  });
});
