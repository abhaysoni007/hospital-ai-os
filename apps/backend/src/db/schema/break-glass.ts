import { pgTable, uuid, text, timestamp, index, jsonb, boolean } from 'drizzle-orm/pg-core';
import { staff } from './staff';
import { patients } from './patients';
import { encounters } from './appointments'; // Wait, encounters are in appointments.ts
import { breakGlassReasonEnum } from './enums';

export const breakGlassSessions = pgTable(
  'break_glass_sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    staffId: uuid('staff_id')
      .notNull()
      .references(() => staff.id),
    patientId: uuid('patient_id')
      .notNull()
      .references(() => patients.id),
    encounterId: uuid('encounter_id').references(() => encounters.id),
    reason: breakGlassReasonEnum('reason').default('emergency_care').notNull(),
    justification: text('justification').notNull(),
    grantedScope: jsonb('granted_scope').default('{}').notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    activatedAt: timestamp('activated_at', { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).defaultNow().notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    deactivatedAt: timestamp('deactivated_at', { withTimezone: true }),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    reviewedBy: uuid('reviewed_by').references(() => staff.id),
    reviewNotes: text('review_notes'),
  },
  (table) => ({
    actorPatientIdx: index('idx_break_glass_actor_patient').on(table.staffId, table.patientId, table.expiresAt),
  }),
);
