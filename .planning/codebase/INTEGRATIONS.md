# External Integrations

## Supabase (Primary Backend)

**Role:** Database, authentication, real-time, edge functions, RPC
**Client:** `src/lib/supabase.js` — singleton `createClient` with anon key
**Auth:** Google OAuth via `supabase.auth.signInWithOAuth({ provider: 'google' })`

### Tables
- `events` — central event config (slug, template_id, content_config JSONB, automation_config JSONB, status)
- `invitations` — guest groups with phone numbers, RSVP status, automation opt-out
- `arrival_permits` — frontend RSVP submissions (upsert by event_id + phone)
- `message_logs` — WhatsApp message queue and history
- `automation_settings` — per-stage automation config (days_before, is_active, target_status)
- `users` — mirrors `auth.users` via trigger
- `user_events` — join table linking users to events (owner/co-owner roles)

### RPC Functions
- `update_whatsapp_template(p_event_id, p_stage_name, p_singular, p_plural)` — atomic JSONB patch
- `toggle_auto_pilot(p_event_id, p_enabled)` — toggle automation master switch
- `delete_dynamic_nudge(p_setting_id)` — guarded deletion of nudge stages

### Database Triggers
- `sheets_sync_trigger` — fires on `arrival_permits` INSERT/UPDATE → calls `sync-to-sheets` edge function
- `on_auth_user_created` — fires on `auth.users` INSERT → creates `public.users` row

### RLS Policies
- `arrival_permits` — anon SELECT, INSERT, UPDATE (all open)
- `automation_settings` — anon SELECT, UPDATE, INSERT (with stage_name whitelist)

## Google Sheets API

**Role:** Sync RSVP data to Google Sheets for external visibility
**Edge Function:** `supabase/functions/sync-to-sheets/index.ts`
**Auth:** Google Service Account (`GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`)
**Flow:**
1. Database webhook triggers on `arrival_permits` changes
2. Edge function queries `events.google_sheet_id`
3. Searches column B for phone number → updates existing row or appends new row
**API:** Google Sheets v4 REST API (direct `fetch` calls, no SDK)

## Green API (WhatsApp)

**Role:** Outbound WhatsApp messaging for automated RSVP follow-ups
**Edge Functions:**
- `supabase/functions/whatsapp-scheduler/index.ts` — processes pending `message_logs`, sends via Green API
- `supabase/functions/whatsapp-webhook/index.ts` — receives inbound messages, sends auto-reply (PAUSED)

**Credentials:** `GREEN_API_INSTANCE_ID`, `GREEN_API_TOKEN` (per-request validation in scheduler)
**API Endpoint:** `https://api.greenapi.com/waInstance{id}/sendMessage/{token}`
**Phone Format:** Israeli numbers normalized to `972XXXXXXXXX@c.us`
**Operating Hours:** Sun-Thu 09-21, Fri 09-14, Sat 20-21 (Asia/Jerusalem timezone)
**Batch Size:** Up to 15 pending messages per invocation

## Automation Engine

**Edge Function:** `supabase/functions/automation-engine/index.ts`
**Role:** Evaluates automation stages and queues messages into `message_logs`
**Flow:**
1. Fetches all active `automation_settings` with joined event data
2. Checks auto-pilot gate, event date proximity, stage timing
3. Fetches eligible invitations by `rsvp_status` and `is_automated` flag
4. Deduplicates against existing `message_logs`
5. Interpolates WhatsApp templates with `{{name}}`, `{{couple_names}}`, `{{link}}`, `{{waze_link}}`
6. Bulk inserts new `pending` rows into `message_logs`

**Scheduling:** pg_cron jobs configured in `supabase/migrations/20260304090000_schedule_automation_cron.sql`

## Vercel

**Role:** Frontend hosting and deployment
**Config:** `.vercel/project.json` — Vite build output
**No custom Vercel serverless functions** — all backend logic in Supabase Edge Functions

## Google Fonts (CDN)

**Imported in:** `src/styles/global.scss`
**Fonts:** Dancing Script, Heebo, Gravitas One, Rubik (fallbacks for templates)
