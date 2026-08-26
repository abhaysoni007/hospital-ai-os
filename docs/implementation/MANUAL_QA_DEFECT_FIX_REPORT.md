# MANUAL QA DEFECT FIX REPORT

**Date:** 2026-08-27  
**Scope:** AI Note Drafting Pipeline & Lab Technician Diagnostics Visibility  
**Status:** MANUAL QA DEFECTS — VERIFIED FIXED  

---

## Executive Summary

During manual QA for the Hospital AI OS demo, two defects were discovered:
1. **AI note generation failed** in the Encounter Workspace with an unavailable message.
2. **Seeded CBC diagnostic orders and critical results were not visible** in the Lab Technician queue (`/diagnostics`).

Both issues were forensically investigated without weakening any architectural invariants, security policies, RBAC gates, or frozen milestone contracts (M8–M13, Phase 1A). Fixes and regression test coverage have been applied, validated through full test suites across all packages, built cleanly, and verified end-to-end.

---

## Issue 1 — AI Note Generation

### 1. Root Cause Analysis
* **Backend Subsystem Readiness Gate (ADR-020):** In `.env`, `AI_ENABLED` was unset (defaulting to `false`) and `AI_API_KEY` was absent. The orchestrator's readiness gate (`computeAiSubsystemState`) fail-closed to `'disabled'`, returning `503 AI_SERVICE_UNAVAILABLE` as designed by ADR-020.
* **Frontend Response Envelope Mismatch:** `apps/frontend/src/components/ai/AiNoteDraftPanel.tsx` expected `aiService.draftNote()` to return raw `AiNoteDraftResponse`, whereas `apiClient` returned the `{ data: AiNoteDraftResponse }` API envelope. As a result, `result.draft` resolved to `undefined` instead of `result.data.draft`.
* **Deterministic Fake Provider Output:** `FakeProvider`'s default `ok` mode previously returned a minimal stub missing structured SOAP headings (`subjective`, `objective`, `assessment`, `plan`) and citable context blocks, which failed the M11 output validation pipeline (`AI_VALIDATION_FAILED`) in local/offline test mode.

### 2. Implementation & Fix
* **Frontend Response Unwrapping:** Updated `apps/frontend/src/services/ai-service.ts` to type the response as `{ data: AiNoteDraftResponse }` and updated `apps/frontend/src/components/ai/AiNoteDraftPanel.tsx` to unwrap `r.data` into state.
* **Safe Local/Demo AI Configuration:** Added `AI_ENABLED=true` and `AI_PROVIDER=fake` in `.env` without hardcoding credentials, committing secrets, or requiring third-party network access for manual QA.
* **Real M12 Pipeline Execution:** Updated `FakeProvider` to dynamically construct grounded SOAP note and progress note drafts that cite actual context blocks (`CLINICAL_RECORD`, `DIAGNOSTIC_RESULT`, `DIAGNOSTIC_ORDER`) and echo system-computed information gaps from `userPrompt`. The request traverses the complete pipeline:
  $$\text{Frontend} \longrightarrow \text{AI Route} \longrightarrow \text{Auth/Capability Gate} \longrightarrow \text{Context Projection} \longrightarrow \text{Orchestrator} \longrightarrow \text{Provider Adapter} \longrightarrow \text{Output Validation} \longrightarrow \text{Grounding/Citation/Gap Validation} \longrightarrow \text{Frontend Rendering}$$
* **Fail-Closed Preservation:** If `AI_ENABLED=false` or keys are unconfigured, `POST /api/v1/ai/note-draft` continues to return `503 AI_SERVICE_UNAVAILABLE` and the UI continues clinical documentation without disruption.

---

## Issue 2 — Lab Technician Diagnostics Visibility

### 1. Root Cause Analysis
* **ADR-016 Decision 5 Department Scoping:** Diagnostic orders carry no explicit department column; they are joined via the patient encounter (`encounters.departmentId = authContext.departmentId`). This server-side scoping is strictly enforced in `listLabQueue()`.
* **Demo Data Department Mismatch:** In the dev database, `demo.labtech@hospital.test` was assigned to department `Laboratory (LAB)`, while all clinical patient encounters (including `DEMO-CRITICAL-001`) belonged to `Cardiology (CARD)`. Consequently, `encounters.departmentId = LAB` evaluated to `0` records.

