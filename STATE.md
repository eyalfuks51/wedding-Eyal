# STATE — Guesto (living doc)

> Short, current, disposable. The "what's happening right now" an agent needs that code/git can't show.
> Update when focus shifts. Not a changelog — keep it to the present.

**Updated:** 2026-06-21

## Current focus
- Single-branch workflow restored: all stale feature/backup branches consolidated into `main` (2026-06-21). The last unmerged P0 migrations (`drop_broad_anon_events_select`, `automation_settings_insert_ownership`) were cherry-picked from the old `feature/p0-rls-apply` — already live in the DB, now also in git.
- Next per roadmap: **Phase 2** — WhatsApp automation & scheduler.

## In flight
- Nothing mid-flight. Working tree clean except untracked local tooling (`.claude/skills/`, `captures/`).

## Deployment (live)
- Two Vercel projects from this repo: `guesto-marketing` (Next.js, `apps/marketing`) → guesto-marketing-eyalfuks51s-projects.vercel.app; `guesto` (Vite SPA, repo root) → guesto-xi.vercel.app. Production branch = `main`. Detail in memory `vercel-two-project-monorepo-deploy`.

## Next 3
1. Phase 2: WhatsApp automation & scheduler (see `docs/AUTOMATION.md`).
2. `guesto.co.il` domain wiring when purchased (apex+www → marketing, `app.` → app).
3. Push `main` to origin — local has 3 unpushed commits (2 P0 cherry-picks + this STATE refresh); triggers prod deploy.

## Landmines (read before touching)
- Marketing prod build is **skipped on empty commits** — needs a real change under `apps/marketing/`.
- `NEXT_PUBLIC_*` must be Vercel `type=plain`, never `sensitive`.
- Never `await` a supabase query inside `onAuthStateChange` — self-deadlocks. Defer with `setTimeout(0)`.
- LivePreview iframe (`/preview/:slug`) must stay anon-only — no auth init, or it races the parent's navigator.locks.
- `claim_pending_messages` is at-most-once — no reclaim of stuck `processing` rows.
