import { describe, expect, it } from 'vitest';
import {
  soapNoteDraftOutputSchema,
  chartAnswerOutputSchema,
  contextBlockSchema,
  citationSchema,
  inputManifestEntrySchema,
  noteDraftRequestPrimitiveSchema,
  patientDemographicsBlockSchema,
} from '../ai.schemas';

const CITATION = {
  sourceType: 'CLINICAL_RECORD',
  sourceId: '3f2504e0-4f89-11d3-9a0c-0305e82c3301',
  excerpt: 'BP 140/90',
};

function soap(overrides?: Partial<{ headings: string[]; content: string }>) {
  const order = overrides?.headings ?? ['subjective', 'objective', 'assessment', 'plan'];
  return {
    sections: order.map((heading) => ({
      heading,
      content: overrides?.content ?? 'Findings documented.',
      citations: [CITATION],
    })),
    disclaimers: ['AI-generated draft for clinician review.'],
    informationGaps: [],
  };
}

describe('M11 AI shared contracts', () => {
  it('accepts a well-formed SOAP note draft output', () => {
    const parsed = soapNoteDraftOutputSchema.parse(soap());
    expect(parsed.sections).toHaveLength(4);
    expect(parsed.sections[0].citations[0].sourceId).toBe(CITATION.sourceId);
  });

  it('enforces each SOAP heading EXACTLY once (ADR-019 §5, stricter than frozen M9)', () => {
    expect(() =>
      soapNoteDraftOutputSchema.parse(
        soap({ headings: ['subjective', 'subjective', 'assessment', 'plan'] }),
      ),
    ).toThrow(/Duplicate SOAP heading: subjective/);

    expect(() =>
      soapNoteDraftOutputSchema.parse(
        soap({ headings: ['subjective', 'objective', 'objective', 'plan'] }),
      ),
    ).toThrow();
  });

  it('rejects oversized section content and excerpts', () => {
    const big = soap({ content: 'x'.repeat(10_001) });
    expect(() => soapNoteDraftOutputSchema.parse(big)).toThrow();

    expect(() => citationSchema.parse({ ...CITATION, excerpt: 'y'.repeat(201) })).toThrow();
  });

  it('chart answer requires at least one citation and a disclaimer', () => {
    expect(() =>
      chartAnswerOutputSchema.parse({
        summary: 'Summary without citations.',
        citations: [],
        disclaimers: ['AI-generated summary.'],
        informationGaps: [],
      }),
    ).toThrow();

    expect(() =>
      chartAnswerOutputSchema.parse({
        summary: 'Summary.',
        citations: [CITATION],
        disclaimers: [],
        informationGaps: [],
      }),
    ).toThrow();
  });

  it('context blocks are strict allowlists — unknown block types FAIL CLOSED (ADR-018 §2)', () => {
    expect(() =>
      contextBlockSchema.parse({
        blockType: 'staff_salary_details',
        staffId: 'abc',
      }),
    ).toThrow();
  });

  it('patient demographics allowlist forbids DOB/name/MRN (ADR-018 §4)', () => {
    expect(() =>
      patientDemographicsBlockSchema.parse({
        blockType: 'patient_demographics',
        ageYears: 44,
        gender: 'male',
      }),
    ).not.toThrow();

    expect(() =>
      patientDemographicsBlockSchema.parse({
        blockType: 'patient_demographics',
        ageYears: 44,
        gender: 'male',
        dateOfBirth: '1981-01-01',
      }),
    ).toThrow();

    expect(() =>
      patientDemographicsBlockSchema.parse({
        blockType: 'patient_demographics',
        ageYears: 44,
        gender: 'male',
        mrn: 'MRN-2026-00001',
      }),
    ).toThrow();
  });

  it('manifest entries require approved source types and valid ids', () => {
    expect(() =>
      inputManifestEntrySchema.parse({
        sourceType: 'CLINICAL_RECORD',
        sourceId: '3f2504e0-4f89-11d3-9a0c-0305e82c3301',
        capturedAt: new Date().toISOString(),
      }),
    ).not.toThrow();

    expect(() =>
      inputManifestEntrySchema.parse({
        sourceType: 'OTHER_PATIENT_SECRET_FILE',
        sourceId: '3f2504e0-4f89-11d3-9a0c-0305e82c3301',
        capturedAt: new Date().toISOString(),
      }),
    ).toThrow();
  });

  it('request primitives bound clinician instructions to 2000 chars', () => {
    expect(() =>
      noteDraftRequestPrimitiveSchema.parse({
        encounterId: '3f2504e0-4f89-11d3-9a0c-0305e82c3302',
        recordType: 'soap',
        instructions: 'x'.repeat(2001),
      }),
    ).toThrow();
  });
});
