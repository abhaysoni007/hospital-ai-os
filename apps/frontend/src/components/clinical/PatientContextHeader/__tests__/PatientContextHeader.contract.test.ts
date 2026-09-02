import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve as resolveAbsolute } from 'node:path';

/**
 * M17 — PatientContextHeader contract.
 *
 * The context band is the persistent "whose chart am I in" signal on clinical
 * workspaces. Asserted statically (no jsdom dependency): honest loading and
 * failure states, no fabricated demographics, and machine-readable landmarks.
 */

const SRC = resolveAbsolute(__dirname, '../PatientContextHeader.tsx');

describe('M17 PatientContextHeader contract', () => {
  const tsx = readFileSync(SRC, 'utf8');

  it('renders a labelled patient-context landmark', () => {
    expect(tsx).toMatch(/aria-label="Patient context"/);
  });

  it('exposes a busy state while the lookup resolves', () => {
    expect(tsx).toMatch(/aria-busy="true"/);
    expect(tsx).toMatch(/<Skeleton/);
  });

  it('renders a quiet recovery note with retry when the lookup fails', () => {
    expect(tsx).toMatch(/onRetry/);
    expect(tsx).toMatch(/Retry/);
  });

  it('never fabricates identity: unknown patient renders nothing', () => {
    expect(tsx).toMatch(/if \(!patient\) return null;/);
  });

  it('reuses the canonical PatientIdentity presentation', () => {
    expect(tsx).toMatch(/<PatientIdentity/);
    expect(tsx).toMatch(/dateOfBirth=\{patient\.dateOfBirth\}/);
    expect(tsx).toMatch(/gender=\{patient\.gender\}/);
  });

  it('communicates encounter context through the semantic badge, never raw enum', () => {
    expect(tsx).toMatch(/<EncounterStatusBadge/);
    expect(tsx).toContain("encounter.type.replace(/_/g, ' ')");
  });
});
