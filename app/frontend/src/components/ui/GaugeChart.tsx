import { useRef, useEffect } from "react";

interface GaugeChartProps {
  value: number; // 0-100
  label: string;
  maxLabel?: string;
}

export function GaugeChart({ value, label, maxLabel = "days" }: GaugeChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const clamped = Math.min(100, Math.max(0, value));
  const color = clamped > 66 ? "#1a7f4b" : clamped > 33 ? "#ff9900" : "#d10e5c";

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const w = 120;
    const h = 70;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h - 4;
    const outer = 50;
    const inner = 35;

    // Background arc
    ctx.beginPath();
    ctx.arc(cx, cy, outer, Math.PI, 0);
    ctx.arc(cx, cy, inner, 0, Math.PI, true);
    ctx.closePath();
    ctx.fillStyle = "#22252b";
    ctx.fill();

    // Value arc
    const endAngle = Math.PI + (clamped / 100) * Math.PI;
    ctx.beginPath();
    ctx.arc(cx, cy, outer, Math.PI, endAngle);
    ctx.arc(cx, cy, inner, endAngle, Math.PI, true);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }, [clamped, color]);

  return (
    <div className="flex flex-col items-center">
      <canvas ref={canvasRef} />
      <p className="text-lg font-mono font-bold text-text -mt-2">{Math.round(clamped)}</p>
      <p className="text-xs text-text-secondary">{label} {maxLabel}</p>
    </div>
  );
}
