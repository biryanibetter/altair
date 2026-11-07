import { fetchJson, UpstreamError } from "./http";
import type { LiveVessel, SourceState } from "./types";

const BASE = "https://api.vesselapi.com/v1";

/** Qatar maritime search box: Hamad / Mesaieed to Ras Laffan, plus approaches. */
export const QATAR_BOX = {
  lonLeft: 50.4,
  lonRight: 52.0,
  latBottom: 24.3,
  latTop: 26.3,
};

export const NAV_STATUS: Record<number, string> = {
  0: "Under way using engine",
  1: "At anchor",
  2: "Not under command",
  3: "Restricted manoeuvrability",
  4: "Constrained by draught",
  5: "Moored",
  6: "Aground",
  7: "Fishing",
  8: "Under way sailing",
  9: "Reserved (HSC)",
  10: "Reserved (WIG)",
  11: "Towing astern",
  12: "Pushing ahead",
  13: "Reserved",
  14: "AIS-SART",
  15: "Undefined",
};

export function navStatusLabel(status: number | null | undefined, sog: number): string {
  if (status !== null && status !== undefined && NAV_STATUS[status]) return NAV_STATUS[status];
  if (sog >= 0.5) return "Under way";
  return "Stationary";
}

/**
 * navStatus codes that mean the vessel is holding position even when the
 * reported SOG jitters (common on moored/anchored contacts).
 */
const STATIONARY_STATUSES = new Set([1, 5, 6]);

/** Single source of truth for the `moving` flag across both AIS feeds. */
export function isUnderway(navStatus: number | null | undefined, sog: number): boolean {
  if (navStatus !== null && navStatus !== undefined && STATIONARY_STATUSES.has(navStatus)) {
    return false;
  }
  return Number.isFinite(sog) && sog >= 0.5;
}

interface PortZone {
  name: string;
  lat: number;
  lng: number;
  radiusDeg: number;
}

const PORT_ZONES: PortZone[] = [
  { name: "Hamad Port approaches", lat: 25.015, lng: 51.605, radiusDeg: 0.22 },
  { name: "Mesaieed anchorage", lat: 24.95, lng: 51.58, radiusDeg: 0.18 },
  { name: "Ras Laffan approaches", lat: 25.9, lng: 51.55, radiusDeg: 0.25 },
  { name: "Al Ruwais / north coast", lat: 26.13, lng: 51.2, radiusDeg: 0.3 },
];

export function classifyZone(lat: number, lng: number): string {
  let best: { name: string; distance: number } | null = null;
  for (const zone of PORT_ZONES) {
    const distance = Math.hypot(lat - zone.lat, lng - zone.lng);
    if (distance <= zone.radiusDeg && (!best || distance < best.distance)) {
      best = { name: zone.name, distance };
    }
  }
  return best?.name ?? "Qatar Gulf approaches";
}

interface VesselApiPositionRow {
  mmsi: number;
  imo?: number;
  vessel_name?: string;
  latitude?: number | null;
  longitude?: number | null;
  timestamp?: string;
  processed_timestamp?: string;
  cog?: number | null;
  sog?: number | null;
  heading?: number | null;
  nav_status?: number | null;
  suspected_glitch?: boolean;
}

interface VesselApiListResponse {
  vessels?: VesselApiPositionRow[];
  nextToken?: string;
}

export interface VesselBoxResult {
  vessels: LiveVessel[];
  source: SourceState;
}

function normalise(row: VesselApiPositionRow): LiveVessel | null {
  if (typeof row.latitude !== "number" || typeof row.longitude !== "number") return null;
  if (!Number.isFinite(row.latitude) || !Number.isFinite(row.longitude)) return null;
  const sog = typeof row.sog === "number" && Number.isFinite(row.sog) ? Math.max(0, row.sog) : 0;
  const navStatus = typeof row.nav_status === "number" ? row.nav_status : null;
  return {
    mmsi: row.mmsi,
    imo: row.imo,
    name: (row.vessel_name || `MMSI ${row.mmsi}`).trim(),
    lat: row.latitude,
    lng: row.longitude,
    sog: Math.round(sog * 10) / 10,
    cog: typeof row.cog === "number" ? row.cog : null,
    heading: typeof row.heading === "number" ? row.heading : null,
    navStatus,
    navStatusLabel: navStatusLabel(navStatus, sog),
    timestamp: row.timestamp || row.processed_timestamp || new Date().toISOString(),
    zone: classifyZone(row.latitude, row.longitude),
    moving: isUnderway(navStatus, sog),
    source: "vesselapi",
  };
}

/**
 * Live AIS positions inside the Qatar search box.
 * The location endpoints accept a max 4h window and default to 2h, so a single
 * unpaginated call is enough for a "right now" snapshot.
 */
