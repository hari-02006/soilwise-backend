"""Evaluation helpers: metrics + confusion matrix."""
import numpy as np
from sklearn.metrics import (accuracy_score, precision_recall_fscore_support, confusion_matrix)


def evaluate(y_true, y_pred, labels):
    p, r, f, _ = precision_recall_fscore_support(y_true, y_pred, average="macro", zero_division=0)
    return {
        "accuracy": round(float(accuracy_score(y_true, y_pred)), 4),
        "precision_macro": round(float(p), 4),
        "recall_macro": round(float(r), 4),
        "f1_macro": round(float(f), 4),
        "confusion_matrix": confusion_matrix(y_true, y_pred, labels=labels).tolist(),
        "labels": list(labels),
    }
