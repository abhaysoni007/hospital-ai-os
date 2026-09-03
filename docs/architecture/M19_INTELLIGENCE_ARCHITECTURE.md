# M19 — Hospital Intelligence Architecture

> **Status:** M19.0 Architecture Lock — COMPLETE
> **Produced:** 2026-09-04
> **Authority:** Lead Implementation Engineer (M19.0)
> **Scope:** Hospital Intelligence architecture, data/context flow, deterministic signal detection, AI gateway boundary, evidence model, recommendation model, policy/permission validation, human approval, governed action execution, auditability, failure recovery, security/clinical safety, API boundaries, database impact, Intelligence Center UI, trigger model, evaluation architecture, M19 implementation sequence
>
> **Repository baseline:** M13 complete; M1-M13 frozen; backend 569/569 tests passing; live gates m6/m17 through m12.2 all passing.

---

## 1. Product Positioning

**Hospital AI OS** is an AI-native operating layer for hospital operations.

**Primary user question:** What needs attention, why does it matter, what evidence supports it, and what should we do next?

**One-line positioning:**

> Hospital AI OS is an AI-native operating layer that detects workflow bottlenecks across hospital operations, explains them using authorized evidence, and recommends or executes bounded actions under human control.

**Hero capability (M19):**

> **Hospital Workflow Bottleneck Detection** — a deterministic signal engine that identifies pending diagnostic results, stalled orders, escalating tasks, and unresolved workflow dependencies, explains them via an AI-powered Intelligence layer, and surfaces governed recommendations under human approval.

**Governing principle:**

> **AI recommends. Policy validates. Human authorizes. Existing authorized services execute. Audit records everything.**

The system must feel like a serious healthcare operating system. It is NOT a generic AI chatbot, NOT a generic AI dashboard.

---

## 2. Architecture Diagram

```text
Hospital Workflow State (existing DB tables)
 encounters / diagnostic_orders / diagnostic_results
 clinical_records / tasks / notifications / appointments
             |
             v
 Permission-Aware Context Engine
 (authorizeBreakGlassResourceAccess + RBAC policy engine)
 Reads ONLY records authorized for the requesting actor.
 PHI minimized to what is clinically necessary.
             |
             v
 Deterministic Signal Engine        <-- hospital_intelligence_signals table (NEW)
 (pure deterministic SQL queries + threshold rules)
 Computes signals: PENDING_DIAGNOSTIC, CRITICAL_RESULT_UNACKNOWLEDGED,
 ENCOUNTER_WITHOUT_CLINICAL_RECORD
 Evidence is REAL record references; no fabrication.
             |
             v (signal + evidence bundle)
 AI Gateway (existing AIOrchestrator, ADR-017/018/019/020)
 +- Readiness gate (AI_ENABLED, API key, encryption key)
 +- Global daily token budget (DB-backed)
 +- Per-user rate limiter
 +- Semaphore (concurrency cap)
 +- Circuit breaker (3 consecutive failures -> open 30s)
 +- Provider adapter (Gemini / OpenAI-compatible / Ollama / Fake)
             |
             v (bounded structured output)
 PARSE -> SCHEMA -> BUSINESS -> CITATION -> GAP
 Validation Pipeline (runValidationPipeline)
 Invalid output NEVER enters application state.
             |
             v
 Hospital Intelligence Layer
 +- Signal (deterministic, evidence-grounded)
 +- AI Explanation (bounded summarization of signal + evidence)
 +- Recommendation (actionable or informational, with uncertainty)
 +- Evidence References (manifest-validated, real record IDs only)
             |
             v
 Policy / Permission Validation (server-side, deny-by-default)
 Checks: recommendation action type in permitted actions for actor role
             |
             v (if actionable)
 Human Approval (explicit frontend interaction; no auto-execute)
             |
             v
 Idempotency Check (idempotency_key on intelligence_approved_actions)
             |
             v
 Existing Authorized Service (diagnostics / encounter / task / notification)
 No parallel mutation logic introduced. Existing services own mutations.
             |
             v
 Audit (AuditService.logEvent -> hash-chained audit_events)
 INTELLIGENCE_ANALYSIS_REQUESTED / SIGNAL_DETECTED
 RECOMMENDATION_CREATED / RECOMMENDATION_REJECTED
 ACTION_APPROVED / ACTION_EXECUTED / ACTION_FAILED
```

---

## 3. Repository Findings

### 3.1 What Already Exists (M11-M13 verified)

| Component | Location | Status |
|:---|:---|:---|
| **AI provider abstraction** | `apps/backend/src/modules/ai/adapters/provider.interface.ts` | **VERIFIED** — ADR-005 interface; Gemini, OpenAI-compatible, Ollama, Fake adapters all present |
| **AI orchestrator** | `apps/backend/src/modules/ai/orchestrator.ts` | **VERIFIED** — readiness gate -> budget -> rate limiter -> semaphore -> provider -> validation pipeline -> persist + audit |
| **Circuit breaker** | `apps/backend/src/modules/ai/resilience/circuit-breaker.ts` | **VERIFIED** — 3 failures/60s window -> open 30s -> half-open probe |
| **Semaphore / rate limiter** | `apps/backend/src/modules/ai/resilience/` | **VERIFIED** — per-user in-memory + global DB-backed token budget |
| **Output validation pipeline** | `apps/backend/src/modules/ai/validation/output-pipeline.ts` | **VERIFIED** — PARSE->SCHEMA->BUSINESS->CITATION->GAP; hallucinated citations rejected at stage 4 |
| **Context block allowlist** | `packages/shared/src/api/ai.schemas.ts` | **VERIFIED** — strict Zod discriminated union; 5 block types; unknown block types fail closed |
| **Deterministic gap detection** | `apps/backend/src/modules/ai/context/projections.ts` | **VERIFIED** — computeInformationGaps; computed before provider call; model echoes, never invents |
| **Input manifest** | `apps/backend/src/modules/ai/context/projections.ts` | **VERIFIED** — buildInputManifest; citation source of truth; AI cannot cite IDs not in manifest |
| **AI persistence** | `apps/backend/src/modules/ai/ai.persistence.ts` | **VERIFIED** — ai_interactions table; raw response encrypted AES-256-GCM |
| **AI audit events** | `apps/backend/src/modules/ai/ai.audit.ts` | **VERIFIED** — AI_DRAFT_GENERATED, AI_SEARCH_EXECUTED, AI_DRAFT_ACCEPTED, AI_DRAFT_REJECTED, AI_DRAFT_EDITED |
| **Audit service** | `apps/backend/src/modules/audit/audit.service.ts` | **VERIFIED** — SHA-256 hash-chain; exclusive table lock for concurrency; append-only |
| **RBAC policy engine** | `apps/backend/src/middleware/rbac/` | **VERIFIED** — static code config; deny-by-default; 7 roles x 31 permissions |
| **Break-glass resource auth** | `apps/backend/src/middleware/rbac/resource-auth.ts` | **VERIFIED** — authorizeBreakGlassResourceAccess; normal scope -> fallback to active break-glass session |
| **Clinical intelligence module** | `apps/backend/src/modules/clinical-intelligence/` | **VERIFIED** — ClinicalIntelligenceService; getClinicalTimeline, generateChartBrief, getDiagnosticTrend |
| **Intelligence routes** | `/api/v1/intelligence/*` | **VERIFIED** — mounted in app.ts; gated by authMiddleware + requirePermission('clinical_record:read') |
| **Correlation ID middleware** | `apps/backend/src/middleware/correlation-id.middleware.ts` | **VERIFIED** — X-Correlation-ID on every request |
| **Shared schemas** | `packages/shared/src/api/intelligence.schemas.ts` | **VERIFIED** — TimelineEvent, DiagnosticTrendPoint, ChartAnswerOutput, ClinicalTimelineResponse |
| **Frontend intelligence service** | `apps/frontend/src/services/intelligence.service.ts` | **VERIFIED** — getTimeline, generateChartBrief, getDiagnosticTrend wrappers over apiClient |
| **Frontend AppShell** | `apps/frontend/src/components/layout/AppShell/` | **VERIFIED** — permission-gated; breadcrumbs; skip-link; persisted collapse |
| **Frontend AI workspace route** | `/ai-workspace` | **VERIFIED** — currently an honest placeholder (EmptyState); requires ai_interaction:invoke; explicitly NOT a generic chat |
| **Design system** | `apps/frontend/src/components/ui/` | **VERIFIED** — 30 primitive components: PageHeader, MetricCard, SemanticBadges, Table, EmptyState, ErrorState, Skeleton, Spinner, ConfirmDialog, Toast, LineChart, Sparkline, DonutChart |
| **Prompt templates** | `apps/backend/src/modules/ai/prompts/` | **VERIFIED** — note-draft.v1.ts, chart-search.v1.ts; versioned; canonicalized |
| **AI config env vars** | `.env.example` | **VERIFIED** — AI_ENABLED, AI_PROVIDER, AI_API_KEY, AI_MODEL (gemini-2.5-flash), AI_TIMEOUT_MS, AI_MAX_TOKENS, AI_DAILY_TOKEN_BUDGET, AI_PER_USER_RATE_LIMIT, AI_SEMAPHORE_SIZE |
| **DB schema** | `docs/architecture/database-design.md` | **VERIFIED** — 17 tables; ai_interactions; audit_events; diagnostic_orders; encounters; clinical_records; tasks |

