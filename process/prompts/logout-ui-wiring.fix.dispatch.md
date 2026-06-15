# Fix dispatch: logout-ui-wiring (gate + commit only)

You are the executor. A previous run of this slice ALREADY implemented the code but
could not run the gates because `npm` was missing from PATH in that shell, so it
fail-closed without committing. This run fixes the environment, runs the gates, and
commits. **Do NOT re-implement — the edits are already in the working tree.**

This file is your complete brief. Honor every rule below.

## Branch (already set up — do NOT create or switch branches)
- You are on `feature/logout-ui-wiring`. Do all work here. **Do NOT push, switch, or merge.**

## Already-present, uncommitted edits (verify, do NOT redo)
- `src/components/dashboard/DashboardNav.tsx` — adds a minimal `התנתקות` button wired to
  `useAuth().signOut()`, relying on the existing `ProtectedRoute` reactive redirect to
  `/login` (no explicit navigate — single redirect path, correct).
- `CLAUDE.md` and `AGENTS.md` — one-line Admin Dashboard note documenting the control.
- These three files are the ENTIRE intended change. Do not add, refactor, or "improve"
  anything else. If you believe a change is needed, STOP and write the blocked artifact.

## Environment fix — Node/npm location
Node and npm are installed at `C:\nvm4w\nodejs` (nvm-for-Windows) but may not be on PATH
in your shell. Before running gates, prepend it for this PowerShell session:

```powershell
$env:PATH = 'C:\nvm4w\nodejs;' + $env:PATH
npm --version   # confirm npm resolves; expect 11.x
```

If `npm` still does not resolve, call the gates by absolute path instead:
`& 'C:\nvm4w\nodejs\npm.cmd' run lint` and `& 'C:\nvm4w\nodejs\npx.cmd' tsc --noEmit -p tsconfig.json`.

## Gates (all must pass — fail-closed; a gate that cannot run is a BLOCK, not a pass)
Run from repo root (`C:\dev\github\personal\Wedding-Eyal`):
1. Lint:      `npm run lint`
2. Typecheck: `npx tsc --noEmit -p tsconfig.json`
3. Build:     `npm run build`
All three must be GREEN. If a real code/type/lint error surfaces in the changed files,
you MAY make the **minimal** fix strictly within the three already-edited files to make
the gate pass — but do NOT expand scope, restyle, or touch other files. If a gate fails
for any reason you cannot fix within those files, STOP and write the blocked artifact.

## Commit discipline (only after all three gates are GREEN)
- Stage ONLY these, by explicit path (NEVER `git add -A` / `git add .`):
  `git add src/components/dashboard/DashboardNav.tsx CLAUDE.md AGENTS.md`
- Commit with a clear English message, e.g.
  `feat(dashboard): add sign-out control to DashboardNav`
- End the commit message with:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- **Do NOT delete or modify any other tracked file.** In particular do NOT touch the
  repo-root `REPORT.md` (it belongs to a different slice) or anything under
  `process/prompts/`.
- The working tree has pre-existing untracked artifacts that are NOT yours and must NOT
  be committed: `.codex/`, `.superpowers/`, `quality'`. Leave them untracked.
- Do NOT push.

## Termination contract (MANDATORY — fail-closed)
End by writing exactly one of these (NOTE the slice-scoped paths — do NOT write a root
`REPORT.md`, that filename is already taken by another slice):
- SUCCESS → `process/prompts/logout-ui-wiring.report.md`, in English:
  - Confirmation the three files are the only change; brief description of each.
  - Which redirect path is used (reactive via ProtectedRoute) — confirm no double-navigate.
  - Gate results: exact pass/fail for `npm run lint`, `npx tsc --noEmit`, `npm run build`.
  - The commit hash + subject created on `feature/logout-ui-wiring`.
  - Any minimal in-scope fixes you had to make to pass a gate (or "none").
- BLOCKED → `process/prompts/logout-ui-wiring.blocked.md`: the reason, exact failure
  output (stderr), and current working-tree state.

Do not finish silently. Missing artifact = the orchestrator treats the run as failed.
