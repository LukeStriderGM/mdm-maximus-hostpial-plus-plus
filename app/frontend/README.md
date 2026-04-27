# Frontend + EBM API Integration

## React + TypeScript + Vite

This frontend uses the Vite React TypeScript template.

## EBM Backend Integration

A Flask API for the DHA RESCUE EBM model is available at:

- `app/frontend/flask_ebm_api.py`

### Prerequisites

- Trained model artifact exists at:
  - `dha_rescue/artifacts/blood_logistics_ebm.pkl`

### Run API

```bash
python app/frontend/flask_ebm_api.py
```

Server starts on `http://localhost:5000`.

### API Endpoints

- `GET /health`
- `POST /predict`
- `POST /explain/local?index=0`
- `GET /explain/global`
- `POST /explain/waterfall?index=0&top_k=10`

### Example prediction request

```bash
curl -X POST http://localhost:5000/predict ^
  -H "Content-Type: application/json" ^
  -d "{\"records\":[{\"node_id\":\"SPOKE_9\",\"node_name\":\"Forward Node\",\"inventory_units\":40,\"expiry_hours_remaining\":48,\"temperature_excursion_flag\":0,\"transport_delay_hours\":10,\"route_reliability_score\":0.75,\"demand_rate\":4,\"casualty_rate\":3.5,\"cold_chain_health_score\":0.85,\"backup_supply_available\":1}]}"
```
