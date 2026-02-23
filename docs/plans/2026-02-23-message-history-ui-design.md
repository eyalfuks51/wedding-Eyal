# Design: WhatsApp Message History UI
**Date:** 2026-02-23
**Status:** Approved
**Scope:** `src/pages/Dashboard.tsx` + new `src/components/ui/sheet.tsx`

---

## Goal

Surface WhatsApp queue/history data from `message_logs` directly in the Admin Dashboard — without leaving the page — so admins can see at a glance which guests have been messaged and drill into the full history.

---

## Architecture

Four isolated additions:

1. **Install Shadcn Sheet** — `npx shadcn-ui@latest add sheet` → `src/components/ui/sheet.tsx` + `@radix-ui/react-dialog`
2. **Data layer** — batch-fetch latest log per invitation after table loads; lazy per-invitation fetch when drawer opens
3. **`MsgStatusBadge` column** — new rightmost column; badge click opens drawer, row-click-to-select is untouched
4. **`MessageHistorySheet` component** — Shadcn `<Sheet side="left">` with a vertical timeline

---

## Data Fetching

```
Invitations load
  └─► batch fetch message_logs for all IDs (created_at DESC)
        → reduce to Map<invitation_id, MessageLog>  →  status badge column

Drawer opens for invitation X
  └─► fetch all message_logs where invitation_id = X (created_at DESC)  →  timeline
```

- **Batch query:** fires in a `useEffect([invitations])` — one query for all invitation IDs, reduced client-side to keep only the most-recent log per invitation
- **Drawer query:** lazy, fires only on open, stored in `drawerLogs` state
- No per-row queries on render

---

## New Types

```ts
interface MessageLog {
  id:            string;
  invitation_id: string;
  phone:         string;
  message_type:  string;
  content:       string;
  status:        'pending' | 'sent' | 'failed';
  error_log:     string | null;
  scheduled_for: string | null;
  sent_at:       string | null;
  created_at:    string;
}
```

---

## New State (inside `Dashboard`)

```ts
const [latestMsgLogs,    setLatestMsgLogs]    = useState<Map<string, MessageLog>>(new Map());
const [drawerInvitation, setDrawerInvitation] = useState<Invitation | null>(null);
const [drawerLogs,       setDrawerLogs]       = useState<MessageLog[]>([]);
const [drawerLoading,    setDrawerLoading]    = useState(false);
```

---

## Status Column

- Header: `סטטוס הודעה`
- Placed after the existing `סטטוס` (RSVP status) column
- `colSpan` updated: `hasSideOrGroup ? 7 : 6`

### `MsgStatusBadge` component

| `status`  | Color  | Hebrew label |
|-----------|--------|--------------|
| `pending` | Amber  | ממתין בתור   |
| `sent`    | Emerald | נשלח         |
| `failed`  | Rose   | נכשל          |
| *(none)*  | Slate  | טרם נשלח     |

- Rendered as a clickable `<button>` inside the table cell
- `e.stopPropagation()` prevents triggering row-selection toggle
- On click: `setDrawerInvitation(inv)`

---

## `MessageHistorySheet` Component

- Shadcn `<Sheet side="left">` — slides from left edge (correct for RTL layout)
- Content wrapper: `dir="rtl"`
- Controlled by `drawerInvitation !== null`

### Header
- Title: `היסטוריית הודעות`
- Sub-line: guest's `group_name` in muted text
- Close button (X)

### Timeline entries (newest-first)

Each entry is a `<div>` with a left-border accent matching status color:

```
┌─ [amber/green/rose border] ──────────────────────────┐
│  [Type chip]  [Timestamp]               [StatusBadge] │
│                                                        │
│  Message content (whitespace-pre-wrap, ~4 lines)      │
│                                                        │
│  [rose error box — only if status = 'failed']         │
└────────────────────────────────────────────────────────┘
```

**Type chip labels** (reuse `TEMPLATE_LABELS` map already in the file):
- `icebreaker` → פתיחה ראשונית
- `nudge` → תזכורת עדינה
- `ultimatum` → תזכורת אחרונה
- `logistics` → מידע לוגיסטי
- `hangover` → תודה לאחר האירוע
- `custom` → הודעה מותאמת

**Timestamp format:** `DD/MM/YYYY HH:mm` (from `created_at`)

### States
- **Loading:** centered spinner (same pattern as page-level `<Spinner>`)
- **Empty:** muted centered text "לא נמצאו הודעות עבור אורח זה"

---

## Files Changed

| File | Change |
|------|--------|
| `src/components/ui/sheet.tsx` | New — installed via Shadcn CLI |
| `src/pages/Dashboard.tsx` | Add types, state, batch fetch, `MsgStatusBadge`, column, `MessageHistorySheet` |

---

## Out of Scope

- Inline message editing / resending from the drawer
- Pagination of timeline entries (drawer always shows all logs for one invitation)
- Real-time subscription to `message_logs` changes
