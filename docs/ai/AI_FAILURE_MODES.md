# Hospital AI OS — AI Failure Modes & Degraded Operations

> **Status:** LOCKED — Phase 2 Specification  
> **Authority:** AI Rules & Healthcare Safety Rules  
> **Scope:** Handling AI service outages, database disconnections, network degradation, and emergency fallback operations.

---

## 1. System Failure Matrix & Degraded Behaviors

The hospital operating system must remain fully operational for core clinical and administrative tasks even when AI components fail completely.

| Failure Scenario | Affected Features | Fallback Behavior | System Impact | Incident Log |
| :--- | :--- | :--- | :--- | :--- |
| **Complete AI Outage** | Search, Note Drafting, Summarization | Fallback to traditional manual note entry, keyword search, standard EMR forms. | Low (Features degraded, core workflows active) | High-Priority System Alert |
| **AI Timeout / High Latency** | AI Search & Note Drafting | Automatic timeout at 5 seconds; display "AI service busy — switch to manual note". | Minimal | Latency Warning Logged |
| **Database Unavailable** | All System Features | Read-only local cache mode for emergency record viewing; block writes. | Critical | Immediate Critical Alert |
| **External Integration Fail**| Lab/Pharmacy Gateway | Queue outgoing integration messages for retry; notify user of external delay. | Medium | Integration Error Logged |
| **Network Degradation** | Client UI Connectivity | Queue offline client actions locally; sync upon reconnection with version checks. | Medium | Network Sync Logged |

---

## 2. Emergency Manual Operating Protocol

```text
AI Service Failure Detected (3 consecutive timeouts or HTTP 5xx)
                               ↓
System Automatically Switches to DEGRADED_MANUAL_MODE
                               ↓
UI Banner Displays: "AI Features Temporarily Offline — Core EMR Active"
                               ↓
All AI Draft Buttons Disabled → Standard Manual Text Editors Activated
                               ↓
Core Clinical Ordering, MAR, Vitals, Dispensing & Billing Continue Manually
                               ↓
Zero Data Corruption / Zero Clinical Interruption
                               ↓
AI Background Health Checker Polls Service → Restores AI upon 5 Clean Health Checks
```

### 2.1 Degraded Mode Principles
1. **Safety First:** AI failure MUST NEVER cause app crashes, missing records, or unhandled exceptions.
2. **Uninterrupted Care:** Doctors must be able to document visits manually, prescribe drugs, and review lab results without relying on AI services.
3. **Data Integrity Preserved:** All manual inputs committed during degraded mode remain authoritative.
