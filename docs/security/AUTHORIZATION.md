# Hospital AI OS — Authorization & Security Specification

> **Status:** NORMALIZED — Phase 2.1 Specification  
> **Authority:** Security & Healthcare Safety Rules  
> **Scope:** Conceptual authorization model, scope hierarchy, data visibility, and emergency break-glass policy boundaries.

---

## 1. Conceptual Authorization Model

Hospital AI OS enforces a multi-dimensional conceptual authorization model:

```text
Role (e.g., Doctor, Nurse, Receptionist)
  + Assignment (Hospital, Department)
    + Scope (Hospital-wide, Department-level, Patient-level, Assigned Patient)
      + Permission (Read, Write, Order, Approve, Export)
        + Approval Authority (Direct Execution, Review Required, Mandatory Approval)
          + Data Visibility Filters (Demographics, Clinical Notes, Meds, Labs, Audit)
```

### 1.1 Scope Hierarchy Definitions
1. **System-Wide Scope:** System Administrators and Security Administrators for global platform management and security monitoring. Zero direct clinical patient data access.
2. **Hospital-Wide Scope:** Hospital Administrators and Department Leads for facility-level operational oversight.
3. **Department-Level Scope:** Department Heads and Receptionists for department-wide queue and task management.
4. **Assigned-Patient Scope:** Physicians and Nurses actively assigned to an active encounter. Grants access to clinical records for the assigned patient.
5. **Emergency Break-Glass Scope:** Temporary elevated access granted upon explicit emergency declaration, enabling clinical record access outside standard assigned scope.

---

## 2. Data Visibility & Security Requirements

> [!IMPORTANT]
> **Product & Security Requirements:**
> 1. Protected Health Information (PHI) and Personally Identifiable Information (PII) must be protected in transit and at rest.
> 2. Authorization checks must be enforced at the API layer independently of UI state.
> 3. Minimum necessary access scope must be strictly applied per role.
> 4. All elevated access activations and sensitive data reads must generate immutable, tamper-evident audit records.

| Role | Demographics & Contact | Sensitive Clinical Notes | Active Medications | Lab & Diagnostic Results | Security & Audit Logs |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Doctor** | Read / Write | Full Access | Full Access | Full Access | None |
| **Nurse** | Read Only | Assigned Patients | Full Access | Full Access | None |
| **Pharmacist** | Read Only | Med-Relevant Notes | Full Access | Med-Relevant Labs | None |
| **Lab Tech** | Read Only | Order Reason Only | None | Full Access | None |
| **Receptionist**| Full Access | **RESTRICTED** | **RESTRICTED** | **RESTRICTED** | None |
| **Security Admin**| Read Only | **RESTRICTED (Logs Only)**| **RESTRICTED** | **RESTRICTED** | **FULL ACCESS** |

*(Note: Specific encryption algorithms, TLS protocol versions, and token storage mechanisms are DEFERRED TO PHASE 3 ARCHITECTURE).*

---

## 3. Emergency Break-Glass Access Policy

In clinical emergencies (e.g., ER trauma patient unable to consent, code blue in unassigned ward), licensed physicians may activate **Break-Glass Access** to view unassigned patient records.

```text
Clinician Requests Access to Unassigned Patient
                  ↓
System Prompts for Mandatory Emergency Justification Reason
                  ↓
Clinician Enters Mandatory Clinical Rationale
                  ↓
System Grants Temporary Elevated Access
                  ↓
Instant Security Alert Dispatched to Security Console
                  ↓
Immutable Audit Event Recorded (Who, Target, Reason, Timestamp)
                  ↓
Automated Policy Expiration + Post-Incident Audit Review
```

### 3.1 Break-Glass Policy Parameters
- **Eligible Roles:** Licensed Physicians and Charge Nurses only.
- **Mandatory Inputs:** Clinical emergency justification code plus rationale text.
- **Audit Logging:** Logs `actor_id`, `patient_id`, `justification`, `timestamp`, `granted_scope`.
- **Security Alert:** Generates instant alert dispatched to Security Administrator.
- **Expiration Window:** `OPEN — requires security/clinical policy decision` *(Specific expiration duration to be confirmed during facility security policy configuration; deferred from hardcoded defaults).*
- **Audit Review:** Security Administrator must review and sign off on break-glass audit logs post-incident.
