"""Inference: top-3 crops, K-Means cluster assignment. Raises if artefacts are missing (no fake output)."""
from functools import lru_cache
import joblib
import numpy as np
import pandas as pd
from sklearn.decomposition import PCA
from ml.preprocessing import FEATURES, MODEL_DIR


class ModelUnavailable(RuntimeError):
    pass


@lru_cache(maxsize=1)
def load_bundle():
    p = MODEL_DIR / "crop_model.joblib"
    if not p.exists():
        raise ModelUnavailable("Trained model not found. Run `python -m ml.train` first.")
    return joblib.load(p)


@lru_cache(maxsize=1)
def load_cluster():
    p = MODEL_DIR / "kmeans.joblib"
    if not p.exists():
        raise ModelUnavailable("K-Means artefact not found. Run `python -m ml.train` first.")
    c = joblib.load(p)
    bg = pd.read_csv(MODEL_DIR / "background.csv")
    pca = PCA(n_components=2, random_state=42).fit(c["scaler"].transform(bg[FEATURES]))
    return c, pca, bg


def _frame(values: dict) -> pd.DataFrame:
    return pd.DataFrame([[values[f] for f in FEATURES]], columns=FEATURES)


def predict_top_k(values: dict, k: int = 3):
    b = load_bundle()
    proba = b["model"].predict_proba(_frame(values))[0]
    idx = np.argsort(proba)[::-1][:k]
    return [{"crop": str(b["label_encoder"].classes_[i]), "probability": round(float(proba[i]), 4)} for i in idx], b


def assign_cluster(values: dict) -> dict:
    c, pca, bg = load_cluster()
    xs = c["scaler"].transform(_frame(values))
    cid = int(c["kmeans"].predict(xs)[0])
    pt = pca.transform(xs)[0]
    bgx = pca.transform(c["scaler"].transform(bg[FEATURES]))
    bgc = c["kmeans"].predict(c["scaler"].transform(bg[FEATURES]))
    return {"cluster_id": cid, "point": [round(float(pt[0]), 3), round(float(pt[1]), 3)],
            "background": [{"x": round(float(x), 3), "y": round(float(y), 3), "cluster": int(k)}
                           for (x, y), k in zip(bgx, bgc)],
            "explained_variance_2d": round(float(pca.explained_variance_ratio_.sum()), 3)}
