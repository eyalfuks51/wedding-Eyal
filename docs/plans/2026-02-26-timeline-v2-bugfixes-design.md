# Timeline V2 — UI Bug Fixes

**Date:** 2026-02-26
**Status:** Approved

---

## Bug 1: Crooked Toggle Switches (RTL `translateX` conflict)

**Root cause:** The page is `dir="rtl"` but `translate-x-4` / `translate-x-5` Tailwind classes produce `transform: translateX(16px)` / `translateX(20px)` which move the knob to the right in LTR terms. In an RTL context the starting position is already right-aligned, so the knob overshoots or appears misaligned.

**Fix:** Wrap each `<button role="switch">` in a `<span dir="ltr">` (or set `dir="ltr"` directly on the button). This isolates the toggle from RTL layout so translateX behaves as designed. No class changes needed.

**Files:** `AutomationTimeline.tsx` (the `Toggle` component, line ~166), `StageEditModal.tsx` (its own `Toggle` component, line ~83).

---

## Bug 2: Horizontal Pipeline Clips at Edges

**Root cause:** The `inline-flex` inner container uses `px-8` for padding, but in an `overflow-x-auto` scroll container the trailing padding collapses — the browser doesn't reserve scroll space for padding-end on inline children. The first and last stage cards are visually clipped against the viewport edges.

**Fix:** Replace `px-8` on the inner `inline-flex` div with explicit spacer `<div>` elements at the start and end of the node list. Each spacer is `w-8 shrink-0` — they occupy real inline space that the scroll container respects. Additionally, ensure the inner flex container has no horizontal padding itself (switch `px-8` to `py-6` only).

**Files:** `AutomationTimeline.tsx` — the desktop pipeline `inline-flex` container (line ~912) and the `pipelineNodes.map` rendering block.

---

## Bug 3: Stage Cards Not Clickable on Desktop (Drag Swallows Click)

**Root cause:** `useDragScroll` captures pointer events on `pointerdown` and never distinguishes between a click (no movement) and a drag (lateral movement). Every `pointerdown` sets `isDragging = true`, which means `onPointerMove` fires and the scroll position changes even for zero-distance taps. The child `onClick` handlers on `StageColumn` cards still fire technically, but the UX feels broken because any minor movement during click triggers a scroll shift.

More critically, `setPointerCapture` redirects all subsequent pointer events to the scroll container, preventing the expected click propagation to child cards in some browsers.

**Fix:** Track the start position and only enter "dragging" mode after a minimum movement threshold (5px). On `pointerup`, if the threshold was never exceeded, treat it as a click (do not suppress child events). Only call `setPointerCapture` after the threshold is crossed.

Implementation:
- Add a `hasMoved` ref alongside the existing `startState` ref.
- In `onPointerDown`: record start position, set `hasMoved = false`, do NOT call `setPointerCapture` yet.
- In `onPointerMove`: check if `|dx| > 5`. If so, set `hasMoved = true` and call `setPointerCapture` (once). Only then apply scroll delta.
- In `onPointerUp`: if `hasMoved` was false, do nothing (let the click propagate normally). Reset state.
- Expose `hasMoved` from the hook so the parent can use `onClick` guards if needed (e.g., `if (drag.hasMoved) return` on card click handlers — belt-and-suspenders).

**Files:** `AutomationTimeline.tsx` — `useDragScroll` hook (line ~142), `StageColumn` onClick (line ~300).

---

## Out of Scope

- No design changes, no new features.
- Mobile layout is unaffected (no drag-to-scroll, no translateX toggle issue on mobile cards since they use a different visual pattern).
