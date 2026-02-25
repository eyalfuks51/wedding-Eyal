# Dashboard Guest Editing & Column Visibility — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add `EditGuestSheet` (click guest name → edit drawer) and a "תצוגה" column-visibility dropdown to the Admin Dashboard.

**Architecture:** `EditGuestSheet` is a new self-contained component at `src/components/dashboard/EditGuestSheet.tsx`. It exports the `Invitation` and `RsvpStatus` types, which `Dashboard.tsx` imports to replace its local definitions. Column visibility state (`colVis`) lives in `Dashboard.tsx` as a plain Record; `hasSideOrGroup`/`hasInvitedPax` derived booleans are removed.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, `@radix-ui/react-dialog` (via existing `sheet.tsx`), Supabase JS client v2, lucide-react icons.

---

## Critical context

- `Dashboard.tsx` is at `src/pages/Dashboard.tsx` (1585 lines). Do NOT rewrite it wholesale — use targeted edits.
- All UI imports use the `@/` alias: `import X from '@/components/ui/sheet'`.
- The row `<tr onClick={() => toggleRow(inv.id)}>` handles checkbox selection. The name cell must call `e.stopPropagation()` to avoid triggering row selection when opening the edit sheet.
- Existing `Invitation` interface (line 36–48 of Dashboard.tsx) and `RsvpStatus` type (line 35) will be **replaced by imports** from `EditGuestSheet.tsx` in Task 2.
- `hasSideOrGroup` (line 1063) and `hasInvitedPax` (line 1064) are **removed** in Task 3 and replaced by `colVis` state.
- `colSpan` (line 1163) must be updated to a dynamic calculation.

---

## Task 1: Create `EditGuestSheet` component

**Files:**
- Create: `src/components/dashboard/EditGuestSheet.tsx`

**Step 1: Create the directory and file**

```bash
mkdir -p src/components/dashboard
```

Write `src/components/dashboard/EditGuestSheet.tsx` with this exact content:

