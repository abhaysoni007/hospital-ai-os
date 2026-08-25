import { describe, it, expect } from 'vitest';
import {
  ORDER_TRANSITIONS,
  RESULT_TRANSITIONS,
  canOrderTransition,
  canResultTransition,
  RESULT_ENTRY_ALLOWED,
} from '../diagnostics.state-machine';

describe('M10 Order State Machine (ADR-016)', () => {
  const statuses = Object.keys(ORDER_TRANSITIONS);
  const all: Array<[string, string]> = [];
  for (const f of statuses) for (const t of statuses) all.push([f, t]);

  it.each(all)('order %s → %s', (from, to) => {
    const legal =
      (from === 'ordered' && (to === 'sample_collected' || to === 'cancelled')) ||
      (from === 'sample_collected' && (to === 'in_progress' || to === 'completed')) ||
      (from === 'in_progress' && to === 'completed');
    expect(canOrderTransition(from as never, to as never)).toBe(legal);
  });

  it('terminal order states are closed', () => {
    for (const to of statuses) {
      expect(canOrderTransition('completed', to as never)).toBe(false);
      expect(canOrderTransition('cancelled', to as never)).toBe(false);
    }
  });

  it('cancel only from ordered; impossible after collection', () => {
    expect(canOrderTransition('sample_collected', 'cancelled')).toBe(false);
    expect(canOrderTransition('completed', 'cancelled')).toBe(false);
  });
});

describe('M10 Result State Machine', () => {
  const statuses = Object.keys(RESULT_TRANSITIONS);
  const all: Array<[string, string]> = [];
  for (const f of statuses) for (const t of statuses) all.push([f, t]);

  it.each(all)('result %s → %s', (from, to) => {
    const legal =
      (from === 'preliminary' && (to === 'verified' || to === 'critical_flagged')) ||
      (from === 'critical_flagged' && to === 'verified');
    expect(canResultTransition(from as never, to as never)).toBe(legal);
  });

  it('verified results are immutable', () => {
    for (const to of statuses) {
      expect(canResultTransition('verified', to as never)).toBe(false);
    }
  });

  it('critical_flagged cannot return to preliminary', () => {
    expect(canResultTransition('critical_flagged', 'preliminary')).toBe(false);
  });

  it('result entry allowed from sample_collected and in_progress only', () => {
    expect(RESULT_ENTRY_ALLOWED).toEqual(['sample_collected', 'in_progress']);
  });
});
