import { useState, useMemo } from "react";
import { Search, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from "lucide-react";

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  sortable?: boolean;
}

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (row: T) => void;
  searchable?: boolean;
  pageSize?: number;
  pageSizeSelector?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function DataTable<T extends Record<string, any>>({
  columns, data, onRowClick, searchable = true, pageSize: defaultPageSize = 20, pageSizeSelector = true,
}: DataTableProps<T>) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(defaultPageSize);

  const filtered = useMemo(() => {
    if (!search) return data;
    const q = search.toLowerCase();
    return data.filter((row) =>
      columns.some((col) => String(row[col.key] ?? "").toLowerCase().includes(q))
    );
  }, [data, search, columns]);

  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    return [...filtered].sort((a, b) => {
      const av = a[sortKey] ?? "", bv = b[sortKey] ?? "";
      const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.ceil(sorted.length / pageSize);
  const safePage = Math.min(page, Math.max(0, totalPages - 1));
  const paged = sorted.slice(safePage * pageSize, (safePage + 1) * pageSize);
  const rangeStart = sorted.length === 0 ? 0 : safePage * pageSize + 1;
  const rangeEnd = Math.min((safePage + 1) * pageSize, sorted.length);

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  const handlePageSizeChange = (newSize: number) => {
    const firstRow = safePage * pageSize;
    setPageSize(newSize);
    setPage(Math.floor(firstRow / newSize));
  };

  // Build page number buttons with ellipsis
  const pageButtons = useMemo(() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i);
    const pages: (number | "ellipsis-l" | "ellipsis-r")[] = [0];
    if (safePage > 2) pages.push("ellipsis-l");
    const start = Math.max(1, safePage - 1);
    const end = Math.min(totalPages - 2, safePage + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (safePage < totalPages - 3) pages.push("ellipsis-r");
    if (totalPages > 1) pages.push(totalPages - 1);
    return pages;
  }, [totalPages, safePage]);

  const btnBase = "h-7 min-w-[1.75rem] px-1.5 rounded text-xs border border-border transition-colors disabled:opacity-30 disabled:cursor-not-allowed";
  const btnIdle = `${btnBase} bg-surface hover:bg-hover text-text-secondary`;
  const btnActive = `${btnBase} bg-primary/20 border-primary text-primary font-medium`;

  return (
    <div>
      {searchable && (
        <div className="relative mb-3">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-disabled" />
          <input
            type="text" placeholder="Search..." value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="w-full pl-9 pr-3 py-2 bg-surface border border-border rounded text-sm text-text placeholder:text-text-disabled focus:border-primary focus:outline-none"
          />
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface">
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => col.sortable !== false && handleSort(col.key)}
                  className="px-3 py-2 text-left text-xs uppercase text-text-secondary font-medium cursor-pointer hover:text-text select-none"
                >
                  {col.header}
                  {sortKey === col.key && (
                    <span className="ml-1">{sortDir === "asc" ? "▲" : "▼"}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.map((row, i) => (
              <tr
                key={i}
                onClick={() => onRowClick?.(row)}
                className={`border-b border-border hover:bg-hover ${onRowClick ? "cursor-pointer" : ""}`}
              >
                {columns.map((col) => (
                  <td key={col.key} className="px-3 py-2 text-text">
                    {col.render ? col.render(row) : String(row[col.key] ?? "")}
                  </td>
                ))}
              </tr>
            ))}
            {paged.length === 0 && (
              <tr><td colSpan={columns.length} className="px-3 py-8 text-center text-text-disabled">No data</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination bar */}
      {(sorted.length > 0) && (
        <div className="flex items-center justify-between mt-3 gap-4">
          {/* Left: row count + page size selector */}
          <div className="flex items-center gap-3 text-xs text-text-secondary">
            <span>{rangeStart}–{rangeEnd} of {sorted.length}</span>
            {pageSizeSelector && sorted.length > PAGE_SIZE_OPTIONS[0] && (
              <select
                value={pageSize}
                onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                className="bg-surface border border-border rounded px-1.5 py-1 text-xs text-text focus:border-primary focus:outline-none"
              >
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <option key={n} value={n}>{n} / page</option>
                ))}
              </select>
            )}
          </div>

          {/* Right: page navigation */}
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(0)} disabled={safePage === 0} className={btnIdle} title="First page">
                <ChevronsLeft size={14} />
              </button>
              <button onClick={() => setPage(safePage - 1)} disabled={safePage === 0} className={btnIdle} title="Previous page">
                <ChevronLeft size={14} />
              </button>
              {pageButtons.map((p, i) =>
                typeof p === "string" ? (
                  <span key={p + i} className="px-1 text-xs text-text-disabled select-none">...</span>
                ) : (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={p === safePage ? btnActive : btnIdle}
                  >
                    {p + 1}
                  </button>
                )
              )}
              <button onClick={() => setPage(safePage + 1)} disabled={safePage >= totalPages - 1} className={btnIdle} title="Next page">
                <ChevronRight size={14} />
              </button>
              <button onClick={() => setPage(totalPages - 1)} disabled={safePage >= totalPages - 1} className={btnIdle} title="Last page">
                <ChevronsRight size={14} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
