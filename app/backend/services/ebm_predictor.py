"""
EBM-backed predictor — implements ml_interface Protocols using the
DHA RESCUE BloodLogisticsModel artifact.

Lazy-loads the .pkl so the backend starts even without an artifact.
"""
from __future__ import annotations

import logging
import os
import sys
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd

from services.ml_interface import StockoutPrediction

logger = logging.getLogger(__name__)

_DHA_DIR = Path(os.getenv("DHA_RESCUE_DIR", str(Path(__file__).resolve().parents[2] / "ml_models")))
if str(_DHA_DIR) not in sys.path:
    sys.path.insert(0, str(_DHA_DIR))


class EBMPredictor:
    """Lazy-loading EBM predictor that satisfies StockoutPredictor Protocol."""

    def __init__(self, model_path: Optional[str] = None):
        self._model_path = model_path or os.getenv(
            "EBM_MODEL_PATH",
            str(_DHA_DIR / "artifacts" / "blood_logistics_ebm.pkl"),
        )
        self._model = None

    @property
    def model(self):
        if self._model is None:
            from ebm_model import load_ebm_model
            self._model = load_ebm_model(self._model_path)
            logger.info("EBM model loaded from %s", self._model_path)
        return self._model

    @property
    def is_loaded(self) -> bool:
        return self._model is not None

    # --- StockoutPredictor Protocol ---

    def predict_stockout(
        self, node_id: str, product_type: str, quantity: int, avg_consumption: float
    ) -> StockoutPrediction:
        row = _build_feature_row(node_id, quantity, avg_consumption)
        X = pd.DataFrame([row])[self.model.feature_names]

        failure_prob = float(self.model.classifier.predict_proba(X)[:, 1][0])
        ttf_hours = float(self.model.regressor.predict(X)[0])
        days = max(ttf_hours / 24.0, 0)

        if failure_prob > 0.5:
            risk = "critical"
        elif failure_prob > 0.2:
            risk = "warning"
        elif failure_prob > 0.1:
            risk = "caution"
        else:
            risk = "healthy"

        return StockoutPrediction(
            node_id=node_id,
            product_type=product_type,
            days_until_stockout=round(days, 1),
            confidence=round(1.0 - abs(failure_prob - 0.5) * 2, 2),
            risk_level=risk,
            predicted_date=datetime.utcnow() + timedelta(days=days),
        )

    # --- Raw EBM pass-throughs for explanation routes ---

    def predict_batch(self, records: list[dict]) -> list[dict]:
        df = _prepare_df(records)
        X = df[self.model.feature_names].copy()
        fail_probs = self.model.classifier.predict_proba(X)[:, 1]
        ttf = self.model.regressor.predict(X)

        results = []
        for i in range(len(df)):
            fp = float(fail_probs[i])
            results.append({
                "node_id": str(df.iloc[i].get("node_id", f"NODE_{i}")),
                "node_name": str(df.iloc[i].get("node_name", f"NODE_{i}")),
                "failure_probability": round(fp, 4),
                "time_to_failure_hours": round(float(ttf[i]), 1),
                "risk_level": "critical" if fp > 0.5 else "warning" if fp > 0.2 else "healthy",
            })
        return results

    def explain_local(self, records: list[dict], index: int = 0) -> list[dict]:
        df = _prepare_df(records)
        X = df[self.model.feature_names].copy()
        index = max(0, min(index, len(X) - 1))
        explanation = self.model.get_local_explanation(X, index=index)
        return explanation.to_dict(orient="records")

    def explain_global(self) -> list[dict]:
        importance = self.model.get_global_importance()
        return importance.to_dict(orient="records")

    def explain_waterfall(self, records: list[dict], index: int = 0, top_k: int = 10) -> dict:
        df = _prepare_df(records)
        X = df[self.model.feature_names].copy()
        index = max(0, min(index, len(X) - 1))

        explanation = self.model.get_local_explanation(X, index=index).copy()
        explanation = explanation.sort_values("abs_shap", ascending=False).head(max(1, top_k))

        pred_prob = float(self.model.classifier.predict_proba(X.iloc[[index]])[:, 1][0])
        contrib_sum = float(explanation["shap_value"].sum())
        base_value = pred_prob - contrib_sum

        running = base_value
        steps = []
        for _, row in explanation.iterrows():
            delta = float(row["shap_value"])
            steps.append({
                "feature": row["feature"],
                "value": float(row["value"]) if pd.notna(row["value"]) else None,
                "contribution": delta,
                "start": running,
                "end": running + delta,
            })
            running += delta

        return {
            "index": index,
            "prediction_probability": round(pred_prob, 4),
            "base_value": round(base_value, 4),
            "top_k": top_k,
            "steps": steps,
            "final_value": round(running, 4),
        }


def _build_feature_row(node_id: str, quantity: int, avg_consumption: float) -> dict:
    """Map Hospital++ inventory params to DHA RESCUE feature vector."""
    demand_rate = max(avg_consumption, 0.1)
    days_of_supply = quantity / demand_rate
    return {
        "node_id": node_id,
        "node_name": node_id,
        "inventory_units": quantity,
        "expiry_hours_remaining": 720.0,
        "temperature_excursion_flag": 0,
        "transport_delay_hours": 4.0,
        "route_reliability_score": 0.85,
        "demand_rate": demand_rate,
        "casualty_rate": 1.0,
        "cold_chain_health_score": 0.9,
        "backup_supply_available": 1,
        "days_of_supply": days_of_supply,
        "expiry_risk": 1 / 720.0,
        "transport_risk": 4.0 * 0.15,
        "viability_score": 0.9,
        "risk_composite": min(
            (1 / min(days_of_supply, 30)) * 30 + (1 / 720) * 100 + 0.6 * 10 + 0.1 * 50, 100
        ),
    }


def _prepare_df(records: list[dict]) -> pd.DataFrame:
    """Prepare a DataFrame from raw records, applying DHA RESCUE feature engineering."""
    from utils import engineer_features

    df = pd.DataFrame(records)
    if "node_id" not in df.columns:
        df["node_id"] = [f"NODE_{i}" for i in range(len(df))]
    if "node_name" not in df.columns:
        df["node_name"] = df["node_id"]
    return engineer_features(df)
