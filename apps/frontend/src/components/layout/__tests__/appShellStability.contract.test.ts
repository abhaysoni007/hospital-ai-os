import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve as resolveAbsolute } from 'node:path';

/**
 * M18 Part 2.1 — AppShell Stability in Detail Pages Contract Test
 *
 * Requirements:
 * - <AppShell> must exist exactly once in the outer return of the component.
 * - Loading and error states must be rendered as children of <AppShell>, NOT by mounting separate <AppShell> instances.
 * - Prevents tearing down and remounting AppSidebar, AppHeader, and notifications on data resolve.
 */

const ENCOUNTER_DETAIL = resolveAbsolute(__dirname, '../../../app/encounters/[id]/page.tsx');
const PATIENT_DETAIL = resolveAbsolute(__dirname, '../../../app/patients/[id]/page.tsx');
const DIAGNOSTIC_DETAIL = resolveAbsolute(__dirname, '../../../app/diagnostics/[orderId]/page.tsx');

describe('M18 Part 2.1 AppShell Stability Contract', () => {
  it('encounters/[id]/page.tsx has exactly one <AppShell> opening and closing tag', () => {
    const tsx = readFileSync(ENCOUNTER_DETAIL, 'utf8');
    const openMatches = tsx.match(/<AppShell\b/g);
    const closeMatches = tsx.match(/<\/AppShell>/g);
    expect(openMatches?.length).toBe(1);
    expect(closeMatches?.length).toBe(1);
  });

  it('patients/[id]/page.tsx has exactly one <AppShell> opening and closing tag', () => {
    const tsx = readFileSync(PATIENT_DETAIL, 'utf8');
    const openMatches = tsx.match(/<AppShell\b/g);
    const closeMatches = tsx.match(/<\/AppShell>/g);
    expect(openMatches?.length).toBe(1);
    expect(closeMatches?.length).toBe(1);
  });

  it('diagnostics/[orderId]/page.tsx has exactly one <AppShell> opening and closing tag', () => {
    const tsx = readFileSync(DIAGNOSTIC_DETAIL, 'utf8');
    const openMatches = tsx.match(/<AppShell\b/g);
    const closeMatches = tsx.match(/<\/AppShell>/g);
    expect(openMatches?.length).toBe(1);
    expect(closeMatches?.length).toBe(1);
  });
});
