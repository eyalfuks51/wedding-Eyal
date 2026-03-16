-- ═══════════════════════════════════════════════════════════════
-- Super Admin — Full CRUD (INSERT + DELETE gaps)
-- ═══════════════════════════════════════════════════════════════
-- Phase 1 migration added SELECT + UPDATE only.
-- Super admins need INSERT + DELETE on all dashboard tables
-- to manage any event (guest import, log cleanup, etc.)
-- ═══════════════════════════════════════════════════════════════

-- ── events ─────────────────────────────────────────────────────

CREATE POLICY "Super admins can insert events"
  ON events FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.is_super_admin = true
    )
  );

CREATE POLICY "Super admins can delete events"
  ON events FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.is_super_admin = true
    )
  );

-- ── invitations ────────────────────────────────────────────────

CREATE POLICY "Super admins can insert invitations"
  ON invitations FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.is_super_admin = true
    )
  );

CREATE POLICY "Super admins can delete invitations"
  ON invitations FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.is_super_admin = true
    )
  );

-- ── message_logs ───────────────────────────────────────────────

CREATE POLICY "Super admins can insert message_logs"
  ON message_logs FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.is_super_admin = true
    )
  );

CREATE POLICY "Super admins can update message_logs"
  ON message_logs FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.is_super_admin = true
    )
  );

CREATE POLICY "Super admins can delete message_logs"
  ON message_logs FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.is_super_admin = true
    )
  );

-- ── automation_settings ────────────────────────────────────────

CREATE POLICY "Super admins can insert automation_settings"
  ON automation_settings FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.is_super_admin = true
    )
  );

CREATE POLICY "Super admins can delete automation_settings"
  ON automation_settings FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.is_super_admin = true
    )
  );
