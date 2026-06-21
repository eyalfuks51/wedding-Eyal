# Phase 4: Dashboard Navigation - Research

**Researched:** 2026-03-16
**Domain:** React UI — dropdown component in existing DashboardNav
**Confidence:** HIGH

## Summary

Phase 4 adds an Event Switcher dropdown to `DashboardNav` so users with multiple events can switch between them. The scope is small and well-defined: a single new component (`EventSwitcher`) embedded in the existing `DashboardNav.tsx`, consuming the already-implemented `EventContext` (`events`, `currentEvent`, `switchEvent`).

All backend infrastructure is complete from Phase 1 (CTX-01 through CTX-06). The `EventContext` already exposes `events[]`, `currentEvent`, and `switchEvent(id)`. The `AuthContext` already exposes `isSuperAdmin`. This phase is purely frontend UI work.

**Primary recommendation:** Build an `EventSwitcher` component using a simple `useState`-controlled dropdown (no new library needed), render it in `DashboardNav` conditionally based on `events.length > 1 || isSuperAdmin`, and include a "Create New Event" link at the bottom pointing to `/onboarding`.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| NAV-01 | Event Switcher dropdown in DashboardNav shows list of user's events | EventContext.events[] is ready; DashboardNav is the single integration point |
| NAV-02 | Event Switcher only renders when events.length > 1 or user is super admin | AuthContext.isSuperAdmin and EventContext.events already available |
| NAV-03 | Event Switcher includes "Create New Event" link pointing to /onboarding | /onboarding route already exists and is auth-guarded |
</phase_requirements>

## Standard Stack

### Core (already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 18+ | UI framework | Already in project |
| lucide-react | installed | Icons (ChevronDown, Plus, etc.) | Already used throughout dashboard |
| Tailwind CSS | installed | Styling | Already used throughout project |

### No New Dependencies Needed

The project does NOT have Radix `DropdownMenu` or `Popover` installed. The only Radix packages are `react-dialog`, `react-label`, and `react-slot`.

**Recommendation:** Use a simple `useState` + `useRef` + `useEffect(clickOutside)` pattern for the dropdown. This matches the project's existing pattern (the column visibility "Display" dropdown in `Dashboard.tsx` already uses this exact approach). Adding `@radix-ui/react-dropdown-menu` for a single dropdown is unnecessary dependency bloat.

## Architecture Patterns

### Current DashboardNav Structure
```
DashboardNav (renders tab buttons)
  ├── Uses useLocation, useNavigate, useFeatureAccess
  └── Returns <nav> with tab buttons
```

### Target Structure
```
DashboardNav (renders event switcher + tab buttons)
  ├── EventSwitcher (new, conditional)
  │   ├── Trigger: current event name + chevron
  │   ├── Dropdown: list of events + "Create New Event" link
  │   └── Visibility: events.length > 1 || isSuperAdmin
  └── Tab buttons (unchanged)
```

### Integration Point: DashboardNav.tsx

`DashboardNav` is imported in all 3 dashboard pages (`Dashboard.tsx`, `AutomationTimeline.tsx`, `DashboardSettings.tsx`). Modifying it once propagates everywhere. No per-page changes needed.

### EventSwitcher Component Pattern

```typescript
// src/components/dashboard/EventSwitcher.tsx
// Consumes: useEventContext() for events, currentEvent, switchEvent
// Consumes: useAuth() for isSuperAdmin
// Renders: nothing if events.length <= 1 && !isSuperAdmin (NAV-02)
// Shows: currentEvent partner names as trigger label
// Dropdown items: each event with partner names + status badge
// Footer item: "Create New Event" link → navigate('/onboarding') (NAV-03)
```

### Display Label Strategy

The `EventData` interface already includes `partner1_name` and `partner2_name` (added in Phase 1 specifically for this phase, per STATE.md decision). The dropdown trigger should display:
- `"partner1_name & partner2_name"` if both exist
- `slug` as fallback if names are null

### Dropdown Positioning

DashboardNav is RTL (`dir="rtl"`). The event switcher should be placed to the right (visually first in RTL) before the tab buttons. The dropdown panel should open downward, aligned to the start edge (right in RTL).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Click-outside dismiss | Custom DOM event logic | `useRef` + `mousedown` listener pattern | Already used in Dashboard.tsx column visibility dropdown — copy that exact pattern |

## Common Pitfalls

### Pitfall 1: EventProvider Re-instantiation
**What goes wrong:** Each `ProtectedRoute` wrapper creates a new `EventProvider`, so navigating between `/dashboard` and `/dashboard/timeline` re-mounts the provider and re-fetches events.
**Why it matters:** The switcher selection would be lost on tab navigation if state was only in component state.
**How it's mitigated:** `EventContext` already persists `currentEventId` in `localStorage` and resolves it on mount via `resolveCurrentEvent()`. The switcher will work correctly across tab navigations even though the provider re-mounts.
**Note:** This is an existing architecture characteristic, not something this phase needs to fix.

### Pitfall 2: Super Admin Edge Case
**What goes wrong:** Super admin with 0 personal events but access to all events should still see the switcher.
**How to handle:** NAV-02 says render when `events.length > 1 OR isSuperAdmin`. A super admin with `isSuperAdmin=true` always sees the switcher, even with 1 event (so they can access "Create New Event").

### Pitfall 3: Stale Dropdown After Event Creation
**What goes wrong:** User creates event via onboarding, returns to dashboard, but event list is stale.
**How it's mitigated:** `EventContext` re-fetches when the component re-mounts (which happens on navigation back to dashboard). The `refetch()` method also exists if needed.

### Pitfall 4: Current Event Highlight in Dropdown
**What goes wrong:** Forgetting to visually distinguish the currently active event in the dropdown list.
**How to avoid:** Apply `bg-violet-50 text-violet-700` (or similar) to the current event item, matching the violet-600 accent used throughout the dashboard.

## Code Examples

### Click-Outside Pattern (from existing codebase)
The Dashboard.tsx column visibility dropdown already implements this pattern. The EventSwitcher should follow the same approach:

```typescript
const [open, setOpen] = useState(false);
const ref = useRef<HTMLDivElement>(null);

useEffect(() => {
  if (!open) return;
  const handler = (e: MouseEvent) => {
    if (ref.current && !ref.current.contains(e.target as Node)) {
      setOpen(false);
    }
  };
  document.addEventListener('mousedown', handler);
  return () => document.removeEventListener('mousedown', handler);
}, [open]);
```

### Event Label Helper
```typescript
function eventLabel(event: EventData): string {
  if (event.partner1_name && event.partner2_name) {
    return `${event.partner1_name} & ${event.partner2_name}`;
  }
  return event.slug;
}
```

### Conditional Rendering (NAV-02)
```typescript
const { events, currentEvent, switchEvent } = useEventContext();
const { isSuperAdmin } = useAuth();
const showSwitcher = events.length > 1 || isSuperAdmin;

// In JSX:
{showSwitcher && <EventSwitcher />}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hardcoded `hagit-and-itai` slug | `EventContext.currentEvent` | Phase 1 (completed) | All dashboard pages already consume currentEvent from context |

## Open Questions

None. All infrastructure is in place from Phase 1. The requirements are clear and the implementation surface is small (one new component + minor DashboardNav modification).

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection: `EventContext.tsx`, `AuthContext.tsx`, `DashboardNav.tsx`, `Dashboard.tsx`, `ProtectedRoute.tsx`, `App.jsx`, `useFeatureAccess.ts`
- `.planning/REQUIREMENTS.md` — NAV-01, NAV-02, NAV-03 definitions
- `.planning/STATE.md` — Phase 1 decisions (partner names in EventData, switchEvent behavior, localStorage persistence)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new dependencies needed, all patterns already in codebase
- Architecture: HIGH - single integration point (DashboardNav), all context hooks ready
- Pitfalls: HIGH - well-understood React patterns, existing codebase precedent

**Research date:** 2026-03-16
**Valid until:** 2026-04-16 (stable — no external dependencies or fast-moving APIs)
