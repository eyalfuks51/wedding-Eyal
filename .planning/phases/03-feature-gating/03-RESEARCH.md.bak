# Phase 3: Feature Gating - Research

**Researched:** 2026-03-16
**Domain:** React hook-based feature gating with event status (draft/active)
**Confidence:** HIGH

## Summary

Phase 3 is a focused refactor of the existing `useFeatureAccess` hook to expose the exact boolean flags and numeric limits required by GATE-01 through GATE-06. The infrastructure is already in place: `EventContext` already exposes `isActive` (derived from `currentEvent?.status === 'active'`), `AuthContext` exposes `isSuperAdmin`, and `useFeatureAccess` already gates features using these two values. The existing consumers (Dashboard, AutomationTimeline, DashboardSettings, DashboardNav) already call `useFeatureAccess` and use its return values for navigation filtering and route redirects.

The work is purely a rename/expand of the hook's return interface -- no new contexts, no new data fetching, no database changes. The current `canManageGuests` and `canUseWhatsApp` booleans need to be replaced with the five specific flags from GATE-01..05 plus the `maxFreeGuests` constant from GATE-06. All four existing consumers must be updated to use the new property names.

**Primary recommendation:** Expand `useFeatureAccess` return type with the six required properties, update all four consumers in a single coordinated change.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| GATE-01 | `useFeatureAccess` returns `canAccessSettings: true` (always open) | New property, always `true` -- trivial addition |
| GATE-02 | `canAccessTimeline: true` only if event status === 'active' | Replace `canManageGuests` usage in DashboardNav and AutomationTimeline redirect |
| GATE-03 | `canImportGuests: true` only if event status === 'active' | Replace `canManageGuests` usage in Dashboard import button logic |
| GATE-04 | `canExportGuests: true` only if event status === 'active' | Replace `canManageGuests` usage in Dashboard export button logic |
| GATE-05 | `canSendMessages: true` only if event status === 'active' | Replace `canUseWhatsApp` -- currently only referenced in hook, not consumed yet |
| GATE-06 | `maxFreeGuests: 20` | New constant property in hook return |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React (hooks) | 18.x | `useFeatureAccess` custom hook | Already in use |
| react-router-dom | 6.x | `<Navigate>` for route gating | Already in use for redirects |

### Supporting
No new libraries needed. This phase is entirely a refactor of existing code.

## Architecture Patterns

### Current Architecture (already built)
```
src/
  contexts/
    AuthContext.tsx        # isSuperAdmin
    EventContext.tsx       # isActive (status === 'active'), currentEvent
  hooks/
    useFeatureAccess.ts   # consumes both contexts, returns flags
  components/dashboard/
    DashboardNav.tsx       # filters tabs by canManageGuests
  pages/
    Dashboard.tsx          # redirects to settings if !canManageGuests
    AutomationTimeline.tsx # redirects to settings if !canManageGuests
    DashboardSettings.tsx  # shows upgrade hint if !canManageGuests
```

### Pattern: Hook Return Type Expansion

**What:** Expand the `useFeatureAccess` return object from 2 booleans to 6 properties.

**Current return type:**
```typescript
{
  canManageGuests: boolean;  // isSuperAdmin || isActive
  canUseWhatsApp:  boolean;  // isSuperAdmin || isActive
}
```

**Target return type:**
```typescript
{
  canAccessSettings:  true;              // GATE-01: always true
  canAccessTimeline:  boolean;           // GATE-02: isSuperAdmin || isActive
  canImportGuests:    boolean;           // GATE-03: isSuperAdmin || isActive
  canExportGuests:    boolean;           // GATE-04: isSuperAdmin || isActive
  canSendMessages:    boolean;           // GATE-05: isSuperAdmin || isActive
  maxFreeGuests:      number;            // GATE-06: 20
}
```

**Key insight:** All active-gated flags share the same logic (`isSuperAdmin || isActive`). They are separate properties for semantic clarity and so Phase 5 (Paywall Intercepts) can reference them individually. The `maxFreeGuests` constant lives here so all gating logic is co-located.

### Consumer Update Map

| File | Current Usage | New Usage |
|------|--------------|-----------|
| `DashboardNav.tsx` | `canManageGuests` to filter tabs | `canAccessTimeline` for timeline tab visibility |
| `Dashboard.tsx` | `canManageGuests` for redirect guard | `canImportGuests` / `canExportGuests` / `canSendMessages` for specific actions |
| `AutomationTimeline.tsx` | `canManageGuests` for redirect guard | `canAccessTimeline` for redirect |
| `DashboardSettings.tsx` | `canManageGuests` for upgrade hint | `canAccessTimeline` (or any active-gated flag) for draft hint |

### Anti-Patterns to Avoid
- **Checking `currentEvent?.status` directly in components:** All status checks must go through `useFeatureAccess`. Components should never import `EventContext` just to check draft/active status for gating purposes.
- **Hardcoding `20` in multiple places:** The free guest limit must come from `useFeatureAccess().maxFreeGuests` only. A single source of truth for easy future changes.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Feature flag system | Complex feature flag service | Simple hook with boolean returns | Only 2 states (draft/active) -- a flag service is overkill |
| Route protection | Custom route middleware | Inline `<Navigate>` redirects (already working) | Pattern is established and React Router idiomatic |
| Permission context | Separate PermissionsContext | Keep using `useFeatureAccess` hook | Hook already composes Auth + Event contexts |

## Common Pitfalls

### Pitfall 1: Incomplete Consumer Migration
**What goes wrong:** Leaving `canManageGuests` references in some files while removing it from the hook.
**Why it happens:** Four files consume the hook; easy to miss one.
**How to avoid:** TypeScript will catch this -- removing `canManageGuests` from the return type causes compile errors at every call site. Do the hook change first, then fix all errors.
**Warning signs:** TypeScript diagnostic errors after hook refactor.

