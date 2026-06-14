# Code Review Dispatch — Auth fix re-review (round 4, commit 21181d3)

You are an **independent adversarial code reviewer**. Rounds 1–3 of this review
returned CHANGES_REQUESTED. Round 3 left exactly ONE open finding (high), in
`EventContext.tsx` (not `AuthContext.tsx`). Commit **21181d3** fixes it. Your
job: verify that finding is fully resolved AND that the fix introduced **no new
defects** — especially no `isLoading`/readiness hang, no extra-render or
double-fetch regression, and no break to the onboarding retry path. Be skeptical.
Default to flagging anything you are unsure about.

## Hard constraints (read-only review)
- **MODIFY NOTHING.** Read-only sandbox. Use only read commands: `git show`,
  `git diff`, `git log`, `cat`, ripgrep.
- Working root: this repository (a git worktree on branch
  `feature/guesto-marketing-landing-next`, HEAD = 21181d3). The fix under review
  is commit **21181d3**; the prior reviewed state was **5410fb4** (AuthContext
  isSuperAdmin staleness — confirmed resolved in round 3). main baseline is
  **eb4ba4a**.

## Context
Auth-derived gating for the dashboard. `AuthContext` (super-admin flag, auth
loading) feeds `EventContext` (per-user events). `ProtectedRoute.tsx` wraps all
`/dashboard/*` routes: `ProtectedRouteInner` gates children behind
`if (authLoading || eventLoading) return <Spinner/>`. Two consumers read
EventContext-derived state **without** gating on loading:
`useFeatureAccess.ts:9` (`isSuperAdmin || isActive`) and
`EventSwitcher.tsx:40` (`events.length > 1 || isSuperAdmin`). After this passes,
the branch merges to `main`.

### The round-3 finding this commit must resolve (verify it is now closed)
**(high)** `EventContext.tsx` returned early while `authLoading`, but did not
mark its own event data stale/loading. So after `AuthContext` lowered auth
loading on an identity change, `ProtectedRouteInner` could render children for
**one render** with the **previous** user's `events`/`currentEvent` and
`eventLoading === false`, before the fetch effect set loading true. In that
window `useFeatureAccess` read a stale `isActive` and `EventSwitcher` a stale
`events.length`, briefly exposing the prior user's data / admin UI on an in-tab
account switch. Suggested fix: synchronously derive EventContext readiness from
an auth identity / data-owner key, or clear/mark event state loading while auth
is gated.

### How the fix works (verify the claims)
`EventProvider` now tracks `dataOwnerId` (the user id the loaded events belong
to), set alongside `events` inside the fetch `.then`/`.catch` and cleared to
`null` in the no-user branch. It derives readiness **synchronously** in render:
`const currentOwner = user?.id ?? null;`
`const isReady = !authLoading && !isLoading && dataOwnerId === currentOwner;`
The context value now exposes `isLoading: !isReady`, `events: isReady ? events : []`,
`currentEvent: isReady ? currentEvent : null`, `isActive: isReady && currentEvent?.status === 'active'`.
The intent: during the one-render gap, `dataOwnerId` still equals the previous
user while `currentOwner` is the new user → `isReady` is false → `isLoading` is
reported true → `ProtectedRouteInner` shows the spinner and does NOT render
children, closing the window at the single gate; the exposed value guards are
defense-in-depth for any future ungated consumer.

## What to verify (be adversarial)
1. **Round-3 finding resolved:** Trace an identity change A→B (and super-admin
   A→normal B). Confirm that on every render between `authLoading` dropping and
   the fetch effect completing for B, `isReady` is false (because either
   `authLoading` is true, or `isLoading` is true, or `dataOwnerId !== currentOwner`),
   so `ProtectedRouteInner` renders the spinner and neither `useFeatureAccess`
   nor `EventSwitcher` can read B-with-A's-data or stale super-admin UI.
2. **No readiness HANG (PRIMARY new risk):** Prove `isReady` ALWAYS becomes true
   (so `isLoading` returns false) in every steady state, with no path where it
   stays false forever:
   - signed-in with events: dataOwnerId set to user.id on resolve → ready.
   - signed-in, zero events (onboarding): `.then` sets dataOwnerId even when the
     array is empty → ready (so ProtectedRouteInner can reach the /onboarding
     redirect, not spin forever).
   - fetch error (`.catch`): dataOwnerId still set → ready.
   - signed-out: no-user branch sets dataOwnerId = null; currentOwner = null;
     `null === null` → ready → ProtectedRouteInner reaches the `!user` → /login
     redirect (NOT an infinite spinner). Confirm this explicitly.
   - super-admin: fetchAllEvents path sets dataOwnerId = user.id → ready.
