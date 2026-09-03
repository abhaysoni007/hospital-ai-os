"""Pydantic v2 schemas for Hospital Analytics API.

Mirrors and extends Hospital AI OS M19.0 and M19.1 contracts while ensuring
strict privacy boundaries (UUIDs only, non-identifying operational counts).
"""

from enum import Enum
from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field, field_validator
import uuid


class SignalTypeEnum(str, Enum):
    """Signal types harmonized with M19.1 signalTypeSchema."""
    PENDING_DIAGNOSTIC_RESULT = "PENDING_DIAGNOSTIC_RESULT"
    CRITICAL_RESULT_UNACKNOWLEDGED = "CRITICAL_RESULT_UNACKNOWLEDGED"
    ENCOUNTER_WITHOUT_CLINICAL_RECORD = "ENCOUNTER_WITHOUT_CLINICAL_RECORD"
    # Extensible operational signal types
    TASK_ESCALATION_RISK = "TASK_ESCALATION_RISK"
    DEPARTMENT_SATURATION = "DEPARTMENT_SATURATION"


class SignalSeverityEnum(str, Enum):
    """Signal severities harmonized with M19.1 signalSeveritySchema."""
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class RiskLevelEnum(str, Enum):
    """Categorical risk assessment."""
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class SignalInput(BaseModel):
    """A detected operational workflow signal to be analyzed."""
    signal_id: Optional[str] = Field(default=None, description="Optional signal UUID")
    signal_type: SignalTypeEnum = Field(..., description="Operational signal category")
    severity: SignalSeverityEnum = Field(..., description="Deterministic severity level")
    age_minutes: float = Field(ge=0, description="Duration in minutes since condition onset")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Non-PHI operational context")

    @field_validator("age_minutes")
    @classmethod
    def validate_age(cls, v: float) -> float:
        if v < 0:
            raise ValueError("age_minutes cannot be negative")
        if v > 525600:  # 1 year
            raise ValueError("age_minutes exceeds plausible operational range")
        return v


class OperationalFeaturesInput(BaseModel):
    """Aggregated operational workload features for department or hospital scope."""
    active_encounters: int = Field(default=0, ge=0, description="Count of currently active encounters")
    pending_diagnostic_orders: int = Field(default=0, ge=0, description="Total diagnostic orders awaiting results")
    unacknowledged_critical_results: int = Field(default=0, ge=0, description="Critical/panic results unacknowledged")
    encounters_without_clinical_record: int = Field(default=0, ge=0, description="Encounters without clinical documentation")
    stalled_orders_over_sla: int = Field(default=0, ge=0, description="Diagnostic orders past turnaround SLA")
    average_pending_age_minutes: float = Field(default=0.0, ge=0.0, description="Mean duration of pending orders")


class AnalyzeRequest(BaseModel):
    """Input contract for POST /analyze."""
    analysis_id: Optional[str] = Field(default_factory=lambda: str(uuid.uuid4()), description="Unique analysis run UUID")
    correlation_id: Optional[str] = Field(default_factory=lambda: str(uuid.uuid4()), description="Trace correlation UUID")
    scope: str = Field(default="department", description="Operational scope: 'department' or 'hospital'")
    department_id: Optional[str] = Field(default=None, description="Department UUID if scoped to department")
    signals: List[SignalInput] = Field(default_factory=list, description="List of operational signals")
    operational_features: OperationalFeaturesInput = Field(
        default_factory=OperationalFeaturesInput,
        description="Aggregate operational workload counts"
    )

    model_config = {
        "extra": "forbid"
    }


class FactorContribution(BaseModel):
    """Contribution breakdown for explainability."""
    name: str = Field(..., description="Name of the operational feature or signal factor")
    contribution: float = Field(..., description="Calculated contribution to total risk score (0.0 to 1.0)")
    observed_value: Any = Field(..., description="Observed feature count or duration")
    description: str = Field(..., description="Human-readable plain language explanation")


class ModelMetadata(BaseModel):
    """Provenance and algorithm execution metadata."""
    engine: str = Field(..., description="Analytics engine type (e.g. deterministic or hybrid)")
    ml_enabled: bool = Field(..., description="Whether ML component contributed to the score")
    algorithm_version: str = Field(..., description="Version of the scoring algorithm")
    training_provenance: Optional[str] = Field(default=None, description="Dataset identifier used for model")


class AnalyzeResponse(BaseModel):
    """Output contract returned by POST /analyze."""
    analysis_id: str = Field(..., description="Echoed analysis run UUID")
    correlation_id: str = Field(..., description="Echoed correlation UUID")
    timestamp: str = Field(..., description="ISO 8601 UTC timestamp of calculation")
    risk_score: float = Field(ge=0.0, le=1.0, description="Normalized risk score between 0.0 and 1.0")
    risk_level: RiskLevelEnum = Field(..., description="Categorical risk tier: LOW, MEDIUM, HIGH, CRITICAL")
    confidence: Optional[float] = Field(ge=0.0, le=1.0, default=None, description="Confidence score or null if unavailable")
    factors: List[FactorContribution] = Field(..., description="Ranked factors explaining the risk score")
    analysis_type: str = Field(default="operational_bottleneck", description="Type of intelligence analysis")
    model_info: ModelMetadata = Field(..., description="Algorithm and model provenance details")
    limitations: List[str] = Field(..., description="Clinical safety disclaimers and scope boundaries")


class HealthResponse(BaseModel):
    """Health status returned by GET /health."""
    status: str = Field(default="ok")
    service: str
    version: str
    ml_model_loaded: bool
