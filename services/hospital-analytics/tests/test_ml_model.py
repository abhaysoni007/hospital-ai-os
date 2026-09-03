"""Tests for ML model component (Layer 2) and artifact serialization."""

import json
import numpy as np
from pathlib import Path
from sklearn.model_selection import train_test_split
from hospital_analytics.engine.ml_model import OperationalMLPredictor, FEATURE_NAMES
from hospital_analytics.models.artifact_store import ArtifactStore


def test_feature_extraction(low_risk_request):
    """Verifies that AnalyzeRequest is transformed into an 8-dimensional float feature vector."""
    vec = OperationalMLPredictor.extract_features(low_risk_request)
    assert isinstance(vec, np.ndarray)
    assert len(vec) == len(FEATURE_NAMES)
    assert vec.dtype == np.float32


def test_unfitted_model_fallback(low_risk_request):
    """Unfitted model must safely return None without throwing exceptions."""
    predictor = OperationalMLPredictor()
    assert not predictor.is_trained
    prob = predictor.predict_bottleneck_probability(low_risk_request)
    assert prob is None
    assert predictor.get_feature_coefficients() == {}


def test_train_and_inference_on_synthetic_data(synthetic_data_path, low_risk_request, high_risk_request):
    """Trains on synthetic benchmark and verifies inference and no data leakage."""
    assert synthetic_data_path.exists()
    with open(synthetic_data_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    samples = data["samples"]
    X_all = []
    y_all = []

    for s in samples:
        feats = s["features"]
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
        X_all.append(vec)
        y_all.append(s["bottleneck_label"])

    X_all = np.array(X_all, dtype=np.float32)
    y_all = np.array(y_all, dtype=np.int32)

    # Train / Test split to prove no data leakage
    X_train, X_test, y_train, y_test = train_test_split(
        X_all, y_all, test_size=0.3, random_state=42, stratify=y_all
    )

    predictor = OperationalMLPredictor(random_state=42)
    predictor.fit(X_train, y_train, provenance="TEST-PROVENANCE")
    assert predictor.is_trained
    assert predictor.training_provenance == "TEST-PROVENANCE"

    # Evaluate inference on test samples
    X_test_scaled = predictor.scaler.transform(X_test)
    preds = predictor.model.predict(X_test_scaled)
    assert len(preds) == len(y_test)

    # Inference on low vs high risk requests
    prob_low = predictor.predict_bottleneck_probability(low_risk_request)
    prob_high = predictor.predict_bottleneck_probability(high_risk_request)

    assert prob_low is not None
    assert prob_high is not None
    assert 0.0 <= prob_low <= 1.0
    assert 0.0 <= prob_high <= 1.0
    assert prob_high > prob_low

    # Check coefficients
    coefs = predictor.get_feature_coefficients()
    assert len(coefs) == len(FEATURE_NAMES)
    for name in FEATURE_NAMES:
        assert name in coefs


def test_artifact_store_save_and_load(tmp_path, synthetic_data_path):
    """Verifies that model state can be saved to disk and loaded without loss of accuracy."""
    with open(synthetic_data_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    samples = data["samples"]
    X = np.array([[float(v) for v in s["features"].values()] for s in samples], dtype=np.float32)
    y = np.array([s["bottleneck_label"] for s in samples], dtype=np.int32)

    original = OperationalMLPredictor(random_state=42)
    original.fit(X, y, provenance="SYNTHETIC-V1")

    model_file = str(tmp_path / "model.joblib")
    ArtifactStore.save_model(original, model_file)

    loaded = ArtifactStore.load_model(model_file)
    assert loaded is not None
    assert loaded.is_trained
    assert loaded.training_provenance == "SYNTHETIC-V1"
    assert loaded.get_feature_coefficients() == original.get_feature_coefficients()
