"""Custom exception hierarchy for hospital analytics plugin."""

from typing import Optional, Dict, Any


class AnalyticsError(Exception):
    """Base exception for all hospital analytics errors."""
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(message)
        self.message = message
        self.details = details or {}


class SafetyViolationError(AnalyticsError):
    """Raised when an input violates privacy or clinical safety constraints."""
    pass


class InvalidSignalDataError(AnalyticsError):
    """Raised when incoming signal data is malformed or invalid."""
    pass


class ModelInferenceError(AnalyticsError):
    """Raised when the ML model inference fails unexpectedly."""
    pass


class DataCompletenessError(AnalyticsError):
    """Raised when input data lacks required operational context to calculate risk."""
    pass
