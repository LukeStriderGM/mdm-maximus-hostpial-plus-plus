import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getSpoke,
  getInventory,
  getInventoryEvents,
  getDaysOfSupply,
  getDemandGap,
  getDemandSignals,
  postEBMPredict,
  postEBMWaterfall,
  type EBMRecordInput,
  type EBMPrediction,
  type WaterfallResult,
} from "../lib/api";
import { Panel } from "../components/ui/Panel";
import { StatCard } from "../components/ui/StatCard";
import { StatusBadge } from "../components/ui/StatusBadge";
import { DataTable, type Column } from "../components/ui/DataTable";
import { TimeSeriesChart } from "../components/ui/TimeSeriesChart";
import { GaugeChart } from "../components/ui/GaugeChart";
import { BarChart } from "../components/ui/BarChart";
import { Spinner } from "../components/ui/Spinner";
import { InventoryFormModal } from "../components/ui/InventoryFormModal";
import { Pencil, Plus } from "lucide-react";
import type { InventoryItem, DemandSupplyGap } from "../lib/api";

const baseInvColumns: Column<InventoryItem>[] = [
  { key: "product_type", header: "Type" },
  { key: "product_noun", header: "Category" },
  { key: "manufacturer", header: "Manufacturer" },
  { key: "quantity_on_hand", header: "Qty" },
  { key: "reorder_threshold", header: "Reorder At" },
];

const gapColumns: Column<DemandSupplyGap>[] = [
  { key: "product_type", header: "Product Type" },
  { key: "quantity_on_hand", header: "On Hand" },
  { key: "quantity_demanded", header: "Demanded" },
  { key: "gap", header: "Gap" },
  { key: "gap_percentage", header: "Gap %" },
];

