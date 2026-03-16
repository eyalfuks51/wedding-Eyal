---
phase: 02-onboarding-refinement
plan: "01"
subsystem: onboarding
tags: [auth, slug, supabase, onboarding]
dependency_graph:
  requires: []
  provides: [createOnboardingEvent with partner names/date, generateSlug for Hebrew names, auth-guarded onboarding route]
  affects: [src/lib/supabase.js, src/App.jsx, src/pages/OnboardingPage.tsx]
tech_stack:
  added: []
  patterns: [RequireAuth wrapper, Hebrew-safe URL slug generation]
key_files:
  created: []
  modified:
    - src/lib/supabase.js
    - src/App.jsx
    - src/pages/OnboardingPage.tsx
decisions:
  - generateSlug exported from supabase.js (not inline in OnboardingPage) for reuse and testability
  - RequireAuth implemented inline in App.jsx (simpler than ProtectedRoute — no EventProvider needed)
  - OnboardingPage.tsx call site updated to use new generateSlug and pass partner1Name/partner2Name/eventDate
metrics:
  duration: "2 minutes"
  completed_date: "2026-03-16"
  tasks_completed: 2
  files_modified: 3
---

# Phase 02 Plan 01: Onboarding Data Layer + Auth Guard Summary

**One-liner:** Hebrew-safe slug generation and partner name/date persistence in createOnboardingEvent, with RequireAuth guarding /onboarding route.

## What Was Built

### Task 1: Update createOnboardingEvent + fix slug generation

Added `generateSlug(p1, p2)` exported from `src/lib/supabase.js`. The function preserves Hebrew Unicode characters (U+0590-U+05FF) alongside Latin letters, digits, and hyphens. It appends a 6-character random suffix for uniqueness — the UNIQUE constraint on `events.slug` handles any collision.

Updated `createOnboardingEvent` to:
- Accept `partner1Name`, `partner2Name`, `eventDate` parameters
- Persist these to `partner1_name`, `partner2_name`, `event_date` columns in the events table
- Return `{ id, slug }` instead of just `{ id }`

Updated `OnboardingPage.tsx` call site to import and use `generateSlug`, and pass the new fields.

**Commit:** 76227e5

### Task 2: Add auth guard to /onboarding route

Added `RequireAuth` component inline in `App.jsx`. Uses `useAuth()` from `AuthContext`. Shows a violet spinner while auth state loads, redirects to `/login` if unauthenticated, renders children if authenticated. The `/onboarding` route is now wrapped: `<RequireAuth><OnboardingPage /></RequireAuth>`.

**Commit:** 588420d

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated OnboardingPage.tsx call site to match new function signature**
- **Found during:** Task 1 (TypeScript check after supabase.js update)
- **Issue:** `OnboardingPage.tsx` still called `createOnboardingEvent` with old signature — TypeScript emitted TS2345 error
- **Fix:** Updated import to include `generateSlug`, replaced old inline slug generation with `generateSlug(form.partner1, form.partner2)`, added `partner1Name`, `partner2Name`, `eventDate` to the call
- **Files modified:** `src/pages/OnboardingPage.tsx`
- **Commit:** 76227e5 (included in Task 1 commit)

## Self-Check: PASSED

- src/lib/supabase.js: FOUND
- src/App.jsx: FOUND
- src/pages/OnboardingPage.tsx: FOUND
- 02-01-SUMMARY.md: FOUND
- Commit 76227e5: FOUND
- Commit 588420d: FOUND
