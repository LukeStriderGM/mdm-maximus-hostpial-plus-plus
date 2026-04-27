import { useWebSocket } from "../../hooks/useWebSocket";
import { Wifi, WifiOff } from "lucide-react";

export function TopBar() {
  const { connected } = useWebSocket();

  return (
    <header className="h-12 bg-surface border-b border-border flex items-center justify-between px-4 shrink-0">
      <div className="flex items-center gap-3">
        <h1 className="text-sm font-semibold text-text">Hospital++</h1>
        <span className="text-xs text-text-disabled">Medical Logistics Decision Support</span>
      </div>
      <div className="flex items-center gap-2 text-xs">
        {connected ? (
          <span className="flex items-center gap-1 text-success-text"><Wifi size={12} /> Live</span>
        ) : (
          <span className="flex items-center gap-1 text-text-disabled"><WifiOff size={12} /> Offline</span>
        )}
      </div>
    </header>
  );
}
