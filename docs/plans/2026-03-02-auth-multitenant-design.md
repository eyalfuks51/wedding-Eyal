# Auth & Multi-Tenancy Design
**Date:** 2026-03-02
**Status:** Approved

## Overview

Add Google Login and full multi-tenant support to the Wedding RSVP Platform. Each couple
self-registers, creates a draft event via a wizard, and gets Settings + Preview access
immediately. Operational features (guest management, WhatsApp automation) unlock only after
admin approves the event by flipping `events.status = 'active'` in the DB.

---

## Goals

- Protect all `/dashboard/*` routes behind Google OAuth
- Support multiple Google accounts per event (couple co-ownership)
- Draft state: Settings + Preview only
- Active state: full feature access
- Super-admin manages approval directly in Supabase dashboard (no admin UI)
- Existing `hagit-and-itai` event and all RSVP-facing pages remain unaffected

---

## Architecture: Supabase Auth + RLS-first

All data isolation enforced at the DB layer via Row Level Security. The frontend reads auth
session and queries — it never enforces access itself.

---

## Data Model

### New table: `users`
Mirrors `auth.users`. Auto-populated via a Postgres trigger on `auth.users` insert.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | FK → auth.users.id |
| `email` | text | |
| `full_name` | text | |
| `avatar_url` | text | |
| `created_at` | timestamptz | |

### New table: `user_events`
Join table for multi-owner event access.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `user_id` | uuid | FK → users.id |
| `event_id` | uuid | FK → events.id |
| `role` | text | `'owner'` \| `'co-owner'` |
| `created_at` | timestamptz | |

### Modified table: `events`
Add one column:

| Column | Type | Notes |
|---|---|---|
| `status` | text | `'draft'` \| `'active'`, default `'draft'` |

### RLS Policies
All protected tables (`events`, `invitations`, `message_logs`, `automation_settings`,
`user_events`) get policies requiring `auth.uid()` to have a matching row in `user_events`
for that `event_id`.

Public tables (anon access unchanged):
- `arrival_permits` — guests submit RSVPs without login
- Edge functions use service role key — bypass RLS

---

## Auth & Routing Flow

### New routes
| Route | Access | Purpose |
|---|---|---|
| `/login` | Public | Google sign-in page |
| `/onboarding` | Auth-required, no event | 3-step wizard for new users |
| `/dashboard/*` | Auth-required, has event | Protected dashboard |
| `/:slug` | Public | RSVP page (unchanged) |
| `/preview/:slug` | Public | Live preview (unchanged) |

### `ProtectedRoute` wrapper
Wraps all `/dashboard/*` routes:
1. No session → redirect `/login`
2. Session + no `user_events` row → redirect `/onboarding`
3. Session + event → render children

### Post-login redirect logic
1. OAuth callback completes
2. Query `user_events` for `auth.uid()`
3. Row found → redirect `/dashboard`
4. No row → redirect `/onboarding`

### Onboarding wizard (3 steps)
1. **Pick template** — visual cards (wedding-default, elegant, …)
2. **Enter details** — couple names, event date, venue
3. **Confirm** — creates `events` row (`status='draft'`) + `user_events` row (`role='owner'`) → redirect `/dashboard`

---

## App-level React Contexts

### `AuthContext`
Provided at app root. Exposes:
- `user` — Supabase auth user object
- `session` — current session
- `signOut()` — signs out and redirects to `/login`
- `loading` — true while session is resolving

### `EventContext`
Provided inside `ProtectedRoute`. Exposes:
- `event` — the current event object (replaces hardcoded slug)
- `isActive` — `event.status === 'active'`
- `isLoading`

All dashboard pages consume `useEvent()` from `EventContext`.

---

## Feature Gating

Single hook: `useFeatureAccess()` returns `{ canManageGuests, canUseWhatsApp }`.

### `draft` state
| Feature | Access |
|---|---|
| `/dashboard/settings` | ✅ Full access |
| `/preview/:slug` | ✅ Full access |
| `/dashboard` (guest table) | ❌ Hidden tab, redirect to settings |
| `/dashboard/timeline` | ❌ Hidden tab, redirect to settings |
| Guest upload, export, bulk actions | ❌ Buttons hidden |

A persistent banner on settings: *"האירוע שלכם במצב טיוטה — Preview ועריכת עיצוב פעילים. גישה לניהול אורחים תיפתח לאחר אישור."*

### `active` state
All tabs and features unlocked. Banner disappears.

---

## Migration Strategy

### DB migrations (ordered)
1. Add `status` column to `events`, default `'draft'`
2. Set `hagit-and-itai` to `status = 'active'` immediately
3. Create `users` table + trigger on `auth.users`
4. Create `user_events` table
5. Apply new RLS policies to all protected tables

### Existing data
- `hagit-and-itai` event data, invitations, message_logs — untouched
- RSVP-facing pages (`/:slug`, `arrival_permits`) — anon RLS unchanged
- Scheduler and sync-to-sheets edge functions — service role key, bypass RLS

### Super-admin bootstrap
1. Sign in with Google → `users` row auto-created via trigger
2. Manually insert `user_events` row: your `user_id` + `hagit-and-itai` event ID + `role='owner'`
3. Dashboard works as today, now auth-protected

---

## Out of Scope (this phase)
- Admin UI for approvals (DB-only)
- Co-owner invitation flow (users table supports it, UI deferred)
- Payment gating
- Email notifications on signup
