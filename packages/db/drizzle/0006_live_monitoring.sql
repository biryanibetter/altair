ALTER TABLE public.provider_observations DROP CONSTRAINT observations_kind_valid;
ALTER TABLE public.provider_observations ADD CONSTRAINT observations_kind_valid CHECK (kind in ('trade','classification','dependency','weather','marine','news','aircraft','vessel','traffic','webcam'));
INSERT INTO public.data_sources(id,name,url,license) VALUES
 ('00000000-0000-4000-8000-000000000005','OpenSky Network','https://opensky-network.org','OpenSky Network API terms; review usage authorization'),
 ('00000000-0000-4000-8000-000000000006','HERE Traffic','https://traffic.hereapi.com','HERE subscription terms; authorized use only'),
 ('00000000-0000-4000-8000-000000000007','AISStream','https://aisstream.io','AISStream API terms; authorized use only') ON CONFLICT DO NOTHING;
INSERT INTO public.data_sources(id,name,url,license) VALUES ('00000000-0000-4000-8000-000000000008','Authorized public webcams','https://altair.invalid','Per-feed reviewed license; no default camera access') ON CONFLICT DO NOTHING;
INSERT INTO public.ingestion_state(job) VALUES ('opensky'),('here-flow'),('here-incidents'),('aisstream'),('webcams') ON CONFLICT DO NOTHING;
--> statement-breakpoint
-- Extend the existing sanitized projection without exposing operational tables.
ALTER FUNCTION public.ingestion_status() RENAME TO ingestion_status_sync;
REVOKE ALL ON FUNCTION public.ingestion_status_sync() FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION public.ingestion_status() RETURNS SETOF jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT status.value || jsonb_build_object('evidenceFreshUntil',
   (SELECT o.data->>'freshUntil' FROM public.provider_observations o
    WHERE o.job=status.value->>'job' AND o.kind IN ('aircraft','vessel','traffic','webcam')
    ORDER BY o.observed_at DESC,o.id LIMIT 1))
 FROM public.ingestion_status_sync() AS status(value);
$$;
REVOKE ALL ON FUNCTION public.ingestion_status() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.ingestion_status() TO authenticated,service_role;
--> statement-breakpoint
ALTER TABLE public.alerts
 ADD COLUMN rule text, ADD COLUMN dedup_key text, ADD COLUMN target_kind text, ADD COLUMN target_id uuid,
 ADD COLUMN severity text NOT NULL DEFAULT 'high', ADD COLUMN state text NOT NULL DEFAULT 'open',
 ADD COLUMN action text, ADD COLUMN evidence jsonb NOT NULL DEFAULT '[]',
 ADD COLUMN occurrence integer NOT NULL DEFAULT 1, ADD COLUMN notification_count integer NOT NULL DEFAULT 0,
 ADD COLUMN acknowledged_at timestamptz, ADD COLUMN resolved_at timestamptz,
 ADD CONSTRAINT alerts_owner_dedup_unique UNIQUE(owner_id,dedup_key),
 ADD CONSTRAINT alerts_state_valid CHECK(state in ('open','acknowledged','resolved')),
 ADD CONSTRAINT alerts_severity_valid CHECK(severity in ('low','medium','high','critical')),
 ADD CONSTRAINT alerts_counters_valid CHECK(occurrence > 0 and notification_count >= 0);
CREATE INDEX alerts_owner_state_id_idx ON public.alerts(owner_id,state,id);
-- Lifecycle replaces client deletion; avoid unauthorizable Realtime DELETE events.
REVOKE DELETE ON public.alerts FROM authenticated;
CREATE TABLE public.monitoring_settings (
 owner_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 config jsonb NOT NULL DEFAULT '{}', revision uuid NOT NULL DEFAULT gen_random_uuid(), last_evaluated_at timestamptz, last_attempt_at timestamptz, error_code text,
 CONSTRAINT monitoring_config_object CHECK(jsonb_typeof(config)='object' and octet_length(config::text)<=65536)
);
ALTER TABLE public.monitoring_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.monitoring_settings FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE ON public.monitoring_settings TO authenticated;
GRANT ALL ON public.monitoring_settings TO service_role;
CREATE POLICY monitoring_owner ON public.monitoring_settings FOR ALL TO authenticated
 USING ((select auth.uid())=owner_id) WITH CHECK ((select auth.uid())=owner_id);
