# Hospital AI OS — AI Capabilities, Risk Tiers & Action Boundaries

> **Status:** NORMALIZED — Phase 2.1 Specification  
> **Authority:** AI Rules & Healthcare Safety Rules  
> **Scope:** AI capability taxonomy, risk classification tiers, conceptual action boundaries, and clinical boundaries.

---

## 1. AI Capability Taxonomy & Risk Classification

AI capabilities in Hospital AI OS are classified across 6 categories and 5 risk tiers:

```text
+---------------------------------------------------------------------------------------------------+
|                                      AI RISK CLASSIFICATION TIERS                                 |
+--------------+-------------------------------------------------------------+----------------------+
| Risk Tier    | Definition & Characteristics                                | Allowed MVP Scope    |
+--------------+-------------------------------------------------------------+----------------------+
| LOW          | Administrative extraction, document OCR, non-clinical tasks.| MVP CORE             |
| MEDIUM       | Clinical documentation & chart retrieval with human review. | MVP CORE             |
| HIGH         | Clinical decision support, trend detection, risk scoring.   | MVP CORE (Grounded)  |
| CRITICAL     | High-impact clinical warnings (e.g. drug-allergy conflict). | MVP CORE (Grounded)  |
| PROHIBITED   | Autonomous clinical order execution, prescribing, or diagnosis.| **STRICTLY PROHIBITED**|
+--------------+-------------------------------------------------------------+----------------------+
```

### 1.1 Capability Categories Catalog

1. **ADMINISTRATIVE AI (Risk: Low)**
   - *Purpose:* Document OCR extraction from ID cards, administrative form pre-filling.
   - *Human Involvement:* User review of extracted fields.

2. **CLINICAL DOCUMENTATION AI (Risk: Medium)**
   - *Purpose:* Drafting side-by-side SOAP notes, handover summaries, and discharge summaries for eligible encounters.
   - *Human Involvement:* Mandatory clinician review, editing, and attributable sign-off.

3. **CLINICAL RETRIEVAL AI (Risk: Medium)**
   - *Purpose:* Natural language semantic search and chart history summarization.
   - *Human Involvement:* Grounded source context display; user review of retrieved facts.

4. **CLINICAL DECISION SUPPORT AI (Risk: High / Critical)**
   - *Purpose:* Flagging abnormal lab trends, surfacing drug interaction warnings, assisting triage.
   - *Human Involvement:* Explicit clinician review; decision support only (never autonomous action).

5. **CLINICAL PREDICTION AI (Risk: High — Deferred Scope)**
   - *Purpose:* Readmission risk category estimation, ICU deterioration scoring.
   - *Scope:* Phase 2 (Requires extensive clinical evaluation dataset validation).

6. **CLINICAL ACTION AUTOMATION (Risk: Prohibited)**
   - *Purpose:* Autonomous clinical order placement, prescribing, or patient discharge authorization.
   - *Scope:* **STRICTLY PROHIBITED.** No automated system may execute clinical state changes without human authority.

---

## 2. Conceptual AI Action Boundary Model

Every AI-assisted workflow follows a conceptual safety progression:

```text
1. INFORMATION (Authoritative Patient / Operational Data)
       ↓
2. AI SUGGESTION (Model output based on grounded context)
       ↓
3. DRAFT (Structured representation presented for review)
       ↓
4. RECOMMENDATION (Calculated advice with source traceability)
       ↓
5. PROPOSED ACTION (Staged system state change awaiting authorization)
       ↓
6. HUMAN APPROVAL (Explicit sign-off by authenticated clinician)
       ↓
7. EXECUTED ACTION (State committed to database)
       ↓
8. VERIFIED RESULT (Audited confirmation of execution)
```

### 2.1 Clinical AI Boundaries Summary
- **Documentation & Summarization:** Allowed with side-by-side human review.
- **Chart Retrieval:** Allowed for authorized users with grounded source evidence.
- **Decision Support:** Allowed strictly as decision support with clinician review.
- **Consequential Clinical State Changes:** Never executed autonomously.
