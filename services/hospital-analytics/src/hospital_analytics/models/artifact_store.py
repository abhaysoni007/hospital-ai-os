"""Artifact storage for saving and loading serialized model components."""

import os
import joblib
from pathlib import Path
from typing import Optional
from ..engine.ml_model import OperationalMLPredictor


class ArtifactStore:
    """Manages persistence of trained model artifacts."""

    @staticmethod
    def save_model(predictor: OperationalMLPredictor, file_path: str) -> None:
        """Saves predictor state (model, scaler, provenance) to disk."""
        target = Path(file_path)
        target.parent.mkdir(parents=True, exist_ok=True)
        data = {
            "model": predictor.model,
            "scaler": predictor.scaler,
            "is_trained": predictor.is_trained,
            "training_provenance": predictor.training_provenance
        }
        joblib.dump(data, target)

    @staticmethod
    def load_model(file_path: str) -> Optional[OperationalMLPredictor]:
        """Loads predictor state from disk. Returns None if file does not exist or fails."""
        target = Path(file_path)
        if not target.exists():
            return None
        try:
            data = joblib.load(target)
            predictor = OperationalMLPredictor()
            predictor.model = data["model"]
            predictor.scaler = data["scaler"]
            predictor.is_trained = data.get("is_trained", False)
            predictor.training_provenance = data.get("training_provenance", "SAVED-MODEL")
            return predictor
        except Exception:
            return None
