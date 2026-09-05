import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve as resolveAbsolute } from 'node:path';
import {
  formatEventType,
  getEventCategory,
  getEventSeverity,
  isGenesisHash,
  truncateHash,
  sanitizeActionDetail,
} from '../../../../utils/audit-helpers';

const PAGE_PATH = resolveAbsolute(__dirname, '../page.tsx');

describe('Security Admin Audit Page Contract & Safety Invariants', () => {
  const tsx = readFileSync(PAGE_PATH, 'utf8');

  it('preserves AppShell with required permission audit_event:read and wide variant', () => {
    expect(tsx).toMatch(/requiredPermission=['"]audit_event:read['"]/);
    expect(tsx).toMatch(/breadcrumbs=\{\['Administration',\s*'Audit'\]\}/);
    expect(tsx).toMatch(/variant=['"]wide['"]/);
  });

  it('consumes real audit data via auditService without hardcoded mock rows', () => {
    expect(tsx).toMatch(/auditService\.getEvents/);
    expect(tsx).not.toMatch(/mockEvents/);
    expect(tsx).not.toMatch(/mockAudit/);
    expect(tsx).not.toMatch(/fakeEvents/);
  });

  it('derives metrics strictly from returned audit records and metadata', () => {
    // Total Events derived from meta.total
    expect(tsx).toMatch(/label=['"]Total Events['"][\s\S]*value=\{loading \? '—' : derivedMetrics\.total\}/);
    // Break-Glass Events derived from records
    expect(tsx).toMatch(/label=['"]Break-Glass Events['"][\s\S]*value=\{loading \? '—' : derivedMetrics\.breakGlass\}/);
  });

  it('contains search, category, severity, role, and date range filters', () => {
    expect(tsx).toMatch(/id=['"]audit-search-input['"]/);
    expect(tsx).toMatch(/id=['"]audit-date-range['"]/);
    expect(tsx).toMatch(/id=['"]audit-severity-filter['"]/);
    expect(tsx).toMatch(/id=['"]audit-role-filter['"]/);
    expect(tsx).toMatch(/role=['"]group['"][\s\S]*aria-label=['"]Filter by event category['"]/);
  });

  it('renders interactive table rows with modal inspector', () => {
    expect(tsx).toMatch(/<TR[\s\S]*interactive[\s\S]*onClick=\{/);
    expect(tsx).toMatch(/role=['"]dialog['"]/);
    expect(tsx).toMatch(/Cryptographic Ledger Verification/);
  });
});

describe('Audit Helpers Unit Invariants', () => {
  it('formats event types cleanly into human readable form', () => {
    expect(formatEventType('BREAK_GLASS_ACTIVATED')).toBe('Break Glass Activated');
    expect(formatEventType('CRITICAL_VALUE_DETECTED')).toBe('Critical Value Detected');
    expect(formatEventType('CLINICAL_NOTE_SIGNED')).toBe('Clinical Note Signed');
    expect(formatEventType('UNKNOWN_CUSTOM_EVENT')).toBe('Unknown Custom Event');
  });

  it('correctly categorizes audit events', () => {
    expect(getEventCategory('BREAK_GLASS_ACTIVATED')).toBe('break_glass');
    expect(getEventCategory('CLINICAL_RECORD_CREATED')).toBe('clinical');
    expect(getEventCategory('LAB_RESULT_VERIFIED')).toBe('diagnostics');
    expect(getEventCategory('PATIENT_REGISTERED')).toBe('patient');
    expect(getEventCategory('RECOMMENDATION_APPROVED')).toBe('intelligence');
    expect(getEventCategory('AUTH_LOGIN_FAILED')).toBe('system');
  });

  it('derives event severity accurately', () => {
    const criticalEvent = {
      id: '1',
      sequenceNumber: 1,
      eventType: 'BREAK_GLASS_ACTIVATED',
      actorId: 'act-1',
      actorRole: 'physician',
      actorDepartment: 'Emergency',
      correlationId: 'corr-1',
      previousHash: '0000000000000000000000000000000000000000000000000000000000000000',
      recordHash: 'abc',
      createdAt: new Date().toISOString(),
    };
    expect(getEventSeverity(criticalEvent)).toBe('critical');

    const warningEvent = {
      ...criticalEvent,
      eventType: 'RECOMMENDATION_POLICY_REJECTED',
    };
    expect(getEventSeverity(warningEvent)).toBe('warning');

    const stableEvent = {
      ...criticalEvent,
      eventType: 'CLINICAL_NOTE_SIGNED',
    };
    expect(getEventSeverity(stableEvent)).toBe('stable');
  });

  it('identifies genesis blocks and truncates hashes', () => {
    const genesis = '0000000000000000000000000000000000000000000000000000000000000000';
    expect(isGenesisHash(genesis)).toBe(true);
    expect(isGenesisHash('abc12345678901234567890123456789012345678901234567890123456789012')).toBe(false);

    expect(truncateHash('1234567890abcdef1234567890abcdef', 4, 4)).toBe('1234…cdef');
  });

  it('sanitizes action details by redacting confidential secrets, tokens, passwords', () => {
    const unsafePayload = {
      username: 'doctor1',
      password: 'SuperSecretPassword123!',
      token: 'jwt.token.here',
      sessionSecret: 'top-secret',
      cookie: 'session=123',
      authorization: 'Bearer secret_token',
      nested: {
        api_key: 'key-999',
        normalField: 'all-clear',
      },
    };

    const sanitized = sanitizeActionDetail(unsafePayload) as Record<string, unknown>;

    expect(sanitized.username).toBe('doctor1');
    expect(sanitized.password).toBe('[REDACTED]');
    expect(sanitized.token).toBe('[REDACTED]');
    expect(sanitized.sessionSecret).toBe('[REDACTED]');
    expect(sanitized.cookie).toBe('[REDACTED]');
    expect(sanitized.authorization).toBe('[REDACTED]');
    expect((sanitized.nested as Record<string, unknown>).api_key).toBe('[REDACTED]');
    expect((sanitized.nested as Record<string, unknown>).normalField).toBe('all-clear');
  });
});
