from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from models.database import get_db
from models.models import Hub, Spoke, InventoryItem, DemandSignal, NodeType
from models.schemas import (
    HubCreate, HubUpdate, HubResponse,
    HubDemandResponse, DemandSignalResponse,
    HubInventorySummary, ProductTypeSummary, NodeInventorySummary,
    HubStockoutRiskResponse, StockoutRisk,
    HubCapacityResponse,
)
from services.nats_service import nats_service

router = APIRouter()


@router.get("/hubs", response_model=list[HubResponse])
async def list_hubs(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Hub))
    hubs = result.scalars().all()
    responses = []
    for hub in hubs:
        spoke_count = (await db.execute(
            select(func.count()).where(Spoke.hub_id == hub.id)
        )).scalar() or 0
        inv_count = (await db.execute(
            select(func.count()).where(
                InventoryItem.node_id == hub.id,
                InventoryItem.node_type == NodeType.hub,
            )
        )).scalar() or 0
        responses.append(HubResponse(
            **{c.name: getattr(hub, c.name) for c in Hub.__table__.columns},
            spoke_count=spoke_count,
            inventory_count=inv_count,
        ))
    return responses


@router.get("/hubs/{hub_id}", response_model=HubResponse)
async def get_hub(hub_id: str, db: AsyncSession = Depends(get_db)):
    hub = await db.get(Hub, hub_id)
    if not hub:
        raise HTTPException(404, "Hub not found")
    spoke_count = (await db.execute(
        select(func.count()).where(Spoke.hub_id == hub.id)
    )).scalar() or 0
    inv_count = (await db.execute(
        select(func.count()).where(
            InventoryItem.node_id == hub.id,
            InventoryItem.node_type == NodeType.hub,
        )
    )).scalar() or 0
    return HubResponse(
        **{c.name: getattr(hub, c.name) for c in Hub.__table__.columns},
        spoke_count=spoke_count,
        inventory_count=inv_count,
    )


@router.post("/hubs", response_model=HubResponse, status_code=201)
async def create_hub(data: HubCreate, db: AsyncSession = Depends(get_db)):
    hub = Hub(**data.model_dump())
    db.add(hub)
    await db.commit()
    await db.refresh(hub)

    await nats_service.set_node_status(hub.id, {
        "type": "hub", "name": hub.name, "status": hub.status.value,
    })

    return HubResponse(
        **{c.name: getattr(hub, c.name) for c in Hub.__table__.columns},
        spoke_count=0, inventory_count=0,
    )


