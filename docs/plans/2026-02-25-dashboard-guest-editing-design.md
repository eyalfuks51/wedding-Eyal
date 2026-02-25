# Dashboard Guest Editing & Column Visibility — Design
**Date:** 2026-02-25
**Status:** Approved

---

## Overview

Two new Admin Dashboard features:
1. **`EditGuestSheet`** — side drawer to edit any guest's identity, classification, RSVP data, and automation flag.
2. **Column Visibility Control** — "תצוגה" dropdown in the filter bar to toggle optional table columns.

---

## Architecture

### File split
- **New:** `src/components/dashboard/EditGuestSheet.tsx` — self-contained component (form state, Supabase UPDATE, `onSave` callback). Extracted to keep `Dashboard.tsx` manageable (currently 1585 lines).
- **Modified:** `src/pages/Dashboard.tsx` — add `editGuest: Invitation | null` state, wire `group_name` cell click, add `colVis` state + dropdown, pass column flags into table render.

### Column visibility state (in `Dashboard.tsx`)
```ts
const [colVis, setColVis] = useState({
  side:       false,   // צד column
  group:      false,   // קבוצה column
  pax_split:  false,   // split invited/confirmed into two columns
  automation: false,   // is_automated column
});
```
Toggling is immediate (no save). The existing single **כמות** column (`confirmed / invited`) remains visible by default; `pax_split` replaces it with two separate labelled columns.

---

## Feature 1: `EditGuestSheet`

### Trigger
Clicking the `group_name` cell in the guest table opens the edit sheet.

**Visual affordance on the cell:**
```tsx
<td
  className="cursor-pointer hover:text-violet-700 hover:underline"
  onClick={e => { e.stopPropagation(); setEditGuest(inv); }}
>
  {inv.group_name}
</td>
```
`stopPropagation` prevents accidental row-checkbox toggle.

### Sheet layout
```
┌─────────────────────────────────┐
│ עריכת אורח          [X close]  │  ← SheetHeader (SheetTitle + SheetDescription)
│ {group_name}                    │
├─────────────────────────────────┤
│ זהות                            │  ← section label
│  שם הקבוצה  [text input]        │
│  טלפונים    [dynamic +/× array] │
│                                 │
│ סיווג                           │
│  צד         [select]           │
│  קבוצה      [text input]        │
│                                 │
│ RSVP                            │
│  סטטוס      [select]           │
│  מוזמנים    [number input]     │
│  אישרו      [number input]     │
│                                 │
│ הגדרות                          │
│  שלח הודעות אוטומטיות  [toggle] │
│                                 │
│ {inline error if save fails}    │
├─────────────────────────────────┤
│ [ביטול]      [שמור שינויים ●]   │  ← sticky footer; ● = saving spinner
└─────────────────────────────────┘
```

**Side:** `"left"` — consistent with `MessageHistorySheet`.

### Component props
```ts
interface EditGuestSheetProps {
  invitation: Invitation | null;       // null = closed
  sides:      string[];                // for the צד dropdown options
  onClose:    () => void;
  onSave:     (updated: Invitation) => void;
}
```

### Local form state
```ts
interface EditForm {
  group_name:    string;
  phones:        string[];
  side:          string;
  guest_group:   string;
  rsvp_status:   RsvpStatus;
  invited_pax:   number;
  confirmed_pax: number;
  is_automated:  boolean;
}
```
Initialised from `invitation` prop whenever it changes (use `useEffect`).

### Phone array editing
Same `+` / `×` pattern as `AddGuestModal`:
- At least one phone field always present
- Additional phones removable via `×` button
- Empty strings filtered out before save

### Save flow
```
1. Validate: group_name non-empty, at least one phone
2. setSaving(true)
3. supabase.from('invitations').update({
     group_name, phone_numbers, side, guest_group,
     rsvp_status, invited_pax, confirmed_pax, is_automated
   }).eq('id', invitation.id)
4a. On success:
    - onSave({ ...invitation, ...updates })   ← parent updates local state
    - show toast "השינויים נשמרו ✓"
    - close sheet
4b. On error:
    - setFormError(err.message)
    - sheet stays open
5. setSaving(false)
```

### Parent update pattern (in `Dashboard.tsx`)
```ts
const handleGuestSave = (updated: Invitation) => {
  setInvitations(prev => prev.map(i => i.id === updated.id ? updated : i));
};
```

---

## Feature 2: Column Visibility Dropdown

### Placement
In the filter bar row, after the existing status `<SelectFilter>`, right-aligned:
```
[search] [צד ▾] [קבוצה ▾] [סטטוס ▾]   [תצוגה ▾]
```

### Dropdown UI
Custom panel (not a native `<select>`):
- `<button>` toggles `colVisOpen` boolean
- Floating `<div>` panel with `useRef` + click-outside to close + Escape key support
- Each option: `<label><input type="checkbox" /> {label}</label>`
- Changes apply immediately (controlled by `colVis` state)

```tsx
{ colVisOpen && (
  <div ref={colVisRef} className="absolute top-full mt-1 left-0 z-30 bg-white border border-slate-200 rounded-xl shadow-lg p-2 min-w-[180px]">
    {COL_OPTIONS.map(opt => (
      <label key={opt.key} className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-50 cursor-pointer text-sm font-brand text-slate-700">
        <input
          type="checkbox"
          checked={colVis[opt.key]}
          onChange={() => setColVis(prev => ({ ...prev, [opt.key]: !prev[opt.key] }))}
          className="accent-violet-600"
        />
        {opt.label}
      </label>
    ))}
  </div>
)}
```

### Column options
```ts
const COL_OPTIONS = [
  { key: 'side',       label: 'צד' },
  { key: 'group',      label: 'קבוצה' },
  { key: 'pax_split',  label: 'כמויות מפורטות' },
  { key: 'automation', label: 'אוטומציה' },
];
```

### Default table columns (always visible)
`Checkbox | שם | טלפונים | כמות | סטטוס | סטטוס הודעה`

When `pax_split` is toggled on, the single **כמות** column is replaced by **מוזמנים** and **אישרו** separately.

### Table column guard pattern
```tsx
{colVis.side && <th>צד</th>}
{colVis.group && <th>קבוצה</th>}
{/* pax column logic */}
{colVis.pax_split
  ? <><th>מוזמנים</th><th>אישרו</th></>
  : <th>כמות</th>
}
{colVis.automation && <th>אוטומציה</th>}
```

---

## Styling Conventions
- All new UI: `font-brand` for body, `font-danidin` for section labels
- Violet-600 primary accent (focus rings, toggle, checkbox `accent-violet-600`)
- Slate neutral palette for borders and text
- RTL throughout (`dir="rtl"` on Sheet, right-to-left flex layout in filter bar)
- Toggle switch: build inline with a `<button role="switch">` — no new dependency

---

## Out of Scope
- Deleting guests (separate feature)
- Undo/redo after save
- Real-time sync (other users editing simultaneously)
