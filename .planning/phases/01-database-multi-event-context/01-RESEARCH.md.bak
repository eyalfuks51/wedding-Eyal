# Phase 1: Database & Multi-Event Context - Research

**Researched:** 2026-03-16
**Domain:** Supabase schema migration, React Context refactoring, multi-tenant data access
**Confidence:** HIGH

## Summary

Phase 1 transforms the application from a single-event-per-user model to a multi-event model. The existing infrastructure is well-structured for this: `user_events` join table already exists with a `UNIQUE(user_id, event_id)` constraint, `EventContext` cleanly wraps dashboard routes via `ProtectedRoute`, and all dashboard pages already destructure `event` from `useEventContext()` and use `event.id` in their data-fetching effects.

The migration is limited to adding `is_super_admin` boolean to `public.users` (non-breaking, DEFAULT false). The bulk of work is frontend: refactoring `EventContext` from single-event to multi-event (events array + currentEvent + switchEvent), updating `fetchEventForUser()` to return all user events, adding super-admin-aware query logic, and wiring localStorage persistence for `currentEventId`.

**Primary recommendation:** Sequence as migration-first, then supabase query functions, then EventContext refactor, then AuthContext extension, then ProtectedRoute update. Each step is independently testable.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Default event on login: last selected from localStorage, fallback to most recently created event if localStorage is empty or stale
- Stale localStorage ID (event deleted or access lost): silent fallback to first available event -- clear stale ID, no error shown
- `switchEvent(id)` performs a soft context refresh -- update EventContext state + localStorage in-place, no navigation or page reload
- All data-fetching `useEffect` hooks in `Dashboard.tsx`, `AutomationTimeline.tsx`, and `DashboardSettings.tsx` MUST include `currentEvent.id` in their dependency arrays to refetch on event switch
- Events array sorted by `event_date DESC` (most recent first), fallback to `created_at DESC` if no event_date
- Super admins fetch ALL platform events (no limit/pagination for now -- platform is small)
- `is_super_admin` flag fetched from `public.users` table on login, stored in `AuthContext` alongside user/session
- No visual distinction between owned and non-owned events for super admins -- flat list
- Super admins get full edit access on any event (not read-only)
- When events array is non-empty but no currentEvent selected: auto-select `events[0]`
- Zero events: direct redirect to `/onboarding`
- EventProvider stays inside ProtectedRoute (current wrapping pattern preserved)
- Public event pages (`/:slug`) remain completely independent of auth/EventContext -- untouched
- `is_super_admin` column: `DEFAULT false`, non-breaking
- Skip RLS policy changes for now -- super admin access works through frontend query logic
- Add `UNIQUE(user_id, event_id)` composite constraint on `user_events` (ALREADY EXISTS in schema)
- Events query also fetches `partner1_name`, `partner2_name` (for Event Switcher labels in Phase 4)
- Super admin seeding: manual DB update via Supabase dashboard

### Claude's Discretion
- Exact query structure for multi-event fetch (single query with conditional logic vs separate super admin / regular user functions)
- How to structure the `isSuperAdmin` check in AuthContext (additional useEffect vs combined with session fetch)
- Error handling patterns for failed event fetches
- TypeScript interface expansion for EventData (adding partner names)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DB-01 | `public.users` table has `is_super_admin` boolean column (default false) | Migration pattern documented; existing `public.users` schema analyzed |
| DB-02 | Migration is non-breaking -- all existing users get `is_super_admin = false` | DEFAULT false handles this automatically; no data migration needed |
| CTX-01 | `EventContext` fetches array of events for the authenticated user | EventContext refactor pattern documented; current single-event code analyzed |
| CTX-02 | Super admin users can fetch all events across the platform | Two-path query strategy documented (conditional on `isSuperAdmin`) |
| CTX-03 | Regular users see only events linked via `user_events` join table | Current `fetchEventForUser()` already uses `user_events`; extend to return array |
| CTX-04 | `currentEvent` state managed in context with `switchEvent(id)` method | Context shape and switchEvent implementation pattern documented |
| CTX-05 | `currentEventId` persisted in localStorage, falls back to first event | localStorage persistence pattern with stale-ID fallback documented |
| CTX-06 | `supabase.js` has query functions for multi-event fetching | Two new functions documented: `fetchEventsForUser()` and `fetchAllEvents()` |
| AUTH-01 | `ProtectedRoute` handles multi-event: events -> dashboard, no events -> onboarding | ProtectedRoute refactor pattern documented; current code analyzed |
| AUTH-02 | `ProtectedRoute` provides `EventProvider` context to all dashboard pages | Already works this way; minimal change needed |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @supabase/supabase-js | (existing) | Database queries, auth, RPC | Already in project |
| React | (existing) | UI framework | Already in project |
| react-router-dom | (existing) | Routing, Navigate | Already in project |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| TypeScript | (existing) | Type safety for context interfaces | All new/modified files |

