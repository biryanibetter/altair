"use client";

import React, { useState } from "react";
import { useAppStore } from "@/lib/store";
import { Shipment, shipments as baseShipments } from "@/lib/mock-data";
import { TacticalFleetMap } from "@/components/map/tactical-fleet-map";
import { LiveAisPanel } from "@/components/live/live-ais-panel";
import { refreshLiveFleet } from "@/lib/live/use-live-fleet";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  Ship,
  Search,
  Filter,
  ArrowUpDown,
  Navigation,
  Clock,
  AlertTriangle,
  CheckCircle2,
  FileText,
  ExternalLink,
  ShieldCheck,
  Compass,
  RotateCw,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function TrackingPage() {
  const { shipments, crisisMode, simulationTick, liveVessels, liveStatus } = useAppStore();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedShipmentModal, setSelectedShipmentModal] = useState<Shipment | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshLiveFleet(true);
    } catch {
      // live status is surfaced in the AIS panel
    } finally {
      setRefreshing(false);
    }
  };

  // Strictly marine vessels only
  const marineShipments = shipments.filter((s) => s.type === "sea");

  const filteredShipments = marineShipments.filter((s) => {
    const matchesSearch =
      s.vessel.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.cargo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.origin.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.destination.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === "all" || s.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl md:text-2xl font-black tracking-tight text-foreground uppercase">
              Real-Time Sovereign Fleet Telemetry
            </h1>
            <Badge variant="outline" className="border-sky-500/40 text-sky-400 font-mono text-[9px]">
              {liveStatus === "live" ? `LIVE AIS · ${liveVessels.length} CONTACTS` : "AIS · ADS-B · GPS"}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Sovereign maritime fleet telemetry across Qatar deep-water sea lanes, Hormuz transit corridors, and international trade routes
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="text-[9px] h-7"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RotateCw className={cn("h-3 w-3 mr-1 text-muted-foreground", refreshing && "animate-spin")} />
            {refreshing ? "Syncing" : "Refresh Telemetry"}
          </Button>
          <Button size="sm" className="bg-primary hover:bg-primary/90 text-white text-[9px] h-7">
            <FileText className="h-3 w-3 mr-1" />
            Export AIS Manifest
          </Button>
        </div>
      </div>

      {/* Live AIS contacts from VesselAPI + AISStream, enriched by DataDocked */}
      <LiveAisPanel />

      {/* Embedded High-Density Map Component */}
      <TacticalFleetMap />

      {/* Shipments Manifest & Fleet Telemetry Table */}
      <Card className="bg-card/80 border-border/60">
        <CardHeader className="p-3 pb-2">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
            <div>
              <CardTitle className="text-sm font-bold uppercase tracking-wider">
                Active Maritime Fleet Roster ({filteredShipments.length})
              </CardTitle>
              <CardDescription className="text-[9px]">
                Real-time vessel speed, heading, voyage progress, and risk classification
              </CardDescription>
            </div>

            {/* Table Filters & Search */}
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge
                variant="outline"
                className="border-sky-500/40 bg-sky-500/10 text-sky-300 text-[10px] font-mono flex items-center gap-1 mr-1"
              >
                <Ship className="h-3 w-3" />
                Marine Only
              </Badge>

              <div className="relative">
                <Search className="h-3 w-3 absolute left-2.5 top-2.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Filter vessel, cargo, port..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-7 pr-2.5 py-1.5 rounded-md border border-border/60 bg-secondary/40 text-[10px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary w-48"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-2 py-1.5 rounded-md border border-border/60 bg-secondary/40 text-[10px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="all">All Statuses</option>
                <option value="in-transit">In-Transit</option>
                <option value="delayed">Delayed</option>
                <option value="rerouted">Rerouted</option>
                <option value="at-risk">At-Risk</option>
                <option value="arrived">Arrived</option>
              </select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-border/40">
                <TableHead className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider">Vessel / Carrier</TableHead>
                <TableHead className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider">Mode</TableHead>
                <TableHead className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider">Route (Origin → Dest)</TableHead>
                <TableHead className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider">Cargo Manifest</TableHead>
                <TableHead className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider">Telemetry (Spd / Hdg)</TableHead>
                <TableHead className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider">Progress</TableHead>
                <TableHead className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider">ETA</TableHead>
                <TableHead className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider">Risk</TableHead>
                <TableHead className="text-right text-[9px] font-medium text-muted-foreground uppercase tracking-wider">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredShipments.map((s) => (
                <TableRow
                  key={s.id}
                  className="border-border/30 hover:bg-secondary/40 cursor-pointer transition-colors"
                  onClick={() => setSelectedShipmentModal(s)}
                >
                  <TableCell className="font-semibold text-[10px]">
                    <div className="flex items-center gap-2">
                      <div className="p-1 rounded bg-blue-950/60 text-blue-400">
                        <Ship className="h-3 w-3" />
                      </div>
                      <div>
                        <p className="text-foreground">{s.vessel}</p>
                        <p className="text-[9px] text-muted-foreground font-mono">{s.id}</p>
                      </div>
                    </div>
                  </TableCell>

                  <TableCell className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                    <span className="inline-flex items-center gap-1 text-[9px] text-sky-400 font-mono">
                      <Ship className="h-2.5 w-2.5" />
                      Maritime
                    </span>
                  </TableCell>

                  <TableCell className="text-[10px]">
                    <span className="text-foreground font-medium">{s.origin}</span>
                    <span className="text-muted-foreground mx-1">→</span>
                    <span className="text-foreground font-medium">{s.destination}</span>
                  </TableCell>

                  <TableCell className="text-[10px]">
                    <p className="text-foreground">{s.cargo}</p>
                    <p className="text-[9px] text-muted-foreground">{s.tonnage.toLocaleString()} MT</p>
                  </TableCell>

                  <TableCell className="text-[10px] font-mono">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Navigation className="h-3 w-3 text-primary" style={{ transform: `rotate(${s.heading}deg)` }} />
                      <span>{s.speed} {s.type === "air" ? "km/h" : "kts"} · {s.heading}°</span>
                    </div>
                  </TableCell>

                  <TableCell className="text-[10px]">
                    <div className="flex items-center gap-1.5">
                      <div className="w-12 bg-secondary rounded-full h-1 overflow-hidden">
                        <div className="bg-primary h-full rounded-full" style={{ width: `${s.progress}%` }} />
                      </div>
                      <span className="text-[9px] font-mono">{s.progress}%</span>
                    </div>
                  </TableCell>

                  <TableCell className="text-[10px] font-medium text-muted-foreground">
                    {s.eta}
                  </TableCell>

                  <TableCell>
                    <Badge
                      variant={
                        s.status === "rerouted"
                          ? "crisis"
                          : s.riskLevel === "critical"
                          ? "destructive"
                          : s.riskLevel === "high"
                          ? "warning"
                          : "success"
                      }
                      className="text-[8px] uppercase font-bold"
                    >
                      {s.status === "rerouted" ? "REROUTED" : s.riskLevel}
                    </Badge>
                  </TableCell>

                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 text-[9px] hover:bg-secondary text-primary"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedShipmentModal(s);
                      }}
                    >
                      Inspect
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Inspection Modal */}
      {selectedShipmentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <Card className="w-full max-w-lg bg-card border-border shadow-none">
            <CardHeader className="p-3 border-b border-border/50 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold tracking-tight flex items-center gap-2">
                  <span>Shipment Inspection: {selectedShipmentModal.vessel}</span>
                  <Badge variant="outline">{selectedShipmentModal.id}</Badge>
                </CardTitle>
                <CardDescription className="text-[9px]">
                  Full sovereign security & telemetry manifest
                </CardDescription>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0"
                onClick={() => setSelectedShipmentModal(null)}
              >
                <X className="h-3 w-3" />
              </Button>
            </CardHeader>
            <CardContent className="p-3 space-y-3 text-[10px]">
              <div className="grid grid-cols-2 gap-2 p-2 rounded-md bg-secondary/40 border border-border/30">
                <div>
                  <span className="text-muted-foreground uppercase tracking-wider">Cargo Type</span>
                  <p className="font-semibold text-foreground">{selectedShipmentModal.cargo}</p>
                </div>
                <div>
                  <span className="text-muted-foreground uppercase tracking-wider">Declared Weight</span>
                  <p className="font-semibold text-foreground">{selectedShipmentModal.tonnage.toLocaleString()} Metric Tonnes</p>
                </div>
                <div>
                  <span className="text-muted-foreground uppercase tracking-wider">Origin Port</span>
                  <p className="font-semibold text-foreground">{selectedShipmentModal.origin}</p>
                </div>
                <div>
                  <span className="text-muted-foreground uppercase tracking-wider">Target Discharge</span>
                  <p className="font-semibold text-foreground">{selectedShipmentModal.destination}</p>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-muted-foreground uppercase tracking-wider text-[8px]">
                  Coordinates & Telemetry
                </span>
                <p className="font-mono text-muted-foreground">
                  Lat: {selectedShipmentModal.lat.toFixed(4)}° N, Lng: {selectedShipmentModal.lng.toFixed(4)}° E
                </p>
                <p className="font-mono text-muted-foreground">
                  Speed: {selectedShipmentModal.speed} {selectedShipmentModal.type === "air" ? "km/h" : "knots"} | Heading: {selectedShipmentModal.heading}° True North
                </p>
              </div>

              <div className="border-t border-border/40 pt-2 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-emerald-400">
                  <ShieldCheck className="h-3 w-3" />
                  <span className="text-[9px] font-medium">Customs & Security Cleared</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button size="sm" variant="outline" className="text-[9px] h-6" onClick={() => setSelectedShipmentModal(null)}>
                    Close
                  </Button>
                  <Button size="sm" className="bg-primary hover:bg-primary/90 text-white text-[9px] h-6">
                    Reroute Vessel
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}