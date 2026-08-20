# Healthcare Safety Skill

## Purpose

Provide reusable safeguards, decision frameworks, and validation criteria for all work that touches healthcare data, clinical workflows, patient safety, or medical information within Hospital AI OS.

## When to Use

- Implementing any feature that accesses, displays, or modifies patient data.
- Building clinical decision support features.
- Designing AI features that produce clinical recommendations.
- Building patient-facing communication features.
- Implementing data access controls for healthcare information.
- Reviewing any change that could affect patient safety.
- Designing audit logging for clinical operations.

## When NOT to Use

- Pure infrastructure work with no healthcare data exposure (e.g., CI/CD pipeline configuration).
- Design system token definitions.
- General code formatting or linting tasks.

## Inputs

- Feature specification or change request.
- Data model or schema involved.
- User roles affected.
- Clinical workflow context.

## Preconditions

- The feature's clinical context must be understood before applying this skill.
- Relevant healthcare rules (`.claude/rules/healthcare.md`) must be reviewed.
- Affected user personas and their clinical roles must be identified.

## Responsibilities

### Patient Safety Assessment

For every healthcare-related feature, evaluate:

1. **Direct harm potential**: Can this feature, if it malfunctions, cause direct patient harm?
   - If yes → requires clinician approval workflow, redundant validation, and safety testing.
2. **Indirect harm potential**: Can this feature lead to delayed care, missed information, or wrong-patient actions?
   - If yes → requires data freshness checks, patient verification, and alert mechanisms.
3. **Information integrity**: Does this feature create, modify, or display clinical data?
   - If yes → requires validation, audit logging, and source attribution.

### Clinical Risk Classification

Classify features by clinical risk:

| Risk Level | Description | Requirements |
|-----------|-------------|--------------|
| **Critical** | Directly affects clinical decisions (medication orders, diagnosis, alerts) | Human approval, dual validation, real-time audit, safety tests |
| **High** | Affects clinical workflow efficiency (scheduling, task management, handover) | Human review, audit logging, failure handling |
| **Medium** | Displays clinical information (dashboards, reports, history) | Data freshness, access control, audit logging |
| **Low** | Administrative operations with minimal clinical impact (billing, scheduling logistics) | Standard access control, logging |

### Medical Uncertainty Handling

When the system encounters medical uncertainty:

1. Never resolve uncertainty silently.
2. Surface the uncertainty with context: what is uncertain, what data is missing, what contradictions exist.
3. Route to appropriate human reviewer based on the clinical domain.
4. Log the uncertainty event, the routing decision, and the resolution.

### Human Approval Framework

For features requiring human approval:

1. **Present context**: Show the approver all relevant information needed for the decision.
2. **Present the recommendation**: Clearly label it as a recommendation, not a decided action.
3. **Present risks**: If applicable, highlight potential risks or contraindications.
4. **Record the decision**: Who approved/rejected, when, what was shown to them, any notes.
5. **Enable rejection**: Rejection must be as easy as approval. Never bias the UI toward approval.
6. **Handle timeout**: Define escalation behavior if approval is not given within the required timeframe.

### Sensitive Data Safeguards

- PHI (Protected Health Information) must be encrypted at rest and in transit.
- Access requires authenticated identity + authorized role + justified purpose.
- Access must be logged: who, what, when, why.
- Data display must follow minimum necessary principle: show only what the role and task require.
- PHI must never appear in: logs, error messages, URLs, analytics, AI training data, browser local storage (unencrypted).

### Role-Based Access Boundaries

Verify that the feature enforces:

- Physicians see clinical data relevant to their patients and department.
- Nurses see clinical data relevant to their assigned patients and care tasks.
- Administrative staff see operational data without unnecessary clinical detail.
- Billing staff see billing-relevant data without detailed clinical notes.
- Patients see their own data in accessible, non-technical language.
- Auditors see access logs and compliance data without patient-level clinical detail (unless authorized for specific investigations).

### Escalation Paths

Define escalation for:

- Clinical emergency detected by the system → immediate alert to on-duty clinical staff.
- AI recommendation contradicts clinical safety rules → block action, alert responsible clinician.
- Patient data breach detected → trigger incident response workflow.
- System failure affecting clinical operations → alert operations team, activate degraded-mode procedures.

### Auditability Requirements

Every healthcare feature must produce audit records for:

- Patient data access (read).
- Patient data modification (write).
- Clinical recommendations generated.
- Clinical actions approved/rejected.
- Permission changes affecting healthcare data.
- Emergency/break-glass access events.

## Workflow

1. **Assess**: Classify the feature's clinical risk level.
2. **Identify**: List all patient data, clinical workflows, and user roles involved.
3. **Apply safeguards**: Based on risk classification, apply required safety controls.
4. **Validate**: Verify safeguards are implemented and testable.
5. **Document**: Record safety decisions and their rationale.
6. **Test**: Create safety-specific test cases.
7. **Review**: Submit for AI safety review if the feature is high or critical risk.

## Decision Rules

- If patient safety is at risk → stop and escalate.
- If clinical data integrity is uncertain → surface the uncertainty, do not proceed silently.
- If a feature can modify clinical state → require human approval.
- If AI generates clinical content → require validation against approved sources.
- If patient data is exposed → enforce access control and audit logging.

## Safety Constraints

- Never deploy a clinical feature without safety testing.
- Never bypass human approval for clinical actions.
- Never suppress clinical alerts.
- Never auto-resolve conflicting clinical data.
- Never expose PHI in debugging or development tools.

## Validation

- [ ] Clinical risk classification documented.
- [ ] Patient data access controls implemented and tested.
- [ ] Audit logging implemented for all sensitive operations.
- [ ] Human approval workflow implemented where required.
- [ ] Medical uncertainty handling implemented.
- [ ] Sensitive data excluded from logs and error messages.
- [ ] Safety test cases written and passing.

## Expected Output

- Clinical risk assessment for the feature.
- List of safeguards applied.
- Safety test cases.
- Audit logging specification.
- Human approval workflow specification (if applicable).

## Failure Handling

- If safety requirements cannot be met → do not proceed with the feature. Escalate to the Technical Lead and Product Manager.
- If safety testing reveals gaps → block deployment until gaps are addressed.
- If clinical risk classification is uncertain → classify as the higher risk level until clarified.

## Related Rules

- `.claude/rules/healthcare.md`
- `.claude/rules/security.md`
- `.claude/rules/ai.md`

## Related Agents

- `ai-safety-reviewer` — reviews AI features for healthcare safety.
- `security-engineer` — reviews data protection and access controls.
- `qa-engineer` — validates safety test cases.

## Related Workflows

- `.claude/workflows/feature-development.md`
- `.claude/workflows/security-review.md`

## Verification Checklist

- [ ] This skill was applied before implementation began.
- [ ] Clinical risk level was classified.
- [ ] All identified safeguards are implemented.
- [ ] Safety tests are passing.
- [ ] Audit logging is verified.
- [ ] No PHI exposure in logs, errors, or debugging output.