```tsx
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

// ─── Types (exported so Dashboard.tsx can import instead of re-defining) ──────

export type RsvpStatus = 'pending' | 'attending' | 'declined';

export interface Invitation {
  id: string;
  group_name: string | null;
  phone_numbers: string[] | null;
  rsvp_status: RsvpStatus | null;
  confirmed_pax: number | null;
  invited_pax: number | null;
  messages_sent_count: number | null;
  is_automated: boolean | null;
  side: string | null;
  guest_group: string | null;
}

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

export interface EditGuestSheetProps {
  invitation: Invitation | null;   // null = sheet closed
  sides:      string[];            // for the צד select options
  onClose:    () => void;
  onSave:     (updated: Invitation) => void;
}

// ─── Small helpers ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 font-brand mb-2 mt-5 first:mt-0">
      {children}
    </h3>
  );
}

function FieldLabel({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-600 font-brand mb-1">
      {children}
    </label>
  );
}

const INPUT_CLS =
  'w-full px-3 py-2 text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded-xl ' +
  'focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent font-brand';

const SELECT_CLS = `${INPUT_CLS} appearance-none cursor-pointer`;

// ─── Component ────────────────────────────────────────────────────────────────

export function EditGuestSheet({ invitation, sides, onClose, onSave }: EditGuestSheetProps) {
  const [form, setForm] = useState<EditForm>({
    group_name: '', phones: [''], side: '', guest_group: '',
    rsvp_status: 'pending', invited_pax: 1, confirmed_pax: 0, is_automated: false,
  });
  const [saving, setSaving]       = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Sync local form whenever the target invitation changes
  useEffect(() => {
    if (!invitation) return;
    setForm({
      group_name:    invitation.group_name    ?? '',
      phones:        invitation.phone_numbers?.length ? [...invitation.phone_numbers] : [''],
      side:          invitation.side          ?? '',
      guest_group:   invitation.guest_group   ?? '',
      rsvp_status:   invitation.rsvp_status   ?? 'pending',
      invited_pax:   invitation.invited_pax   ?? 1,
      confirmed_pax: invitation.confirmed_pax ?? 0,
      is_automated:  invitation.is_automated  ?? false,
    });
    setFormError(null);
  }, [invitation]);

  // Helpers for concise setForm calls
  const set = <K extends keyof EditForm>(key: K, value: EditForm[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const setPhone = (idx: number, value: string) =>
    setForm(prev => {
      const phones = [...prev.phones];
      phones[idx] = value;
      return { ...prev, phones };
    });

  const addPhone    = () => setForm(prev => ({ ...prev, phones: [...prev.phones, ''] }));
  const removePhone = (idx: number) =>
    setForm(prev => ({ ...prev, phones: prev.phones.filter((_, i) => i !== idx) }));

  const handleSave = async () => {
    if (!invitation || !supabase) return;
    setFormError(null);

    if (!form.group_name.trim()) {
      setFormError('שם הקבוצה הוא שדה חובה');
      return;
    }
    const phone_numbers = form.phones.map(p => p.trim()).filter(Boolean);
    if (phone_numbers.length === 0) {
      setFormError('יש להזין לפחות מספר טלפון אחד');
      return;
    }

    setSaving(true);

    const updates = {
      group_name:    form.group_name.trim(),
      phone_numbers,
      side:          form.side.trim()        || null,
      guest_group:   form.guest_group.trim() || null,
      rsvp_status:   form.rsvp_status,
      invited_pax:   form.invited_pax,
      confirmed_pax: form.confirmed_pax,
      is_automated:  form.is_automated,
    };

    const { error } = await supabase
      .from('invitations')
      .update(updates)
      .eq('id', invitation.id);

    setSaving(false);

    if (error) {
      setFormError(`שגיאה בשמירה: ${error.message}`);
      return;
    }

    onSave({ ...invitation, ...updates });
  };

  return (
    <Sheet open={invitation !== null} onOpenChange={open => { if (!open) onClose(); }}>
      <SheetContent side="left" dir="rtl" className="font-brand flex flex-col p-0">

        {/* Header */}
        <SheetHeader className="flex-row items-start justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <SheetTitle>עריכת אורח</SheetTitle>
            {invitation?.group_name && (
              <SheetDescription>{invitation.group_name}</SheetDescription>
            )}
          </div>
          <SheetClose
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            aria-label="סגור"
          >
            <X className="w-4 h-4" />
          </SheetClose>
        </SheetHeader>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">

          {/* ── Identity ───────────────────────────────────────────────── */}
          <SectionLabel>זהות</SectionLabel>

          <div className="mb-3">
            <FieldLabel htmlFor="edit-group-name">שם הקבוצה</FieldLabel>
            <input
              id="edit-group-name"
              type="text"
              value={form.group_name}
              onChange={e => set('group_name', e.target.value)}
              className={INPUT_CLS}
              placeholder="לדוגמה: משפחת כהן"
            />
          </div>

          <div className="mb-3">
            <FieldLabel>טלפונים</FieldLabel>
            <div className="space-y-2">
              {form.phones.map((phone, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(idx, e.target.value)}
                    className={`${INPUT_CLS} flex-1`}
                    placeholder="050-000-0000"
                    dir="ltr"
                  />
                  {form.phones.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removePhone(idx)}
                      className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      aria-label="הסר טלפון"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={addPhone}
                className="text-xs text-violet-600 hover:text-violet-800 font-medium transition-colors"
              >
                + הוסף מספר
              </button>
            </div>
          </div>

          {/* ── Classification ─────────────────────────────────────────── */}
          <SectionLabel>סיווג</SectionLabel>

          <div className="mb-3">
            <FieldLabel htmlFor="edit-side">צד</FieldLabel>
            <select
              id="edit-side"
              value={form.side}
              onChange={e => set('side', e.target.value)}
              className={SELECT_CLS}
            >
              <option value="">— ללא —</option>
              {sides.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="mb-3">
            <FieldLabel htmlFor="edit-group">קבוצה</FieldLabel>
            <input
              id="edit-group"
              type="text"
              value={form.guest_group}
              onChange={e => set('guest_group', e.target.value)}
              className={INPUT_CLS}
              placeholder="לדוגמה: חברים מהצבא"
            />
          </div>

          {/* ── RSVP ───────────────────────────────────────────────────── */}
          <SectionLabel>RSVP</SectionLabel>

          <div className="mb-3">
            <FieldLabel htmlFor="edit-rsvp-status">סטטוס</FieldLabel>
            <select
              id="edit-rsvp-status"
              value={form.rsvp_status}
              onChange={e => set('rsvp_status', e.target.value as RsvpStatus)}
              className={SELECT_CLS}
            >
              <option value="pending">ממתין</option>
              <option value="attending">מגיע</option>
              <option value="declined">לא מגיע</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <FieldLabel htmlFor="edit-invited-pax">מוזמנים</FieldLabel>
              <input
                id="edit-invited-pax"
                type="number"
                min={0}
                value={form.invited_pax}
                onChange={e => set('invited_pax', Number(e.target.value))}
                className={INPUT_CLS}
              />
            </div>
            <div>
              <FieldLabel htmlFor="edit-confirmed-pax">אישרו</FieldLabel>
              <input
                id="edit-confirmed-pax"
                type="number"
                min={0}
                value={form.confirmed_pax}
                onChange={e => set('confirmed_pax', Number(e.target.value))}
                className={INPUT_CLS}
              />
            </div>
          </div>

          {/* ── Settings ───────────────────────────────────────────────── */}
          <SectionLabel>הגדרות</SectionLabel>

          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-slate-700 font-brand">שלח הודעות אוטומטיות</span>
            <button
              type="button"
              role="switch"
              aria-checked={form.is_automated}
              onClick={() => set('is_automated', !form.is_automated)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-1 ${
                form.is_automated ? 'bg-violet-600' : 'bg-slate-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                  form.is_automated ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Inline error */}
          {formError && (
            <p className="mt-3 text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2 font-brand">
              {formError}
            </p>
          )}

        </div>

        {/* Sticky footer */}
        <div className="border-t border-slate-100 px-6 py-4 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-1 py-2.5 px-4 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors font-brand disabled:opacity-50"
          >
            ביטול
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 px-4 text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-xl transition-colors font-brand disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving && (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            שמור שינויים
          </button>
        </div>

      </SheetContent>
    </Sheet>
  );
}
```

