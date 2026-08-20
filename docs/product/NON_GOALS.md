# Hospital AI OS — Non-Goals & Out-of-Scope Specification

> **Status:** LOCKED — Phase 2 Specification  
> **Authority:** Product Management & Healthcare Safety Rules  
> **Scope:** Explicit boundaries on what Hospital AI OS MVP WILL NOT DO.

---

## 1. Explicit Non-Goals for MVP Scope

To maintain product focus and ensure safety, the following capabilities are explicitly **OUT OF SCOPE** for MVP:

1. **No Autonomous Clinical Action Execution:** AI will NEVER autonomously prescribe medications, order diagnostic tests, sign clinical notes, or authorize patient discharges without explicit human clinician sign-off.
2. **No Direct Unassisted Patient Diagnosis Chatbot:** The platform will NOT provide a public-facing AI chatbot that diagnoses patient symptoms or prescribes treatment advice directly to patients.
3. **No Direct Hardware PACS DICOM Viewer Integration:** Complex DICOM medical image manipulation and rendering will remain deferred to Phase 2. MVP will link radiology report text only.
4. **No Direct TPA / Insurance Claim Adjudication Gateway:** External real-time insurance gateway integration is deferred to Phase 2. MVP provides itemized hospital billing statements only.
5. **No Multi-Facility Real-Time Bed Transfer:** Cross-hospital complex multi-facility patient transfers are deferred to Phase 2.
6. **No Ambient Voice Hardware Room Integration:** Custom hardware microphone arrays for ambient room scribing are out of scope. AI note drafting relies on standard web browser input.
