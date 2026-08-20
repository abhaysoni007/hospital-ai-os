# Hospital AI OS — AI Safety & Evidence Verification Specification

> **Status:** NORMALIZED — Phase 2.1 Specification  
> **Authority:** AI Rules & Healthcare Safety Rules  
> **Scope:** Evidence verification lifecycle, grounding, provenance requirements, and clinician override rules.

---

## 1. Evidence & Verification Lifecycle Model

> [!IMPORTANT]
> **Safety Principle:** A probabilistic model's internal numeric confidence score alone does NOT establish clinical safety or correctness. AI output must pass through an explicit evidence verification lifecycle before influencing business or clinical workflows.

```text
UNVERIFIED (Raw model output generated from prompt)
     ↓
GROUNDED (Factual claims verified against explicit patient context data)
     ↓
VALIDATED (Structural & business rule validation passed by deterministic code)
     ↓
HUMAN REVIEWED (Side-by-side review by authenticated clinician / staff)
     ↓
APPROVED (Explicit, attributable human sign-off committed)
     ↓
COMMITTED (State written to system database)
     ↓
VERIFIED (Immutable audit event recorded)
```

### 1.1 Multi-Signal Safety Verification
The system evaluates AI outputs using multiple independent signals:
1. **Source Availability & Completeness:** Ensuring required patient context was available and non-empty during prompt assembly.
2. **Grounding Traceability:** Verifying that factual claims reference authoritative source records.
3. **Deterministic Validation:** Validating schema formats, patient IDs, and numerical bounds using deterministic business logic (AI suggests; deterministic code validates).
4. **Human Review & Approval:** Mandatory clinician/staff sign-off for all clinical note drafts, orders, and discharge summaries.

---

## 2. AI Provenance & Citation Requirement

- **Product Requirement:** Material factual claims made by AI about healthcare data must be traceable to authoritative source evidence.
- **Workflow Presentation Flexibility:** Depending on the workflow UX, provenance may be presented via:
  - Claim-level provenance links
  - Evidence-group source citations
  - Source context review panels
  - Linked patient record references

*(Note: Specific UI badge rendering, CSS styling, and vector database retrieval mechanics are DEFERRED TO PHASE 3 ARCHITECTURE).*

---

## 3. Human Override & Escalation Rules

- **Clinician Override:** A clinician can edit, reject, or overwrite any AI suggestion at any point with zero system friction.
- **Rejection Audit:** Rejections are recorded in audit logs to support AI evaluation and quality tracking.
- **Safety Escalation:** If AI safety validation detects conflicting clinical facts (e.g. drug order conflicting with documented allergy), the system flags the conflict prominently and requires explicit clinician acknowledgment before proceeding.

---

## 4. Deterministic vs AI Safety Boundary

> [!IMPORTANT]
> **Safety Rule:** Deterministic configured clinical rules are authoritative for critical/panic laboratory-value classification. AI must not serve as the classification mechanism.

This boundary applies system-wide and cannot be overridden by workflow convenience, latency optimization, or AI provider capability claims.

| Function | Authoritative Mechanism | AI Role |
| :--- | :--- | :--- |
| **Critical/panic value classification** | Deterministic configured clinical policy rule | Non-authoritative. May assist with contextual summarization only. |
| **Abnormal trend surfacing** | AI (grounded, human-reviewed) | Permitted with clinician review. |
| **Drug interaction warning** | Authoritative pharmacological database | AI may surface; human confirms. |
| **Clinical note drafting** | AI (side-by-side human review) | Permitted with mandatory clinician sign-off. |
| **Consequential clinical state change** | Human clinician (mandatory) | PROHIBITED from autonomous execution. |

See also: `docs/ai/AI_SYSTEM.md §3` (Deterministic Critical Lab Value Safety Boundary) and `docs/product/PRODUCT_SPEC.md §7` (Critical Lab Value Safety Boundary).