**Step 2: Lint check**

```bash
npx eslint src/components/dashboard/EditGuestSheet.tsx
```

Expected: no errors. Fix any issues before continuing.

**Step 3: Commit**

```bash
git add src/components/dashboard/EditGuestSheet.tsx
git commit -m "feat(dashboard): EditGuestSheet component with Supabase UPDATE"
```

---

## Task 2: Wire `EditGuestSheet` into `Dashboard.tsx`

**Files:**
- Modify: `src/pages/Dashboard.tsx`

### Step 1: Replace local type definitions with imports

Find and replace the type block near the top of Dashboard.tsx. The current code (around lines 34–48) has:

```tsx
// ─── Types ────────────────────────────────────────────────────────────────────

type RsvpStatus = 'pending' | 'attending' | 'declined';

interface Invitation {
  id: string;
  group_name: string | null;
  phone_numbers: string[] | null;
  rsvp_status: RsvpStatus | null;
  confirmed_pax: number | null;
  invited_pax: number | null;
  messages_sent_count: number | null;
  is_automated: boolean | null;
  side: string | null;
  guest_group: string | null;
}
```

Replace with:

```tsx
// ─── Types ────────────────────────────────────────────────────────────────────

import { type Invitation, type RsvpStatus, EditGuestSheet } from '@/components/dashboard/EditGuestSheet';
```

**Note:** TypeScript `import type` syntax is preferred but a regular import also works since we import the value (`EditGuestSheet`) and the types together.

