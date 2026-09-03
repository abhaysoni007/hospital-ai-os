"""Explainability engine and composite risk synthesizer.

Combines deterministic feature contributions and ML estimates into a final
transparent risk score with ranked explanatory factors.
"""

from datetime import datetime, timezone
from typing import List, Optional, Tuple
from ..api.schemas import (
    AnalyzeRequest,
    AnalyzeResponse,
    FactorContribution,
    ModelMetadata,
    RiskLevelEnum,
)
from ..core.config import settings
from ..core.safety import get_safety_disclaimers
from .scoring import DeterministicScoringEngine
from .ml_model import OperationalMLPredictor


class ExplainabilityEngine:
    """Synthesizes risk scores and generates factor attribution."""

    def __init__(
        self,
        scoring_engine: Optional[DeterministicScoringEngine] = None,
        ml_predictor: Optional[OperationalMLPredictor] = None,
    ):
        self.scoring_engine = scoring_engine or DeterministicScoringEngine()
        self.ml_predictor = ml_predictor

    def analyze(self, request: AnalyzeRequest) -> AnalyzeResponse:
        """Executes hybrid analysis and returns structured explainable response."""
        # 1. Deterministic Layer 1
        det_score, det_level, det_factors = self.scoring_engine.compute_score(request)

        # 2. ML Layer 2 (Optional)
        ml_prob: Optional[float] = None
        if self.ml_predictor and self.ml_predictor.is_trained:
            ml_prob = self.ml_predictor.predict_bottleneck_probability(request)

        # 3. Combine scores
        if ml_prob is not None:
            # Hybrid combination (65% deterministic + 35% ML probability)
            final_score = round(0.65 * det_score + 0.35 * ml_prob, 4)
            final_score = max(0.0, min(1.0, final_score))
            engine_type = "hybrid_deterministic_linear"
            ml_enabled = True
            provenance = self.ml_predictor.training_provenance
            # Higher confidence when both engines agree
            confidence = self._compute_confidence(det_score, ml_prob, request)
        else:
            final_score = det_score
            engine_type = "deterministic_rule_based"
            ml_enabled = False
            provenance = None
            confidence = self._compute_deterministic_confidence(request)

        # Determine final risk category based on final score
        final_level = self.scoring_engine._categorize_risk(final_score)

        # 4. Scale factor contributions proportionally to match final score
        adjusted_factors = self._adjust_factor_contributions(det_factors, final_score)

        # 5. Build response
        return AnalyzeResponse(
            analysis_id=request.analysis_id,
            correlation_id=request.correlation_id,
            timestamp=datetime.now(timezone.utc).isoformat(),
            risk_score=final_score,
            risk_level=final_level,
            confidence=confidence,
            factors=adjusted_factors,
            analysis_type="operational_bottleneck",
            model_info=ModelMetadata(
                engine=engine_type,
                ml_enabled=ml_enabled,
                algorithm_version=settings.algorithm_version,
                training_provenance=provenance,
            ),
            limitations=get_safety_disclaimers(),
        )

    def _compute_confidence(
        self, det_score: float, ml_prob: float, request: AnalyzeRequest
    ) -> float:
        """Calculates confidence score based on agreement between engines and input richness."""
        # Agreement delta: smaller gap = higher confidence
        delta = abs(det_score - ml_prob)
        agreement_factor = max(0.0, 1.0 - (delta * 1.5))

        # Input data richness: having both features and signals boosts confidence
        has_signals = len(request.signals) > 0
        has_features = request.operational_features.active_encounters > 0 or \
                       request.operational_features.pending_diagnostic_orders > 0

        data_richness = 0.85 if (has_signals and has_features) else 0.70

        # Weighted confidence capped at 0.95 (never 1.0 for synthetic/experimental)
        conf = (0.6 * agreement_factor) + (0.4 * data_richness)
        return max(0.1, min(0.95, round(conf, 2)))

    def _compute_deterministic_confidence(self, request: AnalyzeRequest) -> Optional[float]:
        """Calculates confidence for pure deterministic mode."""
        has_signals = len(request.signals) > 0
        has_features = request.operational_features.active_encounters > 0 or \
                       request.operational_features.pending_diagnostic_orders > 0

        if not has_signals and not has_features:
            # Completely empty state: low or null confidence
            return 0.50

        return 0.80

    def _adjust_factor_contributions(
        self, factors: List[FactorContribution], target_score: float
    ) -> List[FactorContribution]:
        """Adjusts factor contributions so top drivers accurately explain the total score."""
        current_sum = sum(f.contribution for f in factors)
        if current_sum <= 0.0 or target_score <= 0.0:
            return factors

        scale = target_score / current_sum
        adjusted = []
        for f in factors:
            new_contrib = max(0.0, min(1.0, round(f.contribution * scale, 4)))
            adjusted.append(FactorContribution(
                name=f.name,
                contribution=new_contrib,
                observed_value=f.observed_value,
                description=f.description,
            ))

        adjusted.sort(key=lambda f: f.contribution, reverse=True)
        return adjusted
