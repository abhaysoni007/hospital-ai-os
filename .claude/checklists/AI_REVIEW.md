# AI Review Checklist

## Prompt Quality

- [ ] Prompt has clear, unambiguous instructions.
- [ ] Prompt defines expected output format (structured schema).
- [ ] Prompt defines behavior for uncertain or low-confidence situations.
- [ ] Prompt includes explicit constraints and prohibited actions.
- [ ] Prompt is version-controlled alongside application code.
- [ ] System prompt clearly separates from user/context sections.

## Grounding

- [ ] AI responses reference provided context, not parametric knowledge, for factual claims.
- [ ] Patient-specific information is supplied in context, not assumed from training data.
- [ ] Clinical data sources are cited or traceable.

## Hallucination Handling

- [ ] AI-generated identifiers (IDs, codes) are validated against authoritative sources.
- [ ] AI-generated numerical values (dosages, amounts) are validated.
- [ ] AI-generated references are verified to exist.
- [ ] Confidence scoring is implemented where model supports it.
- [ ] Low-confidence outputs are routed to human review.

## Structured Output

- [ ] AI output schema is defined and documented.
- [ ] AI output is validated against the schema before processing.
- [ ] Malformed outputs are rejected gracefully (not interpreted with regex).
- [ ] Partial or truncated outputs are detected and handled.

## Failure Handling

- [ ] Timeout handling with defined timeout values.
- [ ] Retry logic with exponential backoff.
- [ ] Fallback behavior defined (secondary model, human escalation, safe default).
- [ ] AI failure does not crash the application or corrupt data.
- [ ] AI failure is logged with full context.

## Model Fallback

- [ ] Fallback path exists for AI service unavailability.
- [ ] Fallback activation is logged and alerted.
- [ ] Fallback paths are tested regularly.

## Safety

- [ ] AI output is never automatically treated as a clinical action.
- [ ] Human approval is required for clinical recommendations.
- [ ] AI does not generate unvalidated medical information.
- [ ] AI does not expose PHI beyond authorized scope.
- [ ] AI recommendations are clearly labeled as recommendations, not decisions.

## Evaluation

- [ ] Evaluation criteria defined before deployment.
- [ ] Evaluation dataset covers typical, edge, and adversarial cases.
- [ ] Evaluation results meet defined thresholds.
- [ ] Regression evaluation against previous baseline.
- [ ] Evaluation results documented.

## Latency and Cost

- [ ] Latency measured and within budget.
- [ ] Token usage tracked.
- [ ] Per-request cost tracked.
- [ ] Prompt optimized for length without sacrificing quality.
- [ ] Smallest capable model used for the task.

## Observability

- [ ] Every AI invocation logged: model, prompt hash, tokens, latency, cost, status.
- [ ] Quality metrics tracked over time.
- [ ] Alerts on performance degradation.
- [ ] Prompt version history maintained.

## Prompt Injection

- [ ] User-provided content sanitized before inclusion in prompts.
- [ ] Clear delimiters between system instructions and user content.
- [ ] AI outputs validated independently of the prompt.
- [ ] Tested with known prompt injection patterns.

## Tool Misuse

- [ ] Tool contracts defined (inputs, outputs, side effects, permissions).
- [ ] Tool permissions enforced independently of the model's request.
- [ ] Tool inputs validated before execution.
- [ ] Tool execution logged.
- [ ] Destructive tools require human approval.

## Data Leakage

- [ ] PHI not included in AI training data.
- [ ] PHI not logged in AI invocation logs.
- [ ] AI context does not include data beyond what is necessary for the task.
- [ ] Model provider data handling policies reviewed.
