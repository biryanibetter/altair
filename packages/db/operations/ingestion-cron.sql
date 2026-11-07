-- OPERATOR TEMPLATE ONLY. Not a migration. Never automatically executed.
-- Enable pg_cron, pg_net and Supabase Vault in the dashboard first.
-- In Vault create altair_base_url (https://your-vercel-deployment) and
-- altair_ingestion_secret (same >=32-character secret as Vercel INGESTION_SECRET).
-- If Vercel deployment protection is enabled, add altair_vercel_bypass to Vault
-- and configure that deployment's automation bypass. Never commit secret values.
-- Review schedules/quotas and authenticate one manual POST before activation.
DO $$
DECLARE
  activate boolean := false; -- Leave false until deployment/authentication are verified.
  enable_transport boolean := false; -- Separate provider license/quota approval required.
  schedules jsonb := '{"weather":"5 * * * *", "marine":"10 * * * *", "gdelt":"*/15 * * * *", "qatar-imports":"*/5 * * * *", "qatar-dependencies":"10 2 * * *", "comtrade":"20 2 * * *", "monitoring":"*/5 * * * *"}';
  item record;
  command text;
BEGIN
  IF NOT activate THEN
    RAISE NOTICE 'ALTAIR production schedules are inactive; no jobs created or changed.';
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name='altair_base_url' AND decrypted_secret LIKE 'https://%')
    OR NOT EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name='altair_ingestion_secret' AND length(decrypted_secret)>=32) THEN
    RAISE EXCEPTION 'Configure ALTAIR Vault URL and ingestion secret before activating schedules';
  END IF;
  IF enable_transport THEN
    schedules := schedules || '{"opensky":"*/5 * * * *", "here-flow":"*/5 * * * *", "here-incidents":"*/5 * * * *"}'::jsonb;
  END IF;
  -- AISStream is deliberately absent: no supported HTTP polling fallback.
  FOR item IN SELECT key AS job, value AS schedule FROM jsonb_each_text(schedules) LOOP
    command := format($cmd$
      SELECT net.http_post(
        url := rtrim((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='altair_base_url'), '/') || %L,
        headers := jsonb_strip_nulls(jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='altair_ingestion_secret'),
          'x-vercel-protection-bypass', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='altair_vercel_bypass')
        )), body := '{}'::jsonb, timeout_milliseconds := 60000
      );
    $cmd$, CASE WHEN item.job='monitoring' THEN '/api/internal/monitoring' ELSE '/api/internal/ingestion/' || item.job END);
    PERFORM cron.schedule('altair-' || item.job, item.schedule, command);
  END LOOP;
END $$;

-- Pause individual jobs after activation (manual operator action only):
-- SELECT cron.alter_job(jobid, active := false) FROM cron.job WHERE jobname='altair-weather';
-- Monitor cron.job_run_details AND net._http_response: successful SQL dispatch
-- does not mean HTTP ingestion succeeded. Inspect ingestion_runs separately.
