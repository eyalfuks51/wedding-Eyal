# Codex cross-review: P0 Fix A - revoke client self-grant of event ownership (user_events)

You are an adversarial security reviewer from a different model camp. Review a
single P0 database migration and its paired rollback. Be skeptical. Your job is to
find reasons this is unsafe or breaks the running app, NOT to rubber-stamp it.

## Context
Repo: Wedding RSVP multi-tenant SaaS (React + Supabase). Two client roles: `anon`
(logged-out) and `authenticated` (logged-in). RLS is enabled on all public tables;
blanket table GRANTs to anon/authenticated are the Supabase default, so RLS policies
are the real access control. Ownership of an event is modeled by rows in
public.user_events (user_id, event_id). Nearly every ownership-scoped policy in the
schema resolves ownership via
  EXISTS (SELECT 1 FROM public.user_events ue WHERE ue.event_id = X AND ue.user_id = auth.uid())

## The hole this migration closes (confirmed present on the live DB)
public.user_events has an INSERT policy "Users can insert own event memberships"
TO authenticated WITH CHECK (user_id = auth.uid()) -- it checks only that the new
row's user_id is the caller, NOT that the caller is entitled to join THAT event.
Combined with the table-level INSERT grant on `authenticated`, any logged-in user
can run:
  INSERT INTO public.user_events (user_id, event_id) VALUES (auth.uid(), <ANY event_id>);
and forge ownership of ANY event -> defeats automation_settings policies, the
arrival_permits owner policies (cross-tenant RSVP PII: guest names, phones,
attendance), and the user_can_manage_event() guard used by the P0 RPCs. This is the
authorization-root P0.

Verified live before the fix: policies on user_events are
"Users can insert own event memberships" (INSERT, authenticated, with_check
user_id=auth.uid()) and "Users can view own event memberships" (SELECT,
authenticated, qual user_id=auth.uid()). Table grants: both anon and authenticated
hold INSERT, SELECT, UPDATE, DELETE, REFERENCES, TRIGGER, TRUNCATE.

## The fix
  DROP POLICY IF EXISTS "Users can insert own event memberships" ON public.user_events;
  REVOKE INSERT ON public.user_events FROM anon, authenticated;
Both are table-level / policy-level (no column games). Membership is meant to be
created ONLY by the SECURITY DEFINER create_onboarding_event RPC, which runs as table
owner and bypasses RLS + grants.

## Files to read (open them; do not assume)
- supabase/migrations/20260615140100_user_events_revoke_self_grant.sql  (forward)
- supabase/rollback/20260615140100_user_events_revoke_self_grant.down.sql  (rollback)
- src/lib/supabase.js  (look for every user_events access; confirm SELECT-only from client)
- src/contexts/EventContext.tsx
- src/contexts/AuthContext.tsx
- src/pages/OnboardingPage.tsx
- supabase/migrations/20260317100000_fix_event_insert_rls.sql  (create_onboarding_event RPC: does it INSERT user_events as definer/owner?)
- supabase/migrations/20260302100100_auth_rls_policies.sql  (original user_events policies)
- supabase/functions/  (scan for any function that writes user_events)
- Search the whole repo for writes to user_events (insert/update/upsert/rpc) by a client role.

## Three checks you MUST answer explicitly
1. DEPENDENCY: Does ANY legitimate path (anon, authenticated, edge function, client
   code, RPC called as a client role) depend on anon or authenticated being able to
   INSERT into public.user_events? The migration revokes that. Onboarding is expected
   to create membership via the SECURITY DEFINER create_onboarding_event RPC (runs as
   owner, bypasses the revoke) -- confirm that is the only creation path, or find a
   counterexample with file:line. If any client-role INSERT into user_events is a real
   flow, this breaks it -> flag it P0.
2. ROLLBACK FIDELITY: Is the rollback a faithful inverse? Pre-fix: anon+authenticated
   held table-level INSERT; the policy "Users can insert own event memberships"
   (INSERT, authenticated, WITH CHECK user_id=auth.uid()) existed. The rollback does
   `GRANT INSERT ... TO anon, authenticated` and recreates that exact policy. Any
   drift (wrong role, wrong WITH CHECK, extra/missing grant)? Note the forward does
   NOT touch SELECT/UPDATE/DELETE grants or the SELECT policy -- the rollback must not
   either.
3. RUNTIME BREAKAGE: Would any flow the app actually uses hit `42501 permission denied`
   or otherwise fail after this migration? Onboarding (create_onboarding_event),
   dashboard event-list (reads user_events via the retained SELECT policy), login.
   Confirm the dashboard's ownership reads still work (SELECT policy + SELECT grant are
   untouched).

## Sufficiency check
Explicitly confirm: after this migration, can an `authenticated` client still create
a user_events row by ANY direct client path (PostgREST insert, a non-definer RPC,
default privileges, role inheritance)? If yes, the self-grant ownership exploit is not
fully closed -> P0 BLOCK. (create_onboarding_event as SECURITY DEFINER owner is the
intended, allowed path and is fine.)

## Output contract (FAIL-CLOSED)
When done, write your verdict to:
  process/prompts/codex-p0-fixA-user-events-revoke-review-REPORT.md
Structure:
  VERDICT: APPROVE | REVISE | BLOCK
  - Check 1 (dependency): <finding>
  - Check 2 (rollback fidelity): <finding>
  - Check 3 (runtime breakage): <finding>
  - Sufficiency (self-grant closed?): <finding>
  - Findings: <list each with severity P0/P1/P2 and file:line>
  - Files actually read: <list>
If you cannot complete the review for any reason, write
process/prompts/codex-p0-fixA-user-events-revoke-review-BLOCKED.md with the reason and
current state. Do NOT leave without writing one of the two files. Do NOT modify any
migration, rollback, or source file - this is review only.
