# Hospital AI OS — Security Architecture

> **Status:** Phase 3 Architecture Blueprint  
> **Authority:** Security Rules, Healthcare Rules, AI Rules  
> **Scope:** Authentication, authorization, encryption, secrets, threat model, AI-specific security

---

## 1. Authentication Architecture

### 1.1 Authentication Flow

```text
1. Login: POST /api/auth/login { email, password }
2. Server validates credentials (bcrypt comparison)
3. Server generates:
   - Access Token (JWT, short-lived)
   - Refresh Token (opaque, stored hashed in DB)
4. Response: { accessToken } + httpOnly cookie (refreshToken)
5. Subsequent requests: Authorization: Bearer <accessToken>
6. Token refresh: POST /api/auth/refresh (cookie-based)
7. Logout: POST /api/auth/logout (revokes refresh token, clears cookie)
```

### 1.2 JWT Access Token

| Property | Value |
|:---|:---|
| **Algorithm** | RS256 (asymmetric — private key signs, public key verifies) |
| **Lifetime** | 15 minutes |
| **Storage** | In-memory (frontend) — never localStorage |
| **Payload claims** | `sub` (staff ID), `role`, `department_id`, `iat`, `exp` |
| **No PHI in token** | Token must never contain patient data or clinical information |

### 1.3 Refresh Token

| Property | Value |
|:---|:---|
| **Format** | Cryptographically random opaque string (256-bit) |
| **Storage** | httpOnly, Secure, SameSite=Strict cookie + hashed in `refresh_tokens` table |
| **Lifetime** | 7 days (configurable) |
| **Rotation** | New refresh token issued on each use; old one invalidated |
| **Revocation** | Immediate on logout, password change, role change, suspicion |

### 1.4 MFA Readiness

MFA is not implemented in MVP but the architecture supports it:
- `staff.mfa_enabled` flag in database
- Auth flow has an extensibility point for TOTP/WebAuthn challenge after password verification
- MFA enforcement can be required per-role (e.g., mandatory for SecurityAdmin)

### 1.5 Session Security

- Sessions bound to: staff ID + IP address + user agent fingerprint
- Failed login attempts: rate-limited (5 failures → 15-minute lockout, configurable)
- Login events logged to audit: `STAFF_LOGIN`, `STAFF_LOGIN_FAILED`
- Session invalidation on: logout, password change, role change, account suspension

---

## 2. Authorization Architecture (RBAC)

### 2.1 Authorization Model

Authorization uses a **role-based access control** model with resource-level scoping.

```text
Staff → Role → Permissions → Resource + Action + Scope
```

### 2.2 Permission Structure

Each permission is a triple: `resource:action:scope`

Example permissions:
- `patient:read:department` — Read patients within own department
- `clinical_record:write:assigned` — Write clinical records for assigned patients
- `audit_event:read:all` — Read all audit events (Security Admin only)

### 2.3 Role-Permission Matrix

| Resource | Action | Physician | Nurse | Pharmacist | LabTech | Receptionist | HospitalAdmin | SecurityAdmin |
|:---|:---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **patient** | read | dept | assigned | limited | limited | all | limited | none |
| **patient** | create | no | no | no | no | yes | no | no |
| **patient** | update | no | no | no | no | yes (demographics) | no | no |
| **clinical_record** | read | dept | assigned | meds_only | orders_only | no | no | no |
| **clinical_record** | write | assigned | assigned (vitals) | no | no | no | no | no |
| **clinical_record** | sign | own_draft | no | no | no | no | no | no |
| **diagnostic_order** | create | yes | no | no | no | no | no | no |
| **diagnostic_result** | read | dept | assigned | meds_related | all | no | no | no |
| **diagnostic_result** | enter | no | no | no | yes | no | no | no |
| **diagnostic_result** | verify | no | no | no | yes (pathologist) | no | no | no |
| **encounter** | create | yes | no | no | no | yes (register) | no | no |
| **encounter** | discharge | yes (own) | no | no | no | no | no | no |
| **appointment** | create | no | no | no | no | yes | no | no |
| **appointment** | cancel | no | no | no | no | yes | no | no |
| **ai_interaction** | invoke | yes | yes (limited) | no | no | no | no | no |
| **staff** | manage | no | no | no | no | no | yes | no |
| **audit_event** | read | no | no | no | no | no | summary | full |
| **break_glass** | activate | yes | yes | no | no | no | no | no |
| **break_glass** | review | no | no | no | no | no | no | yes |

### 2.4 Authorization Enforcement

```text
Request → Auth Middleware (JWT validation)
       → RBAC Middleware (role + permission check)
       → Resource Scope Check (does user have access to THIS specific resource?)
       → Controller Handler
```

- Authorization is enforced at the **API layer** in Express middleware
- UI element visibility is a UX convenience only — **not a security control**
- Authorization checks use the role snapshot from the JWT token
- For critical operations (discharge, sign), a fresh permission check against the database is performed
- Authorization failures are logged as audit events

### 2.5 Break-Glass Access

Break-glass provides emergency access to patient records outside normal authorization scope.

