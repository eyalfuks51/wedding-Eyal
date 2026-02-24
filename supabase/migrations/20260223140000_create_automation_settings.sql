-- supabase/migrations/20260223140000_create_automation_settings.sql

CREATE TABLE automation_settings (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      uuid        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  stage_name    text        NOT NULL,
  days_before   integer     NOT NULL,
  target_status text        NOT NULL DEFAULT 'pending',
  is_active     boolean     NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS. No anon policies — only service role (edge functions) can access this table.
ALTER TABLE automation_settings ENABLE ROW LEVEL SECURITY;
