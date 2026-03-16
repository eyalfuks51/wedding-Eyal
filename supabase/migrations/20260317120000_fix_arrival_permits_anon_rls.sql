-- ═══════════════════════════════════════════════════════════════
-- Fix: ensure anon users can INSERT/UPDATE/SELECT arrival_permits
-- ═══════════════════════════════════════════════════════════════
-- Policies were defined in 20260221120000 but may not have been
-- applied to production. This migration is fully idempotent.
-- Also ensures RLS is enabled on the table.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE arrival_permits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anon insert" ON arrival_permits;
DROP POLICY IF EXISTS "Allow anon update" ON arrival_permits;
DROP POLICY IF EXISTS "Allow anon select" ON arrival_permits;

CREATE POLICY "Allow anon insert" ON arrival_permits FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon update" ON arrival_permits FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anon select" ON arrival_permits FOR SELECT TO anon USING (true);