### 3.2 What Does NOT Exist Yet

| Component | Gap | Required For |
|:---|:---|:---|
| **hospital_intelligence_signals** table | New table required | M19.1 — Signal persistence |
| **intelligence_approved_actions** table | New table required | M19.3 — Action idempotency |
| **Bottleneck signal engine** | No deterministic signal detection for hospital operations | M19.2 — Hero agent |
| **Hospital-scoped context engine** | Clinical intelligence is per-patient only; hospital-wide context does not exist | M19.1/M19.2 |
| **Recommendation model** | No recommendation schema exists in shared | M19.1 |
| **Intelligence Center UI** | `/ai-workspace` is a placeholder EmptyState | M19.4 |
| **Signal-specific prompt template** | note-draft.v1.ts and chart-search.v1.ts exist; hospital-bottleneck.v1.ts does not | M19.2 |
| **`intelligence:read` permission** | Not in permissions.ts | M19.1 |
| **`intelligence:analyze` permission** | Not in permissions.ts | M19.1 |
| **`intelligence:approve` permission** | Not in permissions.ts | M19.3 |
| **Evaluation harness** | eval/medgemma-eval.ts exists for note-draft only; no bottleneck evaluation | M19.5 |

### 3.3 Existing Services Reusable Unchanged

| Service | Reuse Purpose |
|:---|:---|
| `AIOrchestrator.invokeStructured()` | AI explanation generation for signals |
| `AuditService.logEvent()` | All intelligence audit events |
| `authorizeBreakGlassResourceAccess()` | Authorization before any data projection |
| `requirePermission()` middleware | Route-level RBAC |
| `runValidationPipeline()` | Validation of AI explanation output |
| `buildInputManifest()` + `computeInformationGaps()` | Manifest + gap computation for intelligence context |
| `diagnosticsService` (existing) | Executing diagnostic-order-related governed actions |
| `notificationService` (existing) | Escalation notifications |
| `auditService` (singleton) | All audit events |

---

## 4. Existing Systems Reused

1. **`AIOrchestrator`** — reused as-is; `capability` enum extended with `'hospital_bottleneck'`
2. **`AIProviderAdapter` interface** — reused unchanged
3. **`runValidationPipeline`** — reused unchanged
4. **`buildInputManifest` / `computeInformationGaps`** — reused; gap codes extended with hospital-workflow gaps
5. **`contextBlockSchema`** — extended with `workflow_signal_context` block type for hospital-scope context
6. **`AuditService.logEvent`** — reused unchanged
7. **`requirePermission` middleware** — reused; new permissions added to permissions.ts
8. **`authorizeBreakGlassResourceAccess`** — reused for patient-scoped data within intelligence queries
9. **`ai_interactions` table** — reused; bottleneck analysis persisted with `interaction_type = 'hospital_bottleneck'`
10. **`audit_events` table** — reused; new event type constants defined in intelligence module
11. **Correlation ID middleware** — reused unchanged; all intelligence requests carry correlation IDs
12. **Frontend `apiClient`** — reused; no new HTTP client
13. **Frontend design primitives** — MetricCard, SemanticBadges, Table, EmptyState, ErrorState, Skeleton, PageHeader, ConfirmDialog, Toast — all reused as-is

---

## 5. New Systems Required

### 5.1 Backend

| Component | Type | Rationale |
|:---|:---|:---|
| `hospital_intelligence_signals` table | New DB table | Persist detected signals for polling, history, and deduplication |
| `intelligence_approved_actions` table | New DB table | Idempotency key store for approved actions |
| `modules/hospital-intelligence/` | New backend module | Signal engine + hospital-scope context engine + analysis controller |
| `prompts/hospital-bottleneck.v1.ts` | New prompt template | Structured explanation of bottleneck signals |
| New `GapCode` values | Schema extension | Hospital-workflow-specific gaps |
| New `permission` values | Schema extension | `intelligence:read`, `intelligence:analyze`, `intelligence:approve` |
| New `ai_interaction_type` enum value | Schema extension | `'hospital_bottleneck'` (migration 0007) |
| Intelligence API routes | New routes | `/api/v1/hospital-intelligence/*` |

### 5.2 Frontend

| Component | Type | Rationale |
|:---|:---|:---|
| `/intelligence` route | New Next.js page | Intelligence Center UI |
| `IntelligenceCenter` component | New page component | Signal list + evidence + recommendation + approval UX |
| `intelligence-service.ts` additions | Frontend service extension | New API methods for hospital intelligence |

### 5.3 Shared

| Component | Type | Rationale |
|:---|:---|:---|
| `intelligence-signal.schemas.ts` | New shared schema file | Signal, Evidence, Recommendation contracts |
| Extended `aiCapabilitySchema` | Schema extension | Add `'hospital_bottleneck'` |
| Extended `gapCodeSchema` | Schema extension | Hospital-workflow gap codes |

---

## 6. Deterministic Signal Architecture

### 6.1 Principle

A signal is the OUTPUT of deterministic logic applied to real database records. AI never generates a signal. AI only explains a signal after it has been deterministically detected and evidence-grounded.

