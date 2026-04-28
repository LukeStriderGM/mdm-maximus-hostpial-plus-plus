from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from models.database import get_db
from models.models import InventoryItem, InventoryEvent, NodeType, EventType
from models.schemas import (
    InventoryItemCreate, InventoryItemUpdate, InventoryItemResponse,
    InventoryEventResponse,
)
from services.nats_service import nats_service

router = APIRouter()


@router.get("/inventory", response_model=list[InventoryItemResponse])
async def list_inventory(
    node_id: str | None = None,
    node_type: str | None = None,
    product_type: str | None = None,
    product_noun: str | None = None,
    limit: int = Query(100, le=1000),
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    query = select(InventoryItem)
    if node_id:
        query = query.where(InventoryItem.node_id == node_id)
    if node_type:
        query = query.where(InventoryItem.node_type == node_type)
    if product_type:
        query = query.where(InventoryItem.product_type == product_type)
    if product_noun:
        query = query.where(InventoryItem.product_noun == product_noun)
    query = query.offset(offset).limit(limit)
    result = await db.execute(query)
    items = result.scalars().all()
    return [InventoryItemResponse(
        **{c.name: getattr(item, c.name) for c in InventoryItem.__table__.columns},
    ) for item in items]


@router.get("/inventory/count")
async def inventory_count(
    node_id: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    query = select(func.count()).select_from(InventoryItem)
    if node_id:
        query = query.where(InventoryItem.node_id == node_id)
    count = (await db.execute(query)).scalar() or 0
    return {"count": count}


@router.get("/inventory/search")
async def search_inventory(
    q: str = Query(..., min_length=1, max_length=200),
    limit: int = Query(20, le=100),
    db: AsyncSession = Depends(get_db),
):
    """Search products grouped by identity (noun + type + manufacturer + catalog)."""
    pattern = f"%{q}%"
    query = (
        select(
            InventoryItem.product_type,
            InventoryItem.product_noun,
            InventoryItem.manufacturer,
            InventoryItem.catalog_number,
            InventoryItem.cold_chain_required,
            func.sum(InventoryItem.quantity_on_hand).label("total_quantity"),
            func.sum(InventoryItem.reorder_threshold).label("total_reorder"),
            func.count().label("location_count"),
            func.count(func.distinct(InventoryItem.node_id)).label("node_count"),
        )
        .where(
            or_(
                InventoryItem.product_type.ilike(pattern),
                InventoryItem.product_noun.ilike(pattern),
                InventoryItem.manufacturer.ilike(pattern),
                InventoryItem.item_description.ilike(pattern),
                InventoryItem.catalog_number.ilike(pattern),
            )
        )
        .group_by(
            InventoryItem.product_type,
            InventoryItem.product_noun,
            InventoryItem.manufacturer,
            InventoryItem.catalog_number,
            InventoryItem.cold_chain_required,
        )
        .order_by(func.sum(InventoryItem.quantity_on_hand).desc())
        .limit(limit)
    )
    result = await db.execute(query)
    rows = result.all()
    return [
        {
            "product_type": row.product_type,
            "product_noun": row.product_noun,
            "manufacturer": row.manufacturer,
            "catalog_number": row.catalog_number,
            "cold_chain_required": row.cold_chain_required,
            "total_quantity": row.total_quantity,
            "total_reorder": row.total_reorder,
            "location_count": row.location_count,
            "node_count": row.node_count,
        }
        for row in rows
    ]


@router.get("/inventory/{item_id}", response_model=InventoryItemResponse)
async def get_inventory_item(item_id: str, db: AsyncSession = Depends(get_db)):
    item = await db.get(InventoryItem, item_id)
    if not item:
        raise HTTPException(404, "Inventory item not found")
    return InventoryItemResponse(
        **{c.name: getattr(item, c.name) for c in InventoryItem.__table__.columns},
    )


@router.post("/inventory", response_model=InventoryItemResponse, status_code=201)
async def create_inventory_item(data: InventoryItemCreate, db: AsyncSession = Depends(get_db)):
    item = InventoryItem(**data.model_dump())
    db.add(item)

    event = InventoryEvent(
        node_id=data.node_id, node_type=data.node_type,
        product_type=data.product_type, event_type=EventType.restock,
        quantity_delta=data.quantity_on_hand, timestamp=datetime.utcnow(),
    )
    db.add(event)

    await db.commit()
    await db.refresh(item)

    await nats_service.publish_inventory_event(
        data.node_id, data.node_type, "restock",
        {"item_id": item.id, "product_type": data.product_type,
         "quantity": data.quantity_on_hand},
    )

    return InventoryItemResponse(
        **{c.name: getattr(item, c.name) for c in InventoryItem.__table__.columns},
    )


@router.put("/inventory/{item_id}", response_model=InventoryItemResponse)
async def update_inventory_item(item_id: str, data: InventoryItemUpdate, db: AsyncSession = Depends(get_db)):
    item = await db.get(InventoryItem, item_id)
    if not item:
        raise HTTPException(404, "Inventory item not found")

    old_qty = item.quantity_on_hand
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(item, key, value)

    if data.quantity_on_hand is not None and data.quantity_on_hand != old_qty:
        delta = data.quantity_on_hand - old_qty
        event_type = EventType.restock if delta > 0 else EventType.consume
        event = InventoryEvent(
            node_id=item.node_id, node_type=item.node_type,
            product_type=item.product_type, event_type=event_type,
            quantity_delta=delta, timestamp=datetime.utcnow(),
        )
        db.add(event)

        await nats_service.publish_inventory_event(
            item.node_id, item.node_type.value, event_type.value,
            {"item_id": item.id, "product_type": item.product_type,
             "quantity_delta": delta, "new_quantity": data.quantity_on_hand},
        )

    await db.commit()
    await db.refresh(item)
    return InventoryItemResponse(
        **{c.name: getattr(item, c.name) for c in InventoryItem.__table__.columns},
    )


@router.delete("/inventory/{item_id}", status_code=204)
async def delete_inventory_item(item_id: str, db: AsyncSession = Depends(get_db)):
    item = await db.get(InventoryItem, item_id)
    if not item:
        raise HTTPException(404, "Inventory item not found")
    await db.delete(item)
    await db.commit()


@router.get("/inventory/events", response_model=list[InventoryEventResponse])
async def list_all_inventory_events(
    product_type: str | None = None,
    event_type: str | None = None,
    limit: int = Query(200, le=1000),
    db: AsyncSession = Depends(get_db),
):
    """List recent inventory events across all nodes."""
    query = select(InventoryEvent).order_by(InventoryEvent.timestamp.desc()).limit(limit)
    if product_type:
        query = query.where(InventoryEvent.product_type == product_type)
    if event_type:
        query = query.where(InventoryEvent.event_type == event_type)
    result = await db.execute(query)
    events = result.scalars().all()
    return [InventoryEventResponse(
        **{c.name: getattr(e, c.name) for c in InventoryEvent.__table__.columns},
    ) for e in events]


@router.get("/inventory/{node_id}/events", response_model=list[InventoryEventResponse])
async def list_inventory_events(
    node_id: str,
    product_type: str | None = None,
    limit: int = Query(100, le=1000),
    db: AsyncSession = Depends(get_db),
):
    query = select(InventoryEvent).where(
        InventoryEvent.node_id == node_id
    ).order_by(InventoryEvent.timestamp.desc()).limit(limit)
    if product_type:
        query = query.where(InventoryEvent.product_type == product_type)
    result = await db.execute(query)
    events = result.scalars().all()
    return [InventoryEventResponse(
        **{c.name: getattr(e, c.name) for c in InventoryEvent.__table__.columns},
    ) for e in events]
