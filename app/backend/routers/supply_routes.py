from dataclasses import asdict

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.database import get_db
from models.models import SupplyRoute
from models.schemas import SupplyRouteResponse, BestPathRequest, PathResultResponse
from services.pathfinding import find_best_paths

router = APIRouter()


@router.get("/supply-routes", response_model=list[SupplyRouteResponse])
async def list_supply_routes(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SupplyRoute))
    return result.scalars().all()


@router.post("/supply-routes/best-path", response_model=list[PathResultResponse])
async def best_path(request: BestPathRequest, db: AsyncSession = Depends(get_db)):
    results = await find_best_paths(
        db=db,
        destination_node_id=request.destination_node_id,
        product_type=request.product_type,
        priority=request.priority,
        max_results=request.max_results,
    )
    return [
        PathResultResponse(
            steps=[asdict(s) for s in r.steps],
            total_distance_km=r.total_distance_km,
            total_transit_hours=r.total_transit_hours,
            total_cost=r.total_cost,
            source_node_id=r.source_node_id,
            source_node_name=r.source_node_name,
            source_inventory=r.source_inventory,
            risk_summary=r.risk_summary,
            path_type=r.path_type,
        )
        for r in results
    ]
