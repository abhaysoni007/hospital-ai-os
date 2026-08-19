# AI Rules

> **Authority Level:** DOMAIN — Governed by Core Rules and Healthcare Rules.

## Fundamental Principle

AI-generated output must never automatically be treated as truth. Every AI output entering a business workflow must pass through validation, structured parsing, and — where clinically relevant — human approval before producing side effects.

## Prompt Design

- Prompts must be version-controlled alongside application code.
- Prompts must include explicit instructions about output format, constraints, and failure behavior.
- Prompts must not contain hardcoded patient data, credentials, or secrets.
- Prompts must define what the model should do when uncertain.
- System prompts must clearly delineate the model's role, boundaries, and prohibited actions.
- Prompt changes require the same review rigor as code changes.

## Structured Outputs

- All AI responses consumed by application logic must use structured output formats (JSON, typed schemas).
- Define explicit schemas for every AI output type.
- Validate AI outputs against their schemas before processing.
- Reject malformed responses gracefully rather than attempting to interpret them.
- Never parse free-text AI output with regex for critical workflows.

## Model Abstraction

- Application code must not depend on a specific AI provider or model.
- Use an abstraction layer that allows model substitution without business logic changes.
- Model configuration (provider, model name, parameters) must be externalized, not hardcoded.
- Model-specific quirks must be handled in the abstraction layer, not in business logic.

## Model Failure

- Every AI call must have timeout handling.
- Every AI call must have retry logic with exponential backoff.
- Every AI call must have a fallback path (graceful degradation, human escalation, or safe default).
- AI failures must never crash the application or corrupt data.
- AI failures must be logged with full context (input, error, latency, model version).

## Hallucination Handling

- Never trust AI-generated identifiers (patient IDs, medication codes, diagnosis codes) without validation against authoritative data sources.
- Never trust AI-generated numerical values (dosages, lab results, billing amounts) without validation.
- Never trust AI-generated references (document IDs, URLs, file paths) without verification.
- AI-generated medical information must be cross-referenced with approved clinical data.
- Implement confidence scoring where the model supports it; route low-confidence outputs to human review.

## Grounding

- AI outputs that reference factual data must be grounded against the source data.
- Provide relevant context to the model rather than relying on parametric knowledge.
- When the model must reference patient data, supply it explicitly in the prompt context.
- Never rely on the model's training data for current hospital-specific information.

## Context Management

- Track token usage and enforce context window limits.
- Implement context truncation strategies that preserve critical information.
- Never silently drop context; log when truncation occurs.
- Separate system instructions from user-provided context from retrieved context.

## Tool Calling

- Every tool available to an AI agent must have a defined contract (inputs, outputs, side effects, permissions).
- Tools that modify data require explicit permission checks before execution.
- Tools that access patient data must enforce role-based access.
- Tool execution must be logged with inputs, outputs, and the requesting agent.
- Tools must validate their inputs independently; do not trust the model's parameter formatting.
- Tools that perform destructive or irreversible actions require human approval.

## Agent Behavior

- Agents must have defined scopes; an agent must not act outside its designated responsibilities.
- Agents must have stopping conditions; unbounded loops are prohibited.
- Agents must have maximum iteration limits.
- Agent actions must be auditable (who did what, when, why, with what inputs).
- Multi-agent workflows must have clear ownership at each step.
- Agent-to-agent communication must use explicit, structured messages.

## AI Observability

- Log every AI invocation: model, prompt hash, input tokens, output tokens, latency, cost, status.
- Track AI quality metrics over time (accuracy, hallucination rate, failure rate).
- Alert on AI performance degradation.
- Maintain prompt version history.
- Enable replay of AI interactions for debugging.

## Evaluation

- Every AI feature must have defined evaluation criteria before deployment.
- Evaluation must include correctness, safety, consistency, and robustness.
- Maintain evaluation datasets for regression testing.
- Run evaluations on prompt changes, model changes, and context changes.
- Do not deploy AI features that have not been evaluated.

## Latency and Cost

- Set latency budgets for AI operations; monitor against them.
- Track per-request AI costs.
- Optimize prompt length without sacrificing quality.
- Cache AI results where inputs are deterministic and outputs are not time-sensitive.
- Use the smallest capable model for each task; do not default to the largest model.

## Model Fallbacks

- Define fallback behavior for every AI-powered feature.
- Fallbacks may include: secondary model, cached result, human escalation, or graceful feature degradation.
- Fallback activation must be logged and alerted.
- Test fallback paths regularly.

## Deterministic Validation Around Probabilistic Outputs

- Business rules applied to AI outputs must be deterministic.
- Validation logic, permission checks, and data integrity constraints must not depend on AI judgment.
- AI may suggest; deterministic code must decide.
- The boundary between AI suggestion and system action must be explicit and auditable.
