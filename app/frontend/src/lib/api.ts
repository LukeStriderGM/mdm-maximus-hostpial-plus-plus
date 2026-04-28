const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// --- Hubs ---
export const getHubs = () => request<Hub[]>("/hubs");
export const getHub = (id: string) => request<Hub>(`/hubs/${id}`);
export const createHub = (data: HubCreate) => request<Hub>("/hubs", { method: "POST", body: JSON.stringify(data) });
export const updateHub = (id: string, data: Partial<HubCreate>) => request<Hub>(`/hubs/${id}`, { method: "PUT", body: JSON.stringify(data) });
export const deleteHub = (id: string) => request<void>(`/hubs/${id}`, { method: "DELETE" });

// --- Spokes ---
export const getSpokes = (hubId?: string) => request<Spoke[]>(hubId ? `/spokes?hub_id=${hubId}` : "/spokes");
export const getSpoke = (id: string) => request<Spoke>(`/spokes/${id}`);
export const createSpoke = (data: SpokeCreate) => request<Spoke>("/spokes", { method: "POST", body: JSON.stringify(data) });
export const updateSpoke = (id: string, data: Partial<SpokeCreate>) => request<Spoke>(`/spokes/${id}`, { method: "PUT", body: JSON.stringify(data) });
export const deleteSpoke = (id: string) => request<void>(`/spokes/${id}`, { method: "DELETE" });

// --- Demand Signals ---
export const createDemandSignal = (spokeId: string, data: DemandSignalCreate) => request<DemandSignal>(`/spokes/${spokeId}/demand`, { method: "POST", body: JSON.stringify(data) });
export const getDemandSignals = (spokeId: string) => request<DemandSignal[]>(`/spokes/${spokeId}/demand`);

// --- Hub Aggregates ---
export const getHubDemand = (hubId: string) => request<HubDemandResponse>(`/hubs/${hubId}/demand`);
export const getHubInventorySummary = (hubId: string) => request<HubInventorySummary>(`/hubs/${hubId}/inventory`);
export const getHubStockoutRisk = (hubId: string) => request<HubStockoutRiskResponse>(`/hubs/${hubId}/stockout-risk`);
export const getHubCapacity = (hubId: string) => request<HubCapacityResponse>(`/hubs/${hubId}/capacity`);

// --- Inventory ---
export const getInventory = (params?: Record<string, string>) => {
  const qs = params ? "?" + new URLSearchParams(params).toString() : "";
  return request<InventoryItem[]>(`/inventory${qs}`);
};
export const getInventoryItem = (id: string) => request<InventoryItem>(`/inventory/${id}`);
export const createInventoryItem = (data: InventoryItemCreate) => request<InventoryItem>("/inventory", { method: "POST", body: JSON.stringify(data) });
export const updateInventoryItem = (id: string, data: Partial<InventoryItemCreate>) => request<InventoryItem>(`/inventory/${id}`, { method: "PUT", body: JSON.stringify(data) });
export const deleteInventoryItem = (id: string) => request<void>(`/inventory/${id}`, { method: "DELETE" });
export const getInventoryEvents = (nodeId: string) => request<InventoryEvent[]>(`/inventory/${nodeId}/events`);
export const searchInventory = (q: string, limit = 20) =>
  request<ProductSearchResult[]>(`/inventory/search?q=${encodeURIComponent(q)}&limit=${limit}`);

// --- Analytics ---
export const getDaysOfSupply = (nodeId: string) => request<DaysOfSupply[]>(`/analytics/days-of-supply/${nodeId}`);
export const getStockoutRisk = () => request<StockoutRisk[]>("/analytics/stockout-risk");
export const getDemandGap = (spokeId: string) => request<DemandSupplyGap[]>(`/analytics/demand-gap/${spokeId}`);
export const getInventorySummary = () => request<InventorySummaryRow[]>("/analytics/inventory-summary");
export const getGlobalInventoryEvents = (limit = 200) => request<InventoryEvent[]>(`/inventory/events?limit=${limit}`);

// --- Supply Routes ---
export const getSupplyRoutes = () => request<SupplyRoute[]>("/supply-routes");

// --- EBM Explainability ---
export const getEBMHealth = () => request<EBMHealth>("/ebm/health");
export const postEBMPredict = (records: EBMRecordInput[]) =>
  request<EBMPrediction[]>("/ebm/predict", { method: "POST", body: JSON.stringify({ records }) });
export const postEBMExplainLocal = (records: EBMRecordInput[], index = 0) =>
  request<{ index: number; explanation: FeatureContribution[] }>(
    `/ebm/explain/local?index=${index}`, { method: "POST", body: JSON.stringify({ records }) });
export const getEBMExplainGlobal = () =>
  request<{ importance: GlobalImportance[] }>("/ebm/explain/global");
export const postEBMWaterfall = (records: EBMRecordInput[], index = 0, topK = 10) =>
  request<WaterfallResult>(
    `/ebm/explain/waterfall?index=${index}&top_k=${topK}`,
    { method: "POST", body: JSON.stringify({ records }) });

