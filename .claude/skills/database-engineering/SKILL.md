# Database Engineering Skill

## Purpose

Provide expert guidance for designing, implementing, and maintaining data models, schemas, migrations, and data integrity mechanisms for Hospital AI OS.

## When to Use

- Designing data models for new features.
- Creating or modifying database schemas.
- Writing and reviewing migrations.
- Optimizing database performance.
- Implementing data integrity constraints.
- Designing data access patterns.
- Working with healthcare-sensitive data storage.

## When NOT to Use

- For API endpoint implementation (use backend-engineering skill).
- For frontend data display (use frontend-engineering skill).
- For AI model data (use agent-engineering skill for agent state).

## Inputs

- Feature requirements with data modeling implications.
- Entity relationship descriptions.
- Query patterns (what data is read, how frequently, in what combinations).
- Data volume and growth expectations.
- Sensitivity classification of data fields.

## Preconditions

- Feature requirements must be understood before designing the data model.
- Data sensitivity classification must be determined (PHI, PII, operational, public).
- Expected query patterns must be identified.

## Responsibilities

### Schema Design

- Design schemas to reflect business domain entities, not UI or API structure.
- Each table/collection should represent a single entity.
- Define primary keys, foreign keys, and relationships explicitly.
- Use consistent naming conventions: `snake_case` for columns, singular nouns for table names.
- Include metadata fields: `created_at`, `updated_at`, `created_by`, `updated_by`.
- Include soft-delete support where applicable: `deleted_at`, `deleted_by`.

### Normalization and Denormalization

- Start with normalized schemas (3NF) for correctness.
- Denormalize only when justified by measured performance requirements.
- Document every denormalization decision with: reason, trade-offs, consistency strategy.
- Denormalized data must have a defined synchronization/consistency mechanism.

### Indexes

- Create indexes for every foreign key.
- Create indexes for fields used in WHERE clauses of frequent queries.
- Create composite indexes for multi-column query patterns (order matters).
- Do not create indexes speculatively; measure query performance first.
- Document the purpose of each index.
- Monitor index usage; remove unused indexes.

### Migrations

- Every schema change must have a migration.
- Migrations must be reversible (up and down).
- Migrations must be backward-compatible when possible (add columns as nullable, avoid renaming without a transition period).
- Test migrations against realistic data volumes.
- Never modify a migration that has been applied to production; create a new migration.
- Migrations must not contain business logic; they should only modify schema.

### Constraints

- Use database-level constraints to enforce data integrity: NOT NULL, UNIQUE, CHECK, FOREIGN KEY.
- Do not rely solely on application-level validation; the database is the last line of defense.
- Define constraints that reflect business rules (e.g., `CHECK (quantity >= 0)`).
- Use ENUM types or reference tables for fields with fixed valid values.

### Transactions

- Use transactions for operations that modify multiple related records.
- Keep transactions as short as possible to minimize lock contention.
- Define isolation levels appropriate to the operation.
- Handle transaction failures with proper rollback.
- Never hold transactions open during external API calls or user interactions.

### Data Integrity

- Define cascade rules for related records (what happens when a parent is deleted).
- Implement optimistic concurrency control for records with concurrent access (version column).
- Define data lifecycle: creation, active use, archival, deletion.
- Implement referential integrity at the database level, not just application level.

### Healthcare-Sensitive Data

- Classify every table and column by data sensitivity (PHI, PII, operational, public).
- PHI fields must be encrypted at rest.
- Access to PHI tables must be restricted to service accounts with appropriate roles.
- Audit logging must track all reads and writes to PHI data.
- PHI must not appear in development or staging databases without de-identification.
- Implement data retention policies: define how long data is kept and how it is disposed.

## Workflow

1. **Understand requirements**: Review the feature and identify entities, relationships, and query patterns.
2. **Design schema**: Create the normalized schema with constraints.
3. **Identify indexes**: Based on query patterns.
4. **Classify sensitivity**: Identify PHI/PII fields.
5. **Write migration**: Reversible, tested.
6. **Document**: Schema documentation, ER diagrams, index rationale.
7. **Review**: Submit for database review and (if PHI is involved) security review.

## Decision Rules

- If a field contains patient health information → classify as PHI, encrypt, restrict access.
- If a table will exceed 1M rows → plan indexing and partitioning strategy upfront.
- If a query involves more than 3 joins → consider denormalization or materialized views.
- If a schema change breaks existing queries → create a migration plan with backward compatibility.

## Safety Constraints

- Never delete production data without explicit authorization and a recovery plan.
- Never modify schemas directly in production; always use reviewed migrations.
- Never store unencrypted PHI.
- Never include real patient data in test or development databases.

## Validation

- [ ] Schema reflects business domain correctly.
- [ ] Constraints enforce data integrity at database level.
- [ ] Indexes support identified query patterns.
- [ ] Migration is reversible and tested.
- [ ] PHI/PII fields are classified and protected.
- [ ] Audit logging covers sensitive data access.

## Expected Output

- Data model design with entity-relationship documentation.
- Migration scripts.
- Index definitions with rationale.
- Sensitivity classification for all fields.

## Failure Handling

- If requirements are ambiguous about data modeling → clarify before designing.
- If performance requirements conflict with normalization → document the trade-off and get approval.
- If PHI classification is uncertain → classify as PHI until clarified.

## Related Rules

- `.claude/rules/engineering.md`
- `.claude/rules/security.md`
- `.claude/rules/healthcare.md`

## Related Agents

- `database-engineer` — primary user of this skill.
- `backend-engineer` — consumes the data model.
- `security-engineer` — reviews PHI handling.

## Related Workflows

- `.claude/workflows/feature-development.md`
- `.claude/workflows/architecture-change.md`

## Verification Checklist

- [ ] Schema normalized appropriately.
- [ ] Database constraints enforce integrity.
- [ ] Indexes match query patterns.
- [ ] Migrations reversible and tested.
- [ ] Sensitive data classified and protected.
- [ ] Documentation complete.
