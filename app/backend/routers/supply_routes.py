from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.database import get_db
from models.models import SupplyRoute
from models.schemas import SupplyRouteResponse

router = APIRouter()


@router.get("/supply-routes", response_model=list[SupplyRouteResponse])
async def list_supply_routes(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(SupplyRoute))
    return result.scalars().all()
