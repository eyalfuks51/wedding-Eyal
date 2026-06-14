-- ═══════════════════════════════════════════════════════════════════════
-- ROLLBACK for 20260614120000_arrival_permits_rls_hardening.sql
--
-- Restores the PRE-migration policy set (broad anon + broad authenticated)
-- and drops submit_rsvp. NOTE: this re-opens the original security holes —
-- only run to recover a broken deploy, never as a steady state.
-- ═══════════════════════════════════════════════════════════════════════

-- Drop hardened policies
DROP POLICY IF EXISTS "Owners can select arrival_permits"        ON public.arrival_permits;
DROP POLICY IF EXISTS "Owners can update arrival_permits"        ON public.arrival_permits;
DROP POLICY IF EXISTS "Owners can insert arrival_permits"        ON public.arrival_permits;
DROP POLICY IF EXISTS "Super admins can select arrival_permits"  ON public.arrival_permits;
DROP POLICY IF EXISTS "Super admins can insert arrival_permits"  ON public.arrival_permits;
DROP POLICY IF EXISTS "Super admins can update arrival_permits"  ON public.arrival_permits;
DROP POLICY IF EXISTS "Super admins can delete arrival_permits"  ON public.arrival_permits;

-- Drop the public RSVP RPC
DROP FUNCTION IF EXISTS public.submit_rsvp(uuid, text, text, boolean, smallint, boolean);

-- Restore original broad policies (matches live state captured 2026-06-14)
CREATE POLICY "Allow anon insert"  ON public.arrival_permits FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon update"  ON public.arrival_permits FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon select"  ON public.arrival_permits FOR SELECT TO anon USING (true);
CREATE POLICY "wedding-policy"     ON public.arrival_permits FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow authenticated insert arrival_permits" ON public.arrival_permits FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated update arrival_permits" ON public.arrival_permits FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated select arrival_permits" ON public.arrival_permits FOR SELECT TO authenticated USING (true);