### Pitfall 2: Dashboard.tsx Redirect Granularity
**What goes wrong:** Dashboard.tsx currently has a single redirect guard (`if (!canManageGuests) return <Navigate ...>`). With granular flags, the redirect logic needs care -- a draft user CAN see the guest table (with limited functionality), they just cannot import/export/send.
**Why it happens:** The current pattern redirects away from the entire Dashboard page for draft users. But GATE-01 implies settings is always accessible, and the guest table itself should be visible (just with gated actions).
**How to avoid:** Review whether the Dashboard redirect should remain or be removed. Draft users may need to see their (limited) guest list. The redirect should only apply to Timeline (GATE-02), not to the guest table itself.
**Warning signs:** Draft users cannot see any dashboard page except settings.

### Pitfall 3: maxFreeGuests Enforcement Location
**What goes wrong:** `maxFreeGuests` is exposed but never enforced anywhere in Phase 3.
**Why it happens:** GATE-06 says the hook returns the value, but enforcement (blocking guest addition at 20) is in PAY-04 (Phase 5).
**How to avoid:** Phase 3 only needs to expose the constant. Do NOT add enforcement logic yet -- that belongs to Phase 5's `UpgradeModal` integration.

### Pitfall 4: DashboardNav Tab Filtering Logic
**What goes wrong:** DashboardNav currently filters tabs using `requiresActive` + `canManageGuests`. Renaming to `canAccessTimeline` but the guest tab also has `requiresActive: true` means both tabs disappear for draft users.
**How to avoid:** Re-examine the `ALL_TABS` config. The guest tab (`/dashboard`) should be visible for draft users (they need to see their guest list). Only the timeline tab should be gated. This means changing the `requiresActive` flag on the guest tab to `false`.

## Code Examples

### Target useFeatureAccess Implementation
```typescript
// src/hooks/useFeatureAccess.ts
import { useEventContext } from '@/contexts/EventContext';
import { useAuth } from '@/contexts/AuthContext';

const FREE_GUEST_LIMIT = 20;

export function useFeatureAccess() {
  const { isActive } = useEventContext();
  const { isSuperAdmin } = useAuth();
  const unlocked = isSuperAdmin || isActive;

  return {
    canAccessSettings:  true as const,      // GATE-01
    canAccessTimeline:  unlocked,            // GATE-02
    canImportGuests:    unlocked,            // GATE-03
    canExportGuests:    unlocked,            // GATE-04
    canSendMessages:    unlocked,            // GATE-05
    maxFreeGuests:      FREE_GUEST_LIMIT,    // GATE-06
  };
}
```

### Updated DashboardNav
```typescript
const ALL_TABS = [
  { path: '/dashboard',          label: 'אורחים',  gateKey: null              },
  { path: '/dashboard/timeline', label: 'ציר זמן', gateKey: 'canAccessTimeline' },
  { path: '/dashboard/settings', label: 'הגדרות',  gateKey: null              },
] as const;

// Filter: show tab if no gateKey, or if the gated flag is true
const access = useFeatureAccess();
const tabs = ALL_TABS.filter(tab => !tab.gateKey || access[tab.gateKey]);
```

### Updated AutomationTimeline Redirect
```typescript
const { canAccessTimeline } = useFeatureAccess();
if (!canAccessTimeline) return <Navigate to="/dashboard/settings" replace />;
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `canManageGuests` / `canUseWhatsApp` | Six granular flags per GATE-01..06 | Phase 3 (this phase) | Enables Phase 5 paywall intercepts per-feature |

## Open Questions

1. **Should draft users see the guest table at all?**
   - What we know: Currently, `!canManageGuests` redirects away from `/dashboard` entirely. But Phase 5 (PAY-04) implies draft users CAN add guests (up to 20), so they need to see the guest table.
   - Recommendation: Remove the full-page redirect from Dashboard.tsx. Draft users should see the guest table with action buttons (import, export, send) disabled/gated. This aligns with PAY-04's requirement to show UpgradeModal when guest count >= maxFreeGuests.

2. **DashboardSettings upgrade hint**
   - What we know: DashboardSettings currently shows a hint when `!canManageGuests`. The new flag name should be chosen to semantically make sense (e.g., `!canAccessTimeline` as a proxy for "is draft").
   - Recommendation: Consider adding a convenience `isDraft` boolean or using `!canAccessTimeline` -- both work since all active-gated flags share the same value. Using `!canAccessTimeline` is slightly less semantic but avoids API bloat.

## Sources

### Primary (HIGH confidence)
- Direct code inspection of `src/hooks/useFeatureAccess.ts` (current 11-line implementation)
- Direct code inspection of `src/contexts/EventContext.tsx` (`isActive` derivation, `EventData.status` type)
- Direct code inspection of `src/contexts/AuthContext.tsx` (`isSuperAdmin` flag)
- Direct code inspection of all 4 consumer files (Dashboard.tsx, AutomationTimeline.tsx, DashboardSettings.tsx, DashboardNav.tsx)
- `.planning/REQUIREMENTS.md` (GATE-01 through GATE-06 definitions)

### Secondary (MEDIUM confidence)
- None needed -- this is entirely an internal refactor with no external dependencies.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new dependencies, purely existing code
- Architecture: HIGH - Pattern is established, just expanding the return type
- Pitfalls: HIGH - Identified from direct code reading of all consumer files

**Research date:** 2026-03-16
**Valid until:** No expiration -- internal refactor with no external dependency drift risk