export async function fetchQatarVessels(): Promise<VesselBoxResult> {
  const key = process.env.VESSELAPI_API_KEY;
  if (!key) {
    return {
      vessels: [],
      source: { status: "offline", detail: "VESSELAPI_API_KEY not configured" },
    };
  }

  const seen = new Map<number, LiveVessel>();
  const started = Date.now();
  let nextToken: string | undefined;
  let pages = 0;

  try {
    do {
      const params = new URLSearchParams({
        "filter.lonLeft": String(QATAR_BOX.lonLeft),
        "filter.lonRight": String(QATAR_BOX.lonRight),
        "filter.latBottom": String(QATAR_BOX.latBottom),
        "filter.latTop": String(QATAR_BOX.latTop),
        "pagination.limit": "50",
      });
      if (nextToken) params.set("pagination.nextToken", nextToken);

      const { data } = await fetchJson<VesselApiListResponse>(`${BASE}/location/vessels/bounding-box?${params}`, {
        headers: { Authorization: `Bearer ${key}`, accept: "application/json" },
        label: "VesselAPI location/vessels",
        timeoutMs: 9000,
        retries: 1,
      });

      for (const row of data.vessels ?? []) {
        const vessel = normalise(row);
        if (!vessel) continue;
        const existing = seen.get(vessel.mmsi);
        if (!existing || Date.parse(vessel.timestamp) >= Date.parse(existing.timestamp)) {
          seen.set(vessel.mmsi, vessel);
        }
      }

      nextToken = data.nextToken;
      pages += 1;
    } while (nextToken && pages < 3);

    return {
      vessels: [...seen.values()].sort((a, b) => b.sog - a.sog),
      source: {
        status: "live",
        latencyMs: Date.now() - started,
        updatedAt: new Date().toISOString(),
        detail: `${seen.size} contacts · ${pages} page${pages === 1 ? "" : "s"}`,
      },
    };
  } catch (error) {
    const status = error instanceof UpstreamError && error.status === 429 ? "degraded" : "offline";
    return {
      vessels: [...seen.values()],
      source: {
        status,
        latencyMs: Date.now() - started,
        detail: error instanceof Error ? error.message : "VesselAPI unavailable",
      },
    };
  }
}

export interface VesselApiVessel {
  imo?: number;
  mmsi?: number;
  call_sign?: string;
  name?: string;
  name_ais?: string;
  vessel_type?: string;
  country?: string;
  country_code?: string;
  year_built?: number;
  operating_status?: string;
  length?: number;
  breadth?: number;
  gross_tonnage?: number;
  deadweight_tonnage?: number;
  draught_calculated_avg?: number;
}

export interface VesselApiPosition {
  mmsi?: number;
  imo?: number;
  vessel_name?: string;
  latitude?: number;
  longitude?: number;
  timestamp?: string;
  cog?: number;
  sog?: number;
  heading?: number;
  nav_status?: number;
}

export interface VesselApiEta {
  destination?: string;
  destination_port?: string;
  eta?: string;
  draught?: number;
  timestamp?: string;
}

export interface VesselApiDetail {
  vessel?: VesselApiVessel;
  vesselPosition?: VesselApiPosition;
  vesselEta?: VesselApiEta;
}

/** Vessel particulars + latest position. `idType` is inferred from the identifier length. */
export async function fetchVesselDetail(id: string): Promise<{
  data: VesselApiDetail | null;
  source: SourceState;
}> {
  const key = process.env.VESSELAPI_API_KEY;
  if (!key) {
    return { data: null, source: { status: "offline", detail: "VESSELAPI_API_KEY not configured" } };
  }

  const digits = id.replace(/\D/g, "");
  const idType = digits.length === 7 ? "imo" : "mmsi";
  const started = Date.now();

  try {
    const { data } = await fetchJson<VesselApiDetail>(
      `${BASE}/vessel/${encodeURIComponent(digits)}/position?filter.idType=${idType}`,
      {
        headers: { Authorization: `Bearer ${key}`, accept: "application/json" },
        label: "VesselAPI vessel/position",
        timeoutMs: 9000,
        retries: 1,
      }
    );
    return {
      data,
      source: { status: "live", latencyMs: Date.now() - started, updatedAt: new Date().toISOString() },
    };
  } catch (error) {
    return {
      data: null,
      source: {
        status: error instanceof UpstreamError && error.status === 429 ? "degraded" : "offline",
        latencyMs: Date.now() - started,
        detail: error instanceof Error ? error.message : "VesselAPI unavailable",
      },
    };
  }
}

export interface VesselApiPort {
  name: string;
  country?: { code?: string; name?: string };
  latitude: number;
  longitude: number;
  type?: string;
  size?: string;
}

/** Ports inside a bounding box — used to reconcile Qatar port geometry. */
export async function fetchPortsInBox(): Promise<{ ports: VesselApiPort[]; source: SourceState }> {
  const key = process.env.VESSELAPI_API_KEY;
  if (!key) {
    return { ports: [], source: { status: "offline", detail: "VESSELAPI_API_KEY not configured" } };
  }
  const params = new URLSearchParams({
    "filter.lonLeft": String(QATAR_BOX.lonLeft),
    "filter.lonRight": String(QATAR_BOX.lonRight),
    "filter.latBottom": String(QATAR_BOX.latBottom),
    "filter.latTop": String(QATAR_BOX.latTop),
    "pagination.limit": "50",
  });
  try {
    const { data, latencyMs } = await fetchJson<{ ports?: VesselApiPort[] }>(
      `${BASE}/location/ports/bounding-box?${params}`,
      {
        headers: { Authorization: `Bearer ${key}`, accept: "application/json" },
        label: "VesselAPI location/ports",
      }
    );
    return {
      ports: data.ports ?? [],
      source: { status: "live", latencyMs, updatedAt: new Date().toISOString() },
    };
  } catch (error) {
    return {
      ports: [],
      source: { status: "offline", detail: error instanceof Error ? error.message : "unavailable" },
    };
  }
}
