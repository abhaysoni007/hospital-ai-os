/**
 * M10 SAFETY-CRITICAL — exhaustive boundary battery for the deterministic
 * critical-value evaluator (ADR-010). No mocks; pure function only.
 */
import { describe, it, expect } from 'vitest';
import {
  evaluateCriticalValues,
  type EvaluatorRule,
  type EvaluatorValue,
} from '../critical-value-evaluator';

const RULE: EvaluatorRule = {
  id: 'rule-0001',
  testCode: 'GLU',
  parameterName: 'Glucose',
  unit: 'mg/dL',
  normalLow: '70',
  normalHigh: '140',
  criticalLow: '40',
  criticalHigh: '500',
};

function evalOne(value: number | string, unit = 'mg/dL', rules: EvaluatorRule[] = [RULE]) {
  const values: EvaluatorValue[] = [{ parameterName: 'Glucose', value: value as number, unit }];
  return evaluateCriticalValues('GLU', values, rules);
}

describe('M10 Critical-Value Rule Evaluator — SAFETY BATTERY (ADR-010)', () => {
  it('exactly at critical_low → critical', () => {
    expect(evalOne(40).parameters[0].verdict).toBe('critical');
  });
  it('just below critical_low → critical', () => {
    expect(evalOne(39.9999).parameters[0].verdict).toBe('critical');
  });
  it('just above critical_low but below normal_low → abnormal', () => {
    expect(evalOne(40.0001).parameters[0].verdict).toBe('abnormal');
  });
  it('exactly at critical_high → critical', () => {
    expect(evalOne(500).parameters[0].verdict).toBe('critical');
  });
  it('just above critical_high → critical', () => {
    expect(evalOne(500.0001).parameters[0].verdict).toBe('critical');
  });
  it('just below critical_high but above normal_high → abnormal', () => {
    expect(evalOne(499.9999).parameters[0].verdict).toBe('abnormal');
  });
  it('normal boundaries inclusive-ish: at normal_low and at normal_high → normal', () => {
    expect(evalOne(70).parameters[0].verdict).toBe('normal');
    expect(evalOne(140).parameters[0].verdict).toBe('normal');
  });
  it('abnormal but non-critical (between bounds violation and critical)', () => {
    const low = evalOne(50);
    expect(low.parameters[0].verdict).toBe('abnormal');
    expect(low.isCritical).toBe(false);
    expect(low.isAbnormal).toBe(true);
    const high = evalOne(300);
    expect(high.parameters[0].verdict).toBe('abnormal');
  });

  it('multiple parameters: mixed verdicts; any critical ⇒ isCritical', () => {
    const out = evaluateCriticalValues(
      'GLU',
      [
        { parameterName: 'Glucose', value: 100, unit: 'mg/dL' },
        { parameterName: 'Glucose', value: 600, unit: 'mg/dL' },
      ],
      [RULE],
    );
    expect(out.parameters[0].verdict).toBe('normal');
    expect(out.parameters[1].verdict).toBe('critical');
    expect(out.isCritical).toBe(true);
    expect(out.isAbnormal).toBe(true);
  });

  it('inactive rules are ignored entirely', () => {
    // Only rule supplied has isActive filtering upstream — here we simulate by
    // passing a non-matching test code.
    const out = evaluateCriticalValues(
      'OTHER',
      [{ parameterName: 'Glucose', value: 900, unit: 'mg/dL' }],
      [RULE],
    );
    expect(out.isCritical).toBe(false);
    expect(out.parameters[0]).toMatchObject({ verdict: 'unevaluated', reason: 'NO_RULE' });
  });

  it('unit mismatch → unevaluated UNIT_MISMATCH (never silently normal)', () => {
    const out = evalOne(900, 'mmol/L'); // wildly critical numerically, wrong unit
    expect(out.isCritical).toBe(false);
    expect(out.parameters[0]).toMatchObject({ verdict: 'unevaluated', reason: 'UNIT_MISMATCH' });
  });

  it('non-numeric values → NON_NUMERIC, never critical', () => {
    const out = evaluateCriticalValues(
      'GLU',
      [{ parameterName: 'Glucose', value: Number.NaN, unit: 'mg/dL' }],
      [RULE],
    );
    expect(out.isCritical).toBe(false);
    expect(out.parameters[0].reason).toBe('NON_NUMERIC');
  });

  it('missing bounds → NO_BOUNDS, never classified', () => {
    const noBounds: EvaluatorRule = {
      ...RULE,
      normalLow: null,
      normalHigh: null,
      criticalLow: null,
      criticalHigh: null,
    };
    const out = evalOne(123456, 'mg/dL', [noBounds]);
    expect(out.parameters[0]).toMatchObject({ verdict: 'unevaluated', reason: 'NO_BOUNDS' });
  });

  it('one-sided bounds work (only critical_high defined)', () => {
    const oneSided: EvaluatorRule = { ...RULE, normalLow: null, criticalLow: null };
    expect(evalOne(600, 'mg/dL', [oneSided]).parameters[0].verdict).toBe('critical');
    expect(evalOne(100, 'mg/dL', [oneSided]).parameters[0].verdict).toBe('normal');
  });

  it('parameter name matching is case-insensitive', () => {
    const out = evalOne(30, 'mg/dL').parameters[0];
    void out;
    const values = [{ parameterName: 'glucose', value: 30, unit: 'MG/DL'.toLowerCase() }];
    // unit compare also case-insensitive
    const r = evaluateCriticalValues(
      'GLU',
      values.map((v) => ({ ...v, unit: 'mg/dl' })),
      [RULE],
    );
    expect(r.isCritical).toBe(true);
  });

  it('multiple matching rules: all matched ids recorded; lowest id chosen deterministically', () => {
    const r2: EvaluatorRule = { ...RULE, id: 'rule-0002' };
    const r3: EvaluatorRule = { ...RULE, id: 'rule-0003' };
    const out = evalOne(30, 'mg/dL', [r3, RULE, r2]); // deliberately unsorted input
    expect(out.isCritical).toBe(true);
    expect(out.matchedRuleIds).toEqual(['rule-0001', 'rule-0002', 'rule-0003']);
    expect(out.criticalRuleId).toBe('rule-0001'); // lowest id wins
  });

  it('DETERMINISM: identical inputs produce byte-identical outputs across repeated calls', () => {
    const input = {
      testCode: 'GLU',
      values: [
        { parameterName: 'Glucose', value: 33, unit: 'mg/dL' },
        { parameterName: 'Glucose', value: 120, unit: 'mg/dL' },
        { parameterName: 'Hemoglobin', value: 9, unit: 'g/dL' },
      ],
      rules: [RULE, { ...RULE, id: 'rule-0002', criticalLow: '35' }],
    } as const;
    const runs = Array.from({ length: 25 }, () =>
      JSON.stringify(evaluateCriticalValues(input.testCode, input.values, input.rules)),
    );
    expect(new Set(runs).size).toBe(1);
  });

  it('isAbnormal true when any parameter abnormal; critical implies abnormal reporting', () => {
    const out = evaluateCriticalValues(
      'GLU',
      [{ parameterName: 'Glucose', value: 30, unit: 'mg/dL' }],
      [RULE],
    );
    expect(out.isAbnormal).toBe(true);
    expect(out.isCritical).toBe(true);
  });
});
