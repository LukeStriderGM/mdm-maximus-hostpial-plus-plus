"""EBM model prediction and explanation routes."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

router = APIRouter()


# --- Schemas ---

class EBMRecordInput(BaseModel):
    inventory_units: float
    expiry_hours_remaining: float = 720.0
    temperature_excursion_flag: int = 0
    transport_delay_hours: float = 4.0
    route_reliability_score: float = 0.85
    demand_rate: float = 1.0
    casualty_rate: float = 1.0
    cold_chain_health_score: float = 0.9
    backup_supply_available: int = 1
    node_id: str = "NODE_0"
    node_name: str = ""


class EBMPredictRequest(BaseModel):
    records: list[EBMRecordInput]


class EBMPredictionRow(BaseModel):
    node_id: str
    node_name: str
    failure_probability: float
    time_to_failure_hours: float
    risk_level: str


class FeatureContribution(BaseModel):
    feature: str
    value: float | None = None
    shap_value: float
    abs_shap: float


class GlobalImportanceRow(BaseModel):
    feature: str
    importance: float


class WaterfallStep(BaseModel):
    feature: str
    value: float | None = None
    contribution: float
    start: float
    end: float


class WaterfallResponse(BaseModel):
    index: int
    prediction_probability: float
    base_value: float
    top_k: int
    steps: list[WaterfallStep]
    final_value: float


class EBMHealthResponse(BaseModel):
    status: str
    model_loaded: bool
    model_backend: str | None = None
    classifier: str | None = None
    regressor: str | None = None


# --- Helpers ---

def _get_ebm():
    from services.ebm_predictor import EBMPredictor
    from services.ml_interface import ml_predictor

    if isinstance(ml_predictor, EBMPredictor):
        return ml_predictor
    raise HTTPException(
        503,
        detail=(
            "EBM model not loaded. Expected artifact at "
            "<repo>/ml_models/artifacts/blood_logistics_ebm.pkl "
            "(or set EBM_MODEL_PATH). Train it with "
            "`cd ml_models && python train_ebm_pkl.py`."
        ),
    )


# --- Routes ---

@router.get("/ebm/health", response_model=EBMHealthResponse)
async def ebm_health():
    try:
        ebm = _get_ebm()
        m = ebm.model
        return EBMHealthResponse(
            status="ok",
            model_loaded=True,
            model_backend=m.backend,
            classifier=m.classifier_name,
            regressor=m.regressor_name,
        )
    except HTTPException:
        return EBMHealthResponse(status="unavailable", model_loaded=False)


@router.post("/ebm/predict", response_model=list[EBMPredictionRow])
async def ebm_predict(req: EBMPredictRequest):
    ebm = _get_ebm()
    records = [r.model_dump() for r in req.records]
    try:
        predictions = ebm.predict_batch(records)
        return predictions
    except Exception as e:
        raise HTTPException(400, detail=str(e))


@router.post("/ebm/explain/local")
async def ebm_explain_local(req: EBMPredictRequest, index: int = Query(0)):
    ebm = _get_ebm()
    records = [r.model_dump() for r in req.records]
    try:
        explanation = ebm.explain_local(records, index=index)
        return {"index": index, "explanation": explanation}
    except Exception as e:
        raise HTTPException(400, detail=str(e))


@router.get("/ebm/explain/global")
async def ebm_explain_global():
    ebm = _get_ebm()
    try:
        importance = ebm.explain_global()
        return {"importance": importance}
    except Exception as e:
        raise HTTPException(400, detail=str(e))


@router.post("/ebm/explain/waterfall", response_model=WaterfallResponse)
async def ebm_explain_waterfall(
    req: EBMPredictRequest,
    index: int = Query(0),
    top_k: int = Query(10),
):
    ebm = _get_ebm()
    records = [r.model_dump() for r in req.records]
    try:
        result = ebm.explain_waterfall(records, index=index, top_k=top_k)
        return WaterfallResponse(**result)
    except Exception as e:
        raise HTTPException(400, detail=str(e))
