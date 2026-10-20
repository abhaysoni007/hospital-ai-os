import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve as resolveAbsolute } from 'node:path';

const LAYOUT_TSX = resolveAbsolute(__dirname, '../../app/layout.tsx');
const USE_NOTIFICATIONS_TS = resolveAbsolute(__dirname, '../../hooks/useNotifications.ts');
const PHYSICIAN_DASHBOARD_TSX = resolveAbsolute(
  __dirname,
  '../../components/dashboard/PhysicianDashboard.tsx',
);

describe('Performance Fixes Contract Test (P1-B & P1-C)', () => {
  it('Root layout wraps children with NotificationProvider', () => {
    const content = readFileSync(LAYOUT_TSX, 'utf8');
    expect(content).toContain('<NotificationProvider>');
    expect(content).toContain('</NotificationProvider>');
  });

  it('useNotifications hook consumes shared NotificationContext', () => {
    const content = readFileSync(USE_NOTIFICATIONS_TS, 'utf8');
    expect(content).toContain('useNotificationContext()');
  });

  it('PhysicianDashboard consolidates encounter queries without duplicate active-filtered API call', () => {
    const content = readFileSync(PHYSICIAN_DASHBOARD_TSX, 'utf8');
    // Verifies the redundant double call is gone
    expect(content).not.toContain("status: 'active'");
    expect(content).toContain('.getEncounters({ page: 1, pageSize: 100 })');
    expect(content).toContain("e.status === 'active'");
  });
});
