VERDICT: BLOCK

- Check 1 (dependency): I found no legitimate app, anon, authenticated, RPC, or edge-function path that needs anon/authenticated to INSERT or UPDATE `users.is_super_admin`. The only signup/profile bootstrap write is `handle_new_auth_user()`, a `SECURITY DEFINER` trigger that inserts only `id`, `email`, `full_name`, and `avatar_url` (`supabase/migrations/20260302100000_auth_multitenant_schema.sql:30`, `supabase/migrations/20260302100000_auth_multitenant_schema.sql:37`). Client code only reads `is_super_admin` for UI/routing (`src/contexts/AuthContext.tsx:45`). Edge functions do not write `public.users`.
- Check 2 (rollback fidelity): The rollback is a faithful inverse of the migration as written: forward revokes column-level `INSERT (is_super_admin), UPDATE (is_super_admin)` (`supabase/migrations/20260615140000_users_revoke_self_super_admin.sql:31`), rollback re-grants exactly those two column-level privileges (`supabase/rollback/20260615140000_users_revoke_self_super_admin.down.sql:11`). It does not touch `SELECT` or `REFERENCES`, which matches the stated intent. However, this fidelity only applies to the insufficient column-only fix below.
- Check 3 (runtime breakage): I found no app flow that should hit `42501` because of losing write access to `users.is_super_admin`: login is OAuth-only (`src/pages/LoginPage.tsx:16`), super-admin rendering uses retained SELECT (`src/contexts/AuthContext.tsx:45`), onboarding calls `create_onboarding_event` (`src/lib/supabase.js:341`) which writes `events` and `user_events`, not `users` (`supabase/migrations/20260317100000_fix_event_insert_rls.sql:22`, `supabase/migrations/20260317100000_fix_event_insert_rls.sql:41`). Profile edits are not implemented in the searched source. The blocker is security correctness, not runtime breakage.

- Findings:
  - P0: `supabase/migrations/20260615140000_users_revoke_self_super_admin.sql:31` revokes only column-level `INSERT/UPDATE` on `users.is_super_admin`. PostgreSQL table-level `INSERT` or `UPDATE ON public.users` still authorizes writes to every column, including `is_super_admin`; revoking a column privilege does not create a deny override against a table-level grant. The prompt context says Supabase has blanket grants to anon/authenticated, and the repo has no migration that revokes table-level `INSERT/UPDATE ON public.users` or re-grants only safe profile columns. If those table-level grants exist live, the authenticated self-promotion exploit remains open after this migration. Fail closed: the fix needs to revoke table-level client writes on `public.users` from anon/authenticated, then grant back only the minimum safe columns if profile editing is required.
  - P1: `src/__tests__/p0-launch-safety.test.ts:156` models `public.users` with authenticated `SELECT` only, and the harness does not load `20260615140000_users_revoke_self_super_admin.sql`. That test setup cannot detect whether the live table-level `UPDATE/INSERT` grants still allow `is_super_admin` writes after the column-only revoke.

- Files actually read:
  - `supabase/migrations/20260615140000_users_revoke_self_super_admin.sql`
  - `supabase/rollback/20260615140000_users_revoke_self_super_admin.down.sql`
  - `src/contexts/AuthContext.tsx`
  - `src/lib/supabase.js`
  - `src/pages/OnboardingPage.tsx`
  - `src/components/auth/ProtectedRoute.tsx`
  - `src/contexts/EventContext.tsx`
  - `src/pages/LoginPage.tsx`
  - `supabase/migrations/20260316100000_add_super_admin.sql`
  - `supabase/migrations/20260302100100_auth_rls_policies.sql`
  - `supabase/migrations/20260302100000_auth_multitenant_schema.sql`
  - `supabase/migrations/20260317100000_fix_event_insert_rls.sql`
  - `supabase/migrations/20260614120100_rpc_revoke_anon_and_ownership.sql`
  - `supabase/migrations/20260615140100_user_events_revoke_self_grant.sql`
  - `supabase/functions/automation-engine/index.ts`
  - `supabase/functions/sync-to-sheets/index.ts`
  - `supabase/functions/whatsapp-scheduler/index.ts`
  - `supabase/functions/whatsapp-webhook/index.ts`
  - `src/__tests__/p0-launch-safety.test.ts`
