"""
Flask API integration for DHA RESCUE EBM model artifact.

Run:
    python app/frontend/flask_ebm_api.py

Endpoints:
    GET  /health
    POST /predict
    POST /explain/local
    GET  /explain/global
"""

from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd
from flask import Flask, jsonify, request


ROOT_DIR = Path(__file__).resolve().parents[2]
DHA_DIR = ROOT_DIR / "dha_rescue"
if str(DHA_DIR) not in sys.path:
    sys.path.insert(0, str(DHA_DIR))

from ebm_model import load_ebm_model  # noqa: E402
from utils import engineer_features  # noqa: E402


MODEL_PATH = DHA_DIR / "artifacts" / "blood_logistics_ebm.pkl"
app = Flask(__name__)
model = load_ebm_model(MODEL_PATH)


def _records_from_request():
    payload = request.get_json(force=True, silent=False)
    if isinstance(payload, dict) and "records" in payload:
        records = payload["records"]
    elif isinstance(payload, list):
        records = payload
    elif isinstance(payload, dict):
        records = [payload]
    else:
        raise ValueError("Payload must be an object, list, or {'records': [...]} format.")
    if not records:
        raise ValueError("No records provided.")
    return records


def _prepare_df(records):
    df = pd.DataFrame(records)
    if "node_id" not in df.columns:
        df["node_id"] = [f"NODE_{i}" for i in range(len(df))]
    if "node_name" not in df.columns:
        df["node_name"] = df["node_id"]
    return engineer_features(df)


@app.get("/health")
def health():
    return jsonify(
        {
            "status": "ok",
            "model_backend": model.backend,
            "classifier": model.classifier_name,
            "regressor": model.regressor_name,
            "artifact": str(MODEL_PATH),
        }
    )


@app.post("/predict")
def predict():
    try:
        records = _records_from_request()
        df = _prepare_df(records)
        preds = model.predict(df)
        return jsonify({"predictions": preds.to_dict(orient="records")})
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@app.post("/explain/local")
def explain_local():
    try:
        records = _records_from_request()
        index = int(request.args.get("index", 0))
        df = _prepare_df(records)
        index = max(0, min(index, len(df) - 1))
        x = df[model.feature_names].copy()
        explanation = model.get_local_explanation(x, index=index)
        return jsonify({"index": index, "explanation": explanation.to_dict(orient="records")})
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@app.get("/explain/global")
def explain_global():
    try:
        importance = model.get_global_importance()
        return jsonify({"importance": importance.to_dict(orient="records")})
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@app.post("/explain/waterfall")
def explain_waterfall():
    try:
        records = _records_from_request()
        index = int(request.args.get("index", 0))
        top_k = int(request.args.get("top_k", 10))
        df = _prepare_df(records)
        index = max(0, min(index, len(df) - 1))

        x = df[model.feature_names].copy()
        explanation = model.get_local_explanation(x, index=index).copy()
        explanation = explanation.sort_values("abs_shap", ascending=False).head(max(1, top_k))

        pred_prob = float(model.predict_failure(x.iloc[[index]])[0])
        contrib_sum = float(explanation["shap_value"].sum())
        base_value = pred_prob - contrib_sum

        running = base_value
        steps = []
        for _, row in explanation.iterrows():
            delta = float(row["shap_value"])
            start = running
            end = running + delta
            steps.append(
                {
                    "feature": row["feature"],
                    "value": float(row["value"]) if pd.notna(row["value"]) else None,
                    "contribution": delta,
                    "start": start,
                    "end": end,
                }
            )
            running = end

        return jsonify(
            {
                "index": index,
                "prediction_probability": pred_prob,
                "base_value": base_value,
                "top_k": top_k,
                "steps": steps,
                "final_value": running,
            }
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 400


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
