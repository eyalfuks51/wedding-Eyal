---
phase: 05-paywalls-upgrade-modal
plan: "03"
subsystem: ui
tags: [react, paywall, upgrade-modal, glass-card, feature-gating]

# Dependency graph
requires:
  - phase: 05-paywalls-upgrade-modal
    provides: UpgradeModal component and useFeatureAccess hook with canAccessTimeline flag

provides:
  - Premium placeholder in AutomationTimeline for draft users (PAY-01 route-level paywall)
  - Draft users see GlassCard placeholder with upgrade CTA instead of Navigate redirect

affects: [05-paywalls-upgrade-modal]

# Tech tracking
tech-stack:
  added: []
  patterns: [early-return premium placeholder pattern, state-before-early-return for hooks rules compliance]

key-files:
  created: []
  modified:
    - src/pages/AutomationTimeline.tsx

key-decisions:
  - "Premium placeholder uses same page shell (sticky header + DashboardNav) as real timeline so draft users retain navigation context"
  - "upgradeOpen state declared before if (!canAccessTimeline) early return to satisfy React hooks rules"
  - "ToastKind only supports success/error so onUpgradeClick uses default success toast"

patterns-established:
  - "Route-level paywall pattern: declare all state hooks, then early return with full-page placeholder instead of Navigate redirect"

requirements-completed: [PAY-01]

# Metrics
duration: 5min
completed: 2026-03-16
---

# Phase 05 Plan 03: Timeline Premium Placeholder Summary

**AutomationTimeline draft-user gate replaced from silent Navigate redirect to full-page GlassCard premium placeholder with upgrade CTA wired to UpgradeModal**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-16T19:55:00Z
- **Completed:** 2026-03-16T19:57:38Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Removed silent `<Navigate to="/dashboard/settings" replace />` for draft users on /dashboard/timeline
- Added inline premium placeholder: sticky header, DashboardNav, centered GlassCard with Calendar icon, Hebrew description, and "שדרגו לגרסה המלאה" CTA
- Clicking CTA opens UpgradeModal; confirming upgrade shows a "בקרוב!" success toast
- Active event users continue to see the normal Automation Timeline pipeline unchanged
- TypeScript compiles cleanly (no errors)

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace Timeline redirect with premium placeholder** - `1086e0c` (feat)

**Plan metadata:** _(docs commit follows)_

## Files Created/Modified
- `src/pages/AutomationTimeline.tsx` - Removed Navigate import/redirect; added upgradeOpen state, GlassCard/UpgradeModal imports, and inline premium placeholder for draft users

## Decisions Made
- `upgradeOpen` state declared before the `if (!canAccessTimeline)` early return so React hooks rules are respected (hooks must not be called conditionally)
- Used existing `showToast` / `ToastContainer` mechanism in the placeholder — consistent with the rest of the page
- `onUpgradeClick` calls `showToast` with default 'success' kind (ToastKind only allows 'success' | 'error')

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- PAY-01 (route-level paywall for Timeline) is complete
- Plan 05-04 (if any) can proceed — all paywall prerequisites are in place
- Draft users now discover the Timeline feature exists and have a clear upgrade path

---
*Phase: 05-paywalls-upgrade-modal*
*Completed: 2026-03-16*
