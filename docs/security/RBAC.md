# Hospital AI OS — Role-Based Access Control (RBAC) Specification

> **Status:** LOCKED — Phase 2 Specification  
> **Authority:** Security & Healthcare Safety Rules  
> **Scope:** Conceptual RBAC matrix, permission definitions, and role separation rules.

---

## 1. Role Permission Matrix

| Role Code | Role Name | Clinical Read | Clinical Order | Medication MAR | Lab Verify | Bill Create | User Admin | Break-Glass |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `ROLE_DOCTOR` | Physician | YES | YES | VIEW | VIEW | NO | NO | YES |
| `ROLE_NURSE` | Staff Nurse | ASSIGNED | NO | YES | VIEW | NO | NO | YES |
| `ROLE_PHARMACIST` | Pharmacist | MED_ONLY | NO | DISPENSE | VIEW | DRUG_ONLY | NO | NO |
| `ROLE_LAB_TECH` | Lab Technician | ORDER_REASON | NO | NO | YES | NO | NO | NO |
| `ROLE_RECEPTION` | Receptionist | NO | NO | NO | NO | NO | NO | NO |
| `ROLE_BILLING` | Billing Clerk | NO | NO | NO | NO | YES | NO | NO |
| `ROLE_HOSP_ADMIN`| Hospital Admin| NO | NO | NO | NO | REPORTS | YES | NO |
| `ROLE_SEC_ADMIN` | Security Admin | NO | NO | NO | NO | NO | ROLES | AUDIT_ONLY |

---

## 2. Segregation of Duties (SoD) Rules

To maintain security and clinical safety, the following dual-role combinations are strictly prohibited:

1. `ROLE_DOCTOR` + `ROLE_PHARMACIST`: A physician who writes a prescription cannot act as the verifying pharmacist to dispense the medication.
2. `ROLE_BILLING` + `ROLE_DOCTOR`: A physician writing clinical orders cannot generate and process their own billing payments.
3. `ROLE_SEC_ADMIN` + `ROLE_DOCTOR`: A security admin who reviews break-glass access logs cannot hold clinical permissions to activate break-glass for patient data.
4. `ROLE_LAB_TECH` + `ROLE_DOCTOR`: A lab technician entering test results cannot authorize physician orders for those tests.
