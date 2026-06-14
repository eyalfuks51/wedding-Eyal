# Code Review Dispatch — Auth merge-conflict resolution (commit e5aee78)

You are an **independent adversarial code reviewer**. You did NOT write this code.
Your job is to find defects, not to praise. Be skeptical. Default to flagging
anything you are unsure about.

## Hard constraints (read-only review)
- **MODIFY NOTHING.** Do not edit, create, or delete any file. Do not run any
  write/mutating command. You are in a read-only sandbox; respect it.
- Use only read commands: `git diff`, `git show`, `git log`, `cat`, ripgrep, etc.
- Working root is this repository (a git worktree on branch
  `feature/guesto-marketing-landing-next`, HEAD = e5aee78).

## Context
This commit (e5aee78) is a **merge of `main` (Track A, tip eb4ba4a) into the
marketing feature branch**. Exactly one file conflicted: `src/contexts/AuthContext.tsx`.
The resolution was authored by the *other* model camp (Claude). You (Codex) are the
cross-camp reviewer. This code is about to be merged to `main`, so this review is the
gate. The app is a Supabase-backed React (Vite) wedding-RSVP SaaS; this file is the
**auth provider** — security-sensitive.

### The resolution strategy that was applied ("combine")
- Started from **marketing's** version of `AuthContext.tsx`, which had introduced:
  `withTimeout()` (see `src/contexts/auth-utils.ts`), an 8s `AUTH_READY_TIMEOUT_MS`,
  a null-client guard, extracted `resolveSuperAdmin()` / `markAuthReady()`, a
  `getSession()` call bounded by `withTimeout`, and null-safe `signOut`.
- Then **re-introduced main's deadlock guard**: marketing had *removed* the
  `setTimeout(0)` defer inside the `onAuthStateChange` callback; the resolution put it
  back. The callback was made non-async.

### The specific hazard this guards against (verify it is actually neutralized)
Supabase's `onAuthStateChange` callback fires **from inside the auth lock**. Any
Supabase query issued *synchronously* inside that callback re-enters
`getSession() -> await initializePromise` — the very promise the lock is already
awaiting — and **deadlocks** the auth init. The fix is to defer the super-admin
lookup to a macrotask via `setTimeout(..., 0)` so it runs *after* the lock releases.
NOTE: `void asyncFn()` does NOT defer to a macrotask — it runs synchronously up to the
first `await`, so it can still deadlock. Only `setTimeout(0)` (or equivalent) is safe.

## What to verify (review checklist)
1. **Deadlock safety (PRIMARY):** In the FINAL `onAuthStateChange` callback, is the
   super-admin lookup (`resolveSuperAdmin`) actually deferred via `setTimeout(0)` and
   NOT called synchronously? Confirm no Supabase query can run synchronously inside the
   callback before the lock releases.
2. **The other lookup path:** `markAuthReady()` calls `resolveSuperAdmin()` directly
   (no setTimeout). Confirm that path runs OUTSIDE the auth lock (it is invoked from
   the `.then()` of `getSession()`), so it is NOT subject to the same deadlock. If you
   believe it IS at risk, say so explicitly.
3. **`withTimeout()` correctness** (`auth-utils.ts`): no unhandled rejection, timer is
   always cleared (no leak), `Promise.race` semantics correct, rejection message useful.
   Check `auth-utils.test.ts` actually covers timeout + resolve + reject + timer-cleanup.
4. **State-safety:** `cancelled` guard prevents `setState` after unmount in every async
   path (getSession `.then`/`.catch`, the deferred setTimeout, resolveSuperAdmin).
   `initialAuthResolved` correctly prevents double-resolution / loading-state races.
5. **Regression vs main:** super-admin status is still resolved correctly and `loading`
   still flips to false in all paths (success, timeout, error, signed-out, null-client).
   Compare against main's version: `git show eb4ba4a:src/contexts/AuthContext.tsx`.
6. **Security:** does anything here allow an unauthenticated/normal user to be treated
   as super-admin, or leak/skip the auth check? Any auth bypass introduced by the merge?
7. **signOut** null-safety and any missing `subscription.unsubscribe()` / cleanup leak.

## How to inspect
```
git show e5aee78:src/contexts/AuthContext.tsx        # the resolved file
git show e5aee78:src/contexts/auth-utils.ts
git show e5aee78:src/contexts/auth-utils.test.ts
git diff eb4ba4a HEAD -- src/contexts/               # what changed vs main
git show eb4ba4a:src/contexts/AuthContext.tsx        # main's pre-merge version
```

## OUTPUT CONTRACT (mandatory — this is the channel's fail-closed signal)
Your **final message** MUST begin with exactly one of these lines as the very first line:
- `VERDICT: CLEAN`            — no blocking issues; safe to merge to main.
- `VERDICT: CHANGES_REQUESTED`— one or more real defects must be fixed before merge.
- `VERDICT: BLOCKED`          — you could not complete the review (missing context,
                                tooling failure); explain why.

After that first line, provide:
- A short summary (2-4 sentences).
- Findings as a numbered list. For each: `severity (critical|high|medium|low) —
  file:line — what's wrong — why it matters — suggested fix`. If none, write "No findings."
- Explicitly state your conclusion on checklist items 1 and 2 (the deadlock paths).

Do not modify any file. End by emitting the final message only.
