# Timeline V2 Bug Fixes — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix three UI bugs in the Automation Timeline page: crooked toggle switches, pipeline edge clipping, and desktop click not working due to drag-to-scroll conflict.

**Architecture:** All fixes are in a single file (`AutomationTimeline.tsx`) plus one Toggle fix in `StageEditModal.tsx`. No new files, no new dependencies. Pure CSS/event-handling fixes.

**Tech Stack:** React, Tailwind CSS, pointer events API

**Design doc:** `docs/plans/2026-02-26-timeline-v2-bugfixes-design.md`

---

### Task 1: Fix Toggle Switch RTL alignment — `AutomationTimeline.tsx`

**Files:**
- Modify: `src/pages/AutomationTimeline.tsx:166-188`

**Context:** The `Toggle` component uses `translate-x-4` / `translate-x-5` to slide the knob. In an RTL page, `translateX` doesn't auto-flip, so the knob slides the wrong direction. Fix: add `dir="ltr"` on the `<button>` to isolate it from RTL layout.

**Step 1: Edit the Toggle component**

In `src/pages/AutomationTimeline.tsx`, find the `Toggle` function (line 166). Add `dir="ltr"` to the `<button>` element:

```tsx
function Toggle({ checked, onChange, size = 'sm' }: { checked: boolean; onChange: () => void; size?: 'sm' | 'lg' }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      dir="ltr"
      onClick={e => { e.stopPropagation(); onChange(); }}
      className={cn(
        'relative inline-flex shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200',
        checked ? 'bg-violet-600' : 'bg-slate-200',
        size === 'lg' ? 'h-6 w-11' : 'h-5 w-9',
      )}
    >
      <span className={cn(
        'pointer-events-none inline-block rounded-full bg-white shadow ring-0 transition-transform duration-200',
        size === 'lg' ? 'h-5 w-5' : 'h-4 w-4',
        checked
          ? (size === 'lg' ? 'translate-x-5' : 'translate-x-4')
          : 'translate-x-0',
      )} />
    </button>
  );
}
```

The only change is the addition of `dir="ltr"` on line 171 (the `<button>`).

**Step 2: Verify visually**

Run: `npm run dev`
Open `http://localhost:5173/dashboard/timeline` in browser.
Expected: Toggle knobs slide smoothly left-to-right when enabled, knob is properly aligned within the pill.

**Step 3: Commit**

```bash
git add src/pages/AutomationTimeline.tsx
git commit -m "fix(timeline): add dir=ltr to Toggle to fix RTL translateX alignment"
```

---

### Task 2: Fix Toggle Switch RTL alignment — `StageEditModal.tsx`

**Files:**
- Modify: `src/components/dashboard/StageEditModal.tsx:83-101`

**Context:** The `StageEditModal` has its own `Toggle` component with the same RTL issue. Apply the same `dir="ltr"` fix.

**Step 1: Edit the Toggle component**

In `src/components/dashboard/StageEditModal.tsx`, find the `Toggle` function (line 83). Add `dir="ltr"` to the `<button>` element:

```tsx
function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      dir="ltr"
      onClick={e => { e.stopPropagation(); onChange(); }}
      className={[
        'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200',
        checked ? 'bg-violet-600' : 'bg-slate-300',
      ].join(' ')}
    >
      <span className={[
        'pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform duration-200',
        checked ? 'translate-x-5' : 'translate-x-0',
      ].join(' ')} />
    </button>
  );
}
```

The only change is the addition of `dir="ltr"` on the `<button>`.

**Step 2: Verify visually**

Open the stage edit modal by clicking a stage card.
Expected: The toggle in the modal header slides correctly.

**Step 3: Commit**

```bash
git add src/components/dashboard/StageEditModal.tsx
git commit -m "fix(StageEditModal): add dir=ltr to Toggle for RTL compatibility"
```

---

### Task 3: Fix Pipeline Edge Clipping

**Files:**
- Modify: `src/pages/AutomationTimeline.tsx:912` (the inner `inline-flex` div)
- Modify: `src/pages/AutomationTimeline.tsx:913-935` (the pipelineNodes map block)

**Context:** The `px-8` padding on the `inline-flex` container doesn't reserve scroll space at the trailing edge in `overflow-x-auto`. Fix: remove `px-8`, add spacer `<div>`s at start and end of the node list.

**Step 1: Remove px-8, add spacers**

Change line 912 from:
```tsx
<div className="inline-flex items-start gap-0 py-6 px-8" style={{ direction: 'rtl' }}>
```
to:
```tsx
<div className="inline-flex items-start gap-0 py-6" style={{ direction: 'rtl' }}>
```

Then wrap the `pipelineNodes.map(...)` call with spacer divs:

```tsx
<div className="inline-flex items-start gap-0 py-6" style={{ direction: 'rtl' }}>
  {/* Leading spacer (right edge in RTL) */}
  <div className="w-8 shrink-0" aria-hidden="true" />

  {pipelineNodes.map((node, idx) => (
    <Fragment key={node.type === 'stage' ? node.setting.id : node.type === 'event' ? 'event' : 'add-nudge'}>
      {idx > 0 && <HorizontalConnector />}
      {node.type === 'event' && <EventDayColumn date={eventDate} />}
      {node.type === 'stage' && (
        <StageColumn
          setting={node.setting}
          stats={stats[node.setting.stage_name]}
          isFocus={focusId === `stage-${node.setting.stage_name}`}
          eventDate={eventDate}
          onToggle={handleToggle}
          onEdit={setEditSetting}
          onDrilldown={handleDrilldown}
        />
      )}
      {node.type === 'add-nudge' && (
        <AddNudgeColumn
          onClick={handleAddNudge}
          disabled={!canAddNudge || addingNudge}
        />
      )}
    </Fragment>
  ))}

  {/* Trailing spacer (left edge in RTL) */}
  <div className="w-8 shrink-0" aria-hidden="true" />
</div>
```

