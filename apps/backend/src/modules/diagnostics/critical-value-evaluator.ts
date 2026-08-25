/**
 * M10 — Deterministic critical-value evaluator (ADR-010, ADR-016).
 *
 * PURE: no DB, no HTTP, no clock, no randomness, no AI, no external calls.
 * Same inputs ⇒ structurally identical output, always.
 *
 * Rules:
 *   critical : value <= critical_low  OR  value >= critical_high  (INCLUSIVE)
 *   abnormal : outside [normal_low, normal_high] (when bounds present)
 *   unevaluated (never silently "normal"):
 *     UNIT_MISMATCH — supplied unit ≠ rule unit
 *     NON_NUMERIC   — value is not a finite number
 *     NO_RULE       — no active rule for the parameter
 *     NO_BOUNDS     — rule exists but has no usable bounds
 *
 * Multiple matching rules: all recorded in matchedRuleIds; the single
 * `criticalRuleId` is the LOWEST rule id (deterministic tie-break).
 */

export interface EvaluatorRule {
  id: string;
  testCode: string;
  parameterName: string;
  unit: string;
  normalLow: string | number | null;
  normalHigh: string | number | null;
  criticalLow: string | number | null;
  criticalHigh: string | number | null;
}

export interface EvaluatorValue {
  parameterName: string;
  value: number;
  unit: string;
}

export type Verdict = 'normal' | 'abnormal' | 'critical' | 'unevaluated';

export interface ParameterEvaluationResult {
  parameterName: string;
  suppliedUnit: string;
  verdict: Verdict;
  reason?: 'UNIT_MISMATCH' | 'NON_NUMERIC' | 'NO_RULE' | 'NO_BOUNDS';
  bounds?: {
    normalLow: number | null;
    normalHigh: number | null;
    criticalLow: number | null;
    criticalHigh: number | null;
  };
}

export interface EvaluationOutput {
  parameters: ParameterEvaluationResult[];
  isAbnormal: boolean;
  isCritical: boolean;
  matchedRuleIds: string[];
  /** Lowest rule id among critical matches — persisted as critical_rule_id. */
  criticalRuleId: string | null;
}

function toNumber(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Exact-enough numeric comparison for Decimal(10,4) values. */
function cmp(a: number, b: number): number {
  return a === b ? 0 : a < b ? -1 : 1;
}

export function evaluateCriticalValues(
  testCode: string,
  resultValues: readonly EvaluatorValue[],
  rules: readonly EvaluatorRule[],
): EvaluationOutput {
  const activeRules = rules.filter((r) => r.testCode === testCode);
  const matchedRuleIds = new Set<string>();
  let anyAbnormal = false;
  let anyCritical = false;

  // Deterministic rule ordering up-front.
  const sortedRules = [...activeRules].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  const parameters: ParameterEvaluationResult[] = resultValues.map((rv) => {
    const base = { parameterName: rv.parameterName, suppliedUnit: rv.unit };

    // NON_NUMERIC guard (schema normally rejects these; defense-in-depth).
    if (typeof rv.value !== 'number' || !Number.isFinite(rv.value)) {
      return { ...base, verdict: 'unevaluated' as const, reason: 'NON_NUMERIC' };
    }

    const applicable = sortedRules.filter(
      (r) => r.parameterName.toLowerCase() === rv.parameterName.toLowerCase(),
    );

    if (applicable.length === 0) {
      return { ...base, verdict: 'unevaluated' as const, reason: 'NO_RULE' };
    }

    // Evaluate against EVERY applicable rule; strictest verdict wins.
    let verdict: Verdict = 'unevaluated';
    let reason: ParameterEvaluationResult['reason'] = undefined;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let bestBounds: any = undefined;

    for (const rule of applicable) {
      const normalLow = toNumber(rule.normalLow);
      const normalHigh = toNumber(rule.normalHigh);
      const criticalLow = toNumber(rule.criticalLow);
      const criticalHigh = toNumber(rule.criticalHigh);

      if (
        normalLow === null &&
        normalHigh === null &&
        criticalLow === null &&
        criticalHigh === null
      ) {
        if (verdict === 'unevaluated') {
          verdict = 'unevaluated';
          reason = 'NO_BOUNDS';
        }
        continue;
      }

      const unitOk = rule.unit.trim().toLowerCase() === rv.unit.trim().toLowerCase();

      const bounds = {
        normalLow,
        normalHigh,
        criticalLow,
        criticalHigh,
      };

      if (!unitOk) {
        // UNIT_MISMATCH never counts as normal.
        if (verdict !== 'critical') {
          verdict = 'unevaluated';
          reason = 'UNIT_MISMATCH';
          bestBounds = bounds;
        }
        continue;
      }

      let ruleVerdict: Verdict;
      let hit = false;

      if (
        (criticalLow !== null && cmp(rv.value, criticalLow) <= 0) ||
        (criticalHigh !== null && cmp(rv.value, criticalHigh) >= 0)
      ) {
        ruleVerdict = 'critical';
        hit = true;
      } else if (normalLow !== null && cmp(rv.value, normalLow) < 0) {
        ruleVerdict = 'abnormal';
      } else if (normalHigh !== null && cmp(rv.value, normalHigh) > 0) {
        ruleVerdict = 'abnormal';
      } else {
        ruleVerdict = 'normal';
      }

      if (ruleVerdict === 'critical') {
        verdict = 'critical';
        reason = undefined;
        bestBounds = bounds;
        matchedRuleIds.add(rule.id); // every tripped rule recorded
        anyCritical = true;
      } else if (verdict !== 'critical') {
        // Strictest of normal/abnormal wins while not already critical.
        if (ruleVerdict === 'abnormal' || verdict === 'unevaluated') {
          verdict = ruleVerdict;
          reason = undefined;
          bestBounds = bounds;
        }
      }
      void hit;
    }

    if (verdict === 'abnormal') anyAbnormal = true;
    if (verdict === 'critical') anyAbnormal = true; // critical implies abnormal reporting

    return {
      ...base,
      verdict,
      ...(reason ? { reason } : {}),
      ...(bestBounds ? { bounds: bestBounds } : {}),
    };
  });

  const orderedMatches = [...matchedRuleIds].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  return {
    parameters,
    isAbnormal: anyAbnormal,
    isCritical: anyCritical,
    matchedRuleIds: orderedMatches,
    criticalRuleId: anyCritical && orderedMatches.length > 0 ? orderedMatches[0] : null,
  };
}
