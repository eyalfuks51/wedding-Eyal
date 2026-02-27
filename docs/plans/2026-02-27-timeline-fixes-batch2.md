# Timeline Fixes Batch 2 — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix 5 issues: Shabbat UI indicator, card overflow, deferred nudge creation, default nudge text, and snap-to-center bug.

**Architecture:** All changes are in `AutomationTimeline.tsx` (helpers, hooks, components), `StageEditModal.tsx` (deferred create + default text), and `supabase.js` (new create-on-save function). No new files.

**Tech Stack:** React, TypeScript, Tailwind CSS, Supabase

---

### Task 1: Add Shabbat detection helper and show indicator on stage cards

**Files:**
- Modify: `src/pages/AutomationTimeline.tsx`

**What to do:**

1. Update `computeStageDate` to return the raw `Date` object and a `isFridayOrShabbat` flag. Replace the existing function (lines 88–101) with:

```typescript
function computeStageDate(
  eventDate: Date | null,
  daysBefore: number,
): { dateStr: string; weekday: string; shortDate: string; shortDay: string; isFridayOrShabbat: boolean; raw: Date } | null {
  if (!eventDate) return null;
  const d = new Date(eventDate);
  d.setDate(d.getDate() - daysBefore);
  const day = d.getDay(); // 0=Sun … 5=Fri, 6=Sat
  return {
    dateStr: d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    weekday: d.toLocaleDateString('he-IL', { weekday: 'short' }),
    shortDate: d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' }),
    shortDay: d.toLocaleDateString('he-IL', { weekday: 'short' }),
    isFridayOrShabbat: day === 5 || day === 6,
    raw: d,
  };
}
```

2. In `StageColumn`, after the time indicators section (the `dateInfo && (...)` block inside the `border-t` div), add a Shabbat hint — only shown for `scheduled` stages whose computed date falls on Friday/Saturday:

```tsx
{dateInfo?.isFridayOrShabbat && status === 'scheduled' && (
  <p className="text-[10px] text-amber-500 font-brand mt-0.5">
    ישלח לאחר שבת
  </p>
)}
```

3. In `MobileStageCard`, add the same Shabbat indicator after the date display row (inside the card body, after the `dateInfo` span):

```tsx
{dateInfo?.isFridayOrShabbat && status === 'scheduled' && (
  <span className="inline-flex items-center text-[10px] text-amber-500 font-brand">
    ישלח לאחר שבת
  </span>
)}
```

**Verify:** `npx tsc --noEmit` — no errors.

**Commit:** `feat(timeline): add Shabbat indicator on stage cards`

---

### Task 2: Fix card overflow — increase fixed-height wrapper

**Files:**
- Modify: `src/pages/AutomationTimeline.tsx`

**What to do:**

The current `h-[8.5rem]` (136px) is too short for focus cards with all content (pill + audience + msgStatLine + time + Shabbat hint). Increase to `h-[10rem]` (160px).

1. In `StageColumn` (the card wrapper div), change:
```
h-[8.5rem]
```
to:
```
h-[10rem]
```

2. In `EventDayColumn` (the card wrapper div), change the same:
```
h-[8.5rem]
```
to:
```
h-[10rem]
```

3. In `AddNudgeOverlay`, recalculate the `top` value. The button should be centered on the icon row:
   - Card wrapper: 160px (`h-[10rem]`)
   - Vertical line: 16px (`h-4`)
   - Half icon: 20px (half of `w-10 h-10`)
   - Minus half button: 16px (half of `w-8 h-8`)
   - Total: 160 + 16 + 20 - 16 = **180px**

   Change `style={{ top: '156px' }}` to `style={{ top: '180px' }}`.

   Also update the comment above the button to reflect the new calculation.

4. In `DesktopSkeleton`, change:
```
h-[8.5rem]
```
to:
```
h-[10rem]
```

**Verify:** `npx tsc --noEmit` — no errors. Visual check: all connectors aligned.

**Commit:** `fix(timeline): increase card wrapper height to prevent overflow`

---

### Task 3: Fix snap-to-center — remove scrollBehavior override, widen spacers, add boundary clamping

**Files:**
- Modify: `src/pages/AutomationTimeline.tsx`

**What to do:**

1. **Remove the `style={{ scrollBehavior: 'auto' }}` inline style** from the desktop pipeline scroll container (line ~1010). This override blocks `behavior: 'smooth'` from the `snapToNearest` function. Simply delete the entire `style={...}` prop.

Before:
```tsx
<div
  ref={scrollRef}
  className={cn(
    'flex items-start overflow-x-auto overflow-y-hidden scrollbar-hide py-6',
    drag.isDragging ? 'cursor-grabbing' : 'cursor-grab',
  )}
  style={{ scrollBehavior: 'auto' }}
  dir="rtl"
```

After:
```tsx
<div
  ref={scrollRef}
  className={cn(
    'flex items-start overflow-x-auto overflow-y-hidden scrollbar-hide py-6',
    drag.isDragging ? 'cursor-grabbing' : 'cursor-grab',
  )}
  dir="rtl"
```

2. **Widen edge spacers** from `w-4` (16px) to `w-16` (64px) so edge cards are never clipped. Change both:
   - Leading spacer (right edge in RTL): `w-4` → `w-16`
   - Trailing spacer (left edge in RTL): `w-4` → `w-16`

3. **Add scroll boundary clamping** to `snapToNearest` to prevent scrolling past the container bounds. Replace the current `snapToNearest` function (lines ~169–193) with:

```typescript
const snapToNearest = useCallback(() => {
  const el = ref.current;
  if (!el) return;
  const cells = el.querySelectorAll<HTMLElement>('[data-pipeline-cell]');
  if (cells.length === 0) return;

  const containerRect = el.getBoundingClientRect();
  const containerCenter = containerRect.left + containerRect.width / 2;
  let bestCell: HTMLElement | null = null;
  let bestDist = Infinity;

  cells.forEach(cell => {
    const r = cell.getBoundingClientRect();
    const cellCenter = r.left + r.width / 2;
    const dist = Math.abs(cellCenter - containerCenter);
    if (dist < bestDist) { bestDist = dist; bestCell = cell; }
  });

  if (bestCell) {
    const r = (bestCell as HTMLElement).getBoundingClientRect();
    const cellCenter = r.left + r.width / 2;
    let delta = cellCenter - containerCenter;
    // Clamp: don't scroll past boundaries
    const maxScrollLeft = el.scrollWidth - el.clientWidth;
    const newScrollLeft = el.scrollLeft + delta;
    if (newScrollLeft < 0) delta = -el.scrollLeft;
    else if (newScrollLeft > maxScrollLeft) delta = maxScrollLeft - el.scrollLeft;
    if (Math.abs(delta) > 1) {
      el.scrollBy({ left: delta, behavior: 'smooth' });
    }
  }
}, [ref]);
```

**Verify:** `npx tsc --noEmit` — no errors. Visual check: drag and release → cards snap smoothly to center, edge cards not clipped.

**Commit:** `fix(timeline): fix snap-to-center scrollBehavior conflict, widen spacers, clamp boundaries`

---

### Task 4: Deferred nudge creation — only insert to DB on save

**Files:**
- Modify: `src/pages/AutomationTimeline.tsx`
- Modify: `src/components/dashboard/StageEditModal.tsx`

**What to do:**

This is the most complex task. Currently clicking "+" immediately calls `addDynamicNudge()` which INSERTs to DB. We need to defer the INSERT until the user clicks "Save" in the modal.

#### Part A: AutomationTimeline.tsx

1. Add a `draftNudge` state to track unsaved new nudges. Near the existing `editSetting` state (line ~712), add:

