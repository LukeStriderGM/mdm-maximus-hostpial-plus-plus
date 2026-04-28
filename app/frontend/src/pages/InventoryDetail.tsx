import { useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQuery, useQueries } from "@tanstack/react-query";
import {
  ChevronLeft,
  ArrowUp,
  ArrowDown,
  Snowflake,
  MapPin,
} from "lucide-react";
import {
  getInventory,
  getInventoryEvents,
  getDaysOfSupply,
  getHubs,
  getSpokes,
  type InventoryItem,
  type InventoryEvent,
  type DaysOfSupply,
  type Hub,
  type Spoke,
} from "../lib/api";
import { Panel } from "../components/ui/Panel";
import { StatCard } from "../components/ui/StatCard";
import { StatusBadge } from "../components/ui/StatusBadge";
import { DataTable, type Column } from "../components/ui/DataTable";
import { TimeSeriesChart } from "../components/ui/TimeSeriesChart";
import { Spinner } from "../components/ui/Spinner";

function riskLevel(qty: number, threshold: number): "critical" | "warning" | "healthy" {
  if (qty < threshold * 0.3) return "critical";
  if (qty < threshold) return "warning";
  return "healthy";
}

function riskToStatus(risk: string): "error" | "warning" | "success" {
  if (risk === "critical") return "error";
  if (risk === "warning") return "warning";
  return "success";
}

interface LocationRow {
  node_id: string;
  node_name: string;
  node_type: string;
  quantity_on_hand: number;
  reorder_threshold: number;
  risk: "critical" | "warning" | "healthy";
  days_remaining: number | null;
  expiration_date: string | null;
}

interface EnrichedEvent extends InventoryEvent {
  node_name: string;
}

