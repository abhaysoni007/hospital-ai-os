"""Lightweight explainable ML model component (Layer 2).

Uses a calibrated Logistic Regression model trained strictly on synthetic
operational bottleneck samples to provide non-linear risk probability and feature
coefficients without black-box complexity.
"""

import numpy as np
from typing import Dict, List, Optional, Tuple, Any
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from ..api.schemas import AnalyzeRequest, SignalSeverityEnum
from ..core.exceptions import ModelInferenceError

FEATURE_NAMES = [
    "unacknowledged_critical_results",
    "stalled_orders_over_sla",
    "encounters_without_clinical_record",
    "active_encounters",
    "pending_diagnostic_orders",
    "average_pending_age_minutes",
    "critical_signals_count",
    "high_signals_count"
]


class OperationalMLPredictor:
    """Explainable operational bottleneck classifier."""

    def __init__(self, random_state: int = 42):
        self.random_state = random_state
        self.scaler = StandardScaler()
        self.model = LogisticRegression(
            C=1.0,
            max_iter=500,
            random_state=self.random_state,
            solver="lbfgs"
        )
        self.is_trained: bool = False
        self.training_provenance: Optional[str] = None

    @classmethod
    def extract_features(cls, request: AnalyzeRequest) -> np.ndarray:
        """Transforms an incoming AnalyzeRequest into a normalized 1D feature vector."""
        feats = request.operational_features
        signals = request.signals

        crit_signals = sum(1 for s in signals if s.severity == SignalSeverityEnum.CRITICAL)
        high_signals = sum(1 for s in signals if s.severity == SignalSeverityEnum.HIGH)

        vec = [
            float(feats.unacknowledged_critical_results),
            float(feats.stalled_orders_over_sla),
            float(feats.encounters_without_clinical_record),
            float(feats.active_encounters),
            float(feats.pending_diagnostic_orders),
            float(feats.average_pending_age_minutes),
            float(crit_signals),
            float(high_signals)
        ]
        return np.array(vec, dtype=np.float32)

    def fit(self, X: np.ndarray, y: np.ndarray, provenance: str = "SYNTHETIC-DATASET-V1") -> None:
        """Fits scaler and logistic model on synthetic feature matrix."""
        if len(X) < 10:
            raise ValueError("Insufficient training samples; minimum 10 required.")
        X_scaled = self.scaler.fit_transform(X)
        self.model.fit(X_scaled, y)
        self.is_trained = True
        self.training_provenance = provenance

    def predict_bottleneck_probability(self, request: AnalyzeRequest) -> Optional[float]:
        """Predicts operational bottleneck risk probability in [0.0, 1.0].

        Returns None if model is not trained or encounters an unexpected error.
        """
        if not self.is_trained:
            return None

        try:
            vec = self.extract_features(request).reshape(1, -1)
            vec_scaled = self.scaler.transform(vec)
            # Probability of bottleneck class (1)
            prob = float(self.model.predict_proba(vec_scaled)[0, 1])
            return max(0.0, min(1.0, round(prob, 4)))
        except Exception as ex:
            # Safe failure fallback - never crash production request
            return None

    def get_feature_coefficients(self) -> Dict[str, float]:
        """Returns feature name to logistic model coefficient mapping for explainability."""
        if not self.is_trained:
            return {}
        coefs = self.model.coef_[0]
        return {name: float(round(coef, 4)) for name, coef in zip(FEATURE_NAMES, coefs)}
