import { getVesselIntel } from "@/lib/live/intel";

/**
 * GET /api/vessel/[id]
 * Merged vessel intelligence: DataDocked particulars (primary) + VesselAPI
 * position / ETA enrichment. `id` is an IMO (7 digits) or MMSI (9 digits).
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const digits = (id ?? "").replace(/\D/g, "");

  if (digits.length !== 7 && digits.length !== 9) {
    return Response.json(
      {
        error: {
          type: "invalid_request_error",
          code: "invalid_identifier",
          message: "Identifier must be an IMO (7 digits) or MMSI (9 digits).",
        },
      },
      { status: 400 }
    );
  }

  const force = new URL(request.url).searchParams.get("force") === "1";
  const intel = await getVesselIntel(digits, { force });

  return Response.json(intel, {
    headers: { "cache-control": "no-store" },
  });
}
