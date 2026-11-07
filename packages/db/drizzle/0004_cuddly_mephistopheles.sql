ALTER TABLE "transport_connections" DROP CONSTRAINT "connections_metadata_valid";--> statement-breakpoint
ALTER TABLE "scenarios" ADD COLUMN "simulation_input" jsonb;--> statement-breakpoint
ALTER TABLE "scenarios" ADD COLUMN "baseline_snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "scenarios" ADD COLUMN "baseline_hash" text;--> statement-breakpoint
ALTER TABLE "scenarios" ADD COLUMN "engine_version" text;--> statement-breakpoint
ALTER TABLE "scenarios" ADD COLUMN "simulation_output" jsonb;--> statement-breakpoint
ALTER TABLE "risk_signals" ADD COLUMN "connection_id" uuid;--> statement-breakpoint
ALTER TABLE "risk_signals" ADD COLUMN "supplier_id" uuid;--> statement-breakpoint
ALTER TABLE "risk_signals" ADD COLUMN "intelligence_metadata" jsonb;--> statement-breakpoint
ALTER TABLE "risk_signals" ADD CONSTRAINT "risk_signals_connection_id_transport_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."transport_connections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_signals" ADD CONSTRAINT "risk_signals_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "scenarios_owner_id_idx" ON "scenarios" USING btree ("owner_id","id");--> statement-breakpoint
CREATE INDEX "risk_signals_connection_idx" ON "risk_signals" USING btree ("connection_id");--> statement-breakpoint
CREATE INDEX "risk_signals_supplier_idx" ON "risk_signals" USING btree ("supplier_id");--> statement-breakpoint
ALTER TABLE "scenarios" ADD CONSTRAINT "scenarios_snapshot_shape" CHECK (("scenarios"."simulation_input" is null and "scenarios"."baseline_snapshot" is null and "scenarios"."baseline_hash" is null and "scenarios"."engine_version" is null and "scenarios"."simulation_output" is null) or (jsonb_typeof("scenarios"."simulation_input") = 'object' and jsonb_typeof("scenarios"."baseline_snapshot") = 'object' and "scenarios"."baseline_hash" is not null and "scenarios"."engine_version" is not null) is true);--> statement-breakpoint
ALTER TABLE "transport_connections" ADD CONSTRAINT "connections_metadata_valid" CHECK ("transport_connections"."routing_metadata" is null or ((jsonb_typeof("transport_connections"."routing_metadata") = 'object' and "transport_connections"."routing_metadata"->>'version' = '1' and jsonb_typeof("transport_connections"."routing_metadata"->'hypothetical') = 'boolean' and "transport_connections"."routing_metadata"->>'state' in ('open','closed','unknown')) is true));
--> statement-breakpoint
CREATE FUNCTION public.risk_evidence_snapshot() RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'signals', coalesce((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.id) FROM (
      SELECT id,location_id,connection_id,supplier_id,intelligence_metadata FROM public.risk_signals ORDER BY id LIMIT 1001
    ) r), '[]'::jsonb),
    'observations', coalesce((SELECT jsonb_agg(to_jsonb(o) ORDER BY o.id) FROM (
      SELECT * FROM public.provider_observations WHERE kind IN ('weather','marine','news')
        AND observed_at >= statement_timestamp() - interval '7 days'
      ORDER BY observed_at DESC,id LIMIT 5001
    ) o), '[]'::jsonb)
  )
$$;
REVOKE ALL ON FUNCTION public.risk_evidence_snapshot() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.risk_evidence_snapshot() TO authenticated;
--> statement-breakpoint
CREATE FUNCTION public.intelligence_snapshot() RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT jsonb_build_object('network',public.routing_network_snapshot(),'riskEvidence',public.risk_evidence_snapshot())
$$;
REVOKE ALL ON FUNCTION public.intelligence_snapshot() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.intelligence_snapshot() TO authenticated;
--> statement-breakpoint
CREATE FUNCTION public.simulation_baseline_snapshot() RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'version',1,'evaluatedAt',statement_timestamp(),'network',public.routing_network_snapshot(),
    'riskEvidence',public.risk_evidence_snapshot(),
    'inventory', coalesce((SELECT jsonb_agg(to_jsonb(i) ORDER BY i.id) FROM (
      SELECT id,warehouse_id,product_id,quantity::text,unit,updated_at FROM public.inventory ORDER BY id LIMIT 1001
    ) i),'[]'::jsonb),
    'shipments', coalesce((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.id) FROM (
      SELECT id,product_id,supplier_id,origin_id,destination_id,status,estimated_arrival,updated_at FROM public.shipments ORDER BY id LIMIT 1001
    ) s),'[]'::jsonb),
    'supplierIds',coalesce((SELECT jsonb_agg(s.id ORDER BY s.id) FROM (
      SELECT id FROM public.suppliers WHERE id IN (SELECT supplier_id FROM public.shipments) ORDER BY id LIMIT 1001
    ) s),'[]'::jsonb),
    'references',jsonb_build_object(
      'snapshotFormat','postgres-invoker-v1','riskEvidenceWindow','7 days, explicit bounded coverage',
      'locations',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'updatedAt',updated_at) ORDER BY id) FROM (SELECT id,updated_at FROM public.locations ORDER BY id LIMIT 501) n),'[]'::jsonb),
      'connections',coalesce((SELECT jsonb_agg(jsonb_build_object('id',id,'updatedAt',updated_at) ORDER BY id) FROM (SELECT id,updated_at FROM public.transport_connections ORDER BY id LIMIT 2001) e),'[]'::jsonb)
    )
  )
