# CLINICAL INTELLIGENCE FORENSIC PLAN

## 1. Current Architecture
The current architecture (verified through Phase 3) consists of a secure, highly-performant, Postgres-backed Node.js backend and a Next.js frontend. It features strict M5 RBAC, Phase 2 Break-Glass emergency access, atomic Task concurrency, and a foundational AI orchestrator used for draft note generation (Phase 1A) and critical value evaluation (M10). 

## 2. Existing Reusable Infrastructure
- **AI Infrastructure**: `AiService`, `ai.evaluator.ts`, `openai-compatible.adapter.ts` with `generateEmbedding` and structured schema outputs.
- **Security & RBAC**: `BreakGlassService`, `ResourceAuth` middleware, and M5 permission scopes (patient, department, system).
- **Data Primitives**: `encounters`, `clinical_records`, `diagnostic_orders`, `diagnostic_results`, `tasks`, `appointments`.
- **Audit**: `AuditService` with append-only hash chains.

## 3. Candidate Capabilities
1. **Chart Search**: Find patient records, notes, and results.
2. **Chart Brief**: Grounded AI synthesis of an encounter/patient state.
3. **Clinical Timeline**: Chronological aggregation of all patient events.
4. **Diagnostic Context**: Trend analysis of historical lab values.

## 4. Recommended First Vertical Slice
**Chart Brief & Clinical Timeline**. 
*Rationale*: The timeline establishes the canonical chronological data projection. The Chart Brief consumes this exact projection to generate safe, grounded summaries without hallucination, yielding immediate clinical value.

## 5. Chart Search Architecture
- **Infrastructure**: Utilize PostgreSQL full-text search (`tsvector`) or `pg_trgm` combined with exact-match filtering. Do not implement complex vector embeddings in the first iteration to minimize latency and architectural complexity.
- **Access**: Strictly scoped to authorized patients.
- **Output**: Returns references to `encounters`, `clinical_records`, `diagnostic_orders`.

## 6. Chart Brief Architecture
- **Infrastructure**: Reuse `AiService`.
- **Context Projection**: Feed the AI a deterministic string serialization of the Clinical Timeline.
- **Constraints**: System prompt must strictly mandate distinguishing between FACT, INFERENCE, and MISSING INFORMATION. Output must enforce a Zod schema containing `summary`, `citations` (array of record UUIDs), and `identified_gaps`.
- **Safety**: Purely read-only. Responses are NOT saved back to clinical records automatically; they remain ephemeral or are explicitly approved by the clinician.

## 7. Clinical Timeline Architecture
- **Infrastructure**: A single Service method (`getClinicalTimeline`) that performs a `UNION ALL` (or parallel queries merged in-memory) across `encounters`, `clinical_records`, `diagnostic_orders`, and `tasks`.
- **Event Types**: `ENCOUNTER_START`, `NOTE_SIGNED`, `ORDER_PLACED`, `RESULT_ENTERED`.
- **No Schema Changes**: Do not create a duplicate timeline table. Compute it dynamically on-demand, leveraging Phase 3 indexes.

## 8. Diagnostic Intelligence
- **Scope**: When viewing a lab result (e.g., Hemoglobin), fetch the last 5 results for the same test code for the same patient and present a trend sparkline.
- **AI Rule**: Do NOT generate autonomous diagnoses from the trend. The UI simply renders historical data points alongside the current result.

## 9. AI Safety
- **Readiness Gate**: The `AiService` fail-closed configuration remains active. If the upstream OpenRouter provider times out (Phase 1A settings), the UI degrades gracefully, allowing manual chart review.
- **Grounded Provenance**: The AI output schema will require explicit UUID citations linking to the projected context blocks.

## 10. RBAC
- **Normal Access**: Standard M5 `clinical:read` scopes apply.
- **Unauthorized**: `403 Forbidden`.
- **AI Scope**: The AI context projection phase runs AS the authenticated user. If a record is not visible to the user, it is NOT injected into the AI context prompt.

## 11. Break-Glass
- **Integration**: `authorizeBreakGlassResourceAccess` is applied to all Intelligence read endpoints. If a session is active, the AI context can project the break-glass patient's records.
- **Context Leakage**: Strict validation ensures that an active break-glass session for Patient A does NOT allow projecting Patient B's records into the AI context.

