# Phase 10: Integration Fixes & Code Quality - Research

**Researched:** 2026-03-18
**Domain:** React state management, auth lifecycle, race conditions, code cleanup
**Confidence:** HIGH

## Summary

Phase 10 addresses 7 integration and code quality issues identified by the v1.0 milestone audit. These range from high-severity race conditions (auth token refresh losing `isSuperAdmin`, onboarding redirect race) through medium UX issues (Timeline tab visibility, stale data flash on event switch) down to low-severity tech debt (inline phone normalization, dead code, cosmetic type casts).

All 7 issues are well-understood with clear root causes identified during the audit. The fixes are surgical edits to existing files -- no new libraries, no schema changes, no new components needed. The primary risk is regression in existing auth/routing flows, which can be mitigated by targeted testing.

**Primary recommendation:** Group fixes into two logical waves -- (1) behavioral fixes that affect runtime UX (INT-01 through INT-04), and (2) pure code cleanup with zero runtime impact (INT-05 through INT-07).

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INT-01 | `AuthContext.onAuthStateChange` re-queries `is_super_admin` on token refresh | Auth lifecycle analysis below; `onAuthStateChange` callback needs async DB query |
| INT-02 | Onboarding -> dashboard redirect waits for `user_events` row visibility | Race condition analysis below; `EventProvider.refetch()` or polling pattern needed |
| INT-03 | `DashboardNav` hides Timeline tab for draft users via `gateKey` | Nav gating analysis below; change `gateKey` from `null` to `'canAccessTimeline'` |
| INT-04 | `Dashboard.tsx` clears invitations state before re-fetching on `currentEvent` change | Stale data analysis below; reset state at top of useEffect |
| INT-05 | `AddGuestModal` imports `normalisePhone` from `phone.ts` instead of inline | Phone normalization analysis below; delete inline, import canonical |
| INT-06 | Dead code removed: `fetchEventForUser` in supabase.js, unused `Navigate` in Dashboard.tsx | Dead code inventory below |
| INT-07 | Cosmetic type casts cleaned up in EventContext.tsx and AutomationTimeline.tsx | Type cast inventory below |
</phase_requirements>

## Standard Stack

No new libraries needed. All fixes use existing dependencies.

### Core (already installed)
| Library | Purpose | Relevant to |
|---------|---------|-------------|
| `@supabase/supabase-js` | Auth state change listener, DB queries | INT-01, INT-02 |
| `react-router-dom` | Navigation, `Navigate` component | INT-02, INT-06 |
| React (hooks) | `useEffect`, `useState`, `useCallback` | INT-01, INT-04 |

## Architecture Patterns

### Pattern 1: Re-querying user metadata on token refresh (INT-01)

**What:** The `onAuthStateChange` callback in `AuthContext.tsx` currently only calls `setSession(session)`. It does NOT re-query `is_super_admin` from the `users` table. This means after a Supabase token refresh event, `isSuperAdmin` stays `false` even for super admins.

**Current code (line 42-44 of AuthContext.tsx):**
```typescript
const { data: { subscription } } = supabase!.auth.onAuthStateChange((_event, session) => {
  setSession(session);
});
```

**Fix pattern:** Add an async re-query of `is_super_admin` inside the `onAuthStateChange` callback, similar to the initial `getSession` flow. Guard with the `cancelled` flag. Only re-query when `session?.user?.id` is present (skip on sign-out events where session is null).

**Key consideration:** The `onAuthStateChange` fires for multiple event types: `SIGNED_IN`, `TOKEN_REFRESHED`, `SIGNED_OUT`, `USER_UPDATED`. The re-query should happen on `TOKEN_REFRESHED` and `SIGNED_IN` (when session has a user). On `SIGNED_OUT`, reset `isSuperAdmin` to `false`.

### Pattern 2: Solving the onboarding redirect race (INT-02)

