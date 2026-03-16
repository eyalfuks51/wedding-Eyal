# Timeline V2: Auto-Pilot Pipeline — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the current vertical-only Timeline with a rich, horizontal RTL pipeline for desktop (vertical on mobile), featuring an Auto-Pilot master toggle, liquid-glass edit modals, computed dates, dynamic nudge insertion, and smart-focus snapping on load.

**Visual Reference:** `C:\dev\screenshots\screenshot_260226_161342.png` — an RTL horizontal pipeline with status badges, icons below cards, dates at the bottom, and a "טייס אוטומטי" header.

---

## Design Decisions

### D1: Snapping — "Clamped Right-Third Focus"

**Problem:** If the active stage is the first or last node, centering it wastes screen real estate with empty space on one side.

**Solution:** Position the focus node at **~35% from the right edge** (the RTL reading start), then **clamp** scroll to `[0, maxScroll]`. Clamping naturally eliminates empty space:

```
Case: Active = Nudge (middle of funnel)
Pipeline:  [HNG] [LGS] [◆] [ULT] [NDG*] [ICE]     ← RTL order
Viewport:              |<--- visible area --->|
                             ↑ focus at ~35% from right

Case: Active = Icebreaker (rightmost node)
Pipeline:  [HNG] [LGS] [◆] [ULT] [NDG] [ICE*]
Viewport:                          |<-- vis -->|   ← scroll clamped to 0

Case: Active = Hangover (leftmost node)
Pipeline:  [HNG*] [LGS] [◆] [ULT] [NDG] [ICE]
Viewport:  |<-- vis -->|                           ← scroll clamped to max

Case: All stages complete
Pipeline:  [HNG] [LGS] [◆*] [ULT] [NDG] [ICE]
Viewport:         |<--- visible area --->|         ← focus on Event Day
```

**"Focus stage" definition:** The first stage (chronologically, i.e. highest `days_before`) where `is_active=true` AND (`pending > 0` in stats OR no messages sent yet). If ALL stages are complete, focus on the Event Day anchor.

**Algorithm (runs once after data loads):**
```ts
const container = scrollRef.current;
const focusEl   = document.getElementById(`stage-${focusId}`);
if (!container || !focusEl || container.scrollWidth <= container.clientWidth) return; // fits, no scroll

const cRect = container.getBoundingClientRect();
const fRect = focusEl.getBoundingClientRect();
const focusCenterFromRight = cRect.right - (fRect.left + fRect.width / 2);
const targetFromRight      = cRect.width * 0.35;
const delta = targetFromRight - focusCenterFromRight;

// scrollBy is direction-consistent with the current scrollLeft
container.scrollBy({ left: -delta, behavior: 'smooth' });
```

### D2: Auto-Pilot Master Toggle — Soft Pause

Stored in `events.automation_config.auto_pilot` (boolean, default `true`). A new `SECURITY DEFINER` RPC toggles it atomically via `jsonb_set`. The scheduler checks this flag before processing. Already-queued `pending` messages still send — only *new* stage evaluations are paused.

### D3: Dynamic Nudges — Naming & Rules

| Convention | Example | Max |
|---|---|---|
| Original nudge | `nudge` | 1 (always exists) |
| Dynamic nudges | `nudge_1`, `nudge_2`, `nudge_3` | 3 additional |

**Rules:**
- Dynamic nudges inherit `target_status = 'pending'` (same as the original nudge).
- Each gets a distinct entry in `whatsapp_templates` (admin must edit text; not a clone).
- **Insertion zone:** Only between icebreaker and ultimatum (`days_before` must be > ultimatum's `days_before` and < icebreaker's).
- **Deletion:** Only allowed if `SELECT count(*) FROM message_logs WHERE event_id = X AND message_type = 'nudge_N'` returns 0. Enforced server-side via RPC.
- The `automation-engine`'s `pickTemplate(config, stageName, pax)` already resolves `stageName` dynamically from `automation_settings` rows — no engine changes needed.

### D4: Toggle Placement

**Keep the toggle on the card** as a small switch in the top-right corner. Toggling is visually immediate (optimistic update) and doesn't require opening a modal. The modal handles deeper edits: timing, template text, and displays the toggle redundantly for completeness. If the user disables a stage from inside the modal, it also updates the card's toggle on close.