export function SpokeDetail() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<InventoryItem | undefined>();

  const openCreate = () => { setEditItem(undefined); setModalOpen(true); };
  const openEdit = (item: InventoryItem) => { setEditItem(item); setModalOpen(true); };
  const onMutationSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["inventory", id] });
    queryClient.invalidateQueries({ queryKey: ["dos", id] });
    queryClient.invalidateQueries({ queryKey: ["gaps", id] });
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

  const { data: spoke, isLoading } = useQuery({ queryKey: ["spoke", id], queryFn: () => getSpoke(id!) });
  const { data: inventory } = useQuery({ queryKey: ["inventory", id], queryFn: () => getInventory({ node_id: id!, limit: "500" }) });
  const { data: events } = useQuery({ queryKey: ["events", id], queryFn: () => getInventoryEvents(id!) });
  const { data: dos } = useQuery({ queryKey: ["dos", id], queryFn: () => getDaysOfSupply(id!) });
  const { data: gaps } = useQuery({ queryKey: ["gaps", id], queryFn: () => getDemandGap(id!) });
  const { data: demands } = useQuery({ queryKey: ["demands", id], queryFn: () => getDemandSignals(id!) });

  const mlRecord = useMemo<EBMRecordInput | null>(() => {
    if (!inventory || !spoke || !id) return null;
    const totalQty = inventory.reduce((sum, item) => sum + item.quantity_on_hand, 0);
    const demandRate = Math.max(
      demands?.reduce((sum, d) => sum + d.quantity_needed, 0) || totalQty / 30 || 1,
      0.5
    );
    return {
      node_id: id,
      node_name: spoke.name,
      inventory_units: totalQty,
      demand_rate: demandRate,
      expiry_hours_remaining: 720,
      temperature_excursion_flag: 0,
      transport_delay_hours: 4,
      route_reliability_score: 0.85,
      casualty_rate: 1,
      cold_chain_health_score: 0.9,
      backup_supply_available: 1,
    };
  }, [inventory, spoke, id, demands]);

  const { data: mlPrediction } = useQuery({
    queryKey: ["ml-predict", id, mlRecord?.inventory_units, mlRecord?.demand_rate],
    enabled: !!mlRecord,
    queryFn: async () => {
      const rows = await postEBMPredict([mlRecord as EBMRecordInput]);
      return rows[0] as EBMPrediction;
    },
  });

  const { data: mlWaterfall } = useQuery({
    queryKey: ["ml-waterfall", id, mlRecord?.inventory_units, mlRecord?.demand_rate],
    enabled: !!mlRecord,
    queryFn: async () => postEBMWaterfall([mlRecord as EBMRecordInput], 0, 3) as Promise<WaterfallResult>,
  });

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size={32} /></div>;
  if (!spoke) return <p className="text-text-secondary">Spoke not found</p>;

  // Burn rate from events
  const burnData = events?.filter((e) => e.event_type === "consume")
    .reduce((acc, e) => {
      const day = e.timestamp.split("T")[0];
      const existing = acc.find((a) => a.timestamp === day);
      if (existing) existing.consumed = (existing.consumed as number) + Math.abs(e.quantity_delta);
      else acc.push({ timestamp: day, consumed: Math.abs(e.quantity_delta) });
      return acc;
    }, [] as Record<string, unknown>[]) || [];

  // Gap chart data
  const gapChartData = gaps?.map((g) => ({
    product_type: g.product_type.slice(0, 15),
    "On Hand": g.quantity_on_hand,
    Demanded: g.quantity_demanded,
  })) || [];

  const topDrivers = useMemo(() => {
    if (!mlWaterfall?.steps?.length) return [];
    return [...mlWaterfall.steps]
      .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
      .slice(0, 3);
  }, [mlWaterfall]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-semibold">{spoke.name}</h2>
        <StatusBadge status={spoke.status as "operational"} />
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Total Items" value={inventory?.length || 0} />
        <StatCard label="Demand Signals" value={demands?.length || 0} />
        <StatCard label="Critical Items" value={dos?.filter((d) => d.risk_level === "critical").length || 0}
          status={dos?.some((d) => d.risk_level === "critical") ? "error" : "success"} />
        <StatCard label="Supply Gaps" value={gaps?.filter((g) => g.gap < 0).length || 0}
          status={gaps?.some((g) => g.gap < 0) ? "error" : "success"} />
      </div>

      <Panel title="ML Insight">
        {mlPrediction ? (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-surface border border-border rounded p-3">
                <p className="text-xs text-text-secondary mb-1">Predicted Failure Risk</p>
                <p className="text-lg font-mono font-semibold text-text">
                  {(mlPrediction.failure_probability * 100).toFixed(1)}%
                </p>
              </div>
              <div className="bg-surface border border-border rounded p-3">
                <p className="text-xs text-text-secondary mb-1">Projected Time-to-Failure</p>
                <p className="text-lg font-mono font-semibold text-text">
                  {(mlPrediction.time_to_failure_hours / 24).toFixed(1)}d
                </p>
              </div>
              <div className="bg-surface border border-border rounded p-3">
                <p className="text-xs text-text-secondary mb-1">Model Risk Level</p>
                <div className="mt-1">
                  <StatusBadge status={mlPrediction.risk_level as "healthy" | "warning" | "critical"} />
                </div>
              </div>
            </div>

            {topDrivers.length > 0 && (
              <div className="rounded border border-border bg-canvas p-3">
                <p className="text-xs text-text-secondary mb-2">Top 3 Risk Drivers (SHAP)</p>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  {topDrivers.map((d) => (
                    <div key={d.feature} className="rounded bg-surface px-2 py-1 border border-border/70">
                      <p className="text-text">{d.feature}</p>
                      <p className={d.contribution >= 0 ? "text-red-400 font-mono text-xs" : "text-green-400 font-mono text-xs"}>
                        {d.contribution >= 0 ? "+" : ""}{d.contribution.toFixed(3)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p className="text-sm text-text-secondary">
              Executive Summary: This node is currently assessed as <span className="text-text font-medium">{mlPrediction.risk_level}</span>
              {" "}risk with an estimated <span className="text-text font-medium">{(mlPrediction.time_to_failure_hours / 24).toFixed(1)} days</span>
              {" "}of resilience under current conditions. Continue operational monitoring and intervene if leading risk drivers worsen.
            </p>
          </div>
        ) : (
          <p className="text-text-disabled text-sm">ML insights will appear once inventory data is available.</p>
        )}
      </Panel>

      {/* Days of Supply Gauges */}
      {dos && dos.length > 0 && (
        <Panel title="Days of Supply">
          <div className="flex flex-wrap gap-6 justify-center">
            {dos.slice(0, 8).map((d) => (
              <GaugeChart key={d.product_type} value={Math.min(d.days_remaining / 30 * 100, 100)}
                label={d.product_type.slice(0, 20)} maxLabel={`${Math.round(d.days_remaining)}d`} />
            ))}
          </div>
        </Panel>
      )}

      <Panel
        title="Inventory"
        actions={
          <button onClick={openCreate} className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-primary text-white hover:bg-primary/90">
            <Plus size={14} /> Add Item
          </button>
        }
      >
        {inventory && <DataTable columns={invColumns} data={inventory} pageSize={20} />}
      </Panel>

      <div className="grid grid-cols-2 gap-4">
        <Panel title="Burn Rate">
          {burnData.length > 0 ? (
            <TimeSeriesChart data={burnData} series={[{ key: "consumed", color: "#ff5286", label: "Units Consumed" }]} />
          ) : (
            <p className="text-text-disabled text-sm">No consumption data yet</p>
          )}
        </Panel>

        <Panel title="Supply vs Demand">
          {gapChartData.length > 0 ? (
            <BarChart data={gapChartData} xKey="product_type"
              bars={[
                { key: "On Hand", color: "#6ccf8e", label: "On Hand" },
                { key: "Demanded", color: "#ff5286", label: "Demanded" },
              ]} />
          ) : (
            <p className="text-text-disabled text-sm">No gap data</p>
          )}
        </Panel>
      </div>

      <Panel title="Demand-Supply Gap">
        {gaps && <DataTable columns={gapColumns} data={gaps} pageSize={10} />}
      </Panel>

      <InventoryFormModal
        item={editItem}
        nodeId={id!}
        nodeType="spoke"
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={onMutationSuccess}
      />
    </div>
  );
}
