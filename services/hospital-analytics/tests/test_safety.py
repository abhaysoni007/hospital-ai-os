"""Tests for clinical safety constraints and privacy boundaries."""

import pytest
from hospital_analytics.core.safety import validate_privacy_and_safety, get_safety_disclaimers
from hospital_analytics.core.exceptions import SafetyViolationError
from hospital_analytics.engine.explainability import ExplainabilityEngine


def test_safety_disclaimers_present(low_risk_request):
    """Verifies that mandatory clinical disclaimers are attached to analysis response."""
    engine = ExplainabilityEngine()
    response = engine.analyze(low_risk_request)

    disclaimers = response.limitations
    assert len(disclaimers) >= 3
    # Verify core clinical safety guarantees
    disclaimer_text = " ".join(disclaimers).lower()
    assert "not clinically validated" in disclaimer_text
    assert "not be used for patient diagnosis" in disclaimer_text


@pytest.mark.parametrize("prohibited_key", [
    "patient_name",
    "first_name",
    "last_name",
    "ssn",
    "mrn",
    "dob",
    "clinical_notes",
    "treatment_plan",
    "prescription",
    "discharge_summary",
])
def test_privacy_validator_catches_phi(prohibited_key):
    """Recursively detects and blocks any PHI or clinical note fields."""
    payload = {
        "analysis_id": "test-id",
        "signals": [],
        "metadata": {
            "nested_context": {
                prohibited_key: "sensitive_data_value"
            }
        }
    }
    with pytest.raises(SafetyViolationError) as exc_info:
        validate_privacy_and_safety(payload)
    assert prohibited_key in str(exc_info.value)


def test_non_clinical_decision_boundary(high_risk_request):
    """Verifies that response never generates clinical actions or diagnostic claims."""
    engine = ExplainabilityEngine()
    response = engine.analyze(high_risk_request)

    # Response is strictly operational
    assert response.analysis_type == "operational_bottleneck"
    for f in response.factors:
        desc_lower = f.description.lower()
        assert "prescribe" not in desc_lower
        assert "diagnose " not in desc_lower
        assert "diagnosed" not in desc_lower
        assert "discharge patient" not in desc_lower