### D5: Stage Card Design (Desktop Horizontal)

Each node is a vertical column rendered in the horizontal scroll container:

```
┌─────────────────────┐
│ [status] ... [toggle]│  ← top: status pill (נשלח/בתהליך/ממתין/כבוי) + toggle
│                     │
│  Stage subtitle     │  ← "למי שטרם אישרו הגעה"
│                     │
│  [stats row]        │  ← clickable stats: 150 ▶ 85% ✎
└─────────────────────┘
        │
     (● icon)             ← icon circle sitting on the connecting line
        │
   Stage name             ← Hebrew label in font-brand
  יום ב׳ 25/10/2023      ← computed date + weekday from event_date - days_before
```

**Status determination per stage:**
- `is_active=false` → **כבוי** (grey, `opacity-60`)
- `is_active=true` AND `stats.sent > 0` AND `stats.pending === 0` → **נשלח** (completed, emerald)
- `is_active=true` AND `stats.pending > 0` → **בתהליך** (in progress, violet, this is the focus node)
- `is_active=true` AND no stats → **מתוזמן** (scheduled, amber/slate)

---

## Task List

### Task 1: Database Migration — Dynamic Nudges + Auto-Pilot RPC

**File:** `supabase/migrations/20260226200000_dynamic_nudges_and_autopilot.sql`

```sql
-- ═══════════════════════════════════════════════════════════════════════
-- 1. Allow anon INSERT on automation_settings (for adding dynamic nudges)
--    WITH CHECK enforces the allowed stage_name whitelist server-side.
-- ═══════════════════════════════════════════════════════════════════════

CREATE POLICY "Allow anon insert automation_settings"
  ON automation_settings FOR INSERT TO anon
  WITH CHECK (
    stage_name IN (
      'icebreaker', 'nudge', 'nudge_1', 'nudge_2', 'nudge_3',
      'ultimatum', 'logistics', 'hangover'
    )
  );

-- ═══════════════════════════════════════════════════════════════════════
-- 2. Secure RPC: delete a dynamic nudge ONLY if no messages exist
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION delete_dynamic_nudge(p_setting_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stage    text;
  v_event_id uuid;
  v_log_count bigint;
BEGIN
  SELECT stage_name, event_id INTO v_stage, v_event_id
  FROM automation_settings WHERE id = p_setting_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Setting not found: %', p_setting_id;
  END IF;

  -- Only dynamic nudges (nudge_1, nudge_2, nudge_3) can be deleted
  IF v_stage NOT LIKE 'nudge_%' THEN
    RAISE EXCEPTION 'Cannot delete canonical stage: %', v_stage;
  END IF;

  -- Guard: block deletion if any messages were ever queued
  SELECT count(*) INTO v_log_count
  FROM message_logs
  WHERE event_id = v_event_id AND message_type = v_stage;

  IF v_log_count > 0 THEN
    RAISE EXCEPTION 'Cannot delete: % messages already exist for stage %', v_log_count, v_stage;
  END IF;

  DELETE FROM automation_settings WHERE id = p_setting_id;

  -- Also clean up the whatsapp_templates key if it exists
  UPDATE events
  SET content_config = content_config #- ARRAY['whatsapp_templates', v_stage]
  WHERE id = v_event_id
    AND content_config -> 'whatsapp_templates' ? v_stage;
END;
$$;

GRANT EXECUTE ON FUNCTION delete_dynamic_nudge(uuid) TO anon;

-- ═══════════════════════════════════════════════════════════════════════
-- 3. Secure RPC: toggle Auto-Pilot flag in automation_config
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION toggle_auto_pilot(p_event_id uuid, p_enabled boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE events
  SET automation_config = jsonb_set(
    COALESCE(automation_config, '{}'::jsonb),
    '{auto_pilot}',
    to_jsonb(p_enabled)
  )
  WHERE id = p_event_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event not found: %', p_event_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION toggle_auto_pilot(uuid, boolean) TO anon;

-- ═══════════════════════════════════════════════════════════════════════
-- 4. Extend update_whatsapp_template whitelist to include dynamic nudges
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION update_whatsapp_template(
  p_event_id   uuid,
  p_stage_name text,
  p_singular   text,
  p_plural     text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_allowed_stages text[] := ARRAY[
    'icebreaker', 'nudge', 'nudge_1', 'nudge_2', 'nudge_3',
    'ultimatum', 'logistics', 'hangover'
  ];
BEGIN
  IF p_stage_name != ALL(v_allowed_stages) THEN
    RAISE EXCEPTION 'Invalid stage_name: %', p_stage_name;
  END IF;

  UPDATE events
  SET content_config = jsonb_set(
    CASE
      WHEN content_config -> 'whatsapp_templates' IS NULL
      THEN jsonb_set(COALESCE(content_config, '{}'::jsonb), '{whatsapp_templates}', '{}'::jsonb)
      ELSE content_config
    END,
    ARRAY['whatsapp_templates', p_stage_name],
    jsonb_build_object('singular', p_singular, 'plural', p_plural),
    true
  )
  WHERE id = p_event_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event not found: %', p_event_id;
  END IF;
END;
$$;
```

