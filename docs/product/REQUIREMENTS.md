# Hospital AI OS — Non-Functional Requirements (NFR) Specification

> **Status:** LOCKED — Phase 2 Specification  
> **Authority:** Engineering & Product Management Rules  
> **Scope:** Security, reliability, performance budgets, accessibility standards, observability, and AI operational constraints.

---

## 1. Security & Privacy NFRs

1. **Authentication:** Every API request must be authenticated with secure, bounded-lifetime session credentials. Multi-factor authentication (MFA) required for privileged roles (`ROLE_SEC_ADMIN`, `ROLE_HOSP_ADMIN`).
2. **Authorization Enforcement:** Authorization checks enforced at the API layer independently of UI state. Minimum necessary access scope strictly applied per role.
3. **Data Protection:** All PHI/PII encrypted in transit (TLS 1.3) and at rest (AES-256). Zero PHI exposure in logs, URLs, error outputs, or unencrypted browser storage.
4. **Audit Immutability:** Audit records write-once, tamper-evident, and queryable for compliance. Failure of audit infrastructure causes graceful degradation into a safe state.

---

## 2. Reliability & Availability NFRs

1. **System Uptime Target:** 99.9% uptime for core clinical EMR workflows (registration, vitals, MAR, ordering, billing).
2. **Degraded Mode Continuity:** System must support continuous manual operation during complete AI service outages or external API disconnections.
3. **Data Consistency:** Zero patient record corruption or partial state write upon system network disruption. Transactional rollback required for multi-step clinical operations.

---

## 3. Performance Budgets (Justified Operational Latency)

| Path / Operation | Latency Budget (p95) | Rationale |
| :--- | :--- | :--- |
| **Standard UI API Read/Write** | < 300 ms | Prevents clinician workflow hesitation during patient consultations. |
| **Patient Search / EMPI Lookup** | < 200 ms | Keeps reception queue moving quickly during peak check-in hours. |
| **Grounded AI Search Query** | < 1,500 ms | Allows real-time patient chart history retrieval. |
| **AI Clinical Note Drafting** | < 3,000 ms | Matches natural pause between doctor-patient interview sections. |
| **Panic Lab Result Alert Dispatch**| < 2,000 ms | Ensures immediate delivery of critical clinical values to ordering physician. |

---

## 4. Accessibility Standards

- **Compliance Target:** Target **WCAG 2.1 Level AA** compliance across all web workspaces.
- **Contrast & Typography:** High contrast ratios (minimum 4.5:1 for normal text), modern legible sans-serif typography (e.g., Inter, Roboto), zero reliance on color alone to convey clinical status (always combine color with text/icons).
- **Keyboard Navigation:** Full keyboard accessibility for high-speed clinical data entry (tab index navigation, quick-action keyboard shortcuts for clinicians).

---

## 5. Observability & AI Operational Metrics

- **Structured Logging:** All system components produce structured JSON logs with correlation IDs, timestamps, user roles, and execution latency. Zero raw PHI in log output.
- **AI Latency & Cost Tracking:** Track per-request token usage, latency, prompt version, model provider status, and cost per invocation.
- **AI Evaluation Metrics:** Monitor hallucination rate (< 0.1% target), fallback activation frequency, user draft acceptance rate (> 80% target), and rejection reasons.
