import { useState, useMemo, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowUp,
  ArrowDown,
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart3,
  Search,
} from "lucide-react";
import {
  getInventorySummary,
  getGlobalInventoryEvents,
  getStockoutRisk,
  getHubs,
  getSpokes,
  searchInventory,
  type InventorySummaryRow,
  type InventoryEvent,
  type ProductSearchResult,
  type StockoutRisk,
} from "../lib/api";
import { useDebounce } from "../hooks/useDebounce";
import { Panel } from "../components/ui/Panel";
import { StatCard } from "../components/ui/StatCard";
import { StatusBadge } from "../components/ui/StatusBadge";
import { DataTable, type Column } from "../components/ui/DataTable";
import { TimeSeriesChart } from "../components/ui/TimeSeriesChart";
import { BarChart } from "../components/ui/BarChart";

// --- Inventory Search (Robinhood-style) ---
function productKey(p: ProductSearchResult) {
  return `${p.product_noun}|${p.product_type}|${p.manufacturer ?? ""}|${p.catalog_number ?? ""}`;
}

function productDetailPath(p: ProductSearchResult) {
  const params = new URLSearchParams();
  params.set("noun", p.product_noun);
  params.set("type", p.product_type);
  if (p.manufacturer) params.set("mfr", p.manufacturer);
  if (p.catalog_number) params.set("catalog", p.catalog_number);
  return `/inventory/item?${params.toString()}`;
}

