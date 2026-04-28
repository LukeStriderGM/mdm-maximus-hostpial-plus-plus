"""
ML Service Interface — Protocol classes for ML model integration.

Default implementations use heuristic/rules-based logic.
When ML models are trained (in ml/), they implement these same
interfaces and are swapped in via configuration.
"""
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Optional, Protocol, runtime_checkable


@dataclass
class StockoutPrediction:
    node_id: str
    product_type: str
    days_until_stockout: float
    confidence: float
    risk_level: str  # critical, warning, caution, healthy
    predicted_date: Optional[datetime] = None


@dataclass
class RiskAssessment:
    route_id: str
    risk_level: str  # low, medium, high, critical
    confidence: float
    factors: list[str] = field(default_factory=list)


@dataclass
class CascadeResult:
    hub_id: str
    affected_spokes: list[dict] = field(default_factory=list)
    total_at_risk: int = 0
    time_to_first_failure_days: float = 999.0


@dataclass
class SourcingOption:
    product_type: str
    alternative_manufacturer: str
    alternative_product: str
    similarity_score: float
    availability: str = "unknown"


@runtime_checkable
class StockoutPredictor(Protocol):
    def predict_stockout(self, node_id: str, product_type: str,
                         quantity: int, avg_consumption: float) -> StockoutPrediction: ...


@runtime_checkable
class RouteRiskAssessor(Protocol):
    def assess_route_risk(self, route_id: str, distance_km: float,
                          transit_hours: float, transport_mode: str) -> RiskAssessment: ...


@runtime_checkable
class CascadeSimulator(Protocol):
    def simulate_cascade(self, hub_id: str, throughput_reduction: float,
                         num_spokes: int) -> CascadeResult: ...


@runtime_checkable
class SourcingRecommender(Protocol):
    def recommend_sourcing(self, product_type: str) -> list[SourcingOption]: ...


class HeuristicPredictor:
    """Default heuristic implementation — replaced by ML models later."""

    def predict_stockout(self, node_id: str, product_type: str,
                         quantity: int, avg_consumption: float) -> StockoutPrediction:
        if avg_consumption <= 0:
            days = 999.0
            risk = "healthy"
        else:
            days = quantity / avg_consumption
            if days < 3:
                risk = "critical"
            elif days < 7:
                risk = "warning"
            elif days < 14:
                risk = "caution"
            else:
                risk = "healthy"

        return StockoutPrediction(
            node_id=node_id,
            product_type=product_type,
            days_until_stockout=round(days, 1),
            confidence=0.5,
            risk_level=risk,
            predicted_date=datetime.utcnow() + timedelta(days=days) if days < 999 else None,
        )

    def assess_route_risk(self, route_id: str, distance_km: float,
                          transit_hours: float, transport_mode: str) -> RiskAssessment:
        factors = []
        score = 0
        if distance_km > 1000:
            score += 2
            factors.append("long_distance")
        if transit_hours > 48:
            score += 2
            factors.append("extended_transit")
        if transport_mode in ("sea", "contested_air"):
            score += 1
            factors.append(f"{transport_mode}_transport")

        levels = {0: "low", 1: "medium", 2: "medium", 3: "high"}
        risk = levels.get(min(score, 3), "critical")
        return RiskAssessment(route_id=route_id, risk_level=risk, confidence=0.4, factors=factors)

    def simulate_cascade(self, hub_id: str, throughput_reduction: float,
                         num_spokes: int) -> CascadeResult:
        affected = []
        for i in range(num_spokes):
            days = (i + 1) * 3 / max(throughput_reduction, 0.1)
            affected.append({
                "spoke_index": i,
                "days_until_failure": round(days, 1),
                "products_affected": ["blood_collection", "surgical_gloves"],
            })
        return CascadeResult(
            hub_id=hub_id,
            affected_spokes=affected,
            total_at_risk=num_spokes,
            time_to_first_failure_days=affected[0]["days_until_failure"] if affected else 999,
        )

    def recommend_sourcing(self, product_type: str) -> list[SourcingOption]:
        return [SourcingOption(
            product_type=product_type,
            alternative_manufacturer="Placeholder",
            alternative_product=f"Alternative {product_type}",
            similarity_score=0.0,
        )]


# Default instance — uses EBM when artifact is available, heuristic otherwise
import os
import logging as _logging
from pathlib import Path as _Path

_log = _logging.getLogger(__name__)


def _create_predictor():
    model_path = os.getenv("EBM_MODEL_PATH")
    if model_path and _Path(model_path).exists():
        try:
            from services.ebm_predictor import EBMPredictor
            _log.info("EBM predictor configured (lazy load from %s)", model_path)
            return EBMPredictor(model_path)
        except Exception as e:
            _log.warning("Failed to configure EBM predictor: %s — falling back to heuristic", e)
    return HeuristicPredictor()


ml_predictor = _create_predictor()
