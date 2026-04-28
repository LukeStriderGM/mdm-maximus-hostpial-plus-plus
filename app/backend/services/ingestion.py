"""DHA data ingestion service — parses CSV/Excel, maps MTFs to hub/spoke, seeds DB."""
import io
import re
import logging
from datetime import datetime

import pandas as pd
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.models import Hub, Spoke, InventoryItem, InventoryEvent, NodeType, EventType

logger = logging.getLogger(__name__)

# CSV injection characters to strip
INJECTION_CHARS = re.compile(r'^[=+\-@\t\r]')


def sanitize_cell(value) -> str:
    if pd.isna(value):
        return ""
    s = str(value).strip()
    s = INJECTION_CHARS.sub('', s)
    return s


def parse_csv(content: bytes) -> pd.DataFrame:
    df = pd.read_csv(io.BytesIO(content), encoding="utf-8-sig")
    return _validate_and_clean(df)


def parse_excel(content: bytes) -> pd.DataFrame:
    df = pd.read_excel(io.BytesIO(content), engine="openpyxl")
    return _validate_and_clean(df)


EXPECTED_COLUMNS = {
    "MTF Name", "Product Noun", "Product Type", "Item Dsc Short",
    "Manufacturer", "Order Qty",
}


def _validate_and_clean(df: pd.DataFrame) -> pd.DataFrame:
    # Check required columns exist
    missing = EXPECTED_COLUMNS - set(df.columns)
    if missing:
        raise ValueError(f"Missing required columns: {missing}")

    # Sanitize all string cells
    str_cols = df.select_dtypes(include=["object"]).columns
    for col in str_cols:
        df[col] = df[col].apply(sanitize_cell)

    # Coerce Order Qty to int
    df["Order Qty"] = pd.to_numeric(df["Order Qty"], errors="coerce").fillna(0).astype(int)

    return df


async def ingest_dataframe(df: pd.DataFrame, db: AsyncSession) -> dict:
    """Ingest a parsed DataFrame into the database, creating hubs/spokes/inventory."""
    stats = {"rows_processed": len(df), "hubs_created": 0, "spokes_created": 0, "items_created": 0, "errors": []}

    # Group by MTF to determine hub vs spoke (top 3 by order volume = hubs)
    mtf_volume = df.groupby("MTF Name")["Order Qty"].sum().sort_values(ascending=False)
    hub_mtfs = set(mtf_volume.head(3).index)
    spoke_mtfs = set(mtf_volume.index) - hub_mtfs

    # Create hubs
    mtf_to_node = {}
    lat_base, lng_base = 15.0, 130.0  # INDOPACOM region
    for i, mtf_name in enumerate(hub_mtfs):
        existing = (await db.execute(select(Hub).where(Hub.name == mtf_name))).scalar_one_or_none()
        if existing:
            mtf_to_node[mtf_name] = (existing.id, "hub")
            continue
        hub = Hub(
            name=mtf_name,
            latitude=lat_base + (i * 2),
            longitude=lng_base + (i * 3),
            capacity=int(mtf_volume.get(mtf_name, 0)),
        )
        db.add(hub)
        await db.flush()
        mtf_to_node[mtf_name] = (hub.id, "hub")
        stats["hubs_created"] += 1

    # Create spokes (assign to nearest hub by index)
    hub_ids = [nid for nid, ntype in mtf_to_node.values() if ntype == "hub"]
    for i, mtf_name in enumerate(spoke_mtfs):
        existing = (await db.execute(select(Spoke).where(Spoke.name == mtf_name))).scalar_one_or_none()
        if existing:
            mtf_to_node[mtf_name] = (existing.id, "spoke")
            continue
        parent_hub_id = hub_ids[i % len(hub_ids)] if hub_ids else None
        if not parent_hub_id:
            stats["errors"].append(f"No hub available for spoke {mtf_name}")
            continue
        spoke = Spoke(
            name=mtf_name,
            hub_id=parent_hub_id,
            latitude=lat_base + 1 + (i * 0.5),
            longitude=lng_base + 1 + (i * 0.7),
        )
        db.add(spoke)
        await db.flush()
        mtf_to_node[mtf_name] = (spoke.id, "spoke")
        stats["spokes_created"] += 1

    # Create inventory items (aggregate by MTF + product)
    grouped = df.groupby(["MTF Name", "Product Noun", "Product Type"]).agg({
        "Item Dsc Short": "first",
        "Manufacturer": "first",
        "Order Qty": "sum",
    }).reset_index()

    for _, row in grouped.iterrows():
        mtf_name = row["MTF Name"]
        if mtf_name not in mtf_to_node:
            continue
        node_id, node_type = mtf_to_node[mtf_name]

        item = InventoryItem(
            node_id=node_id,
            node_type=NodeType(node_type),
            product_noun=row["Product Noun"],
            product_type=row["Product Type"],
            item_description=row["Item Dsc Short"],
            manufacturer=row["Manufacturer"],
            catalog_number=row.get("Mfr Cat No.", "") if "Mfr Cat No." in row.index else "",
            unspsc_commodity=row.get("UNSPSC Commodity", "") if "UNSPSC Commodity" in row.index else "",
            quantity_on_hand=int(row["Order Qty"]),
            reorder_threshold=max(int(row["Order Qty"]) // 4, 5),
            cold_chain_required=("blood" in str(row["Product Type"]).lower()),
        )
        db.add(item)

        event = InventoryEvent(
            node_id=node_id, node_type=NodeType(node_type),
            product_type=row["Product Type"],
            event_type=EventType.restock,
            quantity_delta=int(row["Order Qty"]),
            timestamp=datetime.utcnow(),
        )
        db.add(event)
        stats["items_created"] += 1

    await db.commit()
    logger.info("Ingestion complete: %s", stats)
    return stats
