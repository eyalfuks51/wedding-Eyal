# P0 RLS Apply — RESUME STATE (paused 2026-06-15, resume 2026-06-16)

> Cold-resume note for the P0 security migration apply slice. Written because
> the slice was paused mid-chain waiting on a Codex rate-limit reset. Read this
> top to bottom before doing anything. **Do NOT waive the Codex cross-review.**

## Why we paused
Codex hit its usage limit (`try again Jun 18` per the error), but Eyal has a
separate 30-day rate-limit reset he activates **2026-06-16**, so cross-review
becomes available again then. The framework requires dual-camp review (Gate
Agent = Opus + Codex = other camp) on every migration; with Codex down we
fail-closed and stop rather than apply on Gate-Agent-alone. This is a pause, not
a skip.

## Target database (verify fresh before ANY remote-changing command)
- **Project ref:** `wpxaalcjcsmhdwvwmtan`, db `postgres`. This is the ONLY
  allowed target. Eyal is collaborator-only on `appbizlist`
  (`ukhhegrdvpmvipazvyth`) and on `the-grind-fantasy` — never touch those.
- Per the slice framework, re-establish target identity from converging
  evidence (repo config + dispatch + live readback) before applying. Do not
  trust a single source. Conflict = fail-closed + flag Eyal.

## Apply + readback tooling
- **Controlled single-apply:** `C:\Users\Eyal\p0-apply\apply.js`
  - Atomic `BEGIN` -> run the migration file -> `COMMIT`. Pinned Supabase Root
    2021 CA, fp256 `80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA`.
  - Needs `PG_CONN` env var (do NOT hardcode secrets in the script). Conn shape:
    `postgresql://postgres.wpxaalcjcsmhdwvwmtan:<DB_PASSWORD>@aws-1-eu-central-1.pooler.supabase.com:5432/postgres`
    (password must be URL-encoded). On success prints `APPLY_OK`.
  - **GAP:** apply.js does NOT insert into `supabase_migrations.schema_migrations`.
    Every migration applied through it leaves the version row missing. See
    "schema_migrations reconciliation" below.
- **Read runner:** `C:\Users\Eyal\p0-apply\q.js` (same PG_CONN), and the MCP
  read-only channel `mcp__supabase-db__query` (param `sql`) — the preferred
  readback path (Hebrew-safe, no terminal reversal). The slice rule: Hebrew /
  state verified by DB readback, never terminal output.

## RECONCILED LEDGER — live-verified 2026-06-15 (this supersedes the summary)

The pre-pause summary listed #4 and #5 as "pending apply." **That was wrong** —
a conflation of review-status with apply-status. Live readback proves both are
already applied AND recorded. Ground truth:

| Migration | Live DB state | schema_migrations | Action remaining |
|---|---|---|---|
| `20260614120000` #1 arrival_permits hardening | applied+verified | recorded | none |
| `20260614120100` #2 RPC revoke+ownership | applied+verified | recorded | none |
| `20260614120200` #3 claim_pending_messages | applied+verified | recorded | none |
| `20260615113000` #4 drop broad anon events SELECT | **APPLIED** — only `"Anon can select active events"` (qual `status='active'`) remains; broad `USING(true)` gone | recorded | none (NOT pending) |
| `20260615120000` #5 automation_settings INSERT ownership | **APPLIED** — INSERT `with_check` = stage-whitelist AND `user_events` ownership | recorded | re-assess effectiveness only (see below) — NO DDL |
| `20260615140000` Fix B users revoke self-super-admin | **APPLIED** this window via apply.js — anon/auth now hold only SELECT/DELETE/REFERENCES/TRIGGER/TRUNCATE on `public.users` (INSERT+UPDATE revoked); dual-camp APPROVE | **MISSING** (apply.js gap) | insert version row |
| `20260615140100` Fix A user_events revoke self-grant | **NOT applied** — `"Users can insert own event memberships"` INSERT policy (WITH CHECK `user_id=auth.uid()`) + table INSERT grant for anon+authenticated still live | not recorded (correct) | **APPLY (the only remaining apply)** |

`schema_migrations` currently ends at `20260615120000`. Everything through #5 is
recorded; Fix B applied-but-unrecorded; Fix A correctly absent.

## What "Fix A" actually closes (still OPEN as of pause)
`user_events` has policy `"Users can insert own event memberships"` (INSERT,
authenticated, WITH CHECK `user_id = auth.uid()`) — checks only that the new
row's `user_id` is the caller, NOT that the caller may join THAT event. Combined
with the table-level INSERT grant, any logged-in user can
`INSERT INTO user_events (user_id, event_id) VALUES (auth.uid(), <ANY event>)`
and forge ownership of any event -> cross-tenant RSVP PII + defeats
`user_can_manage_event()`. This is the authorization-root P0. Membership is
meant to be created ONLY by the SECURITY DEFINER `create_onboarding_event` RPC
(runs as owner, bypasses the revoke).

