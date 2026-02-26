# Project Context: Wedding RSVP Platform
**Current Stack:** React frontend (Vite + React Router), Supabase backend.
**Current Phase:** Multi-tenant SaaS — Phase 1 (multi-template support). Each wedding gets a unique URL (`/:slug`), fetches its own event data, and renders via a pluggable template system driven entirely by the database.

**Roadmap:**
- Phase 1 ✅ Multi-template support driven by DB JSONB config
- Phase 2 WhatsApp automation & scheduler for RSVP follow-ups
- Phase 3 Payment gateway for wedding gifts

---

## Typography & Brand Fonts

**Font files:** `src/styles/fonts/` (do NOT use the root-level `Danidin-CondensedBold-web/` directory — that's a leftover artifact).

| File | Family | Weight | Tailwind utility |
|---|---|---|---|
| `Polin-Regular.woff2` | `Polin` | 400 | `font-brand` |
| `Polin-Bold.woff2` | `Polin` | 700 | `font-brand` (bold) |
| `Danidin-CondensedBold.woff2` | `Danidin` | 700 | `font-danidin` |

**@font-face registration:** `src/styles/global.scss` (imported globally via `src/main.jsx`).

**Tailwind config (`tailwind.config.js`):**
```js
fontFamily: {
  brand:   ['Polin', 'Heebo', 'sans-serif'],   // body text, labels, UI copy
  danidin: ['Danidin', 'Polin', 'sans-serif'],  // bold display headings, KPI numbers
}
```

**Usage rules:**
- Use `font-brand` (Polin) for all body copy, table text, labels, badges, button labels.
- Use `font-danidin` (Danidin) for page titles, KPI numbers, section headings.
- `preflight: false` in Tailwind config — SCSS in `global.scss` owns the CSS reset.

---

## Admin Dashboard (`/dashboard`)

**Routes:**
- `/dashboard` — guest table (registered in `App.jsx` before `/:slug` to avoid slug collision)
- `/dashboard/timeline` — automation pipeline timeline

**Files:** `src/pages/Dashboard.tsx`, `src/pages/AutomationTimeline.tsx`
**Shared tab navigation:** `DashboardNav` component sits at the top of both pages.
**Event slug hardcoded:** `'hagit-and-itai'` (fetches that event's invitations from Supabase).

**Features:**
- 4 KPI cards: הזמנות (families), סה"כ אורחים (pax), ממתינים, שגיאות/ביטולים
- Smart filter bar: full-text search + dynamic צד / קבוצה dropdowns + status filter
- Guest table with bulk-checkbox selection (indeterminate header state handled via `useRef`)
- Floating bulk-action bar (slides up when rows selected): "שלח הודעה" + "ייצוא"
- Columns: שם, טלפונים (clickable `tel:` chips), צד/קבוצה (conditional), כמות, סטטוס, **סטטוס הודעה**
- Side/group columns are hidden automatically when the data contains no such fields
- **Column Visibility Control:** A "תצוגה" dropdown in the filter bar to toggle optional columns (`side`, `guest_group`, pax counts, `is_automated`) — keeps the default UI clean while surfacing detail on demand
- **Message History:** clicking a `MsgStatusBadge` in the "סטטוס הודעה" column opens `MessageHistorySheet` — a `<Sheet side="left">` drawer with a newest-first timeline of all `message_logs` for that guest
- **Guest Editing (`EditGuestSheet`):** clicking a guest row opens a side `<Sheet>` to manually update Identity (`group_name`, `phone_numbers`), Classification (`side`, `guest_group`), RSVP data (`rsvp_status`, `invited_pax`, `confirmed_pax`), and toggle `is_automated`
- Entirely Hebrew RTL; uses `font-brand` / `font-danidin` Tailwind utilities
- Violet-600 primary accent; slate neutral palette; no GSAP (pure CSS transitions)

**Message History data flow:**
- Batch fetch: one `message_logs` query for all invitation IDs after table loads → `Map<invitation_id, MessageLog>` for O(1) badge lookup
- Lazy fetch: per-invitation full history fetched only when drawer opens; `ignored` cancellation flag prevents stale updates on rapid re-open
- Badge states: amber=ממתין בתור, emerald=נשלח, rose=נכשל, slate=טרם נשלח

**Automation Timeline V2 (`/dashboard/timeline`):**
- **Auto-Pilot Master Toggle:** Global on/off for the automation engine, stored in `events.automation_config.auto_pilot` (boolean). Toggled via `toggle_auto_pilot` RPC. Soft pause: existing queued messages still send, only new evaluations are paused.
- **Desktop (`lg:`):** Horizontal RTL scrollable pipeline with drag-to-scroll (`useDragScroll` hook). Smart-focus snapping on load positions the active stage at ~35% from right edge (Clamped Right-Third Focus algorithm). Stage columns (`w-48`) with status cards, icon circles on connecting line, labels, and computed dates below.
- **Mobile (`< lg`):** Vertical card stack with `border-r-4` accent, status pills, and computed dates.
- **Stage Status System:** `sent` (emerald) / `active` (violet) / `scheduled` (amber) / `disabled` (grey+opacity). Status determined from `is_active` + `message_logs` stats.
- **StageEditModal (Liquid Glass):** Centered modal with `GlassCard` glassmorphism, replaces the old `TemplateEditorSheet`. Edits: toggle, `days_before` with live date preview, singular/plural template text with variable hints. Dynamic nudge delete button (guarded by `delete_dynamic_nudge` RPC).
- **Dynamic Nudges:** Up to 3 additional nudge stages (`nudge_1`, `nudge_2`, `nudge_3`). "Add Nudge" button between last nudge and ultimatum. Insertion via `addDynamicNudge`, deletion via `delete_dynamic_nudge` RPC (blocked if `message_logs` exist). New nudge opens edit modal immediately.
- **StageLogsSheet:** Side `<Sheet>` for per-stage message log drill-down with status filter tabs and search.
- Toast feedback (z-60 above modals); responsive skeletons; manual refresh button
- **Shared constants:** `CANONICAL_STAGES`, `DYNAMIC_NUDGE_NAMES`, `ALL_STAGE_NAMES`, `STAGE_META`, `TEMPLATE_LABELS`, `MSG_STATUS_MAP` live in `src/components/dashboard/constants.ts`

---

## Database Schema

> **🚨 CRITICAL RULE: SCHEMA SYNC**
> Any changes made to the Supabase database schema (new tables, columns, or type changes) MUST be immediately documented in this section before writing any frontend or backend code. Do not guess column names.

**Table: `events`**
Central configuration for each wedding.
- `id` (uuid, PK)
- `slug` (text, UNIQUE) — URL identifier
- `partner1_name`, `partner2_name` (text)
- `event_date` (date)
- `google_sheet_id` (text)
- `content_config` (jsonb) — UI text, maps, and `whatsapp_templates` (singular/plural variants)
- `template_id` (text) — Renders the specific React template
- `automation_config` (jsonb) — Settings for reminders and limits

**Table: `invitations`**
The source of truth for the Admin Dashboard. Represents a family/group invited to the event.
- `id` (uuid, PK)
- `event_id` (uuid, FK → events.id)
- `group_name` (text) — E.g., "אייל ומור"
- `phone_numbers` (text[]) — Array of phone numbers for this group
- `invited_pax` (integer) — Determines singular/plural messaging logic
- `confirmed_pax` (integer) — How many actually RSVP'd
- `rsvp_status` (text) — e.g., 'pending'
- `is_automated` (boolean) — Opt-out toggle for Track A automation (managed via `EditGuestSheet`); `messages_sent_count` (integer), `last_message_sent_at` (timestamptz)
- `side`, `guest_group` (varchar) — For dashboard filtering, classification, and column visibility toggling

**Table: `arrival_permits`**
The actual RSVP submissions from the frontend form.
- `id` (bigint, PK)
- `event_id` (uuid, FK → events.id)
- `full_name` (text)
- `phone` (text) — Unique per event (Constraint: `arrival_permits_event_phone_unique`)
- `attending` (boolean), `needs_parking` (boolean)
- `guests_count` (smallint) — Actual number of attending guests

**Database Triggers & Edge Functions**
- `sheets_sync_trigger`: Fires on `INSERT` or `UPDATE` on `arrival_permits`. Sends a webhook to the `sync-to-sheets` edge function to update Google Sheets.
**Table: `message_logs`**
The central queue and historical log for all WhatsApp messages.
- `id` (uuid, PK)
- `event_id` (uuid, FK → events.id)
- `invitation_id` (uuid, FK → invitations.id)
- `phone` (text)
- `message_type` (text) — e.g., 'icebreaker', 'nudge', 'custom'
- `content` (text) — The actual personalized message text
- `status` (text) — 'pending' (in queue), 'processing', 'sent', 'failed'
- `error_log` (text)
- `scheduled_for` (timestamptz) — When it should be sent
- `sent_at` (timestamptz) — Exact time of successful send

**Table: `automation_settings`**
One row per funnel stage per event. Controls the automated WhatsApp pipeline.
- `id` (uuid, PK)
- `event_id` (uuid, FK → events.id)
- `stage_name` (text) — matches key in `events.content_config.whatsapp_templates` (e.g. `'nudge'`)
- `days_before` (integer) — positive = days before event, negative = days after (e.g. `-1` = hangover)
- `target_status` (text) — `'pending'` or `'attending'` (business invariant, not editable from UI)
- `is_active` (boolean) — admin toggle
- `created_at` (timestamptz)

**RLS on `automation_settings`** (migration `20260226100000`):
- `Allow anon select automation_settings` — anon can read all rows (USING true)
- `Allow anon update automation_settings` — anon can update rows (USING true, WITH CHECK true)

**Postgres RPC: `update_whatsapp_template(p_event_id, p_stage_name, p_singular, p_plural)`**
- `SECURITY DEFINER` + `SET search_path = public` — runs with table-owner privileges, prevents search_path hijacking
- Whitelists `p_stage_name` against `['icebreaker','nudge','nudge_1','nudge_2','nudge_3','ultimatum','logistics','hangover']`
- Uses `jsonb_set` to atomically patch only `content_config → whatsapp_templates → <stage>` — no full-row replacement, no race conditions, no broad anon UPDATE on `events`
- `GRANT EXECUTE TO anon` — callable via `supabase.rpc('update_whatsapp_template', {...})`
- Raises exception for unknown event_id or invalid stage_name

**Postgres RPC: `toggle_auto_pilot(p_event_id, p_enabled)`**
- `SECURITY DEFINER` — atomically sets `events.automation_config.auto_pilot` via `jsonb_set`
- Soft pause semantics: already-queued `pending` messages still send; only new stage evaluations are paused

**Postgres RPC: `delete_dynamic_nudge(p_setting_id)`**
- `SECURITY DEFINER` — deletes an `automation_settings` row and cleans up its `whatsapp_templates` key
- Guards: only `nudge_1/2/3` can be deleted (not canonical stages), and only if zero `message_logs` exist for that stage
- Raises exception if messages exist or if the stage is canonical

**RLS on `automation_settings`** (migration `20260226200000`):
- `Allow anon insert automation_settings` — with stage_name whitelist check

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
    Dashboard.tsx                             /dashboard — guest table with KPI cards, filters, bulk actions
    AutomationTimeline.tsx                    /dashboard/timeline — visual funnel pipeline
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
    ui/
      glass-card.tsx                          GlassCard family (glassmorphism card primitives)
      sheet.tsx                               Sheet drawer primitive (@radix-ui/react-dialog)
    dashboard/
      constants.ts                            CANONICAL_STAGES, DYNAMIC_NUDGE_NAMES, ALL_STAGE_NAMES, STAGE_META, MSG_STATUS_MAP
      DashboardNav.tsx                        Tab nav shared by /dashboard and /dashboard/timeline
      EditGuestSheet.tsx                      Side sheet to edit invitation fields
      StageEditModal.tsx                      Liquid glass centered modal for stage editing (timing, templates, delete)
      StageLogsSheet.tsx                      Side sheet for per-stage message log drill-down
  lib/
    supabase.js                               fetchEventBySlug(), submitRsvp(), fetchAutomationSettings(),
                                              updateAutomationSetting(), updateWhatsAppTemplate(),
                                              fetchMessageStatsPerStage(), fetchStageMessageLogs(),
                                              toggleAutoPilot(), addDynamicNudge(), deleteDynamicNudge()
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

## Phase 2: WhatsApp Automation & Scheduler (Active)
- **Infrastructure:** Outbound messages sent via Green API. A custom Scheduler (`supabase/functions/whatsapp-scheduler/`) processes `message_logs` rows with `status='pending'`, respects operating hours (Asia/Jerusalem timezone, Shabbat-aware), and marks rows `sent` or `failed`. Inbound auto-replies are currently PAUSED.
- **Message History UI (✅ complete):** Dashboard shows a "סטטוס הודעה" badge column and a `MessageHistorySheet` drawer with full per-guest send history.
- **Automation Timeline V2 (✅ complete):** `/dashboard/timeline` — horizontal RTL pipeline (desktop) / vertical stack (mobile) with Auto-Pilot master toggle, dynamic nudge management (up to 3 additional nudges), `StageEditModal` (liquid glass) for editing stage timing + templates, stage status system, smart-focus snapping, drag-to-scroll, and `StageLogsSheet` drill-down.

**Track A: Automated Message Funnel (Background)**
- **Icebreaker:** Initial broadcast with the event link.
- **Gentle Nudge:** Periodic follow-ups sent ONLY to 'pending' (ממתינים) status.
- **Ultimatum:** Final notice sent to 'pending' guests just before the venue's deadline.
- **Logistics:** Venue navigation and details sent X hours before the event, only to confirmed attendees.
- **Hangover:** Post-event gratitude sent to attendees the day after.
- **Admin UI (Event Timeline):** A visual, opinionated pipeline mapping the funnel stages. Features "hard anchors" (e.g., Event Day) and toggleable nodes (Nudges) with fixed rules to prevent user errors. Each node displays real-time `message_logs` stats (sent vs. pending).

**Track B: Manual Custom Messages (Dashboard UI)**
- **Bulk Actions:** Admins can select specific guests via the table checkboxes to trigger a manual broadcast.
- **Send Modal:** A dedicated UI that allows admins to either:
  1. Load a pre-configured template from the funnel (and tweak it on the fly).
  2. Write a completely custom, free-text message from scratch.
- **Dynamic Variables:** All manual/custom messages support interpolation (e.g., `{{name}}`) which is resolved per-record before pushing to the Scheduler.

**Data Schema Update:** The `events.content_config` JSONB column includes a `whatsapp_templates` object storing the default text for all funnel stages.
## Development Workflow & Code Quality
- **TypeScript LSP:** You have the `typescript-lsp` plugin enabled. Actively monitor real-time diagnostic errors. Fix any type or linting issues immediately as you code before proceeding.
- **Superpowers:** Use the Superpowers plugin for structured development. Run `/superpowers:brainstorm` before complex component creation, and generate execution plans with `/superpowers:write-plan` for larger features.
- **UI & Assets:** The application is RTL strictly (Hebrew). Local fonts are stored at `src/styles/fonts`. Ensure all CSS/Tailwind configurations properly route to this local directory.