import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueries } from "@tanstack/react-query";
import {
  getHubs,
  getSpokes,
  getHubInventorySummary,
  getHubDemand,
  getDemandGap,
  getStockoutRisk,
  type DemandSupplyGap,
  type HubInventorySummary,
  type HubDemandResponse,
} from "../lib/api";
import { Panel } from "../components/ui/Panel";
import { StatCard } from "../components/ui/StatCard";
import { StatusBadge } from "../components/ui/StatusBadge";
import { BarChart } from "../components/ui/BarChart";
import { DataTable, type Column } from "../components/ui/DataTable";

// Merged row for the supply vs demand bar chart
interface ProductGap {
  [key: string]: unknown;
  product_type: string;
  supply: number;
  demand: number;
  gap: number;
  gap_pct: number;
}

// Row for the per-spoke gap table
interface SpokeGapRow {
  spoke_name: string;
  spoke_id: string;
  product_type: string;
  quantity_on_hand: number;
  quantity_demanded: number;
  gap: number;
  gap_percentage: number;
  severity: "healthy" | "warning" | "critical";
}

const useGapColumns = (): Column<SpokeGapRow>[] => {
  const navigate = useNavigate();
  return gapColumnsDef(navigate);
};

const gapColumnsDef = (navigate: ReturnType<typeof useNavigate>): Column<SpokeGapRow>[] => [
  {
    key: "spoke_name",
    header: "Spoke",
    render: (r) => (
      <button
        onClick={() => navigate(`/spokes/${r.spoke_id}`)}
        className="text-primary hover:text-primary/80 hover:underline text-left"
      >
        {r.spoke_name}
      </button>
    ),
  },
  { key: "product_type", header: "Product Type" },
  { key: "quantity_on_hand", header: "Supply", render: (r) => r.quantity_on_hand.toLocaleString() },
  { key: "quantity_demanded", header: "Demand", render: (r) => r.quantity_demanded.toLocaleString() },
  {
    key: "gap",
    header: "Gap",
    render: (r) => (
      <span className={r.gap < 0 ? "text-error-text font-medium" : "text-success-text"}>
        {r.gap < 0 ? "" : "+"}{r.gap.toLocaleString()}
      </span>
    ),
  },
  {
    key: "gap_percentage",
    header: "Gap %",
    render: (r) => (
      <span className={r.gap_percentage > 50 ? "text-error-text" : r.gap_percentage > 0 ? "text-warning-text" : "text-success-text"}>
        {r.gap_percentage.toFixed(0)}%
      </span>
    ),
  },
  {
    key: "severity",
    header: "Status",
    render: (r) => <StatusBadge status={r.severity} />,
  },
];

function severityFromGap(gapPct: number): "healthy" | "warning" | "critical" {
  if (gapPct > 50) return "critical";
  if (gapPct > 0) return "warning";
  return "healthy";
}