```typescript
const [draftNudge, setDraftNudge] = useState<{ stage_name: string; days_before: number } | null>(null);
```

2. Replace the entire `handleAddNudge` function (lines ~892–918) with a version that does NOT call the DB:

```typescript
const handleAddNudge = () => {
  if (!event?.id || !canAddNudge) return;
  // Find next available dynamic nudge name
  const existing = settings.map(s => s.stage_name);
  const nextName = (['nudge_1', 'nudge_2', 'nudge_3'] as const).find(n => !existing.includes(n));
  if (!nextName) return;

  // Compute default days_before: midpoint between last nudge and ultimatum
  const nudges = sorted.filter(s => s.stage_name === 'nudge' || s.stage_name.startsWith('nudge_'));
  const ultimatum = sorted.find(s => s.stage_name === 'ultimatum');
  const lastNudgeDays = nudges.length > 0 ? Math.min(...nudges.map(n => n.days_before)) : 7;
  const ultimatumDays = ultimatum?.days_before ?? 3;
  const defaultDays = Math.round((lastNudgeDays + ultimatumDays) / 2);

  // Create a local draft (not in DB yet) and open the modal
  const draft: AutomationSettingRow = {
    id: `draft-${nextName}`,
    event_id: event.id,
    stage_name: nextName as AutomationSettingRow['stage_name'],
    days_before: defaultDays,
    target_status: 'pending',
    is_active: true,
    created_at: new Date().toISOString(),
  };
  setDraftNudge({ stage_name: nextName, days_before: defaultDays });
  setEditSetting(draft);
};
```

3. Remove the `setAddingNudge` state and the `addingNudge` usage in the `AddNudgeOverlay` call. Simply keep the `!canAddNudge` check. If `addingNudge` state is used elsewhere, search for it — it should only be in `handleAddNudge` (the try/finally block) and the AddNudgeOverlay disabled prop. Remove both.

4. Add a `handleDraftNudgeSaved` callback that actually creates the DB row:

```typescript
const handleDraftNudgeSaved = async (updates: { is_active?: boolean; days_before?: number; singular?: string; plural?: string }) => {
  if (!draftNudge || !event?.id) return;
  try {
    await addDynamicNudge(event.id, draftNudge.stage_name, updates.days_before ?? draftNudge.days_before);
    if (updates.singular !== undefined || updates.plural !== undefined) {
      await updateWhatsAppTemplate(event.id, draftNudge.stage_name, updates.singular ?? '', updates.plural ?? '');
    }
    await loadData(event.id);
    showToast('תזכורת חדשה נוספה');
  } catch (err: unknown) {
    showToast(err instanceof Error ? err.message : 'שגיאה בהוספת תזכורת', 'error');
  } finally {
    setDraftNudge(null);
  }
};
```

5. Update the modal's `onClose` callback to also clear draftNudge:

```tsx
onClose={() => { setEditSetting(null); setDraftNudge(null); }}
```

6. Update the modal's `onSaved` to use the draft handler when applicable:

```tsx
onSaved={draftNudge ? handleDraftNudgeSaved : handleEditSaved}
```

7. When `draftNudge` is set, hide the delete button by overriding `canDelete`:

```tsx
canDelete={!draftNudge && editIsDynamicNudge && !editSettingHasLogs}
```

#### Part B: StageEditModal.tsx