```text
Signal = f(real_records, threshold_rules) -> exists or does not exist
```

A signal is explainable independently of AI. If AI is unavailable, signals are still detected and displayed; explanations read "AI explanation unavailable."

### 6.2 Signal Detection Queries

All signal detection queries run on existing tables. No new tables needed for detection — only for persistence.

**Signal Family 1: PENDING_DIAGNOSTIC_RESULT**

```sql
SELECT
  o.id AS order_id, o.encounter_id, o.patient_id, o.test_code, o.test_name,
  o.priority, o.status, o.created_at AS ordered_at,
  EXTRACT(EPOCH FROM (NOW() - o.created_at)) / 3600 AS hours_pending,
  e.doctor_id, e.department_id
FROM diagnostic_orders o
JOIN encounters e ON e.id = o.encounter_id
WHERE
  o.status IN ('ordered', 'sample_collected')
  AND e.status = 'active'
  AND o.created_at < NOW() - INTERVAL '4 hours'   -- configurable threshold
  AND NOT EXISTS (SELECT 1 FROM diagnostic_results r WHERE r.order_id = o.id)
ORDER BY
  CASE o.priority WHEN 'stat' THEN 1 WHEN 'urgent' THEN 2 ELSE 3 END,
  o.created_at ASC;
```

**Signal Family 2: CRITICAL_RESULT_UNACKNOWLEDGED**

```sql
SELECT
  n.id AS notification_id, n.recipient_id, n.reference_id AS order_id,
  n.created_at AS critical_at,
  EXTRACT(EPOCH FROM (NOW() - n.created_at)) / 60 AS minutes_unacknowledged,
  dr.patient_id, dr.order_id
FROM notifications n
JOIN diagnostic_results dr ON dr.order_id = n.reference_id
WHERE
  n.notification_type = 'critical_lab_alert'
  AND n.status != 'acknowledged'
  AND n.created_at < NOW() - INTERVAL '30 minutes'
ORDER BY n.created_at ASC;
```

**Signal Family 3: ENCOUNTER_WITHOUT_CLINICAL_RECORD**

```sql
SELECT
  e.id AS encounter_id, e.patient_id, e.doctor_id, e.department_id,
  e.status, e.started_at,
  EXTRACT(EPOCH FROM (NOW() - e.started_at)) / 3600 AS hours_active
FROM encounters e
WHERE
  e.status = 'active'
  AND e.started_at < NOW() - INTERVAL '2 hours'
  AND NOT EXISTS (
    SELECT 1 FROM clinical_records cr
    WHERE cr.encounter_id = e.id AND cr.status = 'signed'
  )
ORDER BY e.started_at ASC;
```

**Signal Family 4 (future, NOT M19): TASK_APPROACHING_ESCALATION**

```sql
-- Deferred: task module endpoints planned for M14
SELECT t.id, t.task_type, t.title, t.patient_id, t.encounter_id, t.assigned_to,
       t.priority, t.status, t.due_at,
       EXTRACT(EPOCH FROM (t.due_at - NOW())) / 3600 AS hours_until_due
FROM tasks t
WHERE
  t.status NOT IN ('completed', 'cancelled')
  AND t.due_at IS NOT NULL
  AND t.due_at < NOW() + INTERVAL '2 hours'
  AND t.due_at > NOW()
ORDER BY t.due_at ASC;
```

### 6.3 Signal Severity Levels

```text
CRITICAL  -- immediate patient safety or regulatory risk (critical result unacknowledged)
HIGH      -- operational risk or SLA breach imminent (STAT order pending > 2h)
MEDIUM    -- efficiency concern (routine order pending > 8h, task due < 2h)
LOW       -- informational (pattern worth noting)
```

Severity is computed deterministically from `priority`, `hours_pending`, and threshold_rules. AI never sets severity.

### 6.4 Hero Signal Set for M19

| Signal Type | Why Selected |
|:---|:---|
| `PENDING_DIAGNOSTIC_RESULT` | Rich evidence available; high demo value; no clinical decision involved |
| `CRITICAL_RESULT_UNACKNOWLEDGED` | Safety-critical; deterministic from existing notifications table |
| `ENCOUNTER_WITHOUT_CLINICAL_RECORD` | Operational gap; fully deterministic from encounters + clinical_records |

**NOT selected for M19:**
- `TASK_APPROACHING_ESCALATION` — task module not fully implemented; endpoint planned for M14
- Appointment-level bottlenecks — lower demo value; appointment workflow largely automated

---

## 7. Context Engine

The **Permission-Aware Context Engine** for hospital intelligence:

```typescript
interface HospitalIntelligenceContextRequest {
  actor: AiPrincipal;          // JWT-derived; no client-supplied identity
  scope: 'department' | 'hospital_admin';
  analysisCorrelationId: string; // from correlationId middleware
}

interface HospitalIntelligenceContext {
  signals: DetectedSignal[];        // deterministically detected
  evidenceBundle: EvidenceBundle;   // real record references
  contextSummary: {                // persisted in ai_interactions.context_summary
    signalCount: number;
    signalTypes: string[];
    departmentId: string | null;
    analysisTimestamp: string;
  };
}
```

**Authorization rules:**
1. `requirePermission('intelligence:analyze')` on route — RBAC role check
2. Scope: physician/nurse see signals for their department only; `hospital_admin` sees all
3. Patient records within signal context: `authorizeBreakGlassResourceAccess` applied per patient
4. PHI minimized: patient identity in signals is `patientId` (UUID) only; name/DOB NEVER in signal; frontend resolves minimal identity separately via existing `/api/v1/patients/:id` with `patient:read` permission

---

## 8. AI Gateway

### 8.1 Existing Gateway (REUSED AS-IS)

The AI gateway is **fully implemented** in `modules/ai/`. M19 reuses it entirely:

```typescript
AIOrchestrator.invokeStructured<HospitalBottleneckExplanationOutput>({
  capability: 'hospital_bottleneck',
  principal: { staffId, role, departmentId },
  blocks: contextBlocks,           // WorkflowSignalContextBlock[]
  outputSchema: hospitalBottleneckExplanationOutputSchema,
  correlationId: req.correlationId,
})
```

The gateway provides:
- Readiness gate (disabled/ready/breaker_open/unavailable)
- Global daily token budget (DB-backed, cross-user)
- Per-user rate limiting (in-memory)
- Semaphore (max 4 concurrent provider calls)
- Circuit breaker (3 failures -> open 30s -> half-open probe)
- AbortSignal-based timeout (configurable AI_TIMEOUT_MS, default 30s)
- Provider isolation (Gemini/OpenAI-compatible/Ollama/Fake) via adapter pattern
- Structured output + validation pipeline
- AES-256-GCM encrypted raw response persistence
- Metadata-only audit event

### 8.2 Extension Required

**New capability registration** (aiCapabilitySchema in packages/shared/src/api/ai.schemas.ts):

```typescript
// BEFORE
export const aiCapabilitySchema = z.enum(['note_draft', 'chart_search']);

// AFTER (M19.1)
export const aiCapabilitySchema = z.enum(['note_draft', 'chart_search', 'hospital_bottleneck']);
```

