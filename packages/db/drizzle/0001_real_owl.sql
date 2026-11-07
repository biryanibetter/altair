CREATE TABLE "ingestion_runs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"job" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone,
	"status" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"error_code" text,
	CONSTRAINT "ingestion_run_status_valid" CHECK ("ingestion_runs"."status" in ('running','success','failed','unconfigured','interrupted'))
);
--> statement-breakpoint
CREATE TABLE "ingestion_state" (
	"job" text PRIMARY KEY NOT NULL,
	"status" text DEFAULT 'never' NOT NULL,
	"last_attempt_at" timestamp with time zone,
	"last_success_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"next_retry_at" timestamp with time zone,
	"error_code" text,
	"cursor" integer DEFAULT 0 NOT NULL,
	"coverage" text DEFAULT 'not-yet-synchronized' NOT NULL,
	"lease_token" uuid,
	"lease_until" timestamp with time zone,
	CONSTRAINT "ingestion_cursor_valid" CHECK ("ingestion_state"."cursor" >= 0),
	CONSTRAINT "ingestion_status_valid" CHECK ("ingestion_state"."status" in ('never','running','success','failed','unconfigured'))
);
--> statement-breakpoint
CREATE TABLE "provider_observations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job" text NOT NULL,
	"provider" text NOT NULL,
	"record_key" text NOT NULL,
	"source_id" uuid NOT NULL,
	"source_url" text NOT NULL,
	"license" text NOT NULL,
	"kind" text NOT NULL,
	"nature" text NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"fetched_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"source_updated_at" timestamp with time zone,
	"data" jsonb NOT NULL,
	CONSTRAINT "observations_nature_valid" CHECK ("provider_observations"."nature" in ('live','historical','estimated','simulated')),
	CONSTRAINT "observations_kind_valid" CHECK ("provider_observations"."kind" in ('trade','classification','dependency','weather','marine','news')),
	CONSTRAINT "observations_expiry_valid" CHECK ("provider_observations"."expires_at" >= "provider_observations"."fetched_at")
);
--> statement-breakpoint
ALTER TABLE "ingestion_runs" ADD CONSTRAINT "ingestion_runs_job_ingestion_state_job_fk" FOREIGN KEY ("job") REFERENCES "public"."ingestion_state"("job") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_observations" ADD CONSTRAINT "provider_observations_source_id_data_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."data_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ingestion_runs_job_started_idx" ON "ingestion_runs" USING btree ("job","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "observations_job_key_unique" ON "provider_observations" USING btree ("job","record_key");--> statement-breakpoint
CREATE INDEX "observations_kind_id_idx" ON "provider_observations" USING btree ("kind","id");--> statement-breakpoint
CREATE INDEX "observations_job_id_idx" ON "provider_observations" USING btree ("job","id");--> statement-breakpoint
CREATE INDEX "observations_source_idx" ON "provider_observations" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "observations_time_idx" ON "provider_observations" USING btree ("observed_at");
--> statement-breakpoint
-- New catalogs follow the existing authenticated-read/trusted-write access model.
ALTER TABLE public.provider_observations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.provider_observations FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.provider_observations TO authenticated;
GRANT ALL ON public.provider_observations TO service_role;
CREATE POLICY observations_authenticated_read ON public.provider_observations FOR SELECT TO authenticated USING (true);
ALTER TABLE public.ingestion_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingestion_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ingestion_state, public.ingestion_runs FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.ingestion_state, public.ingestion_runs TO service_role;
--> statement-breakpoint
INSERT INTO public.data_sources (id, name, url, license) VALUES
 ('00000000-0000-4000-8000-000000000001', 'Qatar Open Data', 'https://www.data.gov.qa', 'CC BY (Qatar Open Data)'),
 ('00000000-0000-4000-8000-000000000002', 'UN Comtrade', 'https://comtradeplus.un.org', 'UN Comtrade terms of use'),
 ('00000000-0000-4000-8000-000000000003', 'Open-Meteo', 'https://open-meteo.com', 'CC BY 4.0; Open-Meteo'),
 ('00000000-0000-4000-8000-000000000004', 'GDELT Project', 'https://www.gdeltproject.org', 'GDELT metadata; publisher rights retained')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.ingestion_state (job) VALUES ('weather'), ('marine'), ('gdelt'), ('qatar-imports'), ('qatar-dependencies'), ('comtrade') ON CONFLICT DO NOTHING;
--> statement-breakpoint
-- Narrow, read-only operational projection. No leases, secrets, raw errors or caller-selected SQL.
CREATE FUNCTION public.ingestion_status() RETURNS SETOF jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object(
    'job', s.job, 'status', s.status,
    'lastAttemptAt', to_char(s.last_attempt_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'lastSuccessAt', to_char(s.last_success_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'expiresAt', to_char(s.expires_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'nextRetryAt', to_char(s.next_retry_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'errorCode', s.error_code, 'cursor', s.cursor, 'coverage', s.coverage,
    'nature', coalesce((SELECT o.nature FROM public.provider_observations o WHERE o.job=s.job ORDER BY o.fetched_at DESC, o.id LIMIT 1), 'unavailable'),
    'recentRuns', coalesce((SELECT jsonb_agg(r.summary ORDER BY r.started_at DESC) FROM (
      SELECT started_at, jsonb_build_object('id', id, 'status', status, 'count', count, 'errorCode', error_code,
        'startedAt', to_char(started_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
        'finishedAt', to_char(finished_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) AS summary
      FROM public.ingestion_runs WHERE job=s.job ORDER BY started_at DESC LIMIT 5
    ) r), '[]'::jsonb)
  ) FROM public.ingestion_state s ORDER BY s.job;
$$;
REVOKE ALL ON FUNCTION public.ingestion_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ingestion_status() TO authenticated, service_role;
