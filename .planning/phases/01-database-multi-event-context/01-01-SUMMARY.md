---
phase: 01-database-multi-event-context
plan: "01"
subsystem: database-auth
tags: [migration, rls, auth-context, supabase, multi-event]
dependency_graph:
  requires: []
  provides: [is_super_admin-column, fetchEventsForUser, fetchAllEvents, AuthContext.isSuperAdmin]
  affects: [EventContext, dashboard-routing]
tech_stack:
  added: []
  patterns: [secondary-useEffect-auth-fetch, client-side-sort-foreigntable]
key_files:
  created:
    - supabase/migrations/20260316100000_add_super_admin.sql
  modified:
    - src/lib/supabase.js
    - src/contexts/AuthContext.tsx
decisions:
  - "Client-side sort for fetchEventsForUser to avoid Supabase foreignTable ordering pitfall"
  - "isSuperAdmin resolved in secondary useEffect to avoid blocking initial auth loading"
  - "Pre-existing EventContext.tsx TS error is out of scope (predates this plan)"
metrics:
  duration: "2 minutes"
  completed_date: "2026-03-16"
  tasks_completed: 2
  files_changed: 3
---

# Phase 01 Plan 01: Super Admin Column + Multi-Event Query Functions Summary

**One-liner:** is_super_admin DB column with cross-event RLS policies, two new query functions, and AuthContext.isSuperAdmin for EventContext consumption.

## What Was Built

### Task 1: Migration — is_super_admin + Super Admin RLS Policies

Created `supabase/migrations/20260316100000_add_super_admin.sql` with:

- `ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_super_admin boolean NOT NULL DEFAULT false` — non-breaking, all existing users get false
- SELECT + UPDATE policies for super admins on: `events`, `invitations`, `message_logs`, `automation_settings`
- Pattern: `EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.is_super_admin = true)`

### Task 2: Query Functions + AuthContext Extension

**`src/lib/supabase.js`** — two new exported functions:

- `fetchEventsForUser()`: queries `user_events` join, maps to event objects, sorts client-side by `event_date DESC`
- `fetchAllEvents()`: queries `events` directly for super admins, ordered `event_date DESC`
- Both include: `id, slug, template_id, content_config, event_date, automation_config, status, partner1_name, partner2_name`
- Existing `fetchEventForUser` preserved unchanged

**`src/contexts/AuthContext.tsx`** — extended with:

- `isSuperAdmin: boolean` added to `AuthContextValue` interface
- `useState(false)` for `isSuperAdmin`
- Secondary `useEffect` keyed on `session?.user?.id` — queries `public.users.is_super_admin`, fails closed to `false` on error, uses cancellation flag for cleanup
- `isSuperAdmin` included in Provider value object

## Deviations from Plan

None — plan executed exactly as written.

## Key Decisions

1. **Client-side sort for fetchEventsForUser:** Supabase has a known pitfall with `.order()` on foreignTable relations — it doesn't always propagate. Sorting the result array client-side after mapping is reliable.

2. **Secondary useEffect for isSuperAdmin:** The `loading` flag covers session resolution only. isSuperAdmin resolves asynchronously after session is set, without blocking the initial auth gate — consumers get `false` first, then `true` if applicable.

3. **Pre-existing EventContext TS error left in place:** `EventContext.tsx` line 32 has a type cast error that predates this plan. It is out of scope per deviation scope rules and has been noted in deferred items.

## Self-Check: PASSED

- [x] `supabase/migrations/20260316100000_add_super_admin.sql` — exists, 18 matches for `is_super_admin|Super admin`
- [x] `fetchEventsForUser` exported from `src/lib/supabase.js`
- [x] `fetchAllEvents` exported from `src/lib/supabase.js`
- [x] `isSuperAdmin` in `AuthContextValue` interface, state, and Provider value
- [x] Task 1 commit: `1b55caf`
- [x] Task 2 commit: `c529162`
- [x] TypeScript errors from this plan's files: 0
