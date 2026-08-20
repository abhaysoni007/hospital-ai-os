# Hospital AI OS — Vertical-Slice Patient Journeys & User Flow Maps

> **Status:** NORMALIZED — Phase 2.1 Specification  
> **Authority:** Product Management & Healthcare Safety Rules  
> **Scope:** Vertical-slice patient journey mapping and textual user flows with explicit Human/AI boundaries.

---

## 1. Master Vertical-Slice Patient Journey

```text
1. PATIENT REGISTRATION (Demographics, ID Verification, EMPI Creation)
       ↓
2. APPOINTMENT / ENCOUNTER CHECK-IN (Slot Confirmation, Arrival Verification)
       ↓
3. CLINICAL CONSULTATION (History, Examination, AI Note Drafting)
       ↓
4. GROUNDED AI CHART SEARCH (Semantic History Search, Chart Summarization)
       ↓
5. DIAGNOSTICS & LAB WORKFLOW (Specimen Collection, Testing, Verification)
       ↓
6. DISCHARGE SUMMARY WORKFLOW (Discharge Summary Drafting & Authorization for Eligible Encounter)
```

---

## 2. Textual User Flow Maps with Human/AI Boundaries

### 2.1 Flow 1: Clinical Consultation & AI Note Drafting
```text
[Human: Doctor] Opens Active Patient Encounter
        ↓
[System] Fetches & Displays Grounded Patient Context & Vitals
        ↓
[Human: Doctor] Conducts Examination & Enters Clinical Findings
        ↓
[AI Engine] Generates Side-by-Side Draft SOAP Note + Formats Citations
        ↓
[Human: Doctor] REVIEWS DRAFT → Edits/Accepts Sections → Signs Note
        ↓
[System] Persists Signed Clinical Record
        ↓
[System] Records Immutable Audit Event
```

### 2.2 Flow 2: Grounded AI Chart Search
```text
[Human: Authorized User] Enters Natural Language Search Query
        ↓
[System] Enforces User Role Access Scope
        ↓
[AI Engine] Executes Grounded Search Across Patient Records
        ↓
[AI Engine] Synthesizes Response Card with Traceable Source References
        ↓
[Human: User] Reviews Summary & Click-Through Source Evidence
        ↓
[System] Records Immutable Audit Event
```

### 2.3 Flow 3: Discharge Summary Drafting & Authorization
```text
[Human: Doctor] Triggers "Initiate Discharge" for Eligible Encounter
        ↓
[AI Engine] Aggregates Encounter Notes, Vitals, and Lab Results
        ↓
[AI Engine] Generates Structured Draft Discharge Summary
        ↓
[Human: Doctor] REVIEWS DRAFT → Verifies Summary against Source Records
        ↓
[Human: Doctor] Signs Discharge Summary Document
        ↓
[System] Updates Encounter State & Records Audit Event
```
