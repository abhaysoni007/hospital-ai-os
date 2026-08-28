# Hospital AI OS — Phase 2 Break-Glass & Security Operations Plan

> **Status:** Architecture Blueprint
> **Authority:** Forensic Analysis, Security Architecture
> **Scope:** Break-Glass Emergency Access, Security Operations Review

---

## 1. Forensic Findings

An analysis of the existing repository yielded the following findings:
- **Authorization Engine:** M5 static RBAC is implemented and verified.
- **Permissions:** `break_glass:activate` is already granted to `physician` and `nurse`. `break_glass:review` is granted to `security_admin`.
- **Database:** There is **no** existing `break_glass_sessions` table.
- **Audit Logging:** Robust cryptographic hash-chain (`audit_events`) is implemented and verified.
- **Frontend:** `apps/frontend/src/app/admin/security/page.tsx` is an honest stub explicitly noting that "Emergency access review — coming in a future release".
- **Notifications:** `break_glass_alert` is a valid `notification_type` in `enums.ts`.

---

## 2. Existing Infrastructure

- **Stateless Tokens:** Authentication is JWT-based, meaning sessions do not hit the database on every request.
- **Fail-Closed M5:** `policy-engine.ts` handles Role-to-Permission mapping deterministically.
- **Deferred Scoping (M6+):** `departmentId` and assignment logic is currently enforced downstream at the service level, after M5 permission checks. Break-glass must integrate at this M6 layer.

---

## 3. Domain Model

A Break-Glass Session represents a temporary, strictly bounded override of standard M6 resource scoping rules.

A new schema `break_glass_sessions` must be introduced, as the existing `audit_events` cannot represent lifecycle state.

**Fields:**
- `id`: UUID (Primary Key)
- `actorId`: UUID (References `staff.id`)
- `patientId`: UUID (References `patients.id`)
- `encounterId`: UUID (Optional, References `encounters.id`)
- `reason`: Enum (`emergency_care`, `patient_safety`, `continuity_of_care`)
- `justification`: Text (Free-form, minimum 20 characters)
- `activatedAt`: Timestamp (TZ)
- `expiresAt`: Timestamp (TZ)
- `revokedAt`: Timestamp (TZ, Optional)
- `reviewedAt`: Timestamp (TZ, Optional)
- `reviewedBy`: UUID (Optional, References `staff.id`)

---

## 4. Lifecycle

We do **not** invent unnecessary status columns. State is dynamically derived:

- **Active:** `now() >= activatedAt AND now() < expiresAt AND revokedAt IS NULL`
- **Expired:** `now() >= expiresAt`
- **Revoked:** `revokedAt IS NOT NULL`
- **Reviewed:** `reviewedAt IS NOT NULL`

---

## 5. Activation

**Endpoint:** `POST /api/v1/break-glass/sessions`

**Client Payload:**
```json
{
  "patientId": "uuid",
  "encounterId": "uuid", // Optional
  "reason": "emergency_care",
  "justification": "Patient arrived unconscious in ER, requires immediate access to prior diagnostic history."
}
```

**Server Derivations (Client MUST NEVER control):**
- `actorId` = Extracted from M4 AuthContext (`req.user.id`).
- `activatedAt` = `now()`.
- `expiresAt` = `now() + 4 hours` (hard time boundary).
- Approval State = Server automatically creates as active.

---

## 6. Scope

Break-glass must be narrowly scoped. Broad list/search access is forbidden.

- **Required Scope:** Access is strictly limited to the specific `patientId` (and optionally `encounterId`) specified in the activation payload.
- **Allowed Access (Read-Only):**
  - Patient Demographics
  - Clinical Records & Notes
  - Diagnostic Orders & Results
  - Encounters
- **Forbidden Actions (Even under Break-Glass):**
  - Clinical writing, signing, or discharging
  - Creating or cancelling diagnostic orders
  - Accessing staff credentials or security configuration
  - Altering roles or tampering with audit logs

---

## 7. Time Boundary

- **Max Duration:** 4 hours.
- **Expiry Semantics:** Expiry is calculated dynamically via `now() >= expiresAt`.
- **Automatic Expiry:** No background daemon or cron job is needed to transition state. The database query simply excludes expired sessions.
- **Timezone:** UTC timestamps strictly enforced.

---

## 8. Audit

Every action must be fully attributable.

**System Events (in `audit_events`):**
- `BREAK_GLASS_ACTIVATED`: Created upon activation.
- `BREAK_GLASS_REVOKED`: Created if manually revoked.
- `BREAK_GLASS_REVIEWED`: Created when Security Admin reviews.

