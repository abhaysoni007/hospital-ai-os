import { randomUUID } from 'crypto';
import { ContextBlock, GapCode, SoapNoteDraftOutput, soapNoteDraftOutputSchema } from 'shared';

/** Shared M11 fixtures — contract-valid projections and outputs. */

export const ID_A = randomUUID();
export const ID_B = randomUUID();
export const ID_C = randomUUID();
export const PATIENT_ID = randomUUID();

export const baseBlocks: ContextBlock[] = [
  {
    blockType: 'patient_demographics',
    ageYears: 58,
    gender: 'male',
  },
  {
    blockType: 'encounter_metadata',
    encounterType: 'opd',
    status: 'active',
    startedAt: new Date('2026-08-26T09:00:00Z').toISOString(),
    departmentName: 'General Medicine',
    chiefComplaint: 'Chest pain for two days.',
  },
  {
    blockType: 'clinical_record',
    sourceId: ID_A,
    recordType: 'vital_signs',
    version: 1,
    recordedAt: new Date('2026-08-26T09:05:00Z').toISOString(),
    textContent: 'BP 140/90 mmHg. SpO2 97% RA. Pulse 96 bpm.',
  },
  {
    blockType: 'diagnostic_order',
    sourceId: ID_B,
    testCode: 'CBC',
    testName: 'Complete Blood Count',
    priority: 'urgent',
    status: 'completed',
    createdAt: new Date('2026-08-26T09:10:00Z').toISOString(),
  },
  {
    blockType: 'diagnostic_result',
    sourceId: ID_C,
    relatedOrderSourceId: ID_B,
    status: 'critical_flagged',
    isCritical: true,
    parameters: [
      {
        parameterName: 'Troponin I',
        valueNumber: 4.2,
        unit: 'ng/mL',
        verdict: 'critical',
        referenceRangeText: '< 0.04',
      },
    ],
  },
];

export function validSoapOutput(gaps: GapCode[] = []): SoapNoteDraftOutput {
  return soapNoteDraftOutputSchema.parse({
    sections: [
      {
        heading: 'subjective',
        content: 'Patient reports chest pain for two days.',
        citations: [{ sourceType: 'CLINICAL_RECORD', sourceId: ID_A, excerpt: 'recorded context' }],
      },
      {
        heading: 'objective',
        content: 'BP 140/90. Troponin I 4.2 ng/mL (critical).',
        citations: [
          { sourceType: 'CLINICAL_RECORD', sourceId: ID_A, excerpt: 'BP 140/90' },
          { sourceType: 'DIAGNOSTIC_RESULT', sourceId: ID_C, excerpt: 'Troponin I critical' },
        ],
      },
      {
        heading: 'assessment',
        content: 'Findings suggest acute coronary syndrome workup indicated.',
        citations: [{ sourceType: 'DIAGNOSTIC_RESULT', sourceId: ID_C, excerpt: 'critical value' }],
      },
      {
        heading: 'plan',
        content: 'Serial ECG, cardiology consult.',
        citations: [{ sourceType: 'CLINICAL_RECORD', sourceId: ID_A, excerpt: 'vitals' }],
      },
    ],
    disclaimers: ['AI-generated draft for clinician review.'],
    informationGaps: gaps,
  });
}

export const principalFixture = () => ({
  staffId: randomUUID(),
  role: 'physician',
  departmentId: randomUUID(),
});
