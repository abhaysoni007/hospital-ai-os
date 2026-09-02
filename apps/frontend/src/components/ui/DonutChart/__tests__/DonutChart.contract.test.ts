import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve as resolveAbsolute } from 'node:path';

/**
 * M16B analytics — DonutChart contract.
 *
 * The donut is a small inline-SVG primitive that uses the
 * stroke-dasharray pie technique. We assert its structural contract via
 * static analysis of the source so no jsdom dependency is added.
 */

const SRC = resolveAbsolute(__dirname, '../DonutChart.tsx');

describe('M16B DonutChart contract', () => {
  const tsx = readFileSync(SRC, 'utf8');

  it('uses stroke-dasharray + stroke-dashoffset for slice geometry', () => {
    expect(tsx).toMatch(/strokeDasharray/);
    expect(tsx).toMatch(/strokeDashoffset/);
  });

  it('rotates the donut -90deg so the first slice starts at 12 o’clock', () => {
    expect(tsx).toMatch(/rotate\(-90/);
  });

  it('renders a neutral background ring so an empty dataset still reads as a ring', () => {
    expect(tsx).toMatch(/--border-subtle/);
  });

  it('renders a legend whose items show label and a value-with-percent line', () => {
    expect(tsx).toMatch(/legendLabel/);
    expect(tsx).toMatch(/legendValue/);
    expect(tsx).toMatch(/Math\.round\(seg\.fraction\s*\*\s*100\)/);
  });

  it('exposes a role="img" aria-label summarising the distribution', () => {
    expect(tsx).toMatch(/role="img"/);
    expect(tsx).toMatch(/Distribution\./);
  });

  it('uses semantic-token stroke colours via TONE_STROKE', () => {
    expect(tsx).toMatch(/var\(--color-primary-500\)/);
    expect(tsx).toMatch(/var\(--color-success-main\)/);
    expect(tsx).toMatch(/var\(--color-danger-main\)/);
  });
});