# Hospital AI OS — Product Risk Register

> **Status:** LOCKED — Phase 2 Specification  
> **Scope:** Product, clinical safety, and operational risk mitigation matrix.

---

## 1. Product & Safety Risk Register

| Risk ID | Risk Description | Category | Severity | Mitigation Strategy |
| :--- | :--- | :---: | :---: | :--- |
| `RISK-01` | **AI Hallucination in Clinical Notes:** Model generates plausible but fabricated patient history or lab values. | Clinical Safety | Critical | Enforce strict source grounding, citation links, numeric source verification, and side-by-side mandatory doctor review. |
| `RISK-02` | **Unintended Auto-Execution:** AI recommendation executes clinical order without clinician approval. | Healthcare Boundary| Critical | Enforce architectural boundary where AI can NEVER trigger clinical database state changes autonomously. Mandatory clinician approval required. |
| `RISK-03` | **Break-Glass Abuse:** Unauthorized staff abuse emergency break-glass to browse sensitive PHI. | Security & PHI | High | Require mandatory justification prompt, dispatch real-time alert to Security Admin, enforce 4-hr expiration, and conduct mandatory 24-hr audit review. |
| `RISK-04` | **System Unusable During AI Outage:** Hospital operations stall when AI provider fails or drops connection. | Operational | High | Implement automatic fallback to `DEGRADED_MANUAL_MODE` enabling standard manual text note entry and manual ordering with zero downtime. |
| `RISK-05` | **Unbilled Service Leakage:** Clinical services rendered are omitted from final patient bill. | Financial | Medium | AI engine cross-references executed clinical orders against bill items to surface unbilled services to billing clerk prior to settlement. |