@router.put("/hubs/{hub_id}", response_model=HubResponse)
async def update_hub(hub_id: str, data: HubUpdate, db: AsyncSession = Depends(get_db)):
    hub = await db.get(Hub, hub_id)
    if not hub:
        raise HTTPException(404, "Hub not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(hub, key, value)
    await db.commit()
    await db.refresh(hub)

    await nats_service.set_node_status(hub.id, {
        "type": "hub", "name": hub.name, "status": hub.status.value,
    })

    return HubResponse(
        **{c.name: getattr(hub, c.name) for c in Hub.__table__.columns},
    )


@router.delete("/hubs/{hub_id}", status_code=204)
async def delete_hub(hub_id: str, db: AsyncSession = Depends(get_db)):
    hub = await db.get(Hub, hub_id)
    if not hub:
        raise HTTPException(404, "Hub not found")
    await db.delete(hub)
    await db.commit()


# ── Hub-aggregate endpoints ──────────────────────────────────────────


@router.get("/hubs/{hub_id}/demand", response_model=HubDemandResponse)
async def get_hub_demand(
    hub_id: str,
    priority: str | None = None,
    limit: int = Query(200, le=1000),
    db: AsyncSession = Depends(get_db),
):
    """All demand signals from spokes connected to this hub."""
    hub = await db.get(Hub, hub_id)
    if not hub:
        raise HTTPException(404, "Hub not found")

    # Get spoke IDs for this hub
    spoke_ids_result = await db.execute(
        select(Spoke.id).where(Spoke.hub_id == hub_id)
    )
    spoke_ids = [r[0] for r in spoke_ids_result.all()]

    if not spoke_ids:
        return HubDemandResponse(
            hub_id=hub_id, total_signals=0, total_quantity_needed=0,
            by_priority={}, signals=[],
        )

    # Fetch demand signals
    query = (
        select(DemandSignal)
        .where(DemandSignal.spoke_id.in_(spoke_ids))
        .order_by(DemandSignal.created_at.desc())
    )
    if priority:
        query = query.where(DemandSignal.priority == priority)
    query = query.limit(limit)

    result = await db.execute(query)
    signals = result.scalars().all()

    # Build priority counts
    by_priority: dict[str, int] = {}
    total_qty = 0
    for s in signals:
        p = s.priority.value if hasattr(s.priority, "value") else s.priority
        by_priority[p] = by_priority.get(p, 0) + 1
        total_qty += s.quantity_needed

    signal_responses = [
        DemandSignalResponse(
            **{c.name: getattr(s, c.name) for c in DemandSignal.__table__.columns}
        )
        for s in signals
    ]

    return HubDemandResponse(
        hub_id=hub_id,
        total_signals=len(signals),
        total_quantity_needed=total_qty,
        by_priority=by_priority,
        signals=signal_responses,
    )


@router.get("/hubs/{hub_id}/inventory", response_model=HubInventorySummary)
async def get_hub_inventory(hub_id: str, db: AsyncSession = Depends(get_db)):
    """Aggregate inventory across the hub and all its connected spokes."""
    hub = await db.get(Hub, hub_id)
    if not hub:
        raise HTTPException(404, "Hub not found")

    # Collect all node IDs in the network
    spoke_result = await db.execute(
        select(Spoke.id, Spoke.name).where(Spoke.hub_id == hub_id)
    )
    spokes = spoke_result.all()
    node_ids = [hub_id] + [s[0] for s in spokes]
    node_names = {hub_id: hub.name}
    node_types = {hub_id: "hub"}
    for s_id, s_name in spokes:
        node_names[s_id] = s_name
        node_types[s_id] = "spoke"

    # Aggregate by product type
    pt_result = await db.execute(
        select(
            InventoryItem.product_type,
            func.sum(InventoryItem.quantity_on_hand),
            func.count(),
        )
        .where(InventoryItem.node_id.in_(node_ids))
        .group_by(InventoryItem.product_type)
    )
    by_product_type = [
        ProductTypeSummary(product_type=row[0], total_quantity=row[1], item_count=row[2])
        for row in pt_result.all()
    ]

    # Aggregate by node
    node_result = await db.execute(
        select(
            InventoryItem.node_id,
            func.sum(InventoryItem.quantity_on_hand),
            func.count(),
        )
        .where(InventoryItem.node_id.in_(node_ids))
        .group_by(InventoryItem.node_id)
    )
    by_node = [
        NodeInventorySummary(
            node_id=row[0],
            node_name=node_names.get(row[0], "Unknown"),
            node_type=node_types.get(row[0], "spoke"),
            total_quantity=row[1],
            item_count=row[2],
        )
        for row in node_result.all()
    ]

    total_items = sum(n.item_count for n in by_node)
    total_qty = sum(n.total_quantity for n in by_node)

    return HubInventorySummary(
        hub_id=hub_id,
        total_items=total_items,
        total_quantity=total_qty,
        by_product_type=by_product_type,
        by_node=by_node,
    )


@router.get("/hubs/{hub_id}/stockout-risk", response_model=HubStockoutRiskResponse)
async def get_hub_stockout_risk(hub_id: str, db: AsyncSession = Depends(get_db)):
    """Stockout risk scoped to a hub's network (hub + connected spokes)."""
    hub = await db.get(Hub, hub_id)
    if not hub:
        raise HTTPException(404, "Hub not found")

    # Gather all nodes in the network
    spokes = (await db.execute(
        select(Spoke).where(Spoke.hub_id == hub_id)
    )).scalars().all()

    all_node_ids = [hub.id] + [s.id for s in spokes]
    node_info = {hub.id: (hub.name, "hub")}
    for s in spokes:
        node_info[s.id] = (s.name, "spoke")

    # Single batch fetch for all inventory items in the network
    all_items = (await db.execute(
        select(InventoryItem).where(InventoryItem.node_id.in_(all_node_ids))
    )).scalars().all()

    # Bucket items by node_id
    items_by_node: dict[str, list[InventoryItem]] = {nid: [] for nid in all_node_ids}
    for item in all_items:
        items_by_node.setdefault(item.node_id, []).append(item)

    # Compute risk per node
    risks: list[StockoutRisk] = []
    for node_id in all_node_ids:
        name, ntype = node_info[node_id]
        items = items_by_node[node_id]
        critical = sum(1 for i in items if i.quantity_on_hand < i.reorder_threshold * 0.3)
        warning = sum(1 for i in items if i.reorder_threshold * 0.3 <= i.quantity_on_hand < i.reorder_threshold)
        healthy = len(items) - critical - warning
        overall = "critical" if critical > 0 else ("warning" if warning > 0 else "healthy")
        risks.append(StockoutRisk(
            node_id=node_id, node_name=name, node_type=ntype,
            critical_items=critical, warning_items=warning,
            healthy_items=healthy, overall_risk=overall,
        ))

    risks.sort(key=lambda r: {"critical": 0, "warning": 1, "healthy": 2}[r.overall_risk])

    worst = risks[0].overall_risk if risks else "healthy"
    return HubStockoutRiskResponse(
        hub_id=hub_id, overall_risk=worst, nodes=risks,
    )


@router.get("/hubs/{hub_id}/capacity", response_model=HubCapacityResponse)
async def get_hub_capacity(hub_id: str, db: AsyncSession = Depends(get_db)):
    """Capacity utilization for a hub's network."""
    hub = await db.get(Hub, hub_id)
    if not hub:
        raise HTTPException(404, "Hub not found")

    # Total inventory quantity across the hub's network
    spoke_ids_result = await db.execute(
        select(Spoke.id, Spoke.status).where(Spoke.hub_id == hub_id)
    )
    spoke_rows = spoke_ids_result.all()
    all_node_ids = [hub_id] + [r[0] for r in spoke_rows]

    total_inv = (await db.execute(
        select(func.sum(InventoryItem.quantity_on_hand))
        .where(InventoryItem.node_id.in_(all_node_ids))
    )).scalar() or 0

    spoke_statuses = [r[1].value if hasattr(r[1], "value") else r[1] for r in spoke_rows]
    utilization = (total_inv / hub.capacity * 100) if hub.capacity > 0 else 0.0

    return HubCapacityResponse(
        hub_id=hub_id,
        hub_name=hub.name,
        hub_capacity=hub.capacity,
        total_inventory=total_inv,
        utilization_pct=round(utilization, 1),
        spoke_count=len(spoke_rows),
        spokes_operational=sum(1 for s in spoke_statuses if s == "operational"),
        spokes_degraded=sum(1 for s in spoke_statuses if s == "degraded"),
        spokes_offline=sum(1 for s in spoke_statuses if s == "offline"),
    )