**New ai_interaction_type DB enum value** (migration 0007_hospital_intelligence):

```sql
ALTER TYPE ai_interaction_type ADD VALUE 'hospital_bottleneck';
```

**New prompt template:** `prompts/hospital-bottleneck.v1.ts`

**New gap codes** for hospital-scope gaps:

```typescript
'NO_ACTIVE_ENCOUNTERS'    // no active encounters in scope
'NO_PENDING_ORDERS'       // no pending diagnostic orders
'NO_CRITICAL_ALERTS'      // no unacknowledged critical alerts
```

### 8.3 AI Safety Boundary (Hospital Intelligence Specific)

AI for hospital bottleneck detection is bounded to:
- Summarize signals that deterministic logic already detected
- Explain WHY a signal matters in clinical/operational terms
- Suggest ONE recommended next action from a bounded vocabulary
- Express uncertainty and limitations
- Cite real evidence from the input manifest

AI must NOT:
- Diagnose the patient
- Recommend clinical treatment
- Override the severity level computed by deterministic logic
- Claim a signal exists when the deterministic engine did not detect it
- Recommend actions outside the permitted action vocabulary
- Access patient records not provided in the bounded context

---

## 9. Signal Contract

```typescript
// packages/shared/src/api/intelligence-signal.schemas.ts (NEW in M19.1)

export const signalTypeSchema = z.enum([
  'PENDING_DIAGNOSTIC_RESULT',
  'CRITICAL_RESULT_UNACKNOWLEDGED',
  'ENCOUNTER_WITHOUT_CLINICAL_RECORD',
]);

export const signalSeveritySchema = z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']);

export const signalStatusSchema = z.enum([
  'detected',    // created by deterministic engine
  'analyzed',    // AI explanation attached
  'actioned',    // human approved + existing service executed
  'dismissed',   // dismissed by authorized actor
  'resolved',    // underlying condition resolved (e.g., result entered)
  'stale',       // signal no longer valid (underlying records changed)
]);

export const detectedSignalSchema = z.object({
  signalId: uuidSchema,
  signalType: signalTypeSchema,
  severity: signalSeveritySchema,     // deterministic; AI cannot override
  title: z.string().max(200),
  description: z.string().max(1000),
  detectedAt: z.string().datetime(),
  status: signalStatusSchema,
  patientId: uuidSchema.nullable(),
  encounterId: uuidSchema.nullable(),
  evidenceRefs: z.array(evidenceRefSchema).min(1),
  deterministicReason: z.string().max(500),
  aiExplanation: aiExplanationSchema.nullable(),
  recommendation: recommendationSchema.nullable(),
  correlationId: uuidSchema,
}).strict();
```

---

## 10. Evidence Contract

Evidence references REAL authorized database records. AI cannot invent evidence IDs.

```typescript
export const evidenceSourceTypeSchema = z.enum([
  'DIAGNOSTIC_ORDER', 'DIAGNOSTIC_RESULT', 'ENCOUNTER',
  'CLINICAL_RECORD', 'NOTIFICATION', 'TASK',
]);

export const evidenceStatusSchema = z.enum([
  'present',        // record exists and is accessible
  'insufficient',   // record exists but lacks required data
  'missing',        // expected record does not exist (IS a valid evidence state)
  'unauthorized',   // record exists but actor cannot access it
]);

export const evidenceRefSchema = z.object({
  evidenceId: uuidSchema,
  sourceType: evidenceSourceTypeSchema,
  sourceRecordId: uuidSchema,          // actual DB record UUID
  relevantAt: z.string().datetime(),
  evidenceStatus: evidenceStatusSchema,
  authorizedVisibility: z.boolean(),
  relationToSignal: z.string().max(200),
}).strict();
```

**Critical rule:** The system must be able to represent `INSUFFICIENT_EVIDENCE`:

```typescript
evidenceRefs: [{
  evidenceId: generatedUUID,
  sourceType: 'DIAGNOSTIC_ORDER',
  sourceRecordId: orderId,
  relevantAt: orderCreatedAt,
  evidenceStatus: 'missing',   // result not yet entered
  authorizedVisibility: true,
  relationToSignal: 'No diagnostic result found for order placed 6h ago',
}]
```

**AI citation contract:** AI explanation citations must reference only `sourceRecordId` values provided in the input manifest. The validation pipeline (stage 4 — CITATION) rejects any citation not in the manifest.

---

## 11. Recommendation Contract

```typescript
export const recommendationActionTypeSchema = z.enum([
  'ESCALATE_ALERT',              // elevate notification priority
  'NOTIFY_ATTENDING_PHYSICIAN',  // send notification to assigned doctor
  'ACKNOWLEDGE_CRITICAL_ALERT',  // acknowledge notification (notification service)
  'REASSIGN_TASK',               // reassign task (task service -- M14 scope)
  'VIEW_PATIENT_RECORD',         // navigate to patient record (no mutation)
  'VIEW_DIAGNOSTIC_ORDER',       // navigate to order (no mutation)
]);

export const recommendationStatusSchema = z.enum([
  'proposed',              // AI generated; awaiting human review
  'approved',              // human approved; pending execution
  'executed',              // existing service executed successfully
  'rejected',              // human rejected
  'policy_rejected',       // policy/permission check failed
  'execution_failed',      // existing service returned error
  'insufficient_evidence', // evidence validation failed before approval
  'unavailable',           // AI was unavailable; no recommendation generated
]);

export const recommendationSchema = z.object({
  recommendationId: uuidSchema,
  signalId: uuidSchema,
  actionType: recommendationActionTypeSchema,
  rationale: z.string().max(2000),
  evidenceRefs: z.array(uuidSchema),
  uncertaintyNote: z.string().max(500).optional(),
  limitationsNote: z.string().max(500).optional(),
  requiresHumanApproval: z.boolean(),
  policyStatus: recommendationStatusSchema,
  executableStatus: recommendationStatusSchema,
  createdAt: z.string().datetime(),
}).strict();
```

**Recommendation categories:**

| Category | Description | Human Approval Required |
|:---|:---|:---|
| `informational` | No mutation; status change only | No (but still logged) |
| `actionable` | Mutation via existing service | **Yes — mandatory** |
| `rejected` | Human dismissed | N/A |
| `insufficient_evidence` | Evidence validation failed | N/A |
| `unavailable` | AI unavailable | N/A |

A recommendation is NOT automatically an executable action. An `actionable` recommendation becomes executable ONLY after explicit human approval.

---

## 12. Policy / Permission Validation

### 12.1 New Permissions Required

These permissions do NOT exist in `permissions.ts`. They must be added in M19.1:

| Permission | Purpose | Roles Allowed |
|:---|:---|:---|
| `intelligence:read` | View detected signals and their explanations | physician, nurse, hospital_admin |
| `intelligence:analyze` | Trigger a new intelligence analysis | physician, hospital_admin |
| `intelligence:approve` | Approve a recommendation for execution | physician, hospital_admin |

### 12.2 Policy Validation at Recommendation Execution

Before executing any recommended action, the system must re-validate:

