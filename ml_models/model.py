"""
DHA RESCUE: ML Model Training and Prediction
============================================
Primary model module used by the Streamlit app.

Behavior:
- Uses XGBoost when available
- Falls back to RandomForest when XGBoost is unavailable
- Supports EBM backend for a single explainable artifact
- Uses SHAP explanations when available, otherwise proxy explanations
"""

from __future__ import annotations

import pickle
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.metrics import (
    accuracy_score,
    f1_score,
    mean_absolute_error,
    mean_squared_error,
    precision_score,
    r2_score,
    recall_score,
)
from sklearn.model_selection import train_test_split

try:
    import xgboost as xgb
except ImportError:  # pragma: no cover
    xgb = None

try:
    import shap
except ImportError:  # pragma: no cover
    shap = None

try:
    from interpret.glassbox import ExplainableBoostingClassifier, ExplainableBoostingRegressor
except ImportError:  # pragma: no cover
    ExplainableBoostingClassifier = None
    ExplainableBoostingRegressor = None


class BloodLogisticsModel:
    """ML model for blood logistics failure prediction."""

    def __init__(self, backend: str = "auto"):
        self.classifier = None
        self.regressor = None
        self.explainer = None
        self.shap_values = None
        self.feature_names = None
        self.feature_means = None
        self.feature_stds = None
        self.is_trained = False
        self.classifier_name = None
        self.regressor_name = None
        self.backend = backend
        self.shap_backend = None
        self.shap_index = None

    def _coerce_shap_matrix(self, shap_output) -> np.ndarray | None:
        """Normalize SHAP output into shape (n_samples, n_features)."""
        if shap_output is None:
            return None

        if isinstance(shap_output, list):
            chosen = shap_output[1] if len(shap_output) > 1 else shap_output[0]
            arr = np.asarray(chosen)
        else:
            arr = np.asarray(shap_output)

        if arr.ndim == 1:
            return arr.reshape(1, -1)
        if arr.ndim == 2:
            return arr
        if arr.ndim == 3:
            # Common shapes:
            # - (n_samples, n_features, n_classes)
            # - (n_samples, n_classes, n_features)
            if arr.shape[1] == len(self.feature_names):
                class_idx = 1 if arr.shape[2] > 1 else 0
                return arr[:, :, class_idx]
            if arr.shape[2] == len(self.feature_names):
                class_idx = 1 if arr.shape[1] > 1 else 0
                return arr[:, class_idx, :]
        return None

    def prepare_data(self, df: pd.DataFrame):
        """Prepare features and labels for training."""
        self.feature_names = [
            "inventory_units",
            "expiry_hours_remaining",
            "temperature_excursion_flag",
            "transport_delay_hours",
            "route_reliability_score",
            "demand_rate",
            "casualty_rate",
            "cold_chain_health_score",
            "backup_supply_available",
            "days_of_supply",
            "expiry_risk",
            "transport_risk",
            "viability_score",
            "risk_composite",
        ]

        X = df[self.feature_names].copy()
        y_classification = df["failure"].astype(int).values
        y_regression = df["time_to_failure"].astype(float).values
        return X, y_classification, y_regression

    def _init_models(self, random_state: int, backend: str | None = None) -> None:
        selected = (backend or self.backend or "auto").lower()

        if selected in {"ebm", "auto"} and ExplainableBoostingClassifier is not None and ExplainableBoostingRegressor is not None:
            self.classifier = ExplainableBoostingClassifier(
                interactions=0,
                random_state=random_state,
                n_jobs=1,
            )
            self.regressor = ExplainableBoostingRegressor(
                interactions=0,
                random_state=random_state,
                n_jobs=1,
            )
            self.classifier_name = "ebm_classifier"
            self.regressor_name = "ebm_regressor"
            self.backend = "ebm"
            return

        if selected in {"xgb", "xgboost", "auto"} and xgb is not None:
            self.classifier = xgb.XGBClassifier(
                n_estimators=200,
                max_depth=6,
                learning_rate=0.08,
                subsample=0.8,
                colsample_bytree=0.8,
                random_state=random_state,
                eval_metric="logloss",
            )
            self.regressor = xgb.XGBRegressor(
                n_estimators=200,
                max_depth=6,
                learning_rate=0.08,
                subsample=0.8,
                colsample_bytree=0.8,
                random_state=random_state,
            )
            self.classifier_name = "xgboost_classifier"
            self.regressor_name = "xgboost_regressor"
            self.backend = "xgboost"
        else:
            self.classifier = RandomForestClassifier(
                n_estimators=300,
                random_state=random_state,
                n_jobs=1,
                class_weight="balanced",
            )
            self.regressor = RandomForestRegressor(
                n_estimators=300,
                random_state=random_state,
                n_jobs=1,
            )
            self.classifier_name = "random_forest_classifier"
            self.regressor_name = "random_forest_regressor"
            self.backend = "random_forest"

    def _compute_explanations(self, X_background: pd.DataFrame) -> None:
        """Initialize explainability backend."""
        self.explainer = None
        self.shap_values = None
        self.shap_backend = None
        self.shap_index = None

        # For EBM, use model-agnostic SHAP when available.
        if self.backend == "ebm":
            if shap is None:
                return
            try:
                bg = X_background.sample(n=min(50, len(X_background)), random_state=42)
                eval_rows = X_background.sample(n=min(120, len(X_background)), random_state=43)

                def _pred_fn(arr):
                    arr_df = pd.DataFrame(arr, columns=self.feature_names)
                    return self.classifier.predict_proba(arr_df)[:, 1]

                self.explainer = shap.KernelExplainer(_pred_fn, bg.values)
                raw_sv = self.explainer.shap_values(eval_rows.values)
                self.shap_values = self._coerce_shap_matrix(raw_sv)
                self.shap_index = eval_rows.index.to_numpy()
                self.shap_backend = "kernel"
            except Exception:
                self.explainer = None
                self.shap_values = None
                self.shap_index = None
                self.shap_backend = None
            return

        if shap is None:
            return
        try:
            self.explainer = shap.TreeExplainer(self.classifier)
            raw_sv = self.explainer.shap_values(X_background)
            self.shap_values = self._coerce_shap_matrix(raw_sv)
            self.shap_backend = "tree"
        except Exception:
            self.explainer = None
            self.shap_values = None
            self.shap_backend = None

    def train(self, df: pd.DataFrame, test_size: float = 0.2, random_state: int = 42, backend: str | None = None):
        """Train both classification and regression models."""
        print("=" * 60)
        print("DHA RESCUE: Training ML Models")
        print("=" * 60)

        X, y_class, y_reg = self.prepare_data(df)
        X_train, X_test, y_class_train, y_class_test, y_reg_train, y_reg_test = train_test_split(
            X,
            y_class,
            y_reg,
            test_size=test_size,
            random_state=random_state,
            stratify=y_class,
        )

        self.feature_means = X_train.mean(numeric_only=True).reindex(self.feature_names).fillna(0.0)
        self.feature_stds = X_train.std(numeric_only=True).reindex(self.feature_names).replace(0, 1.0).fillna(1.0)

        print(f"\nTraining set: {len(X_train)} samples")
        print(f"Test set: {len(X_test)} samples")

        self._init_models(random_state=random_state, backend=backend)

        print(f"\n[1/3] Training classifier: {self.classifier_name}")
        self.classifier.fit(X_train, y_class_train)
        y_class_pred = self.classifier.predict(X_test)
        print(f"   Accuracy: {accuracy_score(y_class_test, y_class_pred):.4f}")
        print(f"   Precision: {precision_score(y_class_test, y_class_pred, zero_division=0):.4f}")
        print(f"   Recall: {recall_score(y_class_test, y_class_pred, zero_division=0):.4f}")
        print(f"   F1 Score: {f1_score(y_class_test, y_class_pred, zero_division=0):.4f}")

        print(f"\n[2/3] Training regressor: {self.regressor_name}")
        self.regressor.fit(X_train, y_reg_train)
        y_reg_pred = self.regressor.predict(X_test)
        print(f"   MAE: {mean_absolute_error(y_reg_test, y_reg_pred):.2f} hours")
        print(f"   RMSE: {np.sqrt(mean_squared_error(y_reg_test, y_reg_pred)):.2f} hours")
        print(f"   R2 Score: {r2_score(y_reg_test, y_reg_pred):.4f}")

        print("\n[3/3] Initializing explainability...")
        self._compute_explanations(X_test)
        if self.backend == "ebm":
            print("   EBM native explanations available.")
        elif self.shap_values is not None:
            print(f"   SHAP values computed for {len(self.shap_values)} samples")
        else:
            print("   SHAP unavailable; using model-based proxy explanations.")

        self.is_trained = True
        print("\nTraining complete.")
        return self

    def predict_failure(self, X: pd.DataFrame) -> np.ndarray:
        if not self.is_trained:
            raise ValueError("Model not trained. Call train() first.")
        return self.classifier.predict_proba(X)[:, 1]

    def predict_time_to_failure(self, X: pd.DataFrame) -> np.ndarray:
        if not self.is_trained:
            raise ValueError("Model not trained. Call train() first.")
        return self.regressor.predict(X)

    def predict(self, df: pd.DataFrame) -> pd.DataFrame:
        """Make complete predictions for a DataFrame."""
        if not self.is_trained:
            raise ValueError("Model not trained. Call train() first.")

        X = df[self.feature_names].copy()
        predictions = pd.DataFrame(
            {
                "node_id": df["node_id"],
                "node_name": df["node_name"],
                "failure_probability": self.predict_failure(X),
                "time_to_failure_hours": self.predict_time_to_failure(X),
            }
        )
        predictions["risk_level"] = predictions["failure_probability"].apply(
            lambda x: "HIGH" if x > 0.5 else ("MEDIUM" if x > 0.2 else "LOW")
        )
        return predictions

    def _feature_importance_vector(self) -> np.ndarray:
        if hasattr(self.classifier, "feature_importances_"):
            vals = np.asarray(self.classifier.feature_importances_, dtype=float)
        else:
            vals = np.zeros(len(self.feature_names), dtype=float)
        if vals.sum() > 0:
            vals = vals / vals.sum()
        return vals

    def get_local_explanation(self, X: pd.DataFrame, index: int = 0) -> pd.DataFrame:
        """Get local explanation for a single prediction."""
        if not self.is_trained:
            raise ValueError("Model not trained. Call train() first.")

        X_sample = X.iloc[[index]]
        values = X_sample.values[0]

        if self.backend == "ebm" and hasattr(self.classifier, "explain_local"):
            # Prefer SHAP values when available for the selected row.
            if self.shap_values is not None and self.shap_index is not None:
                matched = np.where(self.shap_index == X_sample.index[0])[0]
                if len(matched) > 0:
                    shap_vector = self.shap_values[int(matched[0])]
                    explanation = pd.DataFrame(
                        {
                            "feature": self.feature_names,
                            "value": values,
                            "shap_value": shap_vector,
                        }
                    )
                    explanation["abs_shap"] = np.abs(explanation["shap_value"])
                    return explanation.sort_values("abs_shap", ascending=False)

            exp = self.classifier.explain_local(X_sample)
            d = exp.data(0)
            names = d.get("names", [])
            scores = d.get("scores", [])
            local_df = pd.DataFrame({"feature": names, "shap_value": scores})
            local_df = local_df[local_df["feature"].isin(self.feature_names)].copy()
            value_map = {k: v for k, v in zip(self.feature_names, values)}
            local_df["value"] = local_df["feature"].map(value_map)
            local_df["abs_shap"] = np.abs(local_df["shap_value"])
            return local_df.sort_values("abs_shap", ascending=False)

        shap_vector = None
        if self.explainer is not None:
            try:
                sv = self.explainer.shap_values(X_sample)
                sv_matrix = self._coerce_shap_matrix(sv)
                if sv_matrix is not None:
                    shap_vector = sv_matrix[0]
            except Exception:
                shap_vector = None

        if shap_vector is None:
            importances = self._feature_importance_vector()
            centered = (values - self.feature_means.values) / self.feature_stds.values
            shap_vector = centered * importances

        explanation = pd.DataFrame(
            {
                "feature": self.feature_names,
                "value": values,
                "shap_value": shap_vector,
            }
        )
        explanation["abs_shap"] = np.abs(explanation["shap_value"])
        return explanation.sort_values("abs_shap", ascending=False)

    def get_global_importance(self) -> pd.DataFrame:
        """Get global feature importance."""
        if not self.is_trained:
            raise ValueError("Model not trained. Call train() first.")

        if self.backend == "ebm" and hasattr(self.classifier, "term_importances"):
            if self.shap_values is not None:
                importance = np.abs(self.shap_values).mean(axis=0)
                return (
                    pd.DataFrame({"feature": self.feature_names, "importance": importance})
                    .sort_values("importance", ascending=False)
                    .reset_index(drop=True)
                )
            term_names = list(getattr(self.classifier, "term_names_", self.feature_names))
            term_importance = np.asarray(self.classifier.term_importances(), dtype=float)
            imp_df = pd.DataFrame({"feature": term_names, "importance": term_importance})
            imp_df = imp_df[imp_df["feature"].isin(self.feature_names)].copy()
            return imp_df.sort_values("importance", ascending=False).reset_index(drop=True)
        if self.shap_values is not None:
            importance = np.abs(self.shap_values).mean(axis=0)
        else:
            importance = self._feature_importance_vector()

        return (
            pd.DataFrame({"feature": self.feature_names, "importance": importance})
            .sort_values("importance", ascending=False)
            .reset_index(drop=True)
        )

    def save(self, filepath: str | Path) -> None:
        """Save model to file."""
        if not self.is_trained:
            raise ValueError("Model not trained. Call train() first.")

        # SHAP explainer objects (especially KernelExplainer callables) are often not pickle-safe.
        explainer_to_save = None if self.shap_backend == "kernel" else self.explainer

        model_data = {
            "classifier": self.classifier,
            "regressor": self.regressor,
            "explainer": explainer_to_save,
            "feature_names": self.feature_names,
            "shap_values": self.shap_values,
            "feature_means": self.feature_means,
            "feature_stds": self.feature_stds,
            "classifier_name": self.classifier_name,
            "regressor_name": self.regressor_name,
            "backend": self.backend,
            "shap_backend": self.shap_backend,
            "shap_index": self.shap_index,
        }
        with open(filepath, "wb") as f:
            pickle.dump(model_data, f)
        print(f"Model saved to {filepath}")

    def load(self, filepath: str | Path) -> None:
        """Load model from file."""
        with open(filepath, "rb") as f:
            model_data = pickle.load(f)

        self.classifier = model_data["classifier"]
        self.regressor = model_data["regressor"]
        self.explainer = model_data.get("explainer")
        self.feature_names = model_data["feature_names"]
        self.shap_values = model_data.get("shap_values")
        self.feature_means = model_data.get("feature_means")
        self.feature_stds = model_data.get("feature_stds")
        self.classifier_name = model_data.get("classifier_name")
        self.regressor_name = model_data.get("regressor_name")
        self.backend = model_data.get("backend", "auto")
        self.shap_backend = model_data.get("shap_backend")
        self.shap_index = model_data.get("shap_index")
        self.is_trained = True
        print(f"Model loaded from {filepath}")


def train_and_save_model(df: pd.DataFrame, model_path: str = "model.pkl") -> BloodLogisticsModel:
    """Train model and save to file."""
    model = BloodLogisticsModel()
    model.train(df)
    model.save(model_path)
    return model


if __name__ == "__main__":
    from data import generate_synthetic_data
    from utils import engineer_features

    print("Generating synthetic data...")
    frame = engineer_features(generate_synthetic_data(1000))

    model = BloodLogisticsModel()
    model.train(frame)

    print("\nTesting predictions")
    print(model.predict(frame.head(10)))
    print("\nGlobal feature importance")
    print(model.get_global_importance().head(10))
