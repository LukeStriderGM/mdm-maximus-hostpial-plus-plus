import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  getEBMHealth,
  getEBMExplainGlobal,
  postEBMPredict,
  postEBMWaterfall,
  getHubs,
  getSpokes,
  getInventory,
  type EBMRecordInput,
  type EBMPrediction,
  type WaterfallResult,
} from "../lib/api";
import { Panel } from "../components/ui/Panel";
import { StatCard } from "../components/ui/StatCard";
import { StatusBadge } from "../components/ui/StatusBadge";
import { BarChart } from "../components/ui/BarChart";

const RISK_UP_COLOR = "#E69F00";
const RISK_DOWN_COLOR = "#56B4E9";

export function Explainability() {
  const { data: health } = useQuery({ queryKey: ["ebm-health"], queryFn: getEBMHealth });
  const { data: globalImp } = useQuery({
    queryKey: ["ebm-global"],
    queryFn: getEBMExplainGlobal,
    enabled: health?.model_loaded === true,
  });
  const { data: hubs } = useQuery({ queryKey: ["hubs"], queryFn: getHubs });
  const { data: spokes } = useQuery({ queryKey: ["spokes"], queryFn: () => getSpokes() });

  const [selectedNode, setSelectedNode] = useState<string>("");
  const [prediction, setPrediction] = useState<EBMPrediction | null>(null);
  const [waterfall, setWaterfall] = useState<WaterfallResult | null>(null);
  const [inputRecord, setInputRecord] = useState<EBMRecordInput | null>(null);
  const [hoveredFeature, setHoveredFeature] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<"model_order" | "impact_desc">("model_order");

  const allNodes = useMemo(() => {
    const nodes: { id: string; name: string; type: string }[] = [];
    hubs?.forEach((h) => nodes.push({ id: h.id, name: h.name, type: "hub" }));
    spokes?.forEach((s) => nodes.push({ id: s.id, name: s.name, type: "spoke" }));
    return nodes;
  }, [hubs, spokes]);

  const predictMutation = useMutation({
    mutationFn: async (nodeId: string) => {
      const node = allNodes.find((n) => n.id === nodeId);
      const inv = await getInventory({ node_id: nodeId });
      const totalQty = inv.reduce((sum, i) => sum + i.quantity_on_hand, 0);

      const record: EBMRecordInput = {
        inventory_units: totalQty,
        expiry_hours_remaining: 720,
        demand_rate: Math.max(totalQty / 30, 0.5),
        node_id: nodeId,
        node_name: node?.name || nodeId,
      };
      setInputRecord(record);

      const preds = await postEBMPredict([record]);
      const pred = preds[0];
      setPrediction(pred);

      const wf = await postEBMWaterfall([record], 0, 10);
      setWaterfall(wf);
      setHoveredFeature(wf.steps?.[0]?.feature ?? null);

      return pred;
    },
  });

  const handlePredict = () => {
    if (!selectedNode) return;
    predictMutation.mutate(selectedNode);
  };

  const importanceData = useMemo(() => {
    if (!globalImp?.importance) return [];
    return globalImp.importance
      .slice(0, 14)
      .map((f) => ({
        feature: f.feature.length > 20 ? f.feature.slice(0, 20) : f.feature,
        importance: Math.round(f.importance * 10000) / 10000,
      }));
  }, [globalImp]);

  const waterfallRange = useMemo(() => {
    if (!waterfall?.steps?.length) return { min: -1, max: 1 };
    const vals = [
      waterfall.base_value,
      waterfall.final_value,
      ...waterfall.steps.flatMap((s) => [s.start, s.end]),
    ];
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const pad = (max - min) * 0.1 || 0.1;
    return { min: min - pad, max: max + pad };
  }, [waterfall]);

  const waterfallSteps = useMemo(() => {
    if (!waterfall?.steps) return [];
    if (sortMode === "impact_desc") {
      return [...waterfall.steps].sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
    }
    return waterfall.steps;
  }, [waterfall, sortMode]);

  const displayedWaterfallSteps = useMemo(() => waterfallSteps.slice(0, 5), [waterfallSteps]);

  const hoveredStep = useMemo(
    () => waterfallSteps.find((s) => s.feature === hoveredFeature) ?? waterfallSteps[0] ?? null,
    [waterfallSteps, hoveredFeature]
  );

  const explanationSummary = useMemo(() => {
    if (!prediction || waterfallSteps.length === 0) return null;
    const upDrivers = waterfallSteps
      .filter((s) => s.contribution > 0)
      .sort((a, b) => b.contribution - a.contribution)
      .slice(0, 2)
      .map((s) => s.feature);
    const downDrivers = waterfallSteps
      .filter((s) => s.contribution < 0)
      .sort((a, b) => a.contribution - b.contribution)
      .slice(0, 2)
      .map((s) => s.feature);
    const riskPct = (prediction.failure_probability * 100).toFixed(1);
    const ttfDays = (prediction.time_to_failure_hours / 24).toFixed(1);

    return {
      headline: `Current node risk is ${riskPct}% (${prediction.risk_level}) with an estimated ${ttfDays} days to failure.`,
      why: upDrivers.length > 0
        ? `Main factors pushing risk up: ${upDrivers.join(", ")}.`
        : "No major positive risk drivers were detected.",
      protection: downDrivers.length > 0
        ? `Main factors reducing risk: ${downDrivers.join(", ")}.`
        : "There are no strong protective drivers in this prediction.",
      action:
        prediction.failure_probability > 0.5
          ? "Action now: activate backup supply and prioritize transport for this node."
          : prediction.failure_probability > 0.2
          ? "Action today: monitor inventory and transport latency, and pre-plan rerouting."
          : "Action: maintain current plan and continue monitoring key drivers.",
    };
  }, [prediction, waterfallSteps]);

  const modelUnavailable = health && !health.model_loaded;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-text">Glassbox Model Explainability</h2>

      <div className="grid grid-cols-4 gap-4">
        <StatCard
          label="Model Status"
          value={health?.status || "loading..."}
          status={health?.model_loaded ? "success" : "error"}
        />
        <StatCard
          label="Model Type"
          value={health?.model_backend ? "Glassbox Predictive Model" : "none"}
          status={health?.model_loaded ? "default" : "error"}
        />
        <StatCard
          label="Risk Engine"
          value={health?.classifier ? "Supply Failure Risk Scoring" : "none"}
          status="default"
        />
        <StatCard
          label="Forecast Engine"
          value={health?.regressor ? "Time-to-Failure Forecasting" : "none"}
          status="default"
        />
      </div>

      {modelUnavailable && (
        <div className="bg-warning/10 border border-warning/30 rounded-md px-4 py-3 text-sm text-warning-text">
          Glassbox model not loaded. Train the artifact with:{" "}
          <code className="bg-surface px-1.5 py-0.5 rounded text-xs">
            cd ml_models && python train_ebm_pkl.py
          </code>{" "}
          then set <code className="bg-surface px-1.5 py-0.5 rounded text-xs">EBM_MODEL_PATH</code>.
        </div>
      )}

      <Panel title="Global Feature Importance" loading={!globalImp && health?.model_loaded}>
        {importanceData.length > 0 ? (
          <BarChart
            data={importanceData}
            xKey="feature"
            bars={[{ key: "importance", color: "#4D8DFF", label: "Importance" }]}
            height={300}
          />
        ) : (
          <p className="text-text-disabled text-sm py-8 text-center">
            {modelUnavailable ? "Model not loaded." : "Loading feature importance..."}
          </p>
        )}
      </Panel>

      <Panel title="Node Risk Prediction">
        <div className="flex items-end gap-4 mb-4">
          <div className="flex-1">
            <label className="block text-xs text-text-secondary mb-1">Select Node</label>
            <select
              value={selectedNode}
              onChange={(e) => { setSelectedNode(e.target.value); setPrediction(null); setWaterfall(null); setHoveredFeature(null); }}
              className="w-full bg-surface border border-border rounded px-3 py-2 text-sm text-text focus:border-primary focus:outline-none"
            >
              <option value="">Choose a node...</option>
              {allNodes.map((n) => (
                <option key={n.id} value={n.id}>
                  [{n.type.toUpperCase()}] {n.name}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={handlePredict}
            disabled={!selectedNode || predictMutation.isPending || modelUnavailable}
            className="px-4 py-2 text-sm bg-primary text-white rounded hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {predictMutation.isPending ? "Predicting..." : "Predict Risk"}
          </button>
        </div>

        {predictMutation.isError && (
          <div className="text-error-text text-sm mb-3">
            Error: {(predictMutation.error as Error).message}
          </div>
        )}

        {prediction && (
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-surface border border-border rounded p-3">
              <p className="text-xs text-text-secondary mb-1">Failure Probability</p>
              <p className="text-xl font-mono font-bold text-text">
                {(prediction.failure_probability * 100).toFixed(1)}%
              </p>
            </div>
            <div className="bg-surface border border-border rounded p-3">
              <p className="text-xs text-text-secondary mb-1">Time to Failure</p>
              <p className="text-xl font-mono font-bold text-text">
                {(prediction.time_to_failure_hours / 24).toFixed(1)}d
              </p>
            </div>
            <div className="bg-surface border border-border rounded p-3">
              <p className="text-xs text-text-secondary mb-1">Risk Level</p>
              <div className="mt-1">
                <StatusBadge status={prediction.risk_level as "healthy" | "warning" | "critical"} />
              </div>
            </div>
            <div className="bg-surface border border-border rounded p-3">
              <p className="text-xs text-text-secondary mb-1">Inventory Input</p>
              <p className="text-xl font-mono font-bold text-text">
                {inputRecord?.inventory_units.toLocaleString() || "-"}
              </p>
            </div>
          </div>
        )}
      </Panel>

      {waterfall && (
        <Panel
          title="SHAP Waterfall - What Drove the Risk Score"
          actions={
            <span className="text-xs text-text-secondary">
              Starting Score: {waterfall.base_value.toFixed(4)} | Final Score: {waterfall.final_value.toFixed(4)}
            </span>
          }
        >
          {displayedWaterfallSteps.length > 0 ? (
            <>
              <div className="flex items-center justify-between gap-4 mb-3">
                <div className="flex items-center gap-4 text-xs text-text-secondary">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: RISK_UP_COLOR }} /> Increases risk
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: RISK_DOWN_COLOR }} /> Decreases risk
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <label htmlFor="waterfall-sort" className="text-text-secondary">Sort</label>
                  <select
                    id="waterfall-sort"
                    value={sortMode}
                    onChange={(e) => setSortMode(e.target.value as "model_order" | "impact_desc")}
                    className="bg-canvas border border-border rounded px-2 py-1 text-text"
                  >
                    <option value="model_order">Model order</option>
                    <option value="impact_desc">Largest impact first</option>
                  </select>
                </div>
              </div>

              {hoveredStep && (
                <div className="mb-3 rounded border border-border bg-canvas p-3 text-xs">
                  <p className="text-text-secondary mb-1">Selected Driver</p>
                  <div className="grid grid-cols-4 gap-3">
                    <div>
                      <p className="text-text-secondary">Feature</p>
                      <p className="font-medium text-text">{hoveredStep.feature}</p>
                    </div>
                    <div>
                      <p className="text-text-secondary">Input Value</p>
                      <p className="font-mono text-text">{hoveredStep.value != null ? hoveredStep.value.toFixed(2) : "-"}</p>
                    </div>
                    <div>
                      <p className="text-text-secondary">Risk Shift</p>
                      <p className="font-mono font-semibold" style={{ color: hoveredStep.contribution >= 0 ? RISK_UP_COLOR : RISK_DOWN_COLOR }}>
                        {hoveredStep.contribution >= 0 ? "+" : ""}{hoveredStep.contribution.toFixed(4)}
                      </p>
                    </div>
                    <div>
                      <p className="text-text-secondary">Score Path</p>
                      <p className="font-mono text-text">
                        {`${hoveredStep.start.toFixed(4)} -> ${hoveredStep.end.toFixed(4)}`}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-2 rounded border border-border p-3 bg-surface">
                {displayedWaterfallSteps.map((s) => {
                  const denom = waterfallRange.max - waterfallRange.min || 1;
                  const startPct = ((s.start - waterfallRange.min) / denom) * 100;
                  const endPct = ((s.end - waterfallRange.min) / denom) * 100;
                  const left = Math.min(startPct, endPct);
                  const width = Math.max(Math.abs(endPct - startPct), 0.8);
                  const zeroPct = ((0 - waterfallRange.min) / denom) * 100;
                  const color = s.contribution >= 0 ? RISK_UP_COLOR : RISK_DOWN_COLOR;
                  const isActive = hoveredStep?.feature === s.feature;

                  return (
                    <button
                      type="button"
                      key={s.feature}
                      onMouseEnter={() => setHoveredFeature(s.feature)}
                      onFocus={() => setHoveredFeature(s.feature)}
                      onClick={() => setHoveredFeature(s.feature)}
                      className={`w-full grid grid-cols-[220px_1fr_90px] items-center gap-3 text-left rounded px-1 py-1 transition ${
                        isActive ? "bg-canvas/70 ring-1 ring-primary/40" : "hover:bg-canvas/40"
                      }`}
                    >
                      <div className="text-xs text-text truncate">{s.feature}</div>
                      <div className="relative h-7 rounded bg-canvas border border-border/60 overflow-hidden">
                        <div
                          className="absolute top-0 bottom-0 w-px bg-border-strong/80"
                          style={{ left: `${Math.min(Math.max(zeroPct, 0), 100)}%` }}
                        />
                        <div
                          className="absolute top-1 bottom-1 rounded"
                          style={{ left: `${left}%`, width: `${width}%`, backgroundColor: color }}
                        />
                      </div>
                      <div className="text-right text-xs font-mono" style={{ color: s.contribution >= 0 ? RISK_UP_COLOR : RISK_DOWN_COLOR }}>
                        {s.contribution >= 0 ? "+" : ""}{s.contribution.toFixed(4)}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-text-secondary text-left">
                      <th className="pb-1.5 font-medium">Feature</th>
                      <th className="pb-1.5 font-medium text-right">Value</th>
                      <th className="pb-1.5 font-medium text-right">Contribution</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedWaterfallSteps.map((s) => (
                      <tr key={s.feature} className="border-t border-border/50">
                        <td className="py-1.5 text-text">{s.feature}</td>
                        <td className="py-1.5 text-right text-text font-mono">
                          {s.value != null ? s.value.toFixed(2) : "-"}
                        </td>
                        <td
                          className="py-1.5 text-right font-mono font-medium"
                          style={{ color: s.contribution > 0 ? RISK_UP_COLOR : RISK_DOWN_COLOR }}
                        >
                          {s.contribution > 0 ? "+" : ""}{s.contribution.toFixed(4)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {explanationSummary && (
                <div className="mt-4 rounded border border-border bg-canvas p-4">
                  <h4 className="text-sm font-semibold text-text mb-2">Explanation</h4>
                  <p className="text-sm text-text-secondary">
                    {explanationSummary.headline} {explanationSummary.why} {explanationSummary.protection} {explanationSummary.action}{" "}
                    In plain terms: a lower risk percent means lower immediate disruption risk, and more days to
                    failure means more time before urgent shortage pressure.
                  </p>
                </div>
              )}
            </>
          ) : (
            <p className="text-text-disabled text-sm py-8 text-center">No waterfall data.</p>
          )}
        </Panel>
      )}
    </div>
  );
}
