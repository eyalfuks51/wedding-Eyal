# STATE — Guesto (living doc)

> Short, current, disposable. The "what's happening right now" an agent needs that code/git can't show.
> Update when focus shifts. Not a changelog — keep it to the present.

**Updated:** 2026-06-16

## Current focus
- Context-system refactor: slim `CLAUDE.md` into a router + `docs/` split, auto-gen `docs/SCHEMA.md`, this `STATE.md`. (in progress, this branch)

## In flight
- Branch `feature/palette-cool-migration` — warm cream → cool lavender/violet palette migration (product + marketing). Uncommitted: marketing `globals.css`, `page.tsx`, new `feature-carousel.tsx` / `pricing-card.tsx`, `public/templates/`.
- Uncommitted P0 security migrations: `users_revoke_self_super_admin`, `user_events_revoke_self_grant` (+ rollbacks) — under Codex cross-review (see `process/prompts/`).
- `.planning/*` GSD artifacts renamed to `*.bak` (stale, last real update 2026-03-18) — staged, not committed.

## Deployment (live)
- Two Vercel projects from this repo: `guesto-marketing` (Next.js, `apps/marketing`) → guesto-marketing-eyalfuks51s-projects.vercel.app; `guesto` (Vite SPA, repo root) → guesto-xi.vercel.app. Production branch = `main`. Detail in memory `vercel-two-project-monorepo-deploy`.

## Next 3
1. Land the context refactor; commit the `.bak` renames + new structure.
2. Resolve the P0 revoke-self migrations after Codex review clears.
3. `guesto.co.il` domain wiring when purchased (apex+www → marketing, `app.` → app).

## Landmines (read before touching)
- Marketing prod build is **skipped on empty commits** — needs a real change under `apps/marketing/`.
- `NEXT_PUBLIC_*` must be Vercel `type=plain`, never `sensitive`.
- Never `await` a supabase query inside `onAuthStateChange` — self-deadlocks. Defer with `setTimeout(0)`.
- LivePreview iframe (`/preview/:slug`) must stay anon-only — no auth init, or it races the parent's navigator.locks.
- `claim_pending_messages` is at-most-once — no reclaim of stuck `processing` rows.
