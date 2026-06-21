# Architecture

## Pattern

**Client-side SPA** with **Supabase BaaS** (Backend-as-a-Service).
No custom server — all backend logic runs as Supabase Edge Functions (Deno).

## Layers

```
┌─────────────────────────────────────────────────────┐
│  Browser (React SPA on Vercel)                      │
│  ├── Public pages: /:slug → EventPage → Template    │
│  ├── Auth pages: /login, /onboarding                │
│  └── Dashboard: /dashboard/* (protected)            │
├─────────────────────────────────────────────────────┤
│  Supabase (managed PostgreSQL + Edge Functions)     │
│  ├── Tables: events, invitations, arrival_permits,  │
│  │          message_logs, automation_settings,       │
│  │          users, user_events                       │
│  ├── RPC: update_whatsapp_template,                 │
│  │        toggle_auto_pilot, delete_dynamic_nudge   │
│  ├── Triggers: sheets_sync, auth_user_created       │
│  └── Edge Functions: 4 Deno functions               │
├─────────────────────────────────────────────────────┤
│  External Services                                  │
│  ├── Green API (WhatsApp messaging)                 │
│  ├── Google Sheets API (RSVP sync)                  │
│  └── Google OAuth (authentication)                  │
└─────────────────────────────────────────────────────┘
```

## Data Flow

### Public RSVP Flow
1. User visits `/:slug` → `EventPage.jsx` → `useEvent(slug)` hook → `fetchEventBySlug(slug)`
2. Template component renders based on `event.template_id` (dispatch map in `EventPage.jsx`)
3. User submits RSVP → `submitRsvp()` → upsert into `arrival_permits` (onConflict: event_id + phone)
4. DB trigger → `sync-to-sheets` edge function → Google Sheets API

### Dashboard Flow
1. User visits `/dashboard` → `ProtectedRoute` → `AuthProvider` checks session → `EventProvider` fetches user's event
2. `ProtectedRoute` redirects to `/login` (no auth) or `/onboarding` (no event)
3. Dashboard pages use `useEventContext()` to access the current event
4. Data fetched directly from Supabase tables using functions in `src/lib/supabase.js`

### Automation Flow
1. `pg_cron` triggers `automation-engine` edge function on schedule
2. Engine evaluates active `automation_settings` against event date
3. Eligible invitations get `pending` rows inserted into `message_logs`
4. `pg_cron` triggers `whatsapp-scheduler` edge function
5. Scheduler picks up to 15 pending rows, sends via Green API, marks sent/failed

### Authentication Flow
1. `/login` → Google OAuth via Supabase Auth → redirect to `/dashboard`
2. `on_auth_user_created` trigger creates `public.users` row
3. `AuthProvider` (React context) manages session state globally
4. `EventProvider` fetches user's event via `user_events` join table
5. `ProtectedRoute` wraps all `/dashboard/*` routes with auth + event checks

## Template System

**Strategy:** Each template is a dedicated React component with hardcoded visual assets.
**Dispatch:** `EventPage.jsx` contains a `TEMPLATES` map (`template_id` → component).
**Contract:** Templates receive `{ event, config }` — `config` is `content_config` JSONB (all fields optional).

| template_id | Component | Style |
|-------------|-----------|-------|
| `wedding-default` | `WeddingDefaultTemplate` | Burgundy/cream, flowers, GSAP animations |
| `elegant` | `ElegantTemplate` | Navy/gold, CSS-only decor |
| `wedding-modern` | `WeddingModernTemplate` | Retro zine aesthetic |

**Preview system:** `/preview/:slug` route with `postMessage` bridge for `DashboardSettings` live preview.

## Key Abstractions

- **`supabase.js`** — centralized data access layer (all Supabase queries and RPC calls)
- **`AuthContext`** — React context for auth state (user, session, signOut)
- **`EventContext`** — React context for current user's event data (used by all dashboard pages)
- **`useFeatureAccess`** — feature gating based on event status (draft vs active)
- **`constants.ts`** — shared stage metadata, status maps for dashboard + timeline
- **`cn()` utility** — Tailwind class merging (shadcn pattern)
- **`GlassCard` family** — reusable glassmorphism card primitives

## Entry Points

| Entry | File | Purpose |
|-------|------|---------|
| Frontend | `src/main.jsx` | React app bootstrap |
| Event page | `src/pages/EventPage.jsx` | Public wedding page |
| Dashboard | `src/pages/Dashboard.tsx` | Admin guest management |
| Timeline | `src/pages/AutomationTimeline.tsx` | Automation pipeline UI |
| Settings | `src/pages/DashboardSettings.tsx` | Event config editor |
| Login | `src/pages/LoginPage.tsx` | Google OAuth login |
| Onboarding | `src/pages/OnboardingPage.tsx` | New event wizard |
| Automation engine | `supabase/functions/automation-engine/index.ts` | Message queue builder |
| WhatsApp scheduler | `supabase/functions/whatsapp-scheduler/index.ts` | Message sender |
| Sheets sync | `supabase/functions/sync-to-sheets/index.ts` | Google Sheets webhook |
| WhatsApp webhook | `supabase/functions/whatsapp-webhook/index.ts` | Inbound auto-reply (PAUSED) |
