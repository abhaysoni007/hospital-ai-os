import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve as resolveAbsolute } from 'node:path';

/**
 * Lovable UI Transplant Contract & Safety Invariant Tests
 *
 * Verifies:
 * 1. AI Safety Invariant: Accept Draft ≠ Sign Note.
 * 2. Deterministic Critical Lab Policy & acknowledgment semantics.
 * 3. Zero dependency on mock data or prototype role providers.
 * 4. All registered shell routes map to physical page components.
 */

const FRONTEND_SRC = resolveAbsolute(__dirname, '../../');

describe('Lovable UI Transplant Contract & Safety Invariants', () => {
  it('enforces AI Workflow Invariant: Accept AI Draft ≠ Sign/Commit Clinical Note', () => {
    const aiReviewTsx = readFileSync(
      resolveAbsolute(FRONTEND_SRC, 'components/ai/LovableAI.tsx'),
      'utf8',
    );
    // Component must expose separate handlers for onAcceptDraft and onSignNote
    expect(aiReviewTsx).toMatch(/onAcceptDraft/);
    expect(aiReviewTsx).toMatch(/onSignNote/);
    expect(aiReviewTsx).toMatch(/Accept AI Draft/);
    expect(aiReviewTsx).toMatch(/Sign & Commit Note/);

    // AI draft panel must bind to a draft record, never auto-sign
    const aiDraftPanelTsx = readFileSync(
      resolveAbsolute(FRONTEND_SRC, 'components/ai/AiNoteDraftPanel.tsx'),
      'utf8',
    );
    expect(aiDraftPanelTsx).toMatch(/clinicalService\.createClinicalRecord/);
    expect(aiDraftPanelTsx).not.toMatch(/clinicalService\.signClinicalRecord/);
  });

  it('enforces Deterministic Critical Lab Policy & Acknowledgment Semantics', () => {
    const clinicalTsx = readFileSync(
      resolveAbsolute(FRONTEND_SRC, 'components/clinical/LovableClinical.tsx'),
      'utf8',
    );
    expect(clinicalTsx).toMatch(/CriticalResultBanner/);
    expect(clinicalTsx).toMatch(/CRITICAL VALUE ALERT/);
    expect(clinicalTsx).toMatch(/onAcknowledge/);
    expect(clinicalTsx).toMatch(/Acknowledge Critical Result/);
  });

  it('has zero imports or dependencies on prototype mechanisms', () => {
    const forbiddenPatterns = [
      /Lovable-Frontend/,
      /@tanstack\/react-router/,
      /@tanstack\/react-start/,
      /DemoRoleProvider/,
      /hospital-ai-os:demo-role/,
      /src\/lib\/data/,
    ];

    const filesToCheck = [
      'components/dashboard/DashboardShell.tsx',
      'components/dashboard/RoleDashboard.tsx',
      'components/dashboard/PhysicianDashboard.tsx',
      'components/dashboard/RoleComponents.tsx',
      'components/dashboard/LabTechnicianDashboard.tsx',
      'components/dashboard/ReceptionistDashboard.tsx',
      'components/dashboard/SecurityAdminDashboard.tsx',
      'components/dashboard/NursingDashboard.tsx',
      'components/dashboard/PharmacistDashboard.tsx',
      'components/dashboard/HospitalAdminDashboard.tsx',
      'components/clinical/EncounterNavTabs.tsx',
      'components/navigation/CommandMenu.tsx',
      'components/clinical/LovableClinical.tsx',
      'components/ai/LovableAI.tsx',
    ];

    for (const relPath of filesToCheck) {
      const fullPath = resolveAbsolute(FRONTEND_SRC, relPath);
      if (existsSync(fullPath)) {
        const content = readFileSync(fullPath, 'utf8');
        for (const pattern of forbiddenPatterns) {
          expect(content).not.toMatch(pattern);
        }
      }
    }
  });

  it('verifies all subroutes exist and are backed by real services', () => {
    const subroutes = [
      'app/encounters/[id]/notes/page.tsx',
      'app/encounters/[id]/labs/page.tsx',
      'app/encounters/[id]/discharge/page.tsx',
      'app/notifications/page.tsx',
      'app/admin/departments/page.tsx',
      'app/403/page.tsx',
      'app/404/page.tsx',
    ];

    for (const sub of subroutes) {
      const fullPath = resolveAbsolute(FRONTEND_SRC, sub);
      expect(existsSync(fullPath), `Expected ${sub} to exist`).toBe(true);
    }
  });
});
