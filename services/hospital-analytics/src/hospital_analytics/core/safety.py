"""Safety boundaries, privacy validators, and disclaimer management.

Enforces strict isolation from clinical decision making and rejects PHI.
"""

from typing import Any, Dict, List
from .exceptions import SafetyViolationError

# Prohibited keys that indicate clinical data or PHI
PROHIBITED_PAYLOAD_KEYS = {
    "patient_name",
    "first_name",
    "last_name",
    "dob",
    "date_of_birth",
    "ssn",
    "mrn",
    "phone",
    "address",
    "clinical_notes",
    "progress_notes",
    "history_of_present_illness",
    "chief_complaint",
    "diagnosis",
    "treatment_plan",
    "prescription",
    "medication_order",
    "discharge_summary"
}

STANDARD_DISCLAIMERS: List[str] = [
    "Operational analytics only; NOT clinically validated.",
    "Must NOT be used for patient diagnosis, treatment, or clinical triage.",
    "Non-clinical operational workflow bottleneck monitoring only.",
    "Weights and scores are experimental heuristics based on synthetic operational baselines."
]


def validate_privacy_and_safety(payload: Dict[str, Any]) -> None:
    """Recursively validates that the request payload contains NO prohibited PHI or clinical text.

    Raises:
        SafetyViolationError: If prohibited clinical or PHI fields are detected.
    """
    def _scan(obj: Any, path: str = "") -> None:
        if isinstance(obj, dict):
            for k, v in obj.items():
                k_lower = str(k).lower().strip()
                current_path = f"{path}.{k}" if path else str(k)
                if k_lower in PROHIBITED_PAYLOAD_KEYS:
                    raise SafetyViolationError(
                        f"Safety violation: Prohibited field '{k}' detected in input at '{current_path}'. "
                        "The analytics service operates strictly on operational metadata and forbids PHI or clinical narratives.",
                        details={"violating_field": k, "path": current_path}
                    )
                _scan(v, current_path)
        elif isinstance(obj, list):
            for idx, item in enumerate(obj):
                _scan(item, f"{path}[{idx}]")

    _scan(payload)


def get_safety_disclaimers() -> List[str]:
    """Returns the immutable list of required clinical safety disclaimers."""
    return list(STANDARD_DISCLAIMERS)
