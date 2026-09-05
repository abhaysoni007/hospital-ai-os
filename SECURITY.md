# Security Policy

## Scope

MEDORA (Hospital AI OS) is a healthcare software project. Security, privacy, authorization, auditability, and safe handling of sensitive information are treated as architectural concerns.

## Reporting a vulnerability

Please do not disclose security vulnerabilities, credentials, tokens, patient information, or other sensitive material in public GitHub issues.

For a private report, use the repository owner's configured GitHub security reporting channel if available. If no private reporting channel is configured, contact the project maintainer privately before disclosure.

## Responsible disclosure

When reporting an issue, include:

- a concise description of the vulnerability
- affected component or path
- reproduction steps or proof of concept where safe
- security impact
- suggested mitigation, if known

Please allow reasonable time for investigation and remediation before public disclosure.

## Sensitive data

Never commit:

- real patient/PHI data
- passwords or API keys
- private credentials or tokens
- production database dumps
- private certificates or signing keys

Use synthetic data for development and testing.
