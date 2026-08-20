# AI Evaluation Skill

## Purpose

Define how AI functionality is evaluated for correctness, safety, consistency, robustness, and operational fitness before deployment and on an ongoing basis.

## When to Use

- Before deploying any new AI feature.
- After changing prompts, models, or context strategies.
- When evaluating AI quality regressions.
- When comparing model alternatives.
- When reviewing AI safety for clinical workflows.
- During periodic AI quality audits.

## When NOT to Use

- For non-AI features that do not involve model inference.
- For evaluating UI or API design (use respective skills).

## Inputs

- AI feature specification (purpose, inputs, expected outputs).
- Evaluation dataset (input/expected-output pairs).
- Prompt version and model configuration.
- Acceptance criteria (accuracy thresholds, safety requirements).

## Preconditions

- Evaluation criteria must be defined before the AI feature is built.
- An evaluation dataset must exist or be created as part of evaluation.
- The AI feature must be testable in isolation (not only through the full application stack).

## Responsibilities

### Evaluation Dimensions

#### Correctness
- Does the AI produce the right answer for known inputs?
- Measure: accuracy, precision, recall, F1 against the evaluation dataset.
- Threshold: define per-feature; no universal default.

#### Factuality
- Are the facts in the AI output verifiable against source data?
- Measure: percentage of claims that can be traced to provided context.
- Healthcare-specific: every clinical fact must be grounded in supplied data, not model parametric knowledge.

#### Groundedness
- Does the AI output stay within the provided context?
- Measure: percentage of output content attributable to input context.
- Detect: information that appears in the output but was not in the input context (hallucination indicator).

#### Hallucination Rate
- How often does the AI generate information not supported by the input?
- Measure: manual or automated review of outputs for unsupported claims.
- Healthcare-specific: hallucinated patient IDs, medication names, dosages, or diagnosis codes are critical failures.

#### Safety
- Does the AI output comply with healthcare safety rules?
- Measure: percentage of outputs that pass safety checks (no unauthorized clinical actions, no PHI exposure, no medical misinformation).
- Any safety failure is a blocking issue regardless of other metrics.

#### Consistency
- Does the AI produce consistent outputs for the same or similar inputs?
- Measure: variance across multiple runs with identical inputs.
- Healthcare-specific: clinical recommendations must not fluctuate randomly between runs.

#### Latency
- How long does the AI take to respond?
- Measure: P50, P95, P99 latency.
- Threshold: define per-feature based on user workflow requirements.

#### Cost
- What is the per-request cost of the AI operation?
- Measure: token usage × cost per token.
- Optimize: prompt length, model selection, caching strategy.

#### Robustness
- How does the AI behave with unexpected, incomplete, or adversarial inputs?
- Test: empty inputs, extremely long inputs, inputs with injection attempts, inputs with conflicting information.
- Requirement: graceful degradation, never a crash or unsafe output.

#### Adversarial Inputs
- How does the AI respond to prompt injection, jailbreak attempts, or manipulative inputs?
- Test: known prompt injection patterns, instructions embedded in user data.
- Requirement: AI must not follow injected instructions; it must follow system instructions only.

### Evaluation Dataset Management

- Maintain evaluation datasets per AI feature in version control.
- Datasets must include: typical inputs, edge cases, adversarial inputs, known failure cases.
- Update datasets when new failure modes are discovered.
- Label datasets with expected outputs and evaluation criteria.

### Regression Evaluation

- Run the full evaluation suite on every prompt change.
- Run the full evaluation suite on every model change.
- Run the full evaluation suite on every context strategy change.
- Compare results against the previous baseline.
- Block deployment if regression is detected on safety or correctness metrics.

## Workflow

1. **Define criteria**: Establish evaluation dimensions and thresholds for the feature.
2. **Create dataset**: Build or curate the evaluation dataset.
3. **Run evaluation**: Execute the AI feature against the dataset.
4. **Analyze results**: Measure each dimension against thresholds.
5. **Identify failures**: Document specific failure cases with context.
6. **Iterate**: If failures exist, update prompts/configuration and re-evaluate.
7. **Baseline**: Once passing, record the results as the new baseline for regression detection.
8. **Document**: Record evaluation results, decisions, and known limitations.

## Decision Rules

- If safety evaluation fails → block deployment. No exceptions.
- If correctness falls below threshold → block deployment until addressed.
- If hallucination rate exceeds threshold → investigate and mitigate.
- If latency exceeds budget → optimize or re-evaluate model selection.
- If regression detected → investigate cause before proceeding.

## Safety Constraints

- Evaluation datasets must not contain real patient data.
- Evaluation results must not be extrapolated beyond the dataset scope.
- Passing evaluation does not eliminate the need for human oversight in clinical workflows.

## Validation

- [ ] Evaluation criteria defined before feature development.
- [ ] Evaluation dataset covers typical, edge, and adversarial cases.
- [ ] All evaluation dimensions measured.
- [ ] Results documented with specific metrics.
- [ ] Baseline recorded for future regression comparison.
- [ ] Safety evaluation passed.

## Expected Output

- Evaluation report: metrics per dimension, pass/fail per threshold, specific failure cases.
- Regression comparison against previous baseline (if applicable).
- Recommendations for improvement (if failures exist).

## Failure Handling

- If evaluation infrastructure fails → do not assume the AI feature passes. Fix infrastructure first.
- If evaluation dataset is insufficient → expand the dataset before concluding.
- If results are ambiguous → err on the side of caution; require additional review.

## Related Rules

- `.claude/rules/ai.md`
- `.claude/rules/healthcare.md`
- `.claude/rules/testing.md`

## Related Agents

- `ai-engineer` — builds AI features and runs evaluations.
- `ai-safety-reviewer` — reviews evaluation results for safety compliance.
- `qa-engineer` — validates evaluation methodology.

## Related Workflows

- `.claude/workflows/feature-development.md` (AI feature path)

## Verification Checklist

- [ ] Evaluation criteria defined and documented.
- [ ] Evaluation dataset created and version-controlled.
- [ ] All dimensions evaluated and results recorded.
- [ ] Safety evaluation passed.
- [ ] Baseline established for regression detection.
- [ ] Known limitations documented.
