"""Tests for explainability and factor attribution engine."""

from hospital_analytics.engine.explainability import ExplainabilityEngine
from hospital_analytics.engine.scoring import DeterministicScoringEngine
from hospital_analytics.engine.ml_model import OperationalMLPredictor


def test_pure_deterministic_explainability(low_risk_request):
    """Verifies factor generation and confidence when running in pure deterministic mode."""
    engine = ExplainabilityEngine(scoring_engine=DeterministicScoringEngine(), ml_predictor=None)
    response = engine.analyze(low_risk_request)

    assert response.model_info.engine == "deterministic_rule_based"
    assert not response.model_info.ml_enabled
    assert response.confidence is not None
    assert len(response.factors) > 0

    # Ensure every factor has non-empty description and name
    for f in response.factors:
        assert len(f.name) > 0
        assert len(f.description) > 0
        assert 0.0 <= f.contribution <= 1.0


def test_factor_ranking_order(high_risk_request):
    """Factors must be ordered from highest to lowest contribution."""
    engine = ExplainabilityEngine()
    response = engine.analyze(high_risk_request)

    for i in range(len(response.factors) - 1):
        assert response.factors[i].contribution >= response.factors[i + 1].contribution


def test_confidence_computation_with_ml(high_risk_request):
    """Agreement between ML and deterministic engines yields high confidence."""
    scoring_engine = DeterministicScoringEngine()
    det_score, _, _ = scoring_engine.compute_score(high_risk_request)

    class MockPredictor(OperationalMLPredictor):
        def __init__(self):
            super().__init__()
            self.is_trained = True
            self.training_provenance = "MOCK"

        def predict_bottleneck_probability(self, request):
            # Perfect agreement with deterministic score
            return det_score

    engine = ExplainabilityEngine(scoring_engine=scoring_engine, ml_predictor=MockPredictor())
    response = engine.analyze(high_risk_request)

    assert response.model_info.engine == "hybrid_deterministic_linear"
    assert response.model_info.ml_enabled
    assert response.confidence is not None
    assert response.confidence >= 0.85
