"""Orchestrates one full analysis: validation warnings, screening, ML, clustering, SHAP."""
from ml.explain import explain
from ml.predict import assign_cluster, load_bundle, predict_top_k
from ml.preprocessing import FEATURES
from app.services.soil_health import screen
import json
from ml.preprocessing import MODEL_DIR


def _metrics():
    p = MODEL_DIR / "metrics.json"
    return json.loads(p.read_text()) if p.exists() else {}


def range_warnings(values: dict) -> list[str]:
    metrics = _metrics()
    rng = metrics.get("training_integrity", metrics.get("dataset_integrity", {})).get("feature_ranges", {})
    w = []
    for f, v in values.items():
        if f in rng and not (rng[f][0] <= v <= rng[f][1]):
            w.append(f"{f}={v} lies outside the training range {rng[f]}; the prediction is an extrapolation.")
    return w


def crop_recommend(values: dict, with_explanation=True) -> dict:
    top, b = predict_top_k(values, 3)
    m = _metrics()
    sel = m.get("models", {}).get(b["model_name"], {})
    res = {"top_crops": top, "model": b["model_name"], "model_version": b["version"],
           "model_test_accuracy": sel.get("test", {}).get("accuracy"),
           "warnings": range_warnings(values),
           "probability_note": "Probabilities are the model's class scores learned from a (largely synthetic-like, balanced) "
                               "dataset. They are not a guarantee or yield forecast."}
    if with_explanation:
        res["explanations"] = [explain(values, t["crop"]) for t in top[:1]]
        res["explanation_text"] = _text(top[0], res["explanations"][0])
        res["cluster"] = assign_cluster(values)
    return res


def _text(top, ex):
    pos = [c for c in ex["contributions"] if c["shap"] > 0][:2]
    neg = [c for c in ex["contributions"] if c["shap"] < 0][:1]
    s = f"{top['crop'].title()} ranked first with model score {top['probability']:.0%}. "
    if pos: s += "Inputs pushing towards it most: " + ", ".join(f"{c['feature']}={c['value']:.1f}" for c in pos) + ". "
    if neg: s += f"Strongest opposing input: {neg[0]['feature']}={neg[0]['value']:.1f}."
    return s


def full_analysis(d: dict) -> dict:
    result = {"soil_health": screen(d)}
    values = {f: d.get(f) for f in FEATURES}
    missing = [f for f, v in values.items() if v is None]
    if missing:
        result["crop_recommendations"] = None
        result["crop_recommendation_skipped"] = f"ML model needs all 7 inputs; missing: {', '.join(missing)}."
    else:
        rec = crop_recommend(values)
        if d.get("npk_unit") == "kg_per_ha":
            rec["warnings"].append("N/P/K were given in kg/ha but the model was trained on the dataset's own N/P/K scale "
                                   "(units undocumented). Treat the crop ranking as unreliable.")
        result["crop_recommendations"] = rec
    return result