```typescript
async function validateRecommendationPolicy(
  actor: AiPrincipal,
  recommendation: Recommendation,
  signal: DetectedSignal,
): Promise<PolicyValidationResult> {
  // 1. Permission check: actor must have intelligence:approve
  // 2. Action type check: actionType must be in permitted vocabulary
  // 3. Evidence re-validation: evidence still exists and is still valid
  // 4. Signal recency check: signal not stale (underlying condition still exists)
  // 5. Idempotency check: no approved_action with same idempotency_key
}
```

Authorization must remain **deny-by-default**. Permission check failures return 403 with audit event `RECOMMENDATION_POLICY_REJECTED`.

---

## 13. Human Approval

The approval interaction is an explicit frontend action — never automatic.

**Approval flow:**

```text
1. Intelligence Center displays detected signal with AI explanation
2. Actor reads: signal -> evidence -> rationale -> uncertainty note
3. Actor clicks "Approve Action" -> ConfirmDialog (existing component)
   - Dialog shows: action type, target, rationale, evidence
   - Actor must explicitly confirm
4. Frontend calls POST /api/v1/hospital-intelligence/recommendations/:id/approve
5. Server re-validates: permissions + evidence + signal recency + idempotency
6. If valid: existing authorized service executes mutation
7. Audit event: ACTION_APPROVED + ACTION_EXECUTED (or ACTION_FAILED)
8. Intelligence Center updates: recommendation status -> 'executed' or 'execution_failed'
```

AI must NOT approve its own recommendation. Self-approval is architecturally prevented because:
- Approval requires `intelligence:approve` permission (role-based, human actor)
- AI has no identity in the permission system
- Approval requires HTTP request with JWT carrying a human actor's `staffId`

---

## 14. Governed Action Execution Lifecycle

```text
AI Recommendation (bounded vocabulary)
         |
         v
Schema Validation (recommendationActionTypeSchema)
         |
         v
Evidence Validation (evidenceRefs still valid; signal not stale)
         |
         v
Policy Validation (intelligence:approve permission; action type in permitted set)
         |
         v
Permission Validation (server-side requirePermission; never client-only)
         |
         v
Human Approval (ConfirmDialog; explicit HTTP POST)
         |
         v
Idempotency Check (intelligence_approved_actions.idempotency_key -- UNIQUE)
         |
         v
Existing Authorized Service (notification/task/encounter -- no new mutation logic)
         |
         v
Audit (ACTION_APPROVED -> ACTION_EXECUTED / ACTION_FAILED)
```

**Services used for action execution (reused unchanged):**

| Action Type | Existing Service | Endpoint |
|:---|:---|:---|
| `ACKNOWLEDGE_CRITICAL_ALERT` | NotificationService | `PATCH /api/v1/notifications/:id/acknowledge` |
| `NOTIFY_ATTENDING_PHYSICIAN` | NotificationService (new notification record) | Internal service call |
| `ESCALATE_ALERT` | NotificationService (update priority) | Internal service call |
| `VIEW_PATIENT_RECORD` | Frontend navigation only | No mutation |
| `VIEW_DIAGNOSTIC_ORDER` | Frontend navigation only | No mutation |

No new mutation services are created. AI never calls these services directly.

---

## 15. API Contracts

### 15.1 Hospital Intelligence Routes

**Base path:** `/api/v1/hospital-intelligence`

| Method | Path | Permission | Purpose | Deterministic? | AI? | Audited? |
|:---|:---|:---|:---|:---|:---|:---|
| POST | `/analyze` | `intelligence:analyze` | Trigger analysis | Signals: YES | Explanations: YES | YES |
| GET | `/signals` | `intelligence:read` | List persisted signals | YES | NO | NO |
| GET | `/signals/:id` | `intelligence:read` | Signal detail + evidence | YES | NO | NO |
| POST | `/recommendations/:id/approve` | `intelligence:approve` | Human approval + execute | YES (validation) | NO | YES |
| POST | `/recommendations/:id/reject` | `intelligence:approve` | Human rejection | YES | NO | YES |

**POST /analyze request:**

```json
{ "scope": "department" }
```

**POST /analyze response (grounded):**

```json
{
  "data": {
    "analysisId": "uuid",
    "requestedAt": "ISO datetime",
    "signals": [
      {
        "signalId": "uuid",
        "signalType": "PENDING_DIAGNOSTIC_RESULT",
        "severity": "HIGH",
        "title": "Stat CBC Order Pending 6h",
        "deterministicReason": "diagnostic_orders.status IN ('ordered','sample_collected') AND created_at < NOW() - INTERVAL '4 hours' AND priority = 'stat'",
        "aiExplanation": {
          "summary": "...",
          "citations": [...],
          "disclaimers": [...],
          "informationGaps": [...],
          "groundingStatus": "grounded"
        },
        "recommendation": {
          "recommendationId": "uuid",
          "actionType": "NOTIFY_ATTENDING_PHYSICIAN",
          "rationale": "...",
          "requiresHumanApproval": true,
          "policyStatus": "proposed"
        }
      }
    ],
    "aiStatus": "grounded",
    "correlationId": "uuid"
  }
}
```

**POST /analyze response (AI unavailable -- signals still returned):**

```json
{
  "data": {
    "signals": [
      {
        "signalType": "PENDING_DIAGNOSTIC_RESULT",
        "severity": "HIGH",
        "deterministicReason": "...",
        "aiExplanation": null,
        "recommendation": null
      }
    ],
    "aiStatus": "unavailable"
  }
}
```

**Error states:**

| HTTP | Code | Condition |
|:---|:---|:---|
| 401 | UNAUTHORIZED | No JWT |
| 403 | INSUFFICIENT_PERMISSIONS | Role lacks required permission |
| 503 | AI_SERVICE_UNAVAILABLE | AI circuit breaker open or disabled (signals still returned with aiStatus=unavailable) |
| 422 | INSUFFICIENT_EVIDENCE | No active signals in scope |
| 409 | RECOMMENDATION_ALREADY_ACTED | Idempotency key collision |

### 15.2 Standard Response Envelope

Follows existing convention:

```json
{ "data": { ... } }
```

Errors: `{ "error": { "code": "...", "message": "..." } }`

---

## 16. Permissions

### 16.1 New Permissions (M19.1)

**`intelligence:read`**
- View detected signals, AI explanations, evidence references, recommendation status
- Roles: `physician`, `nurse`, `hospital_admin`

**`intelligence:analyze`**
- Trigger a new hospital intelligence analysis
- Roles: `physician`, `hospital_admin`

**`intelligence:approve`**
- Approve or reject a recommendation for execution
- Roles: `physician`, `hospital_admin`

### 16.2 Enforcement

- Permissions checked server-side via `requirePermission()` middleware
- UI element visibility is a UX convenience, NOT a security control
- Authorization failures return 403 and emit audit events
- Deny-by-default: unknown roles and unknown permissions return denied

---

## 17. Audit Architecture

### 17.1 New Audit Event Types

