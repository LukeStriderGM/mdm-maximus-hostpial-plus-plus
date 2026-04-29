"""
Best-path routing service — Dijkstra-based pathfinding across the hub-and-spoke network.

Builds a weighted graph from Hubs, Spokes, and SupplyRoutes, then finds
optimal multi-hop paths from any node with available inventory to a destination.
"""
import heapq
import math
from dataclasses import dataclass, field

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from models.models import Hub, Spoke, SupplyRoute, InventoryItem
from services.ml_interface import HeuristicPredictor

_route_risk = HeuristicPredictor()


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------

@dataclass
class PathStep:
    from_node_id: str
    from_node_type: str
    from_node_name: str
    from_lat: float
    from_lng: float
    to_node_id: str
    to_node_type: str
    to_node_name: str
    to_lat: float
    to_lng: float
    route_id: str | None
    transport_mode: str
    distance_km: float
    transit_hours: float
    route_status: str
    risk_level: str


@dataclass
class PathResult:
    steps: list[PathStep]
    total_distance_km: float
    total_transit_hours: float
    total_cost: float
    source_node_id: str
    source_node_name: str
    source_inventory: int
    risk_summary: str
    path_type: str  # "direct", "cross-network", "lateral"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _haversine(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance in km."""
    R = 6371.0
    rlat1, rlng1, rlat2, rlng2 = (math.radians(v) for v in (lat1, lng1, lat2, lng2))
    dlat = rlat2 - rlat1
    dlng = rlng2 - rlng1
    a = math.sin(dlat / 2) ** 2 + math.cos(rlat1) * math.cos(rlat2) * math.sin(dlng / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


STATUS_PENALTY = {"available": 1.0, "degraded": 3.0, "denied": float("inf")}
NODE_STATUS_PENALTY = {"operational": 1.0, "degraded": 2.0, "offline": float("inf")}

# Fixed-wing speed for synthetic hub-to-hub edges
HUB_HUB_SPEED_KPH = 800.0


def _edge_weight(
    transit_hours: float,
    distance_km: float,
    route_status: str,
    transport_mode: str,
    priority: str,
) -> float:
    """Compute edge weight incorporating status, risk, and priority."""
    sp = STATUS_PENALTY.get(route_status, 1.0)
    if sp == float("inf"):
        return float("inf")
    # Clamp transit to minimum 0.1h to avoid 0 * inf = NaN
    transit_hours = max(transit_hours, 0.1)
    risk = _route_risk.assess_route_risk("", distance_km, transit_hours, transport_mode)
    risk_mult = {"low": 0.0, "medium": 0.3, "high": 0.7, "critical": 1.5}.get(risk.risk_level, 0.5)
    weight = transit_hours * sp * (1 + risk_mult)
    if priority == "emergency" and transport_mode in ("fixed-wing", "rotary-wing"):
        weight *= 0.5
    return weight


def _classify_path(steps: list[PathStep]) -> str:
    """Classify a path as direct, cross-network, or lateral."""
    if len(steps) == 1:
        return "direct"
    has_hub_to_hub = any(
        s.from_node_type == "hub" and s.to_node_type == "hub" for s in steps
    )
    if has_hub_to_hub:
        return "cross-network"
    return "lateral"


def _worst_risk(steps: list[PathStep]) -> str:
    """Return the worst risk level across all steps."""
    order = {"low": 0, "medium": 1, "high": 2, "critical": 3}
    worst = "low"
    for s in steps:
        if order.get(s.risk_level, 0) > order.get(worst, 0):
            worst = s.risk_level
    return worst


# ---------------------------------------------------------------------------
# Graph + Dijkstra
# ---------------------------------------------------------------------------

@dataclass
class _Edge:
    to_id: str
    route_id: str | None
    transport_mode: str
    distance_km: float
    transit_hours: float
    route_status: str
    weight: float


@dataclass
class _Node:
    id: str
    node_type: str
    name: str
    lat: float
    lng: float
    status: str


def _dijkstra(
    adj: dict[str, list[_Edge]],
    source: str,
    target: str,
) -> tuple[float, list[str]] | None:
    """Standard Dijkstra returning (cost, node_id_path) or None if unreachable."""
    dist: dict[str, float] = {source: 0.0}
    prev: dict[str, str | None] = {source: None}
    pq: list[tuple[float, str]] = [(0.0, source)]

    while pq:
        d, u = heapq.heappop(pq)
        if u == target:
            # Reconstruct path
            path = []
            cur: str | None = target
            while cur is not None:
                path.append(cur)
                cur = prev.get(cur)
            return d, list(reversed(path))
        if d > dist.get(u, float("inf")):
            continue
        for edge in adj.get(u, []):
            nd = d + edge.weight
            if nd < dist.get(edge.to_id, float("inf")):
                dist[edge.to_id] = nd
                prev[edge.to_id] = u
                heapq.heappush(pq, (nd, edge.to_id))

    return None


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def find_best_paths(
    db: AsyncSession,
    destination_node_id: str,
    product_type: str,
    priority: str = "routine",
    max_results: int = 3,
) -> list[PathResult]:
    # 1. Load all nodes
    hubs = (await db.execute(select(Hub))).scalars().all()
    spokes = (await db.execute(select(Spoke))).scalars().all()
    routes = (await db.execute(select(SupplyRoute))).scalars().all()

    nodes: dict[str, _Node] = {}
    for h in hubs:
        nodes[h.id] = _Node(h.id, "hub", h.name, h.latitude, h.longitude, h.status.value if hasattr(h.status, 'value') else h.status)
    for s in spokes:
        nodes[s.id] = _Node(s.id, "spoke", s.name, s.latitude, s.longitude, s.status.value if hasattr(s.status, 'value') else s.status)

    if destination_node_id not in nodes:
        return []

    # 2. Build adjacency list
    adj: dict[str, list[_Edge]] = {nid: [] for nid in nodes}

    # Track nodes that have explicit routes
    nodes_with_routes: set[str] = set()

    for r in routes:
        status_str = r.status.value if hasattr(r.status, 'value') else r.status
        src = r.source_node_id
        dst = r.dest_node_id
        if src not in nodes or dst not in nodes:
            continue
        w = _edge_weight(r.transit_hours, r.distance_km, status_str, r.transport_mode, priority)
        # Bidirectional edge for all route types
        adj[src].append(_Edge(dst, r.id, r.transport_mode, r.distance_km, r.transit_hours, status_str, w))
        adj[dst].append(_Edge(src, r.id, r.transport_mode, r.distance_km, r.transit_hours, status_str, w))
        nodes_with_routes.add(src)
        nodes_with_routes.add(dst)

    # Fallback: create spoke <-> parent hub edges from Spoke.hub_id when no SupplyRoute exists
    hub_node_map = {h.id: h for h in hubs}
    spoke_node_map = {s.id: s for s in spokes}
    GROUND_SPEED_KPH = 60.0
    for s in spokes:
        if s.id in nodes_with_routes:
            continue
        # If spoke has a parent spoke, create edge to parent spoke
        if s.parent_spoke_id and s.parent_spoke_id in nodes:
            ps = spoke_node_map.get(s.parent_spoke_id)
            if ps:
                dist_km = _haversine(s.latitude, s.longitude, ps.latitude, ps.longitude)
                transit_h = max(dist_km / GROUND_SPEED_KPH, 0.5)
                w = _edge_weight(transit_h, dist_km, "available", "ground", priority)
                adj[s.id].append(_Edge(ps.id, None, "ground", round(dist_km, 1), round(transit_h, 1), "available", w))
                adj[ps.id].append(_Edge(s.id, None, "ground", round(dist_km, 1), round(transit_h, 1), "available", w))
                continue
        # Otherwise fall back to parent hub
        parent = hub_node_map.get(s.hub_id)
        if not parent:
            continue
        dist_km = _haversine(s.latitude, s.longitude, parent.latitude, parent.longitude)
        transit_h = max(dist_km / GROUND_SPEED_KPH, 0.5)  # minimum 30 min
        w = _edge_weight(transit_h, dist_km, "available", "ground", priority)
        adj[s.id].append(_Edge(parent.id, None, "ground", round(dist_km, 1), round(transit_h, 1), "available", w))
        adj[parent.id].append(_Edge(s.id, None, "ground", round(dist_km, 1), round(transit_h, 1), "available", w))

    # Synthetic hub-to-hub edges
    hub_list = [h for h in hubs]
    for i, h1 in enumerate(hub_list):
        for h2 in hub_list[i + 1:]:
            dist_km = _haversine(h1.latitude, h1.longitude, h2.latitude, h2.longitude)
            transit_h = max(dist_km / HUB_HUB_SPEED_KPH, 0.25)  # minimum 15 min
            w = _edge_weight(transit_h, dist_km, "available", "fixed-wing", priority)
            adj[h1.id].append(_Edge(h2.id, None, "fixed-wing", dist_km, transit_h, "available", w))
            adj[h2.id].append(_Edge(h1.id, None, "fixed-wing", dist_km, transit_h, "available", w))

    # Apply node status penalty — multiply all edges entering offline/degraded nodes
    for nid, node in nodes.items():
        penalty = NODE_STATUS_PENALTY.get(node.status, 1.0)
        if penalty != 1.0:
            for edges in adj.values():
                for e in edges:
                    if e.to_id == nid:
                        e.weight *= penalty

    # 3. Find nodes with available inventory of the requested product
    inv_query = (
        select(InventoryItem.node_id, func.sum(InventoryItem.quantity_on_hand).label("qty"))
        .where(InventoryItem.product_type == product_type)
        .where(InventoryItem.quantity_on_hand > 0)
        .group_by(InventoryItem.node_id)
    )
    inv_rows = (await db.execute(inv_query)).all()
    inventory_by_node: dict[str, int] = {row.node_id: int(row.qty) for row in inv_rows}

    # Exclude destination from sources
    source_nodes = {nid: qty for nid, qty in inventory_by_node.items() if nid != destination_node_id and nid in nodes}

    if not source_nodes:
        return []

    # 4. Run Dijkstra from each source
    raw_results: list[PathResult] = []
    for source_id, qty in source_nodes.items():
        result = _dijkstra(adj, source_id, destination_node_id)
        if result is None:
            continue
        cost, node_path = result

        # Build steps
        steps: list[PathStep] = []
        for idx in range(len(node_path) - 1):
            from_id = node_path[idx]
            to_id = node_path[idx + 1]
            from_n = nodes[from_id]
            to_n = nodes[to_id]
            # Find best edge between from_id and to_id
            best_edge = min(
                (e for e in adj[from_id] if e.to_id == to_id),
                key=lambda e: e.weight,
            )
            risk = _route_risk.assess_route_risk(
                best_edge.route_id or "", best_edge.distance_km,
                best_edge.transit_hours, best_edge.transport_mode,
            )
            steps.append(PathStep(
                from_node_id=from_id, from_node_type=from_n.node_type, from_node_name=from_n.name,
                from_lat=from_n.lat, from_lng=from_n.lng,
                to_node_id=to_id, to_node_type=to_n.node_type, to_node_name=to_n.name,
                to_lat=to_n.lat, to_lng=to_n.lng,
                route_id=best_edge.route_id, transport_mode=best_edge.transport_mode,
                distance_km=round(best_edge.distance_km, 1), transit_hours=round(best_edge.transit_hours, 1),
                route_status=best_edge.route_status, risk_level=risk.risk_level,
            ))

        raw_results.append(PathResult(
            steps=steps,
            total_distance_km=round(sum(s.distance_km for s in steps), 1),
            total_transit_hours=round(sum(s.transit_hours for s in steps), 1),
            total_cost=round(cost, 2),
            source_node_id=source_id,
            source_node_name=nodes[source_id].name,
            source_inventory=qty,
            risk_summary=_worst_risk(steps),
            path_type=_classify_path(steps),
        ))

    # 5. Sort by cost, return top N
    raw_results.sort(key=lambda r: r.total_cost)
    return raw_results[:max_results]
