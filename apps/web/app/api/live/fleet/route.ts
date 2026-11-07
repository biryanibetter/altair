import { getFleetSnapshot } from "@/lib/live/fleet";

/**
 * GET /api/live/fleet
 * Snapshot of live AIS contacts in Qatari waters (cached 15s server-side).
 * Query: ?force=1 bypasses the cache (used by the UI refresh button).
 */
export async function GET(request: Request) {
  const force = new URL(request.url).searchParams.get("force") === "1";
  const snapshot = await getFleetSnapshot({ force });
  return Response.json(snapshot, {
    headers: {
      "cache-control": "no-store",
      "x-data-sources": "vesselapi,aisstream,datadocked",
    },
  });
}
