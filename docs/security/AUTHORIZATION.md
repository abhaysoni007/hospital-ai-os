# Hospital AI OS — Authorization & Security Specification

> **Status:** LOCKED — Phase 2 Specification  
> **Authority:** Security & Healthcare Safety Rules  
> **Scope:** Conceptual authorization model, scope hierarchy, data visibility, and emergency break-glass protocol.

---

## 1. Conceptual Authorization Model

Hospital AI OS enforces a multi-dimensional authorization model:

```text
Role (e.g., Doctor, Nurse, Billing Clerk)
  → Scope (Hospital, Department, Patient, Assigned Patient)
    → Permissions (Read, Write, Order, Approve, Dispense, Export)
      → Data Visibility Filters (Demographics, Clinical, Meds, Labs, Billing, Audit)
        → Action Execution Authority (Direct, Review Required, Approval Mandatory)
```

### 1.1 Scope Hierarchy Definitions
1. **System-Wide Scope:** Reserved for System Administrators and Security Administrators for global platform management and security monitoring. Zero direct clinical patient data access.
2. **Hospital-Wide Scope:** Assigned to Hospital Administrators and Chief Medical Officers for facility-level operational oversight.
3. **Department-Level Scope:** Assigned to Department Heads, OPD Receptionists, and Pharmacy Leads for department-wide queue and task management.
4. **Assigned-Patient Scope:** Assigned to Physicians and Ward Nurses actively assigned to an active encounter (OPD consultation, Ward bed, or ER bay). Grants access to full clinical records for the assigned patient.
5. **Emergency Break-Glass Scope:** Temporary elevated access granted upon explicit emergency declaration, enabling clinical record access outside standard assigned scope.

---

## 2. Data Visibility & Access Boundaries

| Role | Demographics & Contact | Sensitive Clinical Notes | Medications & MAR | Lab & Diagnostic Results | Billing & Financials | Security & Audit Logs |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Doctor** | Read / Write | Full Access | Full Access | Full Access | Service Names Only | None |
| **Nurse** | Read Only | Assigned Patients | Full Access | Full Access | None | None |
| **Pharmacist** | Read Only | Med-Relevant Notes | Full Access | Med-Relevant Labs | Drug Costs Only | None |
| **Lab Tech** | Read Only | Order Reason Only | None | Full Access | None | None |
| **Receptionist**| Full Access | **BLOCKED** | **BLOCKED** | **BLOCKED** | Basic Invoice | None |
| **Billing Clerk**| Full Access | **BLOCKED** | Dispensed Items | Rendered Services | Full Access | None |
| **System Admin** | Read Only | **BLOCKED** | **BLOCKED** | **BLOCKED** | None | System Metrics |
| **Security Admin**| Read Only | **BLOCKED** | **BLOCKED** | **BLOCKED** | None | **FULL ACCESS** |

---

## 3. Emergency Break-Glass Access Protocol

In clinical emergencies (e.g., ER trauma patient unable to consent, code blue in unassigned ward), clinicians may activate **Break-Glass Access** to view unassigned patient records.

```text
Clinician Requests Access to Unassigned Patient
                  ↓
System Prompts for Mandatory Emergency Justification Reason
                  ↓
Clinician Selects Category + Enters Clinical Rationale (min 15 chars)
                  ↓
System Grants Temporary Elevated Access (Default: Max 4 Hours)
                  ↓
Instant Security Alert Dispatched to Security Admin & Department Head
                  ↓
Immutable Audit Event Recorded (Who, Target, Reason, Timestamp, Duration)
                  ↓
Automatic Expiration at 4 Hours + Mandatory Post-Incident Audit Review
```

### 3.1 Break-Glass Rules & Boundaries
- **Who Can Activate:** Licensed Doctors and Charge Nurses only.
- **Mandatory Inputs:** Clinical emergency justification code (e.g., `UNCONSCIOUS_TRAUMA`, `CODE_BLUE_OVERRIDE`, `CROSS_DEPT_CONSULT_EMERGENCY`) plus free-text explanation.
- **Audit Logging:** Logs `actor_id`, `patient_id`, `justification`, `timestamp`, `ip_address`, `granted_duration`.
- **Duration:** Exactly **4 hours maximum**, with automatic revocation upon expiration.
- **Review:** Security Administrator must review and sign off on all break-glass logs within 24 hours. Unjustified break-glass access triggers administrative disciplinary escalation.
