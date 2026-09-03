# Hospital Operational Risk & Pattern Analytics Plugin

> [!IMPORTANT]
> **STANDALONE NOTICE**  
> **This plugin is currently standalone and is NOT integrated into Hospital AI OS.**  
> It is an experimental, self-contained analytical sidecar designed to provide optional operational risk scoring, bottleneck factor attribution, and workload pattern detection without altering or connecting directly to the production Hospital AI OS database.

---

## 1. Purpose

The **Hospital Operational Risk & Pattern Analytics Plugin** provides analytical intelligence around operational workflow bottlenecks.

### What it DOES:
- Evaluates operational bottleneck risks across hospital workflows (diagnostic order queues, critical notification response times, documentation delays).
- Identifies and ranks contributing operational factors.
- Provides transparent factor attribution and plain-language explanations of why a risk score was produced.
- Evaluates non-linear operational congestion using a lightweight, explainable ML classifier.
- Returns structured JSON outputs conforming to Hospital AI OS M19 architecture contracts.

### What it NEVER does (Strict Clinical Safety Boundaries):
- **NEVER** diagnoses patients.
- **NEVER** recommends medical treatment or prescribes medication.
- **NEVER** suggests or authorizes patient discharge.
- **NEVER** mutates clinical records or hospital database state.
- **NEVER** bypasses RBAC or breaks glass.
- **NEVER** ingests Protected Health Information (PHI) or raw clinical notes.

---

## 2. Architecture Position

The intended future integration architecture is:

```text
┌─────────────────────────────────────────────────────────┐
│                     Hospital AI OS                      │
│   (Encounters, Diagnostic Orders, Notifications, RBAC)  │
└────────────────────────────┬────────────────────────────┘
                             │ authorized operational features
                             │ (non-identifying UUIDs, queue counts)
                             ▼
┌─────────────────────────────────────────────────────────┐
│             Python Analytics Plugin (Sidecar)           │
│                    POST /analyze                        │
│  ┌───────────────────────────────────────────────────┐  │
│  │ Layer 1: Deterministic Operational Scoring        │  │
│  │ Layer 2: Explainable Logistic ML Calibrator       │  │
│  │ Layer 3: Factor Attribution & Explainability      │  │
│  │ Layer 4: Privacy & Safety Guardrails             │  │
│  └───────────────────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────┘
                             │ structured risk analysis
                             │ (risk_score, factors, confidence, limitations)
                             ▼
┌─────────────────────────────────────────────────────────┐
│               Hospital Intelligence Layer               │
│        (M19 Signal Engine & Human Approval Center)      │
└────────────────────────────┬────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────┐
│                 Existing AI / LLM Layer                 │
│              (Bounded Explanation Pipeline)             │
└─────────────────────────────────────────────────────────┘
```

The Python plugin remains a decoupled analytical sidecar with no database access.

---

## 3. Installation & Local Execution

### Prerequisites
- Python 3.12+ (Python 3.14 compatible)
- pip
- Docker (optional, for containerized execution)

### Option A: Local Python Environment

1. Navigate to the plugin directory:
   ```bash
   cd services/hospital-analytics
   ```

2. Create and activate a virtual environment:
   ```bash
   python -m venv .venv
   # Windows (PowerShell):
   .\.venv\Scripts\Activate.ps1
   # Linux / macOS:
   source .venv/bin/activate
   ```

3. Install dependencies:
   ```bash
   pip install -e ".[dev]"
   ```

4. Run unit tests:
   ```bash
   python -m pytest tests/ -v
   ```

5. Start the development server:
   ```bash
   uvicorn hospital_analytics.api.app:app --host 0.0.0.0 --port 8001 --reload
   ```

6. Open interactive API docs:
   - Swagger UI: `http://localhost:8001/docs`
   - ReDoc: `http://localhost:8001/redoc`

### Option B: Docker Container

1. Build the Docker image:
   ```bash
   cd services/hospital-analytics
   docker build -t hospital-analytics-plugin .
   ```

2. Run the container:
   ```bash
   docker run -p 8001:8001 hospital-analytics-plugin
   ```

3. Verify health:
   ```bash
   curl http://localhost:8001/health
   ```

---

## 4. API Endpoints

### 1. `GET /health`
Verifies service uptime and ML model status.
- **Response `200 OK`**:
  ```json
  {
    "status": "ok",
    "service": "hospital-analytics-plugin",
    "version": "0.1.0",
    "ml_model_loaded": true
  }
  ```

### 2. `GET /metadata`
Exposes the active algorithm version, experimental scoring weights, SLA thresholds, and safety disclaimers.

### 3. `POST /analyze`
Primary analytics endpoint. Accepts structured operational metrics and signals, and returns risk analysis with explainable factor attribution.

---

## 5. Input & Output Contracts (M19 Aligned)

### Input Contract (`POST /analyze`)
```json
{
  "analysis_id": "550e8400-e29b-41d4-a716-446655440000",
  "correlation_id": "c9bf9e57-1685-4c89-bafb-ff5af830be8a",
  "scope": "department",
  "department_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "signals": [
    {
      "signal_id": "d290f1ee-6c54-4b01-90e6-d701748f0851",
      "signal_type": "PENDING_DIAGNOSTIC_RESULT",
      "severity": "HIGH",
      "age_minutes": 240.0,
      "metadata": { "priority": "STAT" }
    },
    {
      "signal_id": "e301f2ff-7d65-4c12-a1f7-e812859f1962",
      "signal_type": "CRITICAL_RESULT_UNACKNOWLEDGED",
      "severity": "CRITICAL",
      "age_minutes": 45.0,
      "metadata": { "alert_type": "PANIC_VALUE" }
    }
  ],
  "operational_features": {
    "active_encounters": 24,
    "pending_diagnostic_orders": 8,
    "unacknowledged_critical_results": 1,
    "encounters_without_clinical_record": 4,
    "stalled_orders_over_sla": 3,
    "average_pending_age_minutes": 135.5
  }
}
```

