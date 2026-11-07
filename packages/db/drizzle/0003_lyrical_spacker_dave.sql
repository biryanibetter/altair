ALTER TABLE "locations" DROP CONSTRAINT "locations_kind_valid";--> statement-breakpoint
ALTER TABLE "locations" ADD COLUMN "longitude" numeric(10, 6);--> statement-breakpoint
ALTER TABLE "locations" ADD COLUMN "latitude" numeric(9, 6);--> statement-breakpoint
ALTER TABLE "transport_connections" ADD COLUMN "routing_metadata" jsonb;--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_coordinates_valid" CHECK (("locations"."longitude" is null and "locations"."latitude" is null) or ("locations"."longitude" is not null and "locations"."latitude" is not null and "locations"."longitude" between -180 and 180 and "locations"."latitude" between -90 and 90));--> statement-breakpoint
ALTER TABLE "locations" ADD CONSTRAINT "locations_kind_valid" CHECK ("locations"."kind" in ('port', 'airport', 'terminal', 'hub', 'city', 'border'));--> statement-breakpoint
ALTER TABLE "transport_connections" ADD CONSTRAINT "connections_metadata_valid" CHECK ("transport_connections"."routing_metadata" is null or ((jsonb_typeof("transport_connections"."routing_metadata") = 'object' and "transport_connections"."routing_metadata"->>'version' = '1' and jsonb_typeof("transport_connections"."routing_metadata"->'hypothetical') = 'boolean' and "transport_connections"."routing_metadata"->>'state' in ('open','closed','unknown')) is true));
--> statement-breakpoint
-- One statement snapshot, bounded sentinel rows cause contract validation to fail closed
-- rather than silently dropping connections on a growing network. No private tables.
CREATE FUNCTION public.routing_network_snapshot() RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'nodes', coalesce((SELECT jsonb_agg(to_jsonb(n) ORDER BY n.id) FROM (
      SELECT id,name,kind,country_code,longitude,latitude FROM public.locations ORDER BY id LIMIT 501
    ) n), '[]'::jsonb),
    'edges', coalesce((SELECT jsonb_agg(to_jsonb(e) ORDER BY e.id) FROM (
      SELECT id,origin_id,destination_id,mode,routing_metadata FROM public.transport_connections ORDER BY id LIMIT 2001
    ) e), '[]'::jsonb)
  )
$$;
REVOKE ALL ON FUNCTION public.routing_network_snapshot() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.routing_network_snapshot() TO authenticated;
