import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve as resolveAbsolute } from 'node:path';

/**
 * M16B — SidebarItem collapsed-state accessibility contract.
 *
 * When the sidebar collapses to icon-only, the visible label is hidden so
 * the link would otherwise announce as an unlabeled icon. WCAG 2.2 AA
 * requires an accessible name; we satisfy it with:
 *
 *   - `aria-label={label}` on the `<Link>` (set when collapsed)
 *   - an SR-only span carrying the same label (belt-and-braces for AT
 *     that does not always honor aria-label on icon-links)
 *
 * This is a static-analysis test — it reads the source and asserts the
 * contract is in place. This avoids adding jsdom/happy-dom to the
 * dependency tree (per the M16B non-negotiable: no new dependencies).
 */

const SRC = resolveAbsolute(__dirname, '../SidebarItem.tsx');
const CSS = resolveAbsolute(__dirname, '../SidebarItem.module.css');

describe('M16B SidebarItem collapsed accessibility', () => {
  const tsx = readFileSync(SRC, 'utf8');
  const css = readFileSync(CSS, 'utf8');

  it('sets aria-label when the item is collapsed', () => {
    expect(tsx).toMatch(/aria-label=\{isCollapsed\s*\?\s*label\s*:\s*undefined\}/);
  });

  it('renders an SR-only span carrying the label when collapsed', () => {
    expect(tsx).toMatch(/isCollapsed\s*&&\s*<span[^>]*>\s*\{label\}\s*<\/span>/);
  });

  it('uses the WCAG visually-hidden recipe in CSS', () => {
    // Standard visually-hidden pattern: 1x1px, clipped, overflow hidden.
    expect(css).toMatch(/\.srOnly\s*\{[^}]*clip:\s*rect\(0,\s*0,\s*0,\s*0\)/);
    expect(css).toMatch(/overflow:\s*hidden/);
  });

  it('marks the icon span as aria-hidden so it is not double-announced', () => {
    expect(tsx).toMatch(/<span[^>]*aria-hidden="true"[^>]*>\s*\{icon\}/);
  });
});