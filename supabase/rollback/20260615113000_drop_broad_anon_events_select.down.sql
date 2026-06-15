-- ===============================================================
-- ROLLBACK for 20260615113000_drop_broad_anon_events_select.sql
-- ===============================================================
-- Recreates the broad anon SELECT policy exactly as it was before the
-- forward migration (anon SELECT on all events, USING (true)).
-- NOTE: restoring this re-introduces the draft-leak; it exists only to
-- return the database to its precise prior state if the forward
-- migration must be reverted. The narrow "Anon can select active
-- events" policy is independent and is not touched by either file.
-- ===============================================================

CREATE POLICY "Allow anon select on events"
  ON public.events FOR SELECT TO anon
  USING (true);
