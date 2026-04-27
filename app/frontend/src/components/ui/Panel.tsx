import { type ReactNode } from "react";

interface PanelProps {
  title?: string;
  actions?: ReactNode;
  children: ReactNode;
  loading?: boolean;
  className?: string;
}

export function Panel({ title, actions, children, loading, className = "" }: PanelProps) {
  return (
    <div className={`bg-card border border-border rounded-md ${className}`}>
      {title && (
        <div className="flex items-center justify-between px-4 py-2 border-b border-border">
          <h3 className="text-sm font-medium text-text-secondary">{title}</h3>
          {actions && <div className="flex gap-2">{actions}</div>}
        </div>
      )}
      <div className="p-4">
        {loading ? (
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-hover rounded w-3/4" />
            <div className="h-4 bg-hover rounded w-1/2" />
            <div className="h-4 bg-hover rounded w-2/3" />
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
