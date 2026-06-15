-- ===============================================================
-- Drop the broad anon SELECT policy on events (draft-leak fix)
-- ===============================================================
-- An orphan policy "Allow anon select on events" USING (true) grants
-- anon SELECT on ALL events, including drafts. It has no migration of
-- origin (created manually) and overrides the correct, narrow policy
-- "Anon can select active events" USING (status = 'active'), because
-- PostgreSQL OR-merges permissive policies for the same role.
--
-- Dropping it restores draft/active gating: anon then sees only
-- status='active' events (via the narrow policy, which is LEFT INTACT).
-- Authenticated access is unchanged (owner/super-admin + active-event
-- mirror remain).
--
-- Paired rollback: supabase/rollback/20260615113000_drop_broad_anon_events_select.down.sql
-- ===============================================================

DROP POLICY IF EXISTS "Allow anon select on events" ON public.events;
