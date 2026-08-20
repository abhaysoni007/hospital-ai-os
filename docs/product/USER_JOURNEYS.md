# Hospital AI OS — End-to-End Patient Journeys & User Flow Maps

> **Status:** LOCKED — Phase 2 Specification  
> **Authority:** Product Management & Healthcare Safety Rules  
> **Scope:** End-to-end patient journey mapping, alternate clinical paths, and textual user flows with explicit Human/AI boundaries.

---

## 1. End-to-End Master Patient Journey

```text
1. DISCOVERY & REGISTRATION (Demographics, ID Verification, EMPI Creation)
       ↓
2. APPOINTMENT SCHEDULING (Doctor Slot Selection, Token Generation)
       ↓
3. PATIENT CHECK-IN (Arrival Confirmation, Vitals Capture, Queue Assignment)
       ↓
4. OPD CLINICAL CONSULTATION (History, Examination, AI Note Drafting, Orders)
       ↓
5. DIAGNOSTICS & LAB WORKFLOW (Specimen Collection, Testing, Verification)
       ↓
6. TREATMENT & PHARMACY DISPENSING (Prescription Review, MAR Entry, Dispensing)
       ↓
7. BILLING & FINANCIAL SETTLEMENT (Charge Capture, Invoice, Payment Clearance)
       ↓
8. DISCHARGE PLANNING (AI Discharge Draft, Doctor Sign-off, Care Instructions)
       ↓
9. FOLLOW-UP & POST-CARE (Follow-up Reminder, Summary Delivery)
```

---

## 2. Alternate Patient Journey Paths

### Path A: Emergency Patient (Fast-Path)
`Triage Entry → Immediate Bed/Bay Assignment → Emergency Break-Glass Record Access → Rapid Order Placement → Stabilized Care → Admission to IPD or Discharge.`

### Path B: Outpatient (OPD) Scheduled Patient (Standard Path)
`Online/Desk Booking → Check-In → Vitals Desk → Doctor Consultation → Pharmacy/Lab → Billing → Home.`

### Path C: Inpatient (IPD) Admission Path
`OPD/ER Decision → Bed Allocation → Ward Admission → Daily Rounds & Care Plan → MAR Administration → Discharge Clearance.`

### Path D: Diagnostic-Only Patient
`Registration → Lab/Radiology Order Entry → Specimen Intake → Analyzer Run → Pathologist Verification → Results Issued.`

---

## 3. Textual User Flow Maps with Human/AI Boundaries

### 3.1 Flow 1: Clinical Consultation & AI Note Drafting
```text
[Human: OPD Doctor] Opens Patient Encounter
        ↓
[System] Fetches & Displays Grounded Historical Context & Vitals
        ↓
[Human: OPD Doctor] Conducts Examination & Speaks/Types Clinical Findings
        ↓
[AI Engine] Generates Side-by-Side Draft SOAP Note + Formats Citations
        ↓
[Human: OPD Doctor] REVIEWS DRAFT → Edits/Accepts Sections → Clicks "Save & Sign"
        ↓
[System] Persists Signed Clinical Record to Database
        ↓
[System] Records Immutable Audit Event (Who, Timestamp, Draft Accepted/Modified)
```

### 3.2 Flow 2: Pharmacy Prescription Review & Dispensing
```text
[Human: Doctor] Prescribes Drug in Clinical Workspace
        ↓
[System] Validates Drug Code Against Pharmacological Formulary
        ↓
[AI Engine] Cross-Checks Active Meds & Allergies → Calculates Risk Score
        ├── Low Risk ──→ Green Badge: "No Interaction Detected"
        └── High Risk ─→ Red Alert: "Potential Drug Interaction Flagged"
        ↓
[Human: Pharmacist] Reviews Prescription + AI Interaction Alert
        ↓
[Human: Pharmacist] Approves Dispensing OR Rejects Back to Doctor
        ↓
[System] Decrements Pharmacy Stock & Records MAR Dose Entry
        ↓
[System] Records Audit Event (Prescription Verified & Dispensed)
```

### 3.3 Flow 3: Discharge Summary Drafting & Approval
```text
[Human: Doctor] Triggers "Initiate Discharge" for Inpatient Encounter
        ↓
[AI Engine] Aggregates All Encounter Notes, Vitals, Labs, Medications
        ↓
[AI Engine] Generates Structured Draft Discharge Summary
        ↓
[Human: Doctor] Reviews Draft Summary Side-by-Side against Source Records
        ↓
[Human: Doctor] Modifies Care Instructions → Signs Discharge Document
        ↓
[Human: Nurse] Verifies Medication Reconcilement & Hands Instructions to Patient
        ↓
[Human: Billing Clerk] Confirms Payment Clearance & Issues Discharge Lock Release
        ↓
[System] Updates Encounter State to DISCHARGED & Records Audit Trail
```
