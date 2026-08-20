# Hospital AI OS — Role-Based Access Control (RBAC) Specification

> **Status:** NORMALIZED — Phase 2.1 Specification  
> **Authority:** Security & Healthcare Safety Rules  
> **Scope:** Conceptual RBAC model, role permissions, and segregation of duties rules.

---

## 1. Conceptual Role Permission Model

```text
ROLE + ASSIGNMENT + SCOPE + PERMISSION + APPROVAL AUTHORITY + DATA VISIBILITY
```

| Role Concept           | Clinical Read  | Clinical Order | Lab Verification |  User Admin   | Break-Glass Eligible |
| :--------------------- | :------------: | :------------: | :--------------: | :-----------: | :------------------: |
| **Physician / Doctor** |      YES       |      YES       |       VIEW       |      NO       |         YES          |
| **Staff Nurse**        |    ASSIGNED    |       NO       |       VIEW       |      NO       |         YES          |
| **Pharmacist**         |  MED_RELEVANT  |       NO       |       VIEW       |      NO       |          NO          |
| **Lab Technician**     |  ORDER_REASON  |       NO       |       YES        |      NO       |          NO          |
| **Receptionist**       |       NO       |       NO       |        NO        |      NO       |          NO          |
| **Hospital Admin**     |       NO       |       NO       |        NO        |      YES      |          NO          |
| **Security Admin**     | NO (Logs Only) |       NO       |        NO        | SECURITY_ONLY |      AUDIT_ONLY      |

_(Note: JWT claim structure, database permission tables, and middleware code implementation are DEFERRED TO PHASE 3 ARCHITECTURE)._

---

## 2. Segregation of Duties (SoD) Principles

1. **Ordering vs Dispensing:** A physician who writes a prescription cannot act as the verifying pharmacist to dispense the medication.
2. **Security Audit vs Clinical Access:** A security administrator reviewing break-glass logs cannot hold clinical permissions to view clinical patient notes directly.
3. **Lab Entry vs Order Signing:** A lab technician entering test values cannot authorize physician diagnostic orders.
