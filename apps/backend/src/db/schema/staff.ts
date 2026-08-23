import { pgTable, uuid, varchar, timestamp, boolean, inet, text, jsonb } from 'drizzle-orm/pg-core';
import { staffRoleEnum, staffStatusEnum, departmentStatusEnum } from './enums';

export const departments = pgTable('departments', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  code: varchar('code', { length: 20 }).notNull().unique(),
  status: departmentStatusEnum('status').default('active').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const staff = pgTable('staff', {
  id: uuid('id').defaultRandom().primaryKey(),
  employeeId: varchar('employee_id', { length: 50 }).notNull().unique(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  firstName: varchar('first_name', { length: 100 }).notNull(),
  lastName: varchar('last_name', { length: 100 }).notNull(),
  role: staffRoleEnum('role').notNull(),
  departmentId: uuid('department_id')
    .notNull()
    .references(() => departments.id),
  phone: varchar('phone', { length: 20 }),
  status: staffStatusEnum('status').default('active').notNull(),
  mfaEnabled: boolean('mfa_enabled').default(false).notNull(),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const refreshTokens = pgTable('refresh_tokens', {
  id: uuid('id').defaultRandom().primaryKey(),
  staffId: uuid('staff_id')
    .notNull()
    .references(() => staff.id, { onDelete: 'cascade' }),
  tokenHash: varchar('token_hash', { length: 255 }).notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  ipAddress: inet('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Note: patient_id is referenced in break_glass_sessions, we need to import it or declare it as just uuid with reference.
// To avoid circular dependencies, we can do explicit references in the index.ts using relations, or just define it.
import { patients } from './patients';

export const breakGlassSessions = pgTable('break_glass_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  staffId: uuid('staff_id')
    .notNull()
    .references(() => staff.id),
  patientId: uuid('patient_id')
    .notNull()
    .references(() => patients.id),
  justification: text('justification').notNull(),
  grantedScope: jsonb('granted_scope').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  activatedAt: timestamp('activated_at', { withTimezone: true }).defaultNow().notNull(),
  deactivatedAt: timestamp('deactivated_at', { withTimezone: true }),
  reviewedBy: uuid('reviewed_by').references(() => staff.id),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  reviewNotes: text('review_notes'),
});
