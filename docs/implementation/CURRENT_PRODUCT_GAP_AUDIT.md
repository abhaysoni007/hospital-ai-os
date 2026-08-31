# Hospital AI OS — Current Product Gap Audit

**Audit Date:** September 2026
**Scope:** Read-only forensic analysis of the current repository against core Hospital AI OS capabilities.

## 1. Current Verified Capabilities (COMPLETE)

Cross-checked against actual routes, services, frontend components, and permissions:

*   **Patient Registration:** COMPLETE (Backend `POST /patients`, Frontend forms in `/patients/new`)
*   **Appointments:** COMPLETE (Booking, cancellation, slot uniqueness, frontend scheduling)
*   **Check-In:** COMPLETE (Check-in to Encounter handoff, status transitions)
*   **Encounters:** COMPLETE (Activation, encounter workspaces, active state management)
*   **Clinical Documentation:** COMPLETE (Drafts, signed immutability, vitals, physician notes)
*   **Diagnostics:** COMPLETE (Lab order lifecycle, result entry, collection provenance, UI queues)
*   **Critical-Result Workflow:** COMPLETE (Deterministic evaluator, urgent notifications, UI alerts)
*   **Tasks / Work Queues:** COMPLETE (Backend API, UI queue, assignment, reassignment, escalation)
*   **Discharge:** COMPLETE (Discharge API, atomic signed summary, frontend modal in `encounters/[id]`)
*   **Clinical Timeline:** COMPLETE (Backend aggregation endpoint, `ClinicalTimeline.tsx` UI)
*   **Chart Brief:** COMPLETE (Backend AI chart search, `ChartBrief.tsx` UI)
*   **Diagnostic Trends:** COMPLETE (Backend trend endpoint, `DiagnosticTrend.tsx` UI)
*   **AI Note Drafting:** COMPLETE (Physician-commissioned, gap detection, citation valid, M12 integration)
*   **Notifications:** COMPLETE (Backend API, UI badges, read/ack lifecycle)
*   **Dashboards:** COMPLETE (Real data integration, permission-gated metrics, no fabricated data)
*   **Search:** COMPLETE (Global search over patient directory with focus trap)
*   **Accessibility:** COMPLETE (Skip links, aria-labels, semantic badges, focus traps)
*   **Responsive UX:** COMPLETE (Design system hardened via M13)
*   **Error/Recovery States:** COMPLETE (Honest unavailable states, 401 recovery, error boundaries)

## 2. Partial Capabilities

*   **Break-Glass:** PARTIAL
    *   *Complete:* Backend API (`activate`, `revoke`, `review`), Security Admin revocation/review UI.
    *   *Missing:* Frontend Activation UI for clinicians. There is no way for a doctor/nurse to actually trigger a break-glass session from the UI.
*   **Audit/Security Administration:** PARTIAL
    *   *Complete:* Backend query endpoint (`/api/v1/audit`), Break-Glass review UI.
    *   *Missing:* Frontend Audit Log viewer is currently an honest stub page (`AuditPage` explicitly states it is coming in a future release).
*   **Playwright Coverage:** PARTIAL
    *   Only two test suites exist (`appointment-booking.spec.ts` and `clinical-intelligence.spec.ts`). Massive gaps in E2E coverage for other workflows.

## 3. Missing Capabilities

*   **Pharmacy / Medications:** MISSING (No database schema, API endpoints, or UI for medication prescribing, pharmacy queues, or MAR execution. Explicitly deferred to Phase 2).
*   **Staff Administration:** MISSING (Frontend `StaffAdminPage` is an honest stub. Backend endpoints for creating/updating staff are documented as M20 scope and do not exist).
*   **Deployment / Readiness:** MISSING (No production infrastructure. Only `docker-compose.dev.yml` exists; no K8s manifests, production Dockerfiles, or CI/CD pipelines).

## 4. Known Defects

*   **None Found:** The codebase is exceptionally clean following the M12.1 Integrity Restoration. No `FIXME` or `TODO` markers remain in the active pathways.

## 5. Security Gaps

*   **Emergency Access Inaccessible:** Because the Break-Glass activation UI is missing, clinicians cannot override permissions during an actual emergency in a production environment.
*   **Audit Visibility:** Security Admins cannot view the tamper-evident audit ledger from the UI due to the missing Audit Viewer, requiring direct DB access to investigate incidents.

## 6. UX Gaps

*   **Dead Ends:** Administrators navigating to "Staff Administration" or "Audit" are met with honest "Coming Soon" stub pages.
*   **Missing Triggers:** No "Emergency Access" button exists for out-of-scope patient charts.

## 7. Test / E2E Gaps

*   **Critical Workflows Uncovered:** Diagnostics ordering/results, clinical note drafting/signing, and task reassignment lack Playwright E2E coverage.

## 8. Production-Readiness Gaps

*   **Infrastructure:** Lacks `docker-compose.prod.yml`, Helm charts, or Terraform scripts.
*   **Observability:** Structured logging exists, but production APM/Tracing configuration is not wired into deployment manifests.

## 9. Recommended Next 5 Implementation Slices

1.  **Break-Glass Activation UI:** Wire the existing backend `breakGlassService.activateSession` to a frontend modal accessible when a clinician attempts to open an out-of-scope patient record.
2.  **Audit Viewer UI:** Connect the existing `GET /api/v1/audit` endpoint to a paginated data table in the currently stubbed `admin/audit/page.tsx`.
3.  **Staff Administration Module:** Build backend CRUD endpoints (`POST/PATCH /admin/staff`) and replace the frontend stub to allow actual user provisioning (M20).
4.  **E2E Test Expansion:** Write Playwright specs covering the Diagnostics lifecycle (Order -> Collect -> Result -> Verify -> Critical Alert).
5.  **Production Infrastructure Base:** Create baseline production Dockerfiles and Kubernetes manifests.

## 10. Explicitly Deferred Items

*   **Pharmacy Dispensing & MAR Administration:** Deferred to Phase 2.
*   **AI OCR Document Processing:** Explicitly rejected for v1 (ADR-017).
*   **Autonomous Clinical Actions:** AI will never autonomously prescribe, sign, or discharge (Architectural hard constraint).