**Step 2: Verify visually**

Scroll the pipeline fully right and fully left.
Expected: First card ("שליחת ההזמנה") and last card ("הודעת מחכים לכם") have clear breathing room at both edges — no clipping.

**Step 3: Commit**

```bash
git add src/pages/AutomationTimeline.tsx
git commit -m "fix(timeline): replace px-8 with spacer divs to prevent edge clipping in RTL scroll"
```

---

### Task 4: Fix Drag-to-Scroll Swallowing Click Events

**Files:**
- Modify: `src/pages/AutomationTimeline.tsx:142-162` (the `useDragScroll` hook)

**Context:** `useDragScroll` calls `setPointerCapture` immediately on `pointerdown`, which swallows child click events. Fix: add a 5px movement threshold before entering drag mode and capturing the pointer. Expose `hasDragged` so card `onClick` can guard against it.

**Step 1: Rewrite the `useDragScroll` hook**

Replace lines 142-162 with:

```tsx
function useDragScroll(ref: React.RefObject<HTMLElement | null>) {
  const [isDragging, setIsDragging] = useState(false);
  const startState = useRef({ x: 0, scrollLeft: 0 });
  const hasDraggedRef = useRef(false);
  const pointerIdRef = useRef<number | null>(null);
  const isDownRef = useRef(false);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (!ref.current) return;
    isDownRef.current = true;
    hasDraggedRef.current = false;
    pointerIdRef.current = e.pointerId;
    startState.current = { x: e.clientX, scrollLeft: ref.current.scrollLeft };
    // Do NOT setPointerCapture yet — wait for threshold
  }, [ref]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDownRef.current || !ref.current) return;
    const dx = e.clientX - startState.current.x;

    // Threshold: only start dragging after 5px of movement
    if (!hasDraggedRef.current) {
      if (Math.abs(dx) < 5) return;
      hasDraggedRef.current = true;
      setIsDragging(true);
      // Capture pointer now that we know it's a drag
      if (pointerIdRef.current !== null) {
        try { ref.current.setPointerCapture(pointerIdRef.current); } catch { /* ignore */ }
      }
    }

    ref.current.scrollLeft = startState.current.scrollLeft - dx;
  }, [ref]);

  const onPointerUp = useCallback(() => {
    isDownRef.current = false;
    setIsDragging(false);
    pointerIdRef.current = null;
  }, []);

  return { onPointerDown, onPointerMove, onPointerUp, isDragging, hasDragged: hasDraggedRef };
}
```

Key changes:
- `isDownRef` tracks pointer-down state without triggering re-renders.
- `hasDraggedRef` stays `false` until 5px threshold is crossed.
- `setPointerCapture` is deferred until drag mode activates.
- `hasDragged` ref is exposed for click guards.

**Step 2: Add click guard to StageColumn's onEdit**

The `drag` return value in the main component (line 616) already destructures the hook. Now `drag.hasDragged` is available. Update the `StageColumn` `onEdit` prop at line 924:

```tsx
onEdit={(s) => { if (!drag.hasDragged.current) setEditSetting(s); }}
```

Also apply the same guard to `handleToggle` calls inside `StageColumn`. Since `StageColumn` receives `onEdit` and `onToggle` as props, and the Toggle already does `e.stopPropagation()`, we only need to guard `onEdit`. But to be safe, also guard the card `onClick` inside `StageColumn` itself.

To do this cleanly, pass `hasDragged` as a prop to `StageColumn`:

1. Add prop: `hasDragged: React.RefObject<boolean>` to `StageColumn`'s props interface.
2. Guard the card click at line 300:
   ```tsx
   onClick={() => { if (!hasDragged.current) onEdit(setting); }}
   ```
3. Pass it from the parent:
   ```tsx
   <StageColumn
     ...
     hasDragged={drag.hasDragged}
   />
   ```

**Step 3: Verify visually**

1. Click a stage card without moving the mouse → edit modal opens.
2. Click and drag horizontally → pipeline scrolls, no modal opens.
3. Click the toggle switch → toggles without opening modal.

**Step 4: Commit**

```bash
git add src/pages/AutomationTimeline.tsx
git commit -m "fix(timeline): add drag threshold to useDragScroll, prevent click swallowing"
```

---

### Task 5: Final visual verification and commit

**Step 1: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors.

**Step 2: Full visual QA**

Check all three fixes together:
- [ ] Toggles slide correctly in both Timeline page and StageEditModal
- [ ] Pipeline edges are not clipped — scroll to both ends
- [ ] Click on stage card opens modal on desktop
- [ ] Drag scrolls the pipeline without opening modal
- [ ] Mobile layout still works (vertical stack, card clicks open modal)

**Step 3: Commit if any final adjustments were needed**

```bash
git add -A
git commit -m "fix(timeline): final adjustments for v2 bugfixes"
```
