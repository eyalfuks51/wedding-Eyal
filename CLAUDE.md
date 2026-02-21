# Project Context: Wedding RSVP Platform
**Current Stack:** React frontend, Supabase backend.
**Current Phase:** Multi-tenant SaaS architecture. The platform supports multiple events, each with their own guest list and Google Sheet.

**Database Schema:**

**Table: `events`**
- `id` (uuid, primary key)
- `slug` (text)
- `google_sheet_id` (text)

**Table: `arrival_permits`**
- `id` (int8, primary key)
- `created_at` (timestamptz)
- `event_id` (uuid, foreign key → events.id)
- `full_name` (text)
- `phone` (text)
- `attending` (bool)
- `needs_parking` (bool)
- `guests_count` (int2)
- `updated_at` (timestamptz)
- **Composite UNIQUE constraint on `(event_id, phone)`**

**Test Event ID:** `1f7cddc3-ef64-4b8a-a5c8-12f5b64d6b6e`

**Architecture:**
- The React frontend hardcodes the test `event_id` for now. Future: derive from URL slug.
- On RSVP submit, the frontend upserts into `arrival_permits` with `onConflict: 'event_id,phone'`.
- A Supabase Database Webhook triggers the `sync-to-sheets` Edge Function on INSERT/UPDATE.
- The Edge Function looks up the `google_sheet_id` from the `events` table using the `event_id` from the webhook payload, then syncs the record to the correct Google Sheet.

**RLS Policies (`arrival_permits`):**
- Allow anon INSERT (WITH CHECK true)
- Allow anon UPDATE (USING true, WITH CHECK true)
- Allow anon SELECT (USING true)

**Google Sheets Sync (Edge Function: `sync-to-sheets`):**
- Reads `event_id` from webhook record
- Queries `events` table for `google_sheet_id` using the Supabase service role client
- Authenticates with Google Service Account (env vars: `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`)
- Upserts the row: searches column B for the phone number, updates the row if found, appends a new row if not
