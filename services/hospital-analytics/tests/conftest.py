"""Pytest fixtures and test configuration."""

import pytest
from pathlib import Path
from fastapi.testclient import TestClient
from hospital_analytics.api.app import app
from hospital_analytics.api.schemas import (
    AnalyzeRequest,
    SignalInput,
    SignalTypeEnum,
    SignalSeverityEnum,
    OperationalFeaturesInput,
)


@pytest.fixture
def client():
    """FastAPI TestClient instance."""
    return TestClient(app)


@pytest.fixture
def synthetic_data_path():
    """Path to the synthetic benchmark dataset."""
    return Path(__file__).parent.parent / "examples" / "synthetic_dataset.json"


@pytest.fixture
def empty_state_request() -> AnalyzeRequest:
    """Represents a completely quiet or zero-activity department."""
    return AnalyzeRequest(
        analysis_id="00000000-0000-0000-0000-000000000000",
        correlation_id="11111111-1111-1111-1111-111111111111",
        scope="department",
        signals=[],
        operational_features=OperationalFeaturesInput(
            active_encounters=0,
            pending_diagnostic_orders=0,
            unacknowledged_critical_results=0,
            encounters_without_clinical_record=0,
            stalled_orders_over_sla=0,
            average_pending_age_minutes=0.0,
        )
    )


@pytest.fixture
def low_risk_request() -> AnalyzeRequest:
    """Typical low-risk operational scenario."""
    return AnalyzeRequest(
        analysis_id="low-risk-001",
        correlation_id="corr-low-001",
        scope="department",
        signals=[
            SignalInput(
                signal_type=SignalTypeEnum.PENDING_DIAGNOSTIC_RESULT,
                severity=SignalSeverityEnum.LOW,
                age_minutes=30.0
            )
        ],
        operational_features=OperationalFeaturesInput(
            active_encounters=8,
            pending_diagnostic_orders=3,
            unacknowledged_critical_results=0,
            encounters_without_clinical_record=1,
            stalled_orders_over_sla=0,
            average_pending_age_minutes=25.0
        )
    )


@pytest.fixture
def high_risk_request() -> AnalyzeRequest:
    """Severe operational bottleneck scenario with critical unacknowledged results and SLA breaches."""
    return AnalyzeRequest(
        analysis_id="high-risk-001",
        correlation_id="corr-high-001",
        scope="department",
        signals=[
            SignalInput(
                signal_type=SignalTypeEnum.CRITICAL_RESULT_UNACKNOWLEDGED,
                severity=SignalSeverityEnum.CRITICAL,
                age_minutes=75.0
            ),
            SignalInput(
                signal_type=SignalTypeEnum.PENDING_DIAGNOSTIC_RESULT,
                severity=SignalSeverityEnum.HIGH,
                age_minutes=320.0
            )
        ],
        operational_features=OperationalFeaturesInput(
            active_encounters=45,
            pending_diagnostic_orders=26,
            unacknowledged_critical_results=3,
            encounters_without_clinical_record=12,
            stalled_orders_over_sla=8,
            average_pending_age_minutes=240.0
        )
    )
