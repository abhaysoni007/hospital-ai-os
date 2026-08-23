import { pgTable, uuid, varchar, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { documentTypeEnum, verificationStatusEnum } from './enums';
import { patients } from './patients';
import { staff } from './staff';

export const identities = pgTable(
  'identities',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    patientId: uuid('patient_id')
      .notNull()
      .references(() => patients.id, { onDelete: 'restrict' }),
    documentType: documentTypeEnum('document_type').notNull(),
    documentNumberEnc: varchar('document_number_enc', { length: 500 }).notNull(),
    documentImagePath: varchar('document_image_path', { length: 500 }),
    ocrExtractedData: jsonb('ocr_extracted_data'),
    verificationStatus: verificationStatusEnum('verification_status').default('pending').notNull(),
    verifiedBy: uuid('verified_by').references(() => staff.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    patientIdx: index('idx_identities_patient').on(table.patientId),
    statusIdx: index('idx_identities_status').on(table.verificationStatus),
  }),
);
