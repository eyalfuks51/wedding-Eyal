# Codex Cross-Review — Guesto P0 Launch-Safety Slice

You are the **mandatory cross-camp reviewer** for a security slice authored by a different model. You run **read-only**: inspect, reason, report. Do **not** modify any file. Your output is a review verdict, not a fix.

## How to inspect
You are running with `-C` pointed at the slice worktree (branch `feature/guesto-p0-launch-safety`). The slice has **no commits yet** — everything is in the working tree. To see it all:

- `git --no-pager diff` — tracked-file modifications.
- `git status -s` — lists untracked new files. Read these in full (they are the core of the slice):
  - `supabase/migrations/20260614120000_arrival_permits_rls_hardening.sql`
  - `supabase/migrations/20260614120100_rpc_revoke_anon_and_ownership.sql`
  - `supabase/migrations/20260614120200_whatsapp_atomic_claim.sql`
  - `supabase/rollback/20260614120000_arrival_permits_rls_hardening.down.sql`
  - `supabase/rollback/20260614120100_rpc_revoke_anon_and_ownership.down.sql`
  - `supabase/rollback/20260614120200_whatsapp_atomic_claim.down.sql`
  - `src/__tests__/p0-launch-safety.test.ts`
  - `src/vite-env.d.ts`
- Modified tracked files of interest: `src/lib/supabase.js`, `src/pages/Dashboard.tsx`, `supabase/functions/whatsapp-scheduler/index.ts`, `supabase/migrations/20260304090000_schedule_automation_cron.sql`, `.gitignore`, `package.json`.

## What this slice is supposed to achieve (the 6 P0 criteria)
**A. Secrets/hygiene** — no service_role key / JWT / pooler URL / temp credential in tracked files; `supabase/.temp/` ignored. (Note: the leaked key remains in git *history* and live prod cron — rotation is reported as external Eyal action, not claimed done. Judge only the tree state + the fix approach.)
**B. Public RSVP safety** — anon cannot SELECT all `arrival_permits`, cannot UPDATE arbitrary rows, cannot direct-INSERT; public RSVP still works via a narrow event-scoped path; authenticated owners manage only their own events.
**C. RPC safety** — anon cannot execute mutation RPCs; every remaining mutation enforces ownership/admin.
**D. WhatsApp dup-send** — scheduler cannot claim the same queued message twice under overlapping runs; atomic claim.
**E. Invite link** — no code path emits `https://yourdomain.com/${slug}`; links use real origin or configured base URL.
**F. Regression safety** — public RSVP, dashboard, onboarding link still work; build/typecheck/tests pass.

## Design facts (context — verify, don't assume)
- Multi-tenant ownership via `user_events(user_id, event_id, role)`; super-admin via `users.is_super_admin`.
- Postgres default `PUBLIC` EXECUTE grant is the root anon-exec hole — fixes must `REVOKE ... FROM PUBLIC`, not only from `anon`.
- `submit_rsvp` (migration A) is the only public write path; it is `SECURITY DEFINER SET search_path = public`, rejects non-active/non-existent events, upserts on `arrival_permits_event_phone_unique`.
- `user_can_manage_event(uuid)` (migration B) is `SECURITY DEFINER`; mutators guard with `IF auth.uid() IS NULL OR NOT public.user_can_manage_event(<eid>) THEN RAISE EXCEPTION ... ERRCODE 42501`.
- `claim_pending_messages(int)` (migration `20260614120200`) does `UPDATE ... pending->processing ... FOR UPDATE SKIP LOCKED RETURNING *`, granted service_role only; scheduler `index.ts` now claims via this RPC before sending. Design is **at-most-once**: there is deliberately NO auto-reclaim of stuck `processing` rows (Green API sends are not idempotent → reclaim would re-message). Stuck rows require manual requeue.
- The cron-migration edit (`20260304090000`) removes a hardcoded service_role JWT, replacing it with a `vault.decrypted_secrets` lookup. This edits an already-applied migration — a deliberate hygiene exception (the secret cannot remain in the tree). For it to work in prod, Eyal must create the vault secret + re-schedule cron (reported as external action).

