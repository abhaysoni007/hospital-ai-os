# Hospital AI OS — Product Risk Register

> **Status:** NORMALIZED — Phase 2.1 Specification  
> **Scope:** Product, clinical safety, and operational risk mitigation matrix.

---

## 1. Product & Safety Risk Register

| Risk ID   | Risk Description                                                                                                        |      Category       | Severity | Mitigation Strategy                                                                                                                                                 |
| :-------- | :---------------------------------------------------------------------------------------------------------------------- | :-----------------: | :------: | :------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `RISK-01` | **AI Hallucination in Clinical Notes:** Model generates plausible but fabricated patient history or lab values.         |   Clinical Safety   | Critical | Enforce strict source grounding, evidence verification lifecycle (`GROUNDED → VALIDATED → HUMAN REVIEWED`), and side-by-side mandatory doctor review.               |
| `RISK-02` | **Unintended Auto-Execution:** AI recommendation executes clinical order without clinician approval.                    | Healthcare Boundary | Critical | Enforce architectural boundary where AI can NEVER trigger clinical database state changes autonomously. Mandatory clinician sign-off required.                      |
| `RISK-03` | **Break-Glass Policy Misuse:** Unauthorized staff activate emergency break-glass without valid emergency justification. |   Security & PHI    |   High   | Require mandatory clinical justification text, dispatch instant Security Admin alert, record immutable audit log, and conduct mandatory post-incident audit review. |
| `RISK-04` | **System Unusable During AI Outage:** Hospital operations stall when AI provider fails or drops connection.             |     Operational     |   High   | Maintain product requirement that core manual EMR workflows remain available during AI disconnections; fail safe with zero data loss.                               |
| `RISK-05` | **MVP Scope Inflation:** Scope expands beyond core vertical slice into complex HMS subsystems.                          |    Product Scope    |  Medium  | Strictly apply Ponytail scope discipline; restrict MVP to core vertical slice (`Registration → Encounter → EMR → Search → Note Draft → Lab → Discharge`).           |
