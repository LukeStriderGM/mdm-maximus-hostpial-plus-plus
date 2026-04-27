# DHA RESCUE: Explainable Predictive Blood Logistics System

## Requirements

```
streamlit>=1.28.0
pandas>=2.0.0
numpy>=1.24.0
scikit-learn>=1.3.0
xgboost>=2.0.0
shap>=0.43.0
plotly>=5.18.0
```

## Installation

```bash
pip install -r requirements.txt
```

## Running the Application

```bash
streamlit run app.py
```

## Project Structure

```
dha_rescue/
├── app.py          # Streamlit dashboard
├── model.py        # ML model training and prediction
├── data.py         # Synthetic data generator
├── utils.py        # Feature engineering and recommendations
├── requirements.txt
└── README.md
```

## Features

- **Failure Prediction**: XGBoost classifier predicts supply failure risk
- **Time-to-Failure**: XGBoost regressor predicts time to failure in hours
- **SHAP Explainability**: Local and global explanations for predictions
- **Interactive Dashboard**: Streamlit UI with node selection, SHAP plots, recommendations
- **Scenario Simulation**: Sliders to adjust casualty rate and transport delay
- **Enhanced EDA Pipeline**: Exported profiling, correlation, and risk-band summaries
- **Advanced ML Pipeline**: Cross-validated model comparison with automatic best-model selection

## Usage

1. Start the Streamlit app: `streamlit run app.py`
2. Navigate through the sidebar menu:
   - **Overview**: Network-wide risk summary
   - **Node Details**: Individual node analysis
   - **SHAP Explanation**: Feature contributions
   - **Recommendations**: Actionable mitigation steps
   - **Scenario Simulation**: What-if analysis

## ML Approach

- **Classification**: XGBoostClassifier for binary failure prediction
- **Regression**: XGBoostRegressor for time-to-failure prediction
- **Explainability**: SHAP TreeExplainer for feature importance

## Data

Synthetic data is generated with features:
- inventory_units, expiry_hours_remaining, temperature_excursion_flag
- transport_delay_hours, route_reliability_score, demand_rate
- casualty_rate, cold_chain_health_score, backup_supply_available

Engineered features:
- days_of_supply, expiry_risk, transport_risk, viability_score, risk_composite

## Enhanced EDA

Run upgraded EDA and export analysis tables:

```bash
python eda_upgrade.py --samples 3000 --outdir outputs/eda
```

Generated outputs include:
- Dataset snapshot with engineered features
- Column-level quality profile (types, missingness, cardinality)
- Numeric summary statistics
- Correlation matrix for numeric fields
- Failure-rate slices by node/product/backup availability
- Risk-band summary

## Advanced ML Expansion

Run advanced model comparison and training:

```bash
python advanced_ml.py --samples 5000 --cv 5 --outdir outputs/ml
```

Generated outputs include:
- `classification_cv_results.csv`: CV comparison of multiple classifiers
- `regression_cv_results.csv`: CV comparison of multiple regressors
- `holdout_metrics.json`: final holdout performance
- `advanced_models.pkl`: trained best-model pipelines for reuse
