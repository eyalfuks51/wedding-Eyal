# External Integrations

**Analysis Date:** 2026-03-03

## APIs & External Services

**WhatsApp Messaging:**
- Green API (`api.greenapi.com`) - WhatsApp message delivery provider
  - SDK/Client: Native Deno `fetch` (HTTP REST API)
  - Auth: `GREEN_API_INSTANCE_ID` + `GREEN_API_TOKEN` (env vars)
  - Usage: `supabase/functions/whatsapp-scheduler/index.ts` sends pending messages via `/waInstance{id}/sendMessage/{token}` endpoint
  - Phone format: Converts Israeli numbers to international format for chatId (`972...@c.us`)
  - Operating hours: Respects Shabbat schedule (Sun–Thu 09:00–20:59, Fri 09:00–13:59, Sat 20:00–20:59, Asia/Jerusalem timezone)

**Google Sheets Sync:**
- Google Sheets API v4 - RSVP data synchronization
  - SDK/Client: `npm:google-auth-library@10.3.0` (Deno-compatible)
  - Auth: Service Account (email + private key)
    - `GOOGLE_SERVICE_ACCOUNT_EMAIL` - Service account email
    - `GOOGLE_PRIVATE_KEY` - Private key (newline-escaped)
  - Usage: `supabase/functions/sync-to-sheets/index.ts` reads/writes guest RSVP data
  - Endpoints:
    - `GET /spreadsheets/{id}` - Fetch sheet metadata
    - `GET /spreadsheets/{id}/values/{sheet}!B:B` - Read phone numbers to find existing rows
    - `PUT /spreadsheets/{id}/values/{sheet}!A{row}:E{row}` - Update existing row
    - `POST /spreadsheets/{id}/values/{sheet}!A:E:append` - Append new row
  - Triggered by database webhook on `arrival_permits` INSERT/UPDATE

## Data Storage

**Primary Database:**
- Supabase PostgreSQL
  - Connection: Via `@supabase/supabase-js` with `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`
  - Client: Supabase JavaScript SDK (wrapper around PostgREST API)
  - Tables queried/managed:
    - `events` - Wedding event configuration, content, automation settings
    - `invitations` - Guest list with RSVP status
    - `arrival_permits` - RSVP form submissions from attendees
    - `message_logs` - WhatsApp message history and queue
    - `automation_settings` - Funnel stage configuration (icebreaker, nudge, ultimatum, etc.)
    - `user_events` - User-to-event relationships for multi-tenant auth
  - RLS (Row-Level Security): Enabled for `arrival_permits` (anon can INSERT/UPDATE/SELECT)
  - RPCs (Stored Procedures):
    - `update_whatsapp_template(p_event_id, p_stage_name, p_singular, p_plural)` - Atomically updates WhatsApp message templates
    - `toggle_auto_pilot(p_event_id, p_enabled)` - Toggles automation master switch
    - `delete_dynamic_nudge(p_setting_id)` - Deletes a nudge stage (guarded, fails if messages exist)

**File Storage:**
- Not used - Local filesystem only (no cloud storage integration)

**Caching:**
- Not detected - Queries run direct to Supabase; no Redis/Memcached

## Authentication & Identity

**Auth Provider:**
- Supabase Auth (built-in PostgreSQL auth)
  - Implementation: Custom email/password flow with session management
  - Session stored in `AuthContext.tsx` via `supabase.auth.getSession()` and `onAuthStateChange()` listener
  - User-to-event mapping via `user_events` table (multi-tenant)
  - Protected routes via `ProtectedRoute` component that checks `useAuth()` context
  - Env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

**Feature Gating:**
- Custom hook: `useFeatureAccess()` in `src/hooks/useFeatureAccess.ts`
  - Checks `events.status` field (draft vs active) to gate automation UI features
  - Draft users see limited dashboard; active users see full feature set

## Monitoring & Observability

**Error Tracking:**
- Not detected - No Sentry, DataDog, or similar

**Logs:**
- Console logging via `console.log()` and `console.error()` in:
  - React components (state transitions, form submissions)
  - Supabase functions (Deno `console.*` in edge functions)
  - Supabase PostgREST responses (error details logged client-side)
- Logs visible in: Browser DevTools console, Supabase function logs dashboard

## CI/CD & Deployment

**Hosting:**
- Static site deployment (Vite build output `dist/`)
  - Can be deployed to: Vercel, Netlify, GitHub Pages, or any static host
  - Environment variables passed at build/runtime via `.env.local` or platform secrets

**Edge Functions Deployment:**
- Supabase Functions (Deno runtime)
  - Deployed via `supabase functions deploy` command
  - Functions located in `supabase/functions/`
  - Require environment variables set in Supabase dashboard:
    - `GREEN_API_INSTANCE_ID`, `GREEN_API_TOKEN` (for whatsapp-scheduler)
    - `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY` (for sync-to-sheets)
    - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (for admin client in edge functions)

**CI Pipeline:**
- Not detected - Manual deployments only

**Database Migrations:**
- Supabase migrations framework (`supabase/migrations/`)
  - Deploy via `supabase db push` command
  - Versioned SQL files with timestamps

## Environment Configuration

**Required env vars (Frontend):**
- `VITE_SUPABASE_URL` - Supabase project URL (e.g., `https://your-project.supabase.co`)
- `VITE_SUPABASE_ANON_KEY` - Public API key for anonymous access

**Required env vars (Edge Functions):**
- `GREEN_API_INSTANCE_ID` - Green API WhatsApp instance ID
- `GREEN_API_TOKEN` - Green API authentication token
- `GOOGLE_SERVICE_ACCOUNT_EMAIL` - Google Cloud service account email
- `GOOGLE_PRIVATE_KEY` - Google Cloud private key (with newlines encoded as `\\n`)
- `SUPABASE_URL` - Supabase URL (auto-provided by Supabase)
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for admin access (auto-provided by Supabase)

**Secrets location:**
- Frontend: `.env.local` (git-ignored)
- Edge Functions: Supabase dashboard → Project Settings → Edge Functions → Secrets

## Webhooks & Callbacks

**Incoming (Database Triggers → Edge Functions):**
- Database webhook: `sheets_sync_trigger` on `arrival_permits` table
  - Fires on INSERT or UPDATE
  - Calls `sync-to-sheets` edge function with webhook payload
  - Syncs RSVP data to Google Sheets

**Outgoing:**
- Edge function: `whatsapp-scheduler` can be invoked via HTTP (polling or cron)
  - Endpoint: `https://{project-id}.supabase.co/functions/v1/whatsapp-scheduler`
  - Method: POST (optional `force_run=true` parameter to bypass operating hours)
  - Returns: `{ processed, success, failed }`
- Edge function: `whatsapp-webhook` (defined but not fully documented; inbound WhatsApp callbacks)

---

*Integration audit: 2026-03-03*
