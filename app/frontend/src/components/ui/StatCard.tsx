import { ArrowUp, ArrowDown } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  trend?: "up" | "down";
  trendValue?: string;
  status?: "success" | "warning" | "error" | "default";
}

const statusColors = {
  success: "border-t-success",
  warning: "border-t-warning",
  error: "border-t-error",
  default: "border-t-primary",
};

export function StatCard({ label, value, trend, trendValue, status = "default" }: StatCardProps) {
  return (
    <div className={`bg-card border border-border rounded-md p-4 border-t-2 ${statusColors[status]}`}>
      <p className="text-xs text-text-secondary uppercase tracking-wider mb-1">{label}</p>
      <p className="text-2xl font-mono font-bold text-text">{value}</p>
      {trend && (
        <div className={`flex items-center gap-1 mt-1 text-xs ${trend === "up" ? "text-success-text" : "text-error-text"}`}>
          {trend === "up" ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
          <span>{trendValue}</span>
        </div>
      )}
    </div>
  );
}
