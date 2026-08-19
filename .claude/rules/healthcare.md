# Healthcare Rules

> **Authority Level:** DOMAIN — Second only to Core Rules on safety matters. Healthcare rules override engineering convenience, performance optimization, and feature velocity.

## Fundamental Principle

Hospital AI OS handles data and workflows that directly affect patient health, safety, and privacy. Every engineering decision must be evaluated through the lens of: "What happens to the patient if this fails?"

## Patient Safety

- No automated system may perform a clinical action without appropriate human authorization.
- No AI output may be presented as a clinical decision; it must be clearly labeled as a recommendation, suggestion, or draft.
- Systems must fail safe: if a safety-critical component fails, the system must default to the most conservative safe state.
- Never suppress, delay, or deprioritize safety-critical alerts for any reason (performance, UX, batching).
- Critical patient information (allergies, active medications, diagnosis) must never be stale; define and enforce freshness requirements.

## Clinical Uncertainty

- When clinical data is incomplete, the system must surface the incompleteness rather than infer missing values.
- When AI-generated clinical information has low confidence, it must be flagged for human review.
- Conflicting clinical data (e.g., contradictory lab results, mismatched records) must be surfaced, never silently resolved.
- The system must distinguish between "no data available" and "data was checked and is negative/normal."

## Human-in-the-Loop

- All clinical decisions require clinician approval before execution.
- The clinician must see the relevant context, the recommendation, and the reasoning before approving.
- Approval must be recorded with: who approved, when, what was approved, what context was available.
- Rejection must be supported with equal ease; the system must not bias toward approval.
- Time-sensitive approvals must have escalation paths if the primary approver is unavailable.
- Bulk approval of clinical actions is prohibited; each action requires individual review.

## Clinical Decision Support Boundaries

- The system provides decision support, not autonomous clinical decisions.
- Decision support outputs must cite their data sources.
- The system must not override clinician judgment.
- If the system disagrees with a clinician's decision, it may present a warning but must accept the clinician's final decision (with audit logging).
- The system must not create the appearance of clinical certainty where none exists.

## Sensitive Health Information

- Patient health information must be encrypted at rest and in transit.
- Access to patient data requires authenticated identity and authorized role.
- Log all access to patient data (who accessed what, when, why).
- Implement minimum necessary access: users see only the data required for their role and current task.
- Never include patient health information in logs, error messages, analytics, or AI training data without explicit authorization and de-identification.
- Never expose patient data in URLs, browser history, or client-side storage without encryption.

## Minimum Necessary Access

- Every data access must be justified by the user's current role and current task.
- A billing clerk does not need access to clinical notes.
- A radiologist does not need access to billing records.
- Access scope must be enforced at the API level, not merely hidden in the UI.
- Temporary elevated access must have automatic expiration.

## Auditability

- Every significant action must produce an audit record.
- Audit records must include: actor, action, target, timestamp, context, outcome.
- Audit records must be immutable; they cannot be edited or deleted.
- Audit records must be queryable for compliance review.
- Clinical actions, data access, permission changes, and AI-assisted decisions are all auditable events.
- Audit infrastructure failure must be treated as a critical system failure.

## Role-Aware Information Display

- The system must adapt information display based on the user's role.
- Clinical details shown to a physician differ from what is shown to an administrative user.
- Patient-facing information must use accessible language, not clinical jargon.
- Sensitive information (e.g., psychiatric notes, HIV status) may have additional access restrictions beyond standard role-based access.

## Emergency and High-Risk Escalation

- Define escalation paths for: clinical emergencies, system failures affecting patient care, data breaches involving patient data.
- Emergency workflows may bypass normal approval flows but must still be fully audited.
- Emergency access (break-glass) must be available but must generate immediate alerts.
- Post-emergency review must be mandatory.

## Medical Misinformation Prevention

- The system must not generate, store, or display unvalidated medical information.
- AI-generated medical content must be reviewed against approved clinical references.
- Drug interaction information, dosage information, and contraindication data must come from authoritative pharmacological databases, not AI inference.
- The system must not extrapolate clinical guidelines beyond their validated scope.

## Recommendation vs. Action

- The system must maintain a clear, enforced distinction between:
  - **Recommendation**: A suggestion that requires human approval before taking effect.
  - **Action**: An operation that modifies patient data, clinical state, or triggers external processes.
- An AI recommendation must never silently become an action.
- The transition from recommendation to action must require explicit human approval, recorded in the audit log.
- UI must visually and semantically distinguish recommendations from executed actions.

## Clinician Approval

- Approval workflows must present: what is being approved, why it was recommended, relevant patient context, potential risks.
- Approvals must be attributable to a specific authenticated clinician.
- The system must not auto-approve on timeout; unapproved recommendations must expire or escalate.
- Approval delegation must be explicitly configured and audited.

## Patient-Facing Communication Safety

- Patient-facing messages must not contain clinical diagnoses unless approved by a clinician.
- Patient-facing messages must not provide medical advice; they may provide operational information (appointments, billing, logistics).
- AI-generated patient-facing content must be reviewed before delivery.
- Patient communication must be accessible (language, literacy level, disability accommodations).
- The system must not create false urgency or false reassurance in patient communications.