**Step 2: Apply and verify** — Run via Supabase SQL editor.

**Step 3: Commit**
```bash
git add supabase/migrations/20260226200000_dynamic_nudges_and_autopilot.sql
git commit -m "feat(db): dynamic nudges RLS + delete RPC + auto-pilot toggle + extended whitelist"
```

---

### Task 2: Constants + Supabase Helpers

**Files:**
- Modify: `src/components/dashboard/constants.ts`
- Modify: `src/lib/supabase.js`

**Step 1: Extend constants**

The `StageName` type must accommodate dynamic nudges. Introduce `DYNAMIC_NUDGE_NAMES` and a `getStageIcon` / `getStageLabel` function for runtime lookup (since dynamic nudges share nudge's icon/targetStatus):

```ts
export const CANONICAL_STAGES = [
  'icebreaker', 'nudge', 'ultimatum', 'logistics', 'hangover',
] as const;

export const DYNAMIC_NUDGE_NAMES = ['nudge_1', 'nudge_2', 'nudge_3'] as const;

export const ALL_STAGE_NAMES = [...CANONICAL_STAGES, ...DYNAMIC_NUDGE_NAMES] as const;

export type StageName = (typeof ALL_STAGE_NAMES)[number];

// STAGE_META keeps entries for all 8 names.
// Dynamic nudges share nudge's icon and targetStatus.
export const STAGE_META: Record<StageName, {
  label: string;
  targetStatus: string;
  defaultDaysBefore: number;
  icon: string;
}> = {
  icebreaker: { label: 'שליחת ההזמנה',      targetStatus: 'pending',   defaultDaysBefore: 14, icon: 'Sparkles'      },
  nudge:      { label: 'תזכורת ראשונה',     targetStatus: 'pending',   defaultDaysBefore: 7,  icon: 'Bell'          },
  nudge_1:    { label: 'תזכורת עדינה 2',    targetStatus: 'pending',   defaultDaysBefore: 5,  icon: 'Bell'          },
  nudge_2:    { label: 'תזכורת עדינה 3',    targetStatus: 'pending',   defaultDaysBefore: 4,  icon: 'Bell'          },
  nudge_3:    { label: 'תזכורת עדינה 4',    targetStatus: 'pending',   defaultDaysBefore: 3,  icon: 'Bell'          },
  ultimatum:  { label: 'בקשת אישור סופית',  targetStatus: 'pending',   defaultDaysBefore: 3,  icon: 'AlertTriangle' },
  logistics:  { label: 'הודעת "מחכים לכם"', targetStatus: 'attending', defaultDaysBefore: 1,  icon: 'MapPin'        },
  hangover:   { label: 'תודה לאחר האירוע',  targetStatus: 'attending', defaultDaysBefore: -1, icon: 'Heart'         },
};
```

Keep `TEMPLATE_LABELS` and `MSG_STATUS_MAP` unchanged — `TEMPLATE_LABELS` is now derived from the extended `STAGE_META`.

**Step 2: Add Supabase helpers**

```js
/** Toggle the event-level Auto-Pilot flag via RPC */
export const toggleAutoPilot = async (eventId, enabled) => {
  if (!supabase) throw new Error('Supabase is not configured');
  const { error } = await supabase.rpc('toggle_auto_pilot', {
    p_event_id: eventId,
    p_enabled:  enabled,
  });
  if (error) throw error;
};

/** Insert a new dynamic nudge stage */
export const addDynamicNudge = async (eventId, stageName, daysBefore) => {
  if (!supabase) throw new Error('Supabase is not configured');
  const { data, error } = await supabase
    .from('automation_settings')
    .insert({ event_id: eventId, stage_name: stageName, days_before: daysBefore, target_status: 'pending', is_active: true })
    .select()
    .single();
  if (error) throw error;
  return data;
};

/** Delete a dynamic nudge via the guarded RPC (fails if messages exist) */
export const deleteDynamicNudge = async (settingId) => {
  if (!supabase) throw new Error('Supabase is not configured');
  const { error } = await supabase.rpc('delete_dynamic_nudge', {
    p_setting_id: settingId,
  });
  if (error) throw error;
};
```

**Step 3: Commit**
```bash
git add src/components/dashboard/constants.ts src/lib/supabase.js
git commit -m "feat: extend constants for dynamic nudges + add autopilot/nudge supabase helpers"
```

---

### Task 3: StageEditModal (Liquid Glass)

**File:** `src/components/dashboard/StageEditModal.tsx`

**Why:** Replaces `TemplateEditorSheet` as the primary editing surface. Uses the project's `GlassCard` aesthetic with a centered modal overlay. Handles: toggle, timing (days_before → computed date preview), template text (singular/plural).

**Props:**
```tsx
interface StageEditModalProps {
  setting: AutomationSettingRow | null;   // null = closed
  templates: WhatsAppTemplates;
  eventId: string;
  eventDate: Date | null;
  isDynamicNudge: boolean;                // true for nudge_1/2/3 — shows delete button
  canDelete: boolean;                     // false if message_logs exist
  onClose: () => void;
  onSaved: (updates: { is_active?: boolean; days_before?: number; singular?: string; plural?: string }) => void;
  onDelete: () => void;
}
```

**Layout (centered modal with glassmorphism backdrop):**

```
[backdrop: fixed inset-0 bg-black/30 backdrop-blur-sm z-50]

  [GlassCard: max-w-lg mx-auto mt-[15vh] rounded-3xl]
    ┌─────────────────────────────────────────────┐
    │ Header: [icon] Stage Label         [toggle] │
    │         Computed date preview                │
    ├─────────────────────────────────────────────┤
    │ Section: Timing                              │
    │ [number input: days_before]                  │
    │ Preview: "יום ב׳ 25 באוקטובר 2023"          │
    ├─────────────────────────────────────────────┤
    │ Section: Template Text                       │
    │ Variable hints: {{name}} · {{link}} · ...    │
    │ [textarea: singular]                         │
    │ [textarea: plural]                           │
    ├─────────────────────────────────────────────┤
    │ Footer: [🗑 מחק] (if dynamic)    [שמור]     │
    └─────────────────────────────────────────────┘
```

**Key behaviors:**
- **Date preview:** Whenever `days_before` changes, immediately recompute and display the exact date: `eventDate - days_before` formatted as `dayOfWeek DD/MM/YYYY`.
- **Save:** Batches all changes into one save operation. Calls `updateAutomationSetting` for toggle/timing, then `updateWhatsAppTemplate` for text. `onSaved` callback notifies the parent to update local state.
- **Delete button:** Only visible for dynamic nudges (`nudge_1/2/3`). Disabled with tooltip "לא ניתן למחוק — הודעות כבר בתור" if `canDelete=false`. Calls `deleteDynamicNudge` RPC.
- **Glassmorphism:** Use `GlassCard` as the modal container. The outer overlay uses `bg-black/30 backdrop-blur-sm`. Close on overlay click or Escape.

**Step: Commit**
```bash
git add src/components/dashboard/StageEditModal.tsx
git commit -m "feat(timeline): liquid glass StageEditModal with timing, templates, and dynamic nudge delete"
```

---

### Task 4: AutomationTimeline — Full Rewrite

**File:** `src/pages/AutomationTimeline.tsx`

This is the largest task. It replaces the entire current page. The layout is responsive:
- **Mobile (`< lg`):** Vertical card stack (similar to current, but with new card design and modals)
- **Desktop (`lg:` and up):** Horizontal RTL scrollable pipeline with drag-to-scroll and smart focus

**Step 1: Auto-Pilot Header**

Above the `DashboardNav` tabs, add:

```tsx
<div className="flex items-center justify-between gap-4 mb-2">
  <div>
    <h2 className="font-danidin text-xl text-slate-800">טייס אוטומטי</h2>
    <p className="text-sm text-slate-500 font-brand">
      מסע ההודעות האוטומטי לאורחים שלך עד יום החתונה
    </p>
  </div>
  <div className="flex items-center gap-3">
    <span className={cn(
      'text-xs font-brand font-medium px-2.5 py-1 rounded-full',
      autoPilot ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500',
    )}>
      {autoPilot ? 'פעיל' : 'מושבת'}
    </span>
    <Toggle checked={autoPilot} onChange={handleAutoPilotToggle} />
  </div>
</div>
```

The `autoPilot` state is read from `event.automation_config?.auto_pilot ?? true` and toggled via the `toggleAutoPilot` RPC.

**Step 2: Desktop Horizontal Pipeline (`lg:` and up)**

The overall structure:

```tsx
{/* Desktop only: horizontal scroll container */}
<div className="hidden lg:block">
  <div
    ref={scrollRef}
    className="overflow-x-auto overflow-y-hidden scrollbar-hide cursor-grab active:cursor-grabbing"
    style={{ scrollBehavior: 'auto' }}
    dir="rtl"
    {/* pointer events for drag-to-scroll — see Step 4 */}
  >
    <div className="inline-flex items-start gap-0 py-6 px-8" style={{ direction: 'rtl' }}>
      {/* Nodes rendered right-to-left: icebreaker first (rightmost) */}
      {allNodes.map((node, idx) => (
        <Fragment key={node.key}>
          {/* Connector line between nodes (not before the first) */}
          {idx > 0 && <HorizontalConnector />}
          {node.type === 'event'
            ? <EventDayColumn date={eventDate} />
            : <StageColumn setting={node.setting} stats={...} onEdit={...} onDrilldown={...} />
          }
        </Fragment>
      ))}
    </div>
  </div>
</div>
```

**`StageColumn` (desktop node):**

A vertical flex column `w-48` (fixed width so nodes don't collapse):

```
<div className="flex flex-col items-center w-48">
  {/* Card */}
  <div className={cn(
    'w-full rounded-2xl border p-4 transition-all cursor-pointer',
    'hover:shadow-md hover:border-violet-200',
    isFocus && 'ring-2 ring-violet-400 ring-offset-2 scale-105',
    statusStyles[stageStatus],
  )} onClick={openEditModal}>
    {/* Status pill + toggle */}
    <div className="flex items-center justify-between mb-2">
      <StatusPill status={stageStatus} />
      <Toggle ... />
    </div>
    {/* Subtitle: target audience description */}
    <p className="text-xs text-slate-500 font-brand">{targetDescription}</p>
    {/* Stats */}
    <StatsMini stats={...} onDrilldown={...} />
  </div>

  {/* Connector: vertical line segment → icon circle → vertical line segment */}
  <div className="w-px h-4 bg-slate-200" />
  <div className={cn(
    'w-10 h-10 rounded-full flex items-center justify-center border-2',
    active ? 'bg-violet-600 border-violet-600 text-white' : 'bg-white border-slate-300 text-slate-400',
  )}>
    {stageIcon}
  </div>
  <div className="w-px h-3 bg-slate-200" />

  {/* Label + date */}
  <p className="text-xs font-medium text-slate-700 font-brand text-center mt-1">{stageLabel}</p>
  <p className="text-[11px] text-slate-400 font-brand text-center mt-0.5">
    {computedWeekday} {computedDate}
  </p>
</div>
```

**`HorizontalConnector`:** A simple `<div className="w-12 h-px bg-slate-200 self-center mt-[calc(theme(spacing.4)+theme(spacing.2))]" />` — the exact vertical offset should align with the center of the icon circles.

**Status styles map:**
```ts
const STATUS_STYLES = {
  sent:      'bg-white border-emerald-200',
  active:    'bg-white border-violet-300 shadow-sm',
  scheduled: 'bg-white border-slate-200',
  disabled:  'bg-slate-50 border-slate-100 opacity-60',
};
```

**Step 3: Mobile Vertical Layout (`< lg`)**

```tsx
<div className="lg:hidden flex flex-col gap-4">
  {allNodes.map(node => (
    node.type === 'event'
      ? <EventDayAnchor date={eventDate} />
      : <MobileStageCard setting={...} ... />
  ))}
</div>
```

`MobileStageCard` is similar to the current `StageNode` but adapted for the new status system and opening the modal on click instead of inline editing. Keep the toggle on the card, remove `DaysBadge` (timing editing moves to modal), keep `StatsMini`.

**Step 4: Drag-to-Scroll Hook**

Create a reusable hook in the same file (or extract if reused later):

```ts
function useDragScroll(ref: React.RefObject<HTMLElement>) {
  const [isDragging, setIsDragging] = useState(false);
  const startState = useRef({ x: 0, scrollLeft: 0 });

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (!ref.current) return;
    setIsDragging(true);
    startState.current = { x: e.clientX, scrollLeft: ref.current.scrollLeft };
    ref.current.setPointerCapture(e.pointerId);
  }, [ref]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging || !ref.current) return;
    const dx = e.clientX - startState.current.x;
    ref.current.scrollLeft = startState.current.scrollLeft - dx;
  }, [isDragging, ref]);

  const onPointerUp = useCallback(() => setIsDragging(false), []);

  return { onPointerDown, onPointerMove, onPointerUp, isDragging };
}
```

**Step 5: Smart Focus Snapping**

Runs in a `useEffect` after data loads:

```ts
useEffect(() => {
  if (loading || !scrollRef.current || settings.length === 0) return;

  // Find focus stage
  const focusStage = findFocusStage(sorted, stats);
  const focusId = focusStage ? `stage-${focusStage.stage_name}` : 'event-day';

  // Delay slightly to let layout settle
  requestAnimationFrame(() => {
    const container = scrollRef.current;
    const focusEl = document.getElementById(focusId);
    if (!container || !focusEl) return;
    if (container.scrollWidth <= container.clientWidth) return; // fits, no scroll

    const cRect = container.getBoundingClientRect();
    const fRect = focusEl.getBoundingClientRect();
    const focusCenterFromRight = cRect.right - (fRect.left + fRect.width / 2);
    const targetFromRight = cRect.width * 0.35;
    const delta = targetFromRight - focusCenterFromRight;
    container.scrollBy({ left: -delta, behavior: 'smooth' });
  });
}, [loading, settings, stats]);
```

`findFocusStage` logic:
```ts
function findFocusStage(sorted, stats) {
  return sorted.find(s => {
    if (!s.is_active) return false;
    const st = stats[s.stage_name];
    if (!st) return true; // no messages yet → upcoming
    return st.pending > 0; // still has pending messages
  }) ?? null;
}
```

**Step 6: Add Nudge Button**

Between the last nudge-type node and the ultimatum node (in the pre-event zone), render an "Add Nudge" button:

```tsx
function AddNudgeButton({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex flex-col items-center justify-center w-14 h-14 rounded-full',
        'border-2 border-dashed border-slate-300 text-slate-400',
        'hover:border-violet-400 hover:text-violet-500 transition-colors',
        'disabled:opacity-30 disabled:cursor-not-allowed',
      )}
      title="הוסף תזכורת"
    >
      <Plus className="w-4 h-4" />
      <span className="text-[9px] font-brand mt-0.5">תזכורת</span>
    </button>
  );
}
```

**Logic:** Count existing dynamic nudges (`settings.filter(s => s.stage_name.startsWith('nudge_'))`). If count >= 3, disable. On click, determine the next available name (`nudge_1`, `nudge_2`, `nudge_3`), compute a default `days_before` (midpoint between last nudge and ultimatum), call `addDynamicNudge`, refresh data, and immediately open the edit modal so the admin can set the text.

**Step 7: Date Computation**

Utility function used across all nodes:

```ts
function computeStageDate(eventDate: Date | null, daysBefore: number): { dateStr: string; weekday: string } | null {
  if (!eventDate) return null;
  const d = new Date(eventDate);
  d.setDate(d.getDate() - daysBefore);
  return {
    dateStr: d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    weekday: d.toLocaleDateString('he-IL', { weekday: 'short' }),
  };
}
```

**Step 8: Commit (one big commit for the full rewrite)**
```bash
git add src/pages/AutomationTimeline.tsx
git commit -m "feat(timeline): v2 rewrite — RTL horizontal pipeline, auto-pilot, smart focus, dynamic nudges"
```

---

### Task 5: Remove TemplateEditorSheet + Integration Polish

**Files:**
- Delete: `src/components/dashboard/TemplateEditorSheet.tsx`
- Modify: `src/pages/AutomationTimeline.tsx` (remove TemplateEditorSheet import, fully replaced by StageEditModal)
- Modify: `src/pages/AutomationTimeline.tsx` — Polish:

**Polish items:**
1. **Scrollbar hiding:** Add `.scrollbar-hide` utility class to `src/styles/global.scss`:
   ```css
   .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
   .scrollbar-hide::-webkit-scrollbar { display: none; }
   ```
2. **Toast refinement:** Ensure toasts appear above the modal overlay (`z-60`).
3. **Loading state:** Desktop skeleton should mimic the horizontal pipeline (6 ghost cards in a row).
4. **Keyboard:** Escape closes the modal. Arrow keys could navigate stages (nice-to-have, not MVP).
5. **Responsive breakpoint test:** Verify `lg:` breakpoint (1024px) is the right threshold. At 1024px, 5-8 nodes × 48+48px per node = 480-768px — should fit with scrolling.

**Step: Commit**
```bash
git add -A
git commit -m "feat(timeline): remove TemplateEditorSheet, polish scrollbar-hide, loading states"
```

---

### Task 6: Update CLAUDE.md

Document:
- The Auto-Pilot master toggle and `toggle_auto_pilot` RPC
- Dynamic nudge naming convention (`nudge_1/2/3`), insertion/deletion rules, `delete_dynamic_nudge` RPC
- The extended `update_whatsapp_template` whitelist
- The `StageEditModal` component (replacing `TemplateEditorSheet`)
- Desktop horizontal pipeline layout + drag-to-scroll + smart focus snapping algorithm
- Mobile vertical layout
- Updated file structure (removed `TemplateEditorSheet.tsx`, added `StageEditModal.tsx`)

**Step: Commit**
```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md with Timeline v2 architecture"
```

---

## Dependency Graph

```
Task 1 (migration)  ──┐
                       ├── Task 2 (constants + helpers)
                       │
                       └── Task 3 (StageEditModal)
                                │
                                └── Task 4 (AutomationTimeline rewrite)
                                        │
                                        └── Task 5 (polish + cleanup)
                                                │
                                                └── Task 6 (docs)
```

Tasks 1, 2, 3 can start in parallel (Task 2-3 don't need the migration applied to write the code, only to test). Task 4 depends on 2+3. Tasks 5-6 are sequential after 4.

---

## Key Files Reference

| File | Purpose |
|---|---|
| `supabase/migrations/20260226200000_dynamic_nudges_and_autopilot.sql` | INSERT RLS, delete_dynamic_nudge RPC, toggle_auto_pilot RPC, extended whitelist |
| `src/components/dashboard/constants.ts` | Extended StageName with nudge_1/2/3, updated STAGE_META |
| `src/components/dashboard/StageEditModal.tsx` | New: liquid glass modal for stage editing |
| `src/components/dashboard/StageLogsSheet.tsx` | Unchanged: stage logs drill-down |
| `src/pages/AutomationTimeline.tsx` | Full rewrite: horizontal pipeline, auto-pilot, dynamic nudges |
| `src/lib/supabase.js` | New helpers: toggleAutoPilot, addDynamicNudge, deleteDynamicNudge |
| `src/styles/global.scss` | Add .scrollbar-hide utility |

---

## Out of Scope

- **Scheduler changes:** The automation-engine already reads `stage_name` dynamically. No engine code changes needed.
- **Real-time subscriptions:** Manual refresh is sufficient for MVP.
- **Stage reordering via drag:** Order is determined by `days_before` values. Admins edit timing, not position.
- **Auto-pilot affecting already-queued messages:** Soft pause only — existing pending messages still send.
