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

## Template Strategy — AI-Assisted Template Generation

### Core principle
Templates are **not** generic renderers that swap image paths from the database.
Each template is a **dedicated, hardcoded React component** — hand-crafted for a specific set of visual assets and a specific design aesthetic.

**What is always hardcoded inside a template:**
- All image assets (hero photos, decorative elements, logos) — imported directly from `public/` or bundled via Vite
- Color palette, typography, spacing (in the template's own `.scss`)
- Layout structure and any decorative HTML elements

**What always comes from `content_config` (text / data only):**
- Couple names, quote, invitation text, date fields
- Venue name, address, maps query
- Schedule items (time + label; the `icon` string maps to a hardcoded SVG import inside the template)
- Footer note, closing message, transport details

This split means: swapping a template never breaks a layout due to mismatched image aspect ratios or contrast issues, because the images are baked into the template itself.

---

### Workflow for adding a new template

1. **Eyal drops assets** into `public/templates/<template-name>/` (e.g. `boho-bg.jpg`, `boho-flower.png`)
2. **Eyal writes a prompt** describing the desired aesthetic (fonts, color palette, layout structure, which assets go where)
3. **Claude clones the closest existing template** as a starting point (usually `ElegantTemplate` for minimal layouts, `WeddingDefaultTemplate` for decorative ones)
4. **Claude rewrites the SCSS** for the new palette / fonts / layout, replacing all hardcoded asset references with the new files
5. **Claude registers** `'boho': BohoTemplate` in `EventPage.jsx` and updates this file

---

### Template Registry

| `template_id` | Component | Assets folder | Description |
|---|---|---|---|
| `wedding-default` | `WeddingDefaultTemplate` | `public/` (shared) | Warm burgundy/cream, decorative flowers, frame-border images, GSAP scroll animations |
| `elegant` | `ElegantTemplate` | none (CSS-only decor) | Deep navy + gold, Gravitas One / Dancing Script, minimal — no decorative images |

**Template contract** — every template receives:
```ts
{ event: { id, slug, template_id, content_config }, config: content_config ?? {} }
```
Templates must handle `config` being `{}` (every field is optional — never crash on missing data).

**Template dispatch (`EventPage.jsx`):**
```jsx
const TEMPLATES = {
  'wedding-default': WeddingDefaultTemplate,
  'elegant':         ElegantTemplate,
  // ← register new templates here
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
