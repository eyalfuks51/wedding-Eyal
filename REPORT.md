# Guesto P0 Launch-Safety Slice — Completion Report

**Branch:** `feature/guesto-p0-launch-safety` (branched from `main` @ `576d44b`)
**Date:** 2026-06-14
**Scope:** P0 launch-safety only. No landing page, no payment, no marketing UI (except the broken invite link), no deploy, no push to main. Migrations authored + gated but **not applied** to production.

---

## 1. Summary — what was done

Six P0 launch-safety holes were closed in the working tree. Three new SQL migrations + one in-place hygiene edit, plus matching frontend/edge wiring and a PGlite test harness.

| # | P0 issue | Status | Mechanism |
|---|----------|--------|-----------|
| A | service_role secret tracked + supabase temp files tracked | **Fixed in tree; rotation = external Eyal action** | Removed JWT from migration `20260304090000`; deleted + git-ignored `supabase/.temp/` |
| B | `arrival_permits` RLS unsafe for multi-tenant | **Fixed** | Dropped broad anon/authenticated policies; owner+super-admin policies; `submit_rsvp` SECURITY DEFINER as the only public write path |
| C | mutation RPCs anon-callable / no ownership check | **Fixed** | `REVOKE … FROM PUBLIC, anon`; ownership guard via `user_can_manage_event()` on every mutator |
| D | WhatsApp scheduler can duplicate-send | **Fixed** | Atomic `claim_pending_messages()` (`UPDATE … FOR UPDATE SKIP LOCKED RETURNING`); at-most-once |
| E | invite links hardcoded `https://yourdomain.com/${slug}` | **Fixed** | `import.meta.env.VITE_PUBLIC_BASE_URL ?? window.location.origin` |
| F | regression safety | **Green** | tests 20/20, tsc 0, build 0; contracts updated in `docs/backend-changelog.md` |

**Two independent reviews passed at the current tree state:**
- **Codex cross-review (other camp):** round-1 BLOCK (2 findings) → both fixed → **round-2 APPROVE**.
- **Opus Migration Gate Agent (clean context):** **APPROVE** all three migrations, re-run against the current files after the round-1 fixes.

---

## 2. Files changed

**New (untracked) — the core of the slice:**
- `supabase/migrations/20260614120000_arrival_permits_rls_hardening.sql`
- `supabase/migrations/20260614120100_rpc_revoke_anon_and_ownership.sql`
- `supabase/migrations/20260614120200_whatsapp_atomic_claim.sql`
- `supabase/rollback/20260614120000_arrival_permits_rls_hardening.down.sql`
- `supabase/rollback/20260614120100_rpc_revoke_anon_and_ownership.down.sql`
- `supabase/rollback/20260614120200_whatsapp_atomic_claim.down.sql`
- `src/__tests__/p0-launch-safety.test.ts` (PGlite harness, 20 tests)
- `src/vite-env.d.ts` (types `VITE_PUBLIC_BASE_URL`)
- `docs/backend-changelog.md`
- `process/prompts/*` (dispatch archive — framework-internal, not auto-read)

**Modified (tracked):**
- `.gitignore` — ignore `supabase/.temp/`
- `CLAUDE.md` — schema-sync for the new RPCs/grants + stale-doc fix (see §6.1)
- `src/lib/supabase.js` — `submitRsvp()` → `rpc('submit_rsvp', …)`
- `src/pages/Dashboard.tsx` — invite link uses base-URL env / origin
- `supabase/functions/whatsapp-scheduler/index.ts` — claims via `claim_pending_messages` RPC
- `supabase/migrations/20260304090000_schedule_automation_cron.sql` — secret removed (hygiene exception, §6.2)
- `package.json` / `package-lock.json` — `@electric-sql/pglite` dev dep for the harness

**Deleted (tracked → removed):** `supabase/.temp/{cli-latest,gotrue-version,pooler-url,postgres-version,project-ref,rest-version,storage-migration,storage-version}`

---

## 3. Per-migration report fields

> All three migrations are **NOT applied** to production. "Do not deploy / do not apply migrations to production DB" was honored. `push result` = **not pushed** for all.

### `20260614120000_arrival_permits_rls_hardening.sql` (Migration A)
- **Commands run:** loaded + executed inside PGlite test harness (not against prod); read-only prod readback to confirm preconditions.
- **Push result:** not pushed (no deploy in this slice).
- **Warnings/errors:** none. `CREATE POLICY` is not `IF NOT EXISTS` (Postgres has no such clause for policies) — fine for one-shot forward apply; re-run requires the down-file first.
- **Schema changes:** drops `arrival_permits` broad policies (`Allow anon insert/update/select`, `wedding-policy`, broad `Allow authenticated …`); adds owner policies (SELECT/INSERT/UPDATE via `user_events`) + super-admin mirror (SELECT/INSERT/UPDATE/DELETE via `users.is_super_admin`); new fn `submit_rsvp(...)` SECURITY DEFINER, `REVOKE FROM PUBLIC` + `GRANT anon, authenticated`.