export function SupplyDemand() {
  const gapColumns = useGapColumns();
  const [selectedHub, setSelectedHub] = useState<string>("all");

  const { data: hubs } = useQuery({ queryKey: ["hubs"], queryFn: getHubs });
  const { data: spokes } = useQuery({ queryKey: ["spokes"], queryFn: () => getSpokes() });
  const { data: risks } = useQuery({ queryKey: ["stockout-risk"], queryFn: getStockoutRisk });

  // Fetch hub inventory summaries for selected or all hubs
  const hubIds = useMemo(() => {
    if (!hubs) return [];
    return selectedHub === "all" ? hubs.map((h) => h.id) : [selectedHub];
  }, [hubs, selectedHub]);

  const inventoryQueries = useQueries({
    queries: hubIds.map((id) => ({
      queryKey: ["hub-inventory", id],
      queryFn: () => getHubInventorySummary(id),
      enabled: hubIds.length > 0,
    })),
  });

  const demandQueries = useQueries({
    queries: hubIds.map((id) => ({
      queryKey: ["hub-demand", id],
      queryFn: () => getHubDemand(id),
      enabled: hubIds.length > 0,
    })),
  });

  // Fetch demand gaps for spokes in scope
  const spokeIds = useMemo(() => {
    if (!spokes) return [];
    if (selectedHub === "all") return spokes.map((s) => s.id);
    return spokes.filter((s) => s.hub_id === selectedHub).map((s) => s.id);
  }, [spokes, selectedHub]);

  const gapQueries = useQueries({
    queries: spokeIds.map((id) => ({
      queryKey: ["demand-gap", id],
      queryFn: () => getDemandGap(id),
      enabled: spokeIds.length > 0,
    })),
  });

  const isLoading =
    inventoryQueries.some((q) => q.isLoading) ||
    demandQueries.some((q) => q.isLoading) ||
    gapQueries.some((q) => q.isLoading);

  // Aggregate supply by product type
  const inventoryData = useMemo(() => {
    const map = new Map<string, number>();
    for (const q of inventoryQueries) {
      if (!q.data) continue;
      for (const pt of (q.data as HubInventorySummary).by_product_type) {
        map.set(pt.product_type, (map.get(pt.product_type) || 0) + pt.total_quantity);
      }
    }
    return map;
  }, [inventoryQueries]);

  // Aggregate demand by product type
  const demandData = useMemo(() => {
    const map = new Map<string, number>();
    for (const q of demandQueries) {
      if (!q.data) continue;
      for (const sig of (q.data as HubDemandResponse).signals) {
        map.set(sig.product_type, (map.get(sig.product_type) || 0) + sig.quantity_needed);
      }
    }
    return map;
  }, [demandQueries]);

  // Product gap chart data
  const productGaps: ProductGap[] = useMemo(() => {
    const allTypes = new Set([...inventoryData.keys(), ...demandData.keys()]);
    return Array.from(allTypes)
      .map((pt) => {
        const supply = inventoryData.get(pt) || 0;
        const demand = demandData.get(pt) || 0;
        const gap = supply - demand;
        const gap_pct = demand > 0 ? ((demand - supply) / demand) * 100 : 0;
        return { product_type: pt, supply, demand, gap, gap_pct: Math.max(0, gap_pct) };
      })
      .sort((a, b) => b.demand - a.demand);
  }, [inventoryData, demandData]);

  // Spoke gap table rows
  const spokeGapRows: SpokeGapRow[] = useMemo(() => {
    const spokeMap = new Map(spokes?.map((s) => [s.id, s.name]) || []);
    const rows: SpokeGapRow[] = [];
    gapQueries.forEach((q, i) => {
      if (!q.data) return;
      const sid = spokeIds[i];
      for (const g of q.data as DemandSupplyGap[]) {
        rows.push({
          spoke_name: spokeMap.get(sid) || sid,
          spoke_id: sid,
          product_type: g.product_type,
          quantity_on_hand: g.quantity_on_hand,
          quantity_demanded: g.quantity_demanded,
          gap: g.gap,
          gap_percentage: g.gap_percentage,
          severity: severityFromGap(g.gap_percentage),
        });
      }
    });
    return rows.sort((a, b) => b.gap_percentage - a.gap_percentage);
  }, [gapQueries, spokeIds, spokes]);

  // Aggregate stats
  const totalSupply = Array.from(inventoryData.values()).reduce((a, b) => a + b, 0);
  const totalDemand = Array.from(demandData.values()).reduce((a, b) => a + b, 0);
  const totalGap = totalSupply - totalDemand;
  const criticalGaps = spokeGapRows.filter((r) => r.severity === "critical").length;
  const nodesAtRisk = risks?.filter((r) => r.overall_risk === "critical").length || 0;

  const selectedHubObj = hubs?.find((h) => h.id === selectedHub);

  return (
    <div className="space-y-4">
      {/* Hub filter */}
      <div className="flex items-center gap-4">
        <h2 className="text-lg font-semibold text-text">Supply & Demand</h2>
        <select
          value={selectedHub}
          onChange={(e) => setSelectedHub(e.target.value)}
          className="bg-surface border border-border rounded px-3 py-1.5 text-sm text-text focus:border-primary focus:outline-none"
        >
          <option value="all">All Hubs</option>
          {hubs?.map((h) => (
            <option key={h.id} value={h.id}>{h.name}</option>
          ))}
        </select>
        {selectedHubObj && (
          <span className="text-xs text-text-secondary">
            {spokes?.filter((s) => s.hub_id === selectedHub).length || 0} spokes
          </span>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-5 gap-4">
        <StatCard
          label="Total Supply"
          value={totalSupply.toLocaleString()}
          status="default"
        />
        <StatCard
          label="Total Demand"
          value={totalDemand.toLocaleString()}
          status={totalDemand > totalSupply ? "error" : "default"}
        />
        <StatCard
          label="Net Balance"
          value={`${totalGap >= 0 ? "+" : ""}${totalGap.toLocaleString()}`}
          status={totalGap < 0 ? "error" : totalGap === 0 ? "warning" : "success"}
        />
        <StatCard
          label="Critical Gaps"
          value={criticalGaps}
          status={criticalGaps > 0 ? "error" : "success"}
        />
        <StatCard
          label="Nodes at Risk"
          value={nodesAtRisk}
          status={nodesAtRisk > 0 ? "error" : "success"}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-2 gap-4">
        <Panel title="Supply vs Demand by Product Type" loading={isLoading}>
          {productGaps.length > 0 ? (
            <BarChart
              data={productGaps}
              xKey="product_type"
              bars={[
                { key: "supply", color: "#1a7f4b", label: "Supply" },
                { key: "demand", color: "#d10e5c", label: "Demand" },
              ]}
              height={300}
            />
          ) : (
            <p className="text-text-disabled text-sm py-8 text-center">
              No supply/demand data available. Upload inventory data and create demand signals to see analysis.
            </p>
          )}
        </Panel>

        <Panel title="Demand Gap by Product Type" loading={isLoading}>
          {productGaps.length > 0 ? (
            <BarChart
              data={productGaps}
              xKey="product_type"
              bars={[
                { key: "gap_pct", color: "#ff9900", label: "Unmet Demand %" },
              ]}
              height={300}
            />
          ) : (
            <p className="text-text-disabled text-sm py-8 text-center">
              No gap data available.
            </p>
          )}
        </Panel>
      </div>

      {/* Gap detail table */}
      <Panel
        title={`Spoke Demand Gaps${selectedHub !== "all" ? ` — ${selectedHubObj?.name || ""}` : " — All Spokes"}`}
        loading={isLoading}
        actions={
          <span className="text-xs text-text-secondary">
            {spokeGapRows.length} gap{spokeGapRows.length !== 1 ? "s" : ""} across {spokeIds.length} spoke{spokeIds.length !== 1 ? "s" : ""}
          </span>
        }
      >
        <DataTable
          columns={gapColumns}
          data={spokeGapRows}
          pageSize={15}
        />
      </Panel>
    </div>
  );
}
