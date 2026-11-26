"""Run the eight-stage SoilWise workflow from the backend with python -m ml.train."""
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from tempfile import TemporaryDirectory

import joblib
from sklearn.cluster import KMeans
from sklearn.dummy import DummyClassifier
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import silhouette_score
from sklearn.model_selection import (
    GridSearchCV, RepeatedStratifiedKFold, StratifiedKFold, cross_validate,
)
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import LabelEncoder
from sklearn.tree import DecisionTreeClassifier
from threadpoolctl import threadpool_limits
from xgboost import XGBClassifier

from ml.evaluate import evaluate
from ml.preprocessing import (
    DATA_PATH, FEATURES, MODEL_DIR, RANDOM_STATE, TARGET, integrity_report,
    load_data, numeric_preprocessing, split,
)

SCORING = ("accuracy", "f1_macro")
ABLATION_FEATURES = ("rainfall", "humidity", "K")
FOLDS = 5
REPEATS = 2
TUNING_FOLDS = 3


def candidate_models():
    return {
        "MajorityBaseline": DummyClassifier(strategy="most_frequent"),
        "DecisionTree": DecisionTreeClassifier(random_state=RANDOM_STATE),
        "RandomForest": RandomForestClassifier(n_estimators=300, random_state=RANDOM_STATE, n_jobs=4),
        "XGBoost": XGBClassifier(n_estimators=200, max_depth=5, learning_rate=0.1,
                                 eval_metric="mlogloss", random_state=RANDOM_STATE, n_jobs=4),
    }


PARAMETER_GRIDS = {
    "DecisionTree": {"model__max_depth": [None, 12], "model__min_samples_leaf": [1, 2]},
    "RandomForest": {"model__max_depth": [None, 12], "model__min_samples_leaf": [1, 2]},
    "XGBoost": {"model__max_depth": [3, 5], "model__learning_rate": [0.1, 0.2]},
}


def summarize(scores):
    return {
        f"cv_{score}_{stat}": float(getattr(scores[f"test_{score}"], stat)())
        for score in SCORING
        for stat in ("mean", "std")
    }


def train_classifier(X_train, y_train):
    repeated = RepeatedStratifiedKFold(n_splits=FOLDS, n_repeats=REPEATS,
                                      random_state=RANDOM_STATE)
    pipelines = {
        name: Pipeline([("preprocessing", numeric_preprocessing()), ("model", model)])
        for name, model in candidate_models().items()
    }
    results = {
        name: summarize(cross_validate(pipeline, X_train, y_train, cv=repeated, scoring=SCORING))
        for name, pipeline in pipelines.items()
    }
    best = max(PARAMETER_GRIDS, key=lambda name: results[name]["cv_f1_macro_mean"])
    print(f"Stage 4: compared {len(results)} models. Selected {best} by repeated CV macro-F1.", flush=True)

    # The nested scores describe tuning within the family selected above.
    grid = PARAMETER_GRIDS[best]
    inner = StratifiedKFold(TUNING_FOLDS, shuffle=True, random_state=RANDOM_STATE)
    outer = StratifiedKFold(TUNING_FOLDS, shuffle=True, random_state=RANDOM_STATE + 1)
    search = GridSearchCV(pipelines[best], grid, scoring="f1_macro", cv=inner, error_score="raise")
    scores = cross_validate(search, X_train, y_train, cv=outer, scoring=SCORING,
                            return_estimator=True, error_score="raise")
    search.fit(X_train, y_train)
    tuning = {
        "model": best,
        "parameter_grid": grid,
        "best_parameters": search.best_params_,
        "full_training_inner_macro_f1": float(search.best_score_),
        "outer_cv": summarize(scores),
        "outer_best_parameters": [fold.best_params_ for fold in scores["estimator"]],
        "inner_folds": TUNING_FOLDS,
        "outer_folds": TUNING_FOLDS,
        "inner_seed": RANDOM_STATE,
        "outer_seed": RANDOM_STATE + 1,
    }
    print(f"Stage 5: nested grid search selected {search.best_params_}.", flush=True)

    ablation_cv = StratifiedKFold(FOLDS, shuffle=True, random_state=RANDOM_STATE)
    ablation = {}
    for condition in ("all_features", *ABLATION_FEATURES):
        features = X_train if condition == "all_features" else X_train.drop(columns=condition)
        ablation[condition] = summarize(
            cross_validate(search.best_estimator_, features, y_train, cv=ablation_cv, scoring=SCORING)
        )
    reference = ablation["all_features"]["cv_f1_macro_mean"]
    for result in ablation.values():
        result["delta_macro_f1"] = result["cv_f1_macro_mean"] - reference
    print("Stage 6: finished feature ablation.", flush=True)
    return best, search.best_estimator_, results, tuning, ablation


