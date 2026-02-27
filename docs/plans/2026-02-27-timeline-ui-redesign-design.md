# Timeline UI Redesign — Design Document

**Date:** 2026-02-27
**Status:** Approved

## Goal

Redesign the Automation Timeline stage cards to remove opacity fading, add time indicators, add message count indicators, and visually expand the focused/active stage.

## Design Decisions

### 1. Remove Opacity Fading

All pipeline stages rendered at **100% opacity**. The `useScrollOpacity` hook and all opacity-related logic will be removed entirely. Stage differentiation is achieved through size, border, and shadow — not transparency.

### 2. Time Display (Two Lines Per Stage)

Every stage card shows two lines of time info:

- **Primary (bold, slate-700):** Relative time — `עוד 5 ימים` / `לפני 3 ימים` / `היום`
- **Secondary (text-xs, slate-400):** Absolute date — `ג׳ 16/03` (abbreviated day + date, no dot separator)

**Event Day column:** Shows absolute date only — `שבת 21/03`

The relative time is computed from `today` vs. the computed stage date (`eventDate - days_before`).

### 3. Message Count Indicator (Single Number Per Stage)

Each stage card shows a single contextual stat line:

| Stage Status | Display | Data Source |
|---|---|---|
| `sent` (completed) | `150 נשלחו` | `message_logs` WHERE status='sent' |
| `active` (in progress) | `85/150 נשלחו` | sent count / total queued (sent+pending+processing) |
| `scheduled` (upcoming) | `~120 מטורגטים` | `invitations` WHERE is_automated=true AND rsvp_status matches target_status |
| `disabled` | *(hidden)* | — |

### 4. Focus Stage — Visual Expansion

The active/nearest upcoming stage gets expanded treatment:

- **Width:** `w-56` (vs. `w-44` for regular stages)
- **Border:** `border-2 border-violet-400` with `ring-4 ring-violet-100`
- **Shadow:** `shadow-lg` (vs. `shadow-sm` for regular)
- **Extra data line** (if active/scheduled):
  - In progress: sent/queued breakdown (already covered by stat line)
  - Upcoming: targeted audience count

### 5. Regular (Non-Focus) Stages

- Width: `w-44`
- Standard border and shadow
- Single message count number
- Two time lines (relative + absolute)

## Data Layer Changes

### Existing: `fetchMessageStatsPerStage`
Currently returns per-stage counts. Need to verify it provides `sent`, `pending`, `failed` breakdown (not just totals).

### New: Target audience count
New query needed: count `invitations` where `is_automated = true` AND `rsvp_status` matches the stage's `target_status`. This is only needed for the focus stage when status is `scheduled`.

## Architecture Notes

- **Focus stage determination:** The "focus" stage is the first `active` stage, or if none, the first `scheduled` stage (nearest upcoming). This reuses the existing smart-focus logic.
- **Cell width:** Focus stage gets a wider cell (`w-[24%]` or similar) while others adjust. Alternatively, the card itself can be wider within the same `w-[20%]` cell by overflowing slightly.
- **No new components needed:** Changes are within `StageColumn` (conditional widths/styles) and the data layer.
