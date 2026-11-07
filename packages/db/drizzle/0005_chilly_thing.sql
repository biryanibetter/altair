CREATE TABLE "inventory_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"inventory_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"quantity" numeric(16, 3) NOT NULL,
	"unit" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"idempotency_key" text NOT NULL,
	CONSTRAINT "movements_owner_key_unique" UNIQUE("owner_id","idempotency_key"),
	CONSTRAINT "movements_quantity_positive" CHECK ("inventory_movements"."quantity" > 0),
	CONSTRAINT "movements_kind_valid" CHECK ("inventory_movements"."kind" in ('receipt','consumption','adjustment_in','adjustment_out'))
);
--> statement-breakpoint
CREATE TABLE "planned_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"inventory_id" uuid NOT NULL,
	"quantity" numeric(16, 3) NOT NULL,
	"reserved_quantity" numeric(16, 3) DEFAULT '0' NOT NULL,
	"unit" text NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'planned' NOT NULL,
	CONSTRAINT "orders_quantities_valid" CHECK ("planned_orders"."quantity" > 0 and "planned_orders"."reserved_quantity" between 0 and "planned_orders"."quantity"),
	CONSTRAINT "orders_status_valid" CHECK ("planned_orders"."status" in ('planned','confirmed','fulfilled','cancelled'))
);
--> statement-breakpoint
CREATE TABLE "supplier_capabilities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"supplier_id" uuid NOT NULL,
	"name" text NOT NULL,
	"evidence_id" uuid NOT NULL,
	CONSTRAINT "supplier_capabilities_evidence_unique" UNIQUE("supplier_id","name","evidence_id"),
	CONSTRAINT "supplier_capabilities_name_nonempty" CHECK (length(trim("supplier_capabilities"."name")) > 0)
);
--> statement-breakpoint
CREATE TABLE "supplier_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"supplier_id" uuid NOT NULL,
	"source_url" text NOT NULL,
	"description" text NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"status" text NOT NULL,
	CONSTRAINT "supplier_evidence_id_supplier_unique" UNIQUE("id","supplier_id"),
	CONSTRAINT "supplier_evidence_valid" CHECK ("supplier_evidence"."status" in ('confirmed','inferred') and "supplier_evidence"."expires_at" >= "supplier_evidence"."observed_at")
);
--> statement-breakpoint
CREATE TABLE "supplier_products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"supplier_id" uuid NOT NULL,
	"product_id" uuid,
	"hs_code" text,
	"classification" text,
	"evidence_id" uuid NOT NULL,
	CONSTRAINT "supplier_products_evidence_unique" UNIQUE("supplier_id","product_id","hs_code","classification","evidence_id"),
	CONSTRAINT "supplier_products_classification_valid" CHECK (("supplier_products"."product_id" is not null or "supplier_products"."hs_code" is not null) and ("supplier_products"."hs_code" is null or ("supplier_products"."hs_code" ~ '^[0-9]{2,8}$' and "supplier_products"."classification" is not null)))
);
--> statement-breakpoint
ALTER TABLE "inventory" ADD COLUMN "reserved_quantity" numeric(16, 3) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory" ADD COLUMN "history_start" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_id_owner_unique" UNIQUE("id","owner_id");--> statement-breakpoint
ALTER TABLE "shipments" ADD COLUMN "inventory_id" uuid;--> statement-breakpoint
ALTER TABLE "shipments" ADD COLUMN "quantity" numeric(18, 6);--> statement-breakpoint
ALTER TABLE "shipments" ADD COLUMN "unit" text;--> statement-breakpoint
ALTER TABLE "shipments" ADD COLUMN "confirmed_quantity" numeric(18, 6);--> statement-breakpoint
ALTER TABLE "shipments" ADD COLUMN "verified_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "shipments" ADD COLUMN "route_request" jsonb;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "verification_status" text DEFAULT 'unverified' NOT NULL;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "movements_owner_inventory_fk" FOREIGN KEY ("inventory_id","owner_id") REFERENCES "public"."inventory"("id","owner_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planned_orders" ADD CONSTRAINT "planned_orders_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planned_orders" ADD CONSTRAINT "orders_owner_inventory_fk" FOREIGN KEY ("inventory_id","owner_id") REFERENCES "public"."inventory"("id","owner_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_capabilities" ADD CONSTRAINT "supplier_capabilities_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_capabilities" ADD CONSTRAINT "supplier_capabilities_evidence_fk" FOREIGN KEY ("evidence_id","supplier_id") REFERENCES "public"."supplier_evidence"("id","supplier_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_evidence" ADD CONSTRAINT "supplier_evidence_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_products" ADD CONSTRAINT "supplier_products_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_products" ADD CONSTRAINT "supplier_products_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_products" ADD CONSTRAINT "supplier_products_evidence_fk" FOREIGN KEY ("evidence_id","supplier_id") REFERENCES "public"."supplier_evidence"("id","supplier_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "movements_inventory_time_idx" ON "inventory_movements" USING btree ("inventory_id","occurred_at");--> statement-breakpoint
CREATE INDEX "movements_owner_idx" ON "inventory_movements" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "orders_inventory_due_idx" ON "planned_orders" USING btree ("inventory_id","due_at");--> statement-breakpoint
CREATE INDEX "orders_owner_idx" ON "planned_orders" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "supplier_capabilities_supplier_idx" ON "supplier_capabilities" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "supplier_evidence_supplier_idx" ON "supplier_evidence" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "supplier_products_supplier_idx" ON "supplier_products" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "supplier_products_product_idx" ON "supplier_products" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "supplier_products_hs_idx" ON "supplier_products" USING btree ("classification","hs_code");--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_owner_inventory_fk" FOREIGN KEY ("inventory_id","owner_id") REFERENCES "public"."inventory"("id","owner_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "shipments_inventory_owner_idx" ON "shipments" USING btree ("inventory_id","owner_id");--> statement-breakpoint
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_reservations_valid" CHECK ("inventory"."reserved_quantity" >= 0 and "inventory"."reserved_quantity" <= "inventory"."quantity");--> statement-breakpoint
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_unit_nonempty" CHECK (length(trim("inventory"."unit")) > 0);--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_supply_valid" CHECK (("shipments"."quantity" is null or "shipments"."quantity" > 0) and ("shipments"."confirmed_quantity" is null or ("shipments"."quantity" is not null and "shipments"."confirmed_quantity" between 0 and "shipments"."quantity" and "shipments"."verified_until" is not null)) and ("shipments"."inventory_id" is null or ("shipments"."quantity" is not null and length(trim("shipments"."unit")) > 0) is true));--> statement-breakpoint
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_verification_valid" CHECK ("suppliers"."verification_status" in ('unverified','verified','rejected') and ("suppliers"."verification_status" <> 'verified' or ("suppliers"."verified_at" is not null and "suppliers"."expires_at" > "suppliers"."verified_at") is true));
--> statement-breakpoint
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['inventory_movements','planned_orders'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
    EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON public.%I TO authenticated',t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role',t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING ((select auth.uid())=owner_id) WITH CHECK ((select auth.uid())=owner_id)',t||'_owner',t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['supplier_evidence','supplier_products','supplier_capabilities'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',t);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated',t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role',t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (true)',t||'_read',t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['planned_orders','supplier_evidence','supplier_products','supplier_capabilities'] LOOP
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.altair_set_updated_at()',t||'_updated_at',t);
  END LOOP;
