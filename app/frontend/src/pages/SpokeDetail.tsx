import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getSpoke, getInventory, getInventoryEvents, getDaysOfSupply, getDemandGap, getDemandSignals } from "../lib/api";
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
