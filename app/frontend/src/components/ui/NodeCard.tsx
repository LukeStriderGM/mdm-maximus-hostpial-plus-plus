import { StatusBadge } from "./StatusBadge";
import { Building2, RadioTower } from "lucide-react";

interface NodeCardProps {
  name: string;
  type: "hub" | "spoke";
  status: "operational" | "degraded" | "critical" | "offline";
  itemCount?: number;
  criticalCount?: number;
  onClick?: () => void;
}

export function NodeCard({ name, type, status, itemCount, criticalCount, onClick }: NodeCardProps) {
  return (
    <div
      onClick={onClick}
      className="bg-card border border-border rounded-md p-3 hover:border-primary cursor-pointer transition-colors"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {type === "hub" ? <Building2 size={14} className="text-primary-text" /> : <RadioTower size={14} className="text-text-secondary" />}
          <span className="font-medium text-sm text-text">{name}</span>
        </div>
        <StatusBadge status={status} />
      </div>
      <div className="flex gap-4 text-xs text-text-secondary">
        {itemCount !== undefined && <span>{itemCount} items</span>}
        {criticalCount !== undefined && criticalCount > 0 && (
          <span className="text-error-text">{criticalCount} critical</span>
        )}
      </div>
    </div>
  );
}
