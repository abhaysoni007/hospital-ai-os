"""Deterministic feature scoring engine (Layer 1).

Calculates reproducible, explainable operational risk scores strictly based on
measurable workflow bottlenecks and documented experimental weights.
"""

from typing import Dict, List, Tuple
from ..api.schemas import (
    AnalyzeRequest,
    RiskLevelEnum,
    SignalSeverityEnum,
    FactorContribution,
)
from ..core.config import settings, OperationalWeights, OperationalThresholds


class DeterministicScoringEngine:
    """Computes transparent, deterministic risk scores based on operational features."""

    def __init__(
        self,
        weights: OperationalWeights = settings.weights,
        thresholds: OperationalThresholds = settings.thresholds,
    ):
        self.weights = weights
        self.thresholds = thresholds

    def compute_score(self, request: AnalyzeRequest) -> Tuple[float, RiskLevelEnum, List[FactorContribution]]:
        """Calculates deterministic risk score, risk level, and factor contributions.

        Returns:
            Tuple of (risk_score, risk_level, factor_contributions)
        """
        features = request.operational_features
        signals = request.signals

        # 1. Unacknowledged critical results factor
        crit_count = features.unacknowledged_critical_results
        # Also count any signals explicitly marked CRITICAL
        critical_signals = [s for s in signals if s.severity == SignalSeverityEnum.CRITICAL]
        effective_critical = max(crit_count, len(critical_signals))
        
        crit_normalized = min(1.0, effective_critical / float(self.thresholds.max_expected_unacknowledged_critical))
        crit_contrib = crit_normalized * self.weights.unacknowledged_critical_results

        # 2. Stalled orders over SLA factor
        stalled_orders = features.stalled_orders_over_sla
        stalled_normalized = min(1.0, stalled_orders / 10.0)
        stalled_contrib = stalled_normalized * self.weights.stalled_orders_over_sla

        # 3. Encounters without clinical record factor
        undoc_encounters = features.encounters_without_clinical_record
        undoc_normalized = min(1.0, undoc_encounters / float(self.thresholds.max_expected_undocumented_encounters))
        undoc_contrib = undoc_normalized * self.weights.encounters_without_clinical_record

        # 4. Department active workload saturation factor
        active_enc = features.active_encounters
        active_normalized = min(1.0, active_enc / float(self.thresholds.max_expected_active_encounters))
        active_contrib = active_normalized * self.weights.active_encounters_load

        # 5. Signal age escalation factor
        max_age = 0.0
        if signals:
            max_age = max(s.age_minutes for s in signals)
        elif features.average_pending_age_minutes > 0:
            max_age = features.average_pending_age_minutes

        age_normalized = min(1.0, max_age / float(self.thresholds.routine_order_sla_minutes))
        age_contrib = age_normalized * self.weights.signal_age_escalation

        # Sum raw deterministic score
        raw_score = crit_contrib + stalled_contrib + undoc_contrib + active_contrib + age_contrib
        # Round and clamp to [0.0, 1.0]
        final_score = max(0.0, min(1.0, round(raw_score, 4)))

        # Categorize risk level
        risk_level = self._categorize_risk(final_score)

        # Build factor contributions
        factors: List[FactorContribution] = []

        factors.append(FactorContribution(
            name="unacknowledged_critical_results",
            contribution=round(crit_contrib, 4),
            observed_value=effective_critical,
            description=f"{effective_critical} critical diagnostic alerts awaiting clinical acknowledgment"
        ))

        factors.append(FactorContribution(
            name="stalled_orders_over_sla",
            contribution=round(stalled_contrib, 4),
            observed_value=stalled_orders,
            description=f"{stalled_orders} diagnostic orders exceeding turnaround SLA"
        ))

        factors.append(FactorContribution(
            name="encounters_without_clinical_record",
            contribution=round(undoc_contrib, 4),
            observed_value=undoc_encounters,
            description=f"{undoc_encounters} encounters without timely clinical documentation"
        ))

        factors.append(FactorContribution(
            name="active_encounters_load",
            contribution=round(active_contrib, 4),
            observed_value=active_enc,
            description=f"{active_enc} active encounters contributing to department volume"
        ))

        factors.append(FactorContribution(
            name="signal_age_escalation",
            contribution=round(age_contrib, 4),
            observed_value=round(max_age, 1),
            description=f"Maximum pending signal age of {round(max_age, 1)} minutes"
        ))

        # Sort factors by contribution descending
        factors.sort(key=lambda f: f.contribution, reverse=True)

        return final_score, risk_level, factors

    def _categorize_risk(self, score: float) -> RiskLevelEnum:
        """Maps numeric score to categorical RiskLevelEnum."""
        b = settings.risk_boundaries
        if score >= b.high_cutoff:
            return RiskLevelEnum.CRITICAL
        elif score >= b.medium_cutoff:
            return RiskLevelEnum.HIGH
        elif score >= b.low_cutoff:
            return RiskLevelEnum.MEDIUM
        return RiskLevelEnum.LOW
