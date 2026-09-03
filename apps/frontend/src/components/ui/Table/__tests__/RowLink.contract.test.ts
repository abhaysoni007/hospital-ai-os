import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve as resolveAbsolute } from 'node:path';

/**
 * M18 Part 2.1 — RowLink SPA Navigation Contract Test
 *
 * Requirements:
 * - RowLink must import and use Next.js <Link> for internal application routes
 *   so that row clicks do not trigger full browser hard reloads.
 * - External URLs must fall back to standard <a> tags.
 * - rowLink styling class and passed props must be preserved.
 */

const SRC = resolveAbsolute(__dirname, '../Table.tsx');

describe('M18 Part 2.1 RowLink SPA Navigation Contract', () => {
  const tsx = readFileSync(SRC, 'utf8');

  it('imports Next.js Link component', () => {
    expect(tsx).toMatch(/import Link from ['"]next\/link['"]/);
  });

  it('determines internal vs external routes using href', () => {
    expect(tsx).toMatch(/isInternal\s*=\s*typeof href === ['"]string['"]\s*&&\s*href\.startsWith\(['"]\/['"]\)/);
  });

  it('renders Next.js <Link> for internal routes', () => {
    expect(tsx).toMatch(/<Link\s+href=\{href\}\s+className=\{[^}]*styles\.rowLink/);
  });

  it('preserves native <a> fallback for non-internal routes', () => {
    expect(tsx).toMatch(/<a\s+href=\{href\}\s+className=\{[^}]*styles\.rowLink/);
  });
});
