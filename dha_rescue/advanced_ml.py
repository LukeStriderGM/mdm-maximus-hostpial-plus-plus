"""
Advanced ML workflow for DHA RESCUE.

Features:
- Preprocessing with categorical + numeric features
- Cross-validated model comparison
- Best-model selection for classification/regression
- Holdout metrics
- Artifact saving

Usage:
    python advanced_ml.py --samples 5000 --outdir outputs/ml
"""

from __future__ import annotations

import argparse
import json
import pickle
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    f1_score,
    mean_absolute_error,
    mean_squared_error,
    precision_score,
    r2_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import KFold, StratifiedKFold, cross_validate, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
try:
    import xgboost as xgb
except ImportError:  # pragma: no cover - runtime dependency optional
    xgb = None

from data import generate_synthetic_data
from utils import engineer_features


def build_feature_sets(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.Series, pd.Series, list[str], list[str]]:
    target_cols = {"failure", "time_to_failure"}
    excluded = {"node_id", "node_name"}
    feature_cols = [c for c in df.columns if c not in target_cols and c not in excluded]

    X = df[feature_cols].copy()
    y_cls = df["failure"].astype(int)
    y_reg = df["time_to_failure"].astype(float)

    numeric_cols = X.select_dtypes(include=["number"]).columns.tolist()
    categorical_cols = [c for c in X.columns if c not in numeric_cols]
    return X, y_cls, y_reg, numeric_cols, categorical_cols


def make_preprocessor(numeric_cols: list[str], categorical_cols: list[str]) -> ColumnTransformer:
    numeric_pipe = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="median")),
            ("scaler", StandardScaler()),
        ]
    )
    categorical_pipe = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="most_frequent")),
            ("onehot", OneHotEncoder(handle_unknown="ignore")),
        ]
    )
    return ColumnTransformer(
        transformers=[
            ("num", numeric_pipe, numeric_cols),
            ("cat", categorical_pipe, categorical_cols),
        ]
    )


def compare_classifiers(
    X_train: pd.DataFrame,
    y_train: pd.Series,
    preprocessor: ColumnTransformer,
    cv_splits: int,
) -> tuple[pd.DataFrame, str]:
    models = {
        "logistic_regression": LogisticRegression(max_iter=2000, class_weight="balanced"),
        "random_forest_cls": RandomForestClassifier(
            n_estimators=300,
            random_state=42,
            n_jobs=1,
            class_weight="balanced",
        ),
    }
    if xgb is not None:
        models["xgboost_cls"] = xgb.XGBClassifier(
            n_estimators=300,
            max_depth=6,
            learning_rate=0.05,
            subsample=0.9,
            colsample_bytree=0.9,
            random_state=42,
            eval_metric="logloss",
        )

    rows = []
    skf = StratifiedKFold(n_splits=cv_splits, shuffle=True, random_state=42)
    scoring = {"roc_auc": "roc_auc", "f1": "f1", "precision": "precision", "recall": "recall"}

    for name, estimator in models.items():
        pipe = Pipeline(steps=[("prep", preprocessor), ("model", estimator)])
        scores = cross_validate(pipe, X_train, y_train, cv=skf, scoring=scoring, n_jobs=1)
        rows.append(
            {
                "model": name,
                "cv_roc_auc_mean": float(np.mean(scores["test_roc_auc"])),
                "cv_f1_mean": float(np.mean(scores["test_f1"])),
                "cv_precision_mean": float(np.mean(scores["test_precision"])),
                "cv_recall_mean": float(np.mean(scores["test_recall"])),
            }
        )

    results = pd.DataFrame(rows).sort_values("cv_roc_auc_mean", ascending=False).reset_index(drop=True)
    best_name = results.iloc[0]["model"]
    return results, best_name


def compare_regressors(
    X_train: pd.DataFrame,
    y_train: pd.Series,
    preprocessor: ColumnTransformer,
    cv_splits: int,
) -> tuple[pd.DataFrame, str]:
    models = {
        "random_forest_reg": RandomForestRegressor(n_estimators=400, random_state=42, n_jobs=1),
    }
    if xgb is not None:
        models["xgboost_reg"] = xgb.XGBRegressor(
            n_estimators=400,
            max_depth=6,
            learning_rate=0.05,
            subsample=0.9,
            colsample_bytree=0.9,
            random_state=42,
        )

    rows = []
    kf = KFold(n_splits=cv_splits, shuffle=True, random_state=42)
    scoring = {"rmse": "neg_root_mean_squared_error", "mae": "neg_mean_absolute_error", "r2": "r2"}

    for name, estimator in models.items():
        pipe = Pipeline(steps=[("prep", preprocessor), ("model", estimator)])
        scores = cross_validate(pipe, X_train, y_train, cv=kf, scoring=scoring, n_jobs=1)
        rows.append(
            {
                "model": name,
                "cv_rmse_mean": float(-np.mean(scores["test_rmse"])),
                "cv_mae_mean": float(-np.mean(scores["test_mae"])),
                "cv_r2_mean": float(np.mean(scores["test_r2"])),
            }
        )

    results = pd.DataFrame(rows).sort_values("cv_rmse_mean", ascending=True).reset_index(drop=True)
    best_name = results.iloc[0]["model"]
    return results, best_name


