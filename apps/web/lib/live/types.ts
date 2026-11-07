// Shared types for the live maritime intelligence layer.
// Safe to import from client components (no secrets, no server-only code).

export type SourceStatus = "live" | "degraded" | "offline" | "standby";

export interface SourceState {
  status: SourceStatus;
  detail?: string;
  latencyMs?: number;
  updatedAt?: string;
}

export interface LiveVessel {
  mmsi: number;
  imo?: number;
  name: string;
  lat: number;
  lng: number;
  /** Speed over ground, knots */
  sog: number;
  /** Course over ground, degrees */
  cog: number | null;
  /** True heading, degrees */
  heading: number | null;
  navStatus: number | null;
  navStatusLabel: string;
  timestamp: string;
  /** Nearest Qatari port area, used for grouping in the UI */
  zone: string;
  moving: boolean;
  source: "vesselapi" | "aisstream";
}

export interface FleetSnapshot {
  vessels: LiveVessel[];
  total: number;
  updatedAt: string;
  sources: {
    vesselApi: SourceState;
    aisStream: SourceState;
    dataDocked: SourceState;
  };
}

export interface VesselIntel {
  identity: {
    mmsi?: number | string | null;
    imo?: number | string | null;
    name?: string | null;
    callsign?: string | null;
    flag?: string | null;
    type?: string | null;
    typeSpecific?: string | null;
    yearBuilt?: string | number | null;
    classSociety?: string | null;
  };
  dimensions: {
    length?: string | number | null;
    beam?: string | number | null;
    draught?: string | number | null;
    grossTonnage?: string | number | null;
    deadweight?: string | number | null;
  };
  voyage: {
    destination?: string | null;
    destinationUnlocode?: string | null;
    lastPort?: string | null;
    lastPortUnlocode?: string | null;
    eta?: string | null;
    departure?: string | null;
    navStatus?: string | null;
  };
  management: {
    manager?: string | null;
    owner?: string | null;
    commercialManager?: string | null;
    ism?: string | null;
    piClub?: string | null;
  };
  position: {
    lat?: number | null;
    lng?: number | null;
    speed?: number | null;
    course?: number | null;
    heading?: number | null;
    receivedAt?: string | null;
    dataSource?: string | null;
  };
  sources: {
    dataDocked: SourceState;
    vesselApi: SourceState;
  };
  fetchedAt: string;
}
