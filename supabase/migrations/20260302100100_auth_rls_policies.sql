-- ═══════════════════════════════════════════════════════════════
-- Auth RLS Policies — Dashboard Tables
-- ═══════════════════════════════════════════════════════════════

-- Enable RLS on the new tables
ALTER TABLE public.users      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_events ENABLE ROW LEVEL SECURITY;

-- Enable RLS on dashboard tables that may not have it yet
ALTER TABLE events            ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations       ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_logs      ENABLE ROW LEVEL SECURITY;

-- ── users ──────────────────────────────────────────────────────
CREATE POLICY "Users can view own profile"
  ON public.users FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE TO authenticated
  USING (id = auth.uid());

-- ── user_events ────────────────────────────────────────────────
CREATE POLICY "Users can view own event memberships"
  ON public.user_events FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own event memberships"
  ON public.user_events FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- ── events ─────────────────────────────────────────────────────
CREATE POLICY "Authenticated users can select their events"
  ON events FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_events ue
      WHERE ue.event_id = events.id AND ue.user_id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can update their events"
  ON events FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_events ue
      WHERE ue.event_id = events.id AND ue.user_id = auth.uid()
    )
  );

-- Needed for onboarding wizard to insert the new event row
CREATE POLICY "Authenticated users can insert events"
  ON events FOR INSERT TO authenticated
  WITH CHECK (true);

-- ── invitations ────────────────────────────────────────────────
CREATE POLICY "Authenticated users can select invitations"
  ON invitations FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_events ue
      WHERE ue.event_id = invitations.event_id AND ue.user_id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can insert invitations"
  ON invitations FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_events ue
      WHERE ue.event_id = invitations.event_id AND ue.user_id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can update invitations"
  ON invitations FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_events ue
      WHERE ue.event_id = invitations.event_id AND ue.user_id = auth.uid()
    )
  );

-- ── message_logs ───────────────────────────────────────────────
CREATE POLICY "Authenticated users can select message logs"
  ON message_logs FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_events ue
      WHERE ue.event_id = message_logs.event_id AND ue.user_id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can insert message logs"
  ON message_logs FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_events ue
      WHERE ue.event_id = message_logs.event_id AND ue.user_id = auth.uid()
    )
  );

-- ── automation_settings: replace anon with authenticated ───────
DROP POLICY IF EXISTS "Allow anon select automation_settings"  ON automation_settings;
DROP POLICY IF EXISTS "Allow anon update automation_settings"  ON automation_settings;
DROP POLICY IF EXISTS "Allow anon insert automation_settings"  ON automation_settings;

CREATE POLICY "Authenticated users can select automation_settings"
  ON automation_settings FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_events ue
      WHERE ue.event_id = automation_settings.event_id AND ue.user_id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can update automation_settings"
  ON automation_settings FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_events ue
      WHERE ue.event_id = automation_settings.event_id AND ue.user_id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can insert automation_settings"
  ON automation_settings FOR INSERT TO authenticated
  WITH CHECK (
    stage_name IN (
      'icebreaker','nudge','nudge_1','nudge_2','nudge_3',
      'ultimatum','logistics','hangover'
    )
  );

-- ── Grant RPC execute to authenticated ────────────────────────
-- (Previously only anon; authenticated users need these for the dashboard)
GRANT EXECUTE ON FUNCTION update_whatsapp_template(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION toggle_auto_pilot(uuid, boolean)                  TO authenticated;
GRANT EXECUTE ON FUNCTION delete_dynamic_nudge(uuid)                        TO authenticated;
