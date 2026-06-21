# Codex cross-review: P0 Fix B - revoke client write access to public.users (TABLE-LEVEL, REVISED)

You are an adversarial security reviewer from a different model camp. Review a
single P0 database migration and its paired rollback. Be skeptical. Your job is to
find reasons this is unsafe or breaks the running app, NOT to rubber-stamp it.

## IMPORTANT: this is a RE-REVIEW of a REVISED migration
An earlier version of this migration used a COLUMN-LEVEL revoke
(`REVOKE INSERT (is_super_admin), UPDATE (is_super_admin)`). You correctly BLOCKED it:
in PostgreSQL a table-level INSERT/UPDATE grant authorizes writes to EVERY column, so
a column-level revoke does not create a deny-override and the self-promotion exploit
stayed open. That finding was applied. The migration now revokes the TABLE-LEVEL
INSERT + UPDATE grants instead. Review the migration AS IT NOW STANDS ON DISK. Do not
assume the old text. Open the files.

## Context
Repo: Wedding RSVP multi-tenant SaaS (React + Supabase). The app uses Supabase
PostgREST with two client roles: `anon` (logged-out) and `authenticated`
(logged-in). Row Level Security (RLS) is enabled on all public tables; blanket
table/column GRANTs to anon/authenticated are the Supabase default, so RLS
policies are the real access control.

## The hole this migration closes (confirmed present on the live DB)
`public.users` has an UPDATE policy "Users can update own profile"
TO authenticated, USING (id = auth.uid()), with NO WITH CHECK. The authenticated
role also holds a TABLE-LEVEL UPDATE grant on `public.users` (Supabase default
`GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated`). Together, any
logged-in user can run `UPDATE public.users SET is_super_admin = true WHERE id =
auth.uid();` and become super-admin, which unlocks the "Super admins can ..."
policies across the schema (full cross-tenant CRUD). anon holds the same
table-level grants but they are inert today (no anon policy on public.users).

Verified live before the fix (information_schema.role_table_grants): both anon and
authenticated hold TABLE-LEVEL SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER,
TRUNCATE on public.users. The forward migration revokes only INSERT + UPDATE.

## Files to read (open them; do not assume)
- supabase/migrations/20260615140000_users_revoke_self_super_admin.sql  (the forward migration)
- supabase/rollback/20260615140000_users_revoke_self_super_admin.down.sql  (the rollback)
- src/contexts/AuthContext.tsx
- src/lib/supabase.js
- src/pages/OnboardingPage.tsx
- src/components/auth/ProtectedRoute.tsx
- src/contexts/EventContext.tsx
- supabase/migrations/20260316100000_add_super_admin.sql
- supabase/migrations/20260302100100_auth_rls_policies.sql
- supabase/migrations/20260302100000_auth_multitenant_schema.sql  (handle_new_auth_user SECURITY DEFINER signup trigger)
- supabase/functions/  (scan for any function that writes public.users or sets is_super_admin)
- Search the whole repo for writes to the `users` table or `is_super_admin` (any insert/update/upsert/rpc).

## Three checks you MUST answer explicitly
1. DEPENDENCY: Does ANY legitimate path (anon, authenticated, edge function,
   client code, RPC) depend on anon or authenticated being able to INSERT or
   UPDATE ANY column of `public.users` as a client role? The migration revokes
   TABLE-LEVEL INSERT + UPDATE from anon and authenticated. If any real path writes
   public.users as a client role (e.g. a profile edit of full_name/avatar_url, an
   upsert, an RPC that is NOT security-definer), this breaks it -> flag it with
   file:line. (Signup creates the users row via the SECURITY DEFINER
   handle_new_auth_user trigger as table owner, which bypasses grants - confirm that
   is the only write path, or find a counterexample.) Note: profile editing being
   unimplemented today is the orchestrator's claim; verify it, do not take it on faith.
2. ROLLBACK FIDELITY: Is the rollback a faithful inverse? Pre-fix state: both anon
   and authenticated held TABLE-LEVEL INSERT + UPDATE (among others) on public.users.
   The forward migration revokes exactly INSERT + UPDATE at the table level. Does the
   rollback `GRANT INSERT, UPDATE ON public.users TO anon, authenticated` exactly
   restore that, and nothing more/less (it must NOT also restore the already-present
   SELECT/DELETE/REFERENCES/TRIGGER/TRUNCATE, which were never revoked)? Any drift?
3. RUNTIME BREAKAGE: Would any flow the app actually uses hit `42501 permission
   denied` or otherwise fail after this migration? Consider: profile edits (if any),
   super-admin UI rendering (reads is_super_admin via SELECT - retained), onboarding
   (create_onboarding_event RPC -> events + user_events, not users), login (OAuth).
   Confirm none of these write public.users as a client role.

## Sufficiency check (the reason for the re-review)
Explicitly confirm: after this migration, with table-level INSERT + UPDATE revoked
from both anon and authenticated, is the `UPDATE public.users SET is_super_admin =
true WHERE id = auth.uid()` self-promotion path actually CLOSED for the authenticated
role? If you believe any residual grant (table-level, column-level, default-privilege,
role inheritance, or SECURITY DEFINER function reachable by a client) still allows a
client role to write is_super_admin, that is a P0 BLOCK - say so.

## Output contract (FAIL-CLOSED)
When done, write your verdict to:
  process/prompts/codex-p0-fixB-super-admin-revoke-review-REPORT.md
Structure:
  VERDICT: APPROVE | REVISE | BLOCK
  - Check 1 (dependency): <finding>
  - Check 2 (rollback fidelity): <finding>
  - Check 3 (runtime breakage): <finding>
  - Sufficiency (self-promote closed?): <finding>
  - Findings: <list each with severity P0/P1/P2 and file:line>
  - Files actually read: <list>
If you cannot complete the review for any reason, write
process/prompts/codex-p0-fixB-super-admin-revoke-review-BLOCKED.md with the reason
and current state. Do NOT leave without writing one of the two files. Do NOT modify
any migration, rollback, or source file - this is review only.
