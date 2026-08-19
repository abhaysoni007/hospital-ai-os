# DO NOT GUESS

> **Authority Level:** GLOBAL — This rule applies universally to all agents, skills, and workflows.

## Fundamental Principle

When information is not available, the AI must never fabricate an answer. Guessing in a healthcare system can lead to patient harm, security vulnerabilities, data corruption, and engineering failures.

## Never Invent

The AI must never invent or fabricate:

- **APIs**: Do not guess endpoint paths, request formats, or response structures. Read the API documentation or source code.
- **Database schemas**: Do not guess table names, column names, types, or relationships. Inspect the actual schema.
- **Environment variables**: Do not guess variable names or values. Check configuration files and documentation.
- **Credentials**: Never fabricate, assume, or hardcode credentials of any kind.
- **Endpoints**: Do not guess internal or external service endpoints. Verify from configuration or documentation.
- **Library behavior**: Do not assume how a library function works. Read the documentation or source code. Library APIs change between versions.
- **Business requirements**: Do not assume what the product should do. Requirements must be documented and approved.
- **Medical facts**: Never generate medical information from general knowledge. Medical data must come from approved clinical sources.
- **Repository files**: Do not assume a file exists. Check the filesystem.
- **Tool capabilities**: Do not assume a tool supports a feature. Verify from documentation.
- **Configuration values**: Do not guess default values, feature flags, or system settings.
- **Error behavior**: Do not assume how a system behaves on failure. Test it or read the error handling code.

## When Information Is Unavailable

Follow this protocol in order:

1. **Inspect the repository**: Search the codebase, configuration files, and documentation for the answer.
2. **Search existing documentation**: Check `docs/`, README files, ADRs, API specifications, and inline comments.
3. **Identify the uncertainty**: Clearly state what is unknown and what would be needed to resolve it.
4. **Ask for clarification**: When the information cannot be found through inspection, request clarification with specific questions.
5. **Never silently fabricate**: Under no circumstances should the AI generate a plausible-sounding answer to fill a gap. A wrong answer presented with confidence is more dangerous than an explicit "I don't know."

## How to Express Uncertainty

When encountering an unknown, the AI should state:

- What it was looking for.
- Where it looked.
- What it did not find.
- What specific information is needed to proceed.

Example:
> "I could not find the database schema for the appointments table. I checked `docs/architecture/database/`, `src/backend/`, and searched for 'appointment' across the repository. To proceed, I need the approved data model or a reference to the schema definition."

## Scope

This rule applies to:

- All code generation.
- All documentation generation.
- All configuration generation.
- All architectural recommendations.
- All clinical or healthcare-related outputs.
- All security-related decisions.
- All agent-to-agent communication.
