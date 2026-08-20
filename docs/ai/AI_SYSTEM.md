# Hospital AI OS — AI Capabilities & Action Boundaries Specification

> **Status:** LOCKED — Phase 2 Specification  
> **Authority:** AI Rules & Healthcare Safety Rules  
> **Scope:** AI capability taxonomy, action boundary model, authorization boundaries, and AI use case registry.

---

## 1. Taxonomy of AI Capabilities

AI in Hospital AI OS is strictly classified into 8 functional capabilities:

| Capability | Description | Example | Clinical Risk Level |
| :--- | :--- | :--- | :--- |
| `SEARCH` | Natural language semantic search across grounded patient records. | "Find all past cardiology consults for this patient." | Low |
| `SUMMARIZE` | Aggregating longitudinal clinical notes into concise summaries. | "Summarize the last 3 inpatient hospitalizations." | Medium |
| `DRAFT` | Generating preliminary text for human review and editing. | "Draft a progress note based on today's clinical vitals and lab results." | Medium |
| `RECOMMEND` | Proposing diagnostic, therapeutic, or operational options. | "Suggest potential drug-drug interaction warnings for review." | High |
| `DETECT` | Flagging anomalies, missed tasks, or workflow delays in real time. | "Detect unreviewed critical lab values pending over 2 hours." | High |
| `PREDICT` | Estimating operational metrics or clinical risk scores. | "Predict discharge readmission risk category based on chart." | High |
| `ASSIST` | Pre-filling forms, extracting structured fields from documents. | "Extract patient name and ID from uploaded scan." | Low |
| `AUTOMATE` | Routing non-clinical tasks automatically according to rules. | "Route completed discharge summary to billing queue." | Low |

---

## 2. AI Action Boundary Progression Model

Every AI-assisted operation follows a strict, unidirectional progression:

```text
1. INFORMATION (Authoritative Patient / Operational Data)
       ↓
2. AI SUGGESTION (Raw model inference based on grounded context)
       ↓
3. DRAFT (Structured representation presented side-by-side to user)
       ↓
4. RECOMMENDATION (Calculated advice surfaced with source citations)
       ↓
5. PROPOSED ACTION (Staged system state change awaiting authorization)
       ↓
6. HUMAN APPROVAL (Explicit sign-off by authenticated clinician/user)
       ↓
7. EXECUTED ACTION (State committed to system database / external system)
       ↓
8. VERIFIED RESULT (Audited confirmation of execution outcome)
```

### 2.1 Explicit Boundary Classifications

1. **Safe-ish (Read & Search):**
   - *Behavior:* AI retrieves, formats, or searches authorized patient data for the active user.
   - *Authorization:* Automatic for authenticated users with role scope access.
   - *Example:* Searching past lab records or summarizing an approved discharge summary.

2. **Human Review Required (Drafting):**
   - *Behavior:* AI pre-fills a clinical note, handover summary, or administrative form.
   - *Authorization:* Requires user review, editing, and explicit "Accept Draft" click.
   - *Example:* Side-by-side doctor clinical progress note drafting.

3. **Mandatory Approval Required (Recommendations & Orders):**
   - *Behavior:* AI recommends medication adjustments, differential diagnoses, or diagnostic orders.
   - *Authorization:* Requires explicit, attributable clinician sign-off.
   - *Example:* Drug interaction warning resolution or diagnostic test order recommendation.

4. **Strictly Controlled (System State Execution):**
   - *Behavior:* AI triggers an actual database state change or external integration workflow.
   - *Authorization:* **AI CAN NEVER EXECUTE CLINICAL STATE CHANGES AUTONOMOUSLY.** Only non-clinical task routing (e.g., notifying billing clerk of completed discharge) can be automated.

---

## 3. Comprehensive AI Use Case Registry

| Use Case Name | Domain | Capability | Risk Level | Human Approval | MVP Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Clinical Chart Summarization** | Clinical | `SUMMARIZE` | Medium | Human Review | **MVP** |
| **OPD Clinical Note Drafting** | Clinical | `DRAFT` | Medium | Human Review | **MVP** |
| **Discharge Summary Drafting** | Clinical | `DRAFT` | High | Mandatory Clinician Approval | **MVP** |
| **Drug-Allergy Interaction Check** | Clinical | `RECOMMEND` | Critical | Mandatory Clinician Approval | **MVP** |
| **Lab Result Summary Drafting** | Diagnostics | `SUMMARIZE` | Medium | Human Review | **MVP** |
| **Shift Handover Drafting** | Nursing | `DRAFT` | High | Mandatory Nurse Review | **MVP** |
| **Unreviewed Critical Lab Alerting**| Operations | `DETECT` | High | None (Alert Dispatch) | **MVP** |
| **ID Card OCR Data Extraction** | Operations | `ASSIST` | Low | Human Review | **MVP** |
| **Unbilled Charge Capture Audit** | Billing | `DETECT` | Low | Billing Review | **MVP** |
| **Radiology Preliminary Impression**| Radiology | `DRAFT` | High | Mandatory Radiologist Approval| Phase 2 |
| **Readmission Risk Prediction** | Clinical | `PREDICT` | High | Clinician Review | Phase 2 |
| **ICU Deterioration Scoring** | ICU | `PREDICT` | Critical | Mandatory Clinician Review | Phase 2 |
| **Insurance Claim Extraction** | Insurance | `ASSIST` | Medium | Specialist Review | Phase 2 |