| Event Type | Trigger | Target Type |
|:---|:---|:---|
| `INTELLIGENCE_ANALYSIS_REQUESTED` | POST /analyze received | INTELLIGENCE_ANALYSIS |
| `INTELLIGENCE_ANALYSIS_COMPLETED` | Signals returned to caller | INTELLIGENCE_ANALYSIS |
| `SIGNAL_DETECTED` | Deterministic engine found signal | INTELLIGENCE_SIGNAL |
| `SIGNAL_DISMISSED` | Actor dismissed signal | INTELLIGENCE_SIGNAL |
| `RECOMMENDATION_CREATED` | AI recommendation attached to signal | INTELLIGENCE_RECOMMENDATION |
| `RECOMMENDATION_APPROVED` | Human approved recommendation | INTELLIGENCE_RECOMMENDATION |
| `RECOMMENDATION_REJECTED` | Human rejected recommendation | INTELLIGENCE_RECOMMENDATION |
| `RECOMMENDATION_POLICY_REJECTED` | Server-side policy rejected | INTELLIGENCE_RECOMMENDATION |
| `ACTION_APPROVED` | Approval validation passed; execution started | INTELLIGENCE_ACTION |
| `ACTION_EXECUTED` | Existing service executed successfully | INTELLIGENCE_ACTION |
| `ACTION_FAILED` | Existing service returned error | INTELLIGENCE_ACTION |

### 17.2 Reuse

All events use the existing `AuditService.logEvent()` — SHA-256 hash-chained, REVOKE UPDATE DELETE on audit_events, correlation ID linkage. No new audit infrastructure.

### 17.3 PHI in Audit Events

- `action_detail` carries only metadata: signal type, severity, recommendation type, model, token counts
- `patient_id` field populated when signal relates to specific patient (existing column)
- NO clinical content (note text, lab values, diagnoses) in audit events
- NO raw AI response in audit events

---

## 18. Failure / Degradation Architecture

| Failure Mode | System Behavior | Safe? |
|:---|:---|:---|
| **AI unavailable** (disabled/breaker_open) | Signals detected; `aiExplanation = null`; `recommendation = null`; `aiStatus: "unavailable"` | YES |
| **AI timeout** (>30s) | Maps to AIServiceError; 503; signals still detected and persisted | YES |
| **Invalid AI output** (validation pipeline fails) | `validation_failed` in ai_interactions; signal persisted with `aiExplanation = null`; no false recommendation | YES |
| **Missing evidence** | Signal still detected; `evidenceStatus = 'missing'`; AI receives honest gap codes | YES |
| **Unauthorized recommendation** | Policy validation returns 403; RECOMMENDATION_POLICY_REJECTED audit event | YES |
| **Hallucinated evidence ID** | Validation pipeline stage 4 rejects; `validation_failed`; no recommendation surfaced | YES |
| **Duplicate approval request** | `intelligence_approved_actions.idempotency_key` UNIQUE constraint; 409; audit already exists | YES |
| **Existing service failure** | Error caught; ACTION_FAILED audit event; no partial clinical state | YES |
| **Partial signal failure** | Signals are isolated; one failure does not affect others | YES |
| **Signal stale at approval time** | Re-query at approval; if underlying records changed, policy rejects | YES |

The system fails safely. AI unavailability never blocks deterministic signal detection.

---

## 19. Security / Clinical Safety

| Protection | Mechanism | Verified? |
|:---|:---|:---|
| **Least privilege** | New permissions with minimal role grants | Architecturally defined; implemented M19.1 |
| **Deny-by-default** | `requirePermission()` middleware; RBAC policy engine; static code config | Existing -- VERIFIED |
| **Server-side enforcement** | All permission checks on backend; UI only mirrors | Existing -- VERIFIED |
| **PHI minimization** | patientId (UUID) only in signals; name/DOB excluded | Architecturally defined |
| **Authorized evidence only** | Input manifest from authorization-before-projection; AI citation validated against manifest | Existing pipeline -- VERIFIED |
| **No sensitive AI logs** | context_summary is metadata only; raw response encrypted AES-256-GCM | Existing -- VERIFIED |
| **No AI DB credentials** | AI adapter receives context blocks, not DB connection | Existing -- VERIFIED |
| **No arbitrary tool execution** | AI is text-in/text-out only; no function calling | Existing -- VERIFIED |
| **No break-glass activation by AI** | AI has no permission to activate break-glass | Existing -- VERIFIED |
| **No audit modification by AI** | Audit table: REVOKE UPDATE DELETE FROM PUBLIC; AI cannot write to it | Existing -- VERIFIED |
| **No policy bypass** | Policy validation is synchronous, server-side, before any execution | Architecturally defined |
| **No self-approval** | Approval requires JWT-authenticated human actor; AI has no JWT identity | Architecturally enforced |
| **Mutation idempotency** | intelligence_approved_actions.idempotency_key UNIQUE | Architecturally defined |
| **Correlation/audit linkage** | correlationId on all requests; signalId + analysisId in audit events | Architecturally defined |

**Clinical safety boundaries:**
- Signals are OPERATIONAL (workflow state) -- NOT clinical diagnoses
- AI explanation explicitly disclaimed as "workflow analysis, not clinical advice"
- AI cannot recommend clinical treatment, prescribing, diagnosis, or discharge
- Recommendation vocabulary is strictly bounded (recommendationActionTypeSchema)
- Human approval required for ALL mutations
- Deterministic severity cannot be overridden by AI

---

## 20. Database Impact

### 20.1 New Tables (migration 0007_hospital_intelligence)

**Table: `hospital_intelligence_signals`**

```sql
CREATE TYPE signal_type AS ENUM (
  'PENDING_DIAGNOSTIC_RESULT',
  'CRITICAL_RESULT_UNACKNOWLEDGED',
  'ENCOUNTER_WITHOUT_CLINICAL_RECORD'
);
CREATE TYPE signal_severity AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');
CREATE TYPE signal_status AS ENUM (
  'detected', 'analyzed', 'actioned', 'dismissed', 'resolved', 'stale'
);

CREATE TABLE hospital_intelligence_signals (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_type             signal_type NOT NULL,
  severity                signal_severity NOT NULL,      -- deterministic; NOT set by AI
  title                   VARCHAR(200) NOT NULL,
  description             TEXT NOT NULL,
  detected_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status                  signal_status NOT NULL DEFAULT 'detected',
  patient_id              UUID REFERENCES patients(id),
  encounter_id            UUID REFERENCES encounters(id),
  evidence_refs           JSONB NOT NULL,                -- EvidenceRef[]
  deterministic_reason    TEXT NOT NULL,
  ai_interaction_id       UUID REFERENCES ai_interactions(id),
  ai_explanation          JSONB,                         -- NULL if AI unavailable
  recommendation_id       UUID,
  analysis_correlation_id UUID NOT NULL,
  requested_by            UUID NOT NULL REFERENCES staff(id),
  resolved_at             TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_signals_status ON hospital_intelligence_signals(status);
CREATE INDEX idx_signals_type ON hospital_intelligence_signals(signal_type);
CREATE INDEX idx_signals_severity ON hospital_intelligence_signals(severity);
CREATE INDEX idx_signals_patient ON hospital_intelligence_signals(patient_id) WHERE patient_id IS NOT NULL;
CREATE INDEX idx_signals_created ON hospital_intelligence_signals(created_at DESC);
CREATE INDEX idx_signals_correlation ON hospital_intelligence_signals(analysis_correlation_id);
```

**Table: `intelligence_approved_actions`**

