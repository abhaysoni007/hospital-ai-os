import {
  pgTable,
  uuid,
  varchar,
  text,
  jsonb,
  timestamp,
  inet,
  bigserial,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { staff } from './staff';

export const auditEvents = pgTable(
  'audit_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sequenceNumber: bigserial('sequence_number', { mode: 'number' }).unique().notNull(),
    eventType: varchar('event_type', { length: 100 }).notNull(),
    actorId: uuid('actor_id')
      .notNull()
      .references(() => staff.id),
    actorRole: varchar('actor_role', { length: 50 }).notNull(),
    actorDepartment: varchar('actor_department', { length: 100 }).notNull(),
    targetType: varchar('target_type', { length: 50 }),
    targetId: uuid('target_id'),
    patientId: uuid('patient_id'),
    actionDetail: jsonb('action_detail'),
    justification: text('justification'),
    ipAddress: inet('ip_address'),
    correlationId: uuid('correlation_id').notNull(),
    previousHash: varchar('previous_hash', { length: 64 }).notNull(),
    recordHash: varchar('record_hash', { length: 64 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    actorIdx: index('idx_audit_events_actor').on(table.actorId),
    eventTypeIdx: index('idx_audit_events_event_type').on(table.eventType),
    targetIdx: index('idx_audit_events_target').on(table.targetType, table.targetId),
    patientIdx: index('idx_audit_events_patient').on(table.patientId),
    createdIdx: index('idx_audit_events_created').on(table.createdAt),
    sequenceIdx: uniqueIndex('idx_audit_events_sequence').on(table.sequenceNumber),
    correlationIdx: index('idx_audit_events_correlation').on(table.correlationId),
    paginationIdx: index('idx_audit_events_pagination').on(table.createdAt, table.id),
  }),
);
