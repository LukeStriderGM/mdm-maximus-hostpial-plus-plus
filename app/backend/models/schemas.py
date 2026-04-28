from datetime import datetime, date
from pydantic import BaseModel, Field
from typing import Optional


# --- Enums as strings for API ---

class NodeStatusEnum:
    OPERATIONAL = "operational"
    DEGRADED = "degraded"
    OFFLINE = "offline"


# --- Hub Schemas ---

class HubCreate(BaseModel):
    name: str
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    status: str = "operational"
    capacity: int = 0


class HubUpdate(BaseModel):
    name: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    status: Optional[str] = None
    capacity: Optional[int] = None


class HubResponse(BaseModel):
    id: str
    name: str
    latitude: float
    longitude: float
    status: str
    capacity: int
    registered_at: datetime
    spoke_count: Optional[int] = 0
    inventory_count: Optional[int] = 0

    model_config = {"from_attributes": True}


# --- Spoke Schemas ---

class SpokeCreate(BaseModel):
    name: str
    hub_id: str
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    status: str = "operational"


class SpokeUpdate(BaseModel):
    name: Optional[str] = None
    hub_id: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    status: Optional[str] = None


class SpokeResponse(BaseModel):
    id: str
    name: str
    hub_id: str
    latitude: float
    longitude: float
    status: str
    registered_at: datetime
    inventory_count: Optional[int] = 0

    model_config = {"from_attributes": True}


# --- Inventory Schemas ---

class InventoryItemCreate(BaseModel):
    node_id: str
    node_type: str
    product_noun: str
    product_type: str
    item_description: Optional[str] = None
    manufacturer: Optional[str] = None
    catalog_number: Optional[str] = None
    unspsc_commodity: Optional[str] = None
    product_size: Optional[str] = None
    quantity_on_hand: int = 0
    reorder_threshold: int = 10
    expiration_date: Optional[date] = None
    cold_chain_required: bool = False


class InventoryItemUpdate(BaseModel):
    product_noun: Optional[str] = None
    product_type: Optional[str] = None
    item_description: Optional[str] = None
    manufacturer: Optional[str] = None
    quantity_on_hand: Optional[int] = None
    reorder_threshold: Optional[int] = None
    expiration_date: Optional[date] = None
    cold_chain_required: Optional[bool] = None


class InventoryItemResponse(BaseModel):
    id: str
    node_id: str
    node_type: str
    product_noun: str
    product_type: str
    item_description: Optional[str] = None
    manufacturer: Optional[str] = None
    catalog_number: Optional[str] = None
    unspsc_commodity: Optional[str] = None
    product_size: Optional[str] = None
    quantity_on_hand: int
    reorder_threshold: int
    expiration_date: Optional[date] = None
    cold_chain_required: bool
    updated_at: datetime

    model_config = {"from_attributes": True}


# --- Demand Signal Schemas ---

class DemandSignalCreate(BaseModel):
    spoke_id: str
    product_type: str
    quantity_needed: int = Field(gt=0)
    priority: str = "routine"
    casualty_scenario: Optional[str] = None


class DemandSignalResponse(BaseModel):
    id: str
    spoke_id: str
    product_type: str
    quantity_needed: int
    priority: str
    casualty_scenario: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# --- Supply Route Schemas ---

class SupplyRouteCreate(BaseModel):
    hub_id: str
    spoke_id: str
    transport_mode: str
    distance_km: float = 0.0
    transit_hours: float = 0.0
    status: str = "available"


class SupplyRouteUpdate(BaseModel):
    transport_mode: Optional[str] = None
    distance_km: Optional[float] = None
    transit_hours: Optional[float] = None
    status: Optional[str] = None


class SupplyRouteResponse(BaseModel):
    id: str
    hub_id: str
    spoke_id: str
    transport_mode: str
    distance_km: float
    transit_hours: float
    status: str
    last_updated: datetime

    model_config = {"from_attributes": True}


# --- Inventory Event Schemas ---

class InventoryEventCreate(BaseModel):
    node_id: str
    node_type: str
    product_type: str
    event_type: str
    quantity_delta: int


class InventoryEventResponse(BaseModel):
    id: str
    node_id: str
    node_type: str
    product_type: str
    event_type: str
    quantity_delta: int
    timestamp: datetime

    model_config = {"from_attributes": True}


# --- Analytics Schemas ---

class DaysOfSupply(BaseModel):
    node_id: str
    product_type: str
    quantity_on_hand: int
    avg_daily_consumption: float
    days_remaining: float
    risk_level: str  # critical, warning, caution, healthy


class StockoutRisk(BaseModel):
    node_id: str
    node_name: str
    node_type: str
    critical_items: int
    warning_items: int
    healthy_items: int
    overall_risk: str


class DemandSupplyGap(BaseModel):
    spoke_id: str
    product_type: str
    quantity_on_hand: int
    quantity_demanded: int
    gap: int
    gap_percentage: float


# --- Hub Aggregate Schemas ---

class HubDemandResponse(BaseModel):
    hub_id: str
    total_signals: int
    total_quantity_needed: int
    by_priority: dict[str, int]  # e.g. {"routine": 5, "urgent": 2, "emergency": 1}
    signals: list["DemandSignalResponse"]


class HubInventorySummary(BaseModel):
    hub_id: str
    total_items: int
    total_quantity: int
    by_product_type: list["ProductTypeSummary"]
    by_node: list["NodeInventorySummary"]


class ProductTypeSummary(BaseModel):
    product_type: str
    total_quantity: int
    item_count: int


class NodeInventorySummary(BaseModel):
    node_id: str
    node_name: str
    node_type: str
    total_quantity: int
    item_count: int


class HubStockoutRiskResponse(BaseModel):
    hub_id: str
    overall_risk: str
    nodes: list["StockoutRisk"]


class HubCapacityResponse(BaseModel):
    hub_id: str
    hub_name: str
    hub_capacity: int
    total_inventory: int
    utilization_pct: float
    spoke_count: int
    spokes_operational: int
    spokes_degraded: int
    spokes_offline: int


# --- Ingestion Schemas ---

class IngestionResult(BaseModel):
    rows_processed: int
    hubs_created: int
    spokes_created: int
    items_created: int
    errors: list[str] = []
