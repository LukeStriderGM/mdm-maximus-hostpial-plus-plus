import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getHubs, getSpokes, getStockoutRisk } from "../lib/api";
import { Panel } from "../components/ui/Panel";
import { StatCard } from "../components/ui/StatCard";
import { StatusBadge } from "../components/ui/StatusBadge";
import { DataTable, type Column } from "../components/ui/DataTable";
import { AlertBanner } from "../components/ui/AlertBanner";
import type { StockoutRisk } from "../lib/api";

const riskColumns: Column<StockoutRisk>[] = [
  { key: "node_name", header: "Node" },
  { key: "node_type", header: "Type" },
  { key: "overall_risk", header: "Risk", render: (r) => <StatusBadge status={r.overall_risk as "healthy" | "warning" | "critical"} /> },
  { key: "critical_items", header: "Critical" },
  { key: "warning_items", header: "Warning" },
  { key: "healthy_items", header: "Healthy" },
];

export function Dashboard() {
  const navigate = useNavigate();
  const { data: hubs } = useQuery({ queryKey: ["hubs"], queryFn: getHubs });
  const { data: spokes } = useQuery({ queryKey: ["spokes"], queryFn: () => getSpokes() });
  const { data: risks, isLoading: risksLoading } = useQuery({ queryKey: ["stockout-risk"], queryFn: getStockoutRisk });

  const criticalCount = risks?.filter((r) => r.overall_risk === "critical").length || 0;
  const healthScore = risks
    ? Math.round((risks.filter((r) => r.overall_risk === "healthy").length / Math.max(risks.length, 1)) * 100)
    : 0;

  return (
    <div className="space-y-4">
      {criticalCount > 0 && (
        <AlertBanner message={`${criticalCount} node(s) have critical stockout risk`} />
      )}

      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Hubs" value={hubs?.length || 0} status="default" />
        <StatCard label="Spokes" value={spokes?.length || 0} status="default" />
        <StatCard label="System Health" value={`${healthScore}%`}
          status={healthScore > 80 ? "success" : healthScore > 50 ? "warning" : "error"} />
        <StatCard label="Critical Alerts" value={criticalCount}
          status={criticalCount > 0 ? "error" : "success"} />
      </div>

      <Panel title="Stockout Risk — All Nodes" loading={risksLoading}>
        {risks && <DataTable columns={riskColumns} data={risks} pageSize={15}
          onRowClick={(row) => navigate(`/${row.node_type === "hub" ? "hubs" : "spokes"}/${row.node_id}`)} />}
      </Panel>
    </div>
  );
}