// --- Ingestion ---
export const uploadFile = async (file: File) => {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${BASE_URL}/ingestion/upload`, { method: "POST", body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || res.statusText);
  }
  return res.json() as Promise<IngestionResult>;
};

// --- Types ---
export interface Hub {
  id: string; name: string; latitude: number; longitude: number;
  status: string; capacity: number; registered_at: string;
  spoke_count?: number; inventory_count?: number;
}
export interface HubCreate { name: string; latitude: number; longitude: number; status?: string; capacity?: number; }

export interface Spoke {
  id: string; name: string; hub_id: string; latitude: number; longitude: number;
  status: string; registered_at: string; inventory_count?: number;
}
export interface SpokeCreate { name: string; hub_id: string; latitude: number; longitude: number; status?: string; }

export interface InventoryItem {
  id: string; node_id: string; node_type: string; product_noun: string;
  product_type: string; item_description?: string; manufacturer?: string;
  catalog_number?: string; unspsc_commodity?: string; product_size?: string;
  quantity_on_hand: number; reorder_threshold: number;
  expiration_date?: string; cold_chain_required: boolean; updated_at: string;
}
export interface InventoryItemCreate {
  node_id: string; node_type: string; product_noun: string; product_type: string;
  item_description?: string; manufacturer?: string; quantity_on_hand?: number;
  reorder_threshold?: number; expiration_date?: string; cold_chain_required?: boolean;
}

export interface DemandSignal {
  id: string; spoke_id: string; product_type: string;
  quantity_needed: number; priority: string; casualty_scenario?: string; created_at: string;
}
export interface DemandSignalCreate { spoke_id: string; product_type: string; quantity_needed: number; priority?: string; }

export interface InventoryEvent {
  id: string; node_id: string; node_type: string; product_type: string;
  event_type: string; quantity_delta: number; timestamp: string;
}

export interface DaysOfSupply {
  node_id: string; product_type: string; quantity_on_hand: number;
  avg_daily_consumption: number; days_remaining: number; risk_level: string;
}
export interface StockoutRisk {
  node_id: string; node_name: string; node_type: string;
  critical_items: number; warning_items: number; healthy_items: number; overall_risk: string;
}
export interface DemandSupplyGap {
  spoke_id: string; product_type: string; quantity_on_hand: number;
  quantity_demanded: number; gap: number; gap_percentage: number;
}
export interface IngestionResult {
  rows_processed: number; hubs_created: number; spokes_created: number;
  items_created: number; errors: string[];
}

// --- Hub Aggregate Types ---
export interface HubDemandResponse {
  hub_id: string;
  total_signals: number;
  total_quantity_needed: number;
  by_priority: Record<string, number>;
  signals: DemandSignal[];
}

export interface ProductTypeSummary {
  product_type: string;
  total_quantity: number;
  item_count: number;
}

export interface NodeInventorySummary {
  node_id: string;
  node_name: string;
  node_type: string;
  total_quantity: number;
  item_count: number;
}

export interface HubInventorySummary {
  hub_id: string;
  total_items: number;
  total_quantity: number;
  by_product_type: ProductTypeSummary[];
  by_node: NodeInventorySummary[];
}

export interface HubStockoutRiskResponse {
  hub_id: string;
  overall_risk: string;
  nodes: StockoutRisk[];
}

export interface SupplyRoute {
  id: string; hub_id: string; spoke_id: string; transport_mode: string;
  distance_km: number; transit_hours: number; status: string; last_updated: string;
}

export interface InventorySummaryRow {
  product_type: string;
  total_quantity: number;
  total_reorder_threshold: number;
  item_count: number;
  fill_rate: number;
  total_consumed: number;
  total_restocked: number;
  net_flow: number;
}

export interface ProductSearchResult {
  product_type: string;
  product_noun: string;
  manufacturer: string | null;
  catalog_number: string | null;
  cold_chain_required: boolean;
  total_quantity: number;
  total_reorder: number;
  location_count: number;
  node_count: number;
}

export interface HubCapacityResponse {
  hub_id: string;
  hub_name: string;
  hub_capacity: number;
  total_inventory: number;
  utilization_pct: number;
  spoke_count: number;
  spokes_operational: number;
  spokes_degraded: number;
  spokes_offline: number;
}

// --- EBM Explainability Types ---
export interface EBMRecordInput {
  inventory_units: number;
  expiry_hours_remaining?: number;
  temperature_excursion_flag?: number;
  transport_delay_hours?: number;
  route_reliability_score?: number;
  demand_rate?: number;
  casualty_rate?: number;
  cold_chain_health_score?: number;
  backup_supply_available?: number;
  node_id?: string;
  node_name?: string;
}

export interface EBMPrediction {
  node_id: string;
  node_name: string;
  failure_probability: number;
  time_to_failure_hours: number;
  risk_level: string;
}

export interface FeatureContribution {
  feature: string;
  value: number | null;
  shap_value: number;
  abs_shap: number;
}

export interface WaterfallStep {
  feature: string;
  value: number | null;
  contribution: number;
  start: number;
  end: number;
}

export interface WaterfallResult {
  index: number;
  prediction_probability: number;
  base_value: number;
  top_k: number;
  steps: WaterfallStep[];
  final_value: number;
}

export interface GlobalImportance {
  feature: string;
  importance: number;
}

export interface EBMHealth {
  status: string;
  model_loaded: boolean;
  model_backend: string | null;
  classifier: string | null;
  regressor: string | null;
}
