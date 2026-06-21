# Phase 1: Database & Multi-Event Context - Context

**Gathered:** 2026-03-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Schema migration (`is_super_admin` on `public.users`) and `EventContext` refactor to support multiple events per user. Includes `switchEvent(id)` with localStorage persistence, expanded `ProtectedRoute` for multi-event routing, and query functions for multi-event fetching. Event Switcher UI is Phase 4 — this phase delivers the data layer and context hooks it will consume.

</domain>

<decisions>
## Implementation Decisions

### Multi-event switching
- Default event on login: last selected from localStorage, fallback to most recently created event if localStorage is empty or stale
- Stale localStorage ID (event deleted or access lost): silent fallback to first available event — clear stale ID, no error shown
- `switchEvent(id)` performs a soft context refresh — update EventContext state + localStorage in-place, no navigation or page reload
- **Critical:** All data-fetching `useEffect` hooks in `Dashboard.tsx`, `AutomationTimeline.tsx`, and `DashboardSettings.tsx` MUST include `currentEvent.id` in their dependency arrays to refetch on event switch
- Events array sorted by `event_date DESC` (most recent first), fallback to `created_at DESC` if no event_date

### Super admin data access
- Super admins fetch ALL platform events (no limit/pagination for now — platform is small)
- `is_super_admin` flag fetched from `public.users` table on login, stored in `AuthContext` alongside user/session
- No visual distinction between owned and non-owned events for super admins — flat list
- Super admins get full edit access on any event (not read-only) — they are the platform operator

### ProtectedRoute multi-event logic
- When events array is non-empty but no currentEvent selected: auto-select `events[0]` (same as stale-ID fallback)
- Zero events: direct redirect to `/onboarding` (keep current behavior, no welcome page)
- EventProvider stays inside ProtectedRoute (current wrapping pattern preserved, minimal refactor)
- Public event pages (`/:slug`) remain completely independent of auth/EventContext — untouched

### Migration & data model
- `is_super_admin` column: `DEFAULT false`, non-breaking — all existing users unaffected
- Skip RLS policy changes for now — current RLS is permissive, super admin access works through frontend query logic
- Add `UNIQUE(user_id, event_id)` composite constraint on `user_events` — prevents duplicates, serves as index for multi-event queries
- Events query for EventContext also fetches `partner1_name`, `partner2_name` (for Event Switcher labels in Phase 4)
- Super admin seeding: manual DB update via Supabase dashboard (no user IDs in migration files)

### Claude's Discretion
- Exact query structure for multi-event fetch (single query with conditional logic vs separate super admin / regular user functions)
- How to structure the `isSuperAdmin` check in AuthContext (additional useEffect vs combined with session fetch)
- Error handling patterns for failed event fetches
- TypeScript interface expansion for EventData (adding partner names)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `EventContext.tsx`: Currently fetches single event via `fetchEventForUser()` — needs refactor to `events[]` + `currentEvent` + `switchEvent(id)`
- `AuthContext.tsx`: Manages session/user — will be extended with `isSuperAdmin` boolean fetched from `public.users`
- `ProtectedRoute.tsx`: Already wraps dashboard routes with `EventProvider` — just needs the "no event" check changed to "events array empty"
- `useFeatureAccess.ts`: Minimal hook (`canManageGuests`, `canUseWhatsApp`) — Phase 3 expands this, Phase 1 just ensures EventContext feeds it correctly
- `fetchEventForUser()` in `supabase.js`: Queries `user_events` with `.limit(1).maybeSingle()` — needs replacement with multi-event version

### Established Patterns
- Data access centralized in `src/lib/supabase.js` — all new queries go here
- Contexts in `src/contexts/` with `useXxx()` consumer hooks
- Dashboard pages use `useEventContext()` for current event data
- Migrations are timestamp-prefixed snake_case SQL in `supabase/migrations/`

### Integration Points
- `EventContext` is consumed by every dashboard page (`Dashboard.tsx`, `AutomationTimeline.tsx`, `DashboardSettings.tsx`) and by `useFeatureAccess`
- `AuthContext` is consumed by `ProtectedRoute` and available globally
- `ProtectedRoute` is the gateway for all `/dashboard/*` routes in `App.jsx`
- `user_events` table is the join between users and events — central to the multi-event query

</code_context>

<specifics>
## Specific Ideas

- All dashboard data-fetching hooks must react to `currentEvent.id` changes (explicit dependency array requirement from user)
- Event Switcher labels should use partner names (fetched now, displayed in Phase 4)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-database-multi-event-context*
*Context gathered: 2026-03-16*
