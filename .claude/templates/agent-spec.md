# Agent Specification: [Agent Name]

## Role

[Agent role name]

## Purpose

[What problem does this agent solve? Why is an agent needed instead of a simpler approach?]

## Scope

- Does: [What the agent is responsible for]
- Does NOT: [What the agent should never do]

## Trigger

[What causes this agent to activate?]

## Tools

| Tool Name | Description | Parameters | Side Effects | Permissions Required |
| --------- | ----------- | ---------- | ------------ | -------------------- |
| [tool_1]  | [desc]      | [params]   | [effects]    | [permissions]        |
| [tool_2]  | [desc]      | [params]   | [effects]    | [permissions]        |

## Permissions

- Data access: [what data the agent can read]
- Data modification: [what data the agent can write]
- External calls: [what external systems the agent can contact]

## Context

[What information is provided to the agent for each invocation?]

## Output Format

[Structured output schema expected from the agent.]

## Stopping Conditions

- [Condition 1 — when the agent must stop]
- [Condition 2 — when the agent must stop]
- Maximum iterations: [number]

## Human Approval Points

- [Action that requires human approval before execution]

## Failure Behavior

- Retriable failure: [retry strategy]
- Permanent failure: [log, report, stop]
- Safety-critical failure: [immediate escalation]

## Evaluation Criteria

- [Criterion 1 — how agent quality is measured]
- [Criterion 2 — how agent quality is measured]