**What:** After `createOnboardingEvent` returns, `OnboardingPage` sets `localStorage.currentEventId` and shows step 4 (success screen). When the user clicks "Continue to settings", `navigate('/dashboard/settings', { replace: true })` fires. `ProtectedRoute` wraps that route with `EventProvider`, which calls `fetchEventsForUser()`. If Supabase RLS hasn't propagated the new `user_events` row yet, `events.length === 0` and the user gets bounced back to `/onboarding`.

**Root cause:** The `create_onboarding_event` RPC inserts into `events` and `user_events`, but there can be a propagation delay between the RPC completing and the next SELECT seeing the row (especially with connection pooling or RLS policy evaluation).

**Fix options (ranked):**

1. **EventProvider-aware redirect (recommended):** After onboarding success, instead of a blind `navigate()`, use `EventProvider.refetch()` from within the dashboard route. The simplest approach: in `OnboardingPage`, navigate to dashboard/settings. In `ProtectedRoute`, when `events.length === 0` AND `localStorage.currentEventId` exists, retry `fetchEventsForUser` with a short delay (e.g., 500ms, max 3 retries) before redirecting to `/onboarding`. This handles the race without changing the onboarding flow.

2. **Optimistic event injection:** After `createOnboardingEvent` returns the event data, pass it via navigation state (`navigate('/dashboard/settings', { state: { newEvent: event } })`). `EventProvider` checks `location.state.newEvent` and seeds its events array. This avoids the re-fetch entirely but adds coupling.

3. **Poll in onboarding before navigating:** After step 4 success, before navigate, poll `fetchEventsForUser` until the new event appears. This delays navigation but guarantees data visibility.

**Recommendation:** Option 1 is cleanest -- minimal code change, handles edge case without touching onboarding. Add a retry mechanism in `ProtectedRoute` or `EventProvider` when `events` is empty but `localStorage.currentEventId` exists.

### Pattern 3: Nav gating for Timeline tab (INT-03)

**What:** `DashboardNav.tsx` line 7 sets `gateKey: null` for the Timeline tab. The filter on line 16 (`!tab.gateKey || access[tab.gateKey]`) means `null` gateKey always passes. Draft users see the tab, click it, and hit a full-page paywall.

**Fix:** Change the Timeline tab's `gateKey` from `null` to `'canAccessTimeline'`.

**Important context from STATE.md:** Phase 05-01 decision says "Timeline gateKey set to null -- tab always visible so draft users can discover premium features." This was an intentional decision in Phase 5. INT-03 overrides that decision -- the audit determined this is poor UX (user sees tab, clicks, gets blocked). The requirement explicitly says "hides Timeline tab for draft users."

**Type consideration:** The `gateKey` field type in `ALL_TABS` is currently `null` for all entries. Changing one to a string key from `useFeatureAccess()` return type requires updating the type. The `as const` assertion on `ALL_TABS` handles this if the type is `string | null`. The `access[tab.gateKey]` lookup needs `tab.gateKey` to be a valid key of the `useFeatureAccess()` return type.

### Pattern 4: Clearing stale state on event switch (INT-04)

**What:** In `Dashboard.tsx`, the `useEffect` that fetches invitations (line 900-925) triggers on `currentEvent?.id` change but does NOT clear the existing `invitations` state before fetching. This causes a brief flash of the previous event's guest data.

**Fix:** At the top of the useEffect (before the async fetch), reset the invitations array:
```typescript
setInvitations([]);
setInvLoading(true);
```

Also clear related state: `setUnmatchedCount(0)`, `setInvError(null)`, and any selection state (`setSelected(new Set())`).

### Anti-Patterns to Avoid

- **Do NOT add a loading spinner that blocks the entire dashboard on event switch.** Just clear the data and show the existing loading state.
- **Do NOT use `setTimeout` as the primary mechanism for the onboarding race fix.** Use retry logic with proper cancellation.
- **Do NOT change the `onAuthStateChange` to be synchronous or blocking.** The re-query should be async and non-blocking.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Phone normalization | Inline regex in AddGuestModal | `normalizePhone` from `src/lib/phone.ts` | Already tested, canonical, handles edge cases |

## Common Pitfalls

