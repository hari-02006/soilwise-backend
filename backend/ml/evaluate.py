"""Held-out classification metrics and one-vs-rest ROC curves."""
import numpy as np
from sklearn.metrics import (
    accuracy_score, auc, confusion_matrix, precision_recall_fscore_support, roc_curve,
)


def _roc(expected, scores):
    fpr, tpr, _ = roc_curve(expected, scores)
    return {"fpr": fpr.tolist(), "tpr": tpr.tolist(), "auc": float(auc(fpr, tpr))}


def evaluate(y_true, probabilities, classes, labels):
    predictions = classes[np.argmax(probabilities, axis=1)]
    precision, recall, f1, _ = precision_recall_fscore_support(
        y_true, predictions, labels=classes, average="macro", zero_division=0
    )
    indicator = y_true[:, None] == classes[None, :]
    curves = {str(label): _roc(indicator[:, i], probabilities[:, i])
              for i, label in enumerate(labels)}
    return {
        "accuracy": round(float(accuracy_score(y_true, predictions)), 4),
        "precision_macro": round(float(precision), 4),
        "recall_macro": round(float(recall), 4),
        "f1_macro": round(float(f1), 4),
        "confusion_matrix": confusion_matrix(y_true, predictions, labels=classes).tolist(),
        "labels": labels.tolist(),
        "roc": {
            "strategy": "one-vs-rest",
            "macro_auc": float(np.mean([curve["auc"] for curve in curves.values()])),
            "micro_average": _roc(indicator.ravel(), probabilities.ravel()),
            "per_class": curves,
        },
    }
