# Architecture

**Analysis Date:** 2026-03-03

## Pattern Overview

**Overall:** Multi-tenant SaaS with pluggable template system

**Key Characteristics:**
- Event-centric data model: each wedding has a unique slug (URL identifier) and complete isolation
- Database-driven configuration: event content and automation settings stored in Supabase JSONB columns
- Template dispatch pattern: React component registry maps `template_id` to concrete template implementations
- Authentication + feature gating: Draft/Active status gates feature access (guest management, WhatsApp automation)
- Event provider pattern: `EventContext` centralizes authenticated user's event state across all dashboard pages

## Layers

**Presentation Layer (Components & Pages):**
- Purpose: Render UI for event guests (public RSVP templates) and admins (dashboard views)
- Location: `src/pages/`, `src/components/`, `src/templates/`
- Contains: Page components (`EventPage`, `Dashboard`, `AutomationTimeline`, `DashboardSettings`), UI primitives (`sheet.tsx`, `glass-card.tsx`), dashboard-specific components (modals, sheets, cards)
- Depends on: React Router, Supabase client, custom contexts (`AuthContext`, `EventContext`)
- Used by: Browser, iframes (preview mode in DashboardSettings)

**Route & Auth Layer:**
- Purpose: Protect dashboard routes, manage authentication state, enforce feature access
- Location: `src/App.jsx`, `src/components/auth/ProtectedRoute.tsx`, `src/contexts/AuthContext.tsx`, `src/contexts/EventContext.tsx`
- Contains: Route definitions, auth provider, protected route wrapper, feature flag hook
- Depends on: React Router, Supabase Auth, custom providers
- Used by: Entry point (`main.jsx`)

**Business Logic & Data Layer:**
- Purpose: Fetch and mutate event/guest/automation data, handle RSVP submissions, manage automation pipeline
- Location: `src/lib/supabase.js`, `src/hooks/useEvent.js`
- Contains: Supabase client configuration, query/mutation functions, async data fetching
- Depends on: Supabase JS SDK, environment configuration
- Used by: All pages and components needing data

**Backend Processing (Edge Functions):**
- Purpose: Async background jobs (WhatsApp scheduling, Google Sheets sync, automation evaluations)
- Location: `supabase/functions/whatsapp-scheduler/`, `supabase/functions/sync-to-sheets/`, `supabase/functions/automation-engine/`
- Contains: TypeScript edge functions invoked by database triggers or manual calls
- Depends on: Green API (WhatsApp), Google Sheets API, Supabase service role client
- Used by: Database triggers on `arrival_permits` inserts, cron jobs

**Template System:**
- Purpose: Render event-specific wedding invitations with hardcoded assets and configurable content
- Location: `src/templates/`
- Contains: Two template implementations: `WeddingDefaultTemplate` (decorative, GSAP animations), `ElegantTemplate` (minimal, CSS-only)
- Depends on: Config data via `config` prop (content_config from events table), GSAP for animations
- Used by: `EventPage` for public event rendering, `LivePreview` for admin preview

## Data Flow

**Guest RSVP Submission Flow:**

1. Guest visits `/:slug` → `EventPage` fetches event via `useEvent(slug)` hook
2. Event dispatches to registered template based on `template_id`
3. Template renders `RsvpForm` component with `eventId` prop
4. Guest fills form → `handleSubmit` calls `submitRsvp(rsvpData, eventId)`
5. `submitRsvp` upserts row into `arrival_permits` table (on conflict `event_id,phone` → update)
6. Supabase database trigger fires on INSERT/UPDATE → calls `sync-to-sheets` edge function
7. Edge function reads `google_sheet_id` from `events` table, authenticates with Google Service Account, syncs to sheet

**Admin Dashboard Data Flow:**

1. User visits `/dashboard` → `ProtectedRoute` wraps page
2. `EventProvider` fetches `events` for authenticated user via `fetchEventForUser()`
3. All dashboard pages access event via `useEventContext()` hook
4. Pages load additional data (invitations, automation_settings, message_logs) via dedicated query functions
5. Admin edits: functions update `invitations`, `automation_settings`, or `events.content_config` in Supabase
6. RPC calls handle atomic JSONB patches (e.g., `update_whatsapp_template`)

**Automation Pipeline Flow:**

1. Event owner edits automation timeline (`/dashboard/timeline`) → updates `automation_settings` rows
2. Admin toggles "Auto-Pilot" → calls `toggleAutoPilot` RPC to set `events.automation_config.auto_pilot`
3. Background scheduler (edge function `whatsapp-scheduler`) polls `message_logs` for `status='pending'`
4. For each pending message: respects operating hours (Asia/Jerusalem), Shabbat awareness, checks `is_automated` flag
5. Marks message `sent` or `failed` based on Green API response
6. Dashboard reads real-time stats via `fetchMessageStatsPerStage()` and displays badge counts

**State Management:**
- Session state: `AuthContext` (user, session, signOut)
- Event state: `EventContext` (event data, isActive flag, loading, refetch callback)
- Local component state: React `useState` for forms, UI toggles, modal visibility
- No global state manager (Redux, Zustand) — context + hooks suffice for current scope

## Key Abstractions

