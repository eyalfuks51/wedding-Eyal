-- ═══════════════════════════════════════════════════════════════
-- Fix: allow authenticated users to INSERT/UPDATE/SELECT arrival_permits
-- ═══════════════════════════════════════════════════════════════
-- All existing policies target `anon` only. When an admin (or any
-- logged-in user) tests the public RSVP page, the Supabase client
-- sends the auth token, making the request as `authenticated`.
-- Without matching policies the INSERT is denied with 42501.
-- ═══════════════════════════════════════════════════════════════

CREATE POLICY "Allow authenticated insert" ON arrival_permits FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update" ON arrival_permits FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated select" ON arrival_permits FOR SELECT TO authenticated USING (true);
