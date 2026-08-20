# Hospital AI OS — AI Safety & Grounding Specification

> **Status:** LOCKED — Phase 2 Specification  
> **Authority:** AI Rules & Healthcare Safety Rules  
> **Scope:** Grounding, citation requirements, uncertainty management, hallucination prevention, and human overrides.

---

## 1. Grounding & Citation Requirements

1. **Source Grounding:** All AI generations that reference patient facts, lab values, vitals, or clinical notes must be grounded against explicit source data in the patient context window.
2. **Citation Enforcement:** Generated summaries and drafts must cite the exact source document ID and timestamp for every factual claim.
   - *Example:* "Patient reported chest pain on 2026-08-18 `[Encounter #enc_101]`, with Troponin I at 0.04 ng/mL `[Lab #lab_882]`."
3. **No Parametric Guessing:** The AI model is strictly prohibited from inferring unstated clinical history or guessing missing lab values.

---

## 2. Uncertainty & Hallucination Prevention

```text
Incoming Context Data
        ↓
Grounded Prompt Assembly with Explicit Source Delimiters
        ↓
Model Inference Execution with Schema Enforcement
        ↓
Deterministic Output Validator (Verify IDs, Numeric Ranges & Dates)
        ↓
Confidence Score Evaluation
   ├── High Confidence (>= 0.85) ──→ Present with Standard Citations
   └── Low Confidence (< 0.85)  ──→ Flag "Low Confidence — Verify Source"
```

### 2.1 Hallucination Prevention Constraints
- **Identifier Validation:** AI-generated IDs (patient IDs, order IDs, ICD-10 codes) are validated by deterministic code against the authoritative database. Any non-existent ID causes immediate rejection of the generated response.
- **Numeric Verification:** AI-generated dosage numbers or lab result values are checked against the source context text; discrepancies trigger validation errors.
- **Visual Distinction:** AI-generated text must be rendered in a distinct visual container (e.g., subtle purple border with clear "AI Generated Draft" badge) to prevent confusion with signed human clinical records.

---

## 3. Human Override & Escalation Paths

- **Clinician Override:** A clinician can reject, edit, or overwrite any AI suggestion with zero system resistance.
- **Rejection Logging:** Every rejected AI draft or recommendation records the rejection reason in the audit trail to support AI quality evaluation.
- **Escalation Trigger:** If an AI safety filter detects conflicting clinical data (e.g., drug order conflicting with documented allergy), the system immediately blocks action execution and raises a high-priority alert to the ordering doctor.