### Step 2: Add `editGuest` state

After line 898 (the last state declaration in the "Message history drawer" block):

```tsx
  // ── Edit guest drawer ─────────────────────────────────────────────────────
  const [editGuest, setEditGuest] = useState<Invitation | null>(null);
```

### Step 3: Add `handleGuestSave` callback

After the `handleGuestAdded` function (after line 1059):

```tsx
  const handleGuestSave = (updated: Invitation) => {
    setInvitations(prev => prev.map(i => i.id === updated.id ? updated : i));
    setEditGuest(null);
    setToast('השינויים נשמרו ✓');
    setTimeout(() => setToast(null), 3000);
  };
```

### Step 4: Add `<EditGuestSheet>` to the JSX

After the `<MessageHistorySheet ... />` block (after line 1203):

```tsx
      <EditGuestSheet
        invitation={editGuest}
        sides={sides}
        onClose={() => setEditGuest(null)}
        onSave={handleGuestSave}
      />
```

### Step 5: Make the `group_name` table cell clickable

Find the current name cell (around line 1443):

```tsx
                        {/* Name — semibold for strong visual anchor */}
                        <td className="px-4 py-4">
                          <span className="font-semibold text-slate-800 font-brand">
                            {inv.group_name ?? '—'}
                          </span>
                        </td>
```

Replace with:

```tsx
                        {/* Name — click to open edit sheet */}
                        <td
                          className="px-4 py-4"
                          onClick={e => { e.stopPropagation(); setEditGuest(inv); }}
                        >
                          <span className="font-semibold text-slate-800 font-brand cursor-pointer hover:text-violet-700 hover:underline">
                            {inv.group_name ?? '—'}
                          </span>
                        </td>
```

### Step 6: Lint and verify

```bash
npx eslint src/pages/Dashboard.tsx
```

Expected: no errors. Common issue: if TypeScript complains about `RsvpStatus` no longer being a local type, ensure the import in Step 1 is correct.

### Step 7: Commit

```bash
git add src/pages/Dashboard.tsx
git commit -m "feat(dashboard): wire EditGuestSheet — click name to edit guest"
```

---

## Task 3: Column Visibility Dropdown

**Files:**
- Modify: `src/pages/Dashboard.tsx`

### Step 1: Add `ColVis` type, `COL_OPTIONS` constant, and `colVis` / `colVisOpen` state

**Add these constants** near the top of the file, after the existing `EMPTY_FORM` constant (around line 860, before the `Dashboard` function):

```tsx
interface ColVis {
  side:       boolean;
  group:      boolean;
  pax_split:  boolean;
  automation: boolean;
}

const COL_OPTIONS: Array<{ key: keyof ColVis; label: string }> = [
  { key: 'side',       label: 'צד' },
  { key: 'group',      label: 'קבוצה' },
  { key: 'pax_split',  label: 'כמויות מפורטות' },
  { key: 'automation', label: 'אוטומציה' },
];
```

**Add state** in the Dashboard function after the `editGuest` state (added in Task 2):

```tsx
  // ── Column visibility ─────────────────────────────────────────────────────
  const [colVis, setColVis]       = useState<ColVis>({ side: false, group: false, pax_split: false, automation: false });
  const [colVisOpen, setColVisOpen] = useState(false);
  const colVisRef                   = useRef<HTMLDivElement>(null);
```

### Step 2: Add click-outside + Escape handler for colVis dropdown

Add a new `useEffect` after the existing useEffects (after the `drawerInvitation` useEffect, around line 973):

```tsx
  // Close colVis dropdown on outside click or Escape
  useEffect(() => {
    const onMouse = (e: MouseEvent) => {
      if (colVisRef.current && !colVisRef.current.contains(e.target as Node)) {
        setColVisOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setColVisOpen(false); };
    document.addEventListener('mousedown', onMouse);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onMouse);
      document.removeEventListener('keydown', onKey);
    };
  }, []);
```