## Prior review round — your earlier verdict was BLOCK; these 2 findings were fixed. Re-verify them first.
This is **round 2**. In round 1 you (Codex) returned BLOCK with two blocking findings. Both were routed back to the author and fixed. Confirm each fix is correct and complete, then re-judge the whole slice:

1. **`link_permit_to_invitation` cross-tenant write** (was `20260614120100`:~268). Round-1 finding: the ownership guard checked `user_can_manage_event(<permit.event_id>)` but then updated an invitation `p_invitation_id` that could belong to a *different* event → owner of event A could mutate event B's invitation. **Fix applied:** the function now loads the invitation's `event_id` into `v_inv_event_id`, raises if the invitation is missing, and raises `ERRCODE 42501` if `v_inv_event_id <> v_event_id` (the permit's event). Verify both the permit's event AND the invitation's event are now owner-checked and equal. New harness test `C2` proves cross-tenant link raises `/does not belong/` while same-event link succeeds.

2. **WhatsApp stale-reclaim duplicate-send** (was `20260614120200` + `whatsapp-scheduler/index.ts`). Round-1 finding: an auto-reclaim of rows stuck in `processing` past a stale window could re-send an already-delivered message (send succeeded but the `sent` DB update failed, or a worker still alive past the window) — Green API is not idempotent. **Fix applied:** auto-reclaim removed entirely. `claim_pending_messages` is now single-arg `(p_limit int)`, claims only `status='pending'` rows, and never touches `processing` rows. Scheduler comment + migration header rewritten to the at-most-once rationale; stuck rows are left for manual requeue. Verify there is no remaining code path that re-claims a `processing` row. New harness test asserts a 60-min-stale `processing` row is NOT returned by a subsequent claim.

## Already-completed verification (the author's, for your scrutiny — re-derive if you doubt it)
- PGlite harness (`p0-launch-safety.test.ts`) loads the 3 real migration files and asserts B/C/D: **20/20 pass** (incl. the 2 new round-2 tests above). Known limitation: PGlite is single-connection, so true simultaneous `SKIP LOCKED` contention is not shown — only the sequential-overlapping-run disjoint-claim property.
- Live read-only DB readback confirmed every current-state assumption (broad anon policies present, all 9 fn signatures match, new objects absent, `events.status` distribution, unique constraint + `is_super_admin` + `user_events.event_id` present).
- A clean-context migration gate agent returned APPROVE on the 3 new migrations.
- Grep: zero `yourdomain.com`, zero leaked-JWT literal, zero pooler URL in the tracked tree.

## Your job — scrutinize for what the author/gate may have missed
Focus where an adversary or a future bug would live:
1. **Privilege-escalation gaps** — any remaining `PUBLIC`/`anon` EXECUTE on a mutator; any policy with `USING true` left on `arrival_permits`; any mutation RPC missing the ownership guard; `SECURITY DEFINER` without `search_path`.
2. **submit_rsvp** — can it leak another event's data, be used to overwrite arbitrary rows, or bypass the active-event gate? Is the upsert conflict target correct?
3. **Ownership guard correctness** — does `auth.uid()` read the real caller inside the `SECURITY DEFINER` mutators (not the definer)? Any ordering bug where the guard runs after a side-effect?
4. **Atomic claim** — any window where two runs claim the same row? Stale-reclaim logic safe? Does the scheduler still mark sent/failed correctly and never re-process a claimed row?
5. **Frontend wiring** — `src/lib/supabase.js` `submitRsvp` param names/order match the RPC signature; `Dashboard.tsx` invite link uses `import.meta.env.VITE_PUBLIC_BASE_URL || window.location.origin`.
6. **Rollback fidelity** — does each `.down.sql` truly reverse its migration?
7. **Scope creep** — anything changed outside (a) arrival_permits RLS, (b) mutator grant/revoke + ownership, (c) WhatsApp atomic-claim, (d) the secret/hygiene fixes, (e) the invite-link fix.

## Output format (write to your final message)
- `VERDICT: APPROVE | REVISE | BLOCK`
- **Blocking findings** (if any): each with file:line + concrete exploit/failure + required fix.
- **Non-blocking findings**: nits, hardening suggestions.
- **Anything you could not verify** and why.
Be terse, concrete, cite file:line. Do not approve on uncertainty — fail closed.
