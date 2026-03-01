# Guest List Export Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Wire up the two stub "ייצוא" buttons in the Dashboard to export a rich Excel file of the guest list.

**Architecture:** Add a single `exportGuests(guests, filename)` function to the existing `src/lib/guest-excel.ts` module (which already has `xlsx` + `file-saver`). Wire the header button to export all filtered guests, and the bulk-action bar button to export only selected guests. No new files, no new dependencies.

**Tech Stack:** `xlsx`, `file-saver` (both already installed), React, TypeScript

---

### Task 1: Add `exportGuests` to `src/lib/guest-excel.ts`

**Files:**
- Modify: `src/lib/guest-excel.ts`

> Note: This is a pure data-mapping + file-write utility. There is no meaningful unit test for a browser file download (jsdom cannot trigger `saveAs`). Manual smoke test instructions are provided instead.

**Step 1: Add the `Invitation` import at the top of the file**

At the top of `src/lib/guest-excel.ts`, add this import (after the existing `xlsx`/`file-saver` imports):

```ts
import type { Invitation } from '@/components/dashboard/EditGuestSheet';
```

**Step 2: Add the RSVP status label map and the export columns constant**

Paste this block directly after the existing `INSTRUCTIONS` array (around line 54):

```ts
// ─── Export ──────────────────────────────────────────────────────────────────

const EXPORT_COLUMNS = [
  'שם קבוצה',
  'טלפון 1',
  'טלפון 2',
  'כמות מוזמנים',
  'צד',
  'קבוצה',
  'שליחה אוטומטית',
  'סטטוס',
  'מגיעים בפועל',
  'הודעות שנשלחו',
];

const RSVP_LABELS: Record<string, string> = {
  attending: 'מגיע',
  pending:   'ממתין',
  declined:  'לא מגיע',
};
```

**Step 3: Add the `exportGuests` function**

Paste this function at the end of `src/lib/guest-excel.ts`:

```ts
export function exportGuests(guests: Invitation[], filename: string): void {
  const rows = guests.map(g => ({
    'שם קבוצה':        g.group_name ?? '',
    'טלפון 1':         g.phone_numbers?.[0] ?? '',
    'טלפון 2':         g.phone_numbers?.[1] ?? '',
    'כמות מוזמנים':    g.invited_pax ?? '',
    'צד':              g.side ?? '',
    'קבוצה':           g.guest_group ?? '',
    'שליחה אוטומטית': g.is_automated === false ? 'לא' : 'כן',
    'סטטוס':           RSVP_LABELS[g.rsvp_status ?? ''] ?? '',
    'מגיעים בפועל':    g.confirmed_pax ?? '',
    'הודעות שנשלחו':  g.messages_sent_count ?? 0,
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows, { header: EXPORT_COLUMNS });

  ws['!cols'] = [
    { wch: 20 }, // שם קבוצה
    { wch: 15 }, // טלפון 1
    { wch: 15 }, // טלפון 2
    { wch: 14 }, // כמות מוזמנים
    { wch: 10 }, // צד
    { wch: 14 }, // קבוצה
    { wch: 16 }, // שליחה אוטומטית
    { wch: 12 }, // סטטוס
    { wch: 14 }, // מגיעים בפועל
    { wch: 16 }, // הודעות שנשלחו
  ];
  ws['!sheetViews'] = [{ rightToLeft: true }];

  XLSX.utils.book_append_sheet(wb, ws, 'מוזמנים');
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  saveAs(blob, filename);
}
```

**Step 4: Verify TypeScript compiles cleanly**

In the terminal:
```bash
cd /c/dev/github/personal/Wedding-Eyal
npx tsc --noEmit
```
Expected: no errors.

**Step 5: Commit**

```bash
git add src/lib/guest-excel.ts
git commit -m "feat(export): add exportGuests function to guest-excel.ts"
```

---

### Task 2: Wire both export buttons in `Dashboard.tsx`

**Files:**
- Modify: `src/pages/Dashboard.tsx`

**Step 1: Add `exportGuests` to the import from `guest-excel`**

Find the existing import from `guest-excel` in `Dashboard.tsx`:

```ts
import GuestUploadModal from '@/components/dashboard/GuestUploadModal';
```

There is no existing guest-excel import in Dashboard.tsx yet. Add this import after the `GuestUploadModal` import:

```ts
import { exportGuests } from '../lib/guest-excel';
```

**Step 2: Add the `handleExport` helper function**

Find the existing `handleSendBulkMessage` function in `Dashboard.tsx`. Add this helper right after it:

```ts
function handleExportAll() {
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  exportGuests(filtered, `מוזמנים_${date}.xlsx`);
}

function handleExportSelected() {
  const date = new Date().toISOString().slice(0, 10);
  exportGuests(selectedGuestsArray, `מוזמנים_נבחרים_${date}.xlsx`);
}
```

**Step 3: Wire the header "ייצוא" button (exports all filtered)**

Find this button around line 1293:

```tsx
<button
  className="shrink-0 inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-medium font-brand rounded-xl transition-colors"
>
  <Download className="w-4 h-4" />
  ייצוא
</button>
```

Add `onClick`:

```tsx
<button
  onClick={handleExportAll}
  className="shrink-0 inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-medium font-brand rounded-xl transition-colors"
>
  <Download className="w-4 h-4" />
  ייצוא
</button>
```

**Step 4: Wire the bulk action bar "ייצוא" button (exports selected)**

Find this button around line 1671:

```tsx
<button className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-medium font-brand transition-colors whitespace-nowrap">
  <Download className="w-3.5 h-3.5" />
  ייצוא
</button>
```

Add `onClick`:

```tsx
<button
  onClick={handleExportSelected}
  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-medium font-brand transition-colors whitespace-nowrap"
>
  <Download className="w-3.5 h-3.5" />
  ייצוא
</button>
```

**Step 5: Verify TypeScript compiles cleanly**

```bash
npx tsc --noEmit
```
Expected: no errors.

**Step 6: Manual smoke test**

1. `npm run dev` → open `/dashboard`
2. Click the header **ייצוא** button → a `.xlsx` file downloads
3. Open in Excel/Sheets → verify 10 columns, RTL layout, Hebrew headers, data populated correctly
4. Select 2–3 rows via checkboxes → the bulk action bar appears → click its **ייצוא** button → a second file downloads with only those rows

**Step 7: Commit**

```bash
git add src/pages/Dashboard.tsx
git commit -m "feat(export): wire export buttons in Dashboard — all-filtered + selected modes"
```
