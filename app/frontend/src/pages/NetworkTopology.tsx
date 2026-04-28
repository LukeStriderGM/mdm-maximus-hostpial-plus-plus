import { useRef, useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
} from "d3-force";
import {
  getHubs,
  getSpokes,
  getSupplyRoutes,
  getStockoutRisk,
  type StockoutRisk,
} from "../lib/api";
import { Panel } from "../components/ui/Panel";
import { StatusBadge } from "../components/ui/StatusBadge";

// ---------- Graph types ----------

interface GraphNode extends SimulationNodeDatum {
  id: string;
  label: string;
  type: "hub" | "spoke";
  status: string;
  risk?: string;
  spokeCount?: number;
  hubId?: string;
  capacity?: number;
  inventoryCount?: number;
}

interface GraphLink extends SimulationLinkDatum<GraphNode> {
  id: string;
  kind: "supply-route" | "hub-mesh";
  transportMode?: string;
  distanceKm?: number;
  transitHours?: number;
  routeStatus?: string;
  weight?: number; // 0-1 normalized, 1 = fastest/highest value
}

// ---------- Colors ----------

const NODE_COLORS: Record<string, string> = {
  hub: "#6c63ff",
  spoke: "#3b82f6",
};

const STATUS_RING: Record<string, string> = {
  operational: "#1a7f4b",
  degraded: "#ff9900",
  offline: "#d10e5c",
};

const RISK_GLOW: Record<string, string> = {
  critical: "#d10e5c",
  warning: "#ff9900",
  healthy: "#1a7f4b",
};

const LINK_COLORS: Record<string, string> = {
  "supply-route": "#3b82f680",
  "hub-mesh": "#6c63ff40",
};

const ROUTE_STATUS_COLORS: Record<string, string> = {
  available: "#1a7f4b80",
  degraded: "#ff990080",
  denied: "#d10e5c80",
};

// ---------- Component ----------

