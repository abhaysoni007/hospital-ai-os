import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve as resolveAbsolute } from 'node:path';

/**
 * M16B analytics — Sparkline contract.
 *
 * The sparkline is a small inline-SVG primitive. We assert its structural
 * contract via static analysis of the source (no jsdom dependency added).
 * If the JSX shape, the null-on-empty-data rule, or the aria-label
 * generation changes accidentally, this test fails.
 */

const SRC = resolveAbsolute(__dirname, '../Sparkline.tsx');

describe('M16B Sparkline contract', () => {
  const tsx = readFileSync(SRC, 'utf8');

  it('returns null when fewer than 2 data points are provided', () => {
    expect(tsx).toMatch(/if\s*\(data\.length\s*<\s*2\)\s*return\s+null/);
  });

  it('uses semantic-token stroke colour via the TONE_STROKE map', () => {
    expect(tsx).toMatch(/var\(--color-primary-500\)/);
    expect(tsx).toMatch(/var\(--color-danger-main\)/);
  });

  it('renders an SVG with role="img" and a generated aria-label', () => {
    expect(tsx).toMatch(/role="img"/);
    expect(tsx).toMatch(/aria-label/);
    expect(tsx).toMatch(/Trend:\s*range/);
  });

  it('uses a polyline <path> built from data points', () => {
    expect(tsx).toMatch(/<path/);
    expect(tsx).toMatch(/strokeLinecap=/);
  });
});