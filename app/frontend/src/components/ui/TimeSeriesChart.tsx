import { useMemo, useCallback } from "react";
import uPlot from "uplot";
import { useUPlot } from "../../hooks/useUPlot";

interface Series {
  key: string;
  color: string;
  label: string;
}

interface TimeSeriesChartProps {
  data: Record<string, unknown>[];
  series: Series[];
  xKey?: string;
  height?: number;
}

function toColumnar(
  rows: Record<string, unknown>[],
  xKey: string,
  series: Series[],
): uPlot.AlignedData {
  // Sort rows by x value ascending
  const sorted = [...rows].sort((a, b) => {
    const ax = String(a[xKey] ?? "");
    const bx = String(b[xKey] ?? "");
    return ax.localeCompare(bx);
  });

  // X axis: convert date strings to unix timestamps, or use index
  const xs = new Float64Array(sorted.length);
  sorted.forEach((row, i) => {
    const raw = row[xKey];
    if (typeof raw === "string" && raw.includes("-")) {
      xs[i] = new Date(raw).getTime() / 1000;
    } else {
      xs[i] = i;
    }
  });

  const columns: uPlot.AlignedData = [xs];
  for (const s of series) {
    const col = new Float64Array(sorted.length);
    sorted.forEach((row, i) => {
      col[i] = Number(row[s.key] ?? 0);
    });
    columns.push(col);
  }

  return columns;
}

export function TimeSeriesChart({
  data,
  series,
  xKey = "timestamp",
  height = 250,
}: TimeSeriesChartProps) {
  const aligned = useMemo(() => toColumnar(data, xKey, series), [data, xKey, series]);

  const opts = useCallback(
    (): uPlot.Options => ({
      width: 400, // overridden by hook
      height,
      cursor: {
        drag: { x: true, y: false },
      },
      axes: [
        {
          stroke: "#8c8f94",
          grid: { stroke: "#2c2f35", width: 1 },
          ticks: { stroke: "#2c2f35", width: 1 },
          font: "11px Inter, system-ui, sans-serif",
          gap: 8,
          values: (_u, vals) =>
            vals.map((v) => {
              const d = new Date(v * 1000);
              return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
            }),
        },
        {
          stroke: "#8c8f94",
          grid: { stroke: "#2c2f35", width: 1 },
          ticks: { stroke: "#2c2f35", width: 1 },
          font: "11px Inter, system-ui, sans-serif",
          gap: 4,
        },
      ],
      series: [
        {}, // x-axis placeholder
        ...series.map((s) => ({
          label: s.label,
          stroke: s.color,
          width: 2,
          points: { show: false },
        })),
      ],
    }),
    [height, series],
  );

  const containerRef = useUPlot(opts, aligned);

  return <div ref={containerRef} />;
}
