"""Train + compare Decision Tree, Random Forest, XGBoost; fit K-Means; save artefacts.

Run:  python -m ml.train
Model selection uses 5-fold stratified CV macro-F1 on the TRAINING split only.
The held-out test set is used once, for the final report.
"""
import json
from datetime import datetime, timezone
import joblib
import numpy as np
from sklearn.cluster import KMeans
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import silhouette_score
from sklearn.model_selection import StratifiedKFold, cross_validate
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.tree import DecisionTreeClassifier
from xgboost import XGBClassifier

from ml.evaluate import evaluate
from ml.preprocessing import FEATURES, MODEL_DIR, RANDOM_STATE, integrity_report, load_data, split


def main():
    df = load_data()
    report = integrity_report(df)
    X_train, X_test, y_train, y_test = split(df)
    le = LabelEncoder().fit(df["label"])
    ytr, yte = le.transform(y_train), le.transform(y_test)

    models = {
        "DecisionTree": DecisionTreeClassifier(random_state=RANDOM_STATE),
        "RandomForest": RandomForestClassifier(n_estimators=300, random_state=RANDOM_STATE, n_jobs=-1),
        "XGBoost": XGBClassifier(n_estimators=200, max_depth=5, learning_rate=0.1,
                                 eval_metric="mlogloss", random_state=RANDOM_STATE, n_jobs=-1),
    }
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=RANDOM_STATE)
    results = {}
    for name, model in models.items():
        scores = cross_validate(model, X_train, ytr, cv=cv, scoring=["accuracy", "f1_macro"])
        model.fit(X_train, ytr)
        test = evaluate(yte, model.predict(X_test), list(range(len(le.classes_))))
        test["labels"] = list(le.classes_)
        results[name] = {
            "cv_accuracy_mean": round(float(scores["test_accuracy"].mean()), 4),
            "cv_accuracy_std": round(float(scores["test_accuracy"].std()), 4),
            "cv_f1_macro_mean": round(float(scores["test_f1_macro"].mean()), 4),
            "test": test,
        }
        print(f"{name:13s} CV F1={results[name]['cv_f1_macro_mean']:.4f}  test acc={test['accuracy']:.4f}")

    best = max(results, key=lambda n: results[n]["cv_f1_macro_mean"])  # selected by CV, not by test set
    print("Selected:", best)

    # K-Means on scaled features (all rows; unsupervised, label not used)
    scaler = StandardScaler().fit(df[FEATURES])
    Xs = scaler.transform(df[FEATURES])
    sil = {k: round(float(silhouette_score(Xs, KMeans(k, n_init=10, random_state=RANDOM_STATE).fit_predict(Xs))), 4)
           for k in range(2, 9)}
    k_best = max(sil, key=sil.get)
    km = KMeans(k_best, n_init=10, random_state=RANDOM_STATE).fit(Xs)
    df["cluster"] = km.labels_
    profiles = df.groupby("cluster")[FEATURES].mean().round(2).to_dict(orient="index")
    top_crops = {int(c): g["label"].value_counts().head(3).to_dict() for c, g in df.groupby("cluster")}

    version = f"{best.lower()}-{datetime.now(timezone.utc):%Y%m%d}"
    joblib.dump({"model": models[best], "label_encoder": le, "features": FEATURES,
                 "model_name": best, "version": version}, MODEL_DIR / "crop_model.joblib")
    joblib.dump({"kmeans": km, "scaler": scaler, "features": FEATURES}, MODEL_DIR / "kmeans.joblib")
    # background sample for SHAP / visualisation
    df.sample(300, random_state=RANDOM_STATE)[FEATURES].to_csv(MODEL_DIR / "background.csv", index=False)

    metrics = {
        "trained_at": datetime.now(timezone.utc).isoformat(), "model_version": version,
        "selected_model": best, "dataset_integrity": report, "models": results,
        "feature_importance": dict(zip(FEATURES, map(lambda v: round(float(v), 4),
                                    getattr(models[best], "feature_importances_", [0] * len(FEATURES))))),
        "kmeans": {"silhouette_by_k": sil, "chosen_k": k_best, "cluster_profiles": profiles,
                   "top_crops_per_cluster": top_crops,
                   "pca_note": "Projection for display only."},
    }
    (MODEL_DIR / "metrics.json").write_text(json.dumps(metrics, indent=2))
    print("Saved artefacts to", MODEL_DIR)


if __name__ == "__main__":
    main()