### 2. Demo Data Correction & Security Preservation
* **Alignment:** Re-assigned `demo.labtech@hospital.test` to `Cardiology (CARD)` (as specified in `seed-demo.ts` line 335) so that the user's `authContext.departmentId` matches the cardiology encounter department where diagnostic orders are placed.
* **Multi-Department / Cross-Department Validation:** Verified that `demo.labtech2@hospital.test` (department `LAB`) receives `0` orders, confirming that cross-department data remains strictly isolated.
* **Zero Architectural Weakening:** `listLabQueue()` query conditions and `encounters.departmentId = authContext.departmentId` remained untouched.

---

## Verification & Test Results

### 1. Regression Test Coverage Added
* **AI Readiness Suite (`apps/backend/src/modules/ai/__tests__/readiness.test.ts`):** Added tests verifying that `AI_PROVIDER=fake` with `AI_ENABLED=true` reports `ready` without requiring external API keys, while `AI_ENABLED=false` remains fail-closed `disabled`.
* **Frontend AI Service Suite (`apps/frontend/src/services/__tests__/ai-service.test.ts`):** Added tests verifying that `draftNote()` unwraps the `{ data }` API envelope and handles rejection actions.
* **Diagnostics Queue Scoping Suite (`apps/backend/src/modules/diagnostics/__tests__/diagnostics.test.ts`):** Added Test K verifying that `listLabQueue` strictly returns orders belonging to the technician's authorized department and hides foreign-department orders.

### 2. Automated Test Summary
| Package | Test Files | Tests Run | Result |
| :--- | :--- | :--- | :--- |
| `packages/shared` | 6 passed | 51 passed | 100% Pass |
| `apps/backend` | 36 passed | 579 passed | 100% Pass |
| `apps/frontend` | 7 passed | 56 passed | 100% Pass |
| **Total** | **49 passed** | **686 passed** | **100% Pass** |

### 3. Build & Quality Gates
* **TypeScript Compilation (`tsc`):** Clean (0 errors across `shared`, `backend`, `frontend`).
* **Next.js Production Build (`next build`):** 18/18 static/dynamic routes compiled and optimized successfully.
* **ESLint (`eslint`):** 0 warnings, 0 errors across all packages.
* **Prettier (`prettier`):** Formatted and verified.

---

## Manual Verification Walkthrough

### Scenario A — Physician AI Note Generation
1. Login as `demo.physician@hospital.test` (`DemoPassword123!`).
2. Open active encounter `DEMO-CRITICAL-001` (`/encounters/:id`).
3. Click **"Draft with AI"** in the AI Note Draft panel.
4. AI generates a source-grounded draft with SOAP sections (`subjective`, `objective`, `assessment`, `plan`), verified citations to clinical records, highlighted information gaps, and provenance metadata (`fake-model`, `note_draft@1`, latency).
5. Click **"Use draft into editor"** — content populates clinical documentation fields for human clinician signature.

### Scenario B — Lab Technician Diagnostics Queue
1. Login as `demo.labtech@hospital.test` (`DemoPassword123!`).
2. Navigate to **Diagnostics** (`/diagnostics`).
3. The queue displays CBC orders with STAT priority badge and ordered status.
4. Open order `/diagnostics/:orderId` $\to$ click **"Enter results"** $\to$ enter parameter values.
5. Server deterministically evaluates values against `critical_value_rules`, flags critical results, generates audit events, and triggers physician notification loop.

### Scenario C — Cross-Department Security Isolation
1. Login as `demo.labtech2@hospital.test` (assigned to department `LAB`).
2. Navigate to `/diagnostics`.
3. Orders belonging to `CARD` encounters are completely invisible (`0 orders in queue`), confirming strict adherence to ADR-016.

---

## Remaining Limitations
* Local QA utilizes `AI_PROVIDER=fake` for deterministic offline verification. When connecting to live Google Gemini in staging/production, `AI_PROVIDER=google-gemini` and a valid `AI_API_KEY` must be supplied via secure secret management.
