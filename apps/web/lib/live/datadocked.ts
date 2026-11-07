import { fetchJson, UpstreamError } from "./http";
import type { SourceState } from "./types";

const BASE = "https://datadocked.com/api";

interface DataDockedVessel {
  name?: string;
  mmsi?: string;
  imo?: string;
  country?: string;
  shipType?: string;
  callsign?: string;
  length?: string;
  beam?: string;
  draught?: string;
  etaUtc?: string;
  deadweight?: string;
  speed?: string;
  atdUtc?: string;
  latitude?: string;
  longitude?: string;
  course?: string;
  heading?: string;
  destination?: string;
  unlocodeDestination?: string;
  unlocodeLastport?: string;
  lastPort?: string;
  typeSpecific?: string;
  navigationalStatus?: string;
  grossTonnage?: string;
  yearOfBuilt?: string;
  positionReceived?: string;
  updateTime?: string;
  dataSource?: string;
  management?: {
    manager?: string;
    registeredOwner?: string;
    ism?: string;
    "P&I"?: string;
    managerWebsite?: string;
  };
  engine?: Record<string, string>;
}

export interface DataDockedVesselResult {
  vessel: DataDockedVessel | null;
  source: SourceState;
}

/** Vessel particulars + last reported voyage data from DataDocked. */
export async function fetchDataDockedVessel(id: string): Promise<DataDockedVesselResult> {
  const key = process.env.DATADOCKED_API_KEY;
  if (!key) {
    return { vessel: null, source: { status: "offline", detail: "DATADOCKED_API_KEY not configured" } };
  }

  const digits = id.replace(/\D/g, "");
  const started = Date.now();
  const params = new URLSearchParams({ imo_or_mmsi: digits });

  try {
    const { data } = await fetchJson<DataDockedVessel>(
      `${BASE}/vessels_operations/get-vessel-info?${params}`,
      {
        headers: { "x-api-key": key, accept: "application/json" },
        label: "DataDocked get-vessel-info",
        timeoutMs: 9000,
        retries: 1,
      }
    );
    return {
      vessel: data,
      source: { status: "live", latencyMs: Date.now() - started, updatedAt: new Date().toISOString() },
    };
  } catch (error) {
    return {
      vessel: null,
      source: {
        status: error instanceof UpstreamError && error.status === 429 ? "degraded" : "offline",
        latencyMs: Date.now() - started,
        detail: error instanceof Error ? error.message : "DataDocked unavailable",
      },
    };
  }
}

export type DataDockedRecord = DataDockedVessel;
