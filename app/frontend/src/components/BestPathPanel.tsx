import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  getHubs, getSpokes, getInventorySummary, postBestPath,
  type PathResult, type PathStep,
} from "../lib/api";
import { StatusBadge } from "./ui/StatusBadge";

const TRANSPORT_ICONS: Record<string, string> = {
  "fixed-wing": "plane",
  "rotary-wing": "helicopter",
  "ground": "truck",
  "maritime": "ship",
};

const PATH_TYPE_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  direct: { bg: "bg-success/20", text: "text-success-text", label: "Direct" },
  "cross-network": { bg: "bg-warning/20", text: "text-warning-text", label: "Cross-Network" },
  lateral: { bg: "bg-info/20", text: "text-info", label: "Lateral" },
};

const RISK_STATUS: Record<string, "healthy" | "warning" | "critical" | "caution"> = {
  low: "healthy",
  medium: "caution",
  high: "warning",
  critical: "critical",
};

interface BestPathPanelProps {
  onClose: () => void;
  onShowPath: (result: PathResult) => void;
  prefillDestination?: { id: string; type: string } | null;
  showMapAction?: boolean;
}

function TransportIcon({ mode }: { mode: string }) {
  const icon = TRANSPORT_ICONS[mode] || "truck";
  const svgs: Record<string, React.ReactElement> = {
    plane: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
      </svg>
    ),
    helicopter: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 3h20" /><path d="M12 3v7" /><circle cx="12" cy="14" r="4" /><path d="M12 18v3" /><path d="M8 21h8" />
      </svg>
    ),
    truck: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" /><path d="M15 18H9" /><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14" />
        <circle cx="17" cy="18" r="2" /><circle cx="7" cy="18" r="2" />
      </svg>
    ),
    ship: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 .6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
        <path d="M19.38 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.9.94 5.34 2.81 7.76" /><path d="M12 2v8" />
      </svg>
    ),
  };
  return <span className="text-text-disabled">{svgs[icon] || svgs.truck}</span>;
}

