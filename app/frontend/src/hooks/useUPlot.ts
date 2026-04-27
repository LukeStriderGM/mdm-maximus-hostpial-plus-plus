import { useEffect, useRef } from "react";
import uPlot from "uplot";

export function useUPlot(
  opts: () => uPlot.Options,
  data: uPlot.AlignedData,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<uPlot | null>(null);

  // Create / recreate when opts factory identity changes
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const o = opts();
    o.width = el.clientWidth;
    chartRef.current = new uPlot(o, data, el);

    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect;
      if (cr && chartRef.current) {
        chartRef.current.setSize({ width: cr.width, height: o.height ?? 250 });
      }
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      chartRef.current?.destroy();
      chartRef.current = null;
    };
    // opts is a factory fn — intentionally depend on its identity
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts]);

  // Hot-swap data without recreating the chart
  useEffect(() => {
    if (chartRef.current) {
      chartRef.current.setData(data);
    }
  }, [data]);

  return containerRef;
}
