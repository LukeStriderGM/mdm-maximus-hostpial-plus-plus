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
  const qEnabled = !!id;
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

  const { data: spoke, isLoading } = useQuery({ queryKey: ["spoke", id], queryFn: () => getSpoke(id!), enabled: qEnabled });
  const { data: inventory } = useQuery({ queryKey: ["inventory", id], queryFn: () => getInventory({ node_id: id!, limit: "500" }), enabled: qEnabled });
  const { data: events } = useQuery({ queryKey: ["events", id], queryFn: () => getInventoryEvents(id!), enabled: qEnabled });
  const { data: dos } = useQuery({ queryKey: ["dos", id], queryFn: () => getDaysOfSupply(id!), enabled: qEnabled });
  const { data: gaps } = useQuery({ queryKey: ["gaps", id], queryFn: () => getDemandGap(id!), enabled: qEnabled });
  const { data: demands } = useQuery({ queryKey: ["demands", id], queryFn: () => getDemandSignals(id!), enabled: qEnabled });

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
    retry: 1,
  });

  const failurePct = Number.isFinite(mlPrediction?.failure_probability)
    ? (Number(mlPrediction?.failure_probability) * 100).toFixed(1)
    : "n/a";
  const ttfDays = Number.isFinite(mlPrediction?.time_to_failure_hours)
    ? (Number(mlPrediction?.time_to_failure_hours) / 24).toFixed(1)
    : "n/a";
  const riskLabel = mlPrediction?.risk_level || "caution";

  const topDrivers = !mlWaterfall?.steps?.length
    ? []
    : [...mlWaterfall.steps]
      .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
      .slice(0, 3);

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size={32} /></div>;
  if (!spoke) return <p className="text-text-secondary">Spoke not found</p>;

  // Events/charts are temporarily disabled while isolating hook mismatch.
  void events;

  const criticalItems = (dos || []).filter((d) => d.risk_level === "critical").length;
  const supplyGaps = (gaps || []).filter((g) => g.gap < 0).length;
  const hasCriticalItems = (dos || []).some((d) => d.risk_level === "critical");
  const hasSupplyGaps = (gaps || []).some((g) => g.gap < 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-semibold">{spoke.name}</h2>
        <StatusBadge status={spoke.status as "operational"} />
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Total Items" value={inventory?.length || 0} />
        <StatCard label="Demand Signals" value={demands?.length || 0} />
        <StatCard label="Critical Items" value={criticalItems}
          status={hasCriticalItems ? "error" : "success"} />
        <StatCard label="Supply Gaps" value={supplyGaps}
          status={hasSupplyGaps ? "error" : "success"} />
      </div>

      <Panel title="ML Insight">
        <p className="text-text-secondary text-sm">
          Risk: {riskLabel} | Failure: {failurePct}% | TTF: {ttfDays}d | Drivers: {topDrivers.length}
        </p>
      </Panel>

      {/* Temporary isolation: charts disabled to identify hook mismatch source */}

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
          <p className="text-text-disabled text-sm">Chart temporarily disabled</p>
        </Panel>
        <Panel title="Supply vs Demand">
          <p className="text-text-disabled text-sm">Chart temporarily disabled</p>
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