def train_clusters(X_train, y_train):
    scaler = numeric_preprocessing()
    scaled = scaler.fit_transform(X_train)
    candidates = {
        k: KMeans(k, n_init=10, random_state=RANDOM_STATE).fit(scaled)
        for k in range(2, 9)
    }
    silhouette = {k: float(silhouette_score(scaled, model.labels_))
                  for k, model in candidates.items()}
    chosen = max(silhouette, key=silhouette.get)
    model = candidates[chosen]
    assigned = X_train.assign(cluster=model.labels_, label=y_train)
    profiles = assigned.groupby("cluster")[FEATURES].mean().round(2).to_dict(orient="index")
    top_crops = {int(k): group[TARGET].value_counts().head(3).to_dict()
                 for k, group in assigned.groupby("cluster")}
    return {"kmeans": model, "scaler": scaler, "features": FEATURES}, {
        "silhouette_by_k": {k: round(v, 4) for k, v in silhouette.items()},
        "chosen_k": chosen,
        "cluster_profiles": profiles,
        "top_crops_per_cluster": top_crops,
        "pca_note": "Projection of a training sample for display only.",
    }


def main():
    data = load_data()
    X_train, X_test, y_train, y_test = split(data)
    encoder = LabelEncoder().fit(y_train)
    encoded_train = encoder.transform(y_train)
    training_integrity = integrity_report(X_train.assign(label=y_train))
    eda = {
        "class_counts": y_train.value_counts().sort_index().to_dict(),
        "feature_summary": X_train.describe().round(4).to_dict(),
        "correlations": X_train.corr().round(4).to_dict(),
    }
    print(f"Stages 1–3: {len(X_train)} training rows, {len(X_test)} held-out rows.", flush=True)
    # Keep native thread counts bounded during repeated fitting and K-Means.
    with threadpool_limits(limits=4):
        best, pipeline, results, tuning, ablation = train_classifier(X_train, encoded_train)
        cluster_bundle, cluster_metrics = train_clusters(X_train, y_train)

    # The single held-out inference call provides both hard predictions and ROC scores.
    probabilities = pipeline.predict_proba(X_test)
    results[best]["test"] = evaluate(encoder.transform(y_test), probabilities,
                                     pipeline.classes_, encoder.classes_)
    print(f"Stage 7: {best} held-out accuracy {results[best]['test']['accuracy']:.4f}.", flush=True)

    trained_at = datetime.now(timezone.utc)
    version = f"{best.lower()}-{trained_at:%Y%m%dT%H%M%SZ}"
    model = pipeline.steps[-1][1]
    bundle = {"model": pipeline, "label_encoder": encoder, "features": FEATURES,
              "model_name": best, "version": version}
    metrics = {
        "trained_at": trained_at.isoformat(),
        "model_version": version,
        "selected_model": best,
        "dataset_integrity": integrity_report(data),
        "training_integrity": training_integrity,
        "training_eda": eda,
        "split": {"random_state": RANDOM_STATE, "test_fraction": 0.2,
                  "training_rows": len(X_train), "test_rows": len(X_test),
                  "dataset_sha256": hashlib.sha256(DATA_PATH.read_bytes()).hexdigest()},
        "validation": {"folds": FOLDS, "repeats": REPEATS, "random_state": RANDOM_STATE},
        "models": results,
        "tuning": tuning,
        "ablation": ablation,
        "feature_importance": dict(zip(FEATURES, model.feature_importances_.round(4).tolist())),
        "kmeans": cluster_metrics,
    }
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    with TemporaryDirectory(dir=MODEL_DIR) as directory:
        staging = Path(directory)
        joblib.dump(bundle, staging / "crop_model.joblib")
        joblib.dump(cluster_bundle, staging / "kmeans.joblib")
        X_train.sample(min(300, len(X_train)), random_state=RANDOM_STATE).to_csv(
            staging / "background.csv", index=False
        )
        (staging / "metrics.json").write_text(json.dumps(metrics, indent=2, allow_nan=False), encoding="utf-8")
        for name in ("crop_model.joblib", "kmeans.joblib", "background.csv", "metrics.json"):
            (staging / name).replace(MODEL_DIR / name)
    print(f"Stage 8: saved artifacts to {MODEL_DIR}.", flush=True)


if __name__ == "__main__":
    main()
