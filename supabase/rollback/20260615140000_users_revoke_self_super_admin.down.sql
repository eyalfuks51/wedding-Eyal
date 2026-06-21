-- Rollback for 20260615140000_users_revoke_self_super_admin.sql
-- Faithful inverse: re-grants the table-level INSERT + UPDATE privileges on
-- public.users to anon and authenticated, restoring the exact prior grant state
-- (both roles held table-level SELECT/INSERT/UPDATE/DELETE/REFERENCES/TRIGGER/
-- TRUNCATE pre-fix via Supabase's default GRANT ALL; only INSERT + UPDATE are
-- revoked by the forward migration, so only those two are restored here).
--
-- WARNING: applying this rollback RE-OPENS the self-promotion privilege-escalation
-- hole (any authenticated user can set their own is_super_admin = true). It exists
-- only to return public.users grants to their precise prior state.

GRANT INSERT, UPDATE ON public.users TO anon, authenticated;