No new dependencies required for this phase. Everything builds on the existing stack.

## Architecture Patterns

### Current Architecture (Single Event)
```
AuthProvider
  -> App
    -> ProtectedRoute
      -> EventProvider (fetches ONE event via fetchEventForUser)
        -> ProtectedRouteInner (checks: no user -> /login, no event -> /onboarding)
          -> Dashboard / Timeline / Settings
```

### Target Architecture (Multi Event)
```
AuthProvider (+ isSuperAdmin from public.users)
  -> App
    -> ProtectedRoute
      -> EventProvider (fetches ARRAY of events, manages currentEvent + switchEvent)
        -> ProtectedRouteInner (checks: no user -> /login, events.length === 0 -> /onboarding)
          -> Dashboard / Timeline / Settings (use currentEvent from context)
```

### Pattern 1: EventContext Refactor
**What:** Transform EventContext from single-event to multi-event with selection
**When to use:** This is the core pattern for the entire phase

Current context shape:
```typescript
// BEFORE
interface EventContextValue {
  event:     EventData | null;
  isActive:  boolean;
  isLoading: boolean;
  refetch:   () => void;
}
```

Target context shape:
```typescript
// AFTER
interface EventData {
  id:               string;
  slug:             string;
  template_id:      string;
  content_config:   Record<string, unknown> | null;
  event_date:       string | null;
  automation_config: Record<string, unknown> | null;
  status:           'draft' | 'active';
  partner1_name:    string | null;  // NEW — for Phase 4 Event Switcher labels
  partner2_name:    string | null;  // NEW
}

interface EventContextValue {
  events:       EventData[];        // All events the user can access
  currentEvent: EventData | null;   // Currently selected event
  isActive:     boolean;            // currentEvent?.status === 'active'
  isLoading:    boolean;
  switchEvent:  (id: string) => void;
  refetch:      () => void;
}
```

**Backward compatibility:** Consumers currently use `event` -- rename to `currentEvent`. All consumers must be updated. This is a small, finite set: `Dashboard.tsx`, `AutomationTimeline.tsx`, `DashboardSettings.tsx`, `ProtectedRoute.tsx`, `useFeatureAccess.ts`.

### Pattern 2: localStorage Persistence with Stale Fallback
**What:** Persist selected event ID across sessions, handle stale IDs gracefully
**Implementation:**

```typescript
const STORAGE_KEY = 'currentEventId';

// Inside EventProvider, after events are fetched:
function resolveCurrentEvent(events: EventData[]): EventData | null {
  if (events.length === 0) return null;

  const storedId = localStorage.getItem(STORAGE_KEY);
  if (storedId) {
    const match = events.find(e => e.id === storedId);
    if (match) return match;
    // Stale ID — clear and fall through
    localStorage.removeItem(STORAGE_KEY);
  }

  // Fallback: first event (array is already sorted by event_date DESC)
  return events[0];
}

function switchEvent(id: string) {
  const match = events.find(e => e.id === id);
  if (match) {
    setCurrentEvent(match);
    localStorage.setItem(STORAGE_KEY, id);
  }
}
```

