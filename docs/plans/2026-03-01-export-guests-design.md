# Design: Guest List Export

**Date:** 2026-03-01
**Status:** Approved

## Overview

Wire up the existing (stub) "ייצוא" buttons in the Dashboard to produce a rich Excel export of the guest list. Export includes all import fields plus RSVP status columns — useful for venue headcounts, seating planning, and reporting.

## Export Format (Option B — Rich, Read-Only)

Single `.xlsx` sheet with RTL layout. 10 columns:

| # | Header (Hebrew) | Source field | Notes |
|---|---|---|---|
| 1 | שם קבוצה | `group_name` | |
| 2 | טלפון 1 | `phone_numbers[0]` | |
| 3 | טלפון 2 | `phone_numbers[1]` | |
| 4 | כמות מוזמנים | `invited_pax` | |
| 5 | צד | `side` | |
| 6 | קבוצה | `guest_group` | |
| 7 | שליחה אוטומטית | `is_automated` | "כן" / "לא" |
| 8 | סטטוס | `rsvp_status` | "מגיע" / "ממתין" / "לא מגיע" |
| 9 | מגיעים בפועל | `confirmed_pax` | |
| 10 | הודעות שנשלחו | `messages_sent_count` | |

File name: `מוזמנים_YYYY-MM-DD.xlsx`

## Two Export Modes

1. **Header "ייצוא" button** — exports all guests currently visible after active filters/search
2. **Bulk action bar "ייצוא" button** — exports only the checked/selected rows

## Architecture

### New function in `src/lib/guest-excel.ts`

```ts
exportGuests(guests: Invitation[], filename: string): void
```

- Uses the existing `xlsx` + `file-saver` dependencies (already installed)
- Maps each `Invitation` to a flat row object
- Translates `rsvp_status` to Hebrew labels
- Sets RTL sheet view and column widths
- No new dependencies, no new files

### Changes in `src/pages/Dashboard.tsx`

- Header export button: pass `filteredInvitations` (the already-computed filtered list)
- Bulk action bar export button: pass `selectedIds`-filtered invitations
- Both call `exportGuests(list, filename)`

## What is NOT in scope

- Re-import compatibility (export is read-only / reporting focused)
- CSV format
- Custom column selection UI
