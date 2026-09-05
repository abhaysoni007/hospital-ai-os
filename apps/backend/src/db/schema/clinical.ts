import { pgTable, uuid, integer, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { clinicalRecordTypeEnum, clinicalRecordStatusEnum } from './enums';
import { patients } from './patients';
import { staff } from './staff';
import { encounters } from './appointments';
import { aiInteractions } from './ai';

export const clinicalRecords = pgTable(
  'clinical_records',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    encounterId: uuid('encounter_id')
      .notNull()
      .references(() => encounters.id, { onDelete: 'restrict' }),
    patientId: uuid('patient_id')
      .notNull()
      .references(() => patients.id, { onDelete: 'restrict' }),
    recordType: clinicalRecordTypeEnum('record_type').notNull(),
    content: jsonb('content').notNull(),
    vitals: jsonb('vitals'),
    aiDraftId: uuid('ai_draft_id').references(() => aiInteractions.id),
    status: clinicalRecordStatusEnum('status').default('draft').notNull(),
    signedBy: uuid('signed_by').references(() => staff.id),
    signedAt: timestamp('signed_at', { withTimezone: true }),
    version: integer('version').default(1).notNull(),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => staff.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    encounterIdx: index('idx_clinical_records_encounter').on(table.encounterId),
    patientIdx: index('idx_clinical_records_patient').on(table.patientId),
    typeIdx: index('idx_clinical_records_type').on(table.recordType),
    statusIdx: index('idx_clinical_records_status').on(table.status),
    paginationIdx: index('idx_clinical_records_pagination').on(table.createdAt, table.id),
  }),
);
