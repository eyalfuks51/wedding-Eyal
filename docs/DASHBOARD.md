# Admin Dashboard (`/dashboard`)

Entirely Hebrew RTL. Violet-600 primary accent, slate neutral palette, no GSAP (pure CSS transitions). Fonts: `font-brand` (Polin) for copy, `font-danidin` (Danidin) for headings/KPIs — see [ARCHITECTURE.md](./ARCHITECTURE.md#typography).

## Routes & files
- `/dashboard` → `src/pages/Dashboard.tsx` — guest table (registered in `App.jsx` **before** `/:slug` to avoid slug collision)
- `/dashboard/timeline` → `src/pages/AutomationTimeline.tsx` — automation pipeline
- `/dashboard/settings` → `src/pages/DashboardSettings.tsx` — event settings editor with live preview
- Shared tab nav: `DashboardNav` (sits atop each page; includes `התנתקות` sign-out wired to `useAuth().signOut()`)
- Event slug **hardcoded** `'hagit-and-itai'`.

## Guest table (`Dashboard.tsx`)
- 4 KPI cards: הזמנות (families), סה"כ אורחים (pax), ממתינים, שגיאות/ביטולים
- Smart filter bar: full-text search + dynamic צד / קבוצה dropdowns + status filter
- Bulk-checkbox selection (indeterminate header via `useRef`); floating bulk-action bar slides up ("שלח הודעה" + "ייצוא")
- Columns: שם, טלפונים (clickable `tel:` chips), צד/קבוצה (conditional), כמות, סטטוס, **סטטוס הודעה**
- Side/group columns auto-hide when data has no such fields
- **תצוגה dropdown** — toggle optional columns (`side`, `guest_group`, pax counts, `is_automated`) to keep default UI clean
- **`MsgStatusBadge`** in "סטטוס הודעה" → opens `MessageHistorySheet` (`<Sheet side="left">`, newest-first `message_logs` timeline for that guest)
- **`EditGuestSheet`** — row click opens side sheet: Identity (`group_name`, `phone_numbers`), Classification (`side`, `guest_group`), RSVP (`rsvp_status`, `invited_pax`, `confirmed_pax`), `is_automated` toggle
- **`GuestUploadModal`** (ייבוא) — 3-step: download Excel template → fill → upload. Client-side parse via `xlsx` (`src/lib/guest-excel.ts`), per-row validation, upsert by primary phone (existing updated preserving RSVP, new inserted), results screen.

**Permit reconciliation UI** (backs `arrival_permits.match_status` / `invitation_id`, see [SCHEMA.md](./SCHEMA.md)): `UnmatchedBanner.tsx` surfaces RSVPs that arrived without a known invitation; `UnmatchedResolutionSheet.tsx` links a permit to an invitation (or creates one) via the `link_permit_to_invitation` / `create_invitation_from_permit` RPCs. `EventSwitcher.tsx` switches the active event (forward-looking; today the slug is hardcoded).

**Message History data flow:** batch fetch one `message_logs` query for all invitation IDs after table load → `Map<invitation_id, MessageLog>` for O(1) badge lookup. Per-guest full history fetched lazily on drawer open (`ignored` flag cancels stale updates on rapid re-open). Badge states: amber=ממתין בתור, emerald=נשלח, rose=נכשל, slate=טרם נשלח.

## Event Settings (`/dashboard/settings`)
Edits `content_config` JSONB (couple details, date/venue, schedule, transport, footer). Split-pane: form right + `LivePreview` phone-frame left (desktop); mobile floating preview button → full-screen overlay. Saves via direct `events` UPDATE. WhatsApp templates excluded (managed via Timeline).
> ⚠️ `LivePreview` renders `/preview/:slug` in an iframe that must stay **anon-only** — no Supabase auth init, or it races the parent dashboard's `navigator.locks`.

## Automation Timeline V2 (`/dashboard/timeline`)
- **Auto-Pilot master toggle** — global on/off stored in `events.automation_config.auto_pilot`, flipped via `toggle_auto_pilot` RPC. Soft pause: queued messages still send, only new evaluations pause.
- **Desktop (`lg:`):** horizontal RTL scrollable pipeline, drag-to-scroll (`useDragScroll`). Smart-focus snapping positions the active stage ~35% from right edge (Clamped Right-Third Focus). Stage columns (`w-48`) with status cards, icon circles, labels, computed dates.
- **Mobile (`< lg`):** vertical card stack, `border-r-4` accent, status pills, computed dates.
- **Stage status:** `sent` (emerald) / `active` (violet) / `scheduled` (amber) / `disabled` (grey+opacity), from `is_active` + `message_logs` stats.
- **`StageEditModal`** (liquid glass `GlassCard`, replaced old `TemplateEditorSheet`) — toggle, `days_before` with live date preview, singular/plural template text with variable hints, guarded delete (`delete_dynamic_nudge` RPC).
- **Dynamic nudges:** up to 3 (`nudge_1/2/3`). "Add Nudge" between last nudge and ultimatum → `addDynamicNudge`; delete via `delete_dynamic_nudge` (blocked if `message_logs` exist). New nudge opens edit modal immediately.
- **`StageLogsSheet`** — per-stage log drill-down, status filter tabs + search.
- Toast feedback (z-60 above modals), responsive skeletons, manual refresh.
- **Shared constants:** `CANONICAL_STAGES`, `DYNAMIC_NUDGE_NAMES`, `ALL_STAGE_NAMES`, `STAGE_META`, `TEMPLATE_LABELS`, `MSG_STATUS_MAP` in `src/components/dashboard/constants.ts`.
