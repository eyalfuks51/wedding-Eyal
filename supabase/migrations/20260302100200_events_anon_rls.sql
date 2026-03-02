-- ═══════════════════════════════════════════════════════════════
-- Fix: allow anon to SELECT active events for public RSVP pages
-- ═══════════════════════════════════════════════════════════════
-- Task 2 enabled RLS on events with only authenticated policies.
-- Public guests hitting /:slug use the anon key via fetchEventBySlug.
-- Without this policy, all public RSVP pages return no data.
--
-- Draft events intentionally remain hidden from the public —
-- this is the "draft/active" gating feature.
-- ═══════════════════════════════════════════════════════════════

CREATE POLICY "Anon can select active events"
  ON events FOR SELECT TO anon
  USING (status = 'active');