### `20260614120100_rpc_revoke_anon_and_ownership.sql` (Migration B)
- **Commands run:** PGlite harness; prod read-only privilege readback.
- **Push result:** not pushed.
- **Warnings/errors:** none.
- **Schema changes:** new fn `user_can_manage_event(uuid)` SECURITY DEFINER STABLE (`REVOKE PUBLIC,anon` / `GRANT authenticated`); `REVOKE EXECUTE FROM PUBLIC, anon` + `GRANT authenticated` on `toggle_auto_pilot`, `update_whatsapp_template`, `delete_dynamic_nudge`, `create_invitation_from_permit`, `link_permit_to_invitation`, `create_onboarding_event`; `REVOKE FROM PUBLIC, anon, authenticated` on internal fns `handle_new_auth_user`, `sync_arrival_to_invitation`, `phone_core`; ownership guard prepended to the 5 mutators; `link_permit_to_invitation` adds cross-tenant equality check (permit event == invitation event).

### `20260614120200_whatsapp_atomic_claim.sql` (Migration C)
- **Commands run:** PGlite harness (incl. overlapping-run disjoint-claim + stale-row-not-reclaimed tests); prod read-only readback.
- **Push result:** not pushed.
- **Warnings/errors:** none.
- **Schema changes:** `ALTER TABLE message_logs ADD COLUMN IF NOT EXISTS processing_started_at timestamptz`; new fn `claim_pending_messages(p_limit int DEFAULT 15) RETURNS SETOF message_logs` SECURITY DEFINER (`REVOKE FROM PUBLIC, anon, authenticated` / `GRANT service_role`).

---

## 4. Verification evidence

### Automated gates (final tree state, in the worktree)
- **Unit/harness (Vitest + PGlite):** `npx vitest run src/__tests__/p0-launch-safety.test.ts` → **20/20 pass**.
- **Typecheck:** `npx tsc --noEmit` → **exit 0**.
- **Build:** `npm run build` → **exit 0** (pre-existing >500 kB chunk warning only; not introduced here).

### Live read-only DB readback (prod-grade DB `wpxaalcjcsmhdwvwmtan`, via read-only postgres connection — state inspection only, no writes)
- **Before state confirmed:** `arrival_permits` currently carries the broad anon policies (`Allow anon insert/select/update`, `wedding-policy`) + broad `authenticated` policies → the holes Migration A closes. All 9 target functions currently have `anon EXECUTE = true` → the hole Migration B closes. The 3 new objects + `message_logs.processing_started_at` are **absent** in prod (count 0) → migrations correctly not yet applied.
- **Already-safe tables confirmed:** `automation_settings`, `events` (mutation policies), `invitations`, `message_logs` are **already owner-scoped** (`user_events` + super-admin) with **no anon write policy**. This is why criterion C needs no new table-policy work beyond the RPC revokes — the only anon write surface was `arrival_permits` (Migration A).
- **Preconditions confirmed:** `arrival_permits_event_phone_unique` exists; `users.is_super_admin`, `user_events.{user_id,event_id}`, `events.status` all exist.

### Criterion proofs (B/C/D in the harness)
- **B positive:** `submit_rsvp` upserts an RSVP for an active event. **B negative:** anon has no direct `arrival_permits` SELECT/UPDATE after policy swap; `submit_rsvp` rejects non-active / non-existent events.
- **C negative:** mutators raise `42501` when caller is not an owner; cross-tenant `link_permit_to_invitation` raises `/does not belong/`; same-event link succeeds (test `C2`).
- **D:** two sequential overlapping claim runs return **disjoint** row sets; a 60-min-stale `processing` row is **not** reclaimed by a later run.

### Grep proofs (criteria A + E)
- `yourdomain.com` — **0** in production code paths (`src/`, `supabase/`). Remaining matches live only under `process/prompts/*` (dispatch archive — descriptive text, not a code path). See §6.4.
- service_role JWT literal / pooler URL — **0** in tracked files.

---

## 5. WhatsApp duplicate-send — mechanism & limitation

**Mechanism (at-most-once):** the scheduler no longer `SELECT`s pending rows directly. It calls `claim_pending_messages(p_limit)`, which performs a single atomic statement:

```sql
UPDATE message_logs SET status='processing', processing_started_at=now()
WHERE id IN (
  SELECT id FROM message_logs
  WHERE status='pending' AND scheduled_for <= now()
  ORDER BY scheduled_for
  LIMIT p_limit
  FOR UPDATE SKIP LOCKED
)
RETURNING *;
```

`FOR UPDATE SKIP LOCKED` guarantees two overlapping workers claim **disjoint** rows; each claimed row flips to `processing` in the same statement, so a second run cannot re-select it. Only `service_role` may execute it.

**Deliberate tradeoff — at-most-once, NOT at-least-once.** There is **no** auto-reclaim of rows stuck in `processing`. Green API sends are not idempotent (no client dedup key), so any reclaim window risks re-messaging a guest whose send succeeded but whose `sent` DB write failed. **Consequence:** a worker that crashes between sending and writing `sent` leaves a row in `processing` that requires **manual requeue** — it will not auto-resend. This is the safe default for a launch (annoying-but-recoverable beats double-texting a guest).

**Verification limitation (disclosed):** PGlite is single-connection, so true *simultaneous* `SKIP LOCKED` contention cannot be demonstrated in the harness. The test proves the **sequential overlapping-run disjoint-claim** property (run 1 claims, run 2 gets the complement) and the **no-reclaim** property. The locking semantics themselves are stock Postgres. No real WhatsApp messages were sent during verification.

---

## 6. Deviations, disclosures & open risks

### 6.1 Stale CLAUDE.md docs fixed (Codex round-2 non-blocking #1)
Codex flagged `CLAUDE.md` lines claiming `automation_settings` has anon RLS policies. I did **not** take this at face value — I checked whether it was instead a live anon-mutation **hole** (criterion C). A full live `pg_policies` readback proved `automation_settings` is already owner-scoped with no anon write policy → the docs were genuinely **stale**, no hole. Fixed 4 references in `CLAUDE.md` (automation_settings RLS block + the 3 RPC grant lines) to describe the post-migration owner-scoped reality. **Trivial change (doc-only), recorded as such; no re-review required.**

### 6.2 Secret rotation = REMAINING EXTERNAL EYAL ACTION (not done by this slice)
The hardcoded service_role JWT was removed from migration `20260304090000` (replaced with a `vault.decrypted_secrets` lookup). **But the secret is NOT rotated and still lives in two places this slice cannot safely touch:**
1. **Git history** — commit `ac99e5a` still contains the literal JWT. Removing it requires history rewrite (out of P0 scope; coordinate with Mor before any force-push).
2. **Live prod `cron.job`** — the two scheduled jobs still carry the literal Bearer token in their command text.

**Eyal must, in the Supabase dashboard:** (a) rotate the service_role key; (b) store the new key in Vault as secret `service_role_key`; (c) re-schedule the two cron jobs so they read from Vault. Until then the in-tree fix is inert in prod and the old key remains valid. **This is reported as a remaining external action — not silently marked done.**