### Pitfall 1: onAuthStateChange closure over stale cancelled flag
**What goes wrong:** The `onAuthStateChange` subscription is set up once in `useEffect`. If you add an async query inside it, the `cancelled` flag from the closure must still be valid.
**How to avoid:** The subscription lives for the component's lifetime (cleanup returns `subscription.unsubscribe()`). The `cancelled` flag is set on unmount. Since the subscription callback fires independently of the initial `getSession`, use a separate cancellation mechanism or check `session?.user?.id` directly.

### Pitfall 2: TypeScript type narrowing for gateKey
**What goes wrong:** Changing one `gateKey` from `null` to `'canAccessTimeline'` while others remain `null` breaks the `as const` type inference. The `access[tab.gateKey]` lookup needs the key to be a valid property of `useFeatureAccess()` return.
**How to avoid:** Type `gateKey` as `keyof ReturnType<typeof useFeatureAccess> | null`. The filter already handles the `null` case with `!tab.gateKey`.

### Pitfall 3: Stale data flash includes more than invitations
**What goes wrong:** Clearing only `invitations` but not KPI counts, filters, or selection state still shows stale data in the KPI cards.
**How to avoid:** Reset ALL derived state in the useEffect: invitations, message logs map, unmatched count, selected set, and search/filter values.

### Pitfall 4: EventContext type casts hiding real issues
**What goes wrong:** Removing the `as EventData[]` cast in EventContext.tsx without verifying that `fetchEventsForUser` return type matches `EventData[]`.
**How to avoid:** `supabase.js` functions are untyped (plain JS). The cast is necessary unless the functions are typed. For INT-07, either: (a) keep a single clean cast with a comment explaining why, or (b) add proper return types to supabase.js functions. Option (a) is simpler for this phase.

## Code Examples

### INT-01: AuthContext onAuthStateChange fix

```typescript
// In AuthContext.tsx, replace the onAuthStateChange callback:
const { data: { subscription } } = supabase!.auth.onAuthStateChange(
  async (_event, newSession) => {
    setSession(newSession);
    const uid = newSession?.user?.id;
    if (uid) {
      const { data } = await supabase!
        .from('users')
        .select('is_super_admin')
        .eq('id', uid)
        .single();
      if (!cancelled) setIsSuperAdmin(data?.is_super_admin ?? false);
    } else {
      // Sign-out: reset
      if (!cancelled) setIsSuperAdmin(false);
    }
  }
);
```

### INT-03: DashboardNav gateKey fix

```typescript
const ALL_TABS = [
  { path: '/dashboard',          label: 'אורחים',  gateKey: null },
  { path: '/dashboard/timeline', label: 'ציר זמן', gateKey: 'canAccessTimeline' as const },
  { path: '/dashboard/settings', label: 'הגדרות',  gateKey: null },
] as const;

// Type for the filter:
type AccessKeys = keyof ReturnType<typeof useFeatureAccess>;
const tabs = ALL_TABS.filter(
  tab => !tab.gateKey || access[tab.gateKey as AccessKeys]
);
```

### INT-04: Clear stale invitations

```typescript
useEffect(() => {
  // Clear previous event's data immediately
  setInvitations([]);
  setUnmatchedCount(0);
  setSelected(new Set());

  if (!currentEvent?.id || !supabase) return;
  // ... existing fetch logic
}, [currentEvent?.id]);
```

### INT-05: Replace inline normalisePhone

```typescript
// Remove the inline function (lines 299-302 of Dashboard.tsx):
// const normalisePhone = (raw: string): string => { ... }

// Add import at top:
import { normalizePhone } from '@/lib/phone';

// Update usage (line 334):
.map(normalizePhone)  // note: 'z' not 's' to match canonical export
```

### INT-07: EventContext type cast cleanup

```typescript
// Current (line 68-70):
fetchFn()
  .then((data: unknown) => {
    const sorted = sortEvents((data as EventData[]) ?? []);

// Cleaner -- type the parameter directly:
fetchFn()
  .then((data) => {
    const sorted = sortEvents((data ?? []) as EventData[]);
```