### Privacy Guarantee
The service enforces a strict privacy gate:
- Rejects any payload containing patient names, dates of birth, SSNs, MRNs, phone numbers, or free-form clinical narrative texts.
- Accepts non-identifying UUIDs only.

### Output Contract
```json
{
  "analysis_id": "550e8400-e29b-41d4-a716-446655440000",
  "correlation_id": "c9bf9e57-1685-4c89-bafb-ff5af830be8a",
  "timestamp": "2026-09-04T01:10:00.000000+00:00",
  "risk_score": 0.4463,
  "risk_level": "MEDIUM",
  "confidence": 0.88,
  "factors": [
    {
      "name": "unacknowledged_critical_results",
      "contribution": 0.1562,
      "observed_value": 1,
      "description": "1 critical diagnostic alerts awaiting clinical acknowledgment"
    },
    {
      "name": "stalled_orders_over_sla",
      "contribution": 0.1465,
      "observed_value": 3,
      "description": "3 diagnostic orders exceeding turnaround SLA"
    },
    {
      "name": "encounters_without_clinical_record",
      "contribution": 0.1046,
      "observed_value": 4,
      "description": "4 encounters without timely clinical documentation"
    },
    {
      "name": "signal_age_escalation",
      "contribution": 0.0488,
      "observed_value": 240.0,
      "description": "Maximum pending signal age of 240.0 minutes"
    },
    {
      "name": "active_encounters_load",
      "contribution": 0.0469,
      "observed_value": 24,
      "description": "24 active encounters contributing to department volume"
    }
  ],
  "analysis_type": "operational_bottleneck",
  "model_info": {
    "engine": "hybrid_deterministic_linear",
    "ml_enabled": true,
    "algorithm_version": "v1.0.0-experimental",
    "training_provenance": "SYNTHETIC-DATASET-V1"
  },
  "limitations": [
    "Operational analytics only; NOT clinically validated.",
    "Must NOT be used for patient diagnosis, treatment, or clinical triage.",
    "Non-clinical operational workflow bottleneck monitoring only.",
    "Weights and scores are experimental heuristics based on synthetic operational baselines."
  ]
}
```

---

## 6. Analytics Approach & Algorithm

### Layer 1: Deterministic Feature Scoring
Calculates risk score $\in [0.0, 1.0]$ based on normalized operational factors:
1. **Unacknowledged Critical Results** ($w = 0.35$): Highest weight; unacknowledged panic alerts directly jeopardize workflow continuity.
2. **Stalled Orders Over SLA** ($w = 0.25$): Diagnostic orders pending past turnaround thresholds.
3. **Encounters Without Clinical Documentation** ($w = 0.20$): Backlogged clinical progress notes.
4. **Active Department Workload Load** ($w = 0.10$): Volume saturation relative to baseline capacity.
5. **Signal Age Escalation** ($w = 0.10$): Severity growth for prolonged unaddressed signals.

*Note: These weights are documented as **experimental operational analytics weights** and are NOT clinically validated.*

### Layer 2: Explainable Machine Learning (Logistic Calibrator)
- A calibrated Logistic Regression classifier trained on synthetic operational traces.
- Predicts non-linear operational bottleneck probability $P(\text{bottleneck} = 1)$.
- Extracts standardized feature coefficients for explainability.
- **Fail-Safe Fallback**: If the ML model fails or is uninitialized, the engine transparently falls back to pure deterministic scoring without dropping requests.

### Layer 3: Hybrid Explainability & Factor Ranking
- Combines deterministic and ML probability into a calibrated score:
  $$\text{Final Score} = 0.65 \times \text{Score}_{\text{deterministic}} + 0.35 \times P_{\text{ML}}$$
- Ranks contributing factors in descending order of contribution.
- Produces plain-language descriptions of each factor driver.

---

## 7. Synthetic Data Disclaimer

> **DISCLAIMER:**  
> All sample datasets and training benchmarks in `examples/` are **SYNTHETIC — NOT CLINICAL DATA**.  
> They do not represent real-world patient records, clinical outcomes, or verified hospital operational benchmarks.

---

## 8. Future Integration Proposal

When the core Hospital AI OS team decides to integrate this plugin, the following design is recommended:

```text
Hospital AI OS Backend (Node.js/TypeScript)
      │
      ▼
Authorized Adapter: HospitalAnalyticsClient
      │
      ├── Enforces RBAC ('intelligence:analyze' permission)
      ├── Filters and aggregates operational metrics (zero PHI)
      ├── Applies timeout: 3000ms
      ├── Circuit breaker (fallback to pure deterministic SQL on failure)
      │
      ▼
POST http://hospital-analytics:8001/analyze
      │
      ▼
Python Analytics Plugin
```

### Security & Authentication
- Mutual TLS (mTLS) or internal service token passed via `Authorization: Bearer <INTERNAL_SERVICE_KEY>` header.
- The service should remain on an internal Docker network, unexposed to public ingress.

### Failure Mode & Graceful Degradation
- If the Python analytics service is unreachable or times out (> 3000ms), the Hospital AI OS backend falls back to its existing internal deterministic SQL signal engine without degrading core hospital functionality.
