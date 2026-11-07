-- Local migration only. Hosted activation requires separate authorization.
CREATE TABLE public.shipment_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 shipment_id uuid NOT NULL,
 kind text NOT NULL CHECK(kind IN ('milestone','note','route_saved','quotation_request','reroute_request','partner_response')),
 title text NOT NULL CHECK(length(title) BETWEEN 1 AND 200),
 note text NOT NULL DEFAULT '' CHECK(length(note)<=4000),
 source text NOT NULL DEFAULT 'owner' CHECK(source IN ('owner','carrier_document')),
 occurred_at timestamptz NOT NULL DEFAULT now(), created_at timestamptz NOT NULL DEFAULT now(),
 idempotency_key text NOT NULL CHECK(length(idempotency_key) BETWEEN 1 AND 100),
 payload jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(payload)='object' AND octet_length(payload::text)<=262144),
 request_id uuid REFERENCES public.shipment_events(id), decision text CHECK(decision IN ('confirmed','rejected')),
 FOREIGN KEY(shipment_id,owner_id) REFERENCES public.shipments(id,owner_id),
 UNIQUE(owner_id,idempotency_key), UNIQUE(request_id)
);
CREATE INDEX shipment_events_owner_shipment_idx ON public.shipment_events(owner_id,shipment_id,created_at,id);
ALTER TABLE public.shipment_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.shipment_events FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.shipment_events TO authenticated;
GRANT ALL ON public.shipment_events TO service_role;
CREATE POLICY shipment_events_owner_read ON public.shipment_events FOR SELECT TO authenticated USING ((select auth.uid())=owner_id);
--> statement-breakpoint
CREATE FUNCTION public.shipping_event(target uuid, input jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid := auth.uid(); previous public.shipment_events; result public.shipment_events; shipment public.shipments; requested public.shipment_events; next_status text;
BEGIN
 IF actor IS NULL THEN RAISE EXCEPTION 'unauthorized' USING ERRCODE='42501'; END IF;
 SELECT * INTO shipment FROM public.shipments WHERE id=target AND owner_id=actor FOR UPDATE;
 IF NOT FOUND THEN RETURN NULL; END IF;
 IF jsonb_typeof(input)<>'object' OR octet_length(input::text)>262144 OR coalesce(length(input->>'idempotencyKey'),0) NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'invalid_event' USING ERRCODE='22023'; END IF;
 SELECT * INTO previous FROM public.shipment_events WHERE owner_id=actor AND idempotency_key=input->>'idempotencyKey';
 IF FOUND THEN
   IF previous.shipment_id<>target OR previous.kind<>input->>'kind' THEN RAISE EXCEPTION 'idempotency_conflict' USING ERRCODE='40001'; END IF;
   RETURN to_jsonb(previous);
 END IF;
 IF input->>'kind'='partner_response' THEN
   SELECT * INTO requested FROM public.shipment_events WHERE id=(input->>'requestId')::uuid AND owner_id=actor AND shipment_id=target AND kind IN ('quotation_request','reroute_request');
   IF NOT FOUND OR coalesce(input->>'decision','') NOT IN ('confirmed','rejected') OR coalesce(length(input->>'note'),0)<1 THEN RAISE EXCEPTION 'invalid_request_response' USING ERRCODE='22023'; END IF;
   IF EXISTS(SELECT 1 FROM public.shipment_events WHERE request_id=requested.id) THEN RAISE EXCEPTION 'request_already_answered' USING ERRCODE='40001'; END IF;
 ELSIF input ? 'requestId' OR input ? 'decision' THEN RAISE EXCEPTION 'invalid_request_response' USING ERRCODE='22023';
 END IF;
 IF input->>'kind'='milestone' THEN
   next_status := input->>'status';
   IF next_status NOT IN ('planned','in_transit','delayed','delivered','cancelled') OR next_status IS NULL THEN RAISE EXCEPTION 'invalid_shipment_status' USING ERRCODE='22023'; END IF;
   IF shipment.status IN ('delivered','cancelled') AND shipment.status<>next_status THEN RAISE EXCEPTION 'terminal_shipment' USING ERRCODE='40001'; END IF;
   UPDATE public.shipments SET status=next_status, updated_at=now(), estimated_arrival=coalesce((input->>'estimatedArrival')::timestamptz,estimated_arrival), tracking_number=coalesce(input->>'trackingNumber',tracking_number) WHERE id=target AND owner_id=actor;
 END IF;
 INSERT INTO public.shipment_events(owner_id,shipment_id,kind,title,note,source,occurred_at,idempotency_key,payload,request_id,decision)
 VALUES(actor,target,input->>'kind',input->>'title',coalesce(input->>'note',''),coalesce(input->>'source','owner'),coalesce((input->>'occurredAt')::timestamptz,now()),input->>'idempotencyKey',coalesce(input->'payload','{}'),(input->>'requestId')::uuid,input->>'decision') RETURNING * INTO result;
 RETURN to_jsonb(result);
END $$;
REVOKE ALL ON FUNCTION public.shipping_event(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.shipping_event(uuid,jsonb) TO authenticated;