**Access Events:**
When an actor accesses clinical data using a break-glass override, the standard audit event (e.g., `CLINICAL_RECORD_READ`) is generated, but `actionDetail` MUST include:
```json
{
  "break_glass_session_id": "uuid"
}
```

This ensures hash-chain continuity remains intact without leaking PHI.

---

## 9. Security Admin Review

Security Admin capabilities:
- **Can view:** List of all break-glass sessions.
- **Can review:** Read the justification provided by the clinician.
- **Can revoke:** Immediately terminate an active break-glass session.
- **Can mark:** Acknowledge/Mark the session as "Reviewed".
- **Cannot access clinical data:** Security Admins cannot bypass clinical authorization to read the patient's chart, even during review.

---

## 10. Concurrency

- **Two simultaneous activations:** A database unique constraint (or partial index on `(actorId, patientId) WHERE now() < expiresAt AND revokedAt IS NULL`) will prevent duplicate active sessions.
- **Race conditions (Access vs Expiry/Revoke):** Since expiry is derived dynamically at the exact time of the authorization check, the boundary is deterministic.

---

## 11. RBAC

No M5 modifications are required. The current static RBAC matrix in `permissions.ts` is fully sufficient:
- `physician`, `nurse` → `break_glass:activate`
- `security_admin` → `break_glass:review`

If another role requires emergency access in the future, it will be a deliberate architecture change.

---

## 12. API

Minimal API Surface:

- `POST /api/v1/break-glass/sessions` (Activate)
- `GET /api/v1/break-glass/sessions` (List all sessions, for Security Admin)
- `GET /api/v1/break-glass/sessions/active` (Get current actor's active sessions)
- `POST /api/v1/break-glass/sessions/:id/revoke` (Revoke, Security Admin)
- `POST /api/v1/break-glass/sessions/:id/review` (Mark reviewed, Security Admin)

---

## 13. Authorization Integration

Break-glass logic integrates at the **M6 Resource Scope layer**, NOT the authentication or global RBAC layer.

**Conceptual Flow:**
1. Request arrives.
2. M4 validates JWT (`req.user`).
3. M5 verifies role possesses static permission (e.g., `clinical_record:read`). If DENIED, stop.
4. M6 checks resource scope (e.g., "Is patient in physician's department?").
5. **If M6 DENIES:**
   - Query `break_glass_sessions` for an active session matching `req.user.id` and the requested resource's `patientId`.
   - If Active (not expired, not revoked) → ALLOW.
   - If not found or expired → DENIED.

---

## 14. PHI

- The `break_glass_sessions` table stores UUIDs (`patientId`, `actorId`), NOT patient names or MRNs.
- The `justification` field may contain situational PHI (e.g., "Patient in cardiac arrest"). It is protected under standard database encryption and restricted to Security Admin review.
- The `audit_events` table continues to avoid unstructured PHI logging.

---

## 15. Frontend

**Integration Points:**
1. **Access Denial Interception:** If a clinician attempts to view a patient chart outside their normal scope, the UI displays a clear "Access Denied" state with a prominent, visually distinct "Emergency Access (Break Glass)" button.
2. **Visual Warning:** The break-glass activation modal explicitly warns: "This grants temporary emergency access and is fully audited."
3. **Active Session Banner:** When viewing a patient under break-glass, a persistent banner remains visible.
4. **Security Admin Console:** `app/admin/security/page.tsx` will be replaced with a dashboard listing pending break-glass reviews.

---

## 16. Demo Data

- **DEMO-BREAKGLASS-001:** 
  - Physician attempts to view out-of-department patient.
  - Normal access DENIED.
  - Physician activates emergency access.
  - Limited patient context accessible.
  - Access audited.
- **DEMO-BREAKGLASS-REVIEW-001:**
  - Security admin logs in.
  - Navigates to security console.
  - Reviews the event generated by DEMO-BREAKGLASS-001.

---

## 17. Testing

**Critical Proofs:**
- Normal out-of-scope access: **DENIED**.
- Active break-glass session for specific patient: **ALLOWED** (for clinical reads).
- Active break-glass session for specific patient: **DENIED** (for clinical writes/signing).
- Access after 4-hour expiry: **DENIED**.
- Access to a different patient during active session: **DENIED**.
- Security admin reviewing session: **CAN REVIEW**.
- Security admin attempting to view patient chart from review console: **DENIED**.

---

## 18. Deferred

- Enterprise identity federation
- SSO
- MFA redesign
- SIEM integration
- Anomaly / Automated fraud detection
- Enterprise security analytics
- Policy engine overhaul
- M20 administration

---

## 19. Architecture Verdict

**FINAL VERDICT: READY FOR IMPLEMENTATION**
