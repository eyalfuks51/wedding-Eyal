# Timeline UI Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign timeline stage cards — remove opacity fading, add time/message indicators, expand focus stage.

**Architecture:** All changes are in `AutomationTimeline.tsx` (hooks, helpers, components) and one new supabase query in `supabase.js`. No new components or files needed.

**Tech Stack:** React, TypeScript, Tailwind CSS, Supabase

---

### Task 1: Remove opacity fading system

**Files:**
- Modify: `src/pages/AutomationTimeline.tsx`

**What to do:**

1. Delete the entire `useScrollOpacity` hook function (lines ~211–270 — from `function useScrollOpacity(` to `return opacities; }`)
2. Remove the `cellOpacities` variable at line ~731: `const cellOpacities = useScrollOpacity(scrollRef, drag.isDragging);`
3. In the desktop pipeline rendering (lines ~1030-1085), remove all opacity logic:
   - Remove the `const opacity = cellOpacities[realIdx] ?? 1;` line
   - Remove the `style={{ opacity }}` from the `data-pipeline-cell` div
   - Remove `transition-opacity duration-300` from the className of that div
   - Keep `data-pipeline-cell` (still needed for snap-to-center)
4. Remove the `const realNodes = pipelineNodes.filter(...)` line and the `let cellIdx = 0` counter — simplify the rendering by using the `idx` from `.map()` directly for `isFirst`/`isLast` (count only non-add-nudge nodes).

**Verify:** Run `npx tsc --noEmit` — no errors.

**Commit:** `refactor(timeline): remove scroll-based opacity fading`

---

### Task 2: Add relative time helper and update date formatting

**Files:**
- Modify: `src/pages/AutomationTimeline.tsx`

**What to do:**

1. Update `computeStageDate` to return additional fields. Replace the existing function with:

```typescript
function computeStageDate(
  eventDate: Date | null,
  daysBefore: number,
): { dateStr: string; weekday: string; shortDate: string; shortDay: string } | null {
  if (!eventDate) return null;
  const d = new Date(eventDate);
  d.setDate(d.getDate() - daysBefore);
  return {
    dateStr: d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    weekday: d.toLocaleDateString('he-IL', { weekday: 'short' }),
    shortDate: d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' }),
    shortDay: d.toLocaleDateString('he-IL', { weekday: 'short' }),
  };
}
```

2. Add a new helper function after `computeStageDate`:

```typescript
function computeRelativeTime(eventDate: Date | null, daysBefore: number): string | null {
  if (!eventDate) return null;
  const stageDate = new Date(eventDate);
  stageDate.setDate(stageDate.getDate() - daysBefore);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  stageDate.setHours(0, 0, 0, 0);
  const diffMs = stageDate.getTime() - today.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'היום';
  if (diffDays === 1) return 'מחר';
  if (diffDays === -1) return 'אתמול';
  if (diffDays > 0) return `עוד ${diffDays} ימים`;
  return `לפני ${Math.abs(diffDays)} ימים`;
}
```

**Verify:** Run `npx tsc --noEmit` — no errors.

**Commit:** `feat(timeline): add relative time helper and enhanced date formatting`

---

### Task 3: Add target audience count query

**Files:**
- Modify: `src/lib/supabase.js`
- Modify: `src/pages/AutomationTimeline.tsx`

**What to do:**

1. In `supabase.js`, add a new exported function after `fetchMessageStatsPerStage`:

```javascript
/** Count automated invitations grouped by rsvp_status for an event */
export const fetchAutomatedAudienceCounts = async (eventId) => {
  if (!supabase) throw new Error('Supabase is not configured');
  const { data, error } = await supabase
    .from('invitations')
    .select('rsvp_status')
    .eq('event_id', eventId)
    .eq('is_automated', true);
  if (error) throw error;

  const counts = { pending: 0, attending: 0 };
  for (const row of data ?? []) {
    if (row.rsvp_status === 'pending') counts.pending++;
    else if (row.rsvp_status === 'attending') counts.attending++;
  }
  return counts;
};
```

2. In `AutomationTimeline.tsx`:
   - Add `fetchAutomatedAudienceCounts` to the import from `'../lib/supabase'`
   - Add state: `const [audienceCounts, setAudienceCounts] = useState<{ pending: number; attending: number }>({ pending: 0, attending: 0 });`
   - In `loadData`, add it to the `Promise.all`:

```typescript
const loadData = useCallback(async (eventId: string) => {
  const [settingsData, statsData, audienceData] = await Promise.all([
    fetchAutomationSettings(eventId),
    fetchMessageStatsPerStage(eventId),
    fetchAutomatedAudienceCounts(eventId),
  ]);
  setSettings(settingsData as AutomationSettingRow[]);
  setStats(statsData as Record<string, StageStats>);
  setAudienceCounts(audienceData as { pending: number; attending: number });
}, []);
```

