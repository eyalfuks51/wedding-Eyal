# Dispatch — guesto-p0-launch-safety

**Slice type:** mixed (backend/data primary; one small frontend link fix)
**Branch:** `feature/guesto-p0-launch-safety` (off `main`; isolated git worktree at `.worktrees/guesto-p0`)
**Executor:** Claude (Opus) — Eyal override (this is the first-ever headless launch; Codex runs as read-only reviewer only).
**Reviewer:** Codex (other camp) — read-only review of the full diff.
**Migration gate:** Opus Migration Gate Agent (clean context) — approves each migration before it is considered done.
**Verified DB target:** project ref `wpxaalcjcsmhdwvwmtan` (Wedding-Eyal). The slice-orchestrator skill's hardcoded ref (`ukhhegrdvpmvipazvyth`) is **stale boilerplate** and must NOT be used for this repo. Do not edit the global skill.

This file is self-contained. The reviewer/executor is not assumed to have read the originating conversation or the slice-orchestrator skill. Every obligation below is owed because it appears here.

---

## 1. Mandate & scope

P0 launch-safety hardening only. The platform must be safe for a limited real-user validation push.

**In scope (and only this):**
1. Secrets / repo hygiene — `supabase/.temp/` tracking + secret scan.
2. `arrival_permits` RLS hardening (multi-tenant safe).
3. Unsafe mutation RPC grants + missing ownership checks.
4. WhatsApp scheduler atomic queue-claim (no duplicate sends).
5. Broken invite link `https://yourdomain.com/${slug}` → real origin.

**Out of scope (hard stop if tempted):** landing page, marketing UI (except the broken link), payments, any deploy, any push to main, any schema change unrelated to the three pre-approved migration areas below.

**Pre-approved migration areas (this slice only):**
(a) `arrival_permits` RLS hardening + a narrow public-write RPC.
(b) Unsafe RPC grant/revoke + ownership checks.
(c) WhatsApp queue atomic-claim support.
Any other DDL = out of scope → stop and report.

---

## 2. Hard gates (wait for Eyal / fail closed)

- Do NOT write to production user data.
- Do NOT push to main. Do NOT deploy. Do NOT apply migrations to the production DB.
- Do NOT perform destructive data changes.
- Do NOT rotate external Supabase secrets through unsafe/unverified means.
- Do NOT send real WhatsApp messages during verification.
- If live DB readback of a required fact cannot be performed, **fail closed** and report exactly what cannot be proven — never mark it silently done.
- If a committed secret cannot be rotated from this environment, report it as a **remaining external action for Eyal**, not as done.
- 3 consecutive failures on the same acceptance criterion → stop and write `BLOCKED.md`.

Termination: finish with `REPORT.md` at repo root (success) or `BLOCKED.md` (blocked). Missing report = failure. No silent retry. No takeover of a half-finished tree.

---

## 3. Confirmed live current state (readback via MCP, postgres superuser, 2026-06-14)

### 3.1 `arrival_permits` RLS (UNSAFE — confirmed)
- `Allow anon select` — SELECT, role anon, `qual = true` → **anon reads every RSVP (name+phone) across every event.**
- `Allow anon update` — UPDATE, role anon, `qual = true / with_check = true` → **anon tampers with any RSVP.**
- `Allow anon insert` + legacy duplicate `wedding-policy` — INSERT, role anon, `with_check = true`.
- `Allow authenticated select arrival_permits` — `qual = true` → **any signed-in owner reads ALL events' RSVPs** (violates "own events only").
- `Allow authenticated update arrival_permits` — `qual = true` → same for UPDATE.
- `Allow authenticated insert arrival_permits` — `with_check = true`.
- Table: RLS enabled, not forced. Unique `(event_id, phone)`; PK `(id, phone)`; `event_id` is nullable (legacy rows).

