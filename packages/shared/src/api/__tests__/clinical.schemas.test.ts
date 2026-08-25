import { describe, it, expect } from 'vitest';
import {
  createClinicalRecordSchema,
  updateClinicalRecordSchema,
  signClinicalRecordSchema,
  soapContentSchema,
  progressNoteContentSchema,
  vitalsSchema,
  contentSchemasByType,
} from '../clinical.schemas';

const validSoap = {
  recordType: 'soap' as const,
  content: {
    sections: [
      { heading: 'subjective', content: 'Chest pain for 2 days.' },
      { heading: 'objective', content: 'BP 140/90, SpO2 97%.' },
      { heading: 'assessment', content: 'Suspected angina.' },
      { heading: 'plan', content: 'ECG, troponin, admit.' },
    ],
  },
};

const validVitals = {
  temperature_c: 37.2,
  pulse_bpm: 88,
  resp_rate: 16,
  bp_systolic: 128,
  bp_diastolic: 82,
  spo2_pct: 98,
  weight_kg: 70.5,
  height_cm: 175,
};

describe('M9 Clinical Content Schemas (ADR-015)', () => {
  describe('SOAP content', () => {
    it('accepts exactly the four canonical headings in order', () => {
      expect(soapContentSchema.safeParse(validSoap.content).success).toBe(true);
    });

    it('rejects missing headings (tuple enforces all four)', () => {
      const bad = { sections: validSoap.content.sections.slice(0, 3) };
      expect(soapContentSchema.safeParse(bad).success).toBe(false);
    });

    it('rejects unknown headings', () => {
      const bad = {
        sections: validSoap.content.sections.map((s, i) =>
          i === 0 ? { heading: 'history', content: s.content } : s,
        ),
      };
      expect(soapContentSchema.safeParse(bad).success).toBe(false);
    });

    it('rejects empty or whitespace-only section content', () => {
      const bad = {
        sections: validSoap.content.sections.map((s, i) =>
          i === 1 ? { ...s, content: '   ' } : s,
        ),
      };
      expect(soapContentSchema.safeParse(bad).success).toBe(false);
    });

    it('trims and enforces the 10,000-char bound per section', () => {
      const padded = {
        sections: validSoap.content.sections.map((s, i) =>
          i === 0 ? { heading: 'subjective', content: `  ${'x'.repeat(10_000)}  ` } : s,
        ),
      };
      const result = soapContentSchema.safeParse(padded);
      expect(result.success).toBe(true);
      if (result.success) {
        expect((result.data.sections[0].content as string).length).toBe(10_000);
      }
      const tooLong = {
        sections: validSoap.content.sections.map((s, i) =>
          i === 0 ? { heading: 'subjective', content: 'x'.repeat(10_001) } : s,
        ),
      };
      expect(soapContentSchema.safeParse(tooLong).success).toBe(false);
    });
  });

  describe('Progress note content', () => {
    it('accepts a bounded narrative and trims it', () => {
      const r = progressNoteContentSchema.safeParse({ narrative: '  Patient improving.  ' });
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.narrative).toBe('Patient improving.');
    });

    it('rejects empty narrative and >20,000 chars', () => {
      expect(progressNoteContentSchema.safeParse({ narrative: '' }).success).toBe(false);
      expect(progressNoteContentSchema.safeParse({ narrative: 'x'.repeat(20_001) }).success).toBe(
        false,
      );
    });
  });

  describe('Vitals schema', () => {
    it('accepts a full valid panel', () => {
      expect(vitalsSchema.safeParse(validVitals).success).toBe(true);
    });

    it('requires at least one field', () => {
      expect(vitalsSchema.safeParse({}).success).toBe(false);
    });

    it.each([
      ['temperature_c', 50],
      ['pulse_bpm', 10],
      ['resp_rate', 100],
      ['bp_systolic', 350],
      ['bp_diastolic', 10],
      ['spo2_pct', 30],
      ['weight_kg', 900],
      ['height_cm', 10],
    ])('rejects out-of-range %s=%s', (field, value) => {
      expect(vitalsSchema.safeParse({ [field]: value }).success).toBe(false);
    });
  });

  describe('Create discriminated union', () => {
    it('accepts soap, progress_note, vital_signs variants', () => {
      expect(createClinicalRecordSchema.safeParse(validSoap).success).toBe(true);
      expect(
        createClinicalRecordSchema.safeParse({
          recordType: 'progress_note',
          content: { narrative: 'Daily round note.' },
        }).success,
      ).toBe(true);
      expect(
        createClinicalRecordSchema.safeParse({
          recordType: 'vital_signs',
          vitals: { pulse_bpm: 80 },
        }).success,
      ).toBe(true);
    });

    it('rejects vital_signs without any vitals value', () => {
      expect(
        createClinicalRecordSchema.safeParse({
          recordType: 'vital_signs',
          content: { note: 'looks fine' },
        }).success,
      ).toBe(false);
    });

    it('rejects discharge_summary creation in M9 (ADR-015 Decision 2)', () => {
      expect(
        createClinicalRecordSchema.safeParse({
          recordType: 'discharge_summary',
          content: { narrative: 'Ready for discharge.' },
        }).success,
      ).toBe(false);
    });

    it('rejects SOAP variant with vitals-only payload mismatch', () => {
      expect(
        createClinicalRecordSchema.safeParse({
          recordType: 'soap',
          content: { sections: [] },
        }).success,
      ).toBe(false);
    });
  });

  describe('Update + Sign contracts', () => {
    it('update requires expectedVersion and at least one mutable field', () => {
      expect(updateClinicalRecordSchema.safeParse({ expectedVersion: 2 }).success).toBe(false);
      expect(
        updateClinicalRecordSchema.safeParse({
          expectedVersion: 2,
          content: validSoap.content,
        }).success,
      ).toBe(true);
      expect(
        updateClinicalRecordSchema.safeParse({
          expectedVersion: 2,
          vitals: { pulse_bpm: 90 },
        }).success,
      ).toBe(true);
    });

    it('update rejects non-positive expectedVersion', () => {
      expect(
        updateClinicalRecordSchema.safeParse({ expectedVersion: 0, vitals: { pulse_bpm: 70 } })
          .success,
      ).toBe(false);
    });

    it('sign requires expectedVersion', () => {
      expect(signClinicalRecordSchema.safeParse({ expectedVersion: 3 }).success).toBe(true);
      expect(signClinicalRecordSchema.safeParse({}).success).toBe(false);
    });
  });

  describe('Per-type content validators (service-side update validation)', () => {
    it('maps every record type to a validator', () => {
      expect(contentSchemasByType.soap.safeParse(validSoap.content).success).toBe(true);
      expect(contentSchemasByType.vital_signs.safeParse({ note: 'stable' }).success).toBe(true);
      expect(contentSchemasByType.vital_signs.safeParse({ note: 'x'.repeat(2001) }).success).toBe(
        false,
      );
      expect(contentSchemasByType.discharge_summary.safeParse({ narrative: 'n' }).success).toBe(
        true,
      );
    });
  });
});
