# Performance Skill

## Purpose

Provide expert guidance for identifying, measuring, diagnosing, and resolving performance issues across all layers of Hospital AI OS.

## When to Use

- Profiling slow API endpoints or database queries.
- Optimizing frontend load time and rendering performance.
- Evaluating AI operation latency and cost.
- Setting performance budgets for new features.
- Investigating performance regressions.
- Designing caching strategies.

## When NOT to Use

- For functional correctness issues (use the relevant engineering skill).
- For security performance (rate limiting — use security-engineering skill).

## Inputs

- Performance requirements (latency budgets, throughput targets).
- Profiling data or performance measurements.
- Architecture diagrams showing the performance-critical path.

## Preconditions

- Performance requirements must be defined before optimization.
- Measurement tools must be available (profiler, APM, browser dev tools).
- Optimization must be based on data, not guesses.

## Responsibilities

### Profiling

- Measure before optimizing; never optimize without data.
- Identify the bottleneck (CPU, memory, I/O, network, database).
- Profile in realistic conditions (representative data volume, concurrent users).

### Bottleneck Identification

- Trace the critical path from user action to response.
- Identify the slowest component in the path.
- Check: database queries, external API calls, AI model inference, computation, serialization.

### Database Performance

- Analyze slow queries with EXPLAIN plans.
- Verify indexes exist for frequently queried columns.
- Identify N+1 query patterns and eliminate them.
- Consider connection pooling configuration.
- Consider read replicas for read-heavy workloads.

### API Latency

- Set response time budgets: P50, P95, P99.
- Measure at the API gateway and at the service level.
- Identify: slow database queries, slow external calls, unnecessary serialization.
- Implement pagination for list endpoints.

### Frontend Performance

- Measure: First Contentful Paint, Largest Contentful Paint, Time to Interactive, Cumulative Layout Shift.
- Minimize initial bundle size with code splitting.
- Lazy load non-critical resources.
- Optimize images (format, size, lazy loading).
- Minimize re-renders with appropriate memoization.

### Caching

- Cache data that is read frequently and changes infrequently.
- Define cache invalidation strategy for every cached item.
- Set appropriate TTL (time-to-live) values.
- Monitor cache hit rates.
- Never cache sensitive data without appropriate controls.
- Be cautious with caching in healthcare: stale clinical data can be dangerous.

### AI Latency and Cost

- Measure per-request AI latency and token usage.
- Optimize prompt length without sacrificing quality.
- Use the smallest capable model for each task.
- Cache AI results for deterministic inputs where appropriate.
- Stream AI responses to improve perceived latency for user-facing features.

## Workflow

1. **Define requirements**: Set performance budgets for the target.
2. **Measure**: Profile the current state.
3. **Identify bottleneck**: Find the slowest component.
4. **Optimize**: Apply targeted optimization.
5. **Measure again**: Verify the optimization worked.
6. **Monitor**: Set up ongoing performance monitoring.

## Decision Rules

- If API latency exceeds budget → profile and optimize the slowest component.
- If database query is slow → check indexes and query plan before restructuring.
- If frontend is slow → check bundle size and network waterfall before adding complexity.
- If AI is slow → check model selection and prompt length before adding caching.

## Safety Constraints

- Never sacrifice correctness for performance.
- Never cache clinical data without freshness validation.
- Never skip validation for performance reasons.
- Performance optimization must not bypass security controls.

## Related Rules

- `.claude/rules/engineering.md`
- `.claude/rules/healthcare.md` (data freshness)

## Related Agents

- `performance-reviewer` — primary user of this skill.
- `backend-engineer`, `frontend-engineer`, `database-engineer` — implement optimizations.

## Verification Checklist

- [ ] Performance requirements defined.
- [ ] Measurements taken before and after optimization.
- [ ] Bottleneck identified with data.
- [ ] Optimization targeted at the actual bottleneck.
- [ ] Correctness and safety not compromised.
- [ ] Monitoring in place for ongoing tracking.