### 3.2 Other event-owned tables — ALREADY SAFE (no change needed; the stale CLAUDE.md is wrong)
- `invitations`, `automation_settings`, `message_logs`: authenticated policies scoped to `user_events` ownership (`EXISTS (SELECT 1 FROM user_events ue WHERE ue.event_id = <t>.event_id AND ue.user_id = auth.uid())`) plus super-admin (`EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.is_super_admin)`). **No anon policies at all.** Leave untouched.
- `user_events`: self-scoped (`user_id = auth.uid()`). Leave untouched.
- `events`: authenticated SELECT/UPDATE scoped to `user_events`/super-admin (good). Anon has **two** SELECT policies: `Anon can select active events` (`status='active'`, correct) AND `Allow anon select on events` (`qual=true`, redundant/over-broad → anon can read draft events' `content_config`). **Low severity, NOT phones/guest-list. Out of the three pre-approved areas → report as a finding, do NOT migrate it in this slice.**

### 3.3 Mutation RPCs (UNSAFE — confirmed)
All `SECURITY DEFINER`, `SET search_path = public`, EXECUTE granted to **both `anon` and `authenticated`**, and **none enforce ownership** except `create_onboarding_event`:
- `toggle_auto_pilot(p_event_id, p_enabled)` — `UPDATE events ... WHERE id=p_event_id`. No ownership check. **Anon can flip any event's auto-pilot.**
- `update_whatsapp_template(p_event_id, p_stage_name, p_singular, p_plural)` — whitelists stage, then `UPDATE events`. No ownership check.
- `delete_dynamic_nudge(p_setting_id)` — resolves event_id, guards stage name + message_logs count, deletes. No ownership check.
- `create_invitation_from_permit(p_permit_id)` — inserts invitation from permit. No ownership check.
- `link_permit_to_invitation(p_permit_id, p_invitation_id)` — updates invitation + permit. No ownership check.
- `create_onboarding_event(...)` — **already checks `auth.uid() IS NOT NULL`** and links the new event to the caller via `user_events`. Only needs anon revoke (anon has no uid anyway).
- Also granted EXECUTE to anon+authenticated (trigger/helper, should not be caller-invocable by anon): `handle_new_auth_user`, `sync_arrival_to_invitation`, `phone_core`.
- No `is_super_admin()` helper function exists — super-admin is the inline `users.is_super_admin` check shown above.

### 3.4 WhatsApp scheduler (DUP-SEND — confirmed)
`supabase/functions/whatsapp-scheduler/index.ts`: SELECTs up to 15 `status='pending'` rows, sends via Green API, and only **after** a successful send does `UPDATE ... SET status='sent' WHERE id=log.id`. No claim before send → two overlapping invocations select the same rows → **duplicate WhatsApp messages.** Uses the service-role admin client (bypasses RLS). `'processing'` is already a valid status in the contract.

### 3.5 Broken link (confirmed)
`src/pages/Dashboard.tsx:1074`: `` const eventLink = `https://yourdomain.com/${currentEvent.slug}`; `` — only `yourdomain.com` hit. (`DashboardSettings.tsx` shows the real public base as `guesto.app/{slug}`.)

### 3.6 Public RSVP write path
`src/components/RsvpForm/RsvpForm.jsx` calls only `submitRsvp(payload, eventId)`; success screen is pure client state — **no anon SELECT on arrival_permits anywhere**. `src/lib/supabase.js` `submitRsvp` does `from('arrival_permits').upsert([...], { onConflict: 'event_id,phone' })` — needs INSERT + conflict-UPDATE. Removing anon INSERT/UPDATE therefore requires replacing this with a `SECURITY DEFINER` RPC.

---

## 4. Target design

### 4.1 Migration A — `arrival_permits` RLS + public write RPC (area a)
- DROP anon policies: `Allow anon select`, `Allow anon update`, `Allow anon insert`, `wedding-policy`. → anon gets **zero** direct policies on the table.
- REPLACE authenticated SELECT/UPDATE/INSERT policies so each is scoped to `user_events` ownership OR `users.is_super_admin` (mirror the `invitations` pattern), instead of `qual=true`.
- CREATE `submit_rsvp(p_event_id uuid, p_full_name text, p_phone text, p_attending boolean, p_guests_count smallint, p_needs_parking boolean) RETURNS void`:
  - `SECURITY DEFINER`, `SET search_path = public`.
  - Reject if the event does not exist or `status <> 'active'` (RAISE EXCEPTION) — narrow, event-scoped, cannot reach another event's data.
  - `INSERT INTO arrival_permits (event_id, full_name, phone, attending, guests_count, needs_parking) VALUES (...) ON CONFLICT (event_id, phone) DO UPDATE SET ...` (preserve existing semantics; the sheets-sync trigger still fires).
  - GRANT EXECUTE TO anon, authenticated. REVOKE from public.
- Paired rollback file restoring the prior policies + dropping the RPC.

### 4.2 Migration B — RPC grant/revoke + ownership checks (area b)
- For `toggle_auto_pilot`, `update_whatsapp_template`, `delete_dynamic_nudge`, `create_invitation_from_permit`, `link_permit_to_invitation`: `CREATE OR REPLACE` with the **same body plus a guard at the top** that resolves the target event_id and raises unless the caller owns it or is super-admin:
  - ownership predicate: `EXISTS (SELECT 1 FROM user_events ue WHERE ue.event_id = <eid> AND ue.user_id = auth.uid()) OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.is_super_admin)`.
  - For permit-based RPCs, resolve event_id from `arrival_permits.event_id` (and the target invitation's event_id) before the guard.
  - `REVOKE EXECUTE ... FROM anon;` (keep authenticated).
- `create_onboarding_event`: `REVOKE EXECUTE ... FROM anon;` (already auth-guarded; keep authenticated).
- `handle_new_auth_user`, `sync_arrival_to_invitation`, `phone_core`: `REVOKE EXECUTE ... FROM anon, authenticated, public;` (trigger/internal helpers — verify nothing legitimately calls them as a direct RPC; the triggers themselves run as definer and are unaffected by EXECUTE grants).
- Paired rollback restoring prior grants + prior function bodies.

### 4.3 Migration C — WhatsApp atomic claim (area c)
- Provide an atomic claim primitive. Preferred: a `SECURITY DEFINER` function `claim_pending_messages(p_limit int) RETURNS SETOF message_logs` that does:
  `UPDATE message_logs SET status='processing' WHERE id IN (SELECT id FROM message_logs WHERE status='pending' AND (scheduled_for IS NULL OR scheduled_for <= now()) ORDER BY scheduled_for NULLS FIRST LIMIT p_limit FOR UPDATE SKIP LOCKED) RETURNING *;`
  - EXECUTE to `service_role` only (the scheduler uses the service-role client). REVOKE from anon/authenticated/public.
- Refactor `whatsapp-scheduler/index.ts` to call the claim RPC instead of the plain SELECT, so each row is moved `pending → processing` atomically before any send. On success → `sent`; on failure → `failed`. Rows left `processing` after a crash are recoverable (note a reaper as a follow-up; not in P0 scope).
- Paired rollback dropping the claim function. (The edge-function code change is not a migration but ships in the same slice.)

### 4.4 Frontend
- `src/lib/supabase.js` `submitRsvp`: replace the `upsert` with `supabase.rpc('submit_rsvp', { ... })`. Keep the exported signature `submitRsvp(rsvpData, eventId)` identical so `RsvpForm.jsx` is untouched.
- `src/pages/Dashboard.tsx:1074`: replace the hardcoded URL with the real origin. Use `window.location.origin` (or a `VITE_PUBLIC_BASE_URL` env fallback if present) so the copied invite link matches the deployment. No other Dashboard change.
- **Overlap note:** `src/lib/supabase.js` and `src/pages/Dashboard.tsx` are also modified in the uncommitted `codex/premium-couple-admin` working tree. This slice edits the `main` versions in an isolated worktree; the premium branch will need to reconcile these two files at integration. Flag in REPORT.md. Keep both edits surgical.

---

## 5. Verification plan

- **Current unsafe state:** proven live via MCP readback (§3) — include the queries + result summaries in REPORT.md.
- **New state (B/C goals):** prod is NOT modified (do-not-deploy). Prove the *design* by:
  1. Opus Migration Gate Agent (clean context) reviews each migration + paired rollback against live current-state readback. Verdict APPROVE/REVISE/BLOCK recorded in REPORT.md.
  2. Executable **PGlite** harness (`@electric-sql/pglite`, in-process WASM Postgres, dev-only): bootstrap the exact confirmed table DDL (events, users, user_events, arrival_permits, invitations, message_logs, automation_settings) + `anon`/`authenticated` roles + base GRANTs + an `auth.uid()` stub reading `request.jwt.claims`; apply Migrations A/B/C; assert at minimum:
     - NEG: anon `SELECT * FROM arrival_permits` → denied/0 rows.
     - NEG: anon `EXECUTE toggle_auto_pilot` (and one more mutator) → denied.
     - POS: anon `submit_rsvp(active event)` → row written; submit to non-active/unknown event → raises.
     - POS: owner authenticated SELECT own-event permits → rows; NEG: other event → 0.
     - NEG: authenticated non-owner `toggle_auto_pilot` → raises; POS: owner → succeeds.
     - D: `claim_pending_messages` run twice sequentially → second returns no rows already claimed (idempotent claim); document the `FOR UPDATE SKIP LOCKED` concurrency guarantee and note that true two-connection concurrency is not reproducible in single-connection PGlite.
  - If PGlite proves infeasible within 3 attempts, fall back to Gate-Agent design approval + RLS/grant semantic proof, and **report the live-verification gap as fail-closed** (what cannot be proven without applying to prod).
- **E (link):** grep the repo for `yourdomain.com` → must be zero in production code; include the command + output.
- **F (regression):** `npm run build`, typecheck, `npm run test` (Vitest). Explain any pre-existing failures with evidence. Confirm `submit_rsvp` preserves the `RsvpForm` contract (same exported signature).
- Hebrew strings verified via DB readback / source literals, never terminal echo.

---

## 6. Secrets / hygiene (goal A)

- Add `supabase/.temp/` to `.gitignore`; `git rm --cached` any tracked temp files (do not delete on disk).
- Scan tracked files (and history if feasible) for: service_role JWT, anon JWT used as a secret, pooler/connection URLs with credentials, `SUPABASE_SERVICE_ROLE_KEY`, private keys. Use `git grep` over the tree + targeted history check.
- If a privileged secret is found tracked: report it; state plainly whether rotation was done here or must be done by Eyal in the Supabase dashboard. **Never silently mark rotation done.**

---

## 7. Completion contract

`REPORT.md` (English) must contain: branch + HEAD verification; what was inspected; files changed; migrations created (filename, purpose, paired rollback); Gate-Agent verdicts; commands run; DB readback queries + result summaries (current unsafe state); secret-scan commands + results; RLS/privilege verification summary (new state, via PGlite or fail-closed); WhatsApp dup-send mechanism + proof; `yourdomain.com` grep proof; build/test results; deviations from scope; remaining risks; **external actions still required from Eyal** (esp. applying the migrations to prod + any secret rotation); and 5–8 manual acceptance scenarios.

Cross-review: Codex reviews the full diff (read-only). Review findings routed and resolved before final hand-off.

Docs: any DB/RPC contract change updates `docs/backend-changelog.md` in the same commit; mirror any CLAUDE.md change into AGENTS.md.
