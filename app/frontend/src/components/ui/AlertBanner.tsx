import { AlertTriangle, X } from "lucide-react";

interface AlertBannerProps {
  message: string;
  onDismiss?: () => void;
}

export function AlertBanner({ message, onDismiss }: AlertBannerProps) {
  return (
    <div className="bg-error/10 border border-error/30 text-error-text px-4 py-3 rounded-md flex items-center gap-3">
      <AlertTriangle size={16} />
      <span className="flex-1 text-sm">{message}</span>
      {onDismiss && (
        <button onClick={onDismiss} className="hover:text-text"><X size={14} /></button>
      )}
    </div>
  );
}