--> statement-breakpoint
CREATE FUNCTION public.monitoring_config_revision() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
DECLARE item jsonb; edge_id text;
BEGIN
 IF TG_OP='UPDATE' THEN
  IF NEW.owner_id <> OLD.owner_id THEN RAISE EXCEPTION 'monitoring_owner_immutable'; END IF;
  IF NEW.config IS DISTINCT FROM OLD.config THEN NEW.revision := gen_random_uuid(); NEW.last_evaluated_at := NULL;
  ELSE NEW.revision := OLD.revision; END IF;
 END IF;
 IF TG_OP='INSERT' OR NEW.config IS DISTINCT FROM OLD.config THEN
  IF jsonb_typeof(coalesce(NEW.config->'shipments','[]'::jsonb)) <> 'array' OR jsonb_typeof(coalesce(NEW.config->'inventories','[]'::jsonb)) <> 'array'
   OR jsonb_typeof(coalesce(NEW.config->'trafficMappings','[]'::jsonb)) <> 'array' THEN RAISE EXCEPTION 'invalid_monitoring_configuration'; END IF;
  IF jsonb_array_length(coalesce(NEW.config->'shipments','[]'))>50 OR jsonb_array_length(coalesce(NEW.config->'inventories','[]'))>10
   OR jsonb_array_length(coalesce(NEW.config->'trafficMappings','[]'))>100 THEN RAISE EXCEPTION 'monitoring_configuration_too_large'; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(coalesce(NEW.config->'shipments','[]'::jsonb)) LOOP
   IF NOT EXISTS(SELECT 1 FROM public.shipments WHERE id=(item->>'shipmentId')::uuid AND owner_id=NEW.owner_id) THEN RAISE EXCEPTION 'monitoring_target_unavailable'; END IF;
   IF jsonb_typeof(item->'edgeIds') IS DISTINCT FROM 'array' OR jsonb_array_length(item->'edgeIds') NOT BETWEEN 1 AND 20 THEN RAISE EXCEPTION 'monitoring_route_mapping_unavailable'; END IF;
   FOR edge_id IN SELECT jsonb_array_elements_text(item->'edgeIds') LOOP
    IF NOT EXISTS(SELECT 1 FROM public.transport_connections WHERE id=edge_id::uuid) THEN RAISE EXCEPTION 'monitoring_route_mapping_unavailable'; END IF;
   END LOOP;
  END LOOP;
  FOR item IN SELECT value FROM jsonb_array_elements(coalesce(NEW.config->'inventories','[]'::jsonb)) LOOP
   IF NOT EXISTS(SELECT 1 FROM public.inventory WHERE id=(item->>'inventoryId')::uuid AND owner_id=NEW.owner_id) THEN RAISE EXCEPTION 'monitoring_target_unavailable'; END IF;
  END LOOP;
  FOR item IN SELECT value FROM jsonb_array_elements(coalesce(NEW.config->'trafficMappings','[]'::jsonb)) LOOP
   IF jsonb_typeof(item->'edgeIds') IS DISTINCT FROM 'array' OR jsonb_array_length(item->'edgeIds') NOT BETWEEN 1 AND 20 THEN RAISE EXCEPTION 'monitoring_route_mapping_unavailable'; END IF;
   FOR edge_id IN SELECT jsonb_array_elements_text(item->'edgeIds') LOOP
    IF NOT EXISTS(SELECT 1 FROM public.transport_connections WHERE id=edge_id::uuid AND mode='land') THEN RAISE EXCEPTION 'monitoring_route_mapping_unavailable'; END IF;
   END LOOP;
  END LOOP;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER monitoring_config_revision BEFORE INSERT OR UPDATE ON public.monitoring_settings FOR EACH ROW EXECUTE FUNCTION public.monitoring_config_revision();
