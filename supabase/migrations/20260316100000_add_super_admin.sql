-- ═══════════════════════════════════════════════════════════════
-- Super Admin — Column + Cross-Event RLS Policies
-- ═══════════════════════════════════════════════════════════════
-- Adds is_super_admin to public.users with DEFAULT false (non-breaking).
-- Adds SELECT/UPDATE policies for super admins on all dashboard tables
-- so a super admin can view and manage any event without being in user_events.
-- Super admin flag is set manually via DB — no UI to set it.
-- ═══════════════════════════════════════════════════════════════

-- 1. Add is_super_admin column to public.users
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_super_admin boolean NOT NULL DEFAULT false;

-- ── events ─────────────────────────────────────────────────────

CREATE POLICY "Super admins can select all events"
  ON events FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.is_super_admin = true
    )
  );

CREATE POLICY "Super admins can update all events"
  ON events FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.is_super_admin = true
    )
  );

-- ── invitations ────────────────────────────────────────────────

CREATE POLICY "Super admins can select all invitations"
  ON invitations FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.is_super_admin = true
    )
  );

CREATE POLICY "Super admins can update all invitations"
  ON invitations FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.is_super_admin = true
    )
  );

-- ── message_logs ───────────────────────────────────────────────

CREATE POLICY "Super admins can select all message_logs"
  ON message_logs FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.is_super_admin = true
    )
  );

-- ── automation_settings ────────────────────────────────────────

CREATE POLICY "Super admins can select all automation_settings"
  ON automation_settings FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.is_super_admin = true
    )
  );

CREATE POLICY "Super admins can update all automation_settings"
  ON automation_settings FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.is_super_admin = true
    )
  );
