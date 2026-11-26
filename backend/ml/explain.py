"""SHAP explanations for the selected tree-based model."""
from functools import lru_cache
import numpy as np
import shap
from sklearn.pipeline import Pipeline
from ml.predict import _frame, load_bundle
from ml.preprocessing import FEATURES


@lru_cache(maxsize=1)
def _explainer():
    model = load_bundle()["model"]
    return shap.TreeExplainer(model.steps[-1][1] if isinstance(model, Pipeline) else model)


def explain(values: dict, crop: str) -> dict:
    """SHAP contribution of each feature to the model's score for `crop`.
    Positive = pushes the prediction towards this crop; negative = away from it."""
    b = load_bundle()
    cls = int(np.where(b["label_encoder"].classes_ == crop)[0][0])
    model = b["model"]
    frame = _frame(values)
    inputs = model[:-1].transform(frame) if isinstance(model, Pipeline) else frame
    sv = _explainer().shap_values(inputs)
    # Older SHAP releases return one array per class.
    contrib = sv[cls][0] if isinstance(sv, list) else sv[0, :, cls]
    items = sorted(({"feature": f, "value": float(values[f]), "shap": round(float(c), 4)}
                    for f, c in zip(FEATURES, contrib)), key=lambda d: -abs(d["shap"]))
    return {"crop": crop, "contributions": items,
            "note": "SHAP values describe how this model used each input. They are not agronomic causation."}
