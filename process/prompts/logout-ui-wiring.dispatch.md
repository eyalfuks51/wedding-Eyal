# Execution dispatch: logout-ui-wiring

You are the executor for a small, self-contained frontend slice. This file is your
complete brief — do not assume any other process document. Honor every rule below.

## Branch (already set up — do NOT create or switch branches)
- You are on `feature/logout-ui-wiring`, branched off `main` @ 28e28dc.
- Do all work here. **Do NOT push.** Do NOT switch branches. Do NOT merge.

## Goal
A logged-in user can sign out from the dashboard UI, which ends their Supabase session
and returns them to `/login`. This enables account switching (currently impossible —
no UI path ends a session, and Supabase persists + auto-refreshes the session in
localStorage so it never expires on its own).

## Verified context (do NOT re-derive, do NOT change these)
- The sign-out function already exists and works:
  `src/contexts/AuthContext.tsx:125-127` — `signOut = async () => { await supabase?.auth.signOut() }`,
  exposed on the context value and consumed via `useAuth().signOut`.
- **Do NOT touch `AuthContext` `signOut` or any auth/session logic. It works.**
- `signOut()` clears the session but does NOT itself navigate. Redirect is reactive:
  `src/components/auth/ProtectedRoute.tsx:38` renders `<Navigate to="/login" replace />`
  the moment `user` becomes null (driven by `onAuthStateChange`).
- `src/components/dashboard/DashboardNav.tsx` is the shared dashboard shell header,
  rendered on all three dashboard tabs. It already imports `useNavigate` from
  `react-router-dom`. This is the home for the sign-out control.

## Scope — IN
- Add a sign-out control (a `<button>`) to `DashboardNav.tsx`, wired to
  `useAuth().signOut` (import `useAuth` from `@/contexts/AuthContext`).
- Handle the post-sign-out transition to `/login` (see "Redirect path" below).
- Hebrew label as a literal string: `התנתקות`. Add `aria-label="התנתקות"`.
- One-line doc note recording the new control, in BOTH `CLAUDE.md` and `AGENTS.md`
  (they are mirrors — keep them identical), in the Admin Dashboard section. Same commit
  as the code. Keep it to one sentence; do not restructure the docs.

## Scope — OUT (do NOT do these)
- Do NOT restyle the nav or design the control's appearance. Visual design (placement
  polish, icon choice, styling, final copy) is owned by Mor and refined later. Wire it
  in a **minimal, neutral** way — a plain button consistent with the existing nav
  buttons is enough. A lucide-react icon (e.g. `LogOut`) is acceptable but optional;
  do not over-design.
- Do NOT touch `AuthContext`, `EventContext`, `ProtectedRoute` logic, RLS, DB,
  migrations, RPCs, or any auth/session behavior.
- Do NOT add tests beyond what gates require (this is neutral UI wiring; no test
  currently asserts this surface). Do not refactor unrelated code.

## Redirect path — pick ONE, do not double-navigate
- **Recommended:** rely on the reactive redirect. `await signOut()` → `user` goes null →
  `ProtectedRoute` renders `<Navigate to="/login" replace />`. No explicit navigate
  needed. This matches the existing pattern.
- **Acceptable alternative:** `await signOut()` then an explicit
  `navigate('/login', { replace: true })`.
- Do NOT do both in a way that double-navigates. **State in REPORT.md which path you
  chose and why.**

## Gates (all must pass — fail-closed; a gate that cannot run is a BLOCK, not a pass)
Run from the repo root (`C:\dev\github\personal\Wedding-Eyal`):
1. Lint:      `npm run lint`
2. Typecheck: `npx tsc --noEmit -p tsconfig.json`
3. Build:     `npm run build`
All three must be GREEN. If any fails for a reason you cannot fix within scope, STOP and
write `BLOCKED.md` (see contract below) — do not weaken the gate, do not skip it.

## Commit discipline
- Commit ONLY the files you changed for this slice (the source file(s) under `src/`,
  `CLAUDE.md`, `AGENTS.md`). Use logical, narratable commit message(s) in English.
- **Do NOT `git add -A` / `git add .`.** The working tree has pre-existing untracked
  artifacts that are NOT part of this slice and must NOT be committed:
  `.codex/`, `.superpowers/`, `quality'`. Stage files explicitly by path.
- End commit message(s) with:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- Do NOT push. Do NOT touch `main`.

## Termination contract (MANDATORY — fail-closed)
End your run by writing exactly one of these files at the repo root:
- `REPORT.md` (success) containing, in English:
  - What you wired and where (file + how the control is placed).
  - Which redirect path you chose and why.
  - Diff summary (files changed, brief description per file).
  - Commit list on `feature/logout-ui-wiring` (hashes + subjects).
  - Gate results: exact pass/fail for `npm run lint`, `npx tsc --noEmit`, `npm run build`.
  - Any deviations from this dispatch or risks you noticed.
- `BLOCKED.md` (could not complete) containing: the reason, the exact failure
  (stderr/output), and the current state of the working tree.

Do not finish silently. Missing report = the orchestrator treats the run as failed.
