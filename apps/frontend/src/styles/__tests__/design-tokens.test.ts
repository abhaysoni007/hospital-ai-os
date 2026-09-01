import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * M16A — Design token contract.
 *
 * This test enforces that the canonical token file in
 * apps/frontend/src/styles/tokens.css continues to define every token
 * documented in docs/design/FRONTEND_DESIGN_SYSTEM.md.
 *
 * The test is intentionally string-based: it does NOT execute the CSS,
 * it just asserts the source of truth is intact. A regression in this
 * file is a regression of the design system.
 */

const TOKENS_CSS = join(__dirname, '..', 'tokens.css');

function readTokens(): string {
  if (!existsSync(TOKENS_CSS)) {
    throw new Error(`tokens.css not found at ${TOKENS_CSS}`);
  }
  return readFileSync(TOKENS_CSS, 'utf8');
}

describe('Design tokens — source of truth', () => {
  const css = readTokens();

  it('is the canonical Hospital AI OS token file', () => {
    expect(css).toContain('Hospital AI OS');
  });

  describe('Color palette', () => {
    const scales = ['primary', 'neutral'] as const;
    for (const scale of scales) {
      for (const step of ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900']) {
        it(`defines --color-${scale}-${step}`, () => {
          expect(css).toContain(`--color-${scale}-${step}`);
        });
      }
    }
  });

  describe('Semantic surfaces', () => {
    const tokens = [
      '--bg-app',
      '--bg-surface',
      '--bg-subtle',
      '--border-subtle',
      '--border-strong',
      '--text-primary',
      '--text-secondary',
      '--text-tertiary',
    ];
    for (const t of tokens) {
      it(`defines ${t}`, () => {
        expect(css).toContain(t);
      });
    }
  });

  describe('Clinical status semantics', () => {
    const statuses = ['critical', 'urgent', 'stable', 'pending', 'ai'];
    for (const status of statuses) {
      it(`defines --status-${status}-bg / -border / -text`, () => {
        expect(css).toContain(`--status-${status}-bg`);
        expect(css).toContain(`--status-${status}-border`);
        expect(css).toContain(`--status-${status}-text`);
      });
    }
  });

  describe('Typography scale', () => {
    const tokens = [
      '--font-size-display',
      '--font-size-h1',
      '--font-size-h2',
      '--font-size-h3',
      '--font-size-h4',
      '--font-size-body',
      '--font-size-sm',
      '--font-size-caption',
    ];
    for (const t of tokens) {
      it(`defines ${t}`, () => {
        expect(css).toContain(t);
      });
    }
    it('defines the Inter primary family', () => {
      expect(css).toContain('--font-family-sans');
      expect(css).toContain('Inter');
    });
    it('defines a monospace family for clinical identifiers', () => {
      expect(css).toContain('--font-family-mono');
    });
  });

  describe('Spacing (4/8px grid)', () => {
    for (const step of ['1', '2', '3', '4', '5', '6', '8', '10', '12', '16', '20']) {
      it(`defines --space-${step}`, () => {
        expect(css).toContain(`--space-${step}:`);
      });
    }
  });

  describe('Border radius', () => {
    for (const step of ['xs', 'sm', 'md', 'lg', 'xl', '2xl', 'full']) {
      it(`defines --radius-${step}`, () => {
        expect(css).toContain(`--radius-${step}:`);
      });
    }
  });

  describe('Elevation', () => {
    for (const step of ['xs', 'sm', 'md', 'lg', 'modal']) {
      it(`defines --shadow-${step}`, () => {
        expect(css).toContain(`--shadow-${step}:`);
      });
    }
  });

  describe('Motion tokens', () => {
    for (const d of ['fast', 'base', 'slow']) {
      it(`defines --duration-${d}`, () => {
        expect(css).toContain(`--duration-${d}:`);
      });
    }
    it('defines standard ease', () => {
      expect(css).toContain('--ease-standard:');
    });
  });

  describe('Focus + z-index', () => {
    it('defines a focus ring color and offset', () => {
      expect(css).toContain('--focus-ring-color');
      expect(css).toContain('--focus-ring-offset');
    });
    for (const z of ['sticky', 'drawer', 'backdrop', 'modal', 'toast']) {
      it(`defines --z-${z}`, () => {
        expect(css).toContain(`--z-${z}:`);
      });
    }
  });

  describe('Dark theme', () => {
    it('overrides semantic surfaces under [data-theme="dark"]', () => {
      expect(css).toMatch(/\[data-theme=['"]dark['"]\][\s\S]*--bg-app/);
      expect(css).toMatch(/\[data-theme=['"]dark['"]\][\s\S]*--text-primary/);
    });
  });
});
