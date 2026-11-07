CREATE TABLE "alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"title" text NOT NULL,
	"shipment_id" uuid,
	"read_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "inventory" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"quantity" numeric(16, 3) DEFAULT '0' NOT NULL,
	"unit" text NOT NULL,
	CONSTRAINT "inventory_warehouse_product_unique" UNIQUE("warehouse_id","product_id"),
	CONSTRAINT "inventory_quantity_nonnegative" CHECK ("inventory"."quantity" >= 0)
);
--> statement-breakpoint
CREATE TABLE "route_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"connection_id" uuid,
	"estimated_cost" numeric(16, 2),
	"currency_code" text,
	CONSTRAINT "route_options_id_owner_unique" UNIQUE("id","owner_id"),
	CONSTRAINT "route_options_cost_nonnegative" CHECK ("route_options"."estimated_cost" is null or "route_options"."estimated_cost" >= 0)
);
--> statement-breakpoint
CREATE TABLE "scenarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"results" text,
	"route_option_id" uuid
);
--> statement-breakpoint
CREATE TABLE "shipments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"tracking_number" text,
	"product_id" uuid,
	"supplier_id" uuid,
	"origin_id" uuid,
	"destination_id" uuid,
	"status" text DEFAULT 'planned' NOT NULL,
	"estimated_arrival" timestamp with time zone,
	CONSTRAINT "shipments_id_owner_unique" UNIQUE("id","owner_id"),
	CONSTRAINT "shipments_status_valid" CHECK ("shipments"."status" in ('planned', 'in_transit', 'delivered', 'delayed', 'cancelled'))
);
--> statement-breakpoint
CREATE TABLE "warehouses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"location_id" uuid,
	CONSTRAINT "warehouses_id_owner_unique" UNIQUE("id","owner_id"),
	CONSTRAINT "warehouses_name_nonempty" CHECK (length(trim("warehouses"."name")) > 0)
);
--> statement-breakpoint
CREATE TABLE "data_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"url" text,
	"license" text,
	CONSTRAINT "sources_name_nonempty" CHECK (length(trim("data_sources"."name")) > 0)
);
--> statement-breakpoint
CREATE TABLE "disruptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"location_id" uuid,
	"source_id" uuid,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	CONSTRAINT "disruptions_dates_ordered" CHECK ("disruptions"."ends_at" is null or "disruptions"."starts_at" is null or "disruptions"."ends_at" >= "disruptions"."starts_at")
);
--> statement-breakpoint
CREATE TABLE "locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"country_code" text NOT NULL,
	"code" text,
	CONSTRAINT "locations_kind_valid" CHECK ("locations"."kind" in ('port', 'airport', 'hub', 'city', 'border'))
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"country_code" text,
	CONSTRAINT "organizations_name_nonempty" CHECK (length(trim("organizations"."name")) > 0)
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"hs_code" text,
	CONSTRAINT "products_name_nonempty" CHECK (length(trim("products"."name")) > 0)
);
--> statement-breakpoint
CREATE TABLE "risk_signals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"title" text NOT NULL,
	"severity" text NOT NULL,
	"location_id" uuid,
	"disruption_id" uuid,
	"source_id" uuid,
	CONSTRAINT "risk_signals_severity_valid" CHECK ("risk_signals"."severity" in ('low', 'medium', 'high', 'critical'))
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"name" text NOT NULL,
	"organization_id" uuid,
	"location_id" uuid,
	"website" text
);
--> statement-breakpoint
CREATE TABLE "transport_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"origin_id" uuid NOT NULL,
	"destination_id" uuid NOT NULL,
	"mode" text NOT NULL,
	"typical_duration_hours" numeric(10, 2),
	CONSTRAINT "connections_distinct_locations" CHECK ("transport_connections"."origin_id" <> "transport_connections"."destination_id"),
	CONSTRAINT "connections_mode_valid" CHECK ("transport_connections"."mode" in ('sea', 'air', 'land')),
	CONSTRAINT "connections_duration_positive" CHECK ("transport_connections"."typical_duration_hours" is null or "transport_connections"."typical_duration_hours" > 0)
);
--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_owner_shipment_fk" FOREIGN KEY ("shipment_id","owner_id") REFERENCES "public"."shipments"("id","owner_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_owner_warehouse_fk" FOREIGN KEY ("warehouse_id","owner_id") REFERENCES "public"."warehouses"("id","owner_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_options" ADD CONSTRAINT "route_options_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_options" ADD CONSTRAINT "route_options_connection_id_transport_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."transport_connections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenarios" ADD CONSTRAINT "scenarios_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scenarios" ADD CONSTRAINT "scenarios_owner_route_fk" FOREIGN KEY ("route_option_id","owner_id") REFERENCES "public"."route_options"("id","owner_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_origin_id_locations_id_fk" FOREIGN KEY ("origin_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_destination_id_locations_id_fk" FOREIGN KEY ("destination_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disruptions" ADD CONSTRAINT "disruptions_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disruptions" ADD CONSTRAINT "disruptions_source_id_data_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."data_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_signals" ADD CONSTRAINT "risk_signals_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_signals" ADD CONSTRAINT "risk_signals_disruption_id_disruptions_id_fk" FOREIGN KEY ("disruption_id") REFERENCES "public"."disruptions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_signals" ADD CONSTRAINT "risk_signals_source_id_data_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."data_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_connections" ADD CONSTRAINT "transport_connections_origin_id_locations_id_fk" FOREIGN KEY ("origin_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_connections" ADD CONSTRAINT "transport_connections_destination_id_locations_id_fk" FOREIGN KEY ("destination_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "alerts_owner_created_idx" ON "alerts" USING btree ("owner_id","created_at");--> statement-breakpoint
CREATE INDEX "inventory_owner_idx" ON "inventory" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "inventory_product_idx" ON "inventory" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "route_options_owner_idx" ON "route_options" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "scenarios_owner_idx" ON "scenarios" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "shipments_owner_created_idx" ON "shipments" USING btree ("owner_id","created_at");--> statement-breakpoint
CREATE INDEX "shipments_product_idx" ON "shipments" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "warehouses_owner_idx" ON "warehouses" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "disruptions_location_idx" ON "disruptions" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "disruptions_source_idx" ON "disruptions" USING btree ("source_id");--> statement-breakpoint
CREATE UNIQUE INDEX "locations_code_unique" ON "locations" USING btree ("kind","code");--> statement-breakpoint
CREATE INDEX "locations_country_idx" ON "locations" USING btree ("country_code");--> statement-breakpoint
CREATE INDEX "risk_signals_location_idx" ON "risk_signals" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "risk_signals_disruption_idx" ON "risk_signals" USING btree ("disruption_id");--> statement-breakpoint
CREATE INDEX "risk_signals_source_idx" ON "risk_signals" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "suppliers_organization_idx" ON "suppliers" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "suppliers_location_idx" ON "suppliers" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "connections_origin_idx" ON "transport_connections" USING btree ("origin_id");--> statement-breakpoint
CREATE INDEX "connections_destination_idx" ON "transport_connections" USING btree ("destination_id");
--> statement-breakpoint
-- Catalog records can be ingested by trusted server processes only.
DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['organizations', 'locations', 'transport_connections', 'products', 'suppliers', 'risk_signals', 'disruptions', 'data_sources'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated', table_name);
    EXECUTE format('GRANT SELECT ON TABLE public.%I TO authenticated', table_name);
    EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role', table_name);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (true)', table_name || '_authenticated_read', table_name);
  END LOOP;
END $$;
--> statement-breakpoint
CREATE FUNCTION public.altair_set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.altair_set_updated_at() FROM PUBLIC;
--> statement-breakpoint
DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['organizations', 'locations', 'transport_connections', 'products', 'suppliers', 'risk_signals', 'disruptions', 'data_sources', 'warehouses', 'shipments', 'inventory', 'route_options', 'scenarios', 'alerts'] LOOP
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.altair_set_updated_at()', table_name || '_updated_at', table_name);
  END LOOP;
END $$;
--> statement-breakpoint
-- Private records always belong to one Supabase Auth identity, including demo identities.
DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['warehouses', 'shipments', 'inventory', 'route_options', 'scenarios', 'alerts'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated', table_name);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated', table_name);
    EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role', table_name);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING ((select auth.uid()) = owner_id)', table_name || '_owner_read', table_name);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = owner_id)', table_name || '_owner_insert', table_name);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING ((select auth.uid()) = owner_id) WITH CHECK ((select auth.uid()) = owner_id)', table_name || '_owner_update', table_name);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING ((select auth.uid()) = owner_id)', table_name || '_owner_delete', table_name);
  END LOOP;
END $$;
