from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from models.database import get_db
from models.models import (
    InventoryItem, InventoryEvent, DemandSignal,
    Hub, Spoke, SupplyRoute, EventType, NodeType,
)
from models.schemas import DaysOfSupply, StockoutRisk, DemandSupplyGap
from services.ml_interface import ml_predictor

router = APIRouter()


@router.get("/analytics/inventory-summary")
async def get_inventory_summary(db: AsyncSession = Depends(get_db)):
    """Global inventory summary aggregated by product type."""
    # Aggregate inventory by product type
    inv_result = await db.execute(
        select(
            InventoryItem.product_type,
            func.sum(InventoryItem.quantity_on_hand).label("total_quantity"),
            func.sum(InventoryItem.reorder_threshold).label("total_reorder"),
            func.count().label("item_count"),
        )
        .group_by(InventoryItem.product_type)
        .order_by(func.sum(InventoryItem.quantity_on_hand).desc())
    )
    rows = inv_result.all()

    # Get consumption totals from events for each product type (for trend)
    consume_result = await db.execute(
        select(
            InventoryEvent.product_type,
            func.sum(func.abs(InventoryEvent.quantity_delta)).label("total_consumed"),
        )
        .where(InventoryEvent.event_type == EventType.consume)
        .group_by(InventoryEvent.product_type)
    )
    consumption = {row[0]: row[1] for row in consume_result.all()}

    # Get restock totals
    restock_result = await db.execute(
        select(
            InventoryEvent.product_type,
            func.sum(InventoryEvent.quantity_delta).label("total_restocked"),
        )
        .where(InventoryEvent.event_type == EventType.restock)
        .group_by(InventoryEvent.product_type)
    )
    restocks = {row[0]: row[1] for row in restock_result.all()}

    summary = []
    for row in rows:
        pt, total_qty, total_reorder, item_count = row
        consumed = consumption.get(pt, 0)
        restocked = restocks.get(pt, 0)
        fill_rate = (total_qty / total_reorder * 100) if total_reorder > 0 else 100.0
        summary.append({
            "product_type": pt,
            "total_quantity": total_qty,
            "total_reorder_threshold": total_reorder,
            "item_count": item_count,
            "fill_rate": round(fill_rate, 1),
            "total_consumed": consumed,
            "total_restocked": restocked,
            "net_flow": restocked - consumed,
        })

    return summary


@router.get("/analytics/days-of-supply/{node_id}", response_model=list[DaysOfSupply])
async def get_days_of_supply(node_id: str, db: AsyncSession = Depends(get_db)):
    """Calculate days of supply remaining per product type for a node."""
    # Get distinct product types at this node
    result = await db.execute(
        select(InventoryItem.product_type, func.sum(InventoryItem.quantity_on_hand))
        .where(InventoryItem.node_id == node_id)
        .group_by(InventoryItem.product_type)
    )
    inventory_by_type = {row[0]: row[1] for row in result.all()}

    # Estimate daily consumption from events (last 30 days of consume events)
    consume_result = await db.execute(
        select(InventoryEvent.product_type, func.sum(func.abs(InventoryEvent.quantity_delta)))
        .where(
            InventoryEvent.node_id == node_id,
            InventoryEvent.event_type == EventType.consume,
        )
        .group_by(InventoryEvent.product_type)
    )
    consumption_totals = {row[0]: row[1] for row in consume_result.all()}

    days_of_supply = []
    for product_type, qty in inventory_by_type.items():
        total_consumed = consumption_totals.get(product_type, 0)
        # Estimate daily rate (assume events span ~30 days, or use a default)
        avg_daily = total_consumed / 30.0 if total_consumed > 0 else 1.0

        prediction = ml_predictor.predict_stockout(
            node_id=node_id, product_type=product_type,
            quantity=qty, avg_consumption=avg_daily,
        )
        days_of_supply.append(DaysOfSupply(
            node_id=node_id,
            product_type=product_type,
            quantity_on_hand=qty,
            avg_daily_consumption=round(avg_daily, 2),
            days_remaining=prediction.days_until_stockout,
            risk_level=prediction.risk_level,
        ))

    return sorted(days_of_supply, key=lambda d: d.days_remaining)


