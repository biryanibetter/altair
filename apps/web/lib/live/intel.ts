import { fetchDataDockedVessel, type DataDockedRecord } from "./datadocked";
import { fetchVesselDetail, navStatusLabel, type VesselApiDetail } from "./vesselapi";
import { reportDataDockedState } from "./fleet";
import type { SourceState, VesselIntel } from "./types";

const INTEL_TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, { at: number; intel: VesselIntel }>();

function clean(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text || text === "-" || text === "null") return null;
  return text;
}

function numeric(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(String(value).replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function fromDataDocked(record: DataDockedRecord | null): VesselIntel | null {
  if (!record) return null;
  return {
    identity: {
      mmsi: numeric(record.mmsi),
      imo: numeric(record.imo),
      name: clean(record.name),
      callsign: clean(record.callsign),
      flag: clean(record.country),
      type: clean(record.shipType),
      typeSpecific: clean(record.typeSpecific),
      yearBuilt: clean(record.yearOfBuilt),
    },
    dimensions: {
      length: clean(record.length),
      beam: clean(record.beam),
      draught: clean(record.draught),
      grossTonnage: clean(record.grossTonnage),
      deadweight: clean(record.deadweight),
    },
    voyage: {
      destination: clean(record.destination),
      destinationUnlocode: clean(record.unlocodeDestination),
      lastPort: clean(record.lastPort),
      lastPortUnlocode: clean(record.unlocodeLastport),
      eta: clean(record.etaUtc),
      departure: clean(record.atdUtc),
      navStatus: clean(record.navigationalStatus),
    },
    management: {
      manager: clean(record.management?.manager),
      owner: clean(record.management?.registeredOwner),
      ism: clean(record.management?.ism),
      piClub: clean(record.management?.["P&I"]),
    },
    position: {
      lat: numeric(record.latitude),
      lng: numeric(record.longitude),
      speed: numeric(record.speed),
      course: numeric(record.course),
      heading: numeric(record.heading),
      receivedAt: clean(record.positionReceived),
      dataSource: clean(record.dataSource),
    },
    sources: {
      dataDocked: { status: "live", updatedAt: new Date().toISOString() },
      vesselApi: { status: "standby", detail: "not queried" },
    },
    fetchedAt: new Date().toISOString(),
  };
}

function fromVesselApi(detail: VesselApiDetail | null, source: SourceState): VesselIntel | null {
  if (!detail?.vessel) return null;
  const vessel = detail.vessel;
  const position = detail.vesselPosition;
  const eta = detail.vesselEta;
  const sog = typeof position?.sog === "number" ? position.sog : null;

  return {
    identity: {
      mmsi: vessel.mmsi ?? position?.mmsi ?? null,
      imo: vessel.imo ?? position?.imo ?? null,
      name: vessel.name ?? vessel.name_ais ?? position?.vessel_name ?? null,
      callsign: vessel.call_sign ?? null,
      flag: vessel.country ?? vessel.country_code ?? null,
      type: vessel.vessel_type ?? null,
      typeSpecific: null,
      yearBuilt: vessel.year_built ?? null,
    },
    dimensions: {
      length: vessel.length ?? null,
      beam: vessel.breadth ?? null,
      draught: eta?.draught ?? vessel.draught_calculated_avg ?? null,
      grossTonnage: vessel.gross_tonnage ?? null,
      deadweight: vessel.deadweight_tonnage ?? null,
    },
    voyage: {
      destination: eta?.destination ?? null,
      destinationUnlocode: eta?.destination_port ?? null,
      lastPort: null,
      lastPortUnlocode: null,
      eta: eta?.eta ?? null,
      departure: null,
      navStatus:
        typeof position?.nav_status === "number"
          ? navStatusLabel(position.nav_status, sog ?? 0)
          : null,
    },
    management: {
      manager: null,
      owner: null,
      ism: null,
      piClub: null,
    },
    position: {
      lat: position?.latitude ?? null,
      lng: position?.longitude ?? null,
      speed: sog,
      course: position?.cog ?? null,
      heading: position?.heading ?? null,
      receivedAt: position?.timestamp ?? null,
      dataSource: "VesselAPI",
    },
    sources: {
      dataDocked: { status: "offline", detail: "no record returned" },
      vesselApi: source,
    },
    fetchedAt: new Date().toISOString(),
  };
}

/** Prefer the richer DataDocked record, backfill every gap from VesselAPI. */
function mergeIntel(primary: VesselIntel | null, secondary: VesselIntel | null): VesselIntel | null {
  if (!primary) return secondary;
  if (!secondary) return primary;

  const pick = <T,>(a: T, b: T): T => {
    if (a === null || a === undefined || a === "") return b;
    return a;
  };

  return {
    identity: Object.fromEntries(
      Object.keys(primary.identity).map((key) => {
        const k = key as keyof VesselIntel["identity"];
        return [k, pick(primary.identity[k], secondary.identity[k])];
      })
    ) as VesselIntel["identity"],
    dimensions: Object.fromEntries(
      Object.keys(primary.dimensions).map((key) => {
        const k = key as keyof VesselIntel["dimensions"];
        return [k, pick(primary.dimensions[k], secondary.dimensions[k])];
      })
    ) as VesselIntel["dimensions"],
    voyage: Object.fromEntries(
      Object.keys(primary.voyage).map((key) => {
        const k = key as keyof VesselIntel["voyage"];
        return [k, pick(primary.voyage[k], secondary.voyage[k])];
      })
    ) as VesselIntel["voyage"],
    management: Object.fromEntries(
      Object.keys(primary.management).map((key) => {
        const k = key as keyof VesselIntel["management"];
        return [k, pick(primary.management[k], secondary.management[k])];
      })
    ) as VesselIntel["management"],
    position: Object.fromEntries(
      Object.keys(primary.position).map((key) => {
        const k = key as keyof VesselIntel["position"];
        return [k, pick(primary.position[k], secondary.position[k])];
      })
    ) as VesselIntel["position"],
    sources: {
      dataDocked: primary.sources.dataDocked,
      vesselApi: secondary.sources.vesselApi,
    },
    fetchedAt: new Date().toISOString(),
  };
}

export async function getVesselIntel(rawId: string, options: { force?: boolean } = {}): Promise<VesselIntel> {
  const id = rawId.replace(/\D/g, "");
  const cached = cache.get(id);
  if (!options.force && cached && Date.now() - cached.at < INTEL_TTL_MS) {
    return cached.intel;
  }

  const [dd, va] = await Promise.all([fetchDataDockedVessel(id), fetchVesselDetail(id)]);
  reportDataDockedState(dd.source);

  const intel = mergeIntel(fromDataDocked(dd.vessel), fromVesselApi(va.data, va.source));
  const resolved: VesselIntel =
    intel ?? {
      identity: { mmsi: id.length === 9 ? Number(id) : null },
      dimensions: {},
      voyage: {},
      management: {},
      position: {},
      sources: { dataDocked: dd.source, vesselApi: va.source },
      fetchedAt: new Date().toISOString(),
    };

  cache.set(id, { at: Date.now(), intel: resolved });
  if (cache.size > 200) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].at - b[1].at)[0];
    cache.delete(oldest[0]);
  }
  return resolved;
}

export function getIntelCacheStats() {
  return { entries: cache.size };
}
