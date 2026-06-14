-- ═══════════════════════════════════════════════════════════════
-- Allow authenticated users to SELECT any active event
-- ═══════════════════════════════════════════════════════════════
-- Symptom: a logged-in admin viewing a public RSVP page (/:slug) for
-- an event they are not a member of received 0 rows from the events
-- table (the "authenticated" SELECT policy requires user_events
-- membership). The page hung on a loading spinner.
--
-- Workaround in code: a second Supabase client (supabasePublic) was
-- introduced to force the anon role for public reads. That created
-- two GoTrueClient instances in the same browser context, producing
-- an auth state race when navigating between /dashboard and /:slug.
--
-- Root fix: mirror the anon "status='active'" rule for authenticated.
-- PostgreSQL OR-merges RLS policies for the same role, so authenticated
-- now sees: (events they own via user_events) OR (events with status='active').
-- This lets the single supabase client serve both dashboard and public
-- template reads — supabasePublic can be removed.
-- ═══════════════════════════════════════════════════════════════

CREATE POLICY "Authenticated can select active events"
  ON events FOR SELECT TO authenticated
  USING (status = 'active');
