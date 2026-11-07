"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useAppStore } from "@/lib/store";
import type { LiveVessel, SourceState, VesselIntel } from "@/lib/live/types";
import { refreshLiveFleet } from "@/lib/live/use-live-fleet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  Activity,
  Anchor,
  Database,
  Gauge,
  Loader2,
  MapPin,
  Navigation,
  Radio,
  RefreshCw,
  Ship,
  X,
} from "lucide-react";

const STATUS_DOT: Record<SourceState["status"], string> = {
  live: "bg-emerald-400",
  degraded: "bg-amber-400",
  standby: "bg-sky-400",
  offline: "bg-zinc-600",
};

const STATUS_TEXT: Record<SourceState["status"], string> = {
  live: "text-emerald-400",
  degraded: "text-amber-400",
  standby: "text-sky-400",
  offline: "text-muted-foreground",
};

function SourceChip({ label, state }: { label: string; state?: SourceState }) {
  const status = state?.status ?? "offline";
  return (
    <span
      title={state?.detail || label}
      className="inline-flex items-center gap-1 rounded border border-border/60 bg-secondary/40 px-1.5 py-0.5 text-[8px] font-mono tracking-wider text-muted-foreground"
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT[status])} />
      {label}
      <span className={cn("uppercase", STATUS_TEXT[status])}>{status}</span>
    </span>
  );
}

function utcTime(iso: string | null): string {
  if (!iso) return "--:--:--";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "--:--:--";
  return `${date.toISOString().slice(11, 19)}Z`;
}

function ageSeconds(iso: string | null): number | null {
  if (!iso) return null;
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return null;
  return Math.max(0, Math.round((Date.now() - parsed) / 1000));
}