Fix A DDL (`supabase/migrations/20260615140100_user_events_revoke_self_grant.sql`):
```
DROP POLICY IF EXISTS "Users can insert own event memberships" ON public.user_events;
REVOKE INSERT ON public.user_events FROM anon, authenticated;
```
Rollback: `supabase/rollback/20260615140100_user_events_revoke_self_grant.down.sql`
(re-grants INSERT + recreates the policy — re-opens the hole; warning header present).

## Gate/review status carried into resume
- **Fix B:** applied + dual-camp APPROVE (Gate Agent + Codex round-2 after the
  column-vs-table fix). Done. Only the version-row insert remains.
- **Fix A:** Gate Agent APPROVE. Codex cross-review NOT yet run (quota). Dispatch
  already authored:
  `process/prompts/codex-p0-fixA-user-events-revoke-review.md` (3 checks +
  sufficiency check + fail-closed REPORT/BLOCKED contract). Backup exists:
  `C:\Users\Eyal\supabase-backups\user-events-policies-grants-pre-p0-20260615.md`.
- **#5:** Gate APPROVE; Codex round-1 BLOCK was **conditional on A+B** — #5's
  owner-scoped INSERT is only *effective* once the forge-ownership (Fix A) and
  self-promote (Fix B) roots are closed. Fix B is closed; Fix A is the last open
  root. So #5 needs an effectiveness re-assessment AFTER Fix A applies, NOT a
  re-apply.
- **#4:** already applied + recorded. Nothing to do.

## TOMORROW — resume order (all dual-camp; do NOT waive cross-review)
1. **Fix A:** run Codex cross-review on the existing dispatch
   (`cat process/prompts/codex-p0-fixA-user-events-revoke-review.md | codex exec
   -s workspace-write -c approval_policy="never" -C <repo-root>
   -o <repo-root>/.codex-last.txt -`). On Codex APPROVE (Gate already APPROVE) ->
   apply Fix A via apply.js -> readback (`user_events` INSERT policy gone, INSERT
   grant gone for both roles; SELECT policy + grant untouched) -> STOP + report.
   If Codex REVISE/BLOCK -> route fix back, re-gate, do not apply.
2. **#5 effectiveness re-assess:** with Fix A live, confirm an `authenticated`
   client can no longer forge a `user_events` row, so #5's owner-scoped INSERT on
   `automation_settings` is genuinely un-defeatable. Pure verification (readback +
   reason), NO DDL, NO new migration.
3. **schema_migrations reconciliation:** read the table's columns first
   (`version` + whatever else: `name`/`statements`/`inserted_at` — inspect before
   writing). Insert the missing version rows for migrations applied via apply.js:
   `20260615140000` (Fix B, now) and `20260615140100` (Fix A, after step 1).
   #1-#5 are already recorded — do not duplicate. Match the existing row shape.
4. **Credential rotation (REQUIRED — exposed):** rotate both Supabase PATs
   (old `sbp_26a28795...`, new `sbp_c4946f71...`) AND the DB password
   (`kH%TK6cY9RhT.4Q`) after applies land; update the MCP config that holds them.
   Do not use leaked creds beyond the necessary controlled applies.
5. **Docs:** fix CLAUDE.md automation_settings/RLS notes to match live state and
   mirror to AGENTS.md (per slice §5). Add `user_events` revoke + `users` revoke
   to the schema/RLS section.
6. **Git:** commit migration + rollback + backup + this note to a feature branch
   (`feature/p0-rls-apply`). Logical commits, no push beyond the feature branch
   without Eyal's integration authorization.

## Hard lesson to carry (don't re-learn it)
PostgreSQL column privileges are ADDITIVE to table privileges. A table-level
INSERT/UPDATE grant authorizes EVERY column; `REVOKE <priv>(col)` does NOT create
a deny-override. To protect a privilege column you must revoke the TABLE-level
write grant. (This sank the first Fix B draft — Codex round-1 BLOCK — and is why
both Fix A and Fix B revoke at table level.)

## Non-negotiables
- One migration at a time. Gate -> (dual-camp) -> apply -> readback -> report ->
  STOP. Never `db push`.
- Codex cross-review is mandatory and must not be waived. Fail-closed: a gate
  that can't run = BLOCKED, never silently passed.
- Single-driver: zero working-tree ops while a Codex run is live.
- Every command targets ONLY `wpxaalcjcsmhdwvwmtan`.
