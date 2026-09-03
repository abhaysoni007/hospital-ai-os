# M19.1 — Hospital Intelligence Foundation Report

> **Status:** M19.1 — COMPLETE  
> **Authority:** Lead Implementation Engineer  
> **Date:** 2026-09-04  
> **Branch:** `main`  
> **Scope:** Minimum shared contracts and backend foundation required for M19.2+ according to locked architecture in `docs/architecture/M19_INTELLIGENCE_ARCHITECTURE.md`.

---

## 1. Status

**M19.1 — COMPLETE**

All required contracts, schemas, permissions, database migrations, prompt templates, module skeletons, and route authorization foundations are implemented and verified. No regressions across M1–M18.

---

## 2. Repository Baseline Inspected

Prior to implementation, the entire repository was inspected:
- **Architecture:** `docs/architecture/M19_INTELLIGENCE_ARCHITECTURE.md` (locked M19.0 architecture).
- **Backend AI Infrastructure:** `AIOrchestrator`, `AIProviderAdapter`, `runValidationPipeline`, `buildInputManifest`, `computeInformationGaps`, prompt templates, `aiInteractionRepository`, `AI_AUDIT_EVENTS`.
- **RBAC & Authorization:** `apps/backend/src/middleware/rbac/permissions.ts`, `policy-engine.ts`, `apps/frontend/src/types/auth.ts`, `apps/frontend/src/utils/rbac.ts`.
- **Database & Migrations:** `apps/backend/src/db/migrations/`, `_journal.json`, `apps/backend/src/db/schema/`.
- **Shared Contracts:** `packages/shared/src/api/ai.schemas.ts`, `packages/shared/src/api/index.ts`.
- **Frontend AppShell & Routing:** `apps/frontend/src/components/layout/shellRoutes.ts`, `shellRoutes.test.ts`.

---

## 3. Architecture Adherence

The implementation adheres strictly to `docs/architecture/M19_INTELLIGENCE_ARCHITECTURE.md`:
- **Deny-by-default RBAC:** Server-side permission checks on all routes; no client-side-only security.
- **Bounded AI Vocabulary:** AI recommendations restricted to ratified operational actions; clinical diagnosis and prescribing strictly forbidden.
- **Manifest-Grounded Evidence:** Evidence model requires real database UUIDs and valid record types.
- **Audit Logging:** All intelligence interactions and recommendations produce hash-chained audit events through existing `AuditService`.
- **Zero Hallucinated State:** Signal severity is computed deterministically; AI is strictly bounded to explanation.

---

## 4. Migration Numbering Correction

- **Previous highest migration:** `0009_m18_clinical_integrity.sql` (indexed as entry `idx: 9` in `meta/_journal.json`).
- **Migration selected:** `0010_hospital_intelligence.sql` (entry `idx: 10` in `meta/_journal.json`).
- **Architecture document correction:** The M19.0 architecture document provisionally referenced `0007` based on an earlier draft. Inspection of the active repository revealed that migrations `0007_unknown_franklin_storm.sql`, `0008_clammy_fat_cobra.sql`, and `0009_m18_clinical_integrity.sql` already existed. The next valid, non-colliding migration number is `0010`.
- **Execution:** Successfully executed against local PostgreSQL instance via `npm run db:migrate` without errors or data mutation.

---

## 5. Permissions & RBAC Matrix

Added three new permissions:
- `intelligence:read`: View detected signals and explanations.
- `intelligence:analyze`: Trigger hospital intelligence bottleneck analysis.
- `intelligence:approve`: Authorize execution of recommended actions.

### Role Mapping Matrix:
| Role | `intelligence:read` | `intelligence:analyze` | `intelligence:approve` |
|:---|:---:|:---:|:---:|
| **physician** | ALLOW | ALLOW | ALLOW |
| **nurse** | ALLOW | **DENY** | **DENY** |
| **hospital_admin** | ALLOW | ALLOW | ALLOW |
| **pharmacist** | **DENY** | **DENY** | **DENY** |
| **lab_technician** | **DENY** | **DENY** | **DENY** |
| **receptionist** | **DENY** | **DENY** | **DENY** |
| **security_admin** | **DENY** | **DENY** | **DENY** |

Verified by `apps/backend/src/middleware/rbac/__tests__/m19-rbac.test.ts` (9 tests passing).

---

## 6. Shared Contracts

