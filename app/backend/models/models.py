import enum
import uuid
from datetime import datetime, date
from sqlalchemy import (
    String, Float, Integer, Boolean, DateTime, Date,
    ForeignKey, Enum, Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .database import Base


class NodeStatus(str, enum.Enum):
    operational = "operational"
    degraded = "degraded"
    offline = "offline"


class NodeType(str, enum.Enum):
    hub = "hub"
    spoke = "spoke"


class Priority(str, enum.Enum):
    routine = "routine"
    urgent = "urgent"
    emergency = "emergency"


class RouteStatus(str, enum.Enum):
    available = "available"
    degraded = "degraded"
    denied = "denied"


class EventType(str, enum.Enum):
    restock = "restock"
    consume = "consume"
    expire = "expire"
    transfer = "transfer"


class Hub(Base):
    __tablename__ = "hubs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    status: Mapped[NodeStatus] = mapped_column(Enum(NodeStatus), default=NodeStatus.operational)
    capacity: Mapped[int] = mapped_column(Integer, default=0)
    registered_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    spokes: Mapped[list["Spoke"]] = relationship("Spoke", back_populates="hub", cascade="all, delete-orphan")
    supply_routes: Mapped[list["SupplyRoute"]] = relationship("SupplyRoute", back_populates="hub", cascade="all, delete-orphan")


class Spoke(Base):
    __tablename__ = "spokes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    hub_id: Mapped[str] = mapped_column(String(36), ForeignKey("hubs.id"), nullable=False)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    status: Mapped[NodeStatus] = mapped_column(Enum(NodeStatus), default=NodeStatus.operational)
    registered_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    hub: Mapped["Hub"] = relationship("Hub", back_populates="spokes")
    supply_routes: Mapped[list["SupplyRoute"]] = relationship("SupplyRoute", back_populates="spoke", cascade="all, delete-orphan")


class InventoryItem(Base):
    __tablename__ = "inventory_items"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    node_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    node_type: Mapped[NodeType] = mapped_column(Enum(NodeType), nullable=False)
    product_noun: Mapped[str] = mapped_column(String(100), nullable=False)
    product_type: Mapped[str] = mapped_column(String(100), nullable=False)
    item_description: Mapped[str] = mapped_column(Text, nullable=True)
    manufacturer: Mapped[str] = mapped_column(String(255), nullable=True)
    catalog_number: Mapped[str] = mapped_column(String(100), nullable=True)
    unspsc_commodity: Mapped[str] = mapped_column(String(255), nullable=True)
    product_size: Mapped[str] = mapped_column(String(50), nullable=True)
    quantity_on_hand: Mapped[int] = mapped_column(Integer, default=0)
    reorder_threshold: Mapped[int] = mapped_column(Integer, default=10)
    expiration_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    cold_chain_required: Mapped[bool] = mapped_column(Boolean, default=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class DemandSignal(Base):
    __tablename__ = "demand_signals"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    spoke_id: Mapped[str] = mapped_column(String(36), ForeignKey("spokes.id"), nullable=False)
    product_type: Mapped[str] = mapped_column(String(100), nullable=False)
    quantity_needed: Mapped[int] = mapped_column(Integer, nullable=False)
    priority: Mapped[Priority] = mapped_column(Enum(Priority), default=Priority.routine)
    casualty_scenario: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class SupplyRoute(Base):
    __tablename__ = "supply_routes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    hub_id: Mapped[str] = mapped_column(String(36), ForeignKey("hubs.id"), nullable=False)
    spoke_id: Mapped[str] = mapped_column(String(36), ForeignKey("spokes.id"), nullable=False)
    transport_mode: Mapped[str] = mapped_column(String(50), nullable=False)
    distance_km: Mapped[float] = mapped_column(Float, default=0.0)
    transit_hours: Mapped[float] = mapped_column(Float, default=0.0)
    status: Mapped[RouteStatus] = mapped_column(Enum(RouteStatus), default=RouteStatus.available)
    last_updated: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    hub: Mapped["Hub"] = relationship("Hub", back_populates="supply_routes")
    spoke: Mapped["Spoke"] = relationship("Spoke", back_populates="supply_routes")


class InventoryEvent(Base):
    __tablename__ = "inventory_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    node_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    node_type: Mapped[NodeType] = mapped_column(Enum(NodeType), nullable=False)
    product_type: Mapped[str] = mapped_column(String(100), nullable=False)
    event_type: Mapped[EventType] = mapped_column(Enum(EventType), nullable=False)
    quantity_delta: Mapped[int] = mapped_column(Integer, nullable=False)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
