import { pgTable, uuid, varchar, date, timestamp, index, integer } from 'drizzle-orm/pg-core';
import { genderEnum, patientStatusEnum } from './enums';
import { staff } from './staff';
import { sql } from 'drizzle-orm';

export const patients = pgTable(
  'patients',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    mrn: varchar('mrn', { length: 20 }).notNull().unique(),
    firstName: varchar('first_name', { length: 100 }).notNull(),
    lastName: varchar('last_name', { length: 100 }).notNull(),
    dateOfBirth: date('date_of_birth').notNull(),
    gender: genderEnum('gender').notNull(),
    phonePrimary: varchar('phone_primary', { length: 20 }).notNull(),
    phoneEmergency: varchar('phone_emergency', { length: 20 }),
    emergencyContactName: varchar('emergency_contact_name', { length: 100 }),
    addressLine1: varchar('address_line_1', { length: 200 }),
    addressCity: varchar('address_city', { length: 100 }),
    addressState: varchar('address_state', { length: 100 }),
    addressPostalCode: varchar('address_postal_code', { length: 20 }),
    status: patientStatusEnum('status').default('active').notNull(),
    // M18: optimistic-concurrency counter for demographic updates.
    version: integer('version').default(1).notNull(),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => staff.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => ({
    mrnIdx: index('idx_patients_mrn').on(table.mrn),
    // Drizzle supports raw sql expressions for complex indexes. We need trigram index here:
    nameTrgmIdx: index('idx_patients_name_trgm').using(
      'gin',
      sql`(first_name || ' ' || last_name) gin_trgm_ops`,
    ),
    dobIdx: index('idx_patients_dob').on(table.dateOfBirth),
    phoneIdx: index('idx_patients_phone').on(table.phonePrimary),
    statusIdx: index('idx_patients_status')
      .on(table.status)
      .where(sql`deleted_at IS NULL`),
    paginationIdx: index('idx_patients_pagination').on(table.createdAt, table.id),
  }),
);
