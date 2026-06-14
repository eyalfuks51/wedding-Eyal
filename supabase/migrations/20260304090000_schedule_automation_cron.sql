-- ═══════════════════════════════════════════════════════════════════════
-- Schedule WhatsApp Automation Pipeline with pg_cron
--
-- Two cron jobs:
--   1. automation-engine  — evaluates stages daily, queues pending messages
--   2. whatsapp-scheduler — dispatches queued messages every 5 minutes
--
-- PREREQUISITES before applying this migration:
--   1. Enable pg_cron in Supabase Dashboard → Database → Extensions
--   2. Enable pg_net  in Supabase Dashboard → Database → Extensions
--   3. Set the two Supabase secrets below (Project Settings → Functions → Secrets):
--        GREEN_API_INSTANCE_ID
--        GREEN_API_TOKEN
--   4. Store your service_role JWT in Supabase Vault as a secret named
--      'service_role_key'  (Dashboard → Database → Vault → New secret).
--      The cron commands below read it at runtime via vault.decrypted_secrets,
--      so the key is NEVER written into this file or into cron.job command text.
--      (service_role bypasses RLS — never hardcode it in a tracked file.)
--
-- To verify cron jobs after applying:
--   SELECT * FROM cron.job;
-- ═══════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Grant cron usage to postgres superuser role (required on Supabase)
GRANT USAGE ON SCHEMA cron TO postgres;

-- -----------------------------------------------------------------------
-- Job 1: automation-engine — daily at 06:00 UTC (08:00 AM Jerusalem)
--
-- Evaluates all active automation stages for all events.
-- Inserts message_logs rows with status='pending' for eligible invitations.
-- Idempotent: the engine's anti-duplicate key check (invitation_id + phone)
-- prevents double-queuing if run multiple times on the same day.
-- -----------------------------------------------------------------------

SELECT cron.schedule(
  'automation-engine-daily',
  '0 6 * * *',   -- 06:00 UTC = 08:00 Asia/Jerusalem; safely before 09:00 operating window
  $$
  SELECT net.http_post(
    url     := 'https://wpxaalcjcsmhdwvwmtan.supabase.co/functions/v1/automation-engine',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
    ),
    body    := '{}'::jsonb
  ) AS request_id;
  $$
);

-- -----------------------------------------------------------------------
-- Job 2: whatsapp-scheduler — every 5 minutes, around the clock
--
-- The scheduler enforces its own operating-hours gate (Sun–Thu 09–20,
-- Fri 09–13, Sat 20 only, Asia/Jerusalem). Running the cron 24/7 is
-- intentional: outside-hours invocations return immediately with
-- {"skipped": "outside_operating_hours"} — cheap no-ops.
-- -----------------------------------------------------------------------

SELECT cron.schedule(
  'whatsapp-scheduler-every-5min',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url     := 'https://wpxaalcjcsmhdwvwmtan.supabase.co/functions/v1/whatsapp-scheduler',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
    ),
    body    := '{}'::jsonb
  ) AS request_id;
  $$
);