export function LiveAisPanel() {
  const { liveVessels, liveUpdatedAt, liveSources, liveStatus, liveLastError } = useAppStore();
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<LiveVessel | null>(null);

  const underway = liveVessels.filter((vessel) => vessel.moving).length;
  const stationary = liveVessels.length - underway;
  const zones = useMemo(
    () => new Set(liveVessels.map((vessel) => vessel.zone)).size,
    [liveVessels]
  );
  const age = ageSeconds(liveUpdatedAt);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshLiveFleet(true);
    } catch {
      // store already carries the offline state
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <Card className="bg-card/80 border-border/60">
      <CardHeader className="p-3 pb-2">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
          <div>
            <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
              <Radio className="h-3.5 w-3.5 text-sky-400" />
              Live AIS Contacts — Qatar Approaches
              <Badge variant="outline" className="text-[8px] font-mono border-sky-500/40 text-sky-400">
                {liveVessels.length} TRACKED
              </Badge>
            </CardTitle>
            <CardDescription className="text-[9px]">
              Real AIS positions from VesselAPI · {underway} underway · {stationary} stationary ·{" "}
              {zones} port zones · synced {utcTime(liveUpdatedAt)}
              {age !== null && age > 60 ? ` (${Math.round(age / 60)}m stale)` : ""}
            </CardDescription>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <SourceChip label="VESSELAPI" state={liveSources?.vesselApi} />
            <SourceChip label="AISSTREAM" state={liveSources?.aisStream} />
            <SourceChip label="DATADOCKED" state={liveSources?.dataDocked} />
            <Button
              size="sm"
              variant="outline"
              onClick={handleRefresh}
              disabled={refreshing}
              className="h-6 text-[9px] gap-1"
            >
              <RefreshCw className={cn("h-2.5 w-2.5", refreshing && "animate-spin")} />
              {refreshing ? "SYNCING" : "REFRESH"}
            </Button>
          </div>
        </div>

        {liveStatus === "offline" && (
          <p className="text-[9px] text-crisis pt-1">
            Live feed offline{liveLastError ? ` — ${liveLastError}` : ""}. Showing last known snapshot.
          </p>
        )}
        {liveStatus === "degraded" && (
          <p className="text-[9px] text-amber-400 pt-1">
            Feed degraded{liveLastError ? ` — ${liveLastError}` : ""}. Retrying with backoff.
          </p>
        )}
      </CardHeader>

      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="border-border/40">
              <TableHead className="text-[9px] py-1.5">Vessel</TableHead>
              <TableHead className="text-[9px] py-1.5">Zone</TableHead>
              <TableHead className="text-[9px] py-1.5">Position</TableHead>
              <TableHead className="text-[9px] py-1.5">Speed / Course</TableHead>
              <TableHead className="text-[9px] py-1.5">Status</TableHead>
              <TableHead className="text-[9px] py-1.5">AIS Age</TableHead>
              <TableHead className="text-right text-[9px] py-1.5">Intel</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {liveVessels.slice(0, 14).map((vessel) => {
              const vesselAge = ageSeconds(vessel.timestamp);
              return (
                <TableRow
                  key={vessel.mmsi}
                  className="border-border/30 hover:bg-secondary/40 cursor-pointer"
                  onClick={() => setSelected(vessel)}
                >
                  <TableCell className="py-1.5">
                    <div className="flex items-center gap-1.5">
                      <Ship
                        className={cn(
                          "h-3 w-3 shrink-0",
                          vessel.moving ? "text-sky-400" : "text-muted-foreground"
                        )}
                      />
                      <div>
                        <p className="text-[10px] font-semibold text-foreground leading-tight">
                          {vessel.name}
                        </p>
                        <p className="text-[8px] font-mono text-muted-foreground">
                          MMSI {vessel.mmsi}
                          {vessel.imo ? ` · IMO ${vessel.imo}` : ""}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="py-1.5">
                    <span className="text-[9px] text-muted-foreground">{vessel.zone}</span>
                  </TableCell>
                  <TableCell className="py-1.5">
                    <span className="font-mono text-[9px] text-muted-foreground">
                      {vessel.lat.toFixed(3)}°, {vessel.lng.toFixed(3)}°
                    </span>
                  </TableCell>
                  <TableCell className="py-1.5">
                    <div className="flex items-center gap-1 font-mono text-[9px] text-foreground">
                      <Navigation
                        className="h-2.5 w-2.5 text-sky-400"
                        style={{ transform: `rotate(${vessel.cog ?? 0}deg)` }}
                      />
                      {vessel.sog.toFixed(1)} kn
                      <span className="text-muted-foreground">
                        · {vessel.cog !== null ? `${vessel.cog.toFixed(0)}°` : "--"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="py-1.5">
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[8px] font-semibold uppercase",
                        vessel.moving
                          ? "border-emerald-500/40 text-emerald-400"
                          : "border-amber-500/40 text-amber-400"
                      )}
                    >
                      {vessel.navStatusLabel}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-1.5">
                    <span className="font-mono text-[9px] text-muted-foreground">
                      {vesselAge === null ? "--" : vesselAge < 60 ? `${vesselAge}s` : `${Math.round(vesselAge / 60)}m`}
                    </span>
                  </TableCell>
                  <TableCell className="py-1.5 text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-5 text-[9px] text-primary hover:bg-secondary px-1.5"
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelected(vessel);
                      }}
                    >
                      Inspect
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        {liveVessels.length === 0 && (
          <div className="px-3 py-6 text-center">
            <p className="text-[10px] text-muted-foreground">
              No live contacts returned for the Qatar search box.
            </p>
            <p className="text-[9px] text-muted-foreground/70 mt-1">
              The AISStream firehose currently reports no receivers covering the Gulf; VesselAPI
              terrestrial coverage is the primary feed.
            </p>
          </div>
        )}

        {liveVessels.length > 14 && (
          <p className="px-3 py-1.5 text-[8px] font-mono text-muted-foreground border-t border-border/30">
            Showing 14 of {liveVessels.length} live contacts · sorted by speed
          </p>
        )}
      </CardContent>

      {selected && (
        <VesselIntelModal
          key={selected.mmsi}
          vessel={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </Card>
  );
}

function LoadingRow() {
  return (
    <div className="flex items-center gap-2 text-[10px] text-muted-foreground py-6 justify-center">
      <Loader2 className="h-3 w-3 animate-spin" />
      Querying DataDocked + VesselAPI…
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div>
      <p className="text-[8px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-[10px] font-medium text-foreground truncate">
        {value === null || value === undefined || value === "" ? "—" : value}
      </p>
    </div>
  );
}

function formatCoordinates(lat?: number | null, lng?: number | null): string {
  if (typeof lat !== "number" || typeof lng !== "number") return "—";
  const latHemisphere = lat >= 0 ? "N" : "S";
  const lngHemisphere = lng >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(4)}° ${latHemisphere}, ${Math.abs(lng).toFixed(4)}° ${lngHemisphere}`;
}

function VesselIntelModal({ vessel, onClose }: { vessel: LiveVessel; onClose: () => void }) {
  const [intel, setIntel] = useState<VesselIntel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    fetch(`/api/vessel/${vessel.mmsi}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Intel request failed (${response.status})`);
        return (await response.json()) as VesselIntel;
      })
      .then((data) => {
        setIntel(data);
        setLoading(false);
      })
      .catch((err: Error) => {
        if (err.name === "AbortError") return;
        setError(err.message);
        setLoading(false);
      });

    return () => controller.abort();
  }, [vessel.mmsi, reloadKey]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  const identity = intel?.identity;
  const dimensions = intel?.dimensions;
  const voyage = intel?.voyage;
  const management = intel?.management;
  const position = intel?.position;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Vessel intelligence for ${vessel.name}`}
    >
      <Card
        className="w-full max-w-2xl bg-card border-border shadow-none max-h-[90vh] overflow-y-auto"
        onClick={(event) => event.stopPropagation()}
      >
        <CardHeader className="p-3 border-b border-border/50 flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="text-sm font-bold tracking-tight flex items-center gap-2">
              <Ship className="h-3.5 w-3.5 text-sky-400" />
              {identity?.name || vessel.name}
              <Badge variant="outline" className="text-[8px] font-mono">
                MMSI {vessel.mmsi}
              </Badge>
              {identity?.imo && (
                <Badge variant="outline" className="text-[8px] font-mono">
                  IMO {identity.imo}
                </Badge>
              )}
            </CardTitle>
            <CardDescription className="text-[9px] flex items-center gap-2 pt-0.5">
              <span>{vessel.zone}</span>
              <span className="text-muted-foreground/60">·</span>
              <span className="font-mono">{vessel.navStatusLabel}</span>
              <span className="text-muted-foreground/60">·</span>
              <span className="font-mono">{utcTime(vessel.timestamp)}</span>
            </CardDescription>
          </div>
          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={onClose}>
            <X className="h-3 w-3" />
          </Button>
        </CardHeader>

        <CardContent className="p-3 space-y-3 text-[10px]">
          {loading && <LoadingRow />}

          {error && !loading && (
            <div className="flex items-center justify-between gap-2 rounded-md border border-crisis/40 bg-crisis/10 px-2 py-1.5">
              <span className="text-[9px] text-crisis">Could not load vessel intel: {error}</span>
              <Button
                size="sm"
                variant="outline"
                className="h-5 text-[8px]"
                onClick={() => {
                  setLoading(true);
                  setError(null);
                  setReloadKey((key) => key + 1);
                }}
              >
                Retry
              </Button>
            </div>
          )}

          {!loading && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 rounded-md bg-secondary/40 border border-border/30 p-2">
                <Field label="Flag" value={identity?.flag} />
                <Field label="Type" value={identity?.typeSpecific || identity?.type} />
                <Field label="Built" value={identity?.yearBuilt} />
                <Field label="Call sign" value={identity?.callsign} />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-2 rounded-md bg-secondary/40 border border-border/30 p-2">
                <Field label="LOA" value={dimensions?.length} />
                <Field label="Beam" value={dimensions?.beam} />
                <Field label="Draught" value={dimensions?.draught} />
                <Field label="Gross tonnage" value={dimensions?.grossTonnage} />
                <Field label="Deadweight" value={dimensions?.deadweight} />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 rounded-md bg-secondary/40 border border-border/30 p-2">
                <Field label="Destination" value={voyage?.destination || voyage?.destinationUnlocode} />
                <Field label="ETA (UTC)" value={voyage?.eta} />
                <Field label="Last port" value={voyage?.lastPort || voyage?.lastPortUnlocode} />
                <Field label="Departed" value={voyage?.departure} />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 rounded-md bg-secondary/40 border border-border/30 p-2">
                <Field label="Manager" value={management?.manager} />
                <Field label="Registered owner" value={management?.owner} />
                <Field label="ISM" value={management?.ism} />
                <Field label="P&I club" value={management?.piClub} />
              </div>

              <div className="rounded-md border border-border/30 p-2 space-y-1">
                <div className="flex items-center gap-1.5 text-[8px] uppercase tracking-wider text-muted-foreground">
                  <MapPin className="h-2.5 w-2.5 text-emerald-400" />
                  Last reported position
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <Field label="Coordinates" value={formatCoordinates(position?.lat ?? vessel.lat, position?.lng ?? vessel.lng)} />
                  <Field
                    label="Speed"
                    value={`${(position?.speed ?? vessel.sog).toFixed(1)} kn`}
                  />
                  <Field
                    label="Course / heading"
                    value={`${position?.course ?? vessel.cog ?? "—"}° / ${position?.heading ?? vessel.heading ?? "—"}°`}
                  />
                  <Field label="AIS source" value={position?.dataSource || vessel.source.toUpperCase()} />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/40 pt-2">
                <div className="flex flex-wrap items-center gap-2 text-[8px] font-mono text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Database className="h-2.5 w-2.5" />
                    DATADOCKED
                    <span className={STATUS_TEXT[intel?.sources.dataDocked.status ?? "offline"]}>
                      {intel?.sources.dataDocked.status ?? "offline"}
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Activity className="h-2.5 w-2.5" />
                    VESSELAPI
                    <span className={STATUS_TEXT[intel?.sources.vesselApi.status ?? "offline"]}>
                      {intel?.sources.vesselApi.status ?? "offline"}
                    </span>
                  </span>
                  <span>fetched {utcTime(intel?.fetchedAt ?? null)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {!vessel.moving && (
                    <span className="inline-flex items-center gap-1 text-[8px] text-amber-400">
                      <Anchor className="h-2.5 w-2.5" /> stationary
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 text-[8px] text-sky-400">
                    <Gauge className="h-2.5 w-2.5" /> {vessel.sog.toFixed(1)} kn
                  </span>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
