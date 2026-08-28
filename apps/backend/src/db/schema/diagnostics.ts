import {
  pgTable,
  uuid,
  varchar,
  text,
  jsonb,
  boolean,
  decimal,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { orderPriorityEnum, diagnosticOrderStatusEnum, diagnosticResultStatusEnum } from './enums';
import { patients } from './patients';
import { staff } from './staff';
import { encounters } from './appointments';

export const diagnosticOrders = pgTable(
  'diagnostic_orders',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    encounterId: uuid('encounter_id')
      .notNull()
      .references(() => encounters.id, { onDelete: 'restrict' }),
    patientId: uuid('patient_id')
      .notNull()
      .references(() => patients.id, { onDelete: 'restrict' }),
    orderingDoctorId: uuid('ordering_doctor_id')
      .notNull()
      .references(() => staff.id),
    testCode: varchar('test_code', { length: 50 }).notNull(),
    testName: varchar('test_name', { length: 200 }).notNull(),
    clinicalIndication: text('clinical_indication'),
    priority: orderPriorityEnum('priority').default('routine').notNull(),
    status: diagnosticOrderStatusEnum('status').default('ordered').notNull(),
    // ADR-016 Decision 4 — collection provenance (migration 0004)
    collectedAt: timestamp('collected_at', { withTimezone: true }),
    collectedBy: uuid('collected_by').references(() => staff.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    encounterIdx: index('idx_diagnostic_orders_encounter').on(table.encounterId),
    patientIdx: index('idx_diagnostic_orders_patient').on(table.patientId),
    statusIdx: index('idx_diagnostic_orders_status').on(table.status),
    priorityIdx: index('idx_diagnostic_orders_priority').on(table.priority),
    createdIdx: index('idx_diagnostic_orders_created').on(table.createdAt),
  }),
);

export const criticalValueRules = pgTable(
  'critical_value_rules',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    testCode: varchar('test_code', { length: 50 }).notNull(),
    parameterName: varchar('parameter_name', { length: 100 }).notNull(),
    unit: varchar('unit', { length: 20 }).notNull(),
    normalLow: decimal('normal_low', { precision: 10, scale: 4 }),
    normalHigh: decimal('normal_high', { precision: 10, scale: 4 }),
    criticalLow: decimal('critical_low', { precision: 10, scale: 4 }),
    criticalHigh: decimal('critical_high', { precision: 10, scale: 4 }),
    isActive: boolean('is_active').default(true).notNull(),
    updatedBy: uuid('updated_by')
      .notNull()
      .references(() => staff.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    testCodeIdx: index('idx_critical_rules_test_code')
      .on(table.testCode)
      .where(sql`is_active = TRUE`),
    // UNIQUE(test_code, parameter_name) WHERE (is_active = TRUE)
    activeUniqueIdx: uniqueIndex('idx_critical_rules_active_unique')
      .on(table.testCode, table.parameterName)
      .where(sql`is_active = TRUE`),
  }),
);

export const diagnosticResults = pgTable(
  'diagnostic_results',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orderId: uuid('order_id')
      .notNull()
      .unique()
      .references(() => diagnosticOrders.id, { onDelete: 'restrict' }),
    patientId: uuid('patient_id')
      .notNull()
      .references(() => patients.id, { onDelete: 'restrict' }),
    testCode: varchar('test_code', { length: 50 }).notNull(),
    resultValues: jsonb('result_values').notNull(),
    referenceRange: jsonb('reference_range'),
    isAbnormal: boolean('is_abnormal').default(false).notNull(),
    isCritical: boolean('is_critical').default(false).notNull(),
    criticalRuleId: uuid('critical_rule_id').references(() => criticalValueRules.id),
    status: diagnosticResultStatusEnum('status').default('preliminary').notNull(),
    enteredBy: uuid('entered_by')
      .notNull()
      .references(() => staff.id),
    verifiedBy: uuid('verified_by').references(() => staff.id),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    aiSummary: text('ai_summary'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    orderIdx: index('idx_diagnostic_results_order').on(table.orderId),
    patientIdx: index('idx_diagnostic_results_patient').on(table.patientId),
    criticalIdx: index('idx_diagnostic_results_critical')
      .on(table.isCritical)
      .where(sql`is_critical = TRUE`),
    statusIdx: index('idx_diagnostic_results_status').on(table.status),
  }),
);
