import { describe, expect, it } from 'vitest';
import type { AppointmentStatusValue, EncounterStatusValue } from 'shared';

import {
  appointmentStatusMeta,
  encounterStatusMeta,
  orderStatusMeta,
  priorityMeta,
  recordStatusMeta,
  resultStatusMeta,
  gapCodeLabel,
  citationSourceLabel,
} from '../statusMeta';

/**
 * M13 — centralized status presentation metadata.
 * Statuses must never be invented: unknown values degrade to the raw value
 * with the neutral variant. Critical states always carry a text label (never
 * color alone).
 */
describe('statusMeta presentation mapping', () => {
  it('maps every frozen appointment status to label + variant', () => {
    const statuses: AppointmentStatusValue[] = [
      'booked',
      'checked_in',
      'in_consult',
      'completed',
      'cancelled',
    ];
    for (const s of statuses) {
      const meta = appointmentStatusMeta(s);
      expect(meta.label).not.toBe(s); // human-readable, not raw enum
      expect(meta.label.length).toBeGreaterThan(0);
    }
    expect(appointmentStatusMeta('completed').variant).toBe('stable');
    expect(appointmentStatusMeta('in_consult').variant).toBe('primary');
  });

  it('maps encounter lifecycle with distinct active vs terminal states', () => {
    const statuses: EncounterStatusValue[] = [
      'registered',
      'active',
      'discharge_initiated',
      'discharged',
      'closed',
    ];
    for (const s of statuses) {
      expect(encounterStatusMeta(s).label.length).toBeGreaterThan(0);
    }
    expect(encounterStatusMeta('active').variant).toBe('primary');
    expect(encounterStatusMeta('discharge_initiated').variant).toBe('urgent');
  });

  it('STAT priority is unmistakable and labeled', () => {
    expect(priorityMeta('stat')).toEqual({ label: 'STAT', variant: 'critical' });
    expect(priorityMeta('urgent').variant).toBe('urgent');
    expect(priorityMeta('routine').variant).toBe('pending');
    // notification priorities share the same vocabulary
    expect(priorityMeta('critical').variant).toBe('critical');
    expect(priorityMeta('normal').variant).toBe('info');
  });

  it('result statuses communicate verification semantics', () => {
    expect(resultStatusMeta('preliminary').label).toContain('verification required');
    expect(resultStatusMeta('verified').label).toContain('locked');
    expect(resultStatusMeta('critical_flagged').variant).toBe('critical');
  });

  it('record statuses distinguish draft from immutable signed state', () => {
    expect(recordStatusMeta('draft').label).toBe('Draft');
    expect(recordStatusMeta('signed').label).toContain('locked');
  });

  it('order statuses cover the M10 lifecycle', () => {
    expect(orderStatusMeta('ordered').variant).toBe('pending');
    expect(orderStatusMeta('sample_collected').variant).toBe('info');
    expect(orderStatusMeta('completed').variant).toBe('stable');
  });

  it('never invents labels for unknown values', () => {
    expect(appointmentStatusMeta('mystery_status').label).toBe('mystery_status');
    expect(appointmentStatusMeta('mystery_status').variant).toBe('neutral');
    expect(priorityMeta('unknown')).toEqual({ label: 'unknown', variant: 'neutral' });
  });

  it('gap codes render as clinician-readable "not documented" statements', () => {
    expect(gapCodeLabel('NO_VITALS_SIGNS')).toBe('Vital signs not documented');
    expect(gapCodeLabel('NO_ALLERGY_DATA')).toBe('Allergy data not documented');
    // unknown codes degrade honestly
    expect(gapCodeLabel('SOMETHING_ELSE')).toBe('something else');
  });

  it('citation source types get short chip labels', () => {
    expect(citationSourceLabel('CLINICAL_RECORD')).toBe('Clinical record');
    expect(citationSourceLabel('DIAGNOSTIC_RESULT')).toBe('Diagnostic result');
  });
});
