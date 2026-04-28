import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { getHubs, getSpokes, type Hub, type Spoke, type PathResult } from "../lib/api";
import { BestPathPanel } from "../components/BestPathPanel";

class Toggle3DControl implements maplibregl.IControl {
  private container: HTMLDivElement | null = null;
  private button: HTMLButtonElement | null = null;
  private _is3D = false;
  private _onClick: (is3D: boolean) => void;

  constructor(onClick: (is3D: boolean) => void) {
    this._onClick = onClick;
  }

  onAdd() {
    this.container = document.createElement("div");
    this.container.className = "maplibregl-ctrl maplibregl-ctrl-group";

    this.button = document.createElement("button");
    this.button.type = "button";
    this.button.title = "Toggle 3D globe";
    this.button.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:#d6d7d9;margin:auto;display:block;"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>`;
    this.button.style.cssText = "width:29px;height:29px;display:flex;align-items:center;justify-content:center;cursor:pointer;";

    this.button.addEventListener("click", () => {
      this._is3D = !this._is3D;
      this._onClick(this._is3D);
      this.updateIcon();
    });

    this.container.appendChild(this.button);
    return this.container;
  }

  updateIcon() {
    if (!this.button) return;
    if (this._is3D) {
      // Map icon for "back to 2D"
      this.button.title = "Switch to 2D";
      this.button.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:#d6d7d9;margin:auto;display:block;"><path d="m3 11 19-9-9 19-2-8Z"/><path d="M11 13 6 6"/></svg>`;
    } else {
      // Globe icon for "switch to 3D"
      this.button.title = "Toggle 3D globe";
      this.button.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:#d6d7d9;margin:auto;display:block;"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>`;
    }
  }

  onRemove() {
    this.container?.remove();
    this.container = null;
  }
}

const STATUS_COLORS: Record<string, string> = {
  operational: "#1a7f4b",
  degraded: "#ff9900",
  critical: "#d10e5c",
  offline: "#6e7177",
};

const TERRAIN_SOURCE = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";