export function NetworkTopology() {
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const simRef = useRef<ReturnType<typeof forceSimulation<GraphNode>> | null>(null);
  const nodesRef = useRef<GraphNode[]>([]);
  const linksRef = useRef<GraphLink[]>([]);
  const transformRef = useRef({ x: 0, y: 0, k: 1 });
  const dragRef = useRef<{ node: GraphNode | null; offsetX: number; offsetY: number }>({
    node: null, offsetX: 0, offsetY: 0,
  });
  const hoveredRef = useRef<GraphNode | null>(null);
  const hoveredLinkRef = useRef<GraphLink | null>(null);
  const [, setHovered] = useState<GraphNode | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // Data fetching
  const { data: hubs } = useQuery({ queryKey: ["hubs"], queryFn: getHubs });
  const { data: spokes } = useQuery({ queryKey: ["spokes"], queryFn: () => getSpokes() });
  const { data: routes } = useQuery({ queryKey: ["supply-routes"], queryFn: getSupplyRoutes });
  const { data: risks } = useQuery({ queryKey: ["stockout-risk"], queryFn: getStockoutRisk });

  const riskMap = useMemo(() => {
    const map = new Map<string, StockoutRisk>();
    risks?.forEach((r) => map.set(r.node_id, r));
    return map;
  }, [risks]);

  // Build graph data
  const { nodes, links } = useMemo(() => {
    if (!hubs || !spokes) return { nodes: [] as GraphNode[], links: [] as GraphLink[] };

    const nodes: GraphNode[] = [];
    const links: GraphLink[] = [];

    // Hub nodes
    for (const hub of hubs) {
      nodes.push({
        id: hub.id,
        label: hub.name,
        type: "hub",
        status: hub.status,
        risk: riskMap.get(hub.id)?.overall_risk,
        spokeCount: hub.spoke_count,
        capacity: hub.capacity,
        inventoryCount: hub.inventory_count,
      });
    }

    // Spoke nodes
    for (const spoke of spokes) {
      nodes.push({
        id: spoke.id,
        label: spoke.name,
        type: "spoke",
        status: spoke.status,
        risk: riskMap.get(spoke.id)?.overall_risk,
        hubId: spoke.hub_id,
        inventoryCount: spoke.inventory_count,
      });
    }

    // Hub-to-hub mesh backbone (all hubs interconnected)
    for (let i = 0; i < hubs.length; i++) {
      for (let j = i + 1; j < hubs.length; j++) {
        links.push({
          id: `mesh-${hubs[i].id}-${hubs[j].id}`,
          source: hubs[i].id,
          target: hubs[j].id,
          kind: "hub-mesh",
        });
      }
    }

    // Supply routes (hub to spoke) — weighted by transit speed
    if (routes && routes.length > 0) {
      const hours = routes.map((r) => r.transit_hours).filter((h) => h > 0);
      const minH = Math.min(...hours, 1);
      const maxH = Math.max(...hours, 1);
      const range = maxH - minH || 1;

      for (const route of routes) {
        // Invert: low transit hours = high weight (fast = thick)
        const weight = hours.length > 1
          ? 1 - (route.transit_hours - minH) / range
          : 0.5;
        links.push({
          id: route.id,
          source: route.hub_id,
          target: route.spoke_id,
          kind: "supply-route",
          transportMode: route.transport_mode,
          distanceKm: route.distance_km,
          transitHours: route.transit_hours,
          routeStatus: route.status,
          weight,
        });
      }
    } else {
      // Fallback: spoke.hub_id edges if routes not loaded yet
      for (const spoke of spokes) {
        links.push({
          id: `fallback-${spoke.hub_id}-${spoke.id}`,
          source: spoke.hub_id,
          target: spoke.id,
          kind: "supply-route",
          weight: 0.5,
        });
      }
    }

    return { nodes, links };
  }, [hubs, spokes, routes, riskMap]);

  // ---------- Canvas rendering ----------

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const { width, height } = dimensions;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const t = transformRef.current;
    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.translate(t.x, t.y);
    ctx.scale(t.k, t.k);

    const currentNodes = nodesRef.current;
    const currentLinks = linksRef.current;
    const hovNode = hoveredRef.current;
    const hovLink = hoveredLinkRef.current;

    // Weight → line width: range 1.5px (lightest) to 6px (heaviest)
    const MIN_WIDTH = 1.5;
    const MAX_WIDTH = 6;

    // Draw links
    for (const link of currentLinks) {
      const s = link.source as GraphNode;
      const tgt = link.target as GraphNode;
      if (s.x == null || s.y == null || tgt.x == null || tgt.y == null) continue;

      const isLinkHovered = hovLink?.id === link.id;
      const isNodeHighlighted = hovNode && (s.id === hovNode.id || tgt.id === hovNode.id);

      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(tgt.x, tgt.y);

      if (link.kind === "hub-mesh") {
        ctx.setLineDash([6, 4]);
        ctx.strokeStyle = LINK_COLORS["hub-mesh"];
        ctx.lineWidth = 1.5;
      } else {
        ctx.setLineDash([]);
        const w = link.weight ?? 0.5;
        const baseWidth = MIN_WIDTH + w * (MAX_WIDTH - MIN_WIDTH);
        ctx.lineWidth = baseWidth;
        ctx.strokeStyle = link.routeStatus
          ? (ROUTE_STATUS_COLORS[link.routeStatus] || LINK_COLORS["supply-route"])
          : LINK_COLORS["supply-route"];
      }

      // Highlight links connected to hovered node or hovered link
      if (isLinkHovered) {
        ctx.strokeStyle = "#ffffffc0";
        ctx.lineWidth = (link.kind === "hub-mesh" ? 2 : MIN_WIDTH + (link.weight ?? 0.5) * (MAX_WIDTH - MIN_WIDTH)) + 2;
      } else if (isNodeHighlighted) {
        ctx.strokeStyle = "#ffffff90";
        const w = link.weight ?? 0.5;
        ctx.lineWidth = link.kind === "hub-mesh" ? 2 : MIN_WIDTH + w * (MAX_WIDTH - MIN_WIDTH) + 1;
      }

      ctx.stroke();
      ctx.setLineDash([]);

      // Transport mode + transit time label on supply routes
      if (link.kind === "supply-route" && t.k > 0.6) {
        const mx = (s.x + tgt.x) / 2;
        const my = (s.y + tgt.y) / 2;
        ctx.font = `${9 / t.k}px Inter, system-ui, sans-serif`;
        ctx.fillStyle = isLinkHovered ? "#ffffff" : "#8c8f94";
        ctx.textAlign = "center";
        const label = [link.transportMode, link.transitHours != null ? `${link.transitHours.toFixed(1)}h` : ""].filter(Boolean).join(" · ");
        if (label) ctx.fillText(label, mx, my - 4 / t.k);
      }
    }

    // Draw nodes
    for (const node of currentNodes) {
      if (node.x == null || node.y == null) continue;

      const isHub = node.type === "hub";
      const radius = isHub ? 22 : 12;
      const isHovered = hovNode?.id === node.id;
      const isSelected = selectedNode?.id === node.id;

      // Risk glow
      if (node.risk && RISK_GLOW[node.risk] && node.risk !== "healthy") {
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius + 8, 0, Math.PI * 2);
        ctx.fillStyle = RISK_GLOW[node.risk] + "30";
        ctx.fill();
      }

      // Status ring
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius + 3, 0, Math.PI * 2);
      ctx.strokeStyle = STATUS_RING[node.status] || STATUS_RING.operational;
      ctx.lineWidth = isSelected ? 3 : 2;
      ctx.stroke();

      // Node fill
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = isHovered || isSelected
        ? (isHub ? "#8b83ff" : "#60a5fa")
        : NODE_COLORS[node.type];
      ctx.fill();

      // Hub icon (hexagon interior hint)
      if (isHub) {
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const angle = (Math.PI / 3) * i - Math.PI / 2;
          const hx = node.x + Math.cos(angle) * 12;
          const hy = node.y + Math.sin(angle) * 12;
          if (i === 0) ctx.moveTo(hx, hy);
          else ctx.lineTo(hx, hy);
        }
        ctx.closePath();
        ctx.strokeStyle = "#ffffff40";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else {
        // Spoke dot
        ctx.beginPath();
        ctx.arc(node.x, node.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff60";
        ctx.fill();
      }

      // Label
      ctx.font = `${isHub ? "bold " : ""}${(isHub ? 11 : 9)}px Inter, system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.fillStyle = isHovered || isSelected ? "#ffffff" : "#c9cbcf";
      ctx.fillText(node.label, node.x, node.y + radius + 14);
    }

    ctx.restore();

    // Tooltip for hovered node or link (drawn in screen space)
    if (hovNode && hovNode.x != null && hovNode.y != null) {
      const sx = hovNode.x * t.k + t.x;
      const sy = hovNode.y * t.k + t.y;
      drawNodeTooltip(ctx, hovNode, sx, sy, width);
    } else if (hovLink && hovLink.kind === "supply-route") {
      const s = hovLink.source as GraphNode;
      const tgt = hovLink.target as GraphNode;
      if (s.x != null && s.y != null && tgt.x != null && tgt.y != null) {
        const sx = ((s.x + tgt.x) / 2) * t.k + t.x;
        const sy = ((s.y + tgt.y) / 2) * t.k + t.y;
        drawLinkTooltip(ctx, hovLink, sx, sy, width);
      }
    }
  }, [dimensions, selectedNode]);

  function drawBoxTooltip(ctx: CanvasRenderingContext2D, lines: string[], sx: number, sy: number, canvasWidth: number) {
    const lineHeight = 16;
    const padding = 10;
    const tooltipW = 190;
    const tooltipH = lines.length * lineHeight + padding * 2;

    let tx = sx + 20;
    let ty = sy - tooltipH / 2;
    if (tx + tooltipW > canvasWidth) tx = sx - tooltipW - 20;
    if (ty < 0) ty = 4;

    ctx.fillStyle = "#181b1fee";
    ctx.strokeStyle = "#2c2f35";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(tx, ty, tooltipW, tooltipH, 6);
    ctx.fill();
    ctx.stroke();

    ctx.textAlign = "left";
    lines.forEach((line, i) => {
      ctx.fillStyle = i === 0 ? "#ffffff" : "#8c8f94";
      ctx.font = i === 0 ? "bold 11px Inter, system-ui, sans-serif" : "11px Inter, system-ui, sans-serif";
      ctx.fillText(line, tx + padding, ty + padding + (i + 1) * lineHeight - 3);
    });
  }

  function drawNodeTooltip(ctx: CanvasRenderingContext2D, node: GraphNode, sx: number, sy: number, canvasWidth: number) {
    const lines: string[] = [node.label];
    lines.push(`Type: ${node.type.toUpperCase()}`);
    lines.push(`Status: ${node.status}`);
    if (node.risk) lines.push(`Risk: ${node.risk}`);
    if (node.type === "hub") {
      if (node.spokeCount != null) lines.push(`Spokes: ${node.spokeCount}`);
      if (node.capacity != null) lines.push(`Capacity: ${node.capacity.toLocaleString()}`);
    }
    if (node.inventoryCount != null) lines.push(`Inventory items: ${node.inventoryCount}`);
    drawBoxTooltip(ctx, lines, sx, sy, canvasWidth);
  }

  function drawLinkTooltip(ctx: CanvasRenderingContext2D, link: GraphLink, sx: number, sy: number, canvasWidth: number) {
    const s = link.source as GraphNode;
    const tgt = link.target as GraphNode;
    const lines: string[] = [`${s.label} → ${tgt.label}`];
    if (link.transportMode) lines.push(`Mode: ${link.transportMode}`);
    if (link.distanceKm != null) lines.push(`Distance: ${link.distanceKm.toFixed(0)} km`);
    if (link.transitHours != null) lines.push(`Transit: ${link.transitHours.toFixed(1)} hrs`);
    if (link.weight != null) lines.push(`Weight: ${(link.weight * 100).toFixed(0)}%`);
    if (link.routeStatus) lines.push(`Status: ${link.routeStatus}`);
    drawBoxTooltip(ctx, lines, sx, sy, canvasWidth);
  }

  // ---------- Force simulation ----------

  useEffect(() => {
    if (nodes.length === 0) return;

    // Preserve positions for existing nodes
    const posMap = new Map<string, { x: number; y: number }>();
    for (const n of nodesRef.current) {
      if (n.x != null && n.y != null) posMap.set(n.id, { x: n.x, y: n.y });
    }
    for (const n of nodes) {
      const prev = posMap.get(n.id);
      if (prev) { n.x = prev.x; n.y = prev.y; }
    }

    nodesRef.current = nodes;
    linksRef.current = links;

    simRef.current?.stop();

    const sim = forceSimulation<GraphNode>(nodes)
      .force("link", forceLink<GraphNode, GraphLink>(links)
        .id((d) => d.id)
        .distance((l) => l.kind === "hub-mesh" ? 250 : 120)
        .strength((l) => l.kind === "hub-mesh" ? 0.3 : 0.7),
      )
      .force("charge", forceManyBody<GraphNode>()
        .strength((d) => d.type === "hub" ? -600 : -200),
      )
      .force("center", forceCenter(dimensions.width / 2, dimensions.height / 2))
      .force("collide", forceCollide<GraphNode>()
        .radius((d) => d.type === "hub" ? 50 : 25),
      )
      .alphaDecay(0.02)
      .on("tick", draw);

    simRef.current = sim;

    return () => { sim.stop(); };
  }, [nodes, links, dimensions, draw]);

  // ---------- Resize observer ----------

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDimensions({ width, height });
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // ---------- Mouse interactions ----------

  const screenToWorld = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { wx: 0, wy: 0 };
    const rect = canvas.getBoundingClientRect();
    const t = transformRef.current;
    return {
      wx: (clientX - rect.left - t.x) / t.k,
      wy: (clientY - rect.top - t.y) / t.k,
    };
  }, []);

  const findNode = useCallback((wx: number, wy: number): GraphNode | null => {
    for (let i = nodesRef.current.length - 1; i >= 0; i--) {
      const n = nodesRef.current[i];
      if (n.x == null || n.y == null) continue;
      const r = n.type === "hub" ? 22 : 12;
      const dx = wx - n.x, dy = wy - n.y;
      if (dx * dx + dy * dy <= (r + 5) * (r + 5)) return n;
    }
    return null;
  }, []);

  const findLink = useCallback((wx: number, wy: number): GraphLink | null => {
    const HIT = 8; // px tolerance
    for (const link of linksRef.current) {
      const s = link.source as GraphNode;
      const tgt = link.target as GraphNode;
      if (s.x == null || s.y == null || tgt.x == null || tgt.y == null) continue;
      // Point-to-segment distance
      const dx = tgt.x - s.x, dy = tgt.y - s.y;
      const lenSq = dx * dx + dy * dy;
      if (lenSq === 0) continue;
      const t = Math.max(0, Math.min(1, ((wx - s.x) * dx + (wy - s.y) * dy) / lenSq));
      const px = s.x + t * dx, py = s.y + t * dy;
      const dist = Math.sqrt((wx - px) ** 2 + (wy - py) ** 2);
      if (dist <= HIT) return link;
    }
    return null;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let isPanning = false;
    let panStart = { x: 0, y: 0 };

    const onMouseDown = (e: MouseEvent) => {
      const { wx, wy } = screenToWorld(e.clientX, e.clientY);
      const node = findNode(wx, wy);
      if (node && node.x != null && node.y != null) {
        dragRef.current = { node, offsetX: wx - node.x, offsetY: wy - node.y };
        node.fx = node.x;
        node.fy = node.y;
        simRef.current?.alphaTarget(0.3).restart();
      } else {
        isPanning = true;
        panStart = { x: e.clientX - transformRef.current.x, y: e.clientY - transformRef.current.y };
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      const { wx, wy } = screenToWorld(e.clientX, e.clientY);

      if (dragRef.current.node) {
        const n = dragRef.current.node;
        n.fx = wx - dragRef.current.offsetX;
        n.fy = wy - dragRef.current.offsetY;
        return;
      }

      if (isPanning) {
        transformRef.current.x = e.clientX - panStart.x;
        transformRef.current.y = e.clientY - panStart.y;
        draw();
        return;
      }

      const node = findNode(wx, wy);
      const link = node ? null : findLink(wx, wy);
      if (node !== hoveredRef.current || link !== hoveredLinkRef.current) {
        hoveredRef.current = node;
        hoveredLinkRef.current = link;
        setHovered(node);
        canvas.style.cursor = node ? "pointer" : link ? "crosshair" : "grab";
        draw();
      }
    };

    const onMouseUp = () => {
      if (dragRef.current.node) {
        const n = dragRef.current.node;
        // Keep pinned if user explicitly dragged
        dragRef.current = { node: null, offsetX: 0, offsetY: 0 };
        simRef.current?.alphaTarget(0);
        // Release after a moment so it settles
        setTimeout(() => { n.fx = null; n.fy = null; }, 300);
      }
      isPanning = false;
    };

    const onClick = (e: MouseEvent) => {
      const { wx, wy } = screenToWorld(e.clientX, e.clientY);
      const node = findNode(wx, wy);
      setSelectedNode(node);
    };

    const onDblClick = (e: MouseEvent) => {
      const { wx, wy } = screenToWorld(e.clientX, e.clientY);
      const node = findNode(wx, wy);
      if (node) {
        const prefix = node.type === "hub" ? "hubs" : "spokes";
        navigate(`/${prefix}/${node.id}`);
      }
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const t = transformRef.current;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const zoom = e.deltaY < 0 ? 1.1 : 0.9;
      const newK = Math.min(4, Math.max(0.5, t.k * zoom));

      t.x = mx - (mx - t.x) * (newK / t.k);
      t.y = my - (my - t.y) * (newK / t.k);
      t.k = newK;
      draw();
    };

    canvas.addEventListener("mousedown", onMouseDown);
    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("mouseup", onMouseUp);
    canvas.addEventListener("mouseleave", onMouseUp);
    canvas.addEventListener("click", onClick);
    canvas.addEventListener("dblclick", onDblClick);
    canvas.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      canvas.removeEventListener("mousedown", onMouseDown);
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("mouseup", onMouseUp);
      canvas.removeEventListener("mouseleave", onMouseUp);
      canvas.removeEventListener("click", onClick);
      canvas.removeEventListener("dblclick", onDblClick);
      canvas.removeEventListener("wheel", onWheel);
    };
  }, [screenToWorld, findNode, findLink, draw, navigate]);

  // ---------- Legend & side panel ----------

  const connectedSpokes = useMemo(() => {
    if (!selectedNode || !spokes) return [];
    if (selectedNode.type === "hub") {
      return spokes.filter((s) => s.hub_id === selectedNode.id);
    }
    return [];
  }, [selectedNode, spokes]);

  const connectedHub = useMemo(() => {
    if (!selectedNode || !hubs) return null;
    if (selectedNode.type === "spoke") {
      return hubs.find((h) => h.id === selectedNode.hubId) || null;
    }
    return null;
  }, [selectedNode, hubs]);

  const connectedRoutes = useMemo(() => {
    if (!selectedNode || !routes) return [];
    return routes.filter((r) => r.hub_id === selectedNode.id || r.spoke_id === selectedNode.id);
  }, [selectedNode, routes]);

  return (
    <div className="flex gap-4 h-[calc(100vh-6rem)]">
      {/* Canvas area */}
      <div className="flex-1 flex flex-col gap-4 min-w-0">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text">Network Topology</h2>
          <div className="flex items-center gap-4 text-xs text-text-secondary">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full" style={{ background: NODE_COLORS.hub }} /> Hub
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full" style={{ background: NODE_COLORS.spoke }} /> Spoke
            </span>
            <span className="flex items-center gap-1.5">
              <span className="flex flex-col items-center justify-center w-6 h-4">
                <span className="w-full" style={{ borderTop: "5px solid #3b82f6" }} />
                <span className="w-full mt-[3px]" style={{ borderTop: "1px solid #3b82f6" }} />
              </span>
              Route Weight
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-6 border-t-2 border-dashed" style={{ borderColor: "#6c63ff" }} /> Hub Mesh
            </span>
          </div>
        </div>
        <div ref={containerRef} className="flex-1 bg-canvas border border-border rounded-md overflow-hidden relative">
          <canvas ref={canvasRef} className="cursor-grab" />
          <div className="absolute bottom-3 left-3 text-[10px] text-text-disabled">
            Scroll to zoom / Drag to pan / Click node to inspect / Double-click to navigate
          </div>
        </div>
      </div>

      {/* Detail sidebar */}
      <div className="w-72 shrink-0 space-y-4 overflow-y-auto">
        {selectedNode ? (
          <>
            <Panel title={selectedNode.type === "hub" ? "Hub Details" : "Spoke Details"}>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-text-secondary">Name</span>
                  <span className="text-text font-medium">{selectedNode.label}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Status</span>
                  <StatusBadge status={selectedNode.status as "operational" | "degraded" | "offline"} />
                </div>
                {selectedNode.risk && (
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Risk</span>
                    <StatusBadge status={selectedNode.risk as "healthy" | "warning" | "critical"} />
                  </div>
                )}
                {selectedNode.capacity != null && (
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Capacity</span>
                    <span className="text-text">{selectedNode.capacity.toLocaleString()}</span>
                  </div>
                )}
                {selectedNode.inventoryCount != null && (
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Inventory items</span>
                    <span className="text-text">{selectedNode.inventoryCount}</span>
                  </div>
                )}
                <button
                  onClick={() => {
                    const prefix = selectedNode.type === "hub" ? "hubs" : "spokes";
                    navigate(`/${prefix}/${selectedNode.id}`);
                  }}
                  className="w-full mt-2 px-3 py-1.5 text-xs bg-primary/20 text-primary rounded hover:bg-primary/30 transition-colors"
                >
                  View full details
                </button>
              </div>
            </Panel>

            {connectedRoutes.length > 0 && (
              <Panel title="Supply Routes">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-text-secondary text-left">
                      <th className="pb-1 font-medium">Mode</th>
                      <th className="pb-1 font-medium">Dist</th>
                      <th className="pb-1 font-medium">Transit</th>
                      <th className="pb-1 font-medium text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {connectedRoutes.map((r) => (
                      <tr key={r.id} className="border-t border-border/50">
                        <td className="py-1.5 text-text">{r.transport_mode}</td>
                        <td className="py-1.5 text-text">{r.distance_km.toFixed(0)} km</td>
                        <td className="py-1.5 text-text">{r.transit_hours.toFixed(1)}h</td>
                        <td className="py-1.5 text-right"><StatusBadge status={r.status as "available" | "degraded" | "denied"} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Panel>
            )}

            {connectedSpokes.length > 0 && (
              <Panel title={`Connected Spokes (${connectedSpokes.length})`}>
                <div className="divide-y divide-border/50">
                  {connectedSpokes.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => navigate(`/spokes/${s.id}`)}
                      className="w-full flex items-center justify-between py-1.5 text-xs hover:bg-hover transition-colors"
                    >
                      <span className="text-text">{s.name}</span>
                      <StatusBadge status={s.status as "operational" | "degraded" | "offline"} />
                    </button>
                  ))}
                </div>
              </Panel>
            )}

            {connectedHub && (
              <Panel title="Parent Hub">
                <button
                  onClick={() => navigate(`/hubs/${connectedHub.id}`)}
                  className="w-full flex items-center justify-between py-1.5 text-xs hover:bg-hover transition-colors"
                >
                  <span className="text-text">{connectedHub.name}</span>
                  <StatusBadge status={connectedHub.status as "operational" | "degraded" | "offline"} />
                </button>
              </Panel>
            )}
          </>
        ) : (
          <Panel title="Network Summary">
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-text-secondary">Hubs</span>
                <span className="text-text font-mono">{hubs?.length || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Spokes</span>
                <span className="text-text font-mono">{spokes?.length || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Supply Routes</span>
                <span className="text-text font-mono">{routes?.length || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Hub Mesh Links</span>
                <span className="text-text font-mono">
                  {hubs ? (hubs.length * (hubs.length - 1)) / 2 : 0}
                </span>
              </div>
              <hr className="border-border" />
              <p className="text-xs text-text-disabled">
                Click a node to inspect. Double-click to navigate to its detail page.
              </p>
            </div>
          </Panel>
        )}
      </div>
    </div>
  );
}