function StepTimeline({ steps }: { steps: PathStep[] }) {
  // Collect all nodes in order
  const nodes: { id: string; name: string; type: string }[] = [];
  if (steps.length > 0) {
    nodes.push({ id: steps[0].from_node_id, name: steps[0].from_node_name, type: steps[0].from_node_type });
  }
  steps.forEach((s) => {
    nodes.push({ id: s.to_node_id, name: s.to_node_name, type: s.to_node_type });
  });

  return (
    <div className="relative ml-2 mt-2">
      {nodes.map((node, i) => (
        <div key={node.id} className="flex items-start gap-2 relative">
          {/* Vertical connector line */}
          {i < nodes.length - 1 && (
            <div className="absolute left-[5px] top-[14px] w-[2px] h-[calc(100%)] bg-border-strong" />
          )}
          {/* Node dot */}
          <div className={`relative z-10 mt-[3px] w-3 h-3 rounded-full border-2 flex-shrink-0 ${
            node.type === "hub"
              ? "bg-success border-success"
              : "bg-info border-info"
          }`} />
          {/* Node info + edge info */}
          <div className="pb-3 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-text-primary truncate">{node.name}</span>
              <span className="text-[10px] text-text-disabled uppercase">{node.type}</span>
            </div>
            {i < steps.length && (
              <div className="flex items-center gap-2 mt-0.5 text-[10px] text-text-disabled">
                <TransportIcon mode={steps[i].transport_mode} />
                <span>{steps[i].transport_mode}</span>
                <span>{steps[i].distance_km} km</span>
                <span>{steps[i].transit_hours}h</span>
                <StatusBadge
                  status={RISK_STATUS[steps[i].risk_level] || "caution"}
                  label={steps[i].risk_level}
                />
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function PathResultCard({
  result, rank, onShowPath, showMapAction,
}: { result: PathResult; rank: number; onShowPath: (r: PathResult) => void; showMapAction: boolean }) {
  const typeStyle = PATH_TYPE_COLORS[result.path_type] || PATH_TYPE_COLORS.direct;

  return (
    <div className={`bg-surface border rounded-md p-3 ${
      rank === 0 ? "border-l-2 border-l-info border-border" : "border-border"
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-text-secondary">#{rank + 1}</span>
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${typeStyle.bg} ${typeStyle.text}`}>
            {typeStyle.label}
          </span>
          <StatusBadge
            status={RISK_STATUS[result.risk_summary] || "caution"}
            label={`risk: ${result.risk_summary}`}
          />
        </div>
        {showMapAction && (
          <button
            onClick={() => onShowPath(result)}
            className="text-[10px] text-info hover:text-info/80 font-medium"
          >
            Show on Map
          </button>
        )}
      </div>

      {/* Metrics row */}
      <div className="grid grid-cols-3 gap-2 mb-2">
        <div>
          <div className="text-[10px] text-text-disabled">Source</div>
          <div className="text-xs font-medium text-text-primary truncate">{result.source_node_name}</div>
          <div className="text-[10px] text-text-disabled">{result.source_inventory} units avail.</div>
        </div>
        <div>
          <div className="text-[10px] text-text-disabled">Distance</div>
          <div className="text-xs font-medium text-text-primary">{result.total_distance_km} km</div>
        </div>
        <div>
          <div className="text-[10px] text-text-disabled">Transit</div>
          <div className="text-xs font-medium text-text-primary">{result.total_transit_hours}h</div>
        </div>
      </div>

      {/* Step timeline */}
      <StepTimeline steps={result.steps} />
    </div>
  );
}

export function BestPathPanel({ onClose, onShowPath, prefillDestination, showMapAction = true }: BestPathPanelProps) {
  const { data: hubs } = useQuery({ queryKey: ["hubs"], queryFn: getHubs });
  const { data: spokes } = useQuery({ queryKey: ["spokes"], queryFn: () => getSpokes() });
  const { data: inventorySummary, isLoading: invLoading, isError: invError } = useQuery({ queryKey: ["inventory-summary"], queryFn: getInventorySummary });

  const productTypes = useMemo(() => {
    if (!inventorySummary) return [];
    return inventorySummary.map((r) => r.product_type).sort();
  }, [inventorySummary]);

  const [destId, setDestId] = useState(prefillDestination?.id || "");
  const [productType, setProductType] = useState("");
  const [priority, setPriority] = useState("routine");

  // Sync prefillDestination when it changes (e.g., right-click a different spoke)
  useEffect(() => {
    if (prefillDestination?.id) {
      setDestId(prefillDestination.id);
    }
  }, [prefillDestination?.id]);

  const mutation = useMutation({
    mutationFn: postBestPath,
  });

  const nodesLoading = !hubs && !spokes;

  const handleSubmit = () => {
    if (!destId || !productType) return;
    mutation.mutate({
      destination_node_id: destId,
      product_type: productType,
      priority,
    });
  };

  return (
    <div className="absolute top-4 right-4 w-80 max-h-[calc(100%-2rem)] bg-card/95 backdrop-blur-sm border border-border rounded-md shadow-lg flex flex-col z-[1000] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border flex-shrink-0">
        <h3 className="text-sm font-semibold text-text-primary">Best Path Finder</h3>
        <button onClick={onClose} aria-label="Close" className="text-text-disabled hover:text-text-primary text-lg leading-none">&times;</button>
      </div>

      {/* Form */}
      <div className="p-3 space-y-2 border-b border-border flex-shrink-0">
        {/* Destination */}
        <div>
          <label className="text-[10px] text-text-disabled uppercase tracking-wider">Destination</label>
          <select
            value={destId}
            onChange={(e) => setDestId(e.target.value)}
            disabled={nodesLoading}
            className="w-full mt-0.5 bg-surface border border-border rounded px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:border-info disabled:opacity-50"
          >
            <option value="">{nodesLoading ? "Loading nodes..." : "Select node..."}</option>
            {hubs && hubs.length > 0 && (
              <optgroup label="Hubs">
                {hubs.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
              </optgroup>
            )}
            {spokes && spokes.length > 0 && (
              <optgroup label="Spokes">
                {spokes.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </optgroup>
            )}
          </select>
        </div>

        {/* Product Type */}
        <div>
          <label className="text-[10px] text-text-disabled uppercase tracking-wider">Product Type</label>
          <select
            value={productType}
            onChange={(e) => setProductType(e.target.value)}
            disabled={invLoading}
            className="w-full mt-0.5 bg-surface border border-border rounded px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:border-info disabled:opacity-50"
          >
            <option value="">{invLoading ? "Loading products..." : invError ? "Failed to load products" : "Select product..."}</option>
            {productTypes.map((pt) => <option key={pt} value={pt}>{pt}</option>)}
          </select>
        </div>

        {/* Priority */}
        <div>
          <label className="text-[10px] text-text-disabled uppercase tracking-wider">Priority</label>
          <div className="flex gap-1 mt-0.5">
            {["routine", "urgent", "emergency"].map((p) => (
              <button
                key={p}
                onClick={() => setPriority(p)}
                className={`flex-1 text-[10px] font-medium py-1 rounded border transition-colors ${
                  priority === p
                    ? p === "emergency"
                      ? "bg-error/20 border-error text-error-text"
                      : p === "urgent"
                        ? "bg-warning/20 border-warning text-warning-text"
                        : "bg-success/20 border-success text-success-text"
                    : "bg-surface border-border text-text-disabled hover:text-text-secondary"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={!destId || !productType || mutation.isPending}
          className="w-full py-1.5 rounded bg-info text-white text-xs font-medium hover:bg-info/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {mutation.isPending ? "Finding paths..." : "Find Best Path"}
        </button>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {mutation.isError && (
          <div className="text-xs text-error-text bg-error/10 rounded p-2">
            {mutation.error instanceof Error ? mutation.error.message : "Request failed"}
          </div>
        )}

        {mutation.isSuccess && mutation.data.length === 0 && (
          <div className="text-xs text-text-disabled text-center py-4">
            No paths found — no other node has this product in stock.
          </div>
        )}

        {mutation.data?.map((result, i) => (
          <PathResultCard key={i} result={result} rank={i} onShowPath={onShowPath} showMapAction={showMapAction} />
        ))}
      </div>
    </div>
  );
}
