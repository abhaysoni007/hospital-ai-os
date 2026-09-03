import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve as resolveAbsolute } from 'node:path';

/**
 * M18 Part 2.1 — Patients Page Fetch Contract Test
 *
 * Requirements:
 * - Initial empty-query fetch must execute immediately (0ms artificial delay).
 * - Clearing the search query must execute immediately.
 * - Non-empty search input may retain an appropriate debounce.
 * - Request cancellation/cleanup on unmount/re-fetch must be preserved.
 */

const SRC = resolveAbsolute(__dirname, '../page.tsx');

describe('M18 Part 2.1 Patients Page Fetch Behavior Contract', () => {
  const tsx = readFileSync(SRC, 'utf8');

  it('determines whether search query is immediate (empty) or debounced', () => {
    expect(tsx).toMatch(/isImmediate\s*=\s*searchQuery\.trim\(\)\s*===\s*['"]['"]/);
    expect(tsx).toMatch(/delay\s*=\s*isImmediate\s*\?\s*0\s*:\s*300/);
  });

  it('executes immediately without setTimeout when delay is 0', () => {
    expect(tsx).toMatch(/if\s*\(\s*delay\s*===\s*0\s*\)\s*\{[\s\S]*void\s+executeFetch\(\);/);
  });

  it('debounces only when delay > 0', () => {
    expect(tsx).toMatch(/const timer = setTimeout\(\(\)\s*=>\s*\{[\s\S]*void\s+executeFetch\(\);[\s\S]*\},\s*delay\);/);
  });

  it('preserves cancellation flag on cleanup', () => {
    expect(tsx).toMatch(/return\s*\(\)\s*=>\s*\{[\s\S]*cancelled\s*=\s*true;[\s\S]*\};/);
  });
});
