"""Data loading, integrity checks and splitting for the crop dataset."""
from pathlib import Path
import pandas as pd
from sklearn.impute import SimpleImputer
from sklearn.model_selection import train_test_split
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

ROOT = Path(__file__).resolve().parent.parent
DATA_PATH = ROOT / "datasets" / "crop_recommendation.csv"
MODEL_DIR = ROOT / "saved_models"
FEATURES = ["N", "P", "K", "temperature", "humidity", "ph", "rainfall"]
TARGET = "label"
RANDOM_STATE = 42


def load_data(path: Path = DATA_PATH) -> pd.DataFrame:
    df = pd.read_csv(path)
    missing = set(FEATURES + [TARGET]) - set(df.columns)
    if missing:
        raise ValueError(f"Dataset is missing columns: {missing}")
    return df


def integrity_report(df: pd.DataFrame) -> dict:
    """Checks demanded by the project spec: missing, duplicates, balance, outliers, ranges."""
    q1, q3 = df[FEATURES].quantile(0.25), df[FEATURES].quantile(0.75)
    iqr = q3 - q1
    outliers = ((df[FEATURES] < q1 - 1.5 * iqr) | (df[FEATURES] > q3 + 1.5 * iqr)).sum()
    return {
        "rows": int(len(df)),
        "missing_values": int(df.isna().sum().sum()),
        "duplicate_rows": int(df.duplicated().sum()),
        "n_classes": int(df[TARGET].nunique()),
        "samples_per_class_min_max": [int(df[TARGET].value_counts().min()), int(df[TARGET].value_counts().max())],
        "iqr_outlier_counts": {k: int(v) for k, v in outliers.items()},
        "feature_ranges": {c: [round(float(df[c].min()), 2), round(float(df[c].max()), 2)] for c in FEATURES},
    }


def split(df: pd.DataFrame):
    """Stratified 80/20 split. The test set is untouched until final evaluation (no leakage)."""
    return train_test_split(df[FEATURES], df[TARGET], test_size=0.2,
                            stratify=df[TARGET], random_state=RANDOM_STATE)


def numeric_preprocessing():
    """Each fit learns its own imputation and scaling values from the supplied rows."""
    return make_pipeline(SimpleImputer(strategy="median", keep_empty_features=True), StandardScaler())
