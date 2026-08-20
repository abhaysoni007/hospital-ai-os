# Agent Engineering Skill

## Purpose

Define how AI agents should be designed, implemented, tested, and operated within Hospital AI OS. This skill provides the patterns and constraints for building agents that are safe, observable, and controllable.

## When to Use

- Designing a new AI agent.
- Modifying an existing agent's behavior, tools, or permissions.
- Reviewing an agent implementation.
- Debugging agent behavior.
- Adding new tools to an agent.

## When NOT to Use

- For non-agent AI features (e.g., single-shot inference, embeddings, classification).
- For defining business logic that happens to use AI (use the relevant domain skill instead).

## Inputs

- Agent specification: purpose, scope, responsibilities.
- Available tools and their contracts.
- Permission requirements.
- Workflow context the agent operates within.

## Preconditions

- The agent's purpose must be justified: why is an agent needed instead of a simpler approach?
- The agent's scope must be defined: what it does and does not do.
- Available tools must have documented contracts (inputs, outputs, side effects, permissions).

## Responsibilities

### Agent Design Principles

1. **Single responsibility**: Each agent should have a clear, bounded purpose. Avoid "god agents" that do everything.
2. **Minimal authority**: An agent should have access to only the tools and data it needs for its specific task.
3. **Observable execution**: Every agent action must be logged and traceable.
4. **Bounded execution**: Every agent must have stopping conditions and maximum iteration limits.
5. **Deterministic validation**: While agent reasoning may be probabilistic, validation of agent outputs must be deterministic.
6. **Graceful failure**: Agent failure must not corrupt system state or leave operations in an unknown state.

### Agent Specification

Every agent must define:

| Attribute | Description |
|-----------|-------------|
| **Name** | Unique identifier |
| **Purpose** | What problem this agent solves |
| **Scope** | What the agent does and does not do |
| **Trigger** | What causes the agent to activate |
| **Tools** | Which tools the agent can use, with their contracts |
| **Permissions** | What data/operations the agent is authorized for |
| **Context** | What information the agent receives |
| **Stopping conditions** | When the agent must stop |
| **Maximum iterations** | Hard limit on planning/execution loops |
| **Output format** | Structured output schema |
| **Failure behavior** | What happens when the agent fails |
| **Human approval points** | Which actions require human approval |

### Tool Design

- Tools must have explicit contracts: name, description, parameters (with types), return value, side effects, required permissions.
- Tools must validate their inputs independently; do not trust the agent's parameter formatting.
- Tools that modify data must be idempotent where possible.
- Tools that modify data must check permissions before execution.
- Tools must return structured results, including error cases.
- Tool execution must be logged: tool name, parameters, result, duration, calling agent.

### Context Management

- Provide agents with the minimum context needed for their task.
- Separate system instructions from task-specific context.
- Track context window usage; implement strategies for large contexts (summarization, retrieval, windowing).
- Never include secrets, credentials, or unnecessary PHI in agent context.

### Memory and State

- Agent state between invocations must be explicit and stored externally (database, not in-memory).
- State must be serializable and inspectable.
- State must have TTL (time-to-live) to prevent stale state accumulation.
- State modifications must be atomic and auditable.

### Planning and Execution

- Separate planning (deciding what to do) from execution (doing it).
- Log the plan before execution begins.
- Validate each step's output before proceeding to the next step.
- Support cancellation at any step.
- If a step fails, do not silently skip it; either retry (with limits) or escalate.

### Stopping Conditions

Every agent must stop when:

- The task is completed successfully.
- The maximum iteration limit is reached.
- An unrecoverable error occurs.
- Human intervention is required and the agent cannot proceed autonomously.
- The agent detects it is in a loop (repeating the same actions without progress).

### Failure Handling

- Classify failures: retriable (network timeout) vs. permanent (invalid input) vs. safety-critical (clinical error).
- Retriable failures: retry with exponential backoff, up to a maximum retry count.
- Permanent failures: log, report, and stop. Do not retry.
- Safety-critical failures: stop immediately, alert, and escalate.
- Agent failure must leave the system in a known, recoverable state.

### Permissions and Human Approval

- Define permission levels: read-only, suggest, execute with approval, execute autonomously.
- Clinical actions: always require human approval.
- Data modifications: require approval based on sensitivity classification.
- Administrative actions: based on role and risk level.
- Log all approval decisions: who approved, what, when, what context was shown.

### Observability

- Log: agent invocation, plan, each step (tool call, result, decision), outcome, total duration, token usage, cost.
- Track: success rate, failure rate, average duration, average cost, human escalation rate.
- Alert: on repeated failures, on excessive duration, on unexpected tool usage patterns.

## Workflow

1. **Justify**: Confirm an agent is the right pattern (vs. simpler alternatives).
2. **Specify**: Define the agent using the specification template above.
3. **Design tools**: Define or identify existing tools with their contracts.
4. **Implement**: Build the agent with all safety controls.
5. **Test**: Unit test tools, integration test agent behavior, evaluate with AI evaluation skill.
6. **Review**: Submit for code review and AI safety review.
7. **Deploy**: Deploy with monitoring and alerting.
8. **Monitor**: Track operational metrics and quality over time.

## Decision Rules

- If a task can be accomplished without an agent (simple function, rule-based logic) → do not build an agent.
- If an agent needs more than 5 tools → consider splitting into multiple focused agents.
- If an agent has no stopping condition → do not proceed; define stopping conditions first.
- If an agent can modify clinical data → it must have human approval gates.
- If an agent's failure could affect patient safety → it must be reviewed by the AI safety reviewer.

## Safety Constraints

- Agents must never have unrestricted access to production data.
- Agents must never execute clinical actions without human approval.
- Agents must never store credentials or secrets in their state.
- Agents must never bypass permission checks.
- Agents must never communicate with external services not in their authorized tool set.

## Validation

- [ ] Agent purpose is justified (simpler alternative not sufficient).
- [ ] Agent specification is complete.
- [ ] All tools have documented contracts.
- [ ] Stopping conditions are defined and implemented.
- [ ] Maximum iteration limit is set.
- [ ] Failure handling covers retriable, permanent, and safety-critical failures.
- [ ] Permission model is defined and enforced.
- [ ] Observability is implemented.
- [ ] Tests cover success, failure, and edge cases.

## Expected Output

- Agent specification document.
- Tool contracts.
- Implementation with safety controls.
- Test suite.
- Monitoring configuration.

## Failure Handling

- If agent design cannot meet safety constraints → do not build the agent. Propose a safer alternative.
- If tool contracts are unclear → define contracts before building the agent.
- If permission model is ambiguous → escalate to Technical Lead for clarification.

## Related Rules

- `.claude/rules/ai.md`
- `.claude/rules/healthcare.md`
- `.claude/rules/security.md`

## Related Agents

- `ai-engineer` — implements agents.
- `ai-safety-reviewer` — reviews agent safety.
- `technical-lead` — approves agent architecture.

## Related Workflows

- `.claude/workflows/agent-change.md`
- `.claude/workflows/feature-development.md`

## Verification Checklist

- [ ] Agent justification documented.
- [ ] Specification complete with all required attributes.
- [ ] Safety constraints verified.
- [ ] Tool contracts defined and tested.
- [ ] Human approval points identified and implemented.
- [ ] Stopping conditions tested.
- [ ] Observability verified.
