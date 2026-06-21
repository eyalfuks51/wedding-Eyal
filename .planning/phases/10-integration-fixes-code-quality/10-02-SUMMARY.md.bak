---
phase: 10-integration-fixes-code-quality
plan: 02
subsystem: code-quality
tags: [refactor, dead-code, type-safety, phone-normalization]
dependency_graph:
  requires: ["10-01"]
  provides: ["INT-05", "INT-06", "INT-07"]
  affects: ["src/pages/Dashboard.tsx", "src/lib/supabase.js", "src/contexts/EventContext.tsx", "src/pages/AutomationTimeline.tsx"]
tech_stack:
  added: []
  patterns: ["canonical-import", "typed-boundary-cast"]
key_files:
  created: []
  modified:
    - src/pages/Dashboard.tsx
    - src/lib/supabase.js
    - src/contexts/EventContext.tsx
    - src/pages/AutomationTimeline.tsx
decisions:
  - "AutomationTimeline auto_pilot cast uses `as boolean` at setAutoPilot call site — Record<string,unknown> indexing yields unknown, boolean assertion is correct since DB enforces it"
metrics:
  duration: "5 minutes"
  completed: "2026-03-18T10:38:00Z"
---

# Phase 10 Plan 02: Code Quality Cleanup Summary

Zero-runtime-impact tech debt cleanup: canonical phone import, dead code removal, and targeted type cast improvements replacing unsafe `as any` patterns.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Replace inline phone normalization and remove dead code | 1dbc0db | Dashboard.tsx, supabase.js |
| 2 | Clean up cosmetic type casts | 65a933e | EventContext.tsx, AutomationTimeline.tsx |

## Changes Made

### Task 1: Phone normalization + dead code (INT-05, INT-06)

**Dashboard.tsx:**
- Removed unused `Navigate` import from react-router-dom
- Added `import { normalizePhone } from '@/lib/phone'`
- Deleted inline `normalisePhone` arrow function (duplicate of canonical phone.ts logic)
- Updated `.map(normalisePhone)` call to `.map(normalizePhone)` (canonical American spelling)

**supabase.js:**
- Removed `fetchEventForUser` function (14 lines) — confirmed zero callers in entire src/ tree
- Function queried a `user_events` join table that is no longer used (superseded by `fetchEventsForUser`)

### Task 2: Type cast cleanup (INT-07)

**EventContext.tsx:**
- Changed `fetchFn().then((data: unknown) => { const sorted = sortEvents((data as EventData[]) ?? [])`
  to `fetchFn().then((data) => { const sorted = sortEvents((data ?? []) as EventData[])`
- Single clean cast at the usage site with explanatory comment; removes redundant `: unknown` annotation

**AutomationTimeline.tsx:**
- Replaced `(currentEvent as any).content_config?.whatsapp_templates` with typed `(currentEvent.content_config as Record<string, unknown>)?.whatsapp_templates` — preserves type checking on EventData
- Replaced `(currentEvent as any).automation_config?.auto_pilot` with typed `(currentEvent.automation_config as Record<string, unknown> | null)?.auto_pilot` — added `as boolean` at setAutoPilot call site since JSONB indexing yields `unknown`
- Replaced `(currentEvent as any)?.event_date` with direct `currentEvent?.event_date` — no cast needed, `event_date` is already typed as `string | null` on EventData

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added `as boolean` cast for auto_pilot setAutoPilot call**
- **Found during:** Task 2 TypeScript verification
- **Issue:** `Record<string, unknown>` indexing yields `unknown`; `setAutoPilot` expects `boolean | SetStateAction<boolean>` — TypeScript error TS2345
- **Fix:** Added `as boolean` cast at the `setAutoPilot(...)` call site since the database enforces boolean type
- **Files modified:** src/pages/AutomationTimeline.tsx
- **Commit:** 65a933e

## Verification Results

- `npm run test`: 15/15 passed
- `npx tsc --noEmit`: clean (no errors)
- `grep -r "fetchEventForUser" src/`: zero results
- `grep "currentEvent as any" src/pages/AutomationTimeline.tsx`: zero results
- `grep "normalisePhone" src/pages/Dashboard.tsx`: zero results

## Self-Check: PASSED

All files found on disk. Both commits verified in git log.
