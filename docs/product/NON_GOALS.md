# Hospital AI OS — Non-Goals & Out-of-Scope Specification

> **Status:** NORMALIZED — Phase 2.1 Specification  
> **Authority:** Product Management & Healthcare Safety Rules  
> **Scope:** Explicit scope boundaries for MVP, Phase 2 deferred items, and permanent non-goals.

---

## 1. Scope Boundary Classifications

### 1.1 Phase 2 Deferred Scope (Not in MVP)
1. **Pharmacy Dispensing & MAR Administration:** Pharmacy dispensing queue management and nursing MAR MAR dose execution are deferred to Phase 2.
2. **Itemized Billing Settlement:** Billing service aggregator and payment settlement workflows are deferred to Phase 2.
3. **Insurance Pre-Authorization & Claims:** Insurance gateway submission and claim adjudication tracking are deferred to Phase 2.
4. **PACS Radiology Image Viewer Integration:** DICOM medical image rendering is deferred to Phase 2.
5. **OPD Queue Token Optimization:** Complex algorithmic queue re-balancing is deferred to Phase 2.

### 1.2 Permanent Non-Goals (Explicit Exclusions)
1. **No Autonomous Clinical Action Execution:** AI will NEVER autonomously prescribe medications, order diagnostic tests, sign clinical notes, or authorize patient discharges without explicit human clinician sign-off.
2. **No Direct Unassisted Patient Diagnosis Chatbot:** The platform will NOT provide a public-facing AI chatbot that diagnoses patient symptoms or prescribes treatment advice directly to patients.
3. **No Ambient Voice Hardware Room Scribing:** Custom hardware microphone arrays for room scribing are out of scope. AI note drafting relies on standard web input.
4. **No Multi-Facility Real-Time Bed Transfer:** Cross-hospital complex multi-facility patient transfers are permanently excluded from MVP scope.
