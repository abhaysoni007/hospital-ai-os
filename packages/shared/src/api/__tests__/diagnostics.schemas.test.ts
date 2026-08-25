import { describe, it, expect } from 'vitest';
import {
  createDiagnosticOrderSchema,
  getDiagnosticOrdersQuerySchema,
  enterResultSchema,
  resultValueSchema,
  cancelDiagnosticOrderSchema,
} from '../diagnostics.schemas';

describe('M10 Diagnostics Schemas', () => {
  describe('order creation', () => {
    it('accepts a valid order with defaults', () => {
      const r = createDiagnosticOrderSchema.safeParse({
        testCode: 'CBC',
        testName: 'Complete Blood Count',
      });
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.priority).toBe('routine');
    });

    it('trims test code and name', () => {
      const r = createDiagnosticOrderSchema.safeParse({
        testCode: '  CBC  ',
        testName: '  Complete Blood Count ',
      });
      expect(r.success).toBe(true);
      if (r.success) {
        expect(r.data.testCode).toBe('CBC');
        expect(r.data.testName).toBe('Complete Blood Count');
      }
    });

    it('rejects empty test code / name and oversized indication', () => {
      expect(createDiagnosticOrderSchema.safeParse({ testCode: '', testName: 'X' }).success).toBe(
        false,
      );
      expect(createDiagnosticOrderSchema.safeParse({ testCode: 'CBC', testName: '' }).success).toBe(
        false,
      );
      expect(
        createDiagnosticOrderSchema.safeParse({
          testCode: 'CBC',
          testName: 'CBC',
          clinicalIndication: 'x'.repeat(2001),
        }).success,
      ).toBe(false);
    });

    it('rejects invalid priority', () => {
      expect(
        createDiagnosticOrderSchema.safeParse({
          testCode: 'CBC',
          testName: 'CBC',
          priority: 'yesterday',
        }).success,
      ).toBe(false);
    });
  });

  describe('queue query', () => {
    it('accepts filters', () => {
      const r = getDiagnosticOrdersQuerySchema.safeParse({
        status: 'sample_collected',
        priority: 'stat',
        date: '2026-08-25',
        page: 2,
        pageSize: 20,
      });
      expect(r.success).toBe(true);
    });

    it('rejects invalid status/priority/date', () => {
      expect(getDiagnosticOrdersQuerySchema.safeParse({ status: 'queued' }).success).toBe(false);
      expect(getDiagnosticOrdersQuerySchema.safeParse({ priority: 'ASAP' }).success).toBe(false);
      expect(getDiagnosticOrdersQuerySchema.safeParse({ date: 'not-a-date' }).success).toBe(false);
    });
  });

  describe('result entry — evaluator fields are NEVER caller-settable', () => {
    const value = { parameterName: 'Potassium', value: 6.4, unit: 'mmol/L' };

    it('accepts bounded result values', () => {
      expect(enterResultSchema.safeParse({ resultValues: [value] }).success).toBe(true);
    });

    it('rejects empty arrays', () => {
      expect(enterResultSchema.safeParse({ resultValues: [] }).success).toBe(false);
    });

    it('rejects non-numeric values (NON_NUMERIC path)', () => {
      expect(
        resultValueSchema.safeParse({ parameterName: 'Color', value: 'clear', unit: '' }).success,
      ).toBe(false);
    });

    it('strips/rejects unknown keys on strict values', () => {
      expect(resultValueSchema.safeParse({ ...value, isCritical: true }).success).toBe(false);
    });

    it('ignores caller-supplied evaluator outputs entirely (not in schema)', () => {
      const parsed = enterResultSchema.safeParse({
        resultValues: [value],
        isCritical: true,
        isAbnormal: true,
        criticalRuleId: crypto.randomUUID(),
      });
      // Extra top-level keys are stripped by default object parsing…
      expect(parsed.success).toBe(true);
      // …and the parsed data contains NO evaluator-owned fields.
      if (parsed.success) {
        expect(parsed.data).not.toHaveProperty('isCritical');
        expect(parsed.data).not.toHaveProperty('isAbnormal');
        expect(parsed.data).not.toHaveProperty('criticalRuleId');
      }
    });
  });

  describe('cancellation', () => {
    it('accepts optional bounded reason', () => {
      expect(cancelDiagnosticOrderSchema.safeParse({}).success).toBe(true);
      expect(cancelDiagnosticOrderSchema.safeParse({ reason: 'x'.repeat(501) }).success).toBe(
        false,
      );
    });
  });
});
