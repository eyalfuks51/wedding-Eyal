---
phase: 10-integration-fixes-code-quality
plan: "01"
subsystem: auth,dashboard,routing
tags: [bug-fix, auth, onboarding, navigation, state-management]
dependency_graph:
  requires: []
  provides: [stable-super-admin-across-token-refresh, onboarding-race-fix, timeline-tab-gating, clean-event-switch]
  affects: [AuthContext, ProtectedRoute, DashboardNav, Dashboard]
tech_stack:
  added: []
  patterns: [retry-with-state-tracking, async-onAuthStateChange, clear-before-fetch]
key_files:
  created: []
  modified:
    - src/contexts/AuthContext.tsx
    - src/components/auth/ProtectedRoute.tsx
    - src/components/dashboard/DashboardNav.tsx
    - src/pages/Dashboard.tsx
decisions:
  - "INT-01: onAuthStateChange callback is now async and re-queries is_super_admin on every token event"
  - "INT-02: ProtectedRoute retries refetch up to 3x with 500ms gaps before redirecting to /onboarding"
  - "INT-03: Timeline gateKey changed from null to canAccessTimeline — overrides Phase 05-01 decision"
  - "INT-04: invitations useEffect clears all stale state before the guard to prevent flash on event switch"
metrics:
  duration: "8 minutes"
  completed: 2026-03-18
  tasks_completed: 2
  files_modified: 4
requirements: [INT-01, INT-02, INT-03, INT-04]
---

# Phase 10 Plan 01: Integration Fixes (Auth, Routing, Nav, State) Summary

**One-liner:** Four surgical bug fixes — async super-admin re-query on token refresh, onboarding redirect retry logic, Timeline tab gating for draft users, and immediate stale data clear on event switch.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Fix auth token refresh and onboarding redirect race | e23a667 | AuthContext.tsx, ProtectedRoute.tsx |
| 2 | Fix nav gating and stale data flash on event switch | 4a5ec77 | DashboardNav.tsx, Dashboard.tsx |

## What Was Built

### INT-01: Super Admin Status Persists After Token Refresh

`AuthContext.tsx` — the `onAuthStateChange` callback was synchronous and only called `setSession`. On every JWT token refresh the `isSuperAdmin` state was NOT re-evaluated, causing super admins to silently lose their elevated status mid-session.

**Fix:** Made the callback `async` and added a `supabase.from('users').select('is_super_admin')` query inside it. The `cancelled` flag from the parent `useEffect` closure guards against stale updates. On sign-out (no uid), `setIsSuperAdmin(false)` is called explicitly.

### INT-02: Onboarding Redirect Race Condition

`ProtectedRoute.tsx` — `ProtectedRouteInner` immediately redirected to `/onboarding` when `events.length === 0`. After completing onboarding and navigating to `/dashboard/settings`, there was a race: `EventProvider` had not yet fetched the newly created event, so the user was bounced back to `/onboarding`.

**Fix:** Added `retryCount` state (0–3). A `useEffect` watches for the condition `!authLoading && !eventLoading && events.length === 0 && localStorage.getItem('currentEventId')`. When true and `retryCount < 3`, it schedules a 500ms timeout that calls `refetch()` and increments `retryCount`. The render guard shows `<Spinner />` during retries instead of `<Navigate to="/onboarding">`. After 3 failed retries it falls through to the redirect (genuine zero-event case).

### INT-03: Timeline Tab Gated for Draft Users

`DashboardNav.tsx` — `ALL_TABS` had `gateKey: null` for the Timeline tab, bypassing the `!tab.gateKey || access[tab.gateKey]` filter. Draft events always showed all 3 tabs.

**Fix:** Changed to `gateKey: 'canAccessTimeline' as const`. The existing filter now correctly hides the Timeline tab when `useFeatureAccess()` returns `canAccessTimeline: false`. TypeScript validated this as a valid key of the access return type — no type assertion needed.

**Note:** This overrides the Phase 05-01 decision that "Timeline gateKey set to null so draft users can discover premium features." INT-03 requirement explicitly mandates hiding the tab for draft users.

### INT-04: Stale Data Flash on Event Switch

`Dashboard.tsx` — the invitations `useEffect` started with `if (!currentEvent?.id || !supabase) return;`. When switching events, React would re-run the effect with the new `currentEvent.id`, but the old invitations/selection/message-log states remained visible until the new fetch completed (~200-500ms flash of stale data).

**Fix:** Added five state clearing calls BEFORE the guard:
```typescript
setInvitations([]);
setUnmatchedCount(0);
setSelected(new Set());
setInvError(null);
setLatestMsgLogs(new Map());
```
The existing `setInvLoading(true)` call was moved to after the guard (removing the duplicate `setInvError(null)` that was there). Stale badge data from the previous event is now cleared immediately.

## Deviations from Plan

### Decision Override

**[INT-03] Timeline gateKey change overrides Phase 05-01 decision**
- Phase 05-01 decision: "Timeline gateKey set to null — tab always visible so draft users can discover premium features"
- INT-03 requirement: "Draft users do not see the Timeline tab in DashboardNav"
- Resolution: INT-03 is a v1.0 audit requirement. The discovery/marketing rationale is overridden by the UX correctness requirement.

Otherwise none — plan executed as written.

## Verification Results

- `npx tsc --noEmit`: passed (0 errors)
- `npm run test`: 15/15 tests passed
- All 4 files modified as specified in plan frontmatter

## Self-Check

Files exist:
- src/contexts/AuthContext.tsx — modified
- src/components/auth/ProtectedRoute.tsx — modified
- src/components/dashboard/DashboardNav.tsx — modified
- src/pages/Dashboard.tsx — modified

Commits exist:
- e23a667 — fix(10-01): fix auth token refresh and onboarding redirect race
- 4a5ec77 — fix(10-01): fix Timeline tab gating and stale data flash on event switch