CREATE FUNCTION public.validate_alert_target() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
 IF NEW.rule IS NULL AND NEW.dedup_key IS NULL AND NEW.target_kind IS NULL AND NEW.target_id IS NULL THEN RETURN NEW; END IF;
 IF NEW.rule NOT IN ('disrupted_route','severe_environment','stale_shipment','increased_cost','route_delay','potential_stockout')
   OR NEW.rule IS NULL OR NEW.target_id IS NULL OR NEW.target_kind IS NULL OR NEW.dedup_key IS DISTINCT FROM NEW.rule||':'||NEW.target_kind||':'||NEW.target_id::text THEN RAISE EXCEPTION 'invalid_alert_target'; END IF;
 IF NEW.target_kind='shipment' THEN
   IF NOT EXISTS(SELECT 1 FROM public.shipments WHERE id=NEW.target_id AND owner_id=NEW.owner_id) OR NEW.shipment_id IS DISTINCT FROM NEW.target_id THEN RAISE EXCEPTION 'alert_target_unavailable'; END IF;
 ELSIF NEW.target_kind='inventory' THEN
   IF NOT EXISTS(SELECT 1 FROM public.inventory WHERE id=NEW.target_id AND owner_id=NEW.owner_id) OR NEW.shipment_id IS NOT NULL THEN RAISE EXCEPTION 'alert_target_unavailable'; END IF;
 ELSE RAISE EXCEPTION 'invalid_alert_target'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER validate_alert_target BEFORE INSERT OR UPDATE ON public.alerts FOR EACH ROW EXECUTE FUNCTION public.validate_alert_target();
