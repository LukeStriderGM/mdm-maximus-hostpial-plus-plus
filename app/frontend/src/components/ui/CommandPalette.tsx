import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getHubs, getSpokes, type Hub, type Spoke } from "../../lib/api";
import { StatusBadge } from "./StatusBadge";
import {
  Search,
  Building2,
  RadioTower,
  Globe,
  LayoutDashboard,
  Network,
  Activity,
  BarChart3,
  BrainCircuit,
  Upload,
} from "lucide-react";

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

interface RecentNode {
  id: string;
  type: "hub" | "spoke";
  name: string;
}

type ResultItem =
  | { kind: "hub"; hub: Hub }
  | { kind: "spoke"; spoke: Spoke }
  | { kind: "page"; label: string; path: string; icon: React.ReactNode };

const STORAGE_KEY = "h++:recent-nodes";

const pages: { label: string; path: string; icon: React.ReactNode }[] = [
  { label: "Map", path: "/", icon: <Globe className="w-4 h-4" /> },
  { label: "Network", path: "/dashboard", icon: <LayoutDashboard className="w-4 h-4" /> },
  { label: "Topology", path: "/topology", icon: <Network className="w-4 h-4" /> },
  { label: "Inventory", path: "/inventory", icon: <Activity className="w-4 h-4" /> },
  { label: "Supply/Demand", path: "/supply-demand", icon: <BarChart3 className="w-4 h-4" /> },
  { label: "Explainability", path: "/explainability", icon: <BrainCircuit className="w-4 h-4" /> },
  { label: "Hubs", path: "/hubs", icon: <Building2 className="w-4 h-4" /> },
  { label: "Spokes", path: "/spokes", icon: <RadioTower className="w-4 h-4" /> },
  { label: "Upload", path: "/upload", icon: <Upload className="w-4 h-4" /> },
];

