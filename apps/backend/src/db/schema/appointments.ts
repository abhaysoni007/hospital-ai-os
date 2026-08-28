import {
  pgTable,
  uuid,
  integer,
  date,
  time,
  timestamp,
  text,
  index,
  uniqueIndex,
  primaryKey,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { appointmentStatusEnum, encounterTypeEnum, encounterStatusEnum } from './enums';
import { patients } from './patients';
import { staff, departments } from './staff';

export const encounters = pgTable(
  'encounters',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    patientId: uuid('patient_id')
      .notNull()
      .references(() => patients.id, { onDelete: 'restrict' }),
    doctorId: uuid('doctor_id')
      .notNull()
      .references(() => staff.id),
    departmentId: uuid('department_id')
      .notNull()
      .references(() => departments.id),
    encounterType: encounterTypeEnum('encounter_type').notNull(),
    chiefComplaint: text('chief_complaint'),
    status: encounterStatusEnum('status').default('registered').notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    dischargedAt: timestamp('discharged_at', { withTimezone: true }),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => staff.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    version: integer('version').default(1).notNull(),
  },
  (table) => ({
    patientIdx: index('idx_encounters_patient').on(table.patientId),
    doctorIdx: index('idx_encounters_doctor').on(table.doctorId),
    departmentIdx: index('idx_encounters_department').on(table.departmentId),
    statusIdx: index('idx_encounters_status').on(table.status),
    createdIdx: index('idx_encounters_created').on(table.createdAt),
  }),
);

export const appointments = pgTable(
  'appointments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    patientId: uuid('patient_id')
      .notNull()
      .references(() => patients.id, { onDelete: 'restrict' }),
    doctorId: uuid('doctor_id')
      .notNull()
      .references(() => staff.id),
    departmentId: uuid('department_id')
      .notNull()
      .references(() => departments.id),
    scheduledDate: date('scheduled_date').notNull(),
    scheduledTime: time('scheduled_time').notNull(),
    tokenNumber: integer('token_number'),
    status: appointmentStatusEnum('status').default('booked').notNull(),
    encounterId: uuid('encounter_id').references(() => encounters.id),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => staff.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    patientIdx: index('idx_appointments_patient').on(table.patientId),
    doctorDateIdx: index('idx_appointments_doctor_date').on(table.doctorId, table.scheduledDate),
    departmentDateIdx: index('idx_appointments_dept_date').on(table.departmentId, table.scheduledDate),
    statusIdx: index('idx_appointments_status').on(table.status),
    // UNIQUE on (doctor_id, scheduled_date, token_number) WHERE token_number IS NOT NULL
    // Drizzle supports partial unique index like this using .where()
    // Wait, Drizzle pg unique does not support .where() on table directly in some versions without sql.
    // Actually, table.unique().on(...) supports where. Let's try it or use a raw index with unique: true.
    tokenIdx: uniqueIndex('idx_appointments_token')
      .on(table.doctorId, table.scheduledDate, table.tokenNumber)
      .where(sql`token_number IS NOT NULL`),
  }),
);

/**
 * ADR-012: per-doctor/per-day token high-water mark.
 * Allocation uses an atomic upsert-increment inside the booking transaction;
 * this Drizzle mirror exists for tests/reads only — allocation always goes
 * through the raw ON CONFLICT statement in appointment.service.ts.
 */
export const appointmentTokenCounters = pgTable(
  'appointment_token_counters',
  {
    doctorId: uuid('doctor_id')
      .notNull()
      .references(() => staff.id),
    scheduledDate: date('scheduled_date').notNull(),
    lastToken: integer('last_token').default(0).notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.doctorId, table.scheduledDate] }),
  }),
);
