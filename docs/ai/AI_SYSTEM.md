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
   - _Purpose:_ Document OCR extraction from ID cards, administrative form pre-filling.
   - _Human Involvement:_ User review of extracted fields.

2. **CLINICAL DOCUMENTATION AI (Risk: Medium)**
   - _Purpose:_ Drafting side-by-side SOAP notes, handover summaries, and discharge summaries for eligible encounters.
   - _Human Involvement:_ Mandatory clinician review, editing, and attributable sign-off.

3. **CLINICAL RETRIEVAL AI (Risk: Medium)**
   - _Purpose:_ Natural language semantic search and chart history summarization.
   - _Human Involvement:_ Grounded source context display; user review of retrieved facts.

4. **CLINICAL DECISION SUPPORT AI (Risk: High / Critical)**
   - _Purpose:_ Surfacing abnormal lab trends for clinician awareness, assisting triage, and supporting clinical decision-making with contextual information.
   - _Excluded from AI scope:_ Critical/panic laboratory-value **classification** is deterministic and policy-driven. AI does not determine whether a result is a critical/panic value. Configured clinical rules are the authoritative classifier.
   - _Human Involvement:_ Explicit clinician review; decision support only (never autonomous action).

5. **CLINICAL PREDICTION AI (Risk: High — Deferred Scope)**
   - _Purpose:_ Readmission risk category estimation, ICU deterioration scoring.
   - _Scope:_ Phase 2 (Requires extensive clinical evaluation dataset validation).

6. **CLINICAL ACTION AUTOMATION (Risk: Prohibited)**
   - _Purpose:_ Autonomous clinical order placement, prescribing, or patient discharge authorization.
   - _Scope:_ **STRICTLY PROHIBITED.** No automated system may execute clinical state changes without human authority.

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

---

## 3. Deterministic Critical Lab Value Safety Boundary

> [!IMPORTANT]
> **Hard Safety Rule:** AI is explicitly non-authoritative for critical/panic laboratory-value classification. This is a PROHIBITED AI function.

Configured deterministic clinical policy rules are the sole authoritative mechanism for deciding whether a laboratory result is a critical/panic value. AI capabilities in this domain are strictly limited to:

- Contextual summarization of a result for the reviewing clinician.
- Surfacing historical lab trends for clinical awareness.
- Workflow communication support (e.g. formatting notification content).
- Prioritization assistance based on existing classifications.

AI must not infer, calculate, or assert whether a result crosses a critical/panic threshold. That decision is made entirely by configured clinical rules applied deterministically.

_(Note: Specific clinical threshold values, reference range databases, and rule-engine technology remain DEFERRED to clinical governance and Phase 3 Architecture.)_