**Verify:** Run `npx tsc --noEmit` — no errors.

**Commit:** `feat(timeline): add target audience count query`

---

### Task 4: Redesign StageColumn with time indicators, message count, and focus expansion

**Files:**
- Modify: `src/pages/AutomationTimeline.tsx`

**What to do:**

This is the main visual change. Update `StageColumn` to accept new props and render the new design.

1. Update `StageColumn` props to include `audienceCounts`:

```typescript
function StageColumn({
  setting,
  stats,
  isFocus,
  eventDate,
  audienceCounts,
  onToggle,
  onEdit,
  onDrilldown,
  hasDragged,
  isFirst,
  isLast,
}: {
  setting: AutomationSettingRow;
  stats?: StageStats;
  isFocus: boolean;
  eventDate: Date | null;
  audienceCounts: { pending: number; attending: number };
  onToggle: (id: string, current: boolean) => void;
  onEdit: (setting: AutomationSettingRow) => void;
  onDrilldown: (stage: StageName, filter: DrilldownFilter) => void;
  hasDragged: React.RefObject<boolean>;
  isFirst: boolean;
  isLast: boolean;
}) {
```

2. Add computed values inside the function body (after existing meta/status/dateInfo):

```typescript
const relativeTime = computeRelativeTime(eventDate, setting.days_before);
```

3. Build a single-line message stat based on status:

```typescript
const msgStatLine = (() => {
  if (!stats || (stats.sent === 0 && stats.pending === 0 && stats.failed === 0)) {
    // No messages yet — show target audience count for scheduled stages
    if (status === 'scheduled') {
      const targetCount = setting.target_status === 'attending'
        ? audienceCounts.attending
        : audienceCounts.pending;
      return targetCount > 0 ? `~${targetCount} מטורגטים` : null;
    }
    return null;
  }
  if (status === 'sent') return `${stats.sent} נשלחו`;
  if (status === 'active') return `${stats.sent}/${stats.sent + stats.pending} נשלחו`;
  if (status === 'scheduled') {
    const targetCount = setting.target_status === 'attending'
      ? audienceCounts.attending
      : audienceCounts.pending;
    return targetCount > 0 ? `~${targetCount} מטורגטים` : null;
  }
  return null;
})();
```

4. Replace the card div with the new design. The card width changes based on `isFocus`:

```tsx
return (
  <div className="flex flex-col items-center w-full">
    {/* Card */}
    <div
      className={cn(
        'rounded-2xl border p-4 transition-all cursor-pointer',
        'hover:shadow-md hover:border-violet-200',
        isFocus ? 'w-52 border-2 border-violet-400 shadow-lg ring-4 ring-violet-50' : 'w-44',
        !isFocus && STATUS_CARD_CLASSES[status],
        isFocus && (status === 'disabled' ? 'bg-slate-50 opacity-60' : 'bg-white'),
      )}
      onClick={() => { if (!hasDragged.current) onEdit(setting); }}
    >
      {/* Status pill + toggle */}
      <div className="flex items-center justify-between mb-2">
        <StatusPill status={status} />
        <Toggle checked={setting.is_active} onChange={() => onToggle(setting.id, setting.is_active)} />
      </div>
      {/* Target audience */}
      <p className="text-[11px] text-slate-500 font-brand leading-snug">
        {setting.target_status === 'attending' ? 'למגיעים בלבד' : 'למי שטרם אישרו הגעה'}
      </p>
      {/* Message stat line */}
      {msgStatLine && (
        <p className={cn(
          'text-xs font-brand font-medium mt-1.5',
          status === 'sent' ? 'text-emerald-600' :
          status === 'active' ? 'text-violet-600' :
          'text-slate-500',
        )}>
          {msgStatLine}
        </p>
      )}
    </div>

    {/* Vertical line → full-width icon row → vertical line */}
    <div className="w-px h-4 bg-slate-200" />
    <div className="w-full flex items-center">
      <div className={cn('flex-1 h-px', !isFirst ? 'bg-slate-200' : '')} />
      <div className={cn(
        'w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors shrink-0',
        setting.is_active
          ? 'bg-violet-600 border-violet-600 text-white'
          : 'bg-white border-slate-300 text-slate-400',
      )}>
        {getStageIcon(setting.stage_name, 'lg')}
      </div>
      <div className={cn('flex-1 h-px', !isLast ? 'bg-slate-200' : '')} />
    </div>
    <div className="w-px h-3 bg-slate-200" />

    {/* Label */}
    <p className="text-xs font-medium text-slate-700 font-brand text-center mt-1 leading-tight">
      {meta.label}
    </p>
    {/* Time: relative */}
    {relativeTime && (
      <p className="text-[11px] text-slate-600 font-brand text-center mt-0.5 font-medium">
        {relativeTime}
      </p>
    )}
    {/* Time: absolute (short day + short date) */}
    {dateInfo && (
      <p className="text-[10px] text-slate-400 font-brand text-center mt-0.5">
        {dateInfo.shortDay} {dateInfo.shortDate}
      </p>
    )}
  </div>
);
```