$$;
REVOKE ALL ON FUNCTION public.simulation_baseline_snapshot() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.simulation_baseline_snapshot() TO authenticated;
--> statement-breakpoint
-- Invoker trigger captures operational data with the caller's RLS, in the INSERT
-- statement's snapshot. A direct client insert cannot supply an invented baseline.
CREATE FUNCTION public.validate_simulation_targets(snapshot jsonb, input jsonb) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE m jsonb; r jsonb; s jsonb; d jsonb; stock jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(snapshot->'network'->'nodes') n WHERE n->>'id'=input->'routeRequest'->>'originId')
    OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(snapshot->'network'->'nodes') n WHERE n->>'id'=input->'routeRequest'->>'destinationId')
    THEN RAISE EXCEPTION 'invalid_scenario_targets'; END IF;
  IF coalesce((input->>'hypothetical')::boolean,false)=false AND EXISTS (SELECT 1 FROM jsonb_array_elements(snapshot->'network'->'edges') e WHERE e->'routing_metadata'->>'hypothetical'='true') THEN RAISE EXCEPTION 'invalid_scenario_targets'; END IF;
  FOR m IN SELECT * FROM jsonb_array_elements(input->'modifications') LOOP
    IF m->>'kind'='connection' AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(snapshot->'network'->'edges') e WHERE e->>'id'=m->>'edgeId') THEN RAISE EXCEPTION 'invalid_scenario_targets'; END IF;
    IF m->>'kind'='supplier_unavailable' AND NOT (snapshot->'supplierIds' ? (m->>'supplierId')) THEN RAISE EXCEPTION 'invalid_scenario_targets'; END IF;
    IF m->>'kind'='inventory_reduction' THEN
      SELECT i INTO stock FROM jsonb_array_elements(snapshot->'inventory') i WHERE i->>'id'=m->>'inventoryId';
      IF stock IS NULL OR (m->>'quantity')::numeric > (stock->>'quantity')::numeric THEN RAISE EXCEPTION 'invalid_scenario_targets'; END IF;
    END IF;
    IF m->>'kind'='demand_increase' AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(input->'demand') dd WHERE dd->>'productId'=m->>'productId' AND dd->>'unit'=m->>'unit') THEN RAISE EXCEPTION 'invalid_scenario_targets'; END IF;
    IF m->>'kind'='replenishment_delay' AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(input->'replenishments') rr WHERE rr->>'shipmentId'=m->>'shipmentId') THEN RAISE EXCEPTION 'invalid_scenario_targets'; END IF;
  END LOOP;
  FOR r IN SELECT * FROM jsonb_array_elements(input->'replenishments') LOOP
    SELECT sh INTO s FROM jsonb_array_elements(snapshot->'shipments') sh WHERE sh->>'id'=r->>'shipmentId';
    IF s IS NULL OR s->>'product_id' IS NULL THEN RAISE EXCEPTION 'invalid_scenario_targets'; END IF;
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(snapshot->'inventory') i WHERE i->>'product_id'=s->>'product_id' AND i->>'unit'<>r->>'unit')
      OR EXISTS (SELECT 1 FROM jsonb_array_elements(input->'demand') dd WHERE dd->>'productId'=s->>'product_id' AND dd->>'unit'<>r->>'unit')
      THEN RAISE EXCEPTION 'invalid_scenario_targets'; END IF;
    IF r ? 'routeRequest' AND ((r->'routeRequest'->>'originId') IS DISTINCT FROM (s->>'origin_id') OR (r->'routeRequest'->>'destinationId') IS DISTINCT FROM (s->>'destination_id')) THEN RAISE EXCEPTION 'invalid_scenario_targets'; END IF;
  END LOOP;
  FOR d IN SELECT * FROM jsonb_array_elements(input->'demand') LOOP
    IF EXISTS (SELECT 1 FROM jsonb_array_elements(snapshot->'inventory') i WHERE i->>'product_id'=d->>'productId' AND i->>'unit'<>d->>'unit') THEN RAISE EXCEPTION 'invalid_scenario_targets'; END IF;
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.validate_simulation_targets(jsonb,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.validate_simulation_targets(jsonb,jsonb) TO authenticated;
--> statement-breakpoint
CREATE FUNCTION public.protect_simulation_snapshot() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.simulation_input IS NOT NULL THEN
      IF auth.uid() IS NULL OR NEW.owner_id <> auth.uid() THEN RAISE EXCEPTION 'unauthorized'; END IF;
      IF NEW.engine_version <> 'altair-twin-1.0.0' OR NEW.engine_version IS NULL THEN RAISE EXCEPTION 'unsupported_engine_version'; END IF;
      IF octet_length(NEW.simulation_input::text) > 65536 THEN RAISE EXCEPTION 'input_too_large'; END IF;
      NEW.baseline_snapshot := public.simulation_baseline_snapshot();
      IF octet_length(NEW.baseline_snapshot::text) > 2000000 THEN RAISE EXCEPTION 'snapshot_too_large'; END IF;
      PERFORM public.validate_simulation_targets(NEW.baseline_snapshot,NEW.simulation_input);
      NEW.baseline_hash := md5(NEW.baseline_snapshot::text);
      NEW.simulation_output := NULL;
    END IF;
  ELSE
    IF NEW.simulation_input IS DISTINCT FROM OLD.simulation_input
      OR NEW.baseline_snapshot IS DISTINCT FROM OLD.baseline_snapshot
      OR NEW.baseline_hash IS DISTINCT FROM OLD.baseline_hash
      OR NEW.engine_version IS DISTINCT FROM OLD.engine_version
      OR (OLD.simulation_input IS NOT NULL AND (NEW.owner_id IS DISTINCT FROM OLD.owner_id OR NEW.id IS DISTINCT FROM OLD.id OR NEW.created_at IS DISTINCT FROM OLD.created_at))
      THEN RAISE EXCEPTION 'immutable_simulation_snapshot'; END IF;
    IF OLD.simulation_output IS NOT NULL AND NEW.simulation_output IS DISTINCT FROM OLD.simulation_output THEN RAISE EXCEPTION 'immutable_simulation_output'; END IF;
    IF NEW.simulation_output IS NOT NULL AND octet_length(NEW.simulation_output::text) > 8000000 THEN RAISE EXCEPTION 'output_too_large'; END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.protect_simulation_snapshot() FROM PUBLIC, anon;
CREATE TRIGGER scenarios_protect_snapshot BEFORE INSERT OR UPDATE ON public.scenarios FOR EACH ROW EXECUTE FUNCTION public.protect_simulation_snapshot();
--> statement-breakpoint
CREATE FUNCTION public.create_simulation(input jsonb, version text) RETURNS jsonb
LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = '' SET statement_timeout = '5s' AS $$
  INSERT INTO public.scenarios(owner_id,name,simulation_input,engine_version)
  VALUES (auth.uid(),input->>'name',input,version) RETURNING to_jsonb(scenarios.*)
$$;
REVOKE ALL ON FUNCTION public.create_simulation(jsonb,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_simulation(jsonb,text) TO authenticated;
--> statement-breakpoint
CREATE FUNCTION public.finish_simulation(scenario_id uuid, output jsonb) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path = '' SET statement_timeout = '5s' SET lock_timeout = '2s' AS $$
DECLARE saved public.scenarios;
BEGIN
  SELECT * INTO saved FROM public.scenarios WHERE id=scenario_id AND owner_id=auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF saved.engine_version <> 'altair-twin-1.0.0' OR saved.simulation_input IS NULL THEN RAISE EXCEPTION 'unsupported_engine_version'; END IF;
  IF saved.simulation_output IS NOT NULL THEN
    IF saved.simulation_output IS DISTINCT FROM output THEN RAISE EXCEPTION 'execution_conflict'; END IF;
    RETURN to_jsonb(saved);
  END IF;
  UPDATE public.scenarios SET simulation_output=output WHERE id=scenario_id RETURNING * INTO saved;
  RETURN to_jsonb(saved);
END $$;
REVOKE ALL ON FUNCTION public.finish_simulation(uuid,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finish_simulation(uuid,jsonb) TO authenticated;
--> statement-breakpoint
-- Avoid loading up to 100 full multi-megabyte outputs just to return list status.
CREATE FUNCTION public.list_simulations(page_limit integer DEFAULT 21, after_id uuid DEFAULT NULL)
RETURNS TABLE(id uuid,name text,created_at timestamptz,engine_version text,executed boolean)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' SET statement_timeout = '5s' AS $$
  SELECT s.id,s.name,s.created_at,s.engine_version,(s.simulation_output IS NOT NULL)
  FROM public.scenarios s
  WHERE s.owner_id=auth.uid() AND s.simulation_input IS NOT NULL AND (after_id IS NULL OR s.id>after_id)
  ORDER BY s.id LIMIT greatest(1,least(page_limit,101))
$$;
REVOKE ALL ON FUNCTION public.list_simulations(integer,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_simulations(integer,uuid) TO authenticated;
