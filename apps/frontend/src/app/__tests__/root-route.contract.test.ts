import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve as resolveAbsolute } from 'node:path';

const ROOT_PAGE = resolveAbsolute(__dirname, '../page.tsx');
const AUTH_GUARD = resolveAbsolute(__dirname, '../../components/auth/AuthGuard.tsx');
const FINAL_CTA = resolveAbsolute(__dirname, '../../components/sections/FinalCTA.tsx');
const FOOTER = resolveAbsolute(__dirname, '../../components/sections/Footer.tsx');

describe('Public MEDORA Landing & Route Protection Contract Tests', () => {
  it('root page.tsx does not unconditionally redirect to /dashboard', () => {
    const code = readFileSync(ROOT_PAGE, 'utf8');
    // Must NOT contain unconditional router.replace('/dashboard')
    expect(code).not.toMatch(/useEffect\(\(\)\s*=>\s*\{\s*router\.replace\('\/dashboard'\);\s*\},/);
  });

  it('root page.tsx renders MedoraLanding for unauthenticated visitors', () => {
    const code = readFileSync(ROOT_PAGE, 'utf8');
    expect(code).toContain("import MedoraLanding from './medora/page'");
    expect(code).toMatch(/<MedoraLanding\s*\/>/);
  });

  it('root page.tsx checks authentication and redirects authenticated users to /dashboard', () => {
    const code = readFileSync(ROOT_PAGE, 'utf8');
    expect(code).toContain('useAuth');
    expect(code).toMatch(/if\s*\(!isLoading\s*&&\s*isAuthenticated\)\s*\{\s*router\.replace\('\/dashboard'\)/);
  });

  it('AuthGuard protects routes and preserves returnUrl for unauthenticated attempts', () => {
    const code = readFileSync(AUTH_GUARD, 'utf8');
    expect(code).toContain('useAuth');
    expect(code).toMatch(/router\.replace\(`\/login\$\{returnParam\}`\)/);
    expect(code).toContain('?returnUrl=');
  });

  it('landing page CTAs point to /login for user entry', () => {
    const ctaCode = readFileSync(FINAL_CTA, 'utf8');
    const footerCode = readFileSync(FOOTER, 'utf8');
    expect(ctaCode).toContain('href="/login"');
    expect(footerCode).toContain('href="/login"');
  });
});
