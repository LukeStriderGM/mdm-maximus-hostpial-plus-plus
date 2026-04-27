import { useState } from "react";
import { NavLink } from "react-router-dom";
import { Globe, LayoutDashboard, Building2, RadioTower, Upload, PanelLeftOpen, PanelLeftClose } from "lucide-react";

const navItems = [
  { to: "/", icon: Globe, label: "Map" },
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/hubs", icon: Building2, label: "Hubs" },
  { to: "/spokes", icon: RadioTower, label: "Spokes" },
  { to: "/upload", icon: Upload, label: "Upload" },
];

export function Sidebar() {
  const [expanded, setExpanded] = useState(false);

  return (
    <aside className={`${expanded ? "w-48" : "w-14"} bg-surface border-r border-border flex flex-col transition-all duration-200 overflow-hidden shrink-0`}>
      <div className="h-12 flex items-center justify-between px-4 border-b border-border">
        {expanded && <span className="text-sm font-bold text-primary-text whitespace-nowrap">H++</span>}
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-text-secondary hover:text-text transition-colors shrink-0"
        >
          {expanded ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
        </button>
      </div>
      <nav className="flex-1 py-2">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to} to={to} end={to === "/"}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-2.5 text-sm transition-colors whitespace-nowrap ${
                isActive
                  ? "text-text bg-hover border-l-2 border-primary"
                  : "text-text-secondary hover:text-text hover:bg-hover border-l-2 border-transparent"
              }`
            }
          >
            <Icon size={18} className="shrink-0" />
            {expanded && <span className="transition-opacity">{label}</span>}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
