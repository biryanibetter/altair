"use client";

import React, { useEffect, useRef, useImperativeHandle, forwardRef, useState } from "react";
import L from "leaflet";
import type { Shipment, Port } from "@/lib/mock-data";
import { ports } from "@/lib/mock-data";
import type { LiveVessel } from "@/lib/live/types";
import { cn } from "@/lib/utils";

export interface LeafletFleetMapHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  focusQatar: () => void;
  fitRoutes: () => void;
  focusLocation: (lat: number, lng: number, zoom?: number) => void;
}

interface LeafletFleetMapProps {
  shipments: Shipment[];
  selectedShipment: Shipment | null;
  onSelectShipment: (shipment: Shipment) => void;
  liveVessels: LiveVessel[];
  selectedLiveVessel: LiveVessel | null;
  onSelectLiveVessel: (vessel: LiveVessel) => void;
  showLiveAis: boolean;
  showChokepoints: boolean;
  crisisMode: boolean;
  simulationTick: number;
  showLabels?: boolean;
  className?: string;
}

export const LeafletFleetMap = forwardRef<LeafletFleetMapHandle, LeafletFleetMapProps>(
  function LeafletFleetMap(
    {
      shipments,
      selectedShipment,
      onSelectShipment,
      liveVessels,
      selectedLiveVessel,
      onSelectLiveVessel,
      showLiveAis,
      showChokepoints,
      crisisMode,
      simulationTick,
      showLabels = true,
      className,
    },
    ref
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<L.Map | null>(null);
    const [zoomLevel, setZoomLevel] = useState<number>(4);

    // Layer groups
    const routesLayerRef = useRef<L.LayerGroup | null>(null);
    const vesselsLayerRef = useRef<L.LayerGroup | null>(null);
    const liveAisLayerRef = useRef<L.LayerGroup | null>(null);
    const portsLayerRef = useRef<L.LayerGroup | null>(null);
    const chokepointsLayerRef = useRef<L.LayerGroup | null>(null);

    // Expose control methods to parent via ref
    useImperativeHandle(ref, () => ({
      zoomIn: () => {
        mapRef.current?.zoomIn();
      },
      zoomOut: () => {
        mapRef.current?.zoomOut();
      },
      focusQatar: () => {
        if (!mapRef.current) return;
        mapRef.current.flyTo([25.28, 51.53], 9, {
          animate: true,
          duration: 1.2,
        });
      },
      fitRoutes: () => {
        if (!mapRef.current) return;
        const allPoints: [number, number][] = [];
        shipments.forEach((s) => {
          s.route.forEach(([lat, lng]) => allPoints.push([lat, lng]));
        });
        if (allPoints.length > 0) {
          const bounds = L.latLngBounds(allPoints);
          mapRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 6 });
        }
      },
      focusLocation: (lat: number, lng: number, zoom = 6) => {
        if (!mapRef.current) return;
        mapRef.current.flyTo([lat, lng], zoom, {
          animate: true,
          duration: 1.0,
        });
      },
    }));

    // 1. Initialize Leaflet Map once
    useEffect(() => {
      if (!containerRef.current || mapRef.current) return;

      const map = L.map(containerRef.current, {
        center: [23.0, 56.0],
        zoom: 4,
        minZoom: 2,
        maxZoom: 17,
        zoomControl: false,
        attributionControl: false,
        worldCopyJump: true,
      });

      map.on("zoomend", () => {
        setZoomLevel(map.getZoom());
      });

      // OpenStreetMap tiles — free, no API key required
      const basemap = L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
          maxZoom: 19,
          attribution: "&copy; OpenStreetMap contributors",
        }
      );
      basemap.addTo(map);

      // Initialize Layer Groups
      routesLayerRef.current = L.layerGroup().addTo(map);
      portsLayerRef.current = L.layerGroup().addTo(map);
      chokepointsLayerRef.current = L.layerGroup().addTo(map);
      liveAisLayerRef.current = L.layerGroup().addTo(map);
      vesselsLayerRef.current = L.layerGroup().addTo(map);

      mapRef.current = map;

      const handleResize = () => {
        if (!map) return;
        map.invalidateSize();
      };

      // Ensure initial framing + handle container resize
      map.whenReady(() => {
        map.invalidateSize();
        map.setView([23.0, 56.0], 4);
      });

      window.addEventListener("resize", handleResize);
      new ResizeObserver(handleResize).observe(containerRef.current!);

      const timer = setTimeout(() => {
        if (!map) return;
        map.invalidateSize();
        map.setView([23.0, 56.0], 4);
      }, 200);

      return () => {
        clearTimeout(timer);
        window.removeEventListener("resize", handleResize);
        map.remove();
        mapRef.current = null;
      };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // 2. Render Ports
    useEffect(() => {
      if (!portsLayerRef.current) return;
      portsLayerRef.current.clearLayers();

      const maritimePorts = ports.filter((p) => p.type === "sea");

      maritimePorts.forEach((port: Port) => {
        const isQatar = port.country === "Qatar";

        // Outer halo circle for Qatar sovereign ports
        if (isQatar) {
          const halo = L.circleMarker([port.lat, port.lng], {
            radius: 9,
            fillColor: "#5d8a5d",
            fillOpacity: 0.15,
            color: "#5d8a5d",
            weight: 1,
            dashArray: "3 2",
            interactive: false,
          });
          halo.addTo(portsLayerRef.current!);
        }

        const marker = L.circleMarker([port.lat, port.lng], {
          radius: isQatar ? 5 : 3.5,
          fillColor: isQatar ? "#5d8a5d" : "#9aa9ba",
          fillOpacity: 0.95,
          color: "#080d14",
          weight: 1.5,
        });

        marker.bindTooltip(
          `<div class="space-y-1 p-1">
            <p class="font-bold text-xs ${isQatar ? "text-success" : "text-muted-foreground"} flex items-center gap-1">
              <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${isQatar ? "#5d8a5d" : "#9aa9ba"};"></span> ${port.name}
            </p>
            <p class="text-[10px] text-slate-200 font-mono">
              Cap: <span class="text-white font-semibold">${port.throughput.toLocaleString()}</span> / ${port.capacity.toLocaleString()} TEU
            </p>
            <p class="text-[10px] text-slate-300 font-mono flex items-center gap-1">
              Status: <span class="${port.status === "operational" ? "text-success" : "text-warning"} uppercase font-semibold">${port.status}</span>
              · ${port.country}
            </p>
          </div>`,
          {
            direction: "top",
            offset: [0, -8],
            className: "leaflet-tactical-tooltip",
          }
        );

        marker.addTo(portsLayerRef.current!);
      });
    }, []);

    // 3. Render Strategic Chokepoints
    useEffect(() => {
      if (!chokepointsLayerRef.current) return;
      chokepointsLayerRef.current.clearLayers();

      if (!showChokepoints) return;

      // Strait of Hormuz
      const hormuzCoords: [number, number] = [26.5667, 56.25];
      const hormuzColor = crisisMode ? "#b95146" : "#b8862c";
      const hormuzZone = L.circle(hormuzCoords, {
        radius: crisisMode ? 55000 : 40000,
        fillColor: hormuzColor,
        fillOpacity: crisisMode ? 0.2 : 0.1,
        color: hormuzColor,
        weight: crisisMode ? 2 : 1.2,
        dashArray: crisisMode ? "6 3" : "4 2",
      });
      hormuzZone.bindTooltip(
        `<div class="space-y-1 p-1">
          <p class="font-bold text-xs ${crisisMode ? "text-crisis" : "text-warning"} flex items-center gap-1">
            <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${hormuzColor};"></span> Strait of Hormuz ${crisisMode ? "[RESTRICTED / BLOCKED]" : "[Strategic Gateway]"}
          </p>
          <p class="text-[10px] text-slate-200">
            ${crisisMode ? "Transit suspended. Military patrol active." : "Strategic gateway to Qatar sovereign sea lanes."}
          </p>
        </div>`,
        { direction: "top", offset: [0, -10], className: "leaflet-tactical-tooltip" }
      );
      hormuzZone.addTo(chokepointsLayerRef.current);

      // Bab el-Mandeb
      const babCoords: [number, number] = [12.5833, 43.3333];
      const babZone = L.circle(babCoords, {
        radius: 40000,
        fillColor: "#b8862c",
        fillOpacity: 0.1,
        color: "#b8862c",
        weight: 1.2,
        dashArray: "4 2",
      });
      babZone.bindTooltip(
        `<div class="space-y-1 p-1">
          <p class="font-bold text-xs text-warning flex items-center gap-1">
            <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#b8862c;"></span> Bab el-Mandeb Strait
          </p>
          <p class="text-[10px] text-slate-200">Southern Red Sea transit corridor · High security zone</p>
        </div>`,
        { direction: "top", offset: [0, -10], className: "leaflet-tactical-tooltip" }
      );
      babZone.addTo(chokepointsLayerRef.current);

      // Suez Canal
      const suezCoords: [number, number] = [30.4583, 32.35];
      const suezZone = L.circle(suezCoords, {
        radius: 35000,
        fillColor: "#344f6d",
        fillOpacity: 0.1,
        color: "#344f6d",
        weight: 1,
      });
      suezZone.bindTooltip(
        `<div class="space-y-1 p-1">
          <p class="font-bold text-xs text-primary flex items-center gap-1">
            <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#344f6d;"></span> Suez Canal Corridor
          </p>
          <p class="text-[10px] text-slate-200">Mediterranean — Red Sea maritime artery</p>
        </div>`,
        { direction: "top", offset: [0, -10], className: "leaflet-tactical-tooltip" }
      );
      suezZone.addTo(chokepointsLayerRef.current);
    }, [showChokepoints, crisisMode]);

    // 4. Render Shipping Routes (Polylines)
    useEffect(() => {
      if (!routesLayerRef.current) return;
      routesLayerRef.current.clearLayers();

      shipments.forEach((sh) => {
        if (!sh.route || sh.route.length < 2) return;
        const isSelected = selectedShipment?.id === sh.id;
        const isRerouted = sh.status === "rerouted";
        const isCritical = sh.riskLevel === "critical";

        let strokeColor = "#344f6d"; // Slate-blue
        if (isRerouted || isCritical) strokeColor = "#b95146";
        else if (isSelected) strokeColor = "#344f6d";

        // Core path line
        const line = L.polyline(sh.route, {
          color: strokeColor,
          weight: isSelected ? 3.5 : 2.2,
          opacity: isSelected ? 0.95 : 0.75,
          dashArray: isRerouted ? "6 4" : "4 2",
          lineCap: "round",
          lineJoin: "round",
        });

        line.bindTooltip(
          `<div class="space-y-1 p-1">
            <p class="font-bold text-xs text-white flex items-center gap-1.5">
              <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${strokeColor};"></span> ${sh.vessel}
            </p>
            <p class="text-[10px] text-slate-200 font-mono">
              ${sh.origin} → ${sh.destination} · <span class="text-primary font-semibold">${sh.progress}% complete</span>
            </p>
            <p class="text-[10px] text-slate-300">
              Cargo: <span class="text-white font-medium">${sh.cargo}</span> (${sh.tonnage.toLocaleString()} t)
            </p>
          </div>`,
          { sticky: true, className: "leaflet-tactical-tooltip" }
        );

        line.on("click", () => {
          onSelectShipment(sh);
        });

        line.addTo(routesLayerRef.current!);
      });
    }, [shipments, selectedShipment, onSelectShipment]);

    // 5. Render Vessels (Ship Markers)
    useEffect(() => {
      if (!vesselsLayerRef.current) return;
      vesselsLayerRef.current.clearLayers();

      shipments.forEach((sh) => {
        // Slight realistic simulation jitter
        const jitter = Math.sin(simulationTick + sh.lat) * 0.05;
        const pos: [number, number] = [sh.lat + jitter, sh.lng];
        const isSelected = selectedShipment?.id === sh.id;
        const isCritical = sh.riskLevel === "critical" || sh.status === "rerouted";

        const markerColor = isCritical ? "#b95146" : isSelected ? "#344f6d" : "#344f6d";
        const pulseRing = isSelected || isCritical;
        const showPermanentLabel = isSelected || zoomLevel >= 8;

        // Custom HTML DivIcon for military/tactical maritime look
        // Vessel label appears on hover (group-hover) or when selected at zoom < 8,
        // avoiding clutter around Qatar sovereign waters.
        const iconHtml = `
          <div class="relative flex items-center justify-center -translate-x-1/2 -translate-y-1/2 group cursor-pointer" style="width: 32px; height: 32px;">
            ${
              pulseRing
                ? `<div class="absolute inset-0 rounded-full opacity-60" style="background-color: ${markerColor};"></div>`
                : ""
            }
            <div class="relative flex items-center justify-center w-6 h-6 rounded-full border-2 border-[#06080e] shadow-lg transition-transform hover:scale-125 z-10" style="background-color: ${markerColor};">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="transform: rotate(${sh.heading}deg);">
                <polygon points="12 2 19 21 12 17 5 21 12 2" />
              </svg>
            </div>
            <div class="absolute left-8 whitespace-nowrap pointer-events-none rounded px-2 py-0.5 text-[10px] font-bold font-mono uppercase backdrop-blur border shadow-md transition-all duration-150 z-20 ${
              isSelected
                ? "opacity-100 bg-[#0b0d14]/95 text-primary border-primary/60 ring-1 ring-primary/30"
                : showPermanentLabel
                ? "opacity-100 bg-[#06080e]/90 text-slate-200 border-slate-700/60"
                : "opacity-0 group-hover:opacity-100 bg-[#06080e]/90 text-slate-200 border-slate-700/60"
            }">
              ${sh.vessel}
            </div>
          </div>
        `;

        const customIcon = L.divIcon({
          className: "tactical-vessel-icon",
          html: iconHtml,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });

        const marker = L.marker(pos, { icon: customIcon, zIndexOffset: isSelected ? 1000 : 500 });

        marker.bindTooltip(
          `<div class="space-y-1 p-1">
            <div class="flex items-center justify-between gap-2 border-b border-slate-700/60 pb-1">
              <p class="font-bold text-xs text-white flex items-center gap-1.5">
                🚢 ${sh.vessel}
              </p>
              <span class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-800/50 font-semibold">${sh.id}</span>
            </div>
            <p class="text-[10px] text-slate-200 font-mono">
              Speed: <span class="text-white font-semibold">${sh.speed.toFixed(1)} kn</span> · Heading: <span class="text-white font-semibold">${sh.heading}°</span>
            </p>
            <p class="text-[10px] text-slate-200 font-mono">
              Voyage: <span class="text-white font-medium">${sh.origin}</span> → <span class="text-white font-medium">${sh.destination}</span>
            </p>
            <p class="text-[10px] text-slate-300 font-mono">
              Cargo: <span class="text-white">${sh.cargo}</span> (${sh.tonnage.toLocaleString()} t) · ETA: <span class="text-cyan-300 font-semibold">${sh.eta}</span>
            </p>
          </div>`,
          { direction: "top", offset: [0, -18], className: "leaflet-tactical-tooltip" }
        );

        marker.on("click", () => {
          onSelectShipment(sh);
        });

        marker.addTo(vesselsLayerRef.current!);
      });
    }, [shipments, selectedShipment, simulationTick, onSelectShipment, zoomLevel]);

    // 6. Render Live AIS Layer (Real VesselAPI + AISStream contacts)
    useEffect(() => {
      if (!liveAisLayerRef.current) return;
      liveAisLayerRef.current.clearLayers();

      if (!showLiveAis) return;

      liveVessels.forEach((vessel) => {
        const isSelected = selectedLiveVessel?.mmsi === vessel.mmsi;
        const color = vessel.moving ? "#344f6d" : "#9aa9ba";

        // Outer ring for selected live contact
        if (isSelected) {
          const halo = L.circleMarker([vessel.lat, vessel.lng], {
            radius: 8,
            fillColor: "#344f6d",
            fillOpacity: 0.2,
            color: "#344f6d",
            weight: 1.5,
            dashArray: "2 2",
            interactive: false,
          });
          halo.addTo(liveAisLayerRef.current!);
        }

        const marker = L.circleMarker([vessel.lat, vessel.lng], {
          radius: isSelected ? 4.5 : vessel.moving ? 3.5 : 2.5,
          fillColor: color,
          fillOpacity: 0.9,
          color: "#04121a",
          weight: 1,
        });

        marker.bindTooltip(
          `<div class="space-y-1 p-1">
            <p class="font-bold text-xs text-primary flex items-center gap-1.5">
              <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};"></span> ${vessel.name}
            </p>
            <p class="text-[10px] text-slate-200 font-mono">
              MMSI: <span class="text-white font-semibold">${vessel.mmsi}</span> · Speed: <span class="text-white font-semibold">${vessel.sog.toFixed(1)} kn</span> · Hdg: <span class="text-white font-semibold">${vessel.cog ?? "--"}°</span>
            </p>
            <p class="text-[10px] text-slate-200 font-mono">
              Status: <span class="text-white">${vessel.navStatusLabel}</span> · Zone: <span class="text-white">${vessel.zone}</span>
            </p>
            <p class="text-[10px] text-slate-400 font-mono">
              Feed: <span class="text-primary uppercase font-semibold">${vessel.source.toUpperCase()}</span>
            </p>
          </div>`,
          { direction: "top", offset: [0, -8], className: "leaflet-tactical-tooltip" }
        );

        marker.on("click", () => {
          onSelectLiveVessel(vessel);
        });

        marker.addTo(liveAisLayerRef.current!);
      });
    }, [liveVessels, selectedLiveVessel, showLiveAis, onSelectLiveVessel]);

    return (
      <div
        ref={containerRef}
        className={cn("w-full h-full flex-1 z-0 outline-none", className)}
        style={{ minHeight: "320px" }}
      />
    );
  }
);
