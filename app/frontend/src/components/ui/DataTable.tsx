import { useState, useMemo } from "react";
import { Search } from "lucide-react";

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  sortable?: boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (row: T) => void;
  searchable?: boolean;
  pageSize?: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function DataTable<T extends Record<string, any>>({
  columns, data, onRowClick, searchable = true, pageSize = 20,
}: DataTableProps<T>) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(0);

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
  const paged = sorted.slice(page * pageSize, (page + 1) * pageSize);

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

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
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-3 text-xs text-text-secondary">
          <span>Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, sorted.length)} of {sorted.length}</span>
          <div className="flex gap-1">
            <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0}
              className="px-2 py-1 rounded bg-surface border border-border hover:bg-hover disabled:opacity-50">Prev</button>
            <button onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1}
              className="px-2 py-1 rounded bg-surface border border-border hover:bg-hover disabled:opacity-50">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