### Pattern 3: AuthContext Extension for Super Admin
**What:** Fetch `is_super_admin` from `public.users` after session is established
**Recommendation:** Fetch in a separate useEffect that runs when `session?.user?.id` changes. Keep it decoupled from the auth state change listener to avoid complexity.

```typescript
interface AuthContextValue {
  user:         User | null;
  session:      Session | null;
  loading:      boolean;
  isSuperAdmin: boolean;   // NEW
  signOut:      () => Promise<void>;
}

// Inside AuthProvider:
const [isSuperAdmin, setIsSuperAdmin] = useState(false);

useEffect(() => {
  if (!session?.user?.id) {
    setIsSuperAdmin(false);
    return;
  }
  supabase
    .from('users')
    .select('is_super_admin')
    .eq('id', session.user.id)
    .single()
    .then(({ data }) => {
      setIsSuperAdmin(data?.is_super_admin ?? false);
    });
}, [session?.user?.id]);
```

### Pattern 4: Conditional Multi-Event Query
**Recommendation:** Two separate functions in `supabase.js` -- cleaner than conditional logic in one function. The EventProvider calls the appropriate one based on `isSuperAdmin`.

```typescript
// Regular user: fetch events via user_events join
export const fetchEventsForUser = async (): Promise<EventData[]> => {
  const { data, error } = await supabase
    .from('user_events')
    .select('events(id, slug, template_id, content_config, event_date, automation_config, status, partner1_name, partner2_name)')
    .order('events(event_date)', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(row => row.events).filter(Boolean) as EventData[];
};

// Super admin: fetch all events directly
export const fetchAllEvents = async (): Promise<EventData[]> => {
  const { data, error } = await supabase
    .from('events')
    .select('id, slug, template_id, content_config, event_date, automation_config, status, partner1_name, partner2_name')
    .order('event_date', { ascending: false });
  if (error) throw error;
  return (data ?? []) as EventData[];
};
```

**Important RLS consideration:** The super admin `fetchAllEvents()` queries `events` directly, but existing RLS only allows authenticated users to SELECT events they own via `user_events`. The user decided to skip RLS changes for now -- this means super admin access must bypass RLS. Two options:
1. Add an RLS policy: `is_super_admin = true` on `public.users` allows SELECT on all events
2. Use a SECURITY DEFINER RPC function

**Recommendation:** Option 1 is simpler and aligns with the existing RLS pattern. A single additional policy on `events` FOR SELECT:
```sql
CREATE POLICY "Super admins can select all events"
  ON events FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_super_admin = true)
  );
```
This is minimal and non-breaking. Without it, `fetchAllEvents()` will return empty results for super admins who don't own events via `user_events`. **This contradicts the "skip RLS changes" decision** -- the planner should flag this to the user or include it as a minimal necessary RLS addition.

### Pattern 5: EventProvider Depends on AuthContext
**What:** EventProvider needs `isSuperAdmin` to decide which fetch function to call
**Current:** EventProvider is inside ProtectedRoute, which is inside AuthProvider (in main.jsx). So AuthContext is available.

```typescript
// EventProvider needs to consume AuthContext
export function EventProvider({ children }: { children: ReactNode }) {
  const { user, isSuperAdmin } = useAuth();
  // ...fetch logic depends on isSuperAdmin
}
```

This is safe because `EventProvider` is always rendered inside `AuthProvider` (guaranteed by `ProtectedRoute` being a child of the auth-wrapped tree).

### Anti-Patterns to Avoid
- **Storing full event objects in localStorage:** Only store the ID. Event data may change between sessions.
- **Fetching events inside ProtectedRouteInner:** Keep the fetch in EventProvider. ProtectedRouteInner only reads context.
- **Using `event` as the context property name:** Rename to `currentEvent` to distinguish from the events array. Avoids confusion.
- **Navigating on switchEvent:** The user explicitly decided soft refresh only -- update state and localStorage, no `navigate()` call.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Auth state management | Custom JWT parsing | `supabase.auth.onAuthStateChange` + `getSession` | Already works, handles token refresh |
| Event access control | Frontend-only checks | Supabase RLS policies | Security must be enforced server-side |
| Cross-tab sync | Custom BroadcastChannel | Single-tab localStorage (sufficient for now) | Over-engineering for current scale |

