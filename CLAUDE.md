# Project Context: Wedding RSVP Platform
**Current Stack:** React frontend (Vite + React Router), Supabase backend.
**Current Phase:** Multi-tenant SaaS — Phase 1 (multi-template support). Each wedding gets a unique URL (`/:slug`), fetches its own event data, and renders via a pluggable template system driven entirely by the database.

**Roadmap:**
- Phase 1 ✅ Multi-template support driven by DB JSONB config
- Phase 2 WhatsApp automation & scheduler for RSVP follow-ups
- Phase 3 Payment gateway for wedding gifts

---

## Database Schema

**Table: `events`**
| Column | Type | Notes |
|---|---|---|
| `id` | uuid (PK) | |
| `slug` | text | URL identifier, e.g. `mor-and-eyal` |
| `google_sheet_id` | text | Target Google Sheet for RSVP sync |
| `template_id` | text | Controls which React template renders. See registry below. |
| `content_config` | jsonb | All per-event display content |

**SQL to add these columns (run once per environment):**
```sql
ALTER TABLE events ADD COLUMN content_config JSONB;
-- template_id column (if not yet present):
ALTER TABLE events ADD COLUMN template_id TEXT DEFAULT 'wedding-default';
```

**`content_config` JSONB schema:**
```jsonc
{
  "couple_names":        "string",
  "quote":               "string  // may contain \n",
  "invitation_text":     "string",
  "date_display":        "string  // e.g. '11 03 2026'",
  "date_hebrew":         "string  // e.g. 'כ\"ב באדר תשפ\"ו'",
  "day_of_week":         "string  // e.g. 'ביום רביעי'",
  "footer_note":         "string  // may contain \n",
  "closing_message":     "string  // may contain \n",
  "venue_name":          "string",
  "venue_address":       "string  // short form, shown under venue name",
  "venue_address_full":  "string  // full street address for Google Maps link",
  "venue_maps_query":    "string  // URL-safe query for Google Maps embed iframe",
  "schedule": [
    { "time": "19:30", "label": "אוכלים",    "icon": "food"  },
    { "time": "21:30", "label": "מתחתנים",   "icon": "marry" },
    { "time": "22:00", "label": "!רוקדים",   "icon": "dance" }
  ],
  "train_line":           "string  // e.g. 'R1'",
  "train_station":        "string",
  "train_walk_minutes":   "number",
  "parking_lot":          "string",
  "parking_walk_minutes": "number"
}
```
All fields are optional — every component guards against missing values.

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
- template_id: `wedding-default`

---

## Template Registry

Templates live in `src/templates/`. To add a new template:
1. Create `src/templates/MyTemplate/MyTemplate.jsx` (+ optional `.scss`)
2. Register it in `src/pages/EventPage.jsx`
3. Set `template_id = 'my-template'` on the event row in Supabase

| `template_id` | Component | Description |
|---|---|---|
| `wedding-default` | `WeddingDefaultTemplate` | Classic warm-red / cream, decorative flowers & frame borders, GSAP animations |
| `elegant` | `ElegantTemplate` | Deep navy + gold, serif typography, minimal — no decorative images |

**Template contract** — every template receives:
```ts
{ event: { id, slug, template_id, content_config }, config: content_config ?? {} }
```
Templates must handle `config` being `{}` (all fields optional / missing).

**Template dispatch (EventPage.jsx):**
```jsx
const TEMPLATES = {
  'wedding-default': WeddingDefaultTemplate,
  'elegant':         ElegantTemplate,
  // add future templates here ↑
};
const Template = TEMPLATES[event.template_id] ?? WeddingDefaultTemplate;
const config   = event.content_config ?? {};
return <Template event={event} config={config} />;
```

---

## Architecture

- URL `/:slug` → `EventPage` → `useEvent(slug)` → `fetchEventBySlug(slug)` → Supabase
- On RSVP submit, frontend upserts into `arrival_permits` with `onConflict: 'event_id,phone'`
- A Supabase Database Webhook triggers the `sync-to-sheets` Edge Function on INSERT/UPDATE
- Edge Function looks up `google_sheet_id` from `events` using the `event_id`, then syncs to the correct Google Sheet

## File Structure
```
src/
  main.jsx                                    BrowserRouter wrapper
  App.jsx                                     Routes: /:slug → EventPage, * → NotFoundPage
  hooks/
    useEvent.js                               fetches event by slug → { event, loading, notFound }
  pages/
    EventPage.jsx                             slug → useEvent → template dispatch
    NotFoundPage.jsx                          shown for unknown slugs or root /
  templates/
    WeddingDefaultTemplate/
      WeddingDefaultTemplate.jsx              composes Hero + RsvpForm + Map
    ElegantTemplate/
      ElegantTemplate.jsx                     self-contained dark/gold layout
      ElegantTemplate.scss
  components/
    Hero/Hero.jsx                             accepts config prop (all fields optional)
    RsvpForm/RsvpForm.jsx                     accepts eventId prop
    Map/Map.jsx                               accepts config prop (all fields optional)
  lib/
    supabase.js                               fetchEventBySlug(), submitRsvp(data, eventId)
```

## RLS Policies (`arrival_permits`)
- Allow anon INSERT (WITH CHECK true)
- Allow anon UPDATE (USING true, WITH CHECK true)
- Allow anon SELECT (USING true)

## Google Sheets Sync (Edge Function: `sync-to-sheets`)
- Reads `event_id` from webhook record
- Queries `events` table for `google_sheet_id` using the Supabase service role client
- Authenticates with Google Service Account (env vars: `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`)
- Upserts the row: searches column B for the phone number, updates the row if found, appends a new row if not
