# Caveman — Efficient Communication

## Purpose

A meta-level behavioral skill that optimizes agent communication for maximum useful information per token while preserving technical accuracy, clarity, and safety. Caveman ensures agents communicate efficiently during routine engineering work and switch to full clarity mode when compression could create risk.

## When to Use

- Progress updates.
- Implementation summaries.
- Routine engineering communication.
- Status reports.
- Simple decisions with clear rationale.
- Repetitive technical information.
- Code review comments on minor issues.
- Task completion reports.

## When NOT to Use (Mandatory Clarity Mode)

Switch to **full prose with complete context** for:

| Situation | Reason |
|-----------|--------|
| Security warnings | Compressed security advice could miss critical detail |
| Healthcare safety warnings | Compressed clinical information could cause patient harm |
| Irreversible actions | User must fully understand consequences before proceeding |
| Migration risks | Data loss risk demands explicit explanation |
| Production incidents | Incident response requires unambiguous communication |
| Clinical workflows | Clinical context must never be compressed to the point of ambiguity |
| Patient safety issues | Any ambiguity could lead to harm |
| Legal/compliance implications | Incomplete compliance guidance creates liability |
| Architectural decisions with significant consequences | Decision rationale must be fully documented |
| User confusion | If the user is confused, add context rather than compressing further |
| Complex multi-step instructions | Steps must be unambiguous and sequentially clear |
| Anything where compression could be misinterpreted | When in doubt, use full clarity |

## Default Communication Format

For routine engineering work, prefer this structure:

```
Problem: [what is wrong or what needs to be done]
Cause: [why — root cause or rationale]
Decision: [what was decided]
Action: [what was done or will be done]
Verification: [how it was verified]
```

### Examples

**Bug fix report (Caveman):**
```
Problem: Auth token not refreshed on 401 response.
Cause: Interceptor catches 401 but doesn't retry the original request after refresh.
Fix: Added retry-after-refresh logic in the auth interceptor.
Test: Added integration test for 401 → refresh → retry flow.
Verified: All auth tests passing, manual test confirmed.
```

**Status update (Caveman):**
```
Status: Discharge workflow API — 3/5 endpoints complete.
Done: GET /discharges, GET /discharges/:id, POST /discharges
Next: PUT /discharges/:id, DELETE /discharges/:id
Blocked: None.
```

**Code review comment (Caveman):**
```
Issue: Missing null check on patient.allergies before iteration.
Risk: Runtime error if allergies is null.
Fix: Add null check or default to empty array.
```

### Contrast: Full Clarity Mode

**Security warning (NOT Caveman — full clarity):**
```
WARNING: The proposed implementation stores the API key in the client-side
localStorage. This exposes the key to any JavaScript running on the page,
including potential XSS payloads.

Impact: If an XSS vulnerability exists anywhere in the application, an
attacker could extract the API key and use it to access patient data.

Recommendation: Store the API key server-side only. Use an HTTP-only,
Secure, SameSite cookie for session management. The API key should never
be sent to the client.

This is a blocking security issue and must be resolved before merge.
```

**Healthcare safety warning (NOT Caveman — full clarity):**
```
WARNING: This implementation auto-applies the AI-recommended medication
dosage without clinician review.

Patient Safety Risk: If the AI model hallucinates or miscalculates a
dosage, the incorrect dosage would be applied directly to the patient's
medication order without any human verification.

Required: All AI-recommended medication dosages MUST be presented to the
prescribing clinician for review and explicit approval before being
applied to the medication order. This is a non-negotiable patient safety
requirement.

Reference: .claude/rules/healthcare.md — "Recommendation vs. Action"
```

## Communication Calibration

### When to compress

- The audience is technical and familiar with the context.
- The information is routine and unambiguous.
- The decision is straightforward with clear rationale.
- The action is low-risk and reversible.

### When to expand

- The audience may not have full context.
- The information involves risk (safety, security, data, availability).
- The decision has trade-offs that should be visible.
- The action is high-impact, irreversible, or affects patients.
- Previous communication was misunderstood.

### Calibration Rule

> If you are unsure whether to compress or expand, **expand.** A slightly longer explanation that is clear is always better than a compressed explanation that is misunderstood.

## What Caveman Never Sacrifices

Regardless of communication mode, the following must always be present:

- **Safety warnings** — always explicit, never compressed away.
- **Accuracy** — compressed does not mean approximate. Facts must be precise.
- **Explicit warnings** — never omit a warning to save tokens.
- **Necessary context** — if removing context creates ambiguity, keep it.
- **Decision rationale** — for significant decisions, the "why" must be stated.
- **Uncertainty** — if something is uncertain, say so explicitly. Never imply certainty through compression.

## Structured Output Formats

Caveman encourages using structured formats for scanability:

| Format | Use For |
|--------|---------|
| Tables | Comparisons, status summaries, option evaluations |
| Bullet lists | Action items, findings, requirements |
| Numbered lists | Sequential steps, priority ordering |
| Key: Value | Configuration, status fields, metadata |
| Code blocks | Code, commands, structured data |
| Checklists | Quality gates, review criteria |

## Decision Rules

- If the communication is routine engineering → use Caveman format.
- If the communication involves safety or security → use full clarity mode.
- If the audience is confused → add context, do not compress further.
- If the decision has significant consequences → document rationale fully.
- If the information is ambiguous when compressed → expand.

## Related Rules

- `.claude/rules/core.md` — Caveman implements concise communication without violating explicit documentation requirements.
- `.claude/rules/documentation.md` — documentation artifacts follow documentation rules, not Caveman compression.
- `.claude/rules/healthcare.md` — healthcare communication always uses full clarity.
- `.claude/rules/security.md` — security communication always uses full clarity.

## Related Skills

- `.claude/skills/superpowers/` — Superpowers produces structured output; Caveman makes it concise.
- `.claude/skills/ponytail/` — Ponytail simplifies implementation; Caveman simplifies communication.
- `.claude/skills/documentation/` — formal documentation follows documentation standards, not Caveman brevity.

## Related Agents

- All agents use Caveman for routine communication.
- `ai-safety-reviewer` — uses clarity mode for all safety findings.
- `security-engineer` — uses clarity mode for all security findings.
- `release-manager` — uses clarity mode for release decisions.

## Verification Checklist

- [ ] Communication is concise without ambiguity.
- [ ] Safety warnings are in full clarity mode.
- [ ] Security warnings are in full clarity mode.
- [ ] Healthcare-related communication uses full clarity.
- [ ] Uncertainty is explicitly stated, not compressed away.
- [ ] Decision rationale is present for significant decisions.
