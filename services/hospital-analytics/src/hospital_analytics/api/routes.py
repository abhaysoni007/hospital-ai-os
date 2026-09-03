"""FastAPI route definitions for hospital analytics plugin."""

import os
import json
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, HTTPException, status, Request
from .schemas import (
    AnalyzeRequest,
    AnalyzeResponse,
    HealthResponse,
)
from ..core.config import settings
from ..core.safety import validate_privacy_and_safety, get_safety_disclaimers
from ..core.exceptions import SafetyViolationError
from ..engine.scoring import DeterministicScoringEngine
from ..engine.ml_model import OperationalMLPredictor
from ..engine.explainability import ExplainabilityEngine

router = APIRouter()

# Singleton engine instances
_scoring_engine = DeterministicScoringEngine()
_ml_predictor: Optional[OperationalMLPredictor] = None
_explainability_engine: Optional[ExplainabilityEngine] = None


def get_ml_predictor() -> Optional[OperationalMLPredictor]:
    """Initializes or returns cached ML predictor trained on synthetic data."""
    global _ml_predictor
    if _ml_predictor is not None:
        return _ml_predictor

    predictor = OperationalMLPredictor()
    # Attempt to locate synthetic samples across development, container, and cwd paths
    candidate_paths = [
        Path(os.getenv("SYNTHETIC_DATASET_PATH", "")) if os.getenv("SYNTHETIC_DATASET_PATH") else None,
        Path("/app/examples/synthetic_dataset.json"),
        Path.cwd() / "examples" / "synthetic_dataset.json",
        Path(__file__).resolve().parent.parent.parent.parent / "examples" / "synthetic_dataset.json",
        Path(__file__).resolve().parent.parent.parent / "examples" / "synthetic_dataset.json",
    ]

    synthetic_path = None
    for cp in candidate_paths:
        if cp and cp.exists():
            synthetic_path = cp
            break

    if synthetic_path and synthetic_path.exists():
        try:
            with open(synthetic_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            samples = data.get("samples", [])
            if len(samples) >= 10:
                X_list = []
                y_list = []
                for s in samples:
                    feats = s["features"]
                    # Extract 8-dim vector
                    vec = [
                        float(feats["unacknowledged_critical_results"]),
                        float(feats["stalled_orders_over_sla"]),
                        float(feats["encounters_without_clinical_record"]),
                        float(feats["active_encounters"]),
                        float(feats["pending_diagnostic_orders"]),
                        float(feats["average_pending_age_minutes"]),
                        float(feats.get("critical_signals_count", 0)),
                        float(feats.get("high_signals_count", 0)),
                    ]
                    X_list.append(vec)
                    y_list.append(s["bottleneck_label"])
                
                import numpy as np
                predictor.fit(np.array(X_list, dtype=np.float32), np.array(y_list, dtype=np.int32))
                _ml_predictor = predictor
        except Exception:
            _ml_predictor = None
    return _ml_predictor


def get_explainability_engine() -> ExplainabilityEngine:
    """Returns the explainability engine."""
    global _explainability_engine
    predictor = get_ml_predictor()
    _explainability_engine = ExplainabilityEngine(
        scoring_engine=_scoring_engine,
        ml_predictor=predictor
    )
    return _explainability_engine


@router.get("/health", response_model=HealthResponse, tags=["Health"])
def health_check():
    """Service health and operational status."""
    predictor = get_ml_predictor()
    return HealthResponse(
        status="ok",
        service=settings.service_name,
        version=settings.version,
        ml_model_loaded=(predictor is not None and predictor.is_trained)
    )


@router.post(
    "/analyze",
    response_model=AnalyzeResponse,
    status_code=status.HTTP_200_OK,
    tags=["Analytics"]
)
def analyze_hospital_operations(request: AnalyzeRequest):
    """Analyzes operational features and signals to calculate workflow bottleneck risk.

    - Computes deterministic score based on documented operational weights
    - Evaluates ML probability on synthetic baseline
    - Produces ranked factor attribution explaining the score
    - Validates privacy boundaries (rejects PHI or clinical notes)
    - Enforces clinical safety disclaimers
    """
    # 1. Strict privacy and safety check
    try:
        validate_privacy_and_safety(request.model_dump())
    except SafetyViolationError as err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": "SAFETY_VIOLATION", "message": err.message, "details": err.details}
        )

    # 2. Execute analytics engine
    try:
        engine = get_explainability_engine()
        response = engine.analyze(request)
        return response
    except Exception as ex:
        # Failsafe: Never crash without structured error
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"error": "ANALYTICS_EXECUTION_ERROR", "message": str(ex)}
        )


@router.get("/metadata", tags=["Metadata"])
def get_service_metadata():
    """Returns algorithm version, weights, thresholds, and clinical safety disclaimers."""
    return {
        "service": settings.service_name,
        "version": settings.version,
        "algorithm_version": settings.algorithm_version,
        "weights": {
            "unacknowledged_critical_results": settings.weights.unacknowledged_critical_results,
            "stalled_orders_over_sla": settings.weights.stalled_orders_over_sla,
            "encounters_without_clinical_record": settings.weights.encounters_without_clinical_record,
            "active_encounters_load": settings.weights.active_encounters_load,
            "signal_age_escalation": settings.weights.signal_age_escalation,
        },
        "thresholds": {
            "stat_order_sla_minutes": settings.thresholds.stat_order_sla_minutes,
            "routine_order_sla_minutes": settings.thresholds.routine_order_sla_minutes,
            "critical_ack_sla_minutes": settings.thresholds.critical_ack_sla_minutes,
        },
        "disclaimers": get_safety_disclaimers()
    }
