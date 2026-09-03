# Synthetic Dataset & Operational Benchmarks

> **DISCLAIMER:**  
> **SYNTHETIC — NOT CLINICAL DATA**  
> All data points in this directory are generated algorithmically for testing operational risk scoring, feature calibration, and explainability algorithms. They contain zero real patient records, zero clinical findings, and zero Protected Health Information (PHI).  
> **Synthetic evaluation does NOT represent real-world clinical or hospital performance.**

---

## Files in this Directory

- `synthetic_dataset.json`: 20 labeled operational feature vectors representing simulated workflow scenarios (high-risk bottlenecks, normal throughput, and boundary conditions).
- `sample_request.json`: An example JSON payload for the `POST /analyze` endpoint.
- `sample_response.json`: The corresponding structured output produced by the service.

## Feature Schema

| Feature Name | Description | Range |
|:---|:---|:---|
| `unacknowledged_critical_results` | Count of critical/panic lab/imaging results awaiting acknowledgment | 0 - 5+ |
| `stalled_orders_over_sla` | Diagnostic orders pending past SLA turnaround thresholds | 0 - 10+ |
| `encounters_without_clinical_record` | Completed or active encounters lacking clinical progress notes | 0 - 15+ |
| `active_encounters` | Active patient encounters in department | 0 - 50+ |
| `pending_diagnostic_orders` | Total diagnostic orders currently pending results | 0 - 30+ |
| `average_pending_age_minutes` | Mean duration since order placement | 0 - 500+ |
| `critical_signals_count` | Number of M19 CRITICAL operational signals detected | 0 - 5 |
| `high_signals_count` | Number of M19 HIGH operational signals detected | 0 - 10 |