def build_classifier(name: str):
    if name == "logistic_regression":
        return LogisticRegression(max_iter=2000, class_weight="balanced")
    if name == "random_forest_cls":
        return RandomForestClassifier(n_estimators=300, random_state=42, n_jobs=1, class_weight="balanced")
    if name == "xgboost_cls":
        if xgb is None:
            raise ValueError("xgboost is not installed; cannot build xgboost_cls.")
        return xgb.XGBClassifier(
            n_estimators=300,
            max_depth=6,
            learning_rate=0.05,
            subsample=0.9,
            colsample_bytree=0.9,
            random_state=42,
            eval_metric="logloss",
        )
    raise ValueError(f"Unknown classifier: {name}")


def build_regressor(name: str):
    if name == "random_forest_reg":
        return RandomForestRegressor(n_estimators=400, random_state=42, n_jobs=1)
    if name == "xgboost_reg":
        if xgb is None:
            raise ValueError("xgboost is not installed; cannot build xgboost_reg.")
        return xgb.XGBRegressor(
            n_estimators=400,
            max_depth=6,
            learning_rate=0.05,
            subsample=0.9,
            colsample_bytree=0.9,
            random_state=42,
        )
    raise ValueError(f"Unknown regressor: {name}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run advanced ML workflow for DHA RESCUE.")
    parser.add_argument("--samples", type=int, default=5000, help="Number of synthetic rows to generate.")
    parser.add_argument("--test-size", type=float, default=0.2, help="Holdout test split fraction.")
    parser.add_argument("--cv", type=int, default=5, help="Cross-validation folds.")
    parser.add_argument("--outdir", type=Path, default=Path("outputs/ml"), help="Output directory.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    args.outdir.mkdir(parents=True, exist_ok=True)

    df = engineer_features(generate_synthetic_data(args.samples))
    X, y_cls, y_reg, numeric_cols, categorical_cols = build_feature_sets(df)

    X_train, X_test, y_cls_train, y_cls_test, y_reg_train, y_reg_test = train_test_split(
        X, y_cls, y_reg, test_size=args.test_size, random_state=42, stratify=y_cls
    )

    preprocessor = make_preprocessor(numeric_cols, categorical_cols)

    if xgb is None:
        print("Warning: xgboost not installed. Running sklearn-only model comparison.")

    cls_cv, best_cls_name = compare_classifiers(X_train, y_cls_train, preprocessor, args.cv)
    reg_cv, best_reg_name = compare_regressors(X_train, y_reg_train, preprocessor, args.cv)

    best_cls = Pipeline(steps=[("prep", preprocessor), ("model", build_classifier(best_cls_name))])
    best_reg = Pipeline(steps=[("prep", preprocessor), ("model", build_regressor(best_reg_name))])
    best_cls.fit(X_train, y_cls_train)
    best_reg.fit(X_train, y_reg_train)

    y_cls_pred = best_cls.predict(X_test)
    y_cls_prob = best_cls.predict_proba(X_test)[:, 1]
    y_reg_pred = best_reg.predict(X_test)

    holdout_metrics = {
        "classification": {
            "best_model": best_cls_name,
            "accuracy": float(accuracy_score(y_cls_test, y_cls_pred)),
            "precision": float(precision_score(y_cls_test, y_cls_pred)),
            "recall": float(recall_score(y_cls_test, y_cls_pred)),
            "f1": float(f1_score(y_cls_test, y_cls_pred)),
            "roc_auc": float(roc_auc_score(y_cls_test, y_cls_prob)),
        },
        "regression": {
            "best_model": best_reg_name,
            "mae": float(mean_absolute_error(y_reg_test, y_reg_pred)),
            "rmse": float(np.sqrt(mean_squared_error(y_reg_test, y_reg_pred))),
            "r2": float(r2_score(y_reg_test, y_reg_pred)),
        },
    }

    cls_cv_path = args.outdir / "classification_cv_results.csv"
    reg_cv_path = args.outdir / "regression_cv_results.csv"
    metrics_path = args.outdir / "holdout_metrics.json"
    artifact_path = args.outdir / "advanced_models.pkl"

    cls_cv.to_csv(cls_cv_path, index=False)
    reg_cv.to_csv(reg_cv_path, index=False)
    metrics_path.write_text(json.dumps(holdout_metrics, indent=2), encoding="utf-8")

    artifact = {
        "classifier_pipeline": best_cls,
        "regressor_pipeline": best_reg,
        "numeric_columns": numeric_cols,
        "categorical_columns": categorical_cols,
        "best_classifier_name": best_cls_name,
        "best_regressor_name": best_reg_name,
    }
    with artifact_path.open("wb") as f:
        pickle.dump(artifact, f)

    print("\nAdvanced ML workflow complete.")
    print(f" - Classification CV results: {cls_cv_path}")
    print(f" - Regression CV results: {reg_cv_path}")
    print(f" - Holdout metrics: {metrics_path}")
    print(f" - Saved artifact: {artifact_path}")
    print("\nBest models:")
    print(f" - Classification: {best_cls_name}")
    print(f" - Regression: {best_reg_name}")


if __name__ == "__main__":
    main()