```sql
CREATE TYPE recommendation_status AS ENUM (
  'proposed', 'approved', 'executed', 'rejected',
  'policy_rejected', 'execution_failed', 'insufficient_evidence', 'unavailable'
);

CREATE TABLE intelligence_approved_actions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_id             UUID NOT NULL REFERENCES hospital_intelligence_signals(id),
  action_type           VARCHAR(100) NOT NULL,
  rationale             TEXT NOT NULL,                   -- AI-generated; persisted for audit
  evidence_refs         JSONB NOT NULL,
  requires_human_approval BOOLEAN NOT NULL DEFAULT TRUE,
  policy_status         recommendation_status NOT NULL DEFAULT 'proposed',
  executable_status     recommendation_status NOT NULL DEFAULT 'proposed',
  idempotency_key       VARCHAR(255) NOT NULL UNIQUE,    -- prevents duplicate execution
  approved_by           UUID REFERENCES staff(id),
  approved_at           TIMESTAMPTZ,
  rejected_by           UUID REFERENCES staff(id),
  rejected_at           TIMESTAMPTZ,
  rejection_reason      TEXT,
  execution_result      JSONB,                           -- metadata only; no PHI
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_approved_actions_idempotency ON intelligence_approved_actions(idempotency_key);
CREATE INDEX idx_approved_actions_signal ON intelligence_approved_actions(signal_id);
CREATE INDEX idx_approved_actions_status ON intelligence_approved_actions(policy_status);
```

### 20.2 Enum Extensions (migration 0007)

```sql
ALTER TYPE ai_interaction_type ADD VALUE 'hospital_bottleneck';
```

### 20.3 No Other Schema Changes

- Existing `ai_interactions`, `audit_events`, `encounters`, `diagnostic_orders`, `notifications`, `tasks` tables are **unchanged**
- No new indexes on existing tables required
- Existing indexes `idx_diagnostic_orders_status`, `idx_encounters_status` are sufficient

---

## 21. Intelligence Center UI Architecture

### 21.1 Route

```
/intelligence    ->   apps/frontend/src/app/intelligence/page.tsx
```

Added to `shellRoutes.ts`:

```typescript
{
  href: '/intelligence',
  section: 'Operations',
  label: 'Intelligence',
  requiredPermission: 'intelligence:read',
}
```

### 21.2 Information Hierarchy

The Intelligence Center answers in this order:

1. **What is happening?** — Signal type + severity badge + title
2. **Why does it matter?** — AI explanation summary (if available) + deterministic reason (always)
3. **What evidence supports it?** — Evidence references with links to existing workspace pages
4. **What should we do next?** — Recommendation with rationale + uncertainty note
5. **What is the policy status?** — Proposed / approved / rejected / executed
6. **Does human approval exist?** — ConfirmDialog before any mutation
7. **What happened after approval?** — Execution result + audit trail link

### 21.3 Reused Design Primitives

No new design system created. All primitives reused from `apps/frontend/src/components/ui/`:

| Primitive | Use |
|:---|:---|
| `PageHeader` | Intelligence Center header |
| `Table` | Signal list |
| `SemanticBadges` | Severity + status badges |
| `MetricCard` | Signal count summary (CRITICAL: N, HIGH: N) |
| `Skeleton` | Loading state during analysis |
| `EmptyState` | No signals detected |
| `ErrorState` | Analysis failed |
| `ConfirmDialog` | Recommendation approval |
| `Toast` | Execution success/failure notification |
| `Spinner` | Analysis in progress |
| `AppShell` | Shell integration with breadcrumbs |

### 21.4 Degraded States

| State | UI Behavior |
|:---|:---|
| AI unavailable | Amber banner: "AI explanation unavailable. Signals still detected." Signals shown without aiExplanation. No recommendation block. |
| Insufficient evidence | EmptyState: "No bottlenecks detected in your scope." |
| Analysis error | ErrorState with retry button |
| Recommendation policy rejected | Toast: "Action not permitted for your role." |
| Execution failed | Toast: "Action could not be completed. See audit log." |

---

## 22. Trigger Model

### 22.1 M19 — On-Demand Only

Analysis is triggered only by explicit user action:

```
Actor clicks "Analyze Operations" -> POST /api/v1/hospital-intelligence/analyze
```

No background analysis, no scheduled analysis, no event-triggered analysis in M19.

**Rationale:** On-demand trigger is sufficient for M19. Background infrastructure (BullMQ — ADR-007) exists as an ADR but is not implemented; explicitly excluded from M19 scope.

### 22.2 Future (NOT M19)

The architecture supports:
- Scheduled analysis (cron trigger, BullMQ job — ADR-007)
- Event-triggered analysis (on diagnostic_result INSERT with is_critical = TRUE)

These are future scope. No infrastructure for them introduced in M19.

---

## 23. Observability

### 23.1 Correlation ID Linkage

```
HTTP Request (correlationId)
  -> audit_event (correlationId)
  -> hospital_intelligence_signals (analysis_correlation_id)
  -> ai_interactions (correlationId -- passed to orchestrator)
  -> intelligence_approved_actions (via signal_id -> analysis_correlation_id)
```

### 23.2 Metrics Tracked

Reusing existing ai_interactions columns:
- Analysis latency (total): hospital_intelligence_signals.created_at - request received time
- AI latency: ai_interactions.latency_ms
- Input/output tokens: ai_interactions.input_tokens, output_tokens
- Grounding status: ai_interactions.grounding_status
- User action outcome: intelligence_approved_actions.executable_status

### 23.3 Health Check

Existing `/api/v1/health` endpoint exposes `checks.ai` (AI subsystem state). Intelligence Center reads this to determine whether to show the degraded banner.

---

## 24. Evaluation Architecture

### 24.1 Synthetic Test Scenarios

| Scenario | Setup | Expected Outcome |
|:---|:---|:---|
| **Clear bottleneck** | Insert diagnostic_order: status='ordered', created_at=6h ago, no result, encounter active | PENDING_DIAGNOSTIC_RESULT detected; severity HIGH; AI explanation grounded |
| **No bottleneck** | All orders have results; all encounters have signed notes; no critical alerts | Empty signal list |
| **Multiple bottlenecks** | STAT order pending 4h + critical result unacknowledged 45min | Two signals; correct severity ordering |
| **Insufficient evidence** | Signal detected but records deleted/resolved between detection and AI call | evidenceStatus='missing'; AI receives gap codes; no false recommendation |
| **Unauthorized context** | Actor role='lab_technician' (no intelligence:analyze) | 403; RECOMMENDATION_POLICY_REJECTED audit event |
| **AI unavailable** | AI_ENABLED=false or breaker forced open | Signals detected; aiExplanation=null; aiStatus='unavailable' |
| **Invalid AI output** | FakeProvider returns hallucinated citation ID | Validation pipeline stage 4 rejects; validation_failed; no recommendation |
| **Duplicate approval request** | Same idempotency_key sent twice | 409 on second; single ACTION_EXECUTED audit event |

### 24.2 Measurable Metrics