### Step 3: Remove `hasSideOrGroup` and `hasInvitedPax` — replace with dynamic `colSpan`

Find and **delete** lines 1061–1064:

```tsx
  // ── Column visibility ─────────────────────────────────────────────────────

  const hasSideOrGroup = invitations.some(i => i.side || i.guest_group);
  const hasInvitedPax  = invitations.some(i => i.invited_pax != null && i.invited_pax > 0);
```

Find line 1163 and replace the static `colSpan`:

```tsx
  const colSpan = hasSideOrGroup ? 7 : 6;
```

Replace with:

```tsx
  const colSpan = 6
    + (colVis.side       ? 1 : 0)
    + (colVis.group      ? 1 : 0)
    + (colVis.pax_split  ? 1 : 0)   // pax_split replaces 1 col with 2 → net +1
    + (colVis.automation ? 1 : 0);
```

### Step 4: Add "תצוגה" button to the filter bar

Find the count span in the filter bar (around line 1350):

```tsx
            <span className="text-xs text-slate-400 font-brand mr-auto">
              {filtered.length === invitations.length
                ? `${invitations.length} הזמנות`
                : `${filtered.length} מתוך ${invitations.length}`}
            </span>
```

Insert the dropdown **before** that span:

```tsx
            {/* Column visibility dropdown */}
            <div className="relative shrink-0" ref={colVisRef}>
              <button
                type="button"
                onClick={() => setColVisOpen(prev => !prev)}
                className="flex items-center gap-1.5 pr-3 pl-2.5 py-2.5 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors font-brand"
              >
                תצוגה
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-150 ${colVisOpen ? 'rotate-180' : ''}`} />
              </button>
              {colVisOpen && (
                <div className="absolute top-full mt-1 right-0 z-30 bg-white border border-slate-200 rounded-xl shadow-lg p-2 min-w-[180px]">
                  {COL_OPTIONS.map(opt => (
                    <label
                      key={opt.key}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-50 cursor-pointer text-sm font-brand text-slate-700 select-none"
                    >
                      <input
                        type="checkbox"
                        checked={colVis[opt.key]}
                        onChange={() => setColVis(prev => ({ ...prev, [opt.key]: !prev[opt.key] }))}
                        className="w-4 h-4 rounded border-slate-300 accent-violet-600 cursor-pointer"
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              )}
            </div>
```

### Step 5: Update the table `<thead>`

Find the entire `<thead>` block (lines 1367–1404) and replace it:

```tsx
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">

                  <th className="w-12 px-4 py-3.5 text-right">
                    <input
                      ref={selectAllRef}
                      type="checkbox"
                      checked={allChecked}
                      onChange={toggleAll}
                      className="w-4 h-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500 cursor-pointer"
                    />
                  </th>

                  <th className="px-4 py-3.5 text-right font-semibold text-slate-400 text-xs tracking-wider whitespace-nowrap">שם</th>
                  <th className="px-4 py-3.5 text-right font-semibold text-slate-400 text-xs tracking-wider whitespace-nowrap">טלפונים</th>

                  {colVis.side  && <th className="px-4 py-3.5 text-right font-semibold text-slate-400 text-xs tracking-wider whitespace-nowrap">צד</th>}
                  {colVis.group && <th className="px-4 py-3.5 text-right font-semibold text-slate-400 text-xs tracking-wider whitespace-nowrap">קבוצה</th>}

                  {colVis.pax_split ? (
                    <>
                      <th className="px-4 py-3.5 text-right font-semibold text-slate-400 text-xs tracking-wider whitespace-nowrap">מוזמנים</th>
                      <th className="px-4 py-3.5 text-right font-semibold text-slate-400 text-xs tracking-wider whitespace-nowrap">אישרו</th>
                    </>
                  ) : (
                    <th className="px-4 py-3.5 text-right font-semibold text-slate-400 text-xs tracking-wider whitespace-nowrap">כמות</th>
                  )}

                  {colVis.automation && <th className="px-4 py-3.5 text-right font-semibold text-slate-400 text-xs tracking-wider whitespace-nowrap">אוטומציה</th>}

                  <th className="px-4 py-3.5 text-right font-semibold text-slate-400 text-xs tracking-wider whitespace-nowrap">סטטוס</th>
                  <th className="px-4 py-3.5 text-right font-semibold text-slate-400 text-xs tracking-wider whitespace-nowrap">סטטוס הודעה</th>

                </tr>
              </thead>
```

### Step 6: Update the table body rows

Inside the `filtered.map(inv => ...)` block, make three targeted changes:

**A) Remove** the `sideGroup` derived variable (line 1421) — it's no longer used:

```tsx
                    const sideGroup  = [inv.side, inv.guest_group].filter(Boolean).join(' / ');
```
→ Delete this line.

**B) Replace** the combined side/group cell (lines 1469–1474):

```tsx
                        {/* Side / Group */}
                        {hasSideOrGroup && (
                          <td className="px-4 py-4 text-slate-500 text-sm font-brand whitespace-nowrap">
                            {sideGroup || '—'}
                          </td>
                        )}
```

Replace with:

```tsx
                        {colVis.side && (
                          <td className="px-4 py-4 text-slate-500 text-sm font-brand whitespace-nowrap">
                            {inv.side || '—'}
                          </td>
                        )}
                        {colVis.group && (
                          <td className="px-4 py-4 text-slate-500 text-sm font-brand whitespace-nowrap">
                            {inv.guest_group || '—'}
                          </td>
                        )}
```

**C) Replace** the pax cell (lines 1476–1486):

```tsx
                        {/* Pax count */}
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span className="font-semibold text-slate-800 font-brand">
                            {inv.confirmed_pax ?? '?'}
                          </span>
                          {hasInvitedPax && inv.invited_pax != null && (
                            <span className="text-slate-400 text-xs font-brand">
                              {' '}/ {inv.invited_pax}
                            </span>
                          )}
                        </td>
```

Replace with:

```tsx
                        {/* Pax */}
                        {colVis.pax_split ? (
                          <>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <span className="text-slate-700 font-brand text-sm">{inv.invited_pax ?? '—'}</span>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap">
                              <span className="font-semibold text-slate-800 font-brand">{inv.confirmed_pax ?? '—'}</span>
                            </td>
                          </>
                        ) : (
                          <td className="px-4 py-4 whitespace-nowrap">
                            <span className="font-semibold text-slate-800 font-brand">
                              {inv.confirmed_pax ?? '?'}
                            </span>
                            {inv.invited_pax != null && (
                              <span className="text-slate-400 text-xs font-brand"> / {inv.invited_pax}</span>
                            )}
                          </td>
                        )}
```

**D) Add** the automation cell after the pax cell and before the status cell:

```tsx
                        {/* Automation */}
                        {colVis.automation && (
                          <td className="px-4 py-4" onClick={e => e.stopPropagation()}>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium font-brand ${
                              inv.is_automated ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-400'
                            }`}>
                              {inv.is_automated ? 'פעיל' : 'כבוי'}
                            </span>
                          </td>
                        )}
```

### Step 7: Lint and verify

```bash
npx eslint src/pages/Dashboard.tsx
```

Expected: no errors. Common issues:
- `hasSideOrGroup` referenced somewhere that was missed → search and remove
- `hasInvitedPax` referenced somewhere that was missed → search and remove
- `sideGroup` referenced somewhere that was missed → search and remove

### Step 8: Commit

```bash
git add src/pages/Dashboard.tsx
git commit -m "feat(dashboard): column visibility dropdown (תצוגה) with colVis state"
```

---

## Task 4: Final lint + push

**Step 1: Full lint**

```bash
npx eslint src/pages/Dashboard.tsx src/components/dashboard/EditGuestSheet.tsx
```

Expected: no errors.

**Step 2: Push**

```bash
git push origin main
```