END $$;
--> statement-breakpoint
CREATE FUNCTION public.apply_inventory_movement() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE stock public.inventory;
BEGIN
  -- Preserve Auth's existing account-erasure cascade without granting clients
  -- direct ledger edits/deletes. Inventory foreign keys themselves do not cascade.
  IF TG_OP='DELETE' AND pg_trigger_depth()>1 THEN RETURN OLD; END IF;
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'movement_ledger_immutable'; END IF;
  SELECT * INTO stock FROM public.inventory WHERE id=NEW.inventory_id AND owner_id=NEW.owner_id FOR UPDATE;
  IF stock.id IS NULL OR stock.unit <> NEW.unit OR NEW.occurred_at > statement_timestamp() THEN RAISE EXCEPTION 'invalid_movement'; END IF;
  UPDATE public.inventory SET quantity=quantity + CASE WHEN NEW.kind IN ('receipt','adjustment_in') THEN NEW.quantity ELSE -NEW.quantity END
    WHERE id=stock.id AND owner_id=stock.owner_id;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.apply_inventory_movement() FROM PUBLIC,anon;
CREATE TRIGGER movement_apply BEFORE INSERT OR UPDATE OR DELETE ON public.inventory_movements FOR EACH ROW EXECUTE FUNCTION public.apply_inventory_movement();
--> statement-breakpoint
CREATE FUNCTION public.validate_supply_records() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE stock public.inventory; reserved numeric;
BEGIN
  IF TG_TABLE_NAME='inventory' THEN
    IF TG_OP='UPDATE' AND (NEW.owner_id<>OLD.owner_id OR NEW.product_id<>OLD.product_id OR NEW.unit<>OLD.unit OR NEW.warehouse_id<>OLD.warehouse_id) THEN RAISE EXCEPTION 'inventory_identity_immutable'; END IF;
    SELECT coalesce(sum(reserved_quantity),0) INTO reserved FROM public.planned_orders WHERE inventory_id=NEW.id AND owner_id=NEW.owner_id AND status IN ('planned','confirmed');
    IF NEW.reserved_quantity < reserved THEN RAISE EXCEPTION 'order_reservations_exceed_stock_reservation'; END IF;
    IF NEW.history_start > statement_timestamp() THEN RAISE EXCEPTION 'future_history_start'; END IF;
    RETURN NEW;
  END IF;
  IF TG_TABLE_NAME='planned_orders' AND TG_OP='UPDATE' AND (NEW.inventory_id<>OLD.inventory_id OR NEW.owner_id<>OLD.owner_id) THEN RAISE EXCEPTION 'order_inventory_immutable'; END IF;
  IF NEW.inventory_id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO stock FROM public.inventory WHERE id=NEW.inventory_id AND owner_id=NEW.owner_id FOR UPDATE;
  IF stock.id IS NULL OR stock.unit<>NEW.unit THEN RAISE EXCEPTION 'invalid_supply_unit_or_owner'; END IF;
  IF TG_TABLE_NAME='shipments' THEN
    IF NEW.product_id IS DISTINCT FROM stock.product_id THEN RAISE EXCEPTION 'shipment_product_mismatch'; END IF;
    IF NEW.route_request IS NOT NULL AND ((NEW.route_request->>'originId')::uuid IS DISTINCT FROM NEW.origin_id OR (NEW.route_request->>'destinationId')::uuid IS DISTINCT FROM NEW.destination_id) THEN RAISE EXCEPTION 'shipment_route_mismatch'; END IF;
  ELSE
    SELECT coalesce(sum(reserved_quantity),0) INTO reserved FROM public.planned_orders WHERE inventory_id=NEW.inventory_id AND owner_id=NEW.owner_id AND id<>NEW.id AND status IN ('planned','confirmed');
    IF NEW.status IN ('planned','confirmed') THEN reserved := reserved + NEW.reserved_quantity; END IF;
    IF reserved > stock.reserved_quantity THEN RAISE EXCEPTION 'order_reservations_exceed_stock_reservation'; END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.validate_supply_records() FROM PUBLIC,anon;
