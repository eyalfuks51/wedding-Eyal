# Code Review Dispatch — Auth fix re-review (round 3, commit 5410fb4)

You are an **independent adversarial code reviewer**. Rounds 1 and 2 of this
review returned CHANGES_REQUESTED. Round 2 left exactly ONE open finding (high).
Your job now: verify that finding is fully resolved, and that the fix introduced
**no new defects** — especially no `loading`-hang and no flicker regression. Be
skeptical. Default to flagging anything you are unsure about.

## Hard constraints (read-only review)
- **MODIFY NOTHING.** Read-only sandbox. Use only read commands: `git show`,
  `git diff`, `git log`, `cat`, ripgrep.
- Working root: this repository (a git worktree on branch
  `feature/guesto-marketing-landing-next`, HEAD = 5410fb4). The fix under review
  is commit **5410fb4**; the prior reviewed state was **d2ee3e8**.

## Context
`src/contexts/AuthContext.tsx` is the Supabase auth provider (security-sensitive:
super-admin gating). After this passes, the branch merges to `main`.

### The round-2 finding this commit must resolve (verify it is now closed)
**(high)** After the initial auth resolve (`initialAuthResolved = true`), a
*subsequent* `onAuthStateChange` (a different user signs in, or sign-out)
published the new session but kept the **previous** user's `isSuperAdmin = true`
with `loading = false` until the deferred lookup completed. During that window:
- `useFeatureAccess` (`src/hooks/useFeatureAccess.ts:9`, `isSuperAdmin || isActive`)
  and `EventSwitcher` (`src/components/dashboard/EventSwitcher.tsx:40`,
  `events.length > 1 || isSuperAdmin`) read `isSuperAdmin` **WITHOUT** gating on
  `loading` — so the new/normal user briefly saw super-admin UI unlocked.
- `EventContext` (`src/contexts/EventContext.tsx:55,68`) DOES gate on `authLoading`
  but branches `isSuperAdmin ? fetchAllEvents : fetchEventsForUser`.

### How the fix works (verify the claims)
`applySession` now tracks `appliedUserId` (the user id reflected in state). On a
session change it computes `identityChanged = nextUserId !== appliedUserId`. If
`initialAuthResolved && identityChanged`, it eagerly `setIsSuperAdmin(false)` and
`setLoading(true)` before scheduling the deferred lookup. `resolveSuperAdmin` now
lowers `loading` (and sets `initialAuthResolved = true`) on **every** matching-epoch
resolve, not just the first. A same-user `TOKEN_REFRESHED` has
`identityChanged === false`, so neither the clear nor the re-gate fires.

### Invariants that must NOT regress
1. **Deadlock:** the super-admin lookup must stay deferred via `setTimeout(0)` in
   the `onAuthStateChange` path (the callback fires inside Supabase's auth lock; a
   synchronous query re-enters `getSession() -> await initializePromise` and
   deadlocks). `void asyncFn()` alone does NOT defer.
2. **Epoch stale-guard:** a lookup from an older session must never apply its
   result or release the gate for a newer/superseded session.

## What to verify (be adversarial)
1. **Round-2 finding resolved:** Trace super-admin A signed-in (appliedUserId=A,
   isSuperAdmin=true, loading=false) → onAuthStateChange fires with user B (or
   null). Confirm `isSuperAdmin` is cleared to false AND `loading` is raised to
   true synchronously in the same `applySession` call, BEFORE the deferred lookup,
   so neither ungated consumer (useFeatureAccess/EventSwitcher) nor EventContext
   can observe `user=B, isSuperAdmin=true`.
2. **No `loading` hang (PRIMARY new risk):** Prove `loading` ALWAYS returns to
   false after an identity change, on every path: success, no-user/sign-out,
   timeout, lookup error. Walk rapid changes A→B→C: epochs 2 and 3 both raise
   loading; confirm the superseded epoch-2 lookup is discarded by the epoch guard
   and the latest epoch-3 lookup lowers loading. Confirm there is NO sequence
   where loading is raised but never lowered.
3. **No flicker on token refresh:** Confirm a same-user `TOKEN_REFRESHED`
   (`nextUserId === appliedUserId`) does NOT clear isSuperAdmin or raise loading,
   so an admin is not bounced to a loading state or briefly de-privileged on every
   token refresh.
4. **Initial load unaffected:** On the very first `applySession` (appliedUserId
   undefined, initialAuthResolved false), confirm the identity-change branch is
   skipped (loading stays true from useState), and the first resolve lowers it.
   Confirm a was-signed-out → first sign-in transition still gates correctly.
5. **Deadlock + epoch invariants intact** (see above): confirm both still hold in
   5410fb4 — the setTimeout(0) defer and the `epoch !== authEpoch` guard are
   unchanged and correct.
6. **No new defects:** double-resolution, lost session update, setState-after-
   unmount (`cancelled` guard), `subscription.unsubscribe`, `signOut` null-safety.
   Any NEW auth-bypass (a user treated as super-admin they are not)? Consider the
   eager `setIsSuperAdmin(false)`: can it cause an EventContext double-fetch or an
   under-privileged fetch that fails to self-correct once the lookup resolves?

## How to inspect
```
git show 5410fb4 --stat
git diff d2ee3e8 5410fb4 -- src/contexts/AuthContext.tsx
git show 5410fb4:src/contexts/AuthContext.tsx
git show 5410fb4:src/contexts/EventContext.tsx
git show 5410fb4:src/hooks/useFeatureAccess.ts
git show 5410fb4:src/components/dashboard/EventSwitcher.tsx
git show eb4ba4a:src/contexts/AuthContext.tsx   # main's pre-merge baseline
```

## OUTPUT CONTRACT (mandatory — this is the channel's fail-closed signal)
Your **final message** MUST begin with exactly one of these lines as the very
first line:
- `VERDICT: CLEAN`             — round-2 finding resolved, no new blocking issues;
                                 safe to merge to main.
- `VERDICT: CHANGES_REQUESTED` — finding unresolved, or a new defect; must fix.
- `VERDICT: BLOCKED`           — could not complete the review; explain why.

After that first line, provide:
- A short summary (2-4 sentences).
- Findings as a numbered list (severity — file:line — what's wrong — why it
  matters — suggested fix), or "No findings."
- An explicit resolution status for the round-2 finding, plus a yes/no on each:
  loading-always-resolves, no-token-refresh-flicker, deadlock-intact, epoch-intact.

Do not modify any file. End by emitting the final message only.
