# Phase 2.1 Requirements Normalization & Decision Log

> **Status:** LOCKED — Phase 2.1 Decision Log  
> **Authority:** Product Management & Healthcare Safety Rules  
> **Purpose:** Documenting normalization decisions, scope tightening, AI safety model updates, and deferred architectural choices.

---

## Decision Log

| Decision ID | Area / Subject | Previous Phase 2 State | Normalized Phase 2.1 State | Rationale |
| :--- | :--- | :--- | :--- | :--- |
| `DEC-2.1-01` | **MVP Scope & Thesis** | Broad MVP spanning 8 modules (including OPD Queue, MAR, Pharmacy, Billing, Inpatient). | **Vertical-Slice MVP Scope:** `Patient Registration → Appointment/Encounter → Doctor Clinical Workspace → AI Chart Search → AI Note Draft → Lab Order/Verify → Discharge Summary`. | Ponytail discipline: focus MVP on the smallest coherent end-to-end workflow proving AI-native value with human review and auditability. |
| `DEC-2.1-02` | **Discharge Summary Scope** | "Inpatient Discharge Summary Drafting & Authorization" (implied inpatient sub-system dependency). | **"Discharge Summary Drafting & Authorization for an eligible encounter"**. | Prevents building a complex inpatient ward subsystem solely to satisfy the discharge workflow requirement. |
| `DEC-2.1-03` | **Break-Glass Expiration** | Anchored default expiration at "exactly 4 hours". | **`OPEN — requires security/clinical policy decision`**. | Avoids hardcoding arbitrary policy values before hospital security/clinical governance review. |
| `DEC-2.1-04` | **AI Safety Confidence Model** | `confidence >= 0.85 = safe` treated as sole safety gate. | **Evidence & Verification Lifecycle Model:** `UNVERIFIED → GROUNDED → VALIDATED → HUMAN REVIEWED → APPROVED → COMMITTED → VERIFIED`. | Numeric model confidence score alone does not guarantee clinical correctness or safety; safety requires multi-signal verification. |
| `DEC-2.1-05` | **AI Provenance & Citations** | Rigid requirement for inline claim-level badges. | **Product Requirement:** "Material factual claims made by AI about healthcare data must be traceable to authoritative source evidence." | Allows presentation flexibility (claim-level, evidence-group, source panel) appropriate to workflow UX. |
| `DEC-2.1-06` | **AI Risk Classification** | Basic Low/Med/High classification. | **Structured Risk Tiers:** `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`, `PROHIBITED` across 6 AI capability categories. | Provides unambiguous risk boundaries for clinical vs administrative AI features. |
| `DEC-2.1-07` | **Implementation Leakage in NFRs** | Asserted exact latency numbers (`p95 < 300ms`) and encryption specifics (`TLS 1.3`, `AES-256`) as locked product specs. | Retained core product/security requirements ("PHI protected in transit & at rest", "Audit logs tamper-evident"); deferred specific algorithms/latencies as **`TARGET — VALIDATE IN PHASE 3 ARCHITECTURE`**. | Separates genuine product/security requirements from technical implementation choices. |
| `DEC-2.1-08` | **Regulatory Framework** | hardcoded HIPAA/DISHA blanket compliance assertions. | **Structured Framework:** Jurisdiction: `OPEN / UNCONSTRAINED`, Framework: `TO BE CONFIRMED PER DEPLOYMENT`, Security Baseline: `DEFINED IN PRODUCT REQUIREMENTS`. | Avoids claiming compliance certification before target deployment jurisdiction is selected. |
| `DEC-2.1-09` | **Degraded Mode Mechanics** | Hardcoded exact timeouts (5s), retry counts (3), and health-check frequencies (5 checks). | Retained product principle ("Core workflows remain usable when AI fails"); deferred technical mechanics to Phase 3 Architecture Inputs. | Prevents locking technical infrastructure mechanics in product documentation. |
| `DEC-2.1-10` | **Acceptance Criteria Normalization**| Combined business, safety, and technical checks with hardcoded thresholds (e.g. 85% confidence match). | Categorized into **Business**, **Safety**, and **Technical Acceptance Criteria** without rigid implementation thresholds. | Ensures testable acceptance criteria focus on user outcome and safety rather than implementation mechanism. |