| Property | Value |
|:---|:---|
| **Who can activate** | Physicians, Nurses |
| **Requires** | Written justification (mandatory, cannot be blank) |
| **Grants** | Read-only access to specified patient's records |
| **Expiration** | OPEN — requires security/clinical policy decision (NOT hardcoded) |
| **Audit** | `BREAK_GLASS_ACTIVATED`, `BREAK_GLASS_RECORD_ACCESSED`, `BREAK_GLASS_DEACTIVATED` |
| **Review** | Security Admin reviews all break-glass events |
| **Notification** | `BreakGlassAlert` notification sent to Security Admin on activation |

---

## 3. Encryption Architecture

### 3.1 Data in Transit

| Mechanism | Details |
|:---|:---|
| **HTTPS** | TLS for all client-server communication |
| **API-to-AI Provider** | TLS for all LLM API calls |
| **Internal services** | All communication within the application process (monolith — no network boundary) |

### 3.2 Data at Rest

| Layer | Mechanism |
|:---|:---|
| **Disk encryption** | Full-disk encryption on database volume |
| **Field-level encryption** | Identity document numbers encrypted with pgcrypto |
| **Application-layer encryption** | OCR extracted data, AI raw responses encrypted before DB storage |
| **Password storage** | bcrypt (one-way hash, not encryption) |
| **Refresh tokens** | SHA-256 hash stored (not the raw token) |

### 3.3 Key Management

- Encryption keys stored in environment variables (MVP)
- Key rotation procedure documented but manual for MVP
- Future: secrets management service (e.g., HashiCorp Vault)
- Keys never committed to version control
- Keys never logged

---

## 4. Input Validation & Injection Prevention

### 4.1 API Input Validation

- All request bodies validated with **Zod schemas** at the API boundary
- Validation rejects invalid input — does not attempt to sanitize and proceed
- Validation errors return specific field-level error messages (no internal details)
- Request size limits enforced per endpoint

### 4.2 SQL Injection Prevention

- All database queries use parameterized queries (via ORM/query builder)
- No string concatenation in SQL construction
- Raw SQL queries (if ever needed) must use parameterized placeholders

### 4.3 XSS Prevention

- React's default JSX escaping for output rendering
- Content Security Policy headers
- `dangerouslySetInnerHTML` is prohibited without security review
- User-generated content sanitized before storage

### 4.4 CSRF Protection

- SameSite=Strict cookie attribute for refresh tokens
- CSRF tokens for state-changing operations from browser forms
- API endpoints authenticate via Authorization header (not cookies) — inherently CSRF-resistant

### 4.5 File Upload Security

- File type validation (allowlist: PDF, JPEG, PNG for identity documents)
- File size limits enforced
- File content validation (magic bytes check, not just extension)
- Uploaded files stored outside the web root
- File paths generated by the server (never user-supplied)
- Antivirus scanning deferred to Phase 2 (noted as risk)

---

## 5. AI-Specific Security

### 5.1 Prompt Injection Protection

| Threat | Mitigation |
|:---|:---|
| **Direct prompt injection** | System instructions and user content use clear delimiters; user input is parameterized, not concatenated into system prompts |
| **Indirect prompt injection** (via clinical documents) | Clinical record content is inserted into context with explicit boundary markers; AI output is never auto-executed |
| **Data exfiltration via AI** | AI responses are validated against expected schemas; AI cannot access URLs, send emails, or make external calls |
| **Model overreach** | AI has no tools/function calls that modify state; AI is invoked as a text-in/text-out service only |

### 5.2 AI Data Boundaries

- AI prompts include only the clinical data authorized for the requesting user's role
- AI context construction respects the same RBAC rules as direct data access
- AI raw responses are logged but encrypted at rest
- AI output never treated as trusted — always validated by deterministic code before use
- AI output presented to users with clear "AI-Generated" labeling

### 5.3 AI Operational Controls

- Token usage tracked per interaction and per user
- Rate limiting on AI invocations (per-user, per-minute)
- Maximum context size enforced to prevent excessive API costs
- AI provider API keys scoped to minimum required permissions

---

## 6. Security Headers

| Header | Value |
|:---|:---|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` |
| `Content-Security-Policy` | Restrictive policy (no inline scripts, no external resources without allowlist) |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `X-XSS-Protection` | `0` (CSP is the modern replacement) |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | Disable camera, microphone, geolocation |

---

## 7. Logging Security

| Rule | Enforcement |
|:---|:---|
| PHI never in logs | Log sanitization middleware strips PHI fields before logging |
| Passwords never logged | Request body sanitization removes password fields |
| Tokens never logged | Authorization headers redacted in request logs |
| Error details not exposed to client | Full error logged server-side; safe error summary returned to client |
| Audit events separate from operational logs | Different log streams — audit goes to immutable store, ops logs to standard logging |

---

## 8. Dependency Security

- All dependencies pinned to exact versions in lockfile
- `npm audit` run in CI pipeline — builds fail on critical vulnerabilities
- Dependency update review includes changelog and security advisory check
- Minimal dependency footprint per Ponytail discipline