export function MapView() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const pathMarkersRef = useRef<maplibregl.Marker[]>([]);
  const navigate = useNavigate();
  const [mapLoaded, setMapLoaded] = useState(false);
  const [showPathPanel, setShowPathPanel] = useState(false);
  const [routeDestination, setRouteDestination] = useState<{ id: string; type: string } | null>(null);

  const { data: hubs } = useQuery({ queryKey: ["hubs"], queryFn: getHubs });
  const { data: spokes } = useQuery({ queryKey: ["spokes"], queryFn: () => getSpokes() });

  // Show best-path on map
  const handleShowPath = useCallback((result: PathResult) => {
    const map = mapRef.current;
    if (!map) return;

    // Clear old path markers
    pathMarkersRef.current.forEach((m) => m.remove());
    pathMarkersRef.current = [];

    // Build GeoJSON for the path
    const lineFeatures = result.steps.map((step, i) => ({
      type: "Feature" as const,
      geometry: {
        type: "LineString" as const,
        coordinates: [
          [step.from_lng, step.from_lat],
          [step.to_lng, step.to_lat],
        ],
      },
      properties: { index: i },
    }));

    // Waypoint circle markers at each intermediate node
    const allCoords: [number, number][] = [];
    if (result.steps.length > 0) {
      allCoords.push([result.steps[0].from_lng, result.steps[0].from_lat]);
    }
    result.steps.forEach((s) => {
      allCoords.push([s.to_lng, s.to_lat]);
    });

    // Add/update best-path source
    const geojson = { type: "FeatureCollection" as const, features: lineFeatures };
    if (map.getSource("best-path")) {
      (map.getSource("best-path") as maplibregl.GeoJSONSource).setData(geojson);
    } else {
      map.addSource("best-path", { type: "geojson", data: geojson });
      // Glow layer
      map.addLayer({
        id: "best-path-glow",
        type: "line",
        source: "best-path",
        paint: {
          "line-color": "#6c63ff",
          "line-width": 8,
          "line-opacity": 0.25,
          "line-blur": 4,
        },
      });
      // Main line
      map.addLayer({
        id: "best-path-line",
        type: "line",
        source: "best-path",
        paint: {
          "line-color": "#6c63ff",
          "line-width": 3,
          "line-opacity": 0.9,
          "line-dasharray": [2, 1],
        },
      });
    }

    // Add waypoint pips
    allCoords.forEach((coord, i) => {
      const el = document.createElement("div");
      const isEndpoint = i === 0 || i === allCoords.length - 1;
      el.style.cssText = `
        width: ${isEndpoint ? 12 : 8}px;
        height: ${isEndpoint ? 12 : 8}px;
        border-radius: 50%;
        background: ${i === 0 ? "#22c55e" : i === allCoords.length - 1 ? "#6c63ff" : "#a78bfa"};
        border: 2px solid white;
        box-shadow: 0 0 6px rgba(108,99,255,0.6);
      `;
      const m = new maplibregl.Marker({ element: el })
        .setLngLat(coord)
        .addTo(map);
      pathMarkersRef.current.push(m);
    });

    // Fit bounds
    if (allCoords.length >= 2) {
      const bounds = new maplibregl.LngLatBounds(allCoords[0], allCoords[0]);
      allCoords.forEach((c) => bounds.extend(c));
      map.fitBounds(bounds, { padding: 80, duration: 1000 });
    }
  }, []);

  const clearPath = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    pathMarkersRef.current.forEach((m) => m.remove());
    pathMarkersRef.current = [];
    if (map.getSource("best-path")) {
      (map.getSource("best-path") as maplibregl.GeoJSONSource).setData({
        type: "FeatureCollection", features: [],
      });
    }
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
      center: [130, 15], // USINDOPACOM AOR
      zoom: 4,
      pitch: 0,
      bearing: 0,
      maxPitch: 85,
    });

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
    map.addControl(new maplibregl.FullscreenControl(), "top-right");
    map.addControl(new Toggle3DControl((is3D) => {
      if (is3D) {
        map.setProjection({ type: "globe" });
        map.setTerrain({ source: "terrain-dem", exaggeration: 1.5 });
        map.easeTo({ pitch: 0, bearing: 0, zoom: Math.min(map.getZoom(), 2.5), center: [130, 30], duration: 1000 });
      } else {
        map.setTerrain(undefined as any);
        map.setProjection({ type: "mercator" });
        map.easeTo({ pitch: 0, bearing: 0, duration: 1000 });
      }
    }), "top-right");

    map.on("load", () => {
      // Add terrain DEM source (AWS Terrain Tiles — Terrarium encoding)
      map.addSource("terrain-dem", {
        type: "raster-dem",
        tiles: [TERRAIN_SOURCE],
        tileSize: 256,
        encoding: "terrarium",
        maxzoom: 15,
      });

      // Add hillshade layer for visual depth even in 2D
      map.addSource("hillshade-source", {
        type: "raster-dem",
        tiles: [TERRAIN_SOURCE],
        tileSize: 256,
        encoding: "terrarium",
        maxzoom: 15,
      });
      map.addLayer({
        id: "hillshade",
        type: "hillshade",
        source: "hillshade-source",
        paint: {
          "hillshade-shadow-color": "#000000",
          "hillshade-highlight-color": "#222222",
          "hillshade-accent-color": "#111111",
          "hillshade-illumination-anchor": "viewport",
          "hillshade-exaggeration": 0.3,
        },
      });

      setMapLoaded(true);
    });

    mapRef.current = map;
    return () => {
      pathMarkersRef.current.forEach((m) => m.remove());
      pathMarkersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Add markers when data loads
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;

    // Clear existing markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    // Hub markers
    hubs?.forEach((hub: Hub) => {
      const el = document.createElement("div");
      el.className = "hub-marker";
      el.style.cssText = `
        width: 32px; height: 32px; border-radius: 50%; cursor: pointer;
        background: ${STATUS_COLORS[hub.status] || STATUS_COLORS.offline};
        border: 3px solid white; display: flex; align-items: center; justify-content: center;
        font-size: 14px; box-shadow: 0 2px 8px rgba(0,0,0,0.4);
      `;
      el.innerHTML = "🏥";

      const popup = new maplibregl.Popup({ offset: 20, closeButton: false, closeOnClick: false })
        .setHTML(`
          <div style="background:#22252b;color:#d6d7d9;padding:8px 12px;border-radius:6px;min-width:160px;font-family:Inter,sans-serif;">
            <div style="font-weight:600;font-size:13px;margin-bottom:4px;">${hub.name}</div>
            <div style="font-size:11px;color:#8c8f94;">Hub &bull; ${hub.status}</div>
            <div style="font-size:11px;color:#8c8f94;margin-top:2px;">Capacity: ${hub.capacity || "N/A"}</div>
            <div style="font-size:11px;color:#8c8f94;margin-top:2px;">${hub.inventory_count || 0} items &bull; ${hub.spoke_count || 0} spokes</div>
          </div>
        `);

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([hub.longitude, hub.latitude])
        .addTo(mapRef.current!);

      el.addEventListener("mouseenter", () => popup.setLngLat([hub.longitude, hub.latitude]).addTo(mapRef.current!));
      el.addEventListener("mouseleave", () => popup.remove());
      el.addEventListener("click", () => navigate(`/hubs/${hub.id}`));
      markersRef.current.push(marker);
    });

    // Spoke markers
    spokes?.forEach((spoke: Spoke) => {
      const el = document.createElement("div");
      el.style.cssText = `
        width: 16px; height: 16px; border-radius: 50%; cursor: pointer;
        background: ${STATUS_COLORS[spoke.status] || STATUS_COLORS.offline};
        border: 2px solid white; box-shadow: 0 1px 4px rgba(0,0,0,0.3);
      `;

      const hubName = hubs ? hubs.find((h) => h.id === spoke.hub_id)?.name : null;
      const popup = new maplibregl.Popup({ offset: 12, closeButton: false, closeOnClick: false })
        .setHTML(`
          <div style="background:#22252b;color:#d6d7d9;padding:8px 12px;border-radius:6px;min-width:140px;font-family:Inter,sans-serif;">
            <div style="font-weight:600;font-size:13px;margin-bottom:4px;">${spoke.name}</div>
            <div style="font-size:11px;color:#8c8f94;">Spoke &bull; ${spoke.status}</div>
            ${hubName ? `<div style="font-size:11px;color:#8c8f94;margin-top:2px;">Hub: ${hubName}</div>` : ""}
            <div style="font-size:11px;color:#8c8f94;margin-top:2px;">${spoke.inventory_count || 0} items</div>
          </div>
        `);

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([spoke.longitude, spoke.latitude])
        .addTo(mapRef.current!);

      el.addEventListener("mouseenter", () => popup.setLngLat([spoke.longitude, spoke.latitude]).addTo(mapRef.current!));
      el.addEventListener("mouseleave", () => popup.remove());
      el.addEventListener("click", () => navigate(`/spokes/${spoke.id}`));
      el.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        setRouteDestination({ id: spoke.id, type: "spoke" });
        setShowPathPanel(true);
      });
      markersRef.current.push(marker);
    });

    // Draw route lines between hubs and spokes
    if (hubs && spokes) {
      const hubMap = new Map(hubs.map((h) => [h.id, h]));
      const features = spokes
        .filter((s) => hubMap.has(s.hub_id))
        .map((s) => ({
          type: "Feature" as const,
          geometry: {
            type: "LineString" as const,
            coordinates: [
              [hubMap.get(s.hub_id)!.longitude, hubMap.get(s.hub_id)!.latitude],
              [s.longitude, s.latitude],
            ],
          },
          properties: { status: s.status },
        }));

      if (mapRef.current.getSource("routes")) {
        (mapRef.current.getSource("routes") as maplibregl.GeoJSONSource).setData({
          type: "FeatureCollection", features,
        });
      } else {
        mapRef.current.addSource("routes", {
          type: "geojson",
          data: { type: "FeatureCollection", features },
        });
        mapRef.current.addLayer({
          id: "route-lines",
          type: "line",
          source: "routes",
          paint: {
            "line-color": ["match", ["get", "status"],
              "operational", "#1a7f4b",
              "degraded", "#ff9900",
              "offline", "#d10e5c",
              "#5f6268",
            ],
            "line-width": 1.5,
            "line-dasharray": [4, 4],
            "line-opacity": 0.6,
          },
        });
      }
    }
  }, [hubs, spokes, mapLoaded, navigate]);

  return (
    <div className="relative w-[calc(100%+2rem)] h-[calc(100%+2rem)] -m-4">
      <div ref={mapContainer} className="w-full h-full" />

      {/* Best Path Panel */}
      {showPathPanel && (
        <BestPathPanel
          onClose={() => { setShowPathPanel(false); clearPath(); setRouteDestination(null); }}
          onShowPath={handleShowPath}
          prefillDestination={routeDestination}
        />
      )}

      {/* Bottom bar: Legend left, Best Path button right */}
      <div className="absolute bottom-6 left-20 right-6 z-[1000] flex items-center justify-between pointer-events-none">
        <div className="bg-card/90 border border-border rounded-md px-3 py-2 text-xs backdrop-blur-sm pointer-events-auto">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-success inline-block" /> Operational</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-warning inline-block" /> Degraded</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-error inline-block" /> Critical</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-border-strong inline-block" /> Offline</span>
          </div>
        </div>
        {!showPathPanel && (
          <button
            onClick={() => setShowPathPanel(true)}
            className="flex items-center gap-1.5 bg-card border border-border rounded-md px-3 py-2 text-xs font-medium text-text-primary shadow-lg hover:bg-hover transition-colors pointer-events-auto ml-3 shrink-0"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/>
            </svg>
            Find Best Path
          </button>
        )}
      </div>
    </div>
  );
}
