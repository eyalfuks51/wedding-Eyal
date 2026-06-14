# Code Review Dispatch — Auth fix re-review (round 2, commit d2ee3e8)

You are an **independent adversarial code reviewer**. Round 1 of this review
returned CHANGES_REQUESTED. Your job now: verify the fixes are real and
complete, and that they introduced **no new defects**. Be skeptical. Default to
flagging anything you are unsure about.

## Hard constraints (read-only review)
- **MODIFY NOTHING.** Read-only sandbox. Use only read commands: `git show`,
  `git diff`, `git log`, `cat`, ripgrep.
- Working root: this repository (a git worktree on branch
  `feature/guesto-marketing-landing-next`, HEAD = 9a4522b). The fix under review
  is commit **d2ee3e8**.

## Context
The auth provider `src/contexts/AuthContext.tsx` was merged from `main` (Track A,
tip eb4ba4a) into the marketing branch. Round 1 reviewed the merge resolution
(e5aee78) and raised three findings. Commit **d2ee3e8** fixes them. This file is
security-sensitive (Supabase auth + super-admin gating). After this passes, the
branch merges to `main`.

### Round 1 findings (verify each is now resolved)
1. **(high)** `loading` was set to false BEFORE the super-admin lookup completed.
   `EventContext` treats `authLoading=false` as "isSuperAdmin is final" and
   branches `isSuperAdmin ? fetchAllEvents : fetchEventsForUser`; a super-admin
   with no `user_events` row could be routed to `/onboarding` before the lookup
   finished. Required fix: keep initial loading true until the deferred/bounded
   super-admin lookup completes or times out.
2. **(high)** The super-admin lookup applied results using only the `cancelled`
   guard — no session/generation guard. A slow lookup from an older session could
   set `isSuperAdmin` for a newer or signed-out session. Required fix: track an
   auth epoch / current-user id; apply only if it still matches the latest session.
3. **(low)** `auth-utils.test.ts` lacked coverage for wrapped-promise rejection
   passthrough and timer cleanup. Required fix: add those tests.

### The deadlock invariant that must NOT regress
Supabase `onAuthStateChange` fires from inside the auth lock. Any Supabase query
issued SYNCHRONOUSLY inside that callback re-enters `getSession() -> await
initializePromise` and deadlocks. The super-admin lookup must remain deferred to
a macrotask via `setTimeout(0)`. NOTE: `void asyncFn()` does NOT defer — it runs
synchronously up to the first `await`, so it can still deadlock.

## What to verify
1. **Finding 1 resolved:** In the FINAL code, does `loading` stay true until the
   super-admin lookup resolves/times out, in BOTH the getSession path and the
   onAuthStateChange path? Confirm no remaining `setLoading(false)` fires before
   the lookup. Confirm loading ALWAYS eventually resolves (success, timeout,
   error, no-user, null-client) — no path where it hangs on loading forever.
2. **Finding 2 resolved:** Is there a generation/epoch guard preventing a stale
   lookup from applying `isSuperAdmin` (or releasing the loading gate) for a
   superseded session? Walk the race: two rapid session changes — confirm only
   the latest applies.
3. **Finding 3 resolved:** Do the new tests genuinely cover wrapped-rejection
   passthrough and timer cleanup, and are they meaningful (not trivially passing)?
4. **Deadlock NOT regressed:** Confirm the super-admin lookup is still deferred
   via `setTimeout(0)` in the onAuthStateChange path; no synchronous Supabase
   query inside the callback.
5. **No new defects:** double-resolution of loading, lost session updates,
   setState-after-unmount (`cancelled` guard), missing `subscription.unsubscribe`,
   `signOut` null-safety. Any NEW auth-bypass (normal user treated as super-admin)?
6. **Regression vs main:** compare against `git show eb4ba4a:src/contexts/AuthContext.tsx`
   — is main's "resolve super-admin before ready" contract restored or bettered,
   with no loss of correctness?

## How to inspect
```
git show d2ee3e8 --stat
git diff e5aee78 d2ee3e8 -- src/contexts/
git show 9a4522b:src/contexts/AuthContext.tsx
git show 9a4522b:src/contexts/auth-utils.ts
git show 9a4522b:src/contexts/auth-utils.test.ts
git show 9a4522b:src/contexts/EventContext.tsx
git show eb4ba4a:src/contexts/AuthContext.tsx
```

## OUTPUT CONTRACT (mandatory — this is the channel's fail-closed signal)
Your **final message** MUST begin with exactly one of these lines as the very
first line:
- `VERDICT: CLEAN`             — all three findings resolved, no new blocking
                                 issues; safe to merge to main.
- `VERDICT: CHANGES_REQUESTED` — one or more findings unresolved, or a new
                                 defect; must fix before merge.
- `VERDICT: BLOCKED`           — could not complete the review; explain why.

After that first line, provide:
- A short summary (2-4 sentences).
- Findings as a numbered list (severity — file:line — what's wrong — why it
  matters — suggested fix), or "No findings."
- An explicit per-item resolution status for round-1 findings 1, 2, 3 and for
  the deadlock invariant.

Do not modify any file. End by emitting the final message only.
