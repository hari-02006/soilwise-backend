"""SHAP explanations for the selected tree-based model."""
from functools import lru_cache
import numpy as np
import shap
from ml.predict import _frame, load_bundle
from ml.preprocessing import FEATURES


@lru_cache(maxsize=1)
def _explainer():
    return shap.TreeExplainer(load_bundle()["model"])


def explain(values: dict, crop: str) -> dict:
    """SHAP contribution of each feature to the model's score for `crop`.
    Positive = pushes the prediction towards this crop; negative = away from it."""
    b = load_bundle()
    cls = int(np.where(b["label_encoder"].classes_ == crop)[0][0])
    sv = _explainer().shap_values(_frame(values))
    sv = np.asarray(sv)
    # shap returns (n, features, classes) in new versions, list[class] -> (n, features) in old ones
    contrib = sv[0, :, cls] if sv.ndim == 3 else sv[cls][0]
    items = sorted(({"feature": f, "value": float(values[f]), "shap": round(float(c), 4)}
                    for f, c in zip(FEATURES, contrib)), key=lambda d: -abs(d["shap"]))
    return {"crop": crop, "contributions": items,
            "note": "SHAP values describe how this model used each input. They are not agronomic causation."}
