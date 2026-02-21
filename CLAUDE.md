# Project Context: Wedding RSVP Platform
**Current Stack:** React frontend (Vite + React Router), Supabase backend.
**Current Phase:** Multi-tenant SaaS with dynamic slug-based routing. Each wedding gets a unique URL (`/:slug`), fetches its own event data from Supabase, and renders via a template system.

**Database Schema:**

**Table: `events`**
- `id` (uuid, primary key)
- `slug` (text) — unique URL identifier, e.g. `mor-and-eyal`
- `google_sheet_id` (text)
- `template_id` (text) — template to use, e.g. `wedding-default`
- `content_config` (jsonb) — all per-event display content (see schema below)

**`content_config` JSONB schema:**
```json
{
  "couple_names": "string",
  "quote": "string (may contain \\n)",
  "invitation_text": "string",
  "date_display": "string",
  "date_hebrew": "string",
  "day_of_week": "string",
  "footer_note": "string (may contain \\n)",
  "closing_message": "string (may contain \\n)",
  "venue_name": "string",
  "venue_address": "string",
  "venue_address_full": "string",
  "venue_maps_query": "string (URL-encoded for Google Maps embed)",
  "schedule": [{ "time": "string", "label": "string", "icon": "food|marry|dance" }],
  "train_line": "string",
  "train_station": "string",
  "train_walk_minutes": number,
  "parking_lot": "string",
  "parking_walk_minutes": number
}
```

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

**Test Event:**
- ID: `1f7cddc3-ef64-4b8a-a5c8-12f5b64d6b6e`
- Slug: `mor-and-eyal`

**SQL to add content_config column:**
```sql
ALTER TABLE events ADD COLUMN content_config JSONB;
```

**Architecture:**
- URL `/:slug` → `EventPage` → `useEvent(slug)` → `fetchEventBySlug(slug)` → Supabase
- `EventPage` dispatches to the correct template based on `event.template_id` (default: `WeddingTemplate`)
- `WeddingTemplate` composes `<Hero config={config} />`, `<RsvpForm eventId={event.id} />`, `<Map config={config} />`
- On RSVP submit, the frontend upserts into `arrival_permits` with `onConflict: 'event_id,phone'`
- A Supabase Database Webhook triggers the `sync-to-sheets` Edge Function on INSERT/UPDATE
- The Edge Function looks up the `google_sheet_id` from the `events` table using the `event_id` from the webhook payload, then syncs the record to the correct Google Sheet

**File Structure:**
```
src/
  main.jsx                          BrowserRouter wrapper
  App.jsx                           Routes: /:slug → EventPage, * → NotFoundPage
  hooks/
    useEvent.js                     fetches event by slug, returns { event, loading, notFound }
  pages/
    EventPage.jsx                   reads :slug, calls useEvent, dispatches to template
    NotFoundPage.jsx                shown for unknown slugs or root /
  templates/
    WeddingTemplate/
      WeddingTemplate.jsx           composes Hero + RsvpForm + Map, passes config props
  components/
    Hero/Hero.jsx                   accepts config prop
    RsvpForm/RsvpForm.jsx           accepts eventId prop
    Map/Map.jsx                     accepts config prop
  lib/
    supabase.js                     fetchEventBySlug(), submitRsvp(data, eventId)
```

**Template Dispatch (EventPage.jsx):**
```jsx
const TEMPLATES = {
  'wedding-default': WeddingTemplate,
  // add future templates here
};
const Template = TEMPLATES[event.template_id] ?? WeddingTemplate;
return <Template event={event} config={event.content_config} />;
```

**RLS Policies (`arrival_permits`):**
- Allow anon INSERT (WITH CHECK true)
- Allow anon UPDATE (USING true, WITH CHECK true)
- Allow anon SELECT (USING true)

**Google Sheets Sync (Edge Function: `sync-to-sheets`):**
- Reads `event_id` from webhook record
- Queries `events` table for `google_sheet_id` using the Supabase service role client
- Authenticates with Google Service Account (env vars: `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`)
- Upserts the row: searches column B for the phone number, updates the row if found, appends a new row if not
