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
--   4. Replace <PROJECT_REF> with your Supabase project ref (e.g. abcdefghijklmnop)
--   5. Replace <SERVICE_ROLE_KEY> with your service_role JWT key
--      (Project Settings → API → service_role — keep it secret, it bypasses RLS)
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
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndweGFhbGNqY3NtaGR3dndtdGFuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTY0Mzg4NSwiZXhwIjoyMDg3MjE5ODg1fQ.pwgFYCooIQbSsM9yL0juP3rG3x6kRqRJxrDshSCqjjk'
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
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndweGFhbGNqY3NtaGR3dndtdGFuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTY0Mzg4NSwiZXhwIjoyMDg3MjE5ODg1fQ.pwgFYCooIQbSsM9yL0juP3rG3x6kRqRJxrDshSCqjjk'
    ),
    body    := '{}'::jsonb
  ) AS request_id;
  $$
);
