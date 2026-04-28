import { useWebSocket } from "../../hooks/useWebSocket";
import { Wifi, WifiOff, Search } from "lucide-react";

interface TopBarProps {
  onOpenPalette: () => void;
}

const isMac = navigator.platform.toUpperCase().includes("MAC");

export function TopBar({ onOpenPalette }: TopBarProps) {
  const { connected } = useWebSocket();

  return (
    <header className="h-12 bg-surface border-b border-border flex items-center justify-between px-4 shrink-0">
      <h1 className="text-sm font-semibold text-text">Hospital++</h1>

      <button
        onClick={onOpenPalette}
        className="flex items-center gap-2 px-3 py-1.5 bg-surface border border-border rounded-md text-xs text-text-disabled hover:border-border-med hover:text-text-secondary transition-colors cursor-pointer w-72"
      >
        <Search size={14} />
        <span>Search or jump to...</span>
        <kbd className="ml-auto px-1.5 py-0.5 bg-elevated rounded text-[10px] font-mono">
          {isMac ? "⌘K" : "Ctrl+K"}
        </kbd>
      </button>

      <div className="flex items-center gap-3 text-xs">
        {connected ? (
          <span className="flex items-center gap-1 text-success-text"><Wifi size={12} /> Live</span>
        ) : (
          <span className="flex items-center gap-1 text-text-disabled"><WifiOff size={12} /> Offline</span>
        )}
      </div>
    </header>
  );
}
