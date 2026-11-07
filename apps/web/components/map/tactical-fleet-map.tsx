"use client";

import React, { useState, useRef } from "react";
import dynamic from "next/dynamic";
import { Shipment } from "@/lib/mock-data";
import { useAppStore } from "@/lib/store";
import type { LiveVessel } from "@/lib/live/types";
import type { LeafletFleetMapHandle } from "./leaflet-fleet-map";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  Compass,
  Ship,
  Plane,
  Truck,
  AlertTriangle,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Crosshair,
  Clock,
  ArrowRight,
  X,
} from "lucide-react";

const LeafletFleetMap = dynamic(
  () => import("./leaflet-fleet-map").then((mod) => mod.LeafletFleetMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[500px] w-full items-center justify-center bg-[#080d14] text-muted-foreground text-xs font-mono">
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span>INITIALIZING FLEET RADAR</span>
        </div>
      </div>
    ),
  }
);

export function TacticalFleetMap({ className }: { className?: string } = {}) {
  const {
    shipments: liveShipments,
    crisisMode,
    simulationTick,
    liveVessels,
    liveStatus,
    liveUpdatedAt,
  } = useAppStore();

  const mapHandleRef = useRef<LeafletFleetMapHandle>(null);

  const marineShipments = liveShipments.filter((s) => s.type === "sea");

  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(
    marineShipments[0] ?? null
  );
  const [selectedLiveVessel, setSelectedLiveVessel] = useState<LiveVessel | null>(null);
  const [showLiveAis, setShowLiveAis] = useState(true);

  const getVesselOptionLabel = (sh: Shipment) => {
    const origin = sh.origin.replace(" Port", "");
    const dest = sh.destination.replace(" Port", "");
    return `${sh.vessel} (${origin} → ${dest})`;
  };

  return (
    <div className={cn("relative w-full overflow-hidden flex flex-col", className)}>
      {/* Top Map Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-1 border-b border-border bg-secondary/60 backdrop-blur px-2 py-1.5 z-10 shrink-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="flex items-center gap-1 text-[10px] font-semibold tracking-tight text-foreground">
            <Compass className="h-3 w-3 text-primary" />
            <span>GEOSPATIAL FLEET RADAR</span>
          </div>
          <Badge variant="outline" className="text-[9px] bg-secondary/80 border-border text-foreground font-mono">
            {marineShipments.length} Tracks
          </Badge>

          <div className="flex items-center gap-1 ml-1">
            <span className="text-[9px] font-mono text-muted-foreground uppercase font-semibold shrink-0">
              Quick Select:
            </span>
            <Select
              value={selectedShipment?.id ?? ""}
              onValueChange={(val) => {
                const target = marineShipments.find((s) => s.id === val);
                if (target) {
                  setSelectedShipment(target);
                  setSelectedLiveVessel(null);
                  mapHandleRef.current?.focusLocation(target.lat, target.lng, 6);
                }
              }}
            >
              <SelectTrigger
                className="h-7 w-full min-w-[180px] sm:min-w-[220px] text-[9px] font-mono bg-secondary/90 border-border text-foreground shadow-none"
                aria-label="Quick Vessel Select"
              >
                <SelectValue placeholder="Quick Vessel Select" />
              </SelectTrigger>
              <SelectContent className="bg-[#0f1722] border-border text-foreground z-[1050]">
                {marineShipments.map((sh) => (
                  <SelectItem
                    key={sh.id}
                    value={sh.id}
                    className="text-xs font-mono py-1.5 cursor-pointer focus:bg-accent focus:text-accent-foreground"
                  >
                    {getVesselOptionLabel(sh)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="outline"
            onClick={() => mapHandleRef.current?.focusQatar()}
            className="h-7 px-2 text-[9px] font-mono border-border bg-secondary/80 hover:bg-secondary text-zinc-200 hover:text-white transition-colors"
            aria-label="Focus Qatar sovereign waters"
          >
            <Crosshair className="h-2.5 w-2.5 mr-1 text-success" />
            Qatar Waters
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => mapHandleRef.current?.fitRoutes()}
            className="h-7 px-2 text-[9px] font-mono border-border bg-secondary/80 hover:bg-secondary text-zinc-200 hover:text-white transition-colors"
            aria-label="Fit all routes"
          >
            <Maximize2 className="h-2.5 w-2.5 mr-1 text-primary" />
            Fit Routes
          </Button>
        </div>
      </div>

      {/* Map Sub-Bar: Data Freshness */}
      <div className="flex flex-wrap items-center justify-between gap-1 border-b border-border bg-[#0f1722]/90 backdrop-blur px-2 py-1 z-10 shrink-0 text-[9px] font-mono">
        <div className="flex flex-wrap items-center gap-1">
          <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary text-[9px] font-mono flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-primary" />
            Tactical Shipping Lanes
          </Badge>

          <button
            onClick={() => setShowLiveAis((visible) => !visible)}
            aria-label="Toggle live AIS layer"
            className={cn(
              "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[9px] font-mono transition-colors shadow-none",
              showLiveAis
                ? "border-success/40 bg-success/15 text-success"
                : "border-border/60 bg-secondary/40 text-muted-foreground"
            )}
          >
            <span className="h-2 w-2 rounded-full" />
            <span>LIVE AIS</span>
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                liveStatus === "live" ? "bg-success" : liveStatus === "degraded" ? "bg-warning" : "bg-muted-foreground"
              )}
            />
            <span className="font-semibold text-foreground">{liveVessels.length}</span>
          </button>

          {crisisMode && (
            <Badge variant="crisis" className="text-[9px] font-mono flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              <span>HORMUZ RESTRICTED</span>
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-1 text-[9px] font-mono text-muted-foreground">
          <Clock className="h-2.5 w-2.5 text-muted-foreground" />
          <span>Live AIS Updated:</span>
          <span className="text-foreground font-semibold">
            {liveUpdatedAt
              ? `${new Date(liveUpdatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })} UTC`
              : "Streaming Live"}
          </span>
        </div>
      </div>

      {/* Main Map View */}
      <div className="relative flex-1 min-h-0 relative overflow-hidden flex bg-[#080d14]">
        <LeafletFleetMap
          ref={mapHandleRef}
          className={cn("h-full w-full", className)}
          shipments={marineShipments}
          selectedShipment={selectedShipment}
          onSelectShipment={(sh) => {
            setSelectedShipment(sh);
            setSelectedLiveVessel(null);
          }}
          liveVessels={liveVessels}
          selectedLiveVessel={selectedLiveVessel}
          onSelectLiveVessel={(vessel) => {
            setSelectedLiveVessel(vessel);
          }}
          showLiveAis={showLiveAis}
          showChokepoints={true}
          crisisMode={crisisMode}
          simulationTick={simulationTick}
        />

        {/* Live AIS contact card */}
        {selectedLiveVessel && (
          <div className="absolute top-2 right-2 z-[1000] max-w-64 w-auto rounded-md border border-primary/40 bg-[#0f1722]/95 backdrop-blur p-2 shadow-none">
            <div className="flex items-start justify-between gap-1 border-b border-border pb-1">
              <div className="min-w-0">
                <p className="text-xs font-bold text-foreground flex items-center gap-1">
                  <span className="h-3 w-3 text-primary" />
                  {selectedLiveVessel.name}
                </p>
                <p className="text-[9px] font-mono text-muted-foreground">
                  MMSI <span className="text-foreground font-semibold">{selectedLiveVessel.mmsi}</span>
                  {selectedLiveVessel.imo ? ` · IMO ${selectedLiveVessel.imo}` : ""}
                </p>
              </div>
              <button
                onClick={() => setSelectedLiveVessel(null)}
                aria-label="Close vessel details"
                className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-secondary transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-1 text-[9px]">
              <div>
                <p className="text-[9px] uppercase font-semibold tracking-wider text-muted-foreground">Position</p>
                <p className="font-mono text-xs font-medium text-foreground">
                  {selectedLiveVessel.lat.toFixed(3)}°, {selectedLiveVessel.lng.toFixed(3)}°
                </p>
              </div>
              <div>
                <p className="text-[9px] uppercase font-semibold tracking-wider text-muted-foreground">Telemetry</p>
                <p className="font-mono text-xs font-medium text-foreground">
                  {selectedLiveVessel.sog.toFixed(1)} kn · {selectedLiveVessel.cog ?? "--"}°
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Floating Zoom Toolbar */}
        <div className="absolute bottom-2 left-2 z-[1000] flex flex-col gap-0.5 bg-[#0f1722]/90 border border-border rounded-md p-0.5 shadow-none backdrop-blur">
          <button
            onClick={() => mapHandleRef.current?.zoomIn()}
            className="p-1 text-muted-foreground hover:text-white hover:bg-secondary rounded transition-colors"
            title="Zoom in"
          >
            <ZoomIn className="h-3 w-3" />
          </button>
          <button
            onClick={() => mapHandleRef.current?.zoomOut()}
            className="p-1 text-muted-foreground hover:text-white hover:bg-secondary rounded transition-colors"
            title="Zoom out"
          >
            <ZoomOut className="h-3 w-3" />
          </button>
          <button
            onClick={() => mapHandleRef.current?.focusQatar()}
            className="p-1 text-success hover:text-success hover:bg-secondary rounded transition-colors"
            title="Focus Qatar waters"
          >
            <Crosshair className="h-3 w-3" />
          </button>
          <button
            onClick={() => mapHandleRef.current?.fitRoutes()}
            className="p-1 text-primary hover:text-primary hover:bg-secondary rounded transition-colors"
            title="Fit routes"
          >
            <Maximize2 className="h-3 w-3" />
          </button>
        </div>

        {/* Tactical Legend */}
        <div className="absolute bottom-2 right-2 z-[1000] flex items-center gap-1.5 bg-[#0f1722]/90 border border-border rounded-md px-2 py-1 text-[9px] font-mono text-muted-foreground backdrop-blur shadow-none">
          <div className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-primary ring-1 ring-primary/40" /> Sea Lane
          </div>
          <div className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-crisis ring-1 ring-crisis/40" /> Rerouted
          </div>
          <div className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-success ring-1 ring-success/40" /> Qatar Port
          </div>
          <div className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-warning ring-1 ring-warning/40" /> Chokepoint
          </div>
        </div>
      </div>

      {/* Selected Shipment Detail Drawer */}
      {selectedShipment && (
        <Card className="border-t border-border bg-card/95 backdrop-blur p-3 flex flex-col gap-2 z-10 shadow-none">
          {/* Vessel header: name + status */}
          <div className="flex items-start gap-3 min-w-0">
            <div
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-sm border",
                selectedShipment.status === "rerouted" || selectedShipment.riskLevel === "critical"
                  ? "bg-crisis/20 border-crisis/40 text-crisis"
                  : "bg-primary/20 border-primary/30 text-primary"
              )}
            >
              <Ship className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0 flex flex-col gap-1">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="text-sm font-bold text-foreground truncate"
                  title={selectedShipment.vessel}
                >
                  {selectedShipment.vessel}
                </span>
                <Badge
                  variant={
                    selectedShipment.status === "rerouted"
                      ? "crisis"
                      : selectedShipment.status === "delayed"
                      ? "warning"
                      : "outline"
                  }
                  className="text-[9px] uppercase font-bold shrink-0"
                >
                  {selectedShipment.status}
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-[9px] text-muted-foreground min-w-0">
                <span className="text-muted-foreground">({selectedShipment.id})</span>
                <span className="text-foreground font-medium truncate min-w-0" title={selectedShipment.origin}>
                  {selectedShipment.origin}
                </span>
                <ArrowRight className="h-2.5 w-2.5 text-muted-foreground shrink-0" />
                <span className="text-foreground font-medium truncate min-w-0" title={selectedShipment.destination}>
                  {selectedShipment.destination}
                </span>
              </div>
            </div>
          </div>

          {/* Route + cargo line */}
          <div className="flex items-start gap-2 min-w-0 border-t border-border/40 pt-2">
            <div className="flex items-center gap-1 text-[9px] text-muted-foreground min-w-0">
              <span className="text-muted-foreground uppercase tracking-wider text-[8px] shrink-0">Cargo</span>
              <span className="text-foreground truncate min-w-0" title={selectedShipment.cargo}>
                {selectedShipment.cargo}
              </span>
              <span className="text-muted-foreground shrink-0">·</span>
              <span className="font-mono shrink-0">{selectedShipment.tonnage.toLocaleString()} t</span>
            </div>
          </div>

          {/* Metadata grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[9px] font-mono">
            <div className="flex flex-col gap-0.5 min-w-0">
              <p className="text-[8px] uppercase font-semibold tracking-wider text-muted-foreground shrink-0">ETA</p>
              <p className="font-bold text-foreground text-xs truncate flex items-center gap-1" title={selectedShipment.eta}>
                <Clock className="h-3 w-3 text-muted-foreground" />
                {selectedShipment.eta}
              </p>
            </div>
            <div className="flex flex-col gap-0.5 min-w-0">
              <p className="text-[8px] uppercase font-semibold tracking-wider text-muted-foreground shrink-0">Speed / Hdg</p>
              <p className="font-bold text-foreground text-xs truncate">
                {selectedShipment.speed.toFixed(1)} kn / {selectedShipment.heading}°
              </p>
            </div>
            <div className="flex flex-col gap-0.5 min-w-0">
              <p className="text-[8px] uppercase font-semibold tracking-wider text-muted-foreground shrink-0">Voyage</p>
              <p className="font-bold text-primary text-xs">{selectedShipment.progress}%</p>
            </div>
            <div className="flex flex-col gap-0.5 min-w-0">
              <p className="text-[8px] uppercase font-semibold tracking-wider text-muted-foreground shrink-0">Risk Level</p>
              <Badge
                variant={
                  selectedShipment.riskLevel === "critical" ? "crisis" : selectedShipment.riskLevel === "high" ? "warning" : "outline"
                }
                className="text-[9px] uppercase font-bold shrink-0"
              >
                {selectedShipment.riskLevel}
              </Badge>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-2 self-end sm:self-start mt-2 border-t border-border/40 pt-2 w-full">
            <Button size="sm" variant="outline" className="text-[9px] h-6 text-foreground font-medium w-full sm:w-auto">
              Inspect Manifest
            </Button>
            <Button size="sm" className="text-[9px] h-6 bg-primary hover:bg-primary/90 text-white font-medium w-full sm:w-auto">
              Optimize Route
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
