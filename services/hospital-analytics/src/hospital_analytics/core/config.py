"""Configuration settings, operational SLA thresholds, and experimental scoring weights."""

from dataclasses import dataclass, field
from typing import Dict


@dataclass(frozen=True)
class OperationalWeights:
    """Experimental operational analytics weights.

    DISCLAIMER: These weights are heuristics designed for workflow bottleneck
    identification and are NOT clinically validated or intended for medical triage.
    """
    # Core feature weights (sum to 1.0)
    unacknowledged_critical_results: float = 0.35
    stalled_orders_over_sla: float = 0.25
    encounters_without_clinical_record: float = 0.20
    active_encounters_load: float = 0.10
    signal_age_escalation: float = 0.10

    # Signal severity multiplier weights
    severity_weights: Dict[str, float] = field(default_factory=lambda: {
        "CRITICAL": 1.0,
        "HIGH": 0.75,
        "MEDIUM": 0.40,
        "LOW": 0.15
    })


@dataclass(frozen=True)
class OperationalThresholds:
    """Operational SLA and saturation thresholds."""
    stat_order_sla_minutes: int = 120        # STAT order pending > 2 hours is SLA breach
    routine_order_sla_minutes: int = 480    # Routine order pending > 8 hours is SLA breach
    critical_ack_sla_minutes: int = 30       # Critical lab alert pending ack > 30 mins
    encounter_doc_sla_minutes: int = 240     # Encounter active > 4 hours without clinical note

    # Department saturation caps for linear normalization
    max_expected_active_encounters: int = 50
    max_expected_pending_orders: int = 30
    max_expected_unacknowledged_critical: int = 5
    max_expected_undocumented_encounters: int = 15


@dataclass(frozen=True)
class RiskLevelBoundaries:
    """Risk score boundaries mapping score [0.0, 1.0] to categorical level."""
    low_cutoff: float = 0.35
    medium_cutoff: float = 0.65
    high_cutoff: float = 0.85


@dataclass(frozen=True)
class Settings:
    """Application runtime settings."""
    service_name: str = "hospital-analytics-plugin"
    version: str = "0.1.0"
    algorithm_version: str = "v1.0.0-experimental"
    environment: str = "development"
    debug: bool = False
    
    # ML model configuration
    enable_ml_model: bool = True
    model_artifact_path: str = "models/bottleneck_model.joblib"
    
    # Weights and thresholds
    weights: OperationalWeights = field(default_factory=OperationalWeights)
    thresholds: OperationalThresholds = field(default_factory=OperationalThresholds)
    risk_boundaries: RiskLevelBoundaries = field(default_factory=RiskLevelBoundaries)


settings = Settings()