Added `packages/shared/src/api/intelligence-signal.schemas.ts` and exported in `packages/shared/src/api/index.ts`:
- `signalTypeSchema`: `'PENDING_DIAGNOSTIC_RESULT' | 'CRITICAL_RESULT_UNACKNOWLEDGED' | 'ENCOUNTER_WITHOUT_CLINICAL_RECORD'`
- `signalSeveritySchema`: `'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'`
- `signalStatusSchema`: `'detected' | 'analyzed' | 'actioned' | 'dismissed' | 'resolved' | 'stale'`
- `evidenceSourceTypeSchema`: `'DIAGNOSTIC_ORDER' | 'DIAGNOSTIC_RESULT' | 'ENCOUNTER' | 'CLINICAL_RECORD' | 'NOTIFICATION' | 'TASK'`
- `evidenceStatusSchema`: `'present' | 'insufficient' | 'missing' | 'unauthorized'`
- `evidenceRefSchema`: strict object containing evidenceId, sourceType, sourceRecordId, relevantAt, evidenceStatus, authorizedVisibility, relationToSignal.
- `recommendationActionTypeSchema`: `'ESCALATE_ALERT' | 'NOTIFY_ATTENDING_PHYSICIAN' | 'ACKNOWLEDGE_CRITICAL_ALERT' | 'REASSIGN_TASK' | 'VIEW_PATIENT_RECORD' | 'VIEW_DIAGNOSTIC_ORDER'`
- `recommendationStatusSchema`: `'proposed' | 'approved' | 'executed' | 'rejected' | 'policy_rejected' | 'execution_failed' | 'insufficient_evidence' | 'unavailable'`
- `recommendationSchema`: strict validated contract.
- `aiExplanationSchema`: summary, clinicalImpact, citations, disclaimers, informationGaps, groundingStatus.
- `detectedSignalSchema`: strict root signal structure.
- API request/response schemas: `analyzeHospitalIntelligenceRequestSchema`, `hospitalIntelligenceAnalysisResponseSchema`, `approveRecommendationRequestSchema`, `rejectRecommendationRequestSchema`.

---

## 7. Database Foundation

### Migration: `0010_hospital_intelligence.sql`
1. **Enum extensions:**
   - `ALTER TYPE "public"."ai_interaction_type" ADD VALUE IF NOT EXISTS 'hospital_bottleneck'`
   - Created `signal_type`, `signal_severity`, `signal_status`, `recommendation_status` ENUMs.
2. **Table: `hospital_intelligence_signals`:**
   - Columns: `id`, `signal_type`, `severity`, `title`, `description`, `detected_at`, `status`, `patient_id`, `encounter_id`, `evidence_refs`, `deterministic_reason`, `ai_interaction_id`, `ai_explanation`, `recommendation_id`, `analysis_correlation_id`, `requested_by`, `resolved_at`, `created_at`, `updated_at`.
   - Foreign keys: `patients(id)`, `encounters(id)`, `ai_interactions(id)`, `staff(id)`.
   - Indexes: `idx_signals_status`, `idx_signals_type`, `idx_signals_severity`, `idx_signals_patient`, `idx_signals_created`, `idx_signals_correlation`.
3. **Table: `intelligence_approved_actions`:**
   - Columns: `id`, `signal_id`, `action_type`, `rationale`, `evidence_refs`, `requires_human_approval`, `policy_status`, `executable_status`, `idempotency_key`, `approved_by`, `approved_at`, `rejected_by`, `rejected_at`, `rejection_reason`, `execution_result`, `created_at`, `updated_at`.
   - Constraints: `UNIQUE ("idempotency_key")`, foreign keys to `hospital_intelligence_signals(id)`, `staff(id)`.
   - Indexes: `idx_approved_actions_idempotency`, `idx_approved_actions_signal`, `idx_approved_actions_status`.

---

## 8. AI Foundation

1. **Capability Extension:** Added `'hospital_bottleneck'` to `aiCapabilitySchema` and `aiInteractionTypeSchema` in `packages/shared/src/api/ai.schemas.ts`.
2. **Information Gaps:** Added `'NO_ACTIVE_ENCOUNTERS'`, `'NO_PENDING_ORDERS'`, `'NO_CRITICAL_ALERTS'` to `gapCodeSchema`. Extended `computeInformationGaps` in `apps/backend/src/modules/ai/context/projections.ts`.
3. **Prompt Template:** Created `apps/backend/src/modules/ai/prompts/hospital-bottleneck.v1.ts` (`hospital_bottleneck@1`).
   - Strict healthcare safety instructions: NO clinical diagnosis, NO prescribing, NO discharge, NO autonomous actions, honest uncertainty, delimiter canonicalization.
   - Registered in `PROMPT_TEMPLATES` in `apps/backend/src/modules/ai/prompts/index.ts`.
4. **Audit Integration:** Added `BOTTLENECK_ANALYZED` to `AI_AUDIT_EVENTS` in `ai.audit.ts` and wired into `orchestrator.ts`.

---

## 9. Module & API Foundation