8. In `handleSave`, when the setting id starts with `draft-`, skip the `updateAutomationSetting` call (the row doesn't exist yet). The parent's `onSaved` will handle creation. Replace the setting update logic:

```typescript
const handleSave = useCallback(async () => {
  if (!setting) return;
  setSaving(true);
  setError('');
  try {
    const isDraft = setting.id.startsWith('draft-');

    // Only update existing DB row if not a draft
    if (!isDraft) {
      const settingUpdates: Record<string, unknown> = {};
      if (isActive !== setting.is_active) settingUpdates.is_active = isActive;
      if (daysBefore !== setting.days_before) settingUpdates.days_before = daysBefore;

      const promises: Promise<unknown>[] = [];
      if (Object.keys(settingUpdates).length > 0) {
        promises.push(updateAutomationSetting(setting.id, settingUpdates));
      }

      const origTemplate = templates[setting.stage_name];
      const textChanged =
        singular !== (origTemplate?.singular ?? '') ||
        plural !== (origTemplate?.plural ?? '');
      if (textChanged) {
        promises.push(updateWhatsAppTemplate(eventId, setting.stage_name, singular, plural));
      }

      await Promise.all(promises);
    }

    // Always report what changed to parent
    const origTemplate = templates[setting.stage_name];
    const textChanged =
      singular !== (origTemplate?.singular ?? '') ||
      plural !== (origTemplate?.plural ?? '');

    onSaved({
      ...(isActive !== setting.is_active && { is_active: isActive }),
      ...(daysBefore !== setting.days_before && { days_before: daysBefore }),
      ...(textChanged && { singular, plural }),
    });
    onClose();
  } catch (err: unknown) {
    setError(err instanceof Error ? err.message : 'שגיאה בשמירה');
  } finally {
    setSaving(false);
  }
}, [setting, isActive, daysBefore, singular, plural, eventId, templates, onSaved, onClose]);
```

**Verify:** `npx tsc --noEmit` — no errors. Test: click "+" → modal opens → close without saving → no new row in `automation_settings`. Click "+" → edit → save → row created.

**Commit:** `feat(timeline): defer nudge creation until save, cancel discards draft`

---

### Task 5: Default template text for new nudges

**Files:**
- Modify: `src/components/dashboard/StageEditModal.tsx`

**What to do:**

When the modal opens for a dynamic nudge (`nudge_1`/`nudge_2`/`nudge_3`) and the template text is empty, auto-fill from the first nudge's (`nudge`) template.

1. Update the `useEffect` that syncs local state (lines 126–134). After the existing `setSingular`/`setPlural` lines, add a fallback:

```typescript
useEffect(() => {
  if (!setting) return;
  setIsActive(setting.is_active);
  setDaysBefore(setting.days_before);
  const t = templates[setting.stage_name];
  let s = t?.singular ?? '';
  let p = t?.plural ?? '';
  // For dynamic nudges with no template yet, inherit from the first nudge
  if (!s && !p && (setting.stage_name === 'nudge_1' || setting.stage_name === 'nudge_2' || setting.stage_name === 'nudge_3')) {
    const fallback = templates['nudge'];
    s = fallback?.singular ?? '';
    p = fallback?.plural ?? '';
  }
  setSingular(s);
  setPlural(p);
  setError('');
}, [setting, templates]);
```

**Verify:** `npx tsc --noEmit` — no errors. Test: add a new nudge → modal opens with the first nudge's template text pre-filled.

**Commit:** `feat(timeline): pre-fill new nudge template from first nudge defaults`

---

### Task 6: Clean up unused addingNudge state

**Files:**
- Modify: `src/pages/AutomationTimeline.tsx`

**What to do:**

After Task 4 changed `handleAddNudge` to synchronous, the `addingNudge` state and its setter are no longer needed.

1. Remove the `addingNudge` state declaration: `const [addingNudge, setAddingNudge] = useState(false);`
2. Remove any references to `addingNudge` in the JSX (e.g., in the `AddNudgeOverlay` disabled prop — change from `!canAddNudge || addingNudge` to just `!canAddNudge`).
3. Remove the loading spinner that was gated by `addingNudge` (the `{addingNudge && (...)}` block near the end of the component, around line ~1153).

**Verify:** `npx tsc --noEmit` — no errors. Search for `addingNudge` in the file — should find zero results.

**Commit:** `refactor(timeline): remove unused addingNudge state`
