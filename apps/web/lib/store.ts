"use client";
import { create } from "zustand";
import { shipments as initialShipments, alerts as initialAlerts, dashboardMetrics as initialMetrics, type Shipment, type Alert } from "./mock-data";
import type { FleetSnapshot, LiveVessel } from "./live/types";

type LiveStatus = "connecting" | "live" | "degraded" | "offline";

interface AppState {
  crisisMode: boolean;
  toggleCrisisMode: () => void;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  mobileMenuOpen: boolean;
  toggleMobileMenu: () => void;
  setMobileMenuOpen: (open: boolean) => void;
  shipments: Shipment[];
  alerts: Alert[];
  metrics: typeof initialMetrics;
  activePage: string;
  setActivePage: (page: string) => void;
  acknowledgeAlert: (id: string) => void;
  simulationTick: number;
  incrementTick: () => void;
  notificationCount: number;
  copilotOpen: boolean;
  toggleCopilot: () => void;

  // Live maritime intelligence (VesselAPI + AISStream + DataDocked)
  liveVessels: LiveVessel[];
  liveUpdatedAt: string | null;
  liveSources: FleetSnapshot["sources"] | null;
  liveStatus: LiveStatus;
  liveLastError: string | null;
  setLiveSnapshot: (snapshot: FleetSnapshot) => void;
  applyLiveVessel: (vessel: LiveVessel) => void;
  patchLiveSource: (patch: Partial<FleetSnapshot["sources"]>) => void;
  setLiveStatus: (status: LiveStatus, error?: string | null) => void;
}

function deriveStatus(snapshot: FleetSnapshot): LiveStatus {
  const states = Object.values(snapshot.sources).map((source) => source.status);
  if (states.includes("live")) return "live";
  if (states.includes("degraded")) return "degraded";
  return "offline";
}

export const useAppStore = create<AppState>((set) => ({
  crisisMode: false,
  toggleCrisisMode: () =>
    set((s) => {
      const entering = !s.crisisMode;
      if (entering) {
        const updated = s.shipments.map((sh) => {
          if (sh.id === "QSC-2406" || sh.id === "QSC-2401") {
            return { ...sh, status: "rerouted" as const, riskLevel: "critical" as const };
          }
          if (sh.type === "sea" && sh.status === "in-transit") {
            return { ...sh, riskLevel: "high" as const };
          }
          return sh;
        });
        const crisisAlerts: Alert[] = [
          { id: "CRS-001", severity: "critical", title: "⚠ CRISIS MODE ACTIVATED — Strait of Hormuz BLOCKED", description: "All maritime traffic through Hormuz suspended. 12 vessels holding at anchorage. Emergency rerouting protocols engaged.", timestamp: new Date().toISOString(), category: "Crisis", acknowledged: false },
          { id: "CRS-002", severity: "critical", title: "Emergency Airlift Protocol Initiated", description: "Activating air corridor capacity from Istanbul, Mumbai, and Singapore for critical medical and food supplies.", timestamp: new Date().toISOString(), category: "Crisis", acknowledged: false },
          { id: "CRS-003", severity: "high", title: "Strategic Reserve Release Authorized", description: "National food and medical strategic reserves released. 45-day buffer activated across all categories.", timestamp: new Date().toISOString(), category: "Crisis", acknowledged: false },
        ];
        return { crisisMode: true, shipments: updated, alerts: [...crisisAlerts, ...s.alerts], notificationCount: s.notificationCount + 3 };
      }
      return { crisisMode: false, shipments: initialShipments, alerts: initialAlerts, notificationCount: s.notificationCount };
    }),
  sidebarCollapsed: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  mobileMenuOpen: false,
  toggleMobileMenu: () => set((s) => ({ mobileMenuOpen: !s.mobileMenuOpen })),
  setMobileMenuOpen: (open) => set({ mobileMenuOpen: open }),
  shipments: initialShipments,
  alerts: initialAlerts,
  metrics: initialMetrics,
  activePage: "dashboard",
  setActivePage: (page) => set({ activePage: page }),
  acknowledgeAlert: (id) =>
    set((s) => ({
      alerts: s.alerts.map((a) => (a.id === id ? { ...a, acknowledged: true } : a)),
      notificationCount: Math.max(0, s.notificationCount - 1),
    })),
  simulationTick: 0,
  incrementTick: () => set((s) => ({ simulationTick: s.simulationTick + 1 })),
  notificationCount: initialAlerts.filter((a) => !a.acknowledged).length,
  copilotOpen: false,
  toggleCopilot: () => set((s) => ({ copilotOpen: !s.copilotOpen })),

  liveVessels: [],
  liveUpdatedAt: null,
  liveSources: null,
  liveStatus: "connecting",
  liveLastError: null,
  setLiveSnapshot: (snapshot) =>
    set({
      liveVessels: snapshot.vessels,
      liveUpdatedAt: snapshot.updatedAt,
      liveSources: snapshot.sources,
      liveStatus: deriveStatus(snapshot),
      liveLastError: null,
    }),
  applyLiveVessel: (vessel) =>
    set((s) => {
      const next = s.liveVessels.slice();
      const index = next.findIndex((v) => v.mmsi === vessel.mmsi);
      if (index >= 0) next[index] = vessel;
      else next.unshift(vessel);
      return { liveVessels: next.slice(0, 750), liveUpdatedAt: new Date().toISOString() };
    }),
  patchLiveSource: (patch) =>
    set((s) => ({
      liveSources: s.liveSources
        ? { ...s.liveSources, ...patch }
        : s.liveSources,
    })),
  setLiveStatus: (status, error = null) => set({ liveStatus: status, liveLastError: error }),
}));