function loadRecent(): RecentNode[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveRecent(node: RecentNode) {
  const prev = loadRecent().filter((n) => !(n.id === node.id && n.type === node.type));
  const next = [node, ...prev].slice(0, 5);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const { data: hubs } = useQuery({ queryKey: ["hubs"], queryFn: getHubs, enabled: open });
  const { data: spokes } = useQuery({ queryKey: ["spokes"], queryFn: () => getSpokes(), enabled: open });

  // Auto-focus input when opened
  useEffect(() => {
    if (open) {
      setQuery("");
      setHighlightedIndex(0);
      // Small delay to ensure the DOM is rendered
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const filtered = useMemo((): ResultItem[] => {
    const q = query.toLowerCase().trim();
    const results: ResultItem[] = [];

    if (!q) {
      // Show recent nodes + all pages
      const recent = loadRecent();
      for (const r of recent) {
        if (r.type === "hub") {
          const hub = hubs?.find((h) => h.id === r.id);
          if (hub) results.push({ kind: "hub", hub });
        } else {
          const spoke = spokes?.find((s) => s.id === r.id);
          if (spoke) results.push({ kind: "spoke", spoke });
        }
      }
      for (const p of pages) {
        results.push({ kind: "page", ...p });
      }
      return results;
    }

    // Filter hubs
    if (hubs) {
      for (const hub of hubs) {
        if (hub.name.toLowerCase().includes(q)) {
          results.push({ kind: "hub", hub });
        }
      }
    }
    // Filter spokes
    if (spokes) {
      for (const spoke of spokes) {
        if (spoke.name.toLowerCase().includes(q)) {
          results.push({ kind: "spoke", spoke });
        }
      }
    }
    // Filter pages
    for (const p of pages) {
      if (p.label.toLowerCase().includes(q)) {
        results.push({ kind: "page", ...p });
      }
    }

    return results;
  }, [query, hubs, spokes]);

  // Reset highlighted index when results change
  useEffect(() => {
    setHighlightedIndex(0);
  }, [filtered.length]);

  const selectItem = useCallback(
    (item: ResultItem) => {
      if (item.kind === "hub") {
        saveRecent({ id: item.hub.id, type: "hub", name: item.hub.name });
        navigate(`/hubs/${item.hub.id}`);
      } else if (item.kind === "spoke") {
        saveRecent({ id: item.spoke.id, type: "spoke", name: item.spoke.name });
        navigate(`/spokes/${item.spoke.id}`);
      } else {
        navigate(item.path);
      }
      onClose();
    },
    [navigate, onClose],
  );

  // Keyboard handling
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightedIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (filtered[highlightedIndex]) {
          selectItem(filtered[highlightedIndex]);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose, filtered, highlightedIndex, selectItem]);

  // Scroll highlighted into view
  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector(`[data-index="${highlightedIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [highlightedIndex]);

  if (!open) return null;

  // Group results by category for rendering
  const hubResults = filtered.filter((r): r is ResultItem & { kind: "hub" } => r.kind === "hub");
  const spokeResults = filtered.filter((r): r is ResultItem & { kind: "spoke" } => r.kind === "spoke");
  const pageResults = filtered.filter((r): r is ResultItem & { kind: "page" } => r.kind === "page");

  // Build flat render list with category headers for index mapping
  let flatIndex = 0;
  const buildIndexMap = (items: ResultItem[]): number[] => items.map(() => flatIndex++);
  const hubIndices = buildIndexMap(hubResults);
  const spokeIndices = buildIndexMap(spokeResults);
  const pageIndices = buildIndexMap(pageResults);

  const noResults = query && filtered.length === 0;
  const recentLabel = !query.trim() && (hubResults.length > 0 || spokeResults.length > 0);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center pt-[15vh]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-card border border-border rounded-lg shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <Search className="w-4 h-4 text-text-disabled shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm text-text placeholder:text-text-disabled outline-none"
            placeholder="Search nodes, pages..."
          />
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-80 overflow-y-auto">
          {noResults && (
            <div className="px-4 py-8 text-center text-sm text-text-disabled">
              No results for &ldquo;{query}&rdquo;
            </div>
          )}

          {/* Hubs */}
          {hubResults.length > 0 && (
            <>
              <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-text-disabled font-semibold bg-surface">
                {recentLabel ? "Recent" : "Hubs"}
              </div>
              {hubResults.map((item, i) => (
                <div
                  key={item.hub.id}
                  data-index={hubIndices[i]}
                  onClick={() => selectItem(item)}
                  className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${
                    highlightedIndex === hubIndices[i] ? "bg-hover" : "hover:bg-hover"
                  }`}
                >
                  <Building2 className="w-4 h-4 text-text-disabled shrink-0" />
                  <span className="text-sm text-text flex-1 truncate">{item.hub.name}</span>
                  <StatusBadge status={item.hub.status as any} />
                  <span className="text-xs text-text-disabled">⏎</span>
                </div>
              ))}
            </>
          )}

          {/* Spokes */}
          {spokeResults.length > 0 && (
            <>
              {!recentLabel && (
                <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-text-disabled font-semibold bg-surface">
                  Spokes
                </div>
              )}
              {spokeResults.map((item, i) => (
                <div
                  key={item.spoke.id}
                  data-index={spokeIndices[i]}
                  onClick={() => selectItem(item)}
                  className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${
                    highlightedIndex === spokeIndices[i] ? "bg-hover" : "hover:bg-hover"
                  }`}
                >
                  <RadioTower className="w-4 h-4 text-text-disabled shrink-0" />
                  <span className="text-sm text-text flex-1 truncate">{item.spoke.name}</span>
                  <StatusBadge status={item.spoke.status as any} />
                  <span className="text-xs text-text-disabled">⏎</span>
                </div>
              ))}
            </>
          )}

          {/* Pages */}
          {pageResults.length > 0 && (
            <>
              <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-text-disabled font-semibold bg-surface">
                Pages
              </div>
              {pageResults.map((item, i) => (
                <div
                  key={item.path}
                  data-index={pageIndices[i]}
                  onClick={() => selectItem(item)}
                  className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${
                    highlightedIndex === pageIndices[i] ? "bg-hover" : "hover:bg-hover"
                  }`}
                >
                  <span className="text-text-disabled shrink-0">{item.icon}</span>
                  <span className="text-sm text-text flex-1">{item.label}</span>
                  <span className="text-xs text-text-disabled">⏎</span>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-border flex items-center gap-4 text-[10px] text-text-disabled">
          <span>↑↓ navigate</span>
          <span>⏎ select</span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  );
}
