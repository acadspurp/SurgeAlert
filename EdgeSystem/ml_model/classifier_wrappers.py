"""Picklable classifier wrappers for joblib bundles (used by train + AlertManager)."""
import numpy as np


class SurgeAlertClassifier:
    """Blend 4-class probs with a binary any-alert detector."""

    def __init__(self, multiclass, detector, blend: float = 0.35):
        self.multiclass = multiclass
        self.detector = detector
        self.blend = float(blend)

    def predict_proba(self, X):
        P = np.asarray(self.multiclass.predict_proba(X), dtype=float)
        p_alert = self.detector.predict_proba(X)[:, 1]
        scale = 1.0 + self.blend * p_alert
        P[:, 1:4] *= scale[:, np.newaxis]
        return P / P.sum(axis=1, keepdims=True)

    def predict(self, X):
        return np.argmax(self.predict_proba(X), axis=1)


class EnsembleSurgeClassifier:
    def __init__(self, models: list):
        self.models = models

    def predict_proba(self, X):
        stacks = [m.predict_proba(X) for m in self.models]
        return np.mean(stacks, axis=0)

    def predict(self, X):
        return np.argmax(self.predict_proba(X), axis=1)
