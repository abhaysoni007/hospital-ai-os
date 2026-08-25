import { describe, it, expect } from 'vitest';
import {
  canClinicalTransition,
  isValidClinicalStatus,
  CLINICAL_TRANSITIONS,
} from '../clinical.state-machine';

describe('M9 Clinical State Machine (ADR-015: draft ⇄ draft → signed; amended reserved)', () => {
  const all: Array<[string, string]> = [];
  for (const from of Object.keys(CLINICAL_TRANSITIONS)) {
    for (const to of Object.keys(CLINICAL_TRANSITIONS)) {
      all.push([from, to]);
    }
  }

  it.each(all)('%s → %s', (from, to) => {
    if (from === 'draft' && (to === 'draft' || to === 'signed')) {
      expect(canClinicalTransition(from as never, to as never)).toBe(true);
    } else {
      expect(canClinicalTransition(from as never, to as never)).toBe(false);
    }
  });

  it('signed records are immutable — no outgoing transitions', () => {
    for (const to of Object.keys(CLINICAL_TRANSITIONS)) {
      expect(canClinicalTransition('signed', to as never)).toBe(false);
    }
  });

  it('amended is reserved and unreachable in M9', () => {
    expect(canClinicalTransition('amended', 'draft')).toBe(false);
    expect(canClinicalTransition('amended', 'signed')).toBe(false);
    expect(canClinicalTransition('draft', 'amended')).toBe(false);
    expect(canClinicalTransition('signed', 'amended')).toBe(false);
  });

  describe('status guard', () => {
    it('accepts exactly the three pgEnum values', () => {
      expect(isValidClinicalStatus('draft')).toBe(true);
      expect(isValidClinicalStatus('signed')).toBe(true);
      expect(isValidClinicalStatus('amended')).toBe(true);
    });

    it('rejects unknown values (fail closed)', () => {
      expect(isValidClinicalStatus('void')).toBe(false);
      expect(isValidClinicalStatus('SIGNED')).toBe(false);
      expect(isValidClinicalStatus(undefined)).toBe(false);
      expect(isValidClinicalStatus(1)).toBe(false);
    });
  });
});