**Event Entity:**
- Purpose: Represents one wedding, containing all configuration, automation rules, and guest data
- Examples: `src/pages/EventPage.jsx` (public rendering), `src/pages/Dashboard.tsx` (admin management)
- Pattern: Fetched by slug (public) or by authenticated user (dashboard), rendered via template dispatch or form editors

**Invitation Entity:**
- Purpose: Represents a family/group invited to the event
- Examples: `src/components/dashboard/EditGuestSheet.tsx`, `src/lib/guest-excel.ts`
- Pattern: Bulk upserted from Excel uploads, individually edited via side sheet, linked to message_logs for tracking

**Automation Settings Stage:**
- Purpose: Configures one message in the automated WhatsApp funnel (timing, template text, active/inactive toggle)
- Examples: `src/pages/AutomationTimeline.tsx`, `src/components/dashboard/StageEditModal.tsx`
- Pattern: Canonical stages (icebreaker, nudge, ultimatum, logistics, hangover) + up to 3 dynamic nudges; edited via modal with live date preview

**Message Log Entry:**
- Purpose: Tracks individual WhatsApp message delivery (pending, sent, failed states)
- Examples: `src/pages/Dashboard.tsx` (badge display), `src/components/dashboard/StageLogsSheet.tsx` (drill-down history)
- Pattern: Created by background scheduler, aggregated for per-stage stats, queried individually for per-guest history

## Entry Points

**Public Event Page (`/:slug`):**
- Location: `src/pages/EventPage.jsx`
- Triggers: User visits URL
- Responsibilities:
  - Fetch event by slug via `useEvent` hook
  - Look up template component in `TEMPLATES` registry
  - Pass event data and content_config to template
  - Handle preview mode (iframe post-message bridge for live editing)

**Admin Dashboard (`/dashboard`):**
- Location: `src/pages/Dashboard.tsx`
- Triggers: Authenticated user with active event visits
- Responsibilities:
  - Display 4 KPI cards (families, total pax, pending, declined counts)
  - Render filterable guest table with bulk selection
  - Show message status badges and history
  - Provide bulk actions (send message, export) and individual guest editing
  - Handle guest upload modal for Excel import

**Automation Timeline (`/dashboard/timeline`):**
- Location: `src/pages/AutomationTimeline.tsx`
- Triggers: Admin visits timeline tab
- Responsibilities:
  - Display horizontal (desktop) or vertical (mobile) pipeline of automation stages
  - Show Auto-Pilot master toggle
  - Render stage status (sent/active/scheduled/disabled) with real-time message stats
  - Provide stage editing modal (timing, templates, delete dynamic nudges)
  - Drill-down into per-stage message logs via side sheet

**Event Settings (`/dashboard/settings`):**
- Location: `src/pages/DashboardSettings.tsx`
- Triggers: Admin visits settings tab
- Responsibilities:
  - Edit event content (couple names, date, venue, schedule, footer, transport)
  - Live preview template rendering via iframe (desktop split-pane, mobile overlay)
  - Save changes to `events.content_config` table
  - Exclude WhatsApp templates (managed in timeline)

## Error Handling

**Strategy:** Catch-and-display with user-friendly Hebrew messages

**Patterns:**

1. **Data fetch errors** (`useEvent`, `fetchEventForUser`, etc.):
   - Catch silently on race-cancelled requests (cleanup flag prevents stale state updates)
   - Re-throw for UI-level catch: show `NotFoundPage` or redirect to onboarding

2. **Form submission errors** (`submitRsvp`, bulk uploads, settings saves):
   - Display toast or inline error message with Hebrew text
   - Example: `"אירעה שגיאה בשליחת האישור. אנא נסו שוב."` (RSVP error)

3. **Bulk operations** (guest upload, message bulk-send):
   - Partial success: show success count + error list grouped by row
   - User corrects data and retries without losing non-errored rows

4. **Automation errors** (stage editing, RPC calls):
   - Modal/sheet shows inline error below action button
   - Toast feedback for async operations (e.g., "Template updated")

## Cross-Cutting Concerns

**Logging:**
- `console.log` for debug info (e.g., current template ID, RSVP submission)
- No structured logging framework — output to browser DevTools

**Validation:**
- Frontend: Client-side shape validation (required fields, phone format) in forms
- Backend: Supabase RLS policies + RPC whitelisting for untrusted inputs (stage_name whitelist, event_id verification)
- Example: `update_whatsapp_template` RPC validates stage_name against canonical + dynamic list

**Authentication:**
- Supabase Auth (email + password or OAuth)
- Session persisted via browser local storage (Supabase SDK handles)
- Protected routes check `user` + `event` existence before rendering

**Authorization:**
- Feature gating: `useFeatureAccess` hook checks `event.status === 'active'` to unlock guest management, automation
- Row-level security (RLS): Supabase policies on `invitations`, `automation_settings`, `arrival_permits` verify event ownership (implicit via user_events table)

**Internationalization:**
- Entirely Hebrew RTL; all UI strings hardcoded in Hebrew (no translation layer)
- Dates formatted via `toLocaleDateString('he-IL', {...})` for Hebrew calendar display

---

*Architecture analysis: 2026-03-03*