## Common Pitfalls

### Pitfall 1: Supabase Join Query Ordering
**What goes wrong:** Ordering by a joined table's column (e.g., `events.event_date` when querying `user_events`) uses a different syntax in Supabase.
**Why it happens:** The PostgREST API has specific syntax for ordering on related tables.
**How to avoid:** Use `order('event_date', { foreignTable: 'events', ascending: false })` or fetch and sort client-side. Client-side sort is simpler and more predictable for small datasets.
**Warning signs:** Events appearing in wrong order; query returning error about unknown column.

### Pitfall 2: EventContext Re-Renders on switchEvent
**What goes wrong:** Every dashboard child re-renders when `switchEvent` changes the context value, even if the child doesn't use `events` or `switchEvent`.
**Why it happens:** React Context triggers re-render for all consumers when any part of the value changes.
**How to avoid:** For this app's scale, this is acceptable. Don't prematurely optimize with split contexts. The re-render triggers data re-fetch via useEffect dependency arrays, which is the desired behavior.

### Pitfall 3: Race Condition Between Auth and Events Fetch
**What goes wrong:** EventProvider tries to fetch events before AuthContext has loaded the session, resulting in unauthenticated requests that return empty/error.
**Why it happens:** Both contexts initialize in parallel.
**How to avoid:** EventProvider should guard on `user` being non-null before fetching. The current ProtectedRouteInner already checks `authLoading`, but EventProvider runs its useEffect immediately. Add `user?.id` to the EventProvider's fetch dependency array and short-circuit if null.

### Pitfall 4: Stale Dependency Arrays in Dashboard Pages
**What goes wrong:** After renaming `event` to `currentEvent`, a dashboard page still references the old variable name, causing the useEffect to not re-run on event switch.
**Why it happens:** Find-and-replace misses optional chaining patterns like `event?.id`.
**How to avoid:** Systematic rename: `event` -> `currentEvent` in all destructuring from `useEventContext()`. The TypeScript compiler will catch most misses since the interface changes.

### Pitfall 5: Super Admin RLS Bypass
**What goes wrong:** Super admin calls `fetchAllEvents()` but RLS blocks access to events they don't own via `user_events`.
**Why it happens:** Existing RLS on `events` only allows SELECT when `user_events` has a matching row.
**How to avoid:** Either add a super-admin SELECT policy on `events` (recommended) or use a SECURITY DEFINER RPC. See Architecture Patterns section for details.

### Pitfall 6: partner1_name / partner2_name Missing from events Table
**What goes wrong:** The query tries to select `partner1_name, partner2_name` but these columns don't exist in the `events` table schema as documented in CLAUDE.md.
**Why it happens:** These fields exist in CLAUDE.md's schema (`partner1_name`, `partner2_name`), confirming they are on the `events` table. The current `fetchEventForUser` and `fetchEventBySlug` just don't select them.
**How to avoid:** Simply add them to the select list. No migration needed -- columns already exist.

## Code Examples

### Migration: Add is_super_admin to public.users
```sql
-- Non-breaking: all existing rows get DEFAULT false
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_super_admin boolean NOT NULL DEFAULT false;
```

### Optional: Super Admin RLS Policy
```sql
-- Allow super admins to read all events (needed for fetchAllEvents to work)
CREATE POLICY "Super admins can select all events"
  ON events FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.is_super_admin = true
    )
  );
```

### Sorting Events Client-Side
```typescript
// Sort by event_date DESC, fallback to created_at if no date
function sortEvents(events: EventData[]): EventData[] {
  return [...events].sort((a, b) => {
    const dateA = a.event_date || '';
    const dateB = b.event_date || '';
    return dateB.localeCompare(dateA); // DESC
  });
}
```