function InventorySearch() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const debouncedQuery = useDebounce(query, 300);

  const { data: results, isFetching } = useQuery({
    queryKey: ["inv-search", debouncedQuery],
    queryFn: () => searchInventory(debouncedQuery),
    enabled: debouncedQuery.length >= 2,
    staleTime: 10_000,
  });

  const showDropdown = open && debouncedQuery.length >= 2;

  useEffect(() => setHighlighted(0), [results]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function navigateToProduct(p: ProductSearchResult) {
    setOpen(false);
    setQuery("");
    navigate(productDetailPath(p));
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!showDropdown || !results?.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      navigateToProduct(results[highlighted]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  function healthColor(p: ProductSearchResult) {
    if (p.total_quantity < p.total_reorder * 0.3) return "text-error-text";
    if (p.total_quantity < p.total_reorder) return "text-warning-text";
    return "text-success-text";
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-disabled" />
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search inventory — product, manufacturer, catalog #..."
          className="w-full bg-surface border border-border rounded-md pl-9 pr-4 py-2.5 text-sm text-text placeholder:text-text-disabled focus:border-primary focus:outline-none"
        />
        {isFetching && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {showDropdown && (
        <div className="absolute z-50 w-full bg-card border border-border rounded-md shadow-lg mt-1 max-h-80 overflow-y-auto">
          {results && results.length > 0 ? (
            results.map((p, i) => (
              <button
                key={productKey(p)}
                onClick={() => navigateToProduct(p)}
                onMouseEnter={() => setHighlighted(i)}
                className={`w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors ${
                  i === highlighted ? "bg-hover" : "hover:bg-hover"
                } ${i > 0 ? "border-t border-border" : ""}`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-text">{p.product_noun}</span>
                    <span className="text-xs text-text-secondary">{p.product_type}</span>
                  </div>
                  <div className="text-xs text-text-disabled truncate">
                    {[p.manufacturer, p.catalog_number].filter(Boolean).join(" · ") || "No manufacturer info"}
                  </div>
                </div>
                <div className="text-right shrink-0 ml-4">
                  <span className={`font-mono font-bold text-sm ${healthColor(p)}`}>
                    {p.total_quantity.toLocaleString()}
                  </span>
                  <div className="text-[10px] text-text-disabled">
                    {p.node_count} {p.node_count === 1 ? "location" : "locations"}
                  </div>
                </div>
              </button>
            ))
          ) : !isFetching ? (
            <div className="px-4 py-6 text-center text-sm text-text-disabled">
              No results for "{debouncedQuery}"
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

// --- Ticker Tape ---
function TickerTape({ events }: { events: InventoryEvent[] }) {
  if (events.length === 0) return null;

  // Show latest 30 events in a scrolling strip
  const items = events.slice(0, 30);

  return (
    <div className="overflow-hidden bg-surface border border-border rounded-md">
      <div className="flex animate-ticker whitespace-nowrap py-2 px-4 gap-6">
        {items.map((e) => {
          const isRestock = e.event_type === "restock";
          return (
            <span key={e.id} className="inline-flex items-center gap-1.5 text-xs font-mono shrink-0">
              <span className="text-text-secondary">{e.product_type}</span>
              <span className={isRestock ? "text-success-text" : "text-error-text"}>
                {isRestock ? "+" : ""}{e.quantity_delta}
              </span>
              {isRestock ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
            </span>
          );
        })}
        {/* Duplicate for seamless loop */}
        {items.map((e) => {
          const isRestock = e.event_type === "restock";
          return (
            <span key={`dup-${e.id}`} className="inline-flex items-center gap-1.5 text-xs font-mono shrink-0">
              <span className="text-text-secondary">{e.product_type}</span>
              <span className={isRestock ? "text-success-text" : "text-error-text"}>
                {isRestock ? "+" : ""}{e.quantity_delta}
              </span>
              {isRestock ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
            </span>
          );
        })}
      </div>
    </div>
  );
}

// --- Product Stock Card ---
function ProductCard({
  row,
  selected,
  onClick,
}: {
  row: InventorySummaryRow;
  selected: boolean;
  onClick: () => void;
}) {
  const trend = row.net_flow > 0 ? "up" : row.net_flow < 0 ? "down" : "flat";
  const fillColor =
    row.fill_rate >= 80 ? "text-success-text" :
    row.fill_rate >= 40 ? "text-warning-text" :
    "text-error-text";

  return (
    <button
      onClick={onClick}
      className={`text-left bg-card border rounded-md p-3 transition-colors min-w-[180px] ${
        selected ? "border-primary ring-1 ring-primary/30" : "border-border hover:border-border-med"
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-text truncate max-w-[120px]">
          {row.product_type}
        </span>
        <span className="text-[10px] text-text-disabled">{row.item_count} items</span>
      </div>
      <div className="flex items-end gap-2">
        <span className="text-lg font-mono font-bold text-text">
          {row.total_quantity.toLocaleString()}
        </span>
        <div className={`flex items-center gap-0.5 text-xs mb-0.5 ${
          trend === "up" ? "text-success-text" : trend === "down" ? "text-error-text" : "text-text-secondary"
        }`}>
          {trend === "up" ? <TrendingUp size={12} /> : trend === "down" ? <TrendingDown size={12} /> : <Minus size={12} />}
          <span>{Math.abs(row.net_flow).toLocaleString()}</span>
        </div>
      </div>
      {/* Fill rate bar */}
      <div className="mt-2">
        <div className="flex justify-between text-[10px] mb-0.5">
          <span className="text-text-disabled">Fill Rate</span>
          <span className={fillColor}>{row.fill_rate}%</span>
        </div>
        <div className="h-1 bg-elevated rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              row.fill_rate >= 80 ? "bg-success" :
              row.fill_rate >= 40 ? "bg-warning" :
              "bg-error"
            }`}
            style={{ width: `${Math.min(row.fill_rate, 100)}%` }}
          />
        </div>
      </div>
    </button>
  );
}

// --- Node Watchlist ---
function useWatchlistColumns() {
  const navigate = useNavigate();

  const columns: Column<StockoutRisk>[] = [
    {
      key: "node_name",
      header: "Node",
      render: (r) => (
        <button
          onClick={() => navigate(`/${r.node_type === "hub" ? "hubs" : "spokes"}/${r.node_id}`)}
          className="text-primary hover:text-primary/80 hover:underline text-left"
        >
          {r.node_name}
        </button>
      ),
    },
    {
      key: "node_type",
      header: "Type",
      render: (r) => (
        <span className={`text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded ${
          r.node_type === "hub" ? "bg-primary/20 text-primary-text" : "bg-elevated text-text-secondary"
        }`}>
          {r.node_type}
        </span>
      ),
    },
    {
      key: "healthy_items",
      header: "Healthy",
      render: (r) => <span className="text-success-text font-mono">{r.healthy_items}</span>,
    },
    {
      key: "warning_items",
      header: "Warning",
      render: (r) => <span className={r.warning_items > 0 ? "text-warning-text font-mono" : "text-text-disabled font-mono"}>{r.warning_items}</span>,
    },
    {
      key: "critical_items",
      header: "Critical",
      render: (r) => <span className={r.critical_items > 0 ? "text-error-text font-mono font-bold" : "text-text-disabled font-mono"}>{r.critical_items}</span>,
    },
    {
      key: "overall_risk",
      header: "Status",
      render: (r) => <StatusBadge status={r.overall_risk as "healthy"} />,
    },
  ];

  return columns;
}

// --- Main Page ---
export function InventoryMarket() {
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ["inventory-summary"],
    queryFn: getInventorySummary,
  });
  const { data: events, isLoading: eventsLoading } = useQuery({
    queryKey: ["global-events"],
    queryFn: () => getGlobalInventoryEvents(200),
  });
  const { data: risks } = useQuery({ queryKey: ["stockout-risk"], queryFn: getStockoutRisk });
  const { data: hubs } = useQuery({ queryKey: ["hubs"], queryFn: getHubs });
  const { data: spokes } = useQuery({ queryKey: ["spokes"], queryFn: () => getSpokes() });

  const watchlistColumns = useWatchlistColumns();

  // Aggregate stats
  const totalItems = summary?.reduce((a, r) => a + r.item_count, 0) || 0;
  const totalQuantity = summary?.reduce((a, r) => a + r.total_quantity, 0) || 0;
  const totalConsumed = summary?.reduce((a, r) => a + r.total_consumed, 0) || 0;
  const totalRestocked = summary?.reduce((a, r) => a + r.total_restocked, 0) || 0;
  const netFlow = totalRestocked - totalConsumed;
  const criticalNodes = risks?.filter((r) => r.overall_risk === "critical").length || 0;
  const avgFillRate = summary && summary.length > 0
    ? Math.round(summary.reduce((a, r) => a + r.fill_rate, 0) / summary.length)
    : 0;

  // Time series data from events for selected product type (or all)
  const chartData = useMemo(() => {
    if (!events) return [];
    const filtered = selectedProduct
      ? events.filter((e) => e.product_type === selectedProduct)
      : events;

    // Aggregate by day
    const dayMap = new Map<string, { restocked: number; consumed: number; net: number }>();
    for (const e of filtered) {
      const day = e.timestamp.split("T")[0];
      const entry = dayMap.get(day) || { restocked: 0, consumed: 0, net: 0 };
      if (e.event_type === "restock") {
        entry.restocked += e.quantity_delta;
        entry.net += e.quantity_delta;
      } else {
        entry.consumed += Math.abs(e.quantity_delta);
        entry.net += e.quantity_delta;
      }
      dayMap.set(day, entry);
    }

    return Array.from(dayMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, v]) => ({
        timestamp: day,
        restocked: v.restocked,
        consumed: v.consumed,
        net: v.net,
      }));
  }, [events, selectedProduct]);

  // Bar chart data: top products by quantity
  const productBarData = useMemo(() => {
    if (!summary) return [];
    return summary.slice(0, 10).map((r) => ({
      product_type: r.product_type.length > 15 ? r.product_type.slice(0, 15) : r.product_type,
      "On Hand": r.total_quantity,
      "Reorder Level": r.total_reorder_threshold,
    }));
  }, [summary]);

  const isLoading = summaryLoading || eventsLoading;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <BarChart3 size={20} className="text-primary" />
        <h2 className="text-lg font-semibold text-text">Inventory Market</h2>
        <span className="text-xs text-text-secondary">
          {hubs?.length || 0} hubs, {spokes?.length || 0} spokes
        </span>
      </div>

      {/* Search */}
      <InventorySearch />

      {/* Ticker Tape */}
      {events && events.length > 0 && <TickerTape events={events} />}

      {/* Market Summary Stats */}
      <div className="grid grid-cols-6 gap-3">
        <StatCard
          label="Total Items"
          value={totalItems.toLocaleString()}
          status="default"
        />
        <StatCard
          label="Total Quantity"
          value={totalQuantity.toLocaleString()}
          status="default"
        />
        <StatCard
          label="Net Flow"
          value={`${netFlow >= 0 ? "+" : ""}${netFlow.toLocaleString()}`}
          trend={netFlow >= 0 ? "up" : "down"}
          trendValue={`${totalRestocked.toLocaleString()} in / ${totalConsumed.toLocaleString()} out`}
          status={netFlow >= 0 ? "success" : "error"}
        />
        <StatCard
          label="Avg Fill Rate"
          value={`${avgFillRate}%`}
          status={avgFillRate >= 80 ? "success" : avgFillRate >= 40 ? "warning" : "error"}
        />
        <StatCard
          label="Product Types"
          value={summary?.length || 0}
          status="default"
        />
        <StatCard
          label="Critical Nodes"
          value={criticalNodes}
          status={criticalNodes > 0 ? "error" : "success"}
        />
      </div>

      {/* Product Type Stock Cards */}
      <Panel
        title="Product Types"
        loading={isLoading}
        actions={
          selectedProduct ? (
            <button
              onClick={() => setSelectedProduct(null)}
              className="text-xs text-primary hover:text-primary/80"
            >
              Clear filter
            </button>
          ) : (
            <span className="text-xs text-text-secondary">Click to filter chart</span>
          )
        }
      >
        <div className="flex gap-3 overflow-x-auto pb-2">
          {summary?.map((row) => (
            <ProductCard
              key={row.product_type}
              row={row}
              selected={selectedProduct === row.product_type}
              onClick={() =>
                setSelectedProduct(
                  selectedProduct === row.product_type ? null : row.product_type,
                )
              }
            />
          ))}
        </div>
      </Panel>

      {/* Charts Row */}
      <div className="grid grid-cols-2 gap-4">
        <Panel
          title={selectedProduct ? `Activity: ${selectedProduct}` : "Activity: All Products"}
          loading={isLoading}
          actions={
            <div className="flex items-center gap-2 text-[10px]">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-success inline-block" /> Restocked</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-error inline-block" /> Consumed</span>
            </div>
          }
        >
          {chartData.length > 0 ? (
            <TimeSeriesChart
              data={chartData}
              series={[
                { key: "restocked", color: "#6ccf8e", label: "Restocked" },
                { key: "consumed", color: "#ff5286", label: "Consumed" },
              ]}
              height={280}
            />
          ) : (
            <p className="text-text-disabled text-sm py-8 text-center">
              No event data available. Inventory changes will appear here.
            </p>
          )}
        </Panel>

        <Panel title="Inventory vs Reorder Level" loading={isLoading}>
          {productBarData.length > 0 ? (
            <BarChart
              data={productBarData}
              xKey="product_type"
              bars={[
                { key: "On Hand", color: "#3d71d9", label: "On Hand" },
                { key: "Reorder Level", color: "#ff9900", label: "Reorder Level" },
              ]}
              height={280}
            />
          ) : (
            <p className="text-text-disabled text-sm py-8 text-center">
              No inventory data available.
            </p>
          )}
        </Panel>
      </div>

      {/* Node Watchlist */}
      <Panel
        title="Node Watchlist"
        loading={!risks}
        actions={
          <span className="text-xs text-text-secondary">
            {risks?.length || 0} nodes tracked
          </span>
        }
      >
        {risks && (
          <DataTable
            columns={watchlistColumns}
            data={risks}
            searchable
            pageSize={15}
          />
        )}
      </Panel>

      {/* Recent Events Log */}
      <Panel
        title="Recent Events"
        loading={eventsLoading}
        actions={
          <span className="text-xs text-text-secondary">
            Latest {events?.length || 0} events
          </span>
        }
      >
        {events && (
          <DataTable
            columns={eventColumns}
            data={selectedProduct ? events.filter((e) => e.product_type === selectedProduct) : events}
            pageSize={10}
          />
        )}
      </Panel>
    </div>
  );
}

// --- Event log columns ---
const eventColumns: Column<InventoryEvent>[] = [
  {
    key: "timestamp",
    header: "Time",
    render: (r) => {
      const d = new Date(r.timestamp);
      return (
        <span className="text-xs font-mono text-text-secondary">
          {d.toLocaleDateString()} {d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      );
    },
  },
  { key: "product_type", header: "Product Type" },
  {
    key: "event_type",
    header: "Event",
    render: (r) => (
      <span className={`inline-flex items-center gap-1 text-xs font-medium ${
        r.event_type === "restock" ? "text-success-text" : "text-error-text"
      }`}>
        {r.event_type === "restock" ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
        {r.event_type}
      </span>
    ),
  },
  {
    key: "quantity_delta",
    header: "Qty",
    render: (r) => (
      <span className={`font-mono font-medium ${r.quantity_delta > 0 ? "text-success-text" : "text-error-text"}`}>
        {r.quantity_delta > 0 ? "+" : ""}{r.quantity_delta.toLocaleString()}
      </span>
    ),
  },
  { key: "node_type", header: "Node Type" },
];
