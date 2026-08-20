# Hospital AI OS — AI Failure Modes & Degraded Operations

> **Status:** NORMALIZED — Phase 2.1 Specification  
> **Authority:** AI Rules & Healthcare Safety Rules  
> **Scope:** Product principles for AI failure handling, degraded mode operations, and fail-safe continuity.

---

## 1. Product Principle for Degraded Operations

> **Core Requirement:** Core hospital workflows (patient registration, clinical documentation, lab review, discharge authorization) must remain fully operational when AI services are unavailable, slow, or degraded.

```text
AI Unavailable / Degradation Detected
                 ↓
Core Workflows Continue Manually
                 ↓
AI-Dependent Features Fail Safely (Disable Draft Buttons)
                 ↓
User Informed via Clear UI Notification
                 ↓
No Data Loss & No Unauthorized State Changes
                 ↓
System Recovery is Observable
```

---

## 2. Failure Mode Behavior Rules

1. **Fail Safe:** AI failure must never cause application crashes, missing records, or unhandled exceptions.
2. **Safe Feature Disabling:** When AI is offline, AI draft generation buttons are safely disabled; standard manual text editors and search bars remain active.
3. **Data Integrity Preserved:** All manual inputs committed during degraded operations remain fully authoritative.
4. **User Communication:** The system clearly informs users when AI capabilities are temporarily offline without impeding manual care delivery.

*(Note: Specific timeout values, retry counts, backoff algorithms, and health-check polling frequencies are DEFERRED TO PHASE 3 ARCHITECTURE).*
