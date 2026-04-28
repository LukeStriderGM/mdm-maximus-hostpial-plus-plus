from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from models.database import get_db
from models.models import Spoke, Hub, InventoryItem, DemandSignal, NodeType
from models.schemas import (
    SpokeCreate, SpokeUpdate, SpokeResponse,
    DemandSignalCreate, DemandSignalResponse,
)
from services.nats_service import nats_service

router = APIRouter()


@router.get("/spokes", response_model=list[SpokeResponse])
async def list_spokes(hub_id: str | None = None, db: AsyncSession = Depends(get_db)):
    query = select(Spoke)
    if hub_id:
        query = query.where(Spoke.hub_id == hub_id)
    result = await db.execute(query)
    spokes = result.scalars().all()
    responses = []
    for spoke in spokes:
        inv_count = (await db.execute(
            select(func.count()).where(
                InventoryItem.node_id == spoke.id,
                InventoryItem.node_type == NodeType.spoke,
            )
        )).scalar() or 0
        responses.append(SpokeResponse(
            **{c.name: getattr(spoke, c.name) for c in Spoke.__table__.columns},
            inventory_count=inv_count,
        ))
    return responses


@router.get("/spokes/{spoke_id}", response_model=SpokeResponse)
async def get_spoke(spoke_id: str, db: AsyncSession = Depends(get_db)):
    spoke = await db.get(Spoke, spoke_id)
    if not spoke:
        raise HTTPException(404, "Spoke not found")
    inv_count = (await db.execute(
        select(func.count()).where(
            InventoryItem.node_id == spoke.id,
            InventoryItem.node_type == NodeType.spoke,
        )
    )).scalar() or 0
    return SpokeResponse(
        **{c.name: getattr(spoke, c.name) for c in Spoke.__table__.columns},
        inventory_count=inv_count,
    )


@router.post("/spokes", response_model=SpokeResponse, status_code=201)
async def create_spoke(data: SpokeCreate, db: AsyncSession = Depends(get_db)):
    hub = await db.get(Hub, data.hub_id)
    if not hub:
        raise HTTPException(404, "Parent hub not found")
    spoke = Spoke(**data.model_dump())
    db.add(spoke)
    await db.commit()
    await db.refresh(spoke)

    await nats_service.set_node_status(spoke.id, {
        "type": "spoke", "name": spoke.name, "status": spoke.status.value,
    })

    return SpokeResponse(
        **{c.name: getattr(spoke, c.name) for c in Spoke.__table__.columns},
        inventory_count=0,
    )


@router.put("/spokes/{spoke_id}", response_model=SpokeResponse)
async def update_spoke(spoke_id: str, data: SpokeUpdate, db: AsyncSession = Depends(get_db)):
    spoke = await db.get(Spoke, spoke_id)
    if not spoke:
        raise HTTPException(404, "Spoke not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(spoke, key, value)
    await db.commit()
    await db.refresh(spoke)
    return SpokeResponse(
        **{c.name: getattr(spoke, c.name) for c in Spoke.__table__.columns},
    )


@router.delete("/spokes/{spoke_id}", status_code=204)
async def delete_spoke(spoke_id: str, db: AsyncSession = Depends(get_db)):
    spoke = await db.get(Spoke, spoke_id)
    if not spoke:
        raise HTTPException(404, "Spoke not found")
    await db.delete(spoke)
    await db.commit()


@router.post("/spokes/{spoke_id}/demand", response_model=DemandSignalResponse, status_code=201)
async def create_demand_signal(spoke_id: str, data: DemandSignalCreate, db: AsyncSession = Depends(get_db)):
    spoke = await db.get(Spoke, spoke_id)
    if not spoke:
        raise HTTPException(404, "Spoke not found")
    signal = DemandSignal(spoke_id=spoke_id, **data.model_dump(exclude={"spoke_id"}))
    db.add(signal)
    await db.commit()
    await db.refresh(signal)

    await nats_service.publish_demand_signal(spoke_id, {
        "spoke_id": spoke_id, "product_type": signal.product_type,
        "quantity_needed": signal.quantity_needed, "priority": signal.priority.value,
    })

    return DemandSignalResponse(
        **{c.name: getattr(signal, c.name) for c in DemandSignal.__table__.columns},
    )


@router.get("/spokes/{spoke_id}/demand", response_model=list[DemandSignalResponse])
async def list_demand_signals(spoke_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(DemandSignal).where(DemandSignal.spoke_id == spoke_id).order_by(DemandSignal.created_at.desc())
    )
    signals = result.scalars().all()
    return [DemandSignalResponse(
        **{c.name: getattr(s, c.name) for c in DemandSignal.__table__.columns},
    ) for s in signals]
