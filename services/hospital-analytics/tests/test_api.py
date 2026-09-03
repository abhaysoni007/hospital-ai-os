"""Tests for FastAPI HTTP endpoints."""

from fastapi.testclient import TestClient


def test_health_endpoint(client: TestClient):
    """Verifies that the /health endpoint reports operational status."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "hospital-analytics-plugin"
    assert "version" in data
    assert "ml_model_loaded" in data


def test_metadata_endpoint(client: TestClient):
    """Verifies the /metadata endpoint exposes weights and safety disclaimers."""
    response = client.get("/metadata")
    assert response.status_code == 200
    data = response.json()
    assert "weights" in data
    assert "thresholds" in data
    assert len(data["disclaimers"]) >= 3


def test_analyze_endpoint_valid_request(client: TestClient, low_risk_request):
    """Verifies successful analysis for a valid operational request."""
    response = client.post("/analyze", json=low_risk_request.model_dump())
    assert response.status_code == 200
    data = response.json()

    assert data["analysis_id"] == low_risk_request.analysis_id
    assert 0.0 <= data["risk_score"] <= 1.0
    assert data["risk_level"] in ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
    assert len(data["factors"]) > 0
    assert data["analysis_type"] == "operational_bottleneck"
    assert "model_info" in data
    assert len(data["limitations"]) > 0


def test_analyze_endpoint_high_risk(client: TestClient, high_risk_request):
    """Verifies that a saturated bottleneck scenario yields HIGH or CRITICAL risk."""
    response = client.post("/analyze", json=high_risk_request.model_dump())
    assert response.status_code == 200
    data = response.json()
    assert data["risk_score"] > 0.60
    assert data["risk_level"] in ["HIGH", "CRITICAL"]


def test_analyze_endpoint_malformed_input(client: TestClient):
    """Verifies that malformed input triggers validation errors (422)."""
    # Negative age minutes is invalid
    payload = {
        "signals": [
            {
                "signal_type": "PENDING_DIAGNOSTIC_RESULT",
                "severity": "HIGH",
                "age_minutes": -45.0
            }
        ]
    }
    response = client.post("/analyze", json=payload)
    assert response.status_code == 422


def test_analyze_endpoint_extra_fields_forbidden(client: TestClient):
    """Verifies that unknown extra keys are rejected (extra='forbid')."""
    payload = {
        "signals": [],
        "unknown_extra_key": "some_value"
    }
    response = client.post("/analyze", json=payload)
    assert response.status_code == 422


def test_analyze_endpoint_phi_rejection(client: TestClient):
    """Verifies that requests containing PHI or clinical narratives are rejected with 400."""
    payload = {
        "signals": [],
        "operational_features": {
            "active_encounters": 5
        },
        "patient_name": "John Doe"  # Prohibited PHI
    }
    # Handled either by Pydantic extra='forbid' or safety validator
    response = client.post("/analyze", json=payload)
    assert response.status_code in [400, 422]