3. **No double-fetch / no render loop:** `dataOwnerId` is new state set inside the
   one-shot fetch resolution. Confirm it does not feed the fetch effect's
   dependency array (`[user?.id, isSuperAdmin, authLoading, tick]`) and cannot
   cause a re-fetch loop or unbounded re-render. Confirm the exposed
   `events: isReady ? events : []` producing a fresh `[]` identity while not-ready
   does not destabilize `ProtectedRouteInner`'s retry effect (its dep is
   `events.length`, a number, not the array identity).
4. **Onboarding retry path intact (INT-02):** `ProtectedRouteInner` retries
   refetch up to 3× when `events.length === 0` and `localStorage.currentEventId`
   exists. Confirm that with the new gating, during not-ready the retry effect
   early-returns (it gates on `authLoading || eventLoading`), and once ready the
   exposed `events` is the real array so the retry/`/onboarding` decision uses
   correct data. Confirm no premature `/onboarding` redirect is introduced and
   no regression to the first-sign-in-after-onboarding race.
5. **owner-capture correctness:** `const ownerId = user.id` is captured at effect
   start and applied in the async resolution. Confirm the `cancelled` guard
   prevents a superseded effect's resolution from writing `dataOwnerId` for a
   user that has since changed (i.e. dataOwnerId can only ever be set to the
   current non-cancelled effect's user). Any way `dataOwnerId` ends up set to a
   user different from the events actually stored?
6. **Defense-in-depth guards correct:** Confirm `isActive` is false, `events` is
   `[]`, and `currentEvent` is null whenever `isReady` is false, and equal to the
   real values when ready. Any consumer that depends on `events`/`currentEvent`
   identity stability across the ready transition that could misbehave?
7. **AuthContext round-2 fix not regressed:** This diff does not touch
   `AuthContext.tsx`, but confirm the end-to-end contract still holds: on an
   identity change AuthContext clears `isSuperAdmin` and re-raises `loading`
   (so `authLoading` is true during the transition), which EventContext relies on
   for step 1. Confirm `git diff 5410fb4 21181d3 -- src/contexts/AuthContext.tsx`
   is empty.
8. **No new auth-bypass:** Any sequence where a normal user is treated as
   super-admin, or sees another user's events, even for one render? Any
   under-privileged state that fails to self-correct once the lookup/fetch
   resolves?

## How to inspect
```
git show 21181d3 --stat
git diff 5410fb4 21181d3 -- src/contexts/EventContext.tsx
git diff 5410fb4 21181d3 -- src/contexts/AuthContext.tsx   # expect empty
git show 21181d3:src/contexts/EventContext.tsx
git show 21181d3:src/contexts/AuthContext.tsx
git show 21181d3:src/components/auth/ProtectedRoute.tsx
git show 21181d3:src/hooks/useFeatureAccess.ts
git show 21181d3:src/components/dashboard/EventSwitcher.tsx
git show eb4ba4a:src/contexts/EventContext.tsx   # main's pre-merge baseline
```

## OUTPUT CONTRACT (mandatory — this is the channel's fail-closed signal)
Your **final message** MUST begin with exactly one of these lines as the very
first line:
- `VERDICT: CLEAN`             — round-3 finding resolved, no new blocking issues;
                                 safe to merge to main.
- `VERDICT: CHANGES_REQUESTED` — finding unresolved, or a new defect; must fix.
- `VERDICT: BLOCKED`           — could not complete the review; explain why.

After that first line, provide:
- A short summary (2-4 sentences).
- Findings as a numbered list (severity — file:line — what's wrong — why it
  matters — suggested fix), or "No findings."
- An explicit resolution status for the round-3 finding, plus a yes/no on each:
  readiness-always-resolves (no hang), signed-out-reaches-login,
  onboarding-retry-intact, no-double-fetch, authcontext-unchanged.

Do not modify any file. End by emitting the final message only.
