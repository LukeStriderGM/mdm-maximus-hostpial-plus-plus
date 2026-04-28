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

      return pred;
    },
  });

  const handlePredict = () => {
    if (!selectedNode) return;
    predictMutation.mutate(selectedNode);
  };

  // Global importance chart data
  const importanceData = useMemo(() => {
    if (!globalImp?.importance) return [];
    return globalImp.importance
      .slice(0, 14)
      .map((f) => ({
        feature: f.feature.length > 20 ? f.feature.slice(0, 20) : f.feature,
        importance: Math.round(f.importance * 10000) / 10000,
      }));
  }, [globalImp]);

  // Waterfall chart data — diverging bar chart
  const waterfallData = useMemo(() => {
    if (!waterfall?.steps) return [];
    return waterfall.steps.map((s) => ({
      feature: s.feature.length > 18 ? s.feature.slice(0, 18) : s.feature,
      contribution: Math.round(s.contribution * 10000) / 10000,
    }));
  }, [waterfall]);

  const modelUnavailable = health && !health.model_loaded;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-text">Model Explainability</h2>

      {/* Model Health */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          label="Model Status"
          value={health?.status || "loading..."}
          status={health?.model_loaded ? "success" : "error"}
        />
        <StatCard
          label="Backend"
          value={health?.model_backend || "none"}
          status={health?.model_loaded ? "default" : "error"}
        />
        <StatCard
          label="Classifier"
          value={health?.classifier || "none"}
          status="default"
        />
        <StatCard
          label="Regressor"
          value={health?.regressor || "none"}
          status="default"
        />
      </div>

      {modelUnavailable && (
        <div className="bg-warning/10 border border-warning/30 rounded-md px-4 py-3 text-sm text-warning-text">
          EBM model not loaded. Train the artifact with:{" "}
          <code className="bg-surface px-1.5 py-0.5 rounded text-xs">
            cd dha_rescue && python train_ebm_pkl.py
          </code>{" "}
          then set <code className="bg-surface px-1.5 py-0.5 rounded text-xs">EBM_MODEL_PATH</code>.
        </div>
      )}

      {/* Global Feature Importance */}
      <Panel title="Global Feature Importance" loading={!globalImp && health?.model_loaded}>
        {importanceData.length > 0 ? (
          <BarChart
            data={importanceData}
            xKey="feature"
            bars={[{ key: "importance", color: "#6c63ff", label: "Importance" }]}
            height={300}
          />
        ) : (
          <p className="text-text-disabled text-sm py-8 text-center">
            {modelUnavailable ? "Model not loaded." : "Loading feature importance..."}
          </p>
        )}
      </Panel>

      {/* Node Risk Predictor */}
      <Panel title="Node Risk Predictor">
        <div className="flex items-end gap-4 mb-4">
          <div className="flex-1">
            <label className="block text-xs text-text-secondary mb-1">Select Node</label>
            <select
              value={selectedNode}
              onChange={(e) => { setSelectedNode(e.target.value); setPrediction(null); setWaterfall(null); }}
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
                {inputRecord?.inventory_units.toLocaleString() || "—"}
              </p>
            </div>
          </div>
        )}
      </Panel>

      {/* Waterfall Explanation */}
      {waterfall && (
        <Panel
          title="Prediction Waterfall — Feature Contributions"
          actions={
            <span className="text-xs text-text-secondary">
              Base: {waterfall.base_value.toFixed(4)} | Final: {waterfall.final_value.toFixed(4)}
            </span>
          }
        >
          {waterfallData.length > 0 ? (
            <>
              <div className="flex items-center gap-4 mb-3 text-xs text-text-secondary">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-error inline-block" /> Increases risk
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-success inline-block" /> Decreases risk
                </span>
              </div>
              <BarChart
                data={waterfallData}
                xKey="feature"
                bars={[{ key: "contribution", color: "#ff5286", label: "Contribution" }]}
                height={280}
              />
              {/* Detailed breakdown table */}
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
                    {waterfall.steps.map((s) => (
                      <tr key={s.feature} className="border-t border-border/50">
                        <td className="py-1.5 text-text">{s.feature}</td>
                        <td className="py-1.5 text-right text-text font-mono">
                          {s.value != null ? s.value.toFixed(2) : "—"}
                        </td>
                        <td className={`py-1.5 text-right font-mono font-medium ${
                          s.contribution > 0 ? "text-error-text" : "text-success-text"
                        }`}>
                          {s.contribution > 0 ? "+" : ""}{s.contribution.toFixed(4)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p className="text-text-disabled text-sm py-8 text-center">No waterfall data.</p>
          )}
        </Panel>
      )}
    </div>
  );
}