## 12. Audit
- **New Event**: `AI_CHART_BRIEF_GENERATED`.
- **Metadata**: Stores the `patientId`, `encounterId`, and `provider_model`, but explicitly omits the prompt and response PHI text from the immutable audit ledger.

## 13. Concurrency & Consistency
- **Snapshot Consistency**: The Clinical Timeline query uses standard `READ COMMITTED` isolation. The UI must explicitly stamp the Chart Brief with the timestamp of the latest record it consumed, clearly stating: *"Generated from data as of [Timestamp]"*.

## 14. Frontend
- **Placement**: Integrate Chart Brief and Clinical Timeline into the existing `PatientProfilePage` and `EncounterDetailPage`.
- **Design System**: Use the established M13 styles. The Chart Brief gets a distinct visual container (e.g., subtle purple gradient or AI icon) to clearly demarcate generated content from canonical clinical data.

## 15. Demo Data
- M13.2 synthetic data is sufficient for testing. We have `Margaret Chen` with a critical CBC result and multiple encounters to test chart synthesis.

## 16. Testing
- **Unit**: Verify Timeline aggregation sorts correctly.
- **Integration**: Verify AI Chart Brief fails gracefully on provider timeouts.
- **Security**: Verify AI endpoints reject unauthorized cross-patient requests.
- **Browser E2E**: Playwright will be installed and strictly used to verify the Chart Brief renders correctly in the Encounter view and that the Break-Glass overlay intercepts unauthorized AI generation attempts.

## 17. Browser E2E
- Introduce `@playwright/test` to the `apps/frontend` package.
- Write E2E flows simulating a physician logging in, viewing an encounter, and generating a Chart Brief.

## 18. Performance
- **AI Context limits**: Cap timeline serialization at the 50 most recent clinical events to prevent unbounded token costs and latency.
- **Concurrency**: Fetch timeline entities in parallel (`Promise.all`) utilizing Phase 3 indexes before serialization.

## 19. Security Review
- **Expose PHI?**: Yes, Chart Brief contains PHI. Must be strictly authorized.
- **Bypass RBAC?**: No. Data projection relies on the same service layer as standard UI reads.
- **Break-glass abused?**: No, logged and audited automatically.
- **AI see unauthorized records?**: No, AI context builder is scoped to the authorized user's visibility.
- **Cached responses leak?**: The backend will not cache AI responses globally. They are requested on-demand per authenticated user.

## 20. Migration / ADR
- **No Schema Changes Required**.
- All intelligence layers are read-only aggregations and ephemeral AI summaries.
- No ADR needed for infrastructure since `AiService` already exists from Phase 1A.

## 21. Deferred Scope
- Autonomous diagnosis/treatment decisions.
- Predictive clinical decisions.
- Production ML training pipelines.
- Saving AI summaries as official signed clinical records without manual copy-paste/approval.

## 22. File-by-File Implementation Plan
1. `apps/backend/src/modules/clinical-intelligence/intelligence.routes.ts`: New module routes.
2. `apps/backend/src/modules/clinical-intelligence/intelligence.service.ts`: Implements `getClinicalTimeline` and `generateChartBrief`.
3. `apps/backend/src/modules/clinical-intelligence/intelligence.controller.ts`: API handlers.
4. `apps/backend/src/modules/audit/audit.service.ts`: Add `AI_CHART_BRIEF_GENERATED` event type.
5. `apps/frontend/src/app/encounters/[id]/page.tsx`: Add Chart Brief UI component.
6. `apps/frontend/src/components/intelligence/ChartBrief.tsx`: New UI component.
7. `apps/frontend/src/services/intelligence-service.ts`: Frontend API client.
8. `apps/frontend/playwright.config.ts`: Setup Playwright.
9. `apps/frontend/e2e/chart-brief.spec.ts`: E2E test.

## 23. Acceptance Criteria
- Clinical Timeline accurately merges 4 domain entities chronologically.
- Chart Brief generates successfully within 10 seconds.
- Chart Brief identifies Missing Information if encounters lack notes.
- Playwright E2E suite executes successfully.
- AI fails to generate if the clinician lacks M5 `clinical:read` for the target patient.

## 24. Risks
- OpenRouter upstream latency. Addressed by UI loading skeletons and graceful timeouts.
- LLM Hallucination. Addressed by strict structured prompting and enforcing UUID citations.

==================================================
FINAL VERDICT
==================================================
READY FOR IMPLEMENTATION
