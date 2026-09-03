"""Tests for deterministic feature scoring engine (Layer 1)."""

from hospital_analytics.engine.scoring import DeterministicScoringEngine
from hospital_analytics.api.schemas import (
    AnalyzeRequest,
    SignalInput,
    SignalTypeEnum,
    SignalSeverityEnum,
    RiskLevelEnum,
    OperationalFeaturesInput,
)


def test_empty_state_scoring(empty_state_request):
    """Empty operational state must return 0.0 risk score and LOW risk level."""
    engine = DeterministicScoringEngine()
    score, level, factors = engine.compute_score(empty_state_request)

    assert score == 0.0
    assert level == RiskLevelEnum.LOW
    assert len(factors) == 5
    for f in factors:
        assert f.contribution == 0.0


def test_high_risk_scoring(high_risk_request):
    """High risk scenario must calculate elevated score and appropriate risk level."""
    engine = DeterministicScoringEngine()
    score, level, factors = engine.compute_score(high_risk_request)

    assert score >= 0.70
    assert level in [RiskLevelEnum.HIGH, RiskLevelEnum.CRITICAL]
    # Factors should be sorted descending
    for i in range(len(factors) - 1):
        assert factors[i].contribution >= factors[i + 1].contribution


def test_deterministic_reproducibility(high_risk_request):
    """Calling compute_score repeatedly on identical input must produce identical results."""
    engine = DeterministicScoringEngine()
    score1, level1, factors1 = engine.compute_score(high_risk_request)
    score2, level2, factors2 = engine.compute_score(high_risk_request)

    assert score1 == score2
    assert level1 == level2
    assert [f.contribution for f in factors1] == [f.contribution for f in factors2]


def test_boundary_saturation_clamped():
    """Extreme workload values must be gracefully clamped and never exceed 1.0."""
    extreme_request = AnalyzeRequest(
        signals=[
            SignalInput(
                signal_type=SignalTypeEnum.CRITICAL_RESULT_UNACKNOWLEDGED,
                severity=SignalSeverityEnum.CRITICAL,
                age_minutes=5000.0
            )
        ],
        operational_features=OperationalFeaturesInput(
            active_encounters=500,
            pending_diagnostic_orders=300,
            unacknowledged_critical_results=50,
            encounters_without_clinical_record=100,
            stalled_orders_over_sla=80,
            average_pending_age_minutes=1500.0
        )
    )
    engine = DeterministicScoringEngine()
    score, level, factors = engine.compute_score(extreme_request)

    assert 0.0 <= score <= 1.0
    assert score == 1.0
    assert level == RiskLevelEnum.CRITICAL


def test_critical_signal_elevation():
    """Presence of a CRITICAL signal must immediately escalate risk compared to identical state without it."""
    req_without = AnalyzeRequest(
        signals=[],
        operational_features=OperationalFeaturesInput(
            active_encounters=10,
            pending_diagnostic_orders=5,
            unacknowledged_critical_results=0,
            encounters_without_clinical_record=2,
            stalled_orders_over_sla=0,
            average_pending_age_minutes=30.0
        )
    )
    req_with = AnalyzeRequest(
        signals=[
            SignalInput(
                signal_type=SignalTypeEnum.CRITICAL_RESULT_UNACKNOWLEDGED,
                severity=SignalSeverityEnum.CRITICAL,
                age_minutes=30.0
            )
        ],
        operational_features=OperationalFeaturesInput(
            active_encounters=10,
            pending_diagnostic_orders=5,
            unacknowledged_critical_results=1,
            encounters_without_clinical_record=2,
            stalled_orders_over_sla=0,
            average_pending_age_minutes=30.0
        )
    )

    engine = DeterministicScoringEngine()
    score_without, _, _ = engine.compute_score(req_without)
    score_with, _, _ = engine.compute_score(req_with)

    assert score_with > score_without
