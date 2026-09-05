import { pgTable, uuid, varchar, text, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import {
  taskTypeEnum,
  taskPriorityEnum,
  taskStatusEnum,
  notificationTypeEnum,
  notificationPriorityEnum,
  notificationStatusEnum,
} from './enums';
import { patients } from './patients';
import { staff } from './staff';
import { encounters } from './appointments';
import { sql } from 'drizzle-orm';

export const tasks = pgTable(
  'tasks',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    taskType: taskTypeEnum('task_type').notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    description: text('description'),
    patientId: uuid('patient_id').references(() => patients.id),
    encounterId: uuid('encounter_id').references(() => encounters.id),
    assignedTo: uuid('assigned_to').references(() => staff.id),
    assignedBy: uuid('assigned_by').references(() => staff.id),
    priority: taskPriorityEnum('priority').default('medium').notNull(),
    status: taskStatusEnum('status').default('created').notNull(),
    dueAt: timestamp('due_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    referenceType: varchar('reference_type', { length: 50 }),
    referenceId: uuid('reference_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    assignedToIdx: index('idx_tasks_assigned_to').on(table.assignedTo),
    patientIdx: index('idx_tasks_patient').on(table.patientId),
    encounterIdx: index('idx_tasks_encounter').on(table.encounterId),
    dueAtIdx: index('idx_tasks_due_at').on(table.dueAt),
    statusIdx: index('idx_tasks_status').on(table.status),
    // idx_tasks_priority WHERE status NOT IN ('completed', 'cancelled')
    priorityIdx: index('idx_tasks_priority')
      .on(table.priority)
      .where(sql`status NOT IN ('completed', 'cancelled')`),
    uniqueReferenceIdx: uniqueIndex('idx_tasks_unique_reference')
      .on(table.referenceType, table.referenceId, table.taskType)
      .where(sql`reference_id IS NOT NULL`),
    paginationIdx: index('idx_tasks_pagination').on(table.createdAt, table.id),
  }),
);

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    recipientId: uuid('recipient_id')
      .notNull()
      .references(() => staff.id),
    notificationType: notificationTypeEnum('notification_type').notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    body: text('body').notNull(),
    referenceType: varchar('reference_type', { length: 50 }),
    referenceId: uuid('reference_id'),
    priority: notificationPriorityEnum('priority').notNull(),
    status: notificationStatusEnum('status').default('dispatched').notNull(),
    acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    recipientIdx: index('idx_notifications_recipient').on(table.recipientId),
    statusIdx: index('idx_notifications_status')
      .on(table.status)
      .where(sql`status != 'acknowledged'`),
    priorityIdx: index('idx_notifications_priority')
      .on(table.priority)
      .where(sql`priority = 'critical'`),
    paginationIdx: index('idx_notifications_pagination').on(table.createdAt, table.id),
  }),
);
