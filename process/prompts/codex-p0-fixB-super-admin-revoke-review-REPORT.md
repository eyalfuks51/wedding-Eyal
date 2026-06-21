VERDICT: APPROVE

- Check 1 (dependency): No legitimate anon/authenticated client-role path depends on `INSERT` or `UPDATE` on `public.users`. The only frontend access to `users` is the super-admin read in `src/contexts/AuthContext.tsx:45`-`47`. Signup creates the mirror row through the `SECURITY DEFINER` trigger `handle_new_auth_user`, which inserts `id/email/full_name/avatar_url` at `supabase/migrations/20260302100000_auth_multitenant_schema.sql:30`-`44` and does not depend on client grants. Onboarding calls `create_onboarding_event` from `src/lib/supabase.js:338`-`348`; that RPC inserts `events` and `user_events`, not `users`, at `supabase/migrations/20260317100000_fix_event_insert_rls.sql:43`-`48`. Repo-wide scans found no `.from('users').insert/update/upsert`, no client RPC that writes `users`, and no SQL `UPDATE public.users` outside the test harness using a direct DB connection.

- Check 2 (rollback fidelity): The rollback is a faithful inverse for the reviewed forward migration. Forward revokes exactly table-level `INSERT, UPDATE` from `anon, authenticated` at `supabase/migrations/20260615140000_users_revoke_self_super_admin.sql:47`. Rollback grants exactly table-level `INSERT, UPDATE` back to the same roles at `supabase/rollback/20260615140000_users_revoke_self_super_admin.down.sql:12`. It does not grant or revoke the already-present `SELECT/DELETE/REFERENCES/TRIGGER/TRUNCATE` privileges, so I see no rollback drift.

- Check 3 (runtime breakage): I do not see an app-used flow that would hit `42501` because of this migration. Super-admin UI still reads `is_super_admin` via `SELECT` (`src/contexts/AuthContext.tsx:45`-`47`), and the existing own-profile `SELECT` policy remains at `supabase/migrations/20260302100100_auth_rls_policies.sql:15`-`17`. Login/signup is handled by Supabase Auth plus the definer trigger above. Onboarding uses the definer RPC and writes only `events/user_events`. Edge functions use service-role clients and write `message_logs`/other non-`users` tables (`supabase/functions/automation-engine/index.ts:91`-`94`, `:276`-`279`; `supabase/functions/whatsapp-scheduler/index.ts:120`-`124`, `:199`-`203`, `:219`-`222`). Profile editing appears unimplemented; the only own-profile `UPDATE` policy at `supabase/migrations/20260302100100_auth_rls_policies.sql:19`-`21` becomes inert because table-level `UPDATE` is removed.

- Sufficiency (self-promote closed?): Yes. After the table-level `UPDATE` privilege is revoked from `authenticated`, `UPDATE public.users SET is_super_admin = true WHERE id = auth.uid()` no longer has the required table privilege, even though the RLS `USING (id = auth.uid())` policy still exists. The revised migration fixes the earlier column-level revoke flaw. I found no reachable `SECURITY DEFINER` function that writes `public.users` or `is_super_admin`; `user_can_manage_event` only reads the flag at `supabase/migrations/20260614120100_rpc_revoke_anon_and_ownership.sql:45`-`48`. I also found no repo migration granting `PUBLIC` table-level writes on `public.users`. A read-only live grant query was attempted but cancelled by the tool/UI, so this conclusion is from disk review plus the prompt's stated live grant facts.

- Findings:
  - None blocking.
  - P2 non-blocking: `supabase/migrations/20260615140000_users_revoke_self_super_admin.sql:43`-`44` explicitly leaves the inert table-level `DELETE` grant on `public.users` in place. I do not consider this part of Fix B because there is no `DELETE` policy on `public.users`, it does not preserve the self-promotion path, and the rollback scope is intentionally only `INSERT/UPDATE`. Track separately if the goal becomes "no client table-level write grants of any kind on users."

- Files actually read:
  - `supabase/migrations/20260615140000_users_revoke_self_super_admin.sql`
  - `supabase/rollback/20260615140000_users_revoke_self_super_admin.down.sql`
  - `src/contexts/AuthContext.tsx`
  - `src/lib/supabase.js`
  - `src/pages/OnboardingPage.tsx`
  - `src/components/auth/ProtectedRoute.tsx`
  - `src/contexts/EventContext.tsx`
  - `supabase/migrations/20260316100000_add_super_admin.sql`
  - `supabase/migrations/20260302100100_auth_rls_policies.sql`
  - `supabase/migrations/20260302100000_auth_multitenant_schema.sql`
  - `supabase/migrations/20260317100000_fix_event_insert_rls.sql`
  - `supabase/migrations/20260317110000_super_admin_full_crud.sql`
  - `supabase/migrations/20260614120100_rpc_revoke_anon_and_ownership.sql`
  - `supabase/migrations/20260615120000_automation_settings_insert_ownership.sql`
  - `src/__tests__/p0-launch-safety.test.ts`
  - `supabase/functions/automation-engine/index.ts`
  - `supabase/functions/sync-to-sheets/index.ts`
  - `supabase/functions/whatsapp-scheduler/index.ts`
  - `supabase/functions/whatsapp-webhook/index.ts`
  - Recursive scans over `src/`, `supabase/`, and `tests/` for `public.users`, `.from('users')`, `is_super_admin`, direct `INSERT/UPDATE public.users`, relevant RPC calls, and table/function grants.
