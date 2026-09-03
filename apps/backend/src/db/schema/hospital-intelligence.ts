import {
  pgTable,
  uuid,
  varchar,
  text,
  jsonb,
  boolean,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import {
  signalTypeEnum,
  signalSeverityEnum,
  signalStatusEnum,
  recommendationStatusEnum,
} from './enums';
import { patients } from './patients';
import { staff } from './staff';
import { encounters } from './appointments';
import { aiInteractions } from './ai';

/**
 * M19 — Hospital Intelligence Database Tables
 * SOURCE OF TRUTH: docs/architecture/M19_INTELLIGENCE_ARCHITECTURE.md §20
 *
 * 1. hospital_intelligence_signals: Persists deterministically detected workflow signals.
 * 2. intelligence_approved_actions: Ensures idempotent, governed execution of recommendations.
 */

export const hospitalIntelligenceSignals = pgTable(
  'hospital_intelligence_signals',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    signalType: signalTypeEnum('signal_type').notNull(),
    severity: signalSeverityEnum('severity').notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    description: text('description').notNull(),
    detectedAt: timestamp('detected_at', { withTimezone: true }).defaultNow().notNull(),
    status: signalStatusEnum('status').default('detected').notNull(),
    patientId: uuid('patient_id').references(() => patients.id),
    encounterId: uuid('encounter_id').references(() => encounters.id),
    evidenceRefs: jsonb('evidence_refs').notNull(),
    deterministicReason: text('deterministic_reason').notNull(),
    aiInteractionId: uuid('ai_interaction_id').references(() => aiInteractions.id),
    aiExplanation: jsonb('ai_explanation'),
    recommendationId: uuid('recommendation_id'),
    analysisCorrelationId: uuid('analysis_correlation_id').notNull(),
    requestedBy: uuid('requested_by')
      .notNull()
      .references(() => staff.id),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    statusIdx: index('idx_signals_status').on(table.status),
    typeIdx: index('idx_signals_type').on(table.signalType),
    severityIdx: index('idx_signals_severity').on(table.severity),
    patientIdx: index('idx_signals_patient')
      .on(table.patientId)
      .where(sql`patient_id IS NOT NULL`),
    createdIdx: index('idx_signals_created').on(table.createdAt),
    correlationIdx: index('idx_signals_correlation').on(table.analysisCorrelationId),
  }),
);

export const intelligenceApprovedActions = pgTable(
  'intelligence_approved_actions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    signalId: uuid('signal_id')
      .notNull()
      .references(() => hospitalIntelligenceSignals.id),
    actionType: varchar('action_type', { length: 100 }).notNull(),
    rationale: text('rationale').notNull(),
    evidenceRefs: jsonb('evidence_refs').notNull(),
    requiresHumanApproval: boolean('requires_human_approval').default(true).notNull(),
    policyStatus: recommendationStatusEnum('policy_status').default('proposed').notNull(),
    executableStatus: recommendationStatusEnum('executable_status').default('proposed').notNull(),
    idempotencyKey: varchar('idempotency_key', { length: 255 }).notNull(),
    approvedBy: uuid('approved_by').references(() => staff.id),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    rejectedBy: uuid('rejected_by').references(() => staff.id),
    rejectedAt: timestamp('rejected_at', { withTimezone: true }),
    rejectionReason: text('rejection_reason'),
    executionResult: jsonb('execution_result'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    idempotencyIdx: uniqueIndex('idx_approved_actions_idempotency').on(table.idempotencyKey),
    signalIdx: index('idx_approved_actions_signal').on(table.signalId),
    statusIdx: index('idx_approved_actions_status').on(table.policyStatus),
  }),
);
