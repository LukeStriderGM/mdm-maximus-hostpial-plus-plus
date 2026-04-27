interface StatusBadgeProps {
  status: "operational" | "degraded" | "critical" | "offline" | "available" | "denied" | "healthy" | "warning" | "caution";
  label?: string;
}

const styles: Record<string, string> = {
  operational: "bg-success/20 text-success-text",
  available: "bg-success/20 text-success-text",
  healthy: "bg-success/20 text-success-text",
  degraded: "bg-warning/20 text-warning-text",
  warning: "bg-warning/20 text-warning-text",
  caution: "bg-warning/20 text-warning-text",
  critical: "bg-error/20 text-error-text",
  denied: "bg-error/20 text-error-text",
  offline: "bg-border-strong/20 text-text-disabled",
};

export function StatusBadge({ status, label }: StatusBadgeProps) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${styles[status] || styles.offline}`}>
      {label || status}
    </span>
  );
}
