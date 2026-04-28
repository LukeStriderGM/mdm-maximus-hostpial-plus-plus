import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getSpokes } from "../lib/api";
import { NodeCard } from "../components/ui/NodeCard";
import { Spinner } from "../components/ui/Spinner";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";

const PAGE_SIZE = 12;

export function SpokesList() {
  const navigate = useNavigate();
  const { data: spokes, isLoading } = useQuery({ queryKey: ["spokes"], queryFn: () => getSpokes() });
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    if (!spokes) return [];
    if (!search) return spokes;
    const q = search.toLowerCase();
    return spokes.filter((s) => s.name.toLowerCase().includes(q) || s.status.toLowerCase().includes(q));
  }, [spokes, search]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const safePage = Math.min(page, Math.max(0, totalPages - 1));
  const paged = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  if (isLoading) return <div className="flex justify-center py-20"><Spinner size={32} /></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Spokes</h2>
        <div className="relative w-64">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-disabled" />
          <input
            type="text" placeholder="Search spokes..." value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="w-full pl-9 pr-3 py-1.5 bg-surface border border-border rounded text-sm text-text placeholder:text-text-disabled focus:border-primary focus:outline-none"
          />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {paged.map((spoke) => (
          <NodeCard
            key={spoke.id} name={spoke.name} type="spoke"
            status={spoke.status as "operational"}
            itemCount={spoke.inventory_count}
            onClick={() => navigate(`/spokes/${spoke.id}`)}
          />
        ))}
        {filtered.length === 0 && <p className="text-text-secondary col-span-3">No spokes found.</p>}
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-xs text-text-secondary">
          <span>{safePage * PAGE_SIZE + 1}–{Math.min((safePage + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}</span>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(safePage - 1)} disabled={safePage === 0}
              className="p-1.5 rounded bg-surface border border-border hover:bg-hover disabled:opacity-30"><ChevronLeft size={14} /></button>
            {Array.from({ length: totalPages }, (_, i) => (
              <button key={i} onClick={() => setPage(i)}
                className={`h-7 min-w-[1.75rem] px-1.5 rounded text-xs border transition-colors ${
                  i === safePage ? "bg-primary/20 border-primary text-primary font-medium" : "bg-surface border-border hover:bg-hover text-text-secondary"
                }`}>{i + 1}</button>
            ))}
            <button onClick={() => setPage(safePage + 1)} disabled={safePage >= totalPages - 1}
              className="p-1.5 rounded bg-surface border border-border hover:bg-hover disabled:opacity-30"><ChevronRight size={14} /></button>
          </div>
        </div>
      )}
    </div>
  );
}
