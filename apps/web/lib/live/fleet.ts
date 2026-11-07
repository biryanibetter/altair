import { fetchQatarVessels } from "./vesselapi";
import { aisHub } from "./aisstream";
import type { FleetSnapshot, LiveVessel, SourceState } from "./types";

const SNAPSHOT_TTL_MS = 15_000;

let cached: { at: number; snapshot: FleetSnapshot } | null = null;
let inFlight: Promise<FleetSnapshot> | null = null;
let dataDockedState: SourceState = {
  status: process.env.DATADOCKED_API_KEY ? "standby" : "offline",
  detail: process.env.DATADOCKED_API_KEY ? "queried on demand" : "DATADOCKED_API_KEY not configured",
};

/** Called by /api/vessel/[id] so the fleet health strip reflects real usage. */
export function reportDataDockedState(state: SourceState): void {
  dataDockedState = state;
  if (cached) {
    cached.snapshot.sources.dataDocked = state;
  }
}

function mergeVessels(rest: LiveVessel[], streamed: LiveVessel[]): LiveVessel[] {
  const merged = new Map<number, LiveVessel>();

  for (const vessel of rest) merged.set(vessel.mmsi, vessel);

  for (const vessel of streamed) {
    const current = merged.get(vessel.mmsi);
    if (!current) {
      merged.set(vessel.mmsi, vessel);
      continue;
    }
    if (Date.parse(vessel.timestamp) >= Date.parse(current.timestamp)) {
      merged.set(vessel.mmsi, {
        ...vessel,
        // Keep the richer REST metadata when both feeds know the contact.
        name: current.name && current.name !== `MMSI ${current.mmsi}` ? current.name : vessel.name,
        imo: current.imo ?? vessel.imo,
        zone: vessel.zone || current.zone,
      });
    }
  }

  return [...merged.values()].sort((a, b) => {
    if (a.moving !== b.moving) return a.moving ? -1 : 1;
    return b.sog - a.sog;
  });
}

function buildSnapshot(rest: LiveVessel[], vesselApiState: SourceState): FleetSnapshot {
  const streamed = aisHub.getRecentPositions();
  const vessels = mergeVessels(rest, streamed);
  const updatedAt = new Date().toISOString();

  return {
    vessels,
    total: vessels.length,
    updatedAt,
    sources: {
      vesselApi: {
        ...vesselApiState,
        detail:
          vesselApiState.status === "live"
            ? `${rest.length} AIS contacts in Qatar box`
            : vesselApiState.detail,
      },
      aisStream: aisHub.getSourceState(),
      dataDocked: dataDockedState,
    },
  };
}

/**
 * Unified live fleet snapshot.
 * Cached for 15s so every browser tab (and the SSE fan-out) shares one
 * upstream call and stays far below VesselAPI's 300 req / 5 min location cap.
 */
export async function getFleetSnapshot(options: { force?: boolean } = {}): Promise<FleetSnapshot> {
  const now = Date.now();
  if (!options.force && cached && now - cached.at < SNAPSHOT_TTL_MS) {
    return cached.snapshot;
  }

  if (inFlight) return inFlight;

  inFlight = (async () => {
    const { vessels, source } = await fetchQatarVessels();
    const snapshot = buildSnapshot(vessels, source);
    cached = { at: Date.now(), snapshot };
    return snapshot;
  })();

  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
}

export function getCachedSnapshotAgeMs(): number | null {
  return cached ? Date.now() - cached.at : null;
}