Created `apps/backend/src/modules/hospital-intelligence/`:
- `hospital-intelligence.audit.ts`: Defined `HOSPITAL_INTELLIGENCE_AUDIT_EVENTS` and audit payload builder.
- `hospital-intelligence.service.ts`: Service skeleton defining contracts for `analyzeHospitalOperations`, `getSignals`, `getSignalById`, `approveRecommendation`, `rejectRecommendation`.
- `hospital-intelligence.controller.ts`: Controller handling HTTP requests, Zod validation, and error forwarding.
- `hospital-intelligence.routes.ts`: Router mounted at `/api/v1/hospital-intelligence` with `authMiddleware` and `requirePermission` gates.
- Mounted in `apps/backend/src/app.ts`.

---

## 10. Frontend Foundation

- Created honest placeholder page: `apps/frontend/src/app/intelligence/page.tsx` wrapped in `<AppShell>` gated with `requiredPermission="intelligence:read"`.
- Registered route in `apps/frontend/src/components/layout/shellRoutes.ts` under Operations.
- Updated `apps/frontend/src/types/auth.ts` and `apps/frontend/src/utils/rbac.ts` with new permissions.
- Verified route consistency in `apps/frontend/src/components/layout/__tests__/shellRoutes.test.ts`.

---

## 11. Test Execution Results

| Package / Module | Test Command | Results | Status |
|:---|:---|:---|:---|
| **packages/shared** | `npx vitest run` | 7 test files, 71 passed (71) | **PASS** |
| **backend (M19 RBAC)** | `npx vitest run src/middleware/rbac/__tests__/m19-rbac.test.ts` | 1 test file, 9 passed (9) | **PASS** |
| **backend (AI Prompts & Gaps)** | `npx vitest run src/modules/ai/__tests__/prompts.test.ts src/modules/ai/__tests__/projections-gaps.test.ts` | 2 test files, 16 passed (16) | **PASS** |
| **backend (Hospital Intel Routes)**| `npx vitest run src/modules/hospital-intelligence/__tests__/routes.test.ts` | 1 test file, 13 passed (13) | **PASS** |
| **backend (Full Suite)** | `npm test` | 47 test files, 703 passed (703) | **PASS** |
| **frontend (Shell Routes)** | `npx vitest run src/components/layout/__tests__/shellRoutes.test.ts` | 1 test file, 5 passed (5) | **PASS** |
| **frontend (Full Suite)** | `npx vitest run` | 23 test files, 223 passed (223) | **PASS** |
| **WORKSPACE TOTAL** | — | **77 test files, 997 tests passed, 0 failures** | **PASS** |

---

## 12. Build & Compilation Results

- **Shared:** `npm run build` (`tsc`) — Exit code 0, no errors.
- **Backend:** `npm run build` (`tsc`) — Exit code 0, no errors.
- **Frontend:** `npm run build` (`next build`) — Exit code 0, all 19 static pages compiled and optimized cleanly (including `/intelligence`).

---

## 13. Security & Clinical Safety Boundaries

1. **Least Privilege & Deny-by-Default:** Roles without explicit intelligence grants (`pharmacist`, `lab_technician`, `receptionist`, `security_admin`) are strictly blocked with 403 on all `/api/v1/hospital-intelligence/*` endpoints.
2. **Read vs. Analyze vs. Approve Distinction:** `nurse` can read signals (`intelligence:read`) but CANNOT trigger analysis or approve recommendations (`intelligence:analyze` and `intelligence:approve` denied).
3. **PHI Minimization:** Signals reference patient UUIDs only; demographics and clinical narrative are omitted.
4. **No Autonomous Clinical Actions:** Prompt template and schemas explicitly forbid clinical diagnoses, prescribing, and autonomous mutations. All recommendations require explicit human approval.
5. **Audit Trail Integrity:** Audit events route exclusively through `AuditService.logEvent()`, maintaining the SHA-256 hash-chain.

---

## 14. Known Limitations & Open Questions

- Open questions from M19.0 (§27) remain open: signal retention policy, clinical thresholds review, admin scope, task module integration.
- Signal detection queries and AI explanation generation are intentionally NOT implemented in M19.1 (scheduled for M19.2).
- Action execution and notification dispatch are intentionally NOT implemented in M19.1 (scheduled for M19.3).
- Full Intelligence Center UI is intentionally NOT implemented in M19.1 (scheduled for M19.4).

---

## 15. Scope Confirmation

- [x] **M19.1 Established**
- [ ] **M19.2 NOT implemented** (No bottleneck detection queries or AI agent loop written)
- [ ] **M19.3 NOT implemented** (No action execution logic written)
- [ ] **M19.4 NOT implemented** (No finished Intelligence Center dashboard written)
- [ ] **M19.5 NOT implemented** (No safety benchmark harness written)
- [ ] **M18 Part 3 NOT started**