### 6.3 New non-P0 discovery — `events` anon-select-all (deferred P1, NOT fixed)
Live readback found `events` carries a leftover `Allow anon select on events` (`USING true`) — anon can SELECT **all** events, including drafts (leaks template text + draft existence). This is **info-disclosure, not a mutation**, and not among the 6 enumerated P0 issues → **deferred as P1**, not fixed here (respecting "P0 only" + the reviewer's scope-creep concern). Recommend a follow-up slice to scope `events` SELECT to active/published or owner.

### 6.4 Codex non-blocking findings #2 / #3 (accepted)
- **#2 — `yourdomain.com` in `process/prompts/*`:** intentional; that's the dispatch archive (descriptive prose, not a runtime path). Production-code grep is clean (§4).
- **#3 — rollbacks restore only the live-current policy variant:** accepted. The down-files are recovery-oriented (restore the exact pre-migration live state), not a full historical replay.

### 6.5 Residual nits (report, don't fix)
- `create_invitation_from_permit` / `link_permit_to_invitation` return NULL-vs-raise in some not-found branches — authenticated-only now, low risk; left as-is.
- `MSG_STATUS_MAP` (dashboard constants) has no `'processing'` entry — a claimed row briefly shows the default badge. Cosmetic; not P0.

### 6.6 Overlap with the 64 uncommitted `premium-couple-admin` files (flagged per §5)
`src/pages/Dashboard.tsx` and `src/lib/supabase.js` (both edited here) overlap files that are dirty on branch `codex/premium-couple-admin`. The Dashboard invite-link fix (`baseUrl = import.meta.env.VITE_PUBLIC_BASE_URL || window.location.origin`) already exists in that dirty tree. **Integration must reconcile these two files** — do not blind-merge. Surfaced for Eyal, not auto-resolved.

### 6.7 AGENTS.md mirror deferred-to-integration
The framework requires CLAUDE.md edits to be mirrored in `AGENTS.md`. `AGENTS.md` is a 347-line untracked file living only in the `codex/premium-couple-admin` working tree (one of the 64 protected files) — it is **absent** from this worktree and tracked on no branch. Mirroring it here would either fail (not present) or fork a protected file. **Deferred to integration**, when both trees are reconciled.

### 6.8 Onboarding draft consequence
`submit_rsvp` rejects non-`active` events. Events in `draft` (e.g. `mor-and-eyal`) will not accept public RSVPs until promoted to `active`. The existing live event `hagit-and-itai` is `active` and unaffected. Onboarding still produces a shareable link; the link only accepts RSVPs once the event is active.

---

## 7. Review trail

- **Codex round-1:** BLOCK — (1) `link_permit_to_invitation` cross-tenant write; (2) WhatsApp stale-reclaim duplicate-send. Both routed back and fixed in-tree.
- **Codex round-2:** **APPROVE** — "The two prior blockers are fixed: `link_permit_to_invitation` now checks permit ownership and same-event invitation before mutation, and `claim_pending_messages` only claims `pending` rows with no processing-row reclaim path." Non-blocking: stale docs (#1, fixed), prompts-archive grep (#2, accepted), rollback fidelity (#3, accepted).
- **Migration Gate Agent (Opus, clean context), re-run on current files:** **APPROVE A/B/C** — all 9 fail-closed checks pass; the two post-round-1 changes (B's invitation cross-tenant equality, C's `(int)` signature + no-auto-reclaim) verified present and correct.

---

## 8. What is explicitly NOT done (by design / scope)

- ❌ Not deployed, not pushed, migrations not applied to prod.
- ❌ Secret not rotated (external Eyal action — §6.2).
- ❌ `events` anon-select-all not fixed (deferred P1 — §6.3).
- ❌ AGENTS.md not mirrored (deferred to integration — §6.7).
- ❌ Landing page / payment / marketing UI untouched (out of scope).

---

## 9. Manual acceptance checklist (for Eyal — run after migrations are applied in a dev/staging DB)

> Automated gates are already green (§4). These are the human flow checks. **They assume the 3 migrations have been applied to whatever DB you point the app at** (they are not applied to prod yet). Run against a dev/staging project, not prod.

1. **Public RSVP still works (positive).** Open the live event link `/<active-slug>` (e.g. `hagit-and-itai`). Fill the form (שם, טלפון, מגיע/לא מגיע, כמות אורחים) and submit. Expect: success state, and the row appears in the dashboard for that event. Confirms `submit_rsvp` works for the public path.

2. **Public RSVP blocked on a draft event (negative-by-design).** Point at a `draft` event (e.g. `mor-and-eyal`) and try to RSVP. Expect: submission is rejected (event not active). To accept RSVPs, promote the event to `status='active'` first. Confirms the active-event gate.

3. **Anon cannot read another event's guest list.** With no login (anon), confirm there is no UI path that lists `arrival_permits` across events, and the public event page never renders other guests' names/phones. (Optional SQL: as anon, `SELECT * FROM arrival_permits` returns nothing.) Confirms criterion B.

4. **Owner dashboard still works.** Log in as the event owner. Open `/dashboard` — KPI cards, guest table, filters load. Open `/dashboard/timeline` and `/dashboard/settings`. Confirms authenticated owner access is intact.

5. **Config mutation works for the owner, fails for anon.** As the logged-in owner: toggle Auto-Pilot, edit a WhatsApp stage template (save), add/delete a dynamic nudge — all succeed. Then confirm none of these controls are reachable / succeed while logged out. Confirms criterion C ownership guards.

6. **Cross-tenant guard (if you have 2 events).** As owner of event A, there should be no path to mutate event B's invitations/permits. Confirms `link_permit_to_invitation` / `user_can_manage_event` ownership checks.

7. **Invite link uses the real origin.** In the dashboard, copy a guest invite link (bulk or single). Expect the host to be your real deployment origin (or `VITE_PUBLIC_BASE_URL` if set) — **never** `yourdomain.com`. Confirms criterion E.

8. **Onboarding produces a shareable link.** Create a new event via onboarding. Expect a working public `/<slug>` link is generated. Remember it must be `active` before it accepts RSVPs (scenario 2).

**Not testable from the UI (external action required):** secret rotation (§6.2) — verify in the Supabase dashboard that the service_role key is rotated, the `service_role_key` Vault secret exists, and the cron jobs read from Vault. The WhatsApp scheduler should be run against a dev queue only (do not send real messages) to watch claimed rows flip `pending → processing → sent`.
