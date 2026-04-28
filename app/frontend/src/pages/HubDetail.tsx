import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getHub, getInventory, getSpokes, getInventoryEvents, getDaysOfSupply,
  getHubDemand, getHubInventorySummary, getHubStockoutRisk, getHubCapacity,
} from "../lib/api";
import { Panel } from "../components/ui/Panel";
import { StatCard } from "../components/ui/StatCard";
import { StatusBadge } from "../components/ui/StatusBadge";
import { DataTable, type Column } from "../components/ui/DataTable";
import { TimeSeriesChart } from "../components/ui/TimeSeriesChart";
import { GaugeChart } from "../components/ui/GaugeChart";
import { BarChart } from "../components/ui/BarChart";
import { NodeCard } from "../components/ui/NodeCard";
import { Spinner } from "../components/ui/Spinner";
import { InventoryFormModal } from "../components/ui/InventoryFormModal";
import { Pencil, Plus } from "lucide-react";
import type { InventoryItem, Spoke, DemandSignal } from "../lib/api";

const baseInvColumns: Column<InventoryItem>[] = [
  { key: "product_type", header: "Type" },
  { key: "product_noun", header: "Category" },
  { key: "item_description", header: "Description" },
  { key: "manufacturer", header: "Manufacturer" },
  { key: "quantity_on_hand", header: "Qty" },
  { key: "reorder_threshold", header: "Reorder At" },
  { key: "cold_chain_required", header: "Cold Chain", render: (r) => r.cold_chain_required ? "Yes" : "No" },
];

const demandColumns: Column<DemandSignal>[] = [
  { key: "spoke_id", header: "Spoke" },
  { key: "product_type", header: "Product Type" },
  { key: "quantity_needed", header: "Qty Needed" },
  { key: "priority", header: "Priority" },
  { key: "created_at", header: "Requested", render: (r) => new Date(r.created_at).toLocaleDateString() },
];

