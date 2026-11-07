"use client";

import React, { useState, useEffect, createContext, useContext } from "react";
import { useAppStore } from "@/lib/store";
import {
  ports,
  dashboardMetrics,
  importTrendData,
  stockItems,
} from "@/lib/mock-data";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge, badgeVariants } from "@/components/ui/badge";
import type { VariantProps } from "class-variance-authority";
import { TacticalFleetMap } from "@/components/map/tactical-fleet-map";
import Link from "next/link";
import { cn, formatNumber } from "@/lib/utils";
import {
  AlertTriangle,
  Activity,
  Shield,
  Anchor,
  Flame,
  ArrowRight,
  ChevronRight,
  ChevronDown,
  Compass,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Accordion context to ensure only one section is open at a time
const AccordionContext = createContext<{
  openSection: string | null;
  setOpenSection: (id: string | null) => void;
}>({
  openSection: null,
  setOpenSection: () => {},
});

function AccordionProvider({ children }: { children: React.ReactNode }) {
  const [openSection, setOpenSection] = useState<string | null>(null);
  return (
    <AccordionContext.Provider value={{ openSection, setOpenSection }}>
      {children}
    </AccordionContext.Provider>
  );
}

function LiveStatusDot({ crisisMode }: { crisisMode?: boolean }) {
  const isCrisis = crisisMode || false;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-crisis/15 px-2 py-1 text-[10px] font-mono text-crisis-foreground",
        isCrisis ? "bg-crisis/20 text-crisis" : ""
      )}
    >
      <svg
        className="h-3 w-3"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <circle cx="12" cy="12" r="4" />
        <path d="M12 1v2M12 23v2M4.93 4.93l2.83 2.83M15.07 15.07l2.83 2.83" />
      </svg>
      <span className="text-[9px] tracking-tight opacity-80">{isCrisis ? "CRIT" : "OK"}</span>
    </span>
  );
}

function KpiCard({
  title,
  value,
  status,
  statusVariant,
  icon,
}: {
  title: string;
  value: string | number;
  status: string;
  statusVariant: VariantProps<typeof badgeVariants>["variant"];
  icon: React.ElementType;
}) {
  const Icon = icon;
  return (
    <Card className="bg-card border-border p-3">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <span className="block text-[9px] uppercase font-semibold tracking-wider text-muted-foreground">
              {title}
            </span>
            <span className="block text-xs font-bold text-foreground leading-none truncate" title={String(value)}>
              {value}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className={cn("h-1.5 w-1.5 rounded-full", statusVariant === "crisis" ? "bg-crisis" : statusVariant === "warning" ? "bg-warning" : "bg-success")} />
            <Badge variant={statusVariant} className="text-[9px] font-bold shrink-0">
              {status}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-3 pt-2 border-t border-border/50">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-secondary/40 text-muted-foreground">
            <Icon className="h-2.5 w-2.5" />
          </div>
        </div>
      </div>
    </Card>
  );
}

