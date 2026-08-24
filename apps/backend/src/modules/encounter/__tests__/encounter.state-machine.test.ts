import { describe, it, expect } from 'vitest';
import {
  canTransition,
  isValidEncounterStatus,
  ENCOUNTER_TRANSITIONS,
} from '../encounter.state-machine';

describe('M8 Encounter State Machine — Slice 1 (registered → active only)', () => {
  describe('allowed transitions', () => {
    it('registered → active PASSES', () => {
      expect(canTransition('registered', 'active')).toBe(true);
    });
  });

  describe('forbidden transitions (exhaustive)', () => {
    const all: Array<[string, string]> = [];
    for (const from of Object.keys(ENCOUNTER_TRANSITIONS)) {
      for (const to of Object.keys(ENCOUNTER_TRANSITIONS)) {
        all.push([from, to]);
      }
    }

    it.each(all)('%s → %s', (from, to) => {
      if (from === 'registered' && to === 'active') {
        expect(canTransition(from as never, to as never)).toBe(true);
      } else {
        expect(canTransition(from as never, to as never)).toBe(false);
      }
    });

    it('registered → discharged FAILS', () => {
      expect(canTransition('registered', 'discharged')).toBe(false);
    });

    it('active → registered FAILS', () => {
      expect(canTransition('active', 'registered')).toBe(false);
    });

    it('active → closed FAILS', () => {
      expect(canTransition('active', 'closed')).toBe(false);
    });

    it('active → discharge_initiated FAILS in slice 1 (M13 territory)', () => {
      expect(canTransition('active', 'discharge_initiated')).toBe(false);
    });

    it('terminal states transition to nothing', () => {
      for (const terminal of ['discharge_initiated', 'discharged', 'closed'] as const) {
        for (const to of Object.keys(ENCOUNTER_TRANSITIONS)) {
          expect(canTransition(terminal, to as never)).toBe(false);
        }
      }
    });
  });

  describe('status guard', () => {
    it('accepts exactly the five pgEnum values', () => {
      expect(isValidEncounterStatus('registered')).toBe(true);
      expect(isValidEncounterStatus('active')).toBe(true);
      expect(isValidEncounterStatus('discharge_initiated')).toBe(true);
      expect(isValidEncounterStatus('discharged')).toBe(true);
      expect(isValidEncounterStatus('closed')).toBe(true);
    });

    it('rejects legacy/unknown values', () => {
      expect(isValidEncounterStatus('planned')).toBe(false);
      expect(isValidEncounterStatus('in_progress')).toBe(false);
      expect(isValidEncounterStatus('CHECKED_IN')).toBe(false);
      expect(isValidEncounterStatus(undefined)).toBe(false);
      expect(isValidEncounterStatus(42)).toBe(false);
    });
  });
});