export function HubDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<InventoryItem | undefined>();

  const openCreate = () => { setEditItem(undefined); setModalOpen(true); };
  const openEdit = (item: InventoryItem) => { setEditItem(item); setModalOpen(true); };
  const onMutationSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["inventory", id] });
    queryClient.invalidateQueries({ queryKey: ["hub-inv-summary", id] });
    queryClient.invalidateQueries({ queryKey: ["events", id] });
  };

  const invColumns: Column<InventoryItem>[] = [
    ...baseInvColumns,
    {
      key: "_actions",
      header: "",
      sortable: false,
      render: (row) => (
        <button
          onClick={(e) => { e.stopPropagation(); openEdit(row); }}
          className="p-1 rounded hover:bg-hover text-text-secondary hover:text-text"
          title="Edit item"
        >
          <Pencil size={14} />
        </button>
      ),
    },
  ];

  const qEnabled = !!id;
  const { data: hub, isLoading } = useQuery({ queryKey: ["hub", id], queryFn: () => getHub(id!), enabled: qEnabled });
  const { data: inventory } = useQuery({ queryKey: ["inventory", id], queryFn: () => getInventory({ node_id: id!, limit: "500" }), enabled: qEnabled });
  const { data: connectedSpokes } = useQuery({ queryKey: ["spokes", id], queryFn: () => getSpokes(id!), enabled: qEnabled });
  const { data: events } = useQuery({ queryKey: ["events", id], queryFn: () => getInventoryEvents(id!), enabled: qEnabled });
  const { data: dos } = useQuery({ queryKey: ["dos", id], queryFn: () => getDaysOfSupply(id!), enabled: qEnabled });
  const { data: hubDemand } = useQuery({ queryKey: ["hub-demand", id], queryFn: () => getHubDemand(id!), enabled: qEnabled });
  const { data: hubInvSummary } = useQuery({ queryKey: ["hub-inv-summary", id], queryFn: () => getHubInventorySummary(id!), enabled: qEnabled });
  const { data: hubRisk } = useQuery({ queryKey: ["hub-risk", id], queryFn: () => getHubStockoutRisk(id!), enabled: qEnabled });
  const { data: hubCapacity } = useQuery({ queryKey: ["hub-capacity", id], queryFn: () => getHubCapacity(id!), enabled: qEnabled });

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size={32} /></div>;
  if (!hub) return <p className="text-text-secondary">Hub not found</p>;

  // Build spoke name lookup for demand table
  const spokeNames: Record<string, string> = {};
  connectedSpokes?.forEach((s: Spoke) => { spokeNames[s.id] = s.name; });

  // Build stockout risk lookup per node
  const riskByNode: Record<string, { critical: number; overall: string }> = {};
  (hubRisk?.nodes || []).forEach((n) => {
    riskByNode[n.node_id] = { critical: n.critical_items, overall: n.overall_risk };
  });

  // Demand signals with spoke name resolved
  const demandColumnsResolved: Column<DemandSignal>[] = [
    { key: "spoke_id", header: "Spoke", render: (r) => spokeNames[r.spoke_id] || String(r.spoke_id || "").slice(0, 8) },
    ...demandColumns.slice(1),
  ];

  // Demand by product type for bar chart
  const demandByType: Record<string, number> = {};
  (hubDemand?.signals || []).forEach((s) => {
    demandByType[s.product_type] = (demandByType[s.product_type] || 0) + s.quantity_needed;
  });
  const demandChartData = Object.entries(demandByType).map(([pt, qty]) => ({
    product_type: pt.slice(0, 18),
    "Qty Demanded": qty,
  }));

  // Network inventory by product type for bar chart
  const invChartData = hubInvSummary?.by_product_type.map((pt) => ({
    product_type: pt.product_type.slice(0, 18),
    "On Hand": pt.total_quantity,
  })) || [];

  // Time-series from events
  const tsData = events?.reduce((acc, e) => {
    const day = e.timestamp.split("T")[0];
    const existing = acc.find((a) => a.timestamp === day);
    if (existing) { existing[e.product_type] = (existing[e.product_type] as number || 0) + e.quantity_delta; }
    else { acc.push({ timestamp: day, [e.product_type]: e.quantity_delta }); }
    return acc;
  }, [] as Record<string, unknown>[]) || [];

  const seriesKeys = [...new Set(events?.map((e) => e.product_type) || [])];
  const colors = ["#6e9fff", "#6ccf8e", "#fbad37", "#ff5286", "#D4A0FF"];

  const riskStatus = (risk: string) =>
    risk === "critical" ? "error" : risk === "warning" ? "warning" : "success";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">{hub.name}</h2>
          <StatusBadge status={hub.status as "operational"} />
        </div>
        {hubCapacity && (
          <div className="flex items-center gap-4">
            <GaugeChart
              value={hubCapacity.utilization_pct}
              label="Capacity"
              maxLabel={`${hubCapacity.utilization_pct}%`}
            />
          </div>
        )}
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-6 gap-3">
        <StatCard label="Network Items" value={hubInvSummary?.total_items || 0} />
        <StatCard label="Connected Spokes" value={(connectedSpokes || []).length || 0} />
        <StatCard label="Total Demand" value={hubDemand?.total_quantity_needed || 0} />
        <StatCard label="Active Requests" value={hubDemand?.total_signals || 0}
          status={hubDemand && hubDemand.total_signals > 0 ? "warning" : "default"} />
        <StatCard label="Critical Items"
          value={(hubRisk?.nodes || []).reduce((s, n) => s + n.critical_items, 0) || 0}
          status={(hubRisk?.nodes || []).some((n) => n.critical_items > 0) ? "error" : "success"} />
        <StatCard label="Network Risk" value={hubRisk?.overall_risk || "healthy"}
          status={riskStatus(hubRisk?.overall_risk || "healthy")} />
      </div>

      {/* Connected Spokes with health */}
      <Panel title={`Connected Spokes (${(connectedSpokes || []).length || 0})`}>
        <div className="grid grid-cols-4 gap-3">
          {(connectedSpokes || []).map((s: Spoke) => (
            <NodeCard
              key={s.id}
              name={s.name}
              type="spoke"
              status={s.status as "operational"}
              itemCount={s.inventory_count}
              criticalCount={riskByNode[s.id]?.critical}
              onClick={() => navigate(`/spokes/${s.id}`)}
            />
          ))}
        </div>
      </Panel>

      {/* Days of Supply + Demand by Product Type */}
      <div className="grid grid-cols-2 gap-4">
        <Panel title="Days of Supply">
          {dos && dos.length > 0 ? (
            <div className="flex flex-wrap gap-6 justify-center">
              {dos.slice(0, 8).map((d) => (
                <GaugeChart
                  key={d.product_type}
                  value={Math.min(d.days_remaining / 30 * 100, 100)}
                  label={d.product_type.slice(0, 20)}
                  maxLabel={`${Math.round(d.days_remaining)}d`}
                />
              ))}
            </div>
          ) : (
            <p className="text-text-disabled text-sm">No supply data yet</p>
          )}
        </Panel>

        <Panel title="Demand by Product Type">
          {demandChartData.length > 0 ? (
            <BarChart
              data={demandChartData}
              xKey="product_type"
              bars={[{ key: "Qty Demanded", color: "#ff5286", label: "Qty Demanded" }]}
            />
          ) : (
            <p className="text-text-disabled text-sm">No demand signals yet</p>
          )}
        </Panel>
      </div>

      {/* Network Inventory by Product Type */}
      {invChartData.length > 0 && (
        <Panel title="Network Inventory by Product Type">
          <BarChart
            data={invChartData}
            xKey="product_type"
            bars={[{ key: "On Hand", color: "#6ccf8e", label: "On Hand" }]}
          />
        </Panel>
      )}

      {/* Spoke Demand Signals Table */}
      <Panel title={`Spoke Demand Signals (${hubDemand?.total_signals || 0})`}>
        {hubDemand && hubDemand.signals.length > 0 ? (
          <DataTable columns={demandColumnsResolved} data={hubDemand.signals} pageSize={10} />
        ) : (
          <p className="text-text-disabled text-sm">No demand signals from spokes</p>
        )}
      </Panel>

      {/* Hub Inventory */}
      <Panel
        title="Hub Inventory"
        actions={
          <button onClick={openCreate} className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-primary text-white hover:bg-primary/90">
            <Plus size={14} /> Add Item
          </button>
        }
      >
        {inventory && <DataTable columns={invColumns} data={inventory} pageSize={20} />}
      </Panel>

      {/* Inventory Trends */}
      <Panel title="Inventory Trends">
        {tsData.length > 0 ? (
          <TimeSeriesChart
            data={tsData}
            series={seriesKeys.slice(0, 5).map((k, i) => ({ key: k, color: colors[i % colors.length], label: k }))}
          />
        ) : (
          <p className="text-text-disabled text-sm">No event data yet</p>
        )}
      </Panel>

      <InventoryFormModal
        item={editItem}
        nodeId={id!}
        nodeType="hub"
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={onMutationSuccess}
      />
    </div>
  );
}