### Full EventProvider Skeleton
```typescript
export function EventProvider({ children }: { children: ReactNode }) {
  const { user, isSuperAdmin } = useAuth();
  const [events, setEvents]             = useState<EventData[]>([]);
  const [currentEvent, setCurrentEvent] = useState<EventData | null>(null);
  const [isLoading, setLoading]         = useState(true);
  const [tick, setTick]                 = useState(0);

  useEffect(() => {
    if (!user?.id) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);

    const fetchFn = isSuperAdmin ? fetchAllEvents : fetchEventsForUser;
    fetchFn()
      .then(data => {
        if (cancelled) return;
        const sorted = sortEvents(data);
        setEvents(sorted);
        setCurrentEvent(resolveCurrentEvent(sorted));
        setLoading(false);
      })
      .catch(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [user?.id, isSuperAdmin, tick]);

  const switchEvent = useCallback((id: string) => {
    const match = events.find(e => e.id === id);
    if (match) {
      setCurrentEvent(match);
      localStorage.setItem(STORAGE_KEY, id);
    }
  }, [events]);

  return (
    <EventContext.Provider value={{
      events,
      currentEvent,
      isActive: currentEvent?.status === 'active',
      isLoading,
      switchEvent,
      refetch: () => setTick(t => t + 1),
    }}>
      {children}
    </EventContext.Provider>
  );
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single event per user | Multi-event via `user_events` join | This phase | Core data model shift |
| `fetchEventForUser()` returns single event | Returns array | This phase | All consumers must handle array |
| No admin concept | `is_super_admin` on `public.users` | This phase | Enables platform oversight |
| `event` in context | `currentEvent` + `events[]` | This phase | All dashboard consumers updated |

## Open Questions

1. **Super Admin RLS Policy**
   - What we know: User said "skip RLS changes," but existing RLS on `events` table blocks super admins from reading events they don't own.
   - What's unclear: Whether user intended super admin to bypass this via RLS or some other mechanism.
   - Recommendation: Include a minimal super-admin SELECT policy on `events` as a "necessary RLS addition" (not a full RLS rework). Flag this clearly in the plan for user awareness. Without it, CTX-02 cannot be fulfilled.

2. **Supabase Foreign Table Ordering**
   - What we know: PostgREST has `foreignTable` option for ordering on joined tables.
   - What's unclear: Whether ordering `user_events` by `events.event_date` works reliably with the Supabase JS client.
   - Recommendation: Sort client-side after fetch. Dataset is small (user has 1-5 events), so no performance concern.

3. **Super Admin RLS on Other Tables**
   - What we know: `invitations`, `message_logs`, `automation_settings` all have RLS policies scoped via `user_events`.
   - What's unclear: When a super admin selects an event they don't own, can they read that event's invitations/messages?
   - Recommendation: Same pattern -- add super-admin SELECT/UPDATE policies on these tables, or add a `user_events` row for the super admin. The latter is simpler and requires zero RLS changes but is semantically wrong. Flag for user decision during planning.

## Sources

### Primary (HIGH confidence)
- Existing codebase analysis: `EventContext.tsx`, `AuthContext.tsx`, `ProtectedRoute.tsx`, `supabase.js`, `App.jsx`
- Existing migrations: `20260302100000_auth_multitenant_schema.sql`, `20260302100100_auth_rls_policies.sql`
- CLAUDE.md project documentation (database schema, architecture patterns)

### Secondary (MEDIUM confidence)
- CONTEXT.md user decisions (user-provided, locked)
- REQUIREMENTS.md requirement definitions

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new dependencies, everything uses existing libraries
- Architecture: HIGH - clear refactor path from single-event to multi-event, all code inspected
- Pitfalls: HIGH - identified through direct code analysis (RLS policies, dependency arrays, join ordering)
- Super admin RLS gap: MEDIUM - identified a conflict between "skip RLS changes" and CTX-02 requirement

**Research date:** 2026-03-16
**Valid until:** 2026-04-16 (stable domain, no external dependencies changing)
