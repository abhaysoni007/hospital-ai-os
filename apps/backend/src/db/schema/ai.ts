import {
  pgTable,
  uuid,
  integer,
  varchar,
  text,
  jsonb,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
// Drizzle supports vector type with pgvector
import { customType } from 'drizzle-orm/pg-core';
import { aiInteractionTypeEnum, groundingStatusEnum, aiUserActionEnum } from './enums';
import { patients } from './patients';
import { staff } from './staff';
import { encounters } from './appointments'; // encounters is in appointments.ts

// Custom type for vector if not built-in or import directly
// Since drizzle-orm 0.30+, vector is usually available natively, but customType is a safe fallback if 'vector' is not exported.
// Let's check if vector is exported from 'drizzle-orm/pg-core' or use customType.
// We will use customType to be safe.
const vector = customType<{ data: number[]; driverData: string; config?: { dimensions?: number } }>(
  {
    dataType(config) {
      return `vector(${config?.dimensions || 1536})`;
    },
    toDriver(value: number[]): string {
      return `[${value.join(',')}]`;
    },
    fromDriver(value: string): number[] {
      return value.slice(1, -1).split(',').map(Number);
    },
  },
);

export const aiInteractions = pgTable(
  'ai_interactions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    interactionType: aiInteractionTypeEnum('interaction_type').notNull(),
    initiatedBy: uuid('initiated_by')
      .notNull()
      .references(() => staff.id),
    patientId: uuid('patient_id').references(() => patients.id),
    encounterId: uuid('encounter_id').references(() => encounters.id),
    promptTemplateId: varchar('prompt_template_id', { length: 100 }),
    contextSummary: jsonb('context_summary'),
    modelProvider: varchar('model_provider', { length: 50 }).notNull(),
    modelName: varchar('model_name', { length: 100 }).notNull(),
    inputTokens: integer('input_tokens').default(0).notNull(),
    outputTokens: integer('output_tokens').default(0).notNull(),
    latencyMs: integer('latency_ms').default(0).notNull(),
    rawResponse: jsonb('raw_response'),
    parsedOutput: jsonb('parsed_output'),
    groundingStatus: groundingStatusEnum('grounding_status').default('unverified').notNull(),
    userAction: aiUserActionEnum('user_action').default('pending').notNull(),
    rejectionReason: text('rejection_reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    initiatedByIdx: index('idx_ai_interactions_initiated_by').on(table.initiatedBy),
    patientIdx: index('idx_ai_interactions_patient').on(table.patientId),
    typeIdx: index('idx_ai_interactions_type').on(table.interactionType),
    createdIdx: index('idx_ai_interactions_created').on(table.createdAt),
  }),
);

export const embeddings = pgTable(
  'embeddings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sourceType: varchar('source_type', { length: 50 }).notNull(),
    sourceId: uuid('source_id').notNull(),
    patientId: uuid('patient_id')
      .notNull()
      .references(() => patients.id),
    contentHash: varchar('content_hash', { length: 64 }).notNull(),
    embedding: vector('embedding', { dimensions: 1536 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    patientIdx: index('idx_embeddings_patient').on(table.patientId),
    sourceIdx: index('idx_embeddings_source').on(table.sourceType, table.sourceId),
    // vector index usually requires sql expressions in drizzle like:
    // using('ivfflat', table.embedding.op('vector_l2_ops'))
    // We'll leave it as a regular index for now or raw sql if needed.
  }),
);