5. Update the `StageColumn` call site in the desktop pipeline rendering to pass `audienceCounts`:

```tsx
<StageColumn
  setting={node.setting}
  stats={stats[node.setting.stage_name]}
  isFocus={focusId === `stage-${node.setting.stage_name}`}
  eventDate={eventDate}
  audienceCounts={audienceCounts}
  onToggle={handleToggle}
  onEdit={setEditSetting}
  onDrilldown={handleDrilldown}
  hasDragged={drag.hasDragged}
  isFirst={isFirst}
  isLast={isLast}
/>
```

**Verify:** Run `npx tsc --noEmit` — no errors.

**Commit:** `feat(timeline): redesign stage cards with time indicators, msg counts, and focus expansion`

---

### Task 5: Update EventDayColumn date format

**Files:**
- Modify: `src/pages/AutomationTimeline.tsx`

**What to do:**

Update the `EventDayColumn` to show the date in the new minimalist format.

Replace the date label computation and the bottom date display:

```typescript
function EventDayColumn({ date, isFirst, isLast }: { date: Date | null; isFirst: boolean; isLast: boolean }) {
  const dateLabel = date
    ? date.toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;
  const shortLabel = date
    ? `${date.toLocaleDateString('he-IL', { weekday: 'short' })} ${date.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' })}`
    : null;
```

For the bottom date section, replace:
```tsx
{date && (
  <p className="text-[11px] text-slate-400 font-brand text-center mt-0.5">
    {date.toLocaleDateString('he-IL', { weekday: 'short' })}{' '}
    {date.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' })}
  </p>
)}
```

With:
```tsx
{shortLabel && (
  <p className="text-[11px] text-violet-500 font-brand text-center mt-0.5">
    {shortLabel}
  </p>
)}
```

**Verify:** Run `npx tsc --noEmit` — no errors.

**Commit:** `feat(timeline): update event day column date format`

---

### Task 6: Update mobile cards with time indicators and message counts

**Files:**
- Modify: `src/pages/AutomationTimeline.tsx`

**What to do:**

1. Update `MobileStageCard` to accept `audienceCounts` prop and add it to the type signature.

2. Add relative time and msgStatLine computation (same logic as desktop StageColumn).

3. In the mobile card date row, replace the current date display with relative time + short date:

Replace:
```tsx
{dateInfo && (
  <span className="inline-flex items-center text-xs text-slate-500 font-brand">
    {dateInfo.weekday} {dateInfo.dateStr}
  </span>
)}
```

With:
```tsx
{relativeTime && (
  <span className="inline-flex items-center text-xs text-slate-600 font-brand font-medium">
    {relativeTime}
  </span>
)}
{dateInfo && (
  <span className="inline-flex items-center text-[11px] text-slate-400 font-brand">
    {dateInfo.shortDay} {dateInfo.shortDate}
  </span>
)}
```

4. Replace the `StatsMini` component call with the single-line message stat:

Replace:
```tsx
<StatsMini
  stats={stats}
  onDrilldown={(filter) => onDrilldown(setting.stage_name, filter)}
/>
```

With:
```tsx
{msgStatLine && (
  <p className={cn(
    'text-xs font-brand font-medium mt-1.5',
    status === 'sent' ? 'text-emerald-600' :
    status === 'active' ? 'text-violet-600' :
    'text-slate-500',
  )}>
    {msgStatLine}
  </p>
)}
```

5. Update mobile `MobileStageCard` call sites to pass `audienceCounts`.

**Verify:** Run `npx tsc --noEmit` — no errors.

**Commit:** `feat(timeline): update mobile cards with time indicators and message counts`

---

### Task 7: Clean up unused code

**Files:**
- Modify: `src/pages/AutomationTimeline.tsx`

**What to do:**

1. Check if `StatsMini` component is still used anywhere. If it's no longer used in desktop or mobile, remove it entirely.
2. Remove any now-unused imports or variables.
3. Verify the `AddNudgeOverlay` `top` position is still correct after card height changes (focus cards are slightly taller due to the msgStatLine). Adjust `style={{ top: '...' }}` if needed. The calculation: card (~96-108px) + vertical line (16px) + half icon (20px) = approximately 120-140px from top. Test visually.

**Verify:** Run `npx tsc --noEmit` — no errors. Visual inspection on `http://localhost:5173/dashboard/timeline`.

**Commit:** `refactor(timeline): clean up unused StatsMini and dead code`