export function InventoryDetail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const noun = searchParams.get("noun") || "";
  const type = searchParams.get("type") || "";
  const mfr = searchParams.get("mfr") || "";
  const catalog = searchParams.get("catalog") || "";

  // 1. Fetch all inventory items matching this product identity
  const { data: items, isLoading } = useQuery({
    queryKey: ["inv-product", noun, type, mfr, catalog],
    queryFn: () => {
      const params: Record<string, string> = {
        product_noun: noun,
        product_type: type,
        limit: "1000",
      };
      return getInventory(params);
    },
    enabled: !!noun && !!type,
    select: (allItems) =>
      allItems.filter((i) => {
        // Further filter by manufacturer + catalog on the client side
        // since the backend doesn't support those as filter params
        if (mfr && i.manufacturer !== mfr) return false;
        if (catalog && i.catalog_number !== catalog) return false;
        return true;
      }),
  });

  // 2. Get hubs + spokes for name resolution
  const { data: hubs } = useQuery({ queryKey: ["hubs"], queryFn: getHubs });
  const { data: spokes } = useQuery({ queryKey: ["spokes"], queryFn: () => getSpokes() });

  const nodeMap = useMemo(() => {
    const map = new Map<string, { name: string; type: string; status: string }>();
    hubs?.forEach((h: Hub) => map.set(h.id, { name: h.name, type: "hub", status: h.status }));
    spokes?.forEach((s: Spoke) => map.set(s.id, { name: s.name, type: "spoke", status: s.status }));
    return map;
  }, [hubs, spokes]);

  // 3. Fetch events for each unique node that has this product
  const uniqueNodeIds = useMemo(() => {
    if (!items) return [];
    return [...new Set(items.map((i) => i.node_id))];
  }, [items]);

  const eventQueries = useQueries({
    queries: uniqueNodeIds.map((nodeId) => ({
      queryKey: ["events", nodeId],
      queryFn: () => getInventoryEvents(nodeId),
      enabled: uniqueNodeIds.length > 0,
      select: (evts: InventoryEvent[]) => evts.filter((e) => e.product_type === type),
    })),
  });

  // 4. Fetch days-of-supply for each node
  const dosQueries = useQueries({
    queries: uniqueNodeIds.map((nodeId) => ({
      queryKey: ["dos", nodeId],
      queryFn: () => getDaysOfSupply(nodeId),
      enabled: uniqueNodeIds.length > 0,
      select: (arr: DaysOfSupply[]) => arr.find((d) => d.product_type === type),
    })),
  });

  // Aggregate stats
  const totalQty = items?.reduce((a, i) => a + i.quantity_on_hand, 0) || 0;
  const totalReorder = items?.reduce((a, i) => a + i.reorder_threshold, 0) || 0;
  const fillRate = totalReorder > 0 ? Math.round((totalQty / totalReorder) * 100) : 100;
  const overallRisk = riskLevel(totalQty, totalReorder);
  const coldChain = items?.some((i) => i.cold_chain_required) || false;
  const firstItem = items?.[0];

  // Merge all events across nodes for the timeline
  const allEvents = useMemo(() => {
    const merged: EnrichedEvent[] = [];
    eventQueries.forEach((q, idx) => {
      if (!q.data) return;
      const nodeId = uniqueNodeIds[idx];
      const nodeName = nodeMap.get(nodeId)?.name ?? nodeId.slice(0, 8);
      for (const e of q.data) {
        merged.push({ ...e, node_name: nodeName });
      }
    });
    return merged.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }, [eventQueries, uniqueNodeIds, nodeMap]);

  // Aggregate quantity timeline across all locations
  const quantityTimeline = useMemo(() => {
    if (!items || allEvents.length === 0) return [];

    // Group events by day
    const dayMap = new Map<string, { restocked: number; consumed: number }>();
    for (const e of allEvents) {
      const day = e.timestamp.split("T")[0];
      const entry = dayMap.get(day) || { restocked: 0, consumed: 0 };
      if (e.event_type === "restock") entry.restocked += e.quantity_delta;
      else entry.consumed += Math.abs(e.quantity_delta);
      dayMap.set(day, entry);
    }

    // Build cumulative timeline walking backwards from current total
    const days = [...dayMap.entries()].sort(([a], [b]) => a.localeCompare(b));
    let totalDelta = 0;
    for (const [, v] of days) {
      totalDelta += v.restocked - v.consumed;
    }
    const startingQty = totalQty - totalDelta;

    let running = startingQty;
    const points: { timestamp: string; quantity: number; reorder: number }[] = [];
    for (const [day, v] of days) {
      running += v.restocked - v.consumed;
      points.push({ timestamp: day, quantity: running, reorder: totalReorder });
    }

    // Add current point
    points.push({
      timestamp: new Date().toISOString().split("T")[0],
      quantity: totalQty,
      reorder: totalReorder,
    });

    return points;
  }, [allEvents, items, totalQty, totalReorder]);

  // Location rows
  const locationRows: LocationRow[] = useMemo(() => {
    if (!items) return [];
    // Group items by node
    const byNode = new Map<string, InventoryItem[]>();
    for (const item of items) {
      const arr = byNode.get(item.node_id) || [];
      arr.push(item);
      byNode.set(item.node_id, arr);
    }

    return [...byNode.entries()].map(([nodeId, nodeItems]) => {
      const qty = nodeItems.reduce((a, i) => a + i.quantity_on_hand, 0);
      const reorder = nodeItems.reduce((a, i) => a + i.reorder_threshold, 0);
      const node = nodeMap.get(nodeId);
      const dosResult = dosQueries[uniqueNodeIds.indexOf(nodeId)]?.data;
      return {
        node_id: nodeId,
        node_name: node?.name ?? nodeId.slice(0, 8),
        node_type: node?.type ?? nodeItems[0].node_type,
        quantity_on_hand: qty,
        reorder_threshold: reorder,
        risk: riskLevel(qty, reorder),
        days_remaining: dosResult?.days_remaining ?? null,
        expiration_date: nodeItems[0].expiration_date ?? null,
      };
    }).sort((a, b) => a.quantity_on_hand - b.quantity_on_hand); // lowest stock first
  }, [items, nodeMap, dosQueries, uniqueNodeIds]);

  // Event columns for the event log
  const eventColumns: Column<EnrichedEvent>[] = [
    {
      key: "timestamp",
      header: "Time",
      render: (r) => {
        const d = new Date(r.timestamp);
        return (
          <span className="text-xs font-mono text-text-secondary">
            {d.toLocaleDateString()} {d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        );
      },
    },
    {
      key: "node_name",
      header: "Location",
      render: (r) => (
        <button
          onClick={() => navigate(`/${r.node_type === "hub" ? "hubs" : "spokes"}/${r.node_id}`)}
          className="text-primary hover:text-primary/80 hover:underline text-left text-xs"
        >
          {r.node_name}
        </button>
      ),
    },
    {
      key: "event_type",
      header: "Event",
      render: (r) => (
        <span className={`inline-flex items-center gap-1 text-xs font-medium ${
          r.event_type === "restock" ? "text-success-text" : "text-error-text"
        }`}>
          {r.event_type === "restock" ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
          {r.event_type}
        </span>
      ),
    },
    {
      key: "quantity_delta",
      header: "Delta",
      render: (r) => (
        <span className={`font-mono font-medium ${r.quantity_delta > 0 ? "text-success-text" : "text-error-text"}`}>
          {r.quantity_delta > 0 ? "+" : ""}{r.quantity_delta.toLocaleString()}
        </span>
      ),
    },
  ];

  // Location table columns
  const locationColumns: Column<LocationRow>[] = [
    {
      key: "node_name",
      header: "Location",
      render: (r) => (
        <button
          onClick={() => navigate(`/${r.node_type === "hub" ? "hubs" : "spokes"}/${r.node_id}`)}
          className="text-primary hover:text-primary/80 hover:underline text-left"
        >
          {r.node_name}
        </button>
      ),
    },
    {
      key: "node_type",
      header: "Type",
      render: (r) => (
        <span className={`text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded ${
          r.node_type === "hub" ? "bg-primary/20 text-primary-text" : "bg-elevated text-text-secondary"
        }`}>
          {r.node_type}
        </span>
      ),
    },
    {
      key: "quantity_on_hand",
      header: "Qty on Hand",
      render: (r) => (
        <span className={`font-mono font-medium ${
          r.risk === "critical" ? "text-error-text" : r.risk === "warning" ? "text-warning-text" : "text-success-text"
        }`}>
          {r.quantity_on_hand.toLocaleString()}
        </span>
      ),
    },
    {
      key: "reorder_threshold",
      header: "Reorder At",
      render: (r) => <span className="font-mono">{r.reorder_threshold.toLocaleString()}</span>,
    },
    {
      key: "days_remaining",
      header: "Days of Supply",
      render: (r) => r.days_remaining !== null
        ? <span className="font-mono">{Math.round(r.days_remaining)}d</span>
        : <span className="text-text-disabled">--</span>,
    },
    {
      key: "risk",
      header: "Status",
      render: (r) => <StatusBadge status={r.risk} />,
    },
  ];

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size={32} /></div>;
  if (!items || items.length === 0) {
    return (
      <div className="space-y-4">
        <button onClick={() => navigate("/inventory")} className="flex items-center gap-1 text-sm text-text-secondary hover:text-text">
          <ChevronLeft size={16} /> Back to Inventory
        </button>
        <p className="text-text-secondary py-10 text-center">Product not found</p>
      </div>
    );
  }

  const reversedEvents = [...allEvents].reverse();

  return (
    <div className="space-y-4">
      {/* Back nav */}
      <button
        onClick={() => navigate("/inventory")}
        className="flex items-center gap-1 text-sm text-text-secondary hover:text-text transition-colors"
      >
        <ChevronLeft size={16} /> Back to Inventory
      </button>

      {/* Hero card */}
      <div className="bg-card border border-border rounded-md p-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-text">{noun}</h1>
              <StatusBadge status={overallRisk} />
              {coldChain && (
                <span className="inline-flex items-center gap-1 text-xs text-primary-text bg-primary/15 px-2 py-0.5 rounded">
                  <Snowflake size={12} /> Cold Chain
                </span>
              )}
            </div>
            <p className="text-sm text-text-secondary">
              {[type, mfr, catalog].filter(Boolean).join(" · ")}
            </p>
            {firstItem?.item_description && (
              <p className="text-xs text-text-disabled mt-1">{firstItem.item_description}</p>
            )}
          </div>

          <div className="flex items-center gap-2 text-sm text-text-secondary">
            <MapPin size={14} />
            <span>{uniqueNodeIds.length} {uniqueNodeIds.length === 1 ? "location" : "locations"}</span>
          </div>
        </div>

        {/* Big quantity number */}
        <div className="mt-6 flex items-end gap-4">
          <span className="text-5xl font-mono font-bold text-text">
            {totalQty.toLocaleString()}
          </span>
          <span className="text-lg text-text-disabled mb-1">total units</span>
          {allEvents.length > 0 && (() => {
            const last = allEvents[allEvents.length - 1];
            return (
              <div className={`flex items-center gap-1 mb-1 text-sm font-medium ${
                last.quantity_delta > 0 ? "text-success-text" : "text-error-text"
              }`}>
                {last.quantity_delta > 0 ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
                <span>{last.quantity_delta > 0 ? "+" : ""}{last.quantity_delta.toLocaleString()}</span>
                <span className="text-text-disabled text-xs ml-1">last event</span>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Key stats */}
      <div className="grid grid-cols-6 gap-3">
        <StatCard
          label="Total on Hand"
          value={totalQty.toLocaleString()}
          status={riskToStatus(overallRisk)}
        />
        <StatCard
          label="Total Reorder Level"
          value={totalReorder.toLocaleString()}
          status="default"
        />
        <StatCard
          label="Locations"
          value={uniqueNodeIds.length}
          status="default"
        />
        <StatCard
          label="Fill Rate"
          value={`${fillRate}%`}
          status={fillRate >= 80 ? "success" : fillRate >= 40 ? "warning" : "error"}
        />
        <StatCard
          label="Critical Locations"
          value={locationRows.filter((r) => r.risk === "critical").length}
          status={locationRows.some((r) => r.risk === "critical") ? "error" : "success"}
        />
        <StatCard
          label="Cold Chain"
          value={coldChain ? "Required" : "No"}
          status={coldChain ? "warning" : "default"}
        />
      </div>

      {/* Quantity timeline */}
      <Panel
        title="Quantity History (All Locations)"
        actions={
          <div className="flex items-center gap-3 text-[10px]">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary inline-block" /> Total Qty</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-warning inline-block" /> Reorder Level</span>
          </div>
        }
      >
        {quantityTimeline.length > 1 ? (
          <TimeSeriesChart
            data={quantityTimeline}
            series={[
              { key: "quantity", color: "#6e9fff", label: "Total Qty" },
              { key: "reorder", color: "#ff9900", label: "Reorder Level" },
            ]}
            height={300}
          />
        ) : (
          <p className="text-text-disabled text-sm py-8 text-center">
            No event history available for this product.
          </p>
        )}
      </Panel>

      {/* Locations table */}
      <Panel
        title="Locations"
        actions={
          <span className="text-xs text-text-secondary">
            {locationRows.length} {locationRows.length === 1 ? "location" : "locations"} · sorted by lowest stock
          </span>
        }
      >
        <DataTable
          columns={locationColumns}
          data={locationRows}
          pageSize={15}
          searchable={false}
        />
      </Panel>

      {/* Event history */}
      <Panel
        title="Event History (All Locations)"
        actions={
          <span className="text-xs text-text-secondary">
            {allEvents.length} events
          </span>
        }
      >
        <DataTable
          columns={eventColumns}
          data={reversedEvents}
          pageSize={15}
        />
      </Panel>
    </div>
  );
}