CREATE TRIGGER inventory_validate BEFORE INSERT OR UPDATE ON public.inventory FOR EACH ROW EXECUTE FUNCTION public.validate_supply_records();
CREATE TRIGGER orders_validate BEFORE INSERT OR UPDATE ON public.planned_orders FOR EACH ROW EXECUTE FUNCTION public.validate_supply_records();
CREATE TRIGGER shipments_supply_validate BEFORE INSERT OR UPDATE ON public.shipments FOR EACH ROW EXECUTE FUNCTION public.validate_supply_records();
--> statement-breakpoint
CREATE FUNCTION public.supply_inventory_snapshot(stock_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
  SELECT jsonb_build_object('baseline',public.simulation_baseline_snapshot(),
    'inventory',to_jsonb(i)||jsonb_build_object('quantity',i.quantity::text,'reserved_quantity',i.reserved_quantity::text),
    'movements',coalesce((SELECT jsonb_agg(to_jsonb(m)||jsonb_build_object('quantity',m.quantity::text) ORDER BY m.occurred_at,m.id) FROM (SELECT * FROM public.inventory_movements WHERE inventory_id=i.id AND owner_id=i.owner_id AND occurred_at>=statement_timestamp()-interval '365 days' ORDER BY occurred_at,id LIMIT 10001) m),'[]'::jsonb),
    'orders',coalesce((SELECT jsonb_agg(to_jsonb(o)||jsonb_build_object('quantity',o.quantity::text,'reserved_quantity',o.reserved_quantity::text) ORDER BY o.id) FROM (SELECT * FROM public.planned_orders WHERE inventory_id=i.id AND owner_id=i.owner_id AND status IN ('planned','confirmed') ORDER BY id LIMIT 1001) o),'[]'::jsonb),
    'replenishments',coalesce((SELECT jsonb_agg(to_jsonb(s)||jsonb_build_object('quantity',s.quantity::text,'confirmed_quantity',s.confirmed_quantity::text) ORDER BY s.id) FROM (SELECT * FROM public.shipments WHERE inventory_id=i.id AND owner_id=i.owner_id AND status NOT IN ('delivered','cancelled') ORDER BY id LIMIT 101) s),'[]'::jsonb)
  ) FROM public.inventory i WHERE i.id=stock_id AND i.owner_id=(SELECT auth.uid())
$$;
REVOKE ALL ON FUNCTION public.supply_inventory_snapshot(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.supply_inventory_snapshot(uuid) TO authenticated;
--> statement-breakpoint
CREATE FUNCTION public.supply_supplier_snapshot() RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
  SELECT coalesce(jsonb_agg(to_jsonb(s)||jsonb_build_object('country_code',l.country_code,
    'products',coalesce((SELECT jsonb_agg(to_jsonb(p)) FROM (SELECT * FROM public.supplier_products WHERE supplier_id=s.id ORDER BY id LIMIT 1001) p),'[]'::jsonb),
    'capabilities',coalesce((SELECT jsonb_agg(to_jsonb(c)) FROM (SELECT * FROM public.supplier_capabilities WHERE supplier_id=s.id ORDER BY id LIMIT 1001) c),'[]'::jsonb),
    'evidence',coalesce((SELECT jsonb_agg(to_jsonb(e)) FROM (SELECT * FROM public.supplier_evidence WHERE supplier_id=s.id ORDER BY id LIMIT 1001) e),'[]'::jsonb)) ORDER BY s.id),'[]'::jsonb)
  FROM (SELECT * FROM public.suppliers ORDER BY id LIMIT 501) s LEFT JOIN public.locations l ON l.id=s.location_id
$$;
REVOKE ALL ON FUNCTION public.supply_supplier_snapshot() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.supply_supplier_snapshot() TO authenticated;
--> statement-breakpoint
CREATE FUNCTION public.supply_trade_snapshot(filters jsonb) RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
  SELECT coalesce(jsonb_agg(to_jsonb(o) ORDER BY o.id),'[]'::jsonb) FROM (
    SELECT * FROM public.provider_observations WHERE kind='trade' AND data->>'reporter'=filters->>'reporter'
      AND data->>'hsCode'=filters->>'hsCode' AND data->>'classification'=filters->>'classification'
      AND data->>'currency'=filters->>'currency' AND data->>'flow'='import'
      AND (filters->>'provider' IS NULL OR provider=filters->>'provider') ORDER BY id LIMIT 10001
  ) o
$$;
REVOKE ALL ON FUNCTION public.supply_trade_snapshot(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.supply_trade_snapshot(jsonb) TO authenticated;