// Collapsible section (accordion) using inline state
function CollapsibleSection({
  title,
  icon,
  children,
  defaultOpen = false,
  sectionId,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  defaultOpen?: boolean;
  sectionId: string;
}) {
  const { openSection, setOpenSection } = useContext(AccordionContext);
  const isOpen = openSection === sectionId;
  const Icon = icon;

  // Initialize with defaultOpen if no section is open yet
  useEffect(() => {
    if (defaultOpen && openSection === null) {
      setOpenSection(sectionId);
    }
  }, [defaultOpen, openSection, sectionId, setOpenSection]);

  return (
    <div className="bg-card border-border rounded-lg overflow-hidden flex flex-col">
      <button
        onClick={() => setOpenSection(isOpen ? null : sectionId)}
        className="flex items-center justify-between w-full px-3 py-2 bg-secondary/40 text-foreground hover:bg-secondary/60 transition-colors"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <Icon className="h-3 w-3 text-muted-foreground shrink-0" />
          <span className="text-[10px] font-bold tracking-wider text-foreground truncate">{title}</span>
        </div>
        <ChevronDown
          className={cn("h-3 w-3 shrink-0 transition-transform", isOpen ? "rotate-180" : "")}
        />
      </button>
      {isOpen && (
        <CardContent className="p-2">{children}</CardContent>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const { crisisMode, toggleCrisisMode, alerts, acknowledgeAlert, shipments } = useAppStore();

  const criticalAlerts = alerts.filter((a) => !a.acknowledged && (a.severity === "critical" || a.severity === "high"));
  const unacknowledgedCount = alerts.filter((a) => !a.acknowledged).length;

  const lowStockItems = stockItems.filter((item) => item.status === "critical" || item.daysRemaining <= 15);

  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `
      .animate-ping, .animate-ping-slow, .crisis-pulse { animation: none !important; }
    `;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);

  return (
    <div className="space-y-0">
      {/* Compact top bar context */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-border pb-2 mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-sm font-bold tracking-tight text-foreground uppercase truncate" title="Qatar National Logistics Command Center">
            Qatar National Logistics Command Center
          </h1>
          <LiveStatusDot crisisMode={crisisMode} />
          <Badge variant="outline" className="text-[9px] font-mono border-border/60 text-muted-foreground bg-muted/20 truncate shrink-0" title="Tactical Simulation Model">
            Tactical Simulation Model
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={toggleCrisisMode}
            className={cn(
              "text-[10px] font-bold shadow-none h-8",
              crisisMode
                ? "bg-crisis/15 text-crisis border border-crisis/40 hover:bg-crisis/25"
                : "bg-secondary hover:bg-secondary/80 text-foreground border border-border hover:text-foreground"
            )}
          >
            <AlertTriangle className="h-3 w-3 mr-1" />
            {crisisMode ? "CRISIS MODE ACTIVE" : "SIMULATE CHOKEPOINT CRISIS"}
          </Button>
          <Link href="/routes">
            <Button size="sm" className="bg-primary hover:bg-primary/90 text-white text-[10px] h-8">
              Optimize Routes
              <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Main layout: Map on left/center, everything else in right sidebar */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 h-[calc(100vh-180px)] min-h-[560px]">
        {/* Center Panel: Flexible Map — takes remaining space */}
        <div className="md:col-span-9 flex flex-col h-full min-h-0 border border-border rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-secondary/50 z-10 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <Compass className="h-3 w-3 text-muted-foreground shrink-0" />
              <span className="text-[10px] font-bold tracking-tight text-foreground uppercase truncate shrink-0">
                Geospatial Operations Grid
              </span>
              <Badge variant="outline" className="text-[9px] font-mono border-border/60 shrink-0">
                GPS / AIS Satellite Feed
              </Badge>
            </div>
            <Link href="/tracking" className="text-[10px] text-primary hover:underline flex items-center gap-1 font-medium shrink-0">
              Full-Screen Tactical Tracking <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="flex-1 min-h-[320px] relative bg-[#080d14]">
            <TacticalFleetMap className="h-full w-full" />
          </div>
        </div>

        {/* Right Sidebar: All panels as accordion dropdowns */}
        <div className="md:col-span-3 space-y-6 h-full flex flex-col">
          <AccordionProvider>
            <div className="flex-1 space-y-6 overflow-y-auto">
              {/* KPI Cards Strip */}
              <div className="grid grid-cols-1 gap-2 flex-shrink-0">
                <KpiCard
                  title="Import Dependency"
                  value={`${dashboardMetrics.importDependencyIndex}%`}
                  status={crisisMode ? "High Risk" : "Above Target"}
                  statusVariant={crisisMode ? "crisis" : "warning"}
                  icon={Shield}
                />
                <KpiCard
                  title="Active Shipments"
                  value={shipments.length}
                  status={crisisMode ? "4 Rerouted" : "2 At Risk"}
                  statusVariant={crisisMode ? "crisis" : "warning"}
                  icon={Anchor}
                />
                <KpiCard
                  title="Critical Stockpiles"
                  value={lowStockItems.length}
                  status={`${lowStockItems.length} <15 Days`}
                  statusVariant="crisis"
                  icon={Flame}
                />
                <KpiCard
                  title="Maritime Chokepoints"
                  value={crisisMode ? "BLOCKED" : "Elevated"}
                  status="Hormuz Lvl 3"
                  statusVariant={crisisMode ? "crisis" : "warning"}
                  icon={Shield}
                />
              </div>

              {/* Mission-Critical Alert Stream — Collapsible */}
            <CollapsibleSection title="Mission-Critical Alert Stream" icon={Activity} defaultOpen={false} sectionId="alert-stream">
              <div className="space-y-2">
                {alerts.slice(0, 6).map((alert) => (
                  <div
                    key={alert.id}
                    className={cn(
                      "p-3 rounded-md border transition-colors",
                      alert.severity === "critical"
                        ? "bg-crisis/10 border-crisis/30"
                        : alert.severity === "high"
                        ? "bg-warning/10 border-warning/30"
                        : "bg-secondary/40 border-border/60"
                    )}
                  >
                    <div className="flex gap-3">
                      <span
                        className={cn(
                          "mt-1 h-1.5 w-1.5 rounded-full shrink-0",
                          alert.severity === "critical" ? "bg-crisis" : alert.severity === "high" ? "bg-warning" : "bg-muted-foreground/30"
                        )}
                      />
                      <div className="min-w-0 flex-1 grid grid-cols-1 gap-2">
                        {/* Row 1: Title and category */}
                        <div className="flex items-center gap-2">
                          <span
                            className="text-[10px] font-bold text-foreground truncate"
                            title={alert.title}
                          >
                            {alert.title}
                          </span>
                          <span className="text-[8px] text-muted-foreground font-mono shrink-0">
                            {alert.category}
                          </span>
                        </div>
                        {/* Row 2: Description */}
                        <p className="text-[9px] text-muted-foreground leading-tight" title={alert.description}>
                          {alert.description}
                        </p>
                        {/* Row 3: Timestamp and acknowledge button */}
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[8px] text-muted-foreground/60 font-mono">
                            {new Date(alert.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} AST
                          </span>
                          {!alert.acknowledged ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => acknowledgeAlert(alert.id)}
                              className="text-[8px] h-7 px-3 shrink-0 border-border/50 hover:bg-secondary"
                            >
                              Ack
                            </Button>
                          ) : (
                            <span className="text-[8px] text-success border-success/30 shrink-0">
                              Ack
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CollapsibleSection>

            {/* Critical Depletion Watch — Collapsible */}
            <CollapsibleSection title="Critical Depletion Watch" icon={Flame} defaultOpen={false} sectionId="depletion-watch">
              <div className="space-y-2">
                {lowStockItems.slice(0, 5).map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-md bg-secondary/40 border border-border/60"
                  >
                    <div className="flex items-start gap-3">
                      {/* Icon */}
                      <div
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-sm",
                          item.daysRemaining <= 8
                            ? "bg-crisis/20 border-crisis/40 text-crisis"
                            : "bg-warning/20 border-warning/40 text-warning"
                        )}
                      >
                        <Flame className="h-4 w-4" />
                      </div>
                      {/* Content */}
                      <div className="min-w-0 flex-1 grid grid-cols-1 gap-2">
                        {/* Row 1: Item name and badge */}
                        <div className="flex items-center gap-2">
                          <span
                            className="text-[10px] font-bold text-foreground truncate"
                            title={item.name}
                          >
                            {item.name}
                          </span>
                          <Badge
                            variant={item.daysRemaining <= 8 ? "crisis" : "warning"}
                            className="text-[9px] font-bold shrink-0"
                          >
                            {item.daysRemaining} Days
                          </Badge>
                        </div>
                        {/* Row 2: Warehouse */}
                        <div className="flex items-center gap-2 text-[9px] text-muted-foreground">
                          <span className="truncate" title={item.warehouse}>
                            {item.warehouse}
                          </span>
                        </div>
                        {/* Row 3: Stock quantity */}
                        <p className="text-[9px] text-muted-foreground font-mono truncate leading-none" title={`${item.currentStock.toLocaleString()} ${item.unit}`}>
                          {item.currentStock.toLocaleString()} {item.unit}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CollapsibleSection>

            {/* Priority Action Queue — Collapsible */}
            <CollapsibleSection title="Priority Action Queue" icon={AlertTriangle} defaultOpen={false} sectionId="priority-queue">
              <div className="space-y-2">
                {[
                  { id: "p-1", action: "Reroute QSC-2406 via Salalah", severity: "critical" },
                  { id: "p-2", action: "Release strategic steel stockpile", severity: "warning" },
                  { id: "p-3", action: "Activate air corridor Mumbai→DOH", severity: "success" },
                ].map((item) => (
                  <div
                    key={item.id}
                    className={cn(
                      "flex items-center justify-between gap-3 p-3 rounded-md border",
                      item.severity === "critical"
                        ? "bg-crisis/10 border-crisis/30"
                        : item.severity === "warning"
                        ? "bg-warning/10 border-warning/30"
                        : "bg-success/10 border-success/30"
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <span className="text-[9px] text-foreground font-medium truncate block" title={item.action}>
                        {item.action}
                      </span>
                    </div>
                    <Badge variant={item.severity === "critical" ? "crisis" : item.severity === "warning" ? "warning" : "success"} className="text-[9px] font-bold shrink-0">
                      {item.severity}
                    </Badge>
                  </div>
                ))}
              </div>
            </CollapsibleSection>

          </div>
          </AccordionProvider>
        </div>
      </div>

    </div>
  );
}