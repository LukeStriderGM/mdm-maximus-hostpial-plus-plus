# Hospital++ ML Integration

## Overview
ML-ready architecture for medical logistics decision support. Models integrate via Protocol interfaces in `app/backend/services/ml_interface.py`.

## Planned Models

| Model | Library | Input | Output |
|-------|---------|-------|--------|
| Stock-out Forecaster | Prophet / XGBoost | Inventory events time-series | Days until stock-out, risk level |
| Route Risk Classifier | Random Forest | Route attributes (distance, mode, weather) | Risk level (low/medium/high/critical) |
| Cascade Simulator | SimPy + NetworkX | Hub-spoke graph + constraint params | Affected spokes, failure timeline |
| Sourcing Recommender | TF-IDF (scikit-learn) | Product descriptions | Alternative products ranked by similarity |
| Secondary Effects Detector | Bayesian Network (pgmpy) | Product dependency graph + constraints | Capability degradation probabilities |

## Integration Pattern
1. Train model using scripts in `training/`
2. Serialize to `artifacts/` with joblib
3. Implement the Protocol interface from `ml_interface.py`
4. Swap in via configuration (env var `ML_BACKEND=trained`)

## Deployment
Models are baked into the container image for air-gapped Zarf deployment. CPU-only inference — no GPU required. Total model artifact size target: < 100MB.
