import { useMemo, useCallback } from "react";
import uPlot from "uplot";
import { useUPlot } from "../../hooks/useUPlot";

interface BarChartProps {
  data: Record<string, unknown>[];
  xKey: string;
  bars: { key: string; color: string; label: string }[];
  height?: number;
}

export function BarChart({ data, xKey, bars, height = 250 }: BarChartProps) {
  const labels = useMemo(() => data.map((d) => String(d[xKey] ?? "")), [data, xKey]);

  const aligned = useMemo((): uPlot.AlignedData => {
    const xs = new Float64Array(data.length);
    data.forEach((_, i) => { xs[i] = i; });

    const cols: uPlot.AlignedData = [xs];
    for (const b of bars) {
      const col = new Float64Array(data.length);
      data.forEach((row, i) => { col[i] = Number(row[b.key] ?? 0); });
      cols.push(col);
    }
    return cols;
  }, [data, bars]);

  const opts = useCallback((): uPlot.Options => {
    const groupCount = bars.length;
    const barWidth = 0.6 / groupCount;

    function barPaths(groupIdx: number): uPlot.Series.PathBuilder {
      return (u, seriesIdx, idx0, idx1) => {
        const barBuilder = uPlot.paths.bars!({
          size: [barWidth, 100],
          align: groupIdx === 0 ? -1 : 1,
          radius: 2,
        });
        return barBuilder(u, seriesIdx, idx0, idx1);
      };
    }

    return {
      width: 400,
      height,
      cursor: { show: false },
      legend: { show: true },
      axes: [
        {
          stroke: "#8c8f94",
          grid: { show: false },
          ticks: { stroke: "#2c2f35", width: 1 },
          font: "11px Inter, system-ui, sans-serif",
          gap: 8,
          values: (_u, vals) => vals.map((v) => labels[Math.round(v)] ?? ""),
          space: 60,
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
        {},
        ...bars.map((b, i) => ({
          label: b.label,
          fill: b.color,
          stroke: b.color,
          width: 0,
          paths: barPaths(i),
          points: { show: false },
        })),
      ],
      scales: {
        x: {
          time: false,
          range: (_u: uPlot, min: number, max: number) =>
            [min - 0.5, max + 0.5] as uPlot.Range.MinMax,
        },
      },
    };
  }, [bars, height, labels]);

  const containerRef = useUPlot(opts, aligned);

  return <div ref={containerRef} />;
}
