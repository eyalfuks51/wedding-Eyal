# Slice report: logout-ui-wiring

**Status:** COMPLETE (committed on `feature/logout-ui-wiring`, not pushed).
**Commit:** `91c32eb` — feat(dashboard): add sign-out control to DashboardNav

## What was wired
A logged-in user can now sign out from the dashboard UI. Before this slice no UI
path ended a Supabase session (Supabase persists + auto-refreshes the session in
localStorage), so account switching was impossible.

- `src/components/dashboard/DashboardNav.tsx` — added `import { useAuth }`, read
  `signOut` from context, added `handleSignOut = async () => { await signOut() }`,
  and rendered a minimal neutral `<button type="button">` with the literal label
  `התנתקות` and `aria-label="התנתקות"`, placed between `EventSwitcher` and the
  notification bell. No nav restyle.
- `CLAUDE.md` + `AGENTS.md` — one mirrored sentence in the Admin Dashboard section
  documenting the control (+ harmless EOF newline normalization).

These three files are the entire change.

## Redirect path
Reactive only. `await signOut()` clears the session → `onAuthStateChange` sets
`user` null → `ProtectedRoute` (`src/components/auth/ProtectedRoute.tsx:38`) renders
`<Navigate to="/login" replace />`. No explicit `navigate('/login')` in the handler —
single redirect path, no double-navigate. AuthContext `signOut` was NOT modified.

## Gates (all GREEN)
- `npm run lint` — exit 0.
- `npx tsc --noEmit -p tsconfig.json` — exit 0.
- `npm run build` — exit 0 (pre-existing >500 kB chunk-size warning only; unrelated).

Note: gates were run by the orchestrator in the Claude Code harness, not by Codex.
Codex authored the code correctly but its `-s workspace-write` sandbox cannot reach
the nvm4w Node install (`where.exe node/npm/npx` → not found, even by absolute path),
so it fail-closed twice without running gates. Running the gates is verification, not
authoring; the executor's code was committed unmodified. Cross-review camp split was
preserved (Codex executed → separate clean-context Claude reviewer).

## Cross-review
Clean-context Claude subagent (did not author the diff). Verdict: **APPROVE WITH NITS**.
- Scope: PASS (only the 3 allowed files; no auth-logic edits).
- Redirect: reactive-only confirmed, no double-navigate.
- Nits (both explicitly out of the "minimal button" scope; deferred, not fixed):
  1. `signOut()` rejection is unhandled — on a network failure the button silently
     does nothing (no `try/catch`, no toast). One-line `.catch` if error UX is later
     in scope.
  2. No fallback navigation on signOut failure (correct tradeoff given the
     single-redirect constraint).

## Deviations / risks
- Gate execution moved from Codex to orchestrator (sandbox Node isolation; see above).
- Visual design (placement, styling, icon, final copy) intentionally left neutral —
  owned by Mor, refined later.
- Not pushed; stays on the feature branch pending integration authorization.
