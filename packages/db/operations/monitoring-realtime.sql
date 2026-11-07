-- OPERATOR TEMPLATE ONLY; not a migration and never auto-activated.
-- Apply reviewed migrations and test two real Supabase Auth users first.
DO $$
DECLARE activate boolean := false;
BEGIN
 IF NOT activate THEN RAISE NOTICE 'ALTAIR alert Realtime activation disabled'; RETURN; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime') THEN
  RAISE EXCEPTION 'Supabase Realtime publication is unavailable';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='alerts') THEN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.alerts;
 END IF;
END $$;
-- Use the existing authenticated Supabase browser client (never a service key):
-- client.channel('my-alerts').on('postgres_changes', {
--   event: 'INSERT', schema: 'public', table: 'alerts', filter: `owner_id=eq.${user.id}`
-- }, refreshAuthorizedAlerts).on('postgres_changes', {
--   event: 'UPDATE', schema: 'public', table: 'alerts', filter: `owner_id=eq.${user.id}`
-- }, refreshAuthorizedAlerts).subscribe()
-- RLS, not the filter/channel name, is the authorization boundary. Refetch after
-- reconnect and on sign-in; remove the channel on sign-out. Changes are signals
-- to refetch, not an exactly-once external-notification transport. Use alert id,
-- occurrence and notification_count to deduplicate toasts. Do not subscribe to
-- DELETE (Realtime cannot apply RLS to deletes). No FULL replica identity needed.
