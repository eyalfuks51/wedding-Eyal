-- ═══════════════════════════════════════════════════════════════════════
-- ROLLBACK for 20260429085225_events_authenticated_active_rls.sql
--
-- Drops the authenticated active-events SELECT policy created by the migration.
-- ═══════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Authenticated can select active events" ON public.events;
