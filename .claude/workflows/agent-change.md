# Agent Change Workflow

## Trigger

New AI agent creation, modification to existing agent behavior, tools, or permissions.

## Agents Involved

- **AI Engineer** — designs and implements the agent change.
- **Technical Lead** — approves agent architecture.
- **AI Safety Reviewer** — reviews safety implications.
- **Security Engineer** — reviews permissions and data access.
- **Code Reviewer** — reviews implementation.

## Phases

### 1. Justify

- Document why the agent change is needed.
- Confirm an agent is the right approach (vs. simpler alternatives).
- Define the agent's scope, tools, permissions, and stopping conditions.

### 2. Specify

- Update the agent specification using the agent contract format.
- Define tool contracts (inputs, outputs, side effects, permissions).
- Define human approval points.
- Follow the agent-engineering skill (`.claude/skills/agent-engineering/`).

### 3. Implement

- Implement the agent with safety controls.
- Implement tool validation and permission checks.
- Implement stopping conditions and iteration limits.
- Implement observability (logging, metrics).

### 4. Evaluate

- Run AI evaluation using the ai-evaluation skill.
- Test with typical inputs, edge cases, and adversarial inputs.
- Test failure handling and fallback behavior.
- Test stopping conditions.

### 5. Review

- AI Safety Reviewer reviews safety.
- Security Engineer reviews permissions and data access.
- Code Reviewer reviews implementation quality.

### 6. Document

- Update agent documentation.
- Update AI documentation in `docs/ai/`.
- Update tool registry if tools changed.

## Quality Gates

- [ ] Agent justification documented.
- [ ] Agent specification complete.
- [ ] Safety controls implemented.
- [ ] AI evaluation passed.
- [ ] AI safety review approved.
- [ ] Security review approved.
- [ ] Code review approved.