For AutomationTimeline.tsx, the `(currentEvent as any)` casts (lines 757-771) should access the typed properties from `EventData` interface. Since `EventData` already has `content_config`, `automation_config`, and `event_date`, the casts can be removed:

```typescript
// Current:
setTemplates(((currentEvent as any).content_config?.whatsapp_templates ?? {}) as WhatsAppTemplates);
setAutoPilot((currentEvent as any).automation_config?.auto_pilot ?? true);
const eventDate = (currentEvent as any)?.event_date ? new Date((currentEvent as any).event_date) : null;

// Fixed (EventData already types these fields):
setTemplates((currentEvent.content_config?.whatsapp_templates ?? {}) as WhatsAppTemplates);
setAutoPilot((currentEvent.automation_config as any)?.auto_pilot ?? true);
const eventDate = currentEvent?.event_date ? new Date(currentEvent.event_date) : null;
```

Note: `content_config` is typed as `Record<string, unknown> | null`, so accessing `.whatsapp_templates` requires either a type assertion or optional chaining with indexing. The `as any` can be reduced but not fully eliminated without a stricter `ContentConfig` type. The goal is to remove the outer `(currentEvent as any)` cast since `currentEvent` is already typed as `EventData`.

## Detailed File Impact

| File | Changes | Requirements |
|------|---------|-------------|
| `src/contexts/AuthContext.tsx` | Add async re-query in onAuthStateChange | INT-01 |
| `src/pages/OnboardingPage.tsx` | Minor: may need retry-aware navigation | INT-02 |
| `src/components/auth/ProtectedRoute.tsx` | Add retry when events empty but localStorage has ID | INT-02 |
| `src/components/dashboard/DashboardNav.tsx` | Change Timeline gateKey from null to 'canAccessTimeline' | INT-03 |
| `src/pages/Dashboard.tsx` | Clear state on event switch; remove inline normalisePhone; remove unused Navigate import | INT-04, INT-05, INT-06 |
| `src/lib/supabase.js` | Remove orphaned `fetchEventForUser` function | INT-06 |
| `src/contexts/EventContext.tsx` | Clean up double cast | INT-07 |
| `src/pages/AutomationTimeline.tsx` | Remove `(currentEvent as any)` casts | INT-07 |

## Open Questions

1. **INT-02 retry mechanism scope**
   - What we know: The race condition occurs between RPC completion and RLS visibility
   - What's unclear: How long the delay typically is (milliseconds vs seconds)
   - Recommendation: Use 500ms delay with max 3 retries (1.5s total worst case). If still empty after retries, fall through to onboarding redirect (graceful degradation).

2. **INT-07 strictness level**
   - What we know: `content_config` is typed as `Record<string, unknown> | null`, which requires casts to access nested properties like `.whatsapp_templates`
   - What's unclear: Whether to create a proper `ContentConfig` interface now or defer
   - Recommendation: Remove the `(currentEvent as any)` wrapping casts (since EventData types those fields). Accept that `(config?.whatsapp_templates ?? {}) as WhatsAppTemplates` still needs an assertion. A proper `ContentConfig` type is out of scope for this phase.

## Sources

### Primary (HIGH confidence)
- Direct source code analysis of all affected files (AuthContext.tsx, EventContext.tsx, Dashboard.tsx, DashboardNav.tsx, AutomationTimeline.tsx, ProtectedRoute.tsx, OnboardingPage.tsx, supabase.js, phone.ts)
- v1.0 Milestone Audit report (`.planning/v1.0-MILESTONE-AUDIT.md`) -- root cause analysis for all 7 issues
- STATE.md accumulated decisions -- context on why gateKey was set to null in Phase 5

### Secondary (MEDIUM confidence)
- Supabase `onAuthStateChange` behavior: callback fires for TOKEN_REFRESHED, SIGNED_IN, SIGNED_OUT, USER_UPDATED events. The callback can be async.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new libraries, all fixes use existing deps
- Architecture: HIGH - all root causes identified from direct code inspection
- Pitfalls: HIGH - issues are well-scoped, edge cases documented in audit

**Research date:** 2026-03-18
**Valid until:** 2026-04-18 (stable -- no external dependency changes)