| Metric | How Measured |
|:---|:---|
| Signal detection correctness | Synthetic data: known bottleneck state -> assert signal exists; known resolved state -> assert no signal |
| Evidence grounding validity | Assert all evidenceRefs[*].sourceRecordId exist in DB; assert AI citations are subset of input manifest |
| False-positive rate | Resolved encounters/orders -> assert no signal detected |
| Unauthorized recommendation rate | Role without intelligence:approve -> assert 403; assert no ACTION_EXECUTED audit event |
| AI failure handling | FakeProvider with faultMode:'timeout' -> assert aiExplanation=null, not 500 |
| Duplicate action prevention | Same idempotency_key twice -> assert 409, single ACTION_EXECUTED audit event |
| Analysis latency | ai_interactions.latency_ms + signal detection time; assert p95 < 10s |

No fabricated percentages. All metrics measured from live system state.

---

## 25. Non-Goals

The following are explicitly excluded from M19:

- Autonomous clinical diagnosis
- Autonomous treatment recommendation
- Prescribing
- Autonomous discharge
- Alteration of clinical records or diagnostic interpretation
- Unrestricted agents or multi-agent architecture
- Event streaming infrastructure (Kafka, Redis streams)
- Vector database / RAG pipeline for intelligence
- Arbitrary tool calling
- Direct AI database access
- Automatic clinical mutations without human approval
- Fabricated evidence or metrics
- Unrelated CRUD expansion
- Background job infrastructure (BullMQ -- deferred post-M19)
- Scheduled analysis (post-M19)
- Event-triggered analysis (post-M19)

---

## 26. M19 Implementation Sequence

```text
M19.0 Architecture Lock (this document)
         |
         v
M19.1 Intelligence Foundation
  - New permissions added to permissions.ts
  - New shared schemas: intelligence-signal.schemas.ts
  - aiCapabilitySchema extended with 'hospital_bottleneck'
  - gapCodeSchema extended with hospital-workflow gaps
  - Migration 0007: hospital_intelligence_signals + intelligence_approved_actions
  - ai_interaction_type enum: ADD VALUE 'hospital_bottleneck'
  - New prompt template: hospital-bottleneck.v1.ts
  - HospitalIntelligenceModule skeleton
  - /api/v1/hospital-intelligence routes mounted
  - /intelligence route added to shellRoutes.ts
         |
         v
M19.2 Hero Agent / Bottleneck Detection
  - Deterministic signal detection queries (Section 6.2)
  - Signal severity computation
  - Hospital-scope context engine
  - AI explanation via AIOrchestrator (hospital_bottleneck capability)
  - POST /analyze endpoint complete
  - GET /signals, GET /signals/:id endpoints complete
  - Signals persisted to hospital_intelligence_signals
         |
         v
M19.3 Governed Actions
  - Policy validation layer
  - Human approval flow: POST /recommendations/:id/approve
  - Rejection flow: POST /recommendations/:id/reject
  - Idempotency enforcement
  - Existing service execution wiring (notification service)
  - Full audit event coverage
         |
         v
M19.4 Intelligence Center UI
  - /intelligence page + IntelligenceCenter component
  - Signal list (Table primitive)
  - Signal detail panel
  - AI explanation with citations
  - Recommendation block + ConfirmDialog approval
  - Degraded state banner
  - EmptyState / ErrorState
         |
         v
M19.5 Evaluation + Safety
  - Synthetic test scenarios (Section 24.1)
  - Gate verification script: m19_gate_verify.ts
  - Signal detection correctness tests
  - Unauthorized access tests
  - AI failure handling tests
  - Duplicate action prevention tests
         |
         v
M19.6 Demo + Submission Hardening
  - End-to-end demo walkthrough
  - All gate tests passing
  - Docs updated
```

---

## 27. Open Questions / Blockers

| # | Question | Impact | Status |
|:---|:---|:---|:---|
| 1 | **Signal retention policy**: Should resolved/stale signals be retained for analytics or purged after N days? | Database size | Open -- default 90 days proposed |
| 2 | **Bottleneck thresholds**: Are the proposed thresholds (STAT order >4h, critical alert >30min, active encounter >2h without note) clinically appropriate? | Signal false-positive rate | Open -- requires clinical stakeholder review |
| 3 | **hospital_admin scope**: Should hospital_admin see all department signals or only their department? Architecture defines hospital scope for hospital_admin. | Permission model | Open -- proposed: hospital_admin sees all |
| 4 | **Task bottleneck signal**: TASK_APPROACHING_ESCALATION deferred because task module endpoints are PLANNED (M14). Confirm M19 excludes it. | Signal family completeness | Open -- recommendation: exclude from M19 |
| 5 | **AI model for hospital_bottleneck**: Should hospital_bottleneck use the same configured AI_MODEL (gemini-2.5-flash) or a different config? | Model cost/quality | Open -- recommendation: same model; no new env var |
| 6 | **Patient identity in signal**: When a physician views a signal, should patient name be shown (requires patient:read) or UUID only? | PHI boundary | Open -- recommendation: resolve client-side via existing /patients/:id endpoint gated by patient:read |
| 7 | **Signal notification**: Should signal detection trigger a notification to the physician? | Workflow integration | Open -- recommendation: Phase 2 feature; not M19 |

---

## Appendix A — File Change Summary

| File | Change | Type |
|:---|:---|:---|
| `docs/architecture/M19_INTELLIGENCE_ARCHITECTURE.md` | **THIS DOCUMENT** | NEW |

No production code changes in M19.0. Architecture Lock only.

---

## Appendix B — Repository Verification Checklist

| Check | Result |
|:---|:---|
| Repository inspected broadly (apps, packages, docs, .agents) | VERIFIED |
| Existing AI capabilities checked (M11/M12/M13) | VERIFIED -- AIOrchestrator, provider adapters, validation pipeline, prompt templates |
| Existing clinical services checked | VERIFIED -- diagnostics, clinical, encounter, notification, task services |
| Existing RBAC checked | VERIFIED -- permissions.ts, policy-engine.ts, rbac.middleware.ts |
| Existing audit infrastructure checked | VERIFIED -- AuditService, audit_events schema, hash chain |
| Existing frontend design system checked | VERIFIED -- 30 UI components; AppShell; shellRoutes |
| Existing API/error architecture checked | VERIFIED -- api-architecture.md; error-handler.middleware.ts |
| Database impact checked | VERIFIED -- 2 new tables required; 1 enum extension; 0 changes to existing tables |
| Security constraints checked | VERIFIED -- ADR-017/018/019/020; security-architecture.md |
| Architecture does NOT contradict existing implementation | VERIFIED -- all components reuse existing patterns |
| No unsupported assumptions remain | VERIFIED -- all decisions grounded in repository evidence |
| No unnecessary dependencies proposed | VERIFIED -- no new npm packages required for M19.1/M19.2 |
| No production implementation performed in M19.0 | VERIFIED -- architecture document only |
| /api/v1/intelligence/* confirmed (existing clinical-intelligence module) | VERIFIED -- different namespace from /api/v1/hospital-intelligence/* |
| AI_MODEL env var confirmed (gemini-2.5-flash) | VERIFIED -- .env.example line 25 |
| Providers confirmed (Gemini, OpenAI-compatible, Ollama, Fake) | VERIFIED -- ai.container.ts |
| ai-workspace route is currently a placeholder | VERIFIED -- EmptyState with honest description |
| No background job infrastructure in M19 | VERIFIED -- ADR-007 BullMQ deferred; not present in active code |