--> statement-breakpoint
CREATE FUNCTION public.monitoring_snapshot() RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication_required'; END IF;
 INSERT INTO public.monitoring_settings(owner_id) VALUES(auth.uid()) ON CONFLICT DO NOTHING;
 SELECT jsonb_build_object('config',s.config,'revision',s.revision,
  'evaluatedAt',to_char(statement_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
  'intelligence',public.intelligence_snapshot(),
  'shipments',coalesce((SELECT jsonb_agg(to_jsonb(q)) FROM (SELECT id,status,updated_at,route_request FROM public.shipments WHERE owner_id=auth.uid() ORDER BY id LIMIT 101) q),'[]'::jsonb),
  'observations',coalesce((SELECT jsonb_agg(to_jsonb(q)) FROM (
    SELECT DISTINCT ON (o.provider,o.job,o.data->>'providerId') o.* FROM public.provider_observations o
    WHERE o.kind='traffic' AND o.observed_at > statement_timestamp()-interval '24 hours'
      AND o.data->>'providerId' IN (SELECT entry->>'providerId' FROM jsonb_array_elements(coalesce(s.config->'trafficMappings','[]'::jsonb)) entry)
    ORDER BY o.provider,o.job,o.data->>'providerId',o.observed_at DESC,o.fetched_at DESC,o.id LIMIT 5001
  ) q),'[]'::jsonb),
  'inventories',coalesce((SELECT jsonb_agg(public.supply_inventory_snapshot((q->>'inventoryId')::uuid)) FROM jsonb_array_elements(coalesce(s.config->'inventories','[]'::jsonb)) q),'[]'::jsonb)
 ) INTO result FROM public.monitoring_settings s WHERE s.owner_id=auth.uid();
 IF octet_length(result::text)>8000000 THEN RAISE EXCEPTION 'monitoring_snapshot_too_large'; END IF;
 RETURN result;
END; $$;
REVOKE ALL ON FUNCTION public.monitoring_snapshot() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.monitoring_snapshot() TO authenticated;
--> statement-breakpoint
CREATE FUNCTION public.reconcile_monitoring(expected_revision uuid, evaluated_at timestamptz, candidates jsonb, evaluated_keys jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE settings public.monitoring_settings; c jsonb; existing public.alerts; changed integer := 0; key_text text; requested_severity text;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'authentication_required'; END IF;
 SELECT * INTO settings FROM public.monitoring_settings WHERE owner_id=auth.uid() FOR UPDATE;
 IF NOT FOUND OR settings.revision <> expected_revision THEN RAISE EXCEPTION 'monitoring_configuration_changed'; END IF;
 IF evaluated_at IS NULL OR evaluated_at > clock_timestamp()+interval '30 seconds' OR evaluated_at < clock_timestamp()-interval '5 minutes'
  OR evaluated_at <= settings.last_evaluated_at THEN RAISE EXCEPTION 'monitoring_evaluation_superseded'; END IF;
 IF jsonb_typeof(candidates) <> 'array' OR jsonb_typeof(evaluated_keys) <> 'array' OR candidates IS NULL OR evaluated_keys IS NULL
  OR jsonb_array_length(candidates)>1000 OR jsonb_array_length(evaluated_keys)>1000 OR octet_length(candidates::text)>1000000 THEN RAISE EXCEPTION 'invalid_evaluation'; END IF;
 FOR c IN SELECT DISTINCT value FROM jsonb_array_elements(candidates) LOOP
   key_text := c->>'dedupKey'; requested_severity := c->>'severity';
   IF length(c->>'title') NOT BETWEEN 1 AND 200 OR length(c->>'action') NOT BETWEEN 1 AND 1000 OR jsonb_typeof(c->'evidence') IS DISTINCT FROM 'array'
     OR NOT (evaluated_keys ? key_text) THEN RAISE EXCEPTION 'invalid_candidate'; END IF;
   SELECT * INTO existing FROM public.alerts WHERE owner_id=auth.uid() AND dedup_key=key_text FOR UPDATE;
   IF NOT FOUND THEN
     INSERT INTO public.alerts(owner_id,title,shipment_id,rule,dedup_key,target_kind,target_id,severity,action,evidence,notification_count)
       VALUES(auth.uid(),c->>'title',CASE WHEN c->>'targetKind'='shipment' THEN (c->>'targetId')::uuid END,c->>'rule',key_text,c->>'targetKind',(c->>'targetId')::uuid,requested_severity,c->>'action',c->'evidence',1);
     changed := changed+1;
   ELSIF existing.state='resolved' OR array_position(ARRAY['low','medium','high','critical'],requested_severity) > array_position(ARRAY['low','medium','high','critical'],existing.severity) THEN
     UPDATE public.alerts SET title=c->>'title',action=c->>'action',evidence=c->'evidence',severity=requested_severity,
       state='open',read_at=NULL,acknowledged_at=NULL,resolved_at=NULL,updated_at=clock_timestamp(),
       occurrence=occurrence+CASE WHEN existing.state='resolved' THEN 1 ELSE 0 END,
       notification_count=notification_count+1 WHERE id=existing.id AND owner_id=auth.uid();
     changed := changed+1;
   ELSIF existing.severity IS DISTINCT FROM requested_severity OR existing.evidence IS DISTINCT FROM c->'evidence' OR existing.title IS DISTINCT FROM c->>'title' OR existing.action IS DISTINCT FROM c->>'action' THEN
     UPDATE public.alerts SET title=c->>'title',action=c->>'action',evidence=c->'evidence',severity=requested_severity,updated_at=clock_timestamp()
       WHERE id=existing.id AND owner_id=auth.uid();
     changed := changed+1;
   END IF;
 END LOOP;
 WITH resolved AS (UPDATE public.alerts SET state='resolved',resolved_at=clock_timestamp(),updated_at=clock_timestamp()
   WHERE owner_id=auth.uid() AND rule IS NOT NULL AND state<>'resolved' AND evaluated_keys ? dedup_key
    AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(candidates) AS pending(item) WHERE pending.item->>'dedupKey'=dedup_key) RETURNING id)
 SELECT changed+count(*) INTO changed FROM resolved;
 UPDATE public.monitoring_settings SET last_evaluated_at=evaluated_at WHERE owner_id=auth.uid();
 RETURN jsonb_build_object('changed',changed,'evaluatedAt',evaluated_at);
END; $$;
REVOKE ALL ON FUNCTION public.reconcile_monitoring(uuid,timestamptz,jsonb,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.reconcile_monitoring(uuid,timestamptz,jsonb,jsonb) TO authenticated;
CREATE FUNCTION public.transition_alert(alert_id uuid, next_state text) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE result public.alerts;
BEGIN
 IF next_state NOT IN ('acknowledged','resolved') OR next_state IS NULL THEN RAISE EXCEPTION 'invalid_alert_transition'; END IF;
 SELECT * INTO result FROM public.alerts WHERE owner_id=auth.uid() AND id=alert_id FOR UPDATE;
 IF NOT FOUND THEN RETURN NULL; END IF;
 IF result.state=next_state OR result.state='resolved' THEN RETURN to_jsonb(result); END IF;
 UPDATE public.alerts SET state=next_state,updated_at=clock_timestamp(),read_at=coalesce(read_at,clock_timestamp()),
  acknowledged_at=CASE WHEN next_state='acknowledged' THEN clock_timestamp() ELSE acknowledged_at END,
  resolved_at=CASE WHEN next_state='resolved' THEN clock_timestamp() ELSE NULL END
 WHERE owner_id=auth.uid() AND id=alert_id RETURNING * INTO result;
 RETURN to_jsonb(result);
END; $$;
REVOKE ALL ON FUNCTION public.transition_alert(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.transition_alert(uuid,text) TO authenticated;