@router.get("/analytics/stockout-risk", response_model=list[StockoutRisk])
async def get_stockout_risk(db: AsyncSession = Depends(get_db)):
    """Get stockout risk summary for all nodes."""
    risks = []

    # Process hubs
    hubs = (await db.execute(select(Hub))).scalars().all()
    for hub in hubs:
        items = (await db.execute(
            select(InventoryItem).where(
                InventoryItem.node_id == hub.id,
                InventoryItem.node_type == NodeType.hub,
            )
        )).scalars().all()

        critical = sum(1 for i in items if i.quantity_on_hand < i.reorder_threshold * 0.3)
        warning = sum(1 for i in items if i.reorder_threshold * 0.3 <= i.quantity_on_hand < i.reorder_threshold)
        healthy = len(items) - critical - warning

        overall = "critical" if critical > 0 else ("warning" if warning > 0 else "healthy")
        risks.append(StockoutRisk(
            node_id=hub.id, node_name=hub.name, node_type="hub",
            critical_items=critical, warning_items=warning, healthy_items=healthy,
            overall_risk=overall,
        ))

    # Process spokes
    spokes = (await db.execute(select(Spoke))).scalars().all()
    for spoke in spokes:
        items = (await db.execute(
            select(InventoryItem).where(
                InventoryItem.node_id == spoke.id,
                InventoryItem.node_type == NodeType.spoke,
            )
        )).scalars().all()

        critical = sum(1 for i in items if i.quantity_on_hand < i.reorder_threshold * 0.3)
        warning = sum(1 for i in items if i.reorder_threshold * 0.3 <= i.quantity_on_hand < i.reorder_threshold)
        healthy = len(items) - critical - warning

        overall = "critical" if critical > 0 else ("warning" if warning > 0 else "healthy")
        risks.append(StockoutRisk(
            node_id=spoke.id, node_name=spoke.name, node_type="spoke",
            critical_items=critical, warning_items=warning, healthy_items=healthy,
            overall_risk=overall,
        ))

    return sorted(risks, key=lambda r: {"critical": 0, "warning": 1, "healthy": 2}[r.overall_risk])


@router.get("/analytics/demand-gap/{spoke_id}", response_model=list[DemandSupplyGap])
async def get_demand_supply_gap(spoke_id: str, db: AsyncSession = Depends(get_db)):
    """Compare demand signals against inventory for a spoke."""
    # Aggregate demand by product type
    demand_result = await db.execute(
        select(DemandSignal.product_type, func.sum(DemandSignal.quantity_needed))
        .where(DemandSignal.spoke_id == spoke_id)
        .group_by(DemandSignal.product_type)
    )
    demand_by_type = {row[0]: row[1] for row in demand_result.all()}

    # Get inventory by product type
    inv_result = await db.execute(
        select(InventoryItem.product_type, func.sum(InventoryItem.quantity_on_hand))
        .where(InventoryItem.node_id == spoke_id)
        .group_by(InventoryItem.product_type)
    )
    inventory_by_type = {row[0]: row[1] for row in inv_result.all()}

    # Combine all product types
    all_types = set(demand_by_type.keys()) | set(inventory_by_type.keys())
    gaps = []
    for pt in all_types:
        on_hand = inventory_by_type.get(pt, 0)
        demanded = demand_by_type.get(pt, 0)
        gap = on_hand - demanded
        pct = (gap / demanded * 100) if demanded > 0 else 100.0
        gaps.append(DemandSupplyGap(
            spoke_id=spoke_id, product_type=pt,
            quantity_on_hand=on_hand, quantity_demanded=demanded,
            gap=gap, gap_percentage=round(pct, 1),
        ))

    return sorted(gaps, key=lambda g: g.gap)
