# Track A: Automation Timeline UI — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an opinionated visual pipeline ("Timeline") that lets admins control the automated WhatsApp funnel — toggle stages on/off, adjust timing, edit template text, and see real-time send stats per stage.

**Architecture:** The Timeline is a dedicated page (`/dashboard/timeline`) sharing a tab-navigation header with the existing `/dashboard` guest table. Each funnel stage maps 1:1 to an `automation_settings` row, and its template text lives in `events.content_config.whatsapp_templates[stage_name]` (singular/plural variants). All data flows through the existing Supabase anon client.

**Tech Stack:** React + TypeScript, Supabase (anon client), Tailwind CSS, Radix Sheet primitive, Lucide icons. Same styling conventions as Dashboard (violet-600 primary, slate neutrals, font-brand / font-danidin, RTL Hebrew).

---

## Architecture Analysis & Gap Resolution

### Q1: How should `whatsapp_templates` sync with `stage_name`?

**Answer: The current structure is already correct.** No schema change needed.

The `automation-engine` edge function (`supabase/functions/automation-engine/index.ts:55-66`) already uses `stage_name` as the lookup key into `content_config.whatsapp_templates`:

```ts
function pickTemplate(contentConfig, stageName, pax) {
  const templates = contentConfig.whatsapp_templates;
  if (!templates || !templates[stageName]) return null;
  return pax === 1 ? templates[stageName].singular : templates[stageName].plural;
}
```

The sync contract is: **`automation_settings.stage_name` === key in `whatsapp_templates`**.

Both the automation-engine and the Dashboard `SendWhatsAppModal` already follow this convention. The Timeline UI must maintain it by using the same keys when reading/writing template text.

**Canonical stage names & their fixed properties:**

| `stage_name` | Hebrew Label | `target_status` | Editable? | Default `days_before` |
|---|---|---|---|---|
| `icebreaker` | פתיחה ראשונית | `pending` | `is_active`, `days_before`, text | 14 |
| `nudge` | תזכורת עדינה | `pending` | `is_active`, `days_before`, text | 7 |
| `ultimatum` | תזכורת אחרונה | `pending` | `is_active`, `days_before`, text | 3 |
| `logistics` | מידע לוגיסטי | `attending` | `is_active`, `days_before`, text | 1 |
| `hangover` | תודה לאחר האירוע | `attending` | `is_active`, `days_before`, text | -1 (1 day after) |

**Fixed rule:** `target_status` is NOT editable from the UI — it's a business invariant (nudges only go to pending guests, logistics only to confirmed, etc.).

### Q2: Identified Gaps

| # | Gap | Resolution |
|---|---|---|
| 1 | `automation_settings` has RLS enabled but **no anon policies** — frontend can't read/write | Add migration with anon SELECT + UPDATE policies |
| 2 | `events` table must NOT be opened to anon UPDATE — editing template text needs a safe path | Create a Postgres RPC (`update_whatsapp_template`) that uses `jsonb_set` to atomically patch a single stage key inside `content_config.whatsapp_templates`. Grant EXECUTE to anon — no broad UPDATE needed. |
| 3 | `automation_settings` has no seed data — table is empty | Add migration that seeds the 5 default stage rows for the current event |
| 4 | No frontend queries for `automation_settings` | Add helpers to `supabase.js` |
| 5 | No aggregate query for per-stage message stats | Add a helper that counts `message_logs` grouped by `message_type` |
| 6 | Dashboard has no navigation between views | Add a lightweight `DashboardNav` tab component |
| 7 | `TEMPLATE_LABELS` is duplicated (Dashboard + future Timeline) | Extract to shared constants file |

---

## Task List

### Task 1: Extract Shared Constants

**Files:**
- Create: `src/components/dashboard/constants.ts`
- Modify: `src/pages/Dashboard.tsx`

**Why:** `TEMPLATE_LABELS`, `MSG_STATUS_MAP`, and the stage definitions are needed by both the guest table and the new Timeline. Extract them now to avoid duplication.

**Step 1: Create shared constants file**

```ts
// src/components/dashboard/constants.ts

export const STAGE_NAMES = [
  'icebreaker',
  'nudge',
  'ultimatum',
  'logistics',
  'hangover',
] as const;

export type StageName = (typeof STAGE_NAMES)[number];

export const STAGE_META: Record<StageName, {
  label: string;
  targetStatus: string;
  defaultDaysBefore: number;
  icon: string; // Lucide icon name hint
}> = {
  icebreaker: { label: 'פתיחה ראשונית',     targetStatus: 'pending',   defaultDaysBefore: 14, icon: 'Sparkles'  },
  nudge:      { label: 'תזכורת עדינה',       targetStatus: 'pending',   defaultDaysBefore: 7,  icon: 'Bell'      },
  ultimatum:  { label: 'תזכורת אחרונה',      targetStatus: 'pending',   defaultDaysBefore: 3,  icon: 'AlertTriangle' },
  logistics:  { label: 'מידע לוגיסטי',       targetStatus: 'attending', defaultDaysBefore: 1,  icon: 'MapPin'    },
  hangover:   { label: 'תודה לאחר האירוע',   targetStatus: 'attending', defaultDaysBefore: -1, icon: 'Heart'     },
};

/** Human-readable labels for template types — used in SendModal and Timeline */
export const TEMPLATE_LABELS: Record<string, string> = Object.fromEntries(
  STAGE_NAMES.map(s => [s, STAGE_META[s].label])
);

export const MSG_STATUS_MAP = {
  pending: { label: 'ממתין בתור', classes: 'bg-amber-100 text-amber-700 border-amber-200' },
  sent:    { label: 'נשלח',       classes: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  failed:  { label: 'נכשל',       classes: 'bg-rose-100 text-rose-700 border-rose-200' },
  none:    { label: 'טרם נשלח',   classes: 'bg-slate-100 text-slate-500 border-slate-200' },
} as const;
```

**Step 2: Update Dashboard.tsx imports**

Replace the inline `TEMPLATE_LABELS` (line ~558) and `MSG_STATUS_MAP` (line ~203) with imports from `constants.ts`. Remove the old definitions. Search-and-replace to ensure all references work.

**Step 3: Commit**

```bash
git add src/components/dashboard/constants.ts src/pages/Dashboard.tsx
git commit -m "refactor(dashboard): extract shared TEMPLATE_LABELS and STAGE_META to constants"
```

---

### Task 2: RLS Policies + Secure RPC for Template Editing

**Files:**
- Create: `supabase/migrations/20260226100000_automation_rls_and_rpc.sql`

**Why:** The frontend uses the Supabase anon key. Two problems to solve:
1. `automation_settings` has RLS enabled with no policies (line 13 of its migration: `-- No anon policies`). The Timeline UI needs SELECT + UPDATE.
2. Template text lives inside `events.content_config` (JSONB). We must **NOT** grant anon UPDATE on the entire `events` table — that would let anyone overwrite couple names, maps, schedules, etc. Instead, we create a **Postgres RPC** that atomically patches only the `whatsapp_templates → <stage_name>` key using `jsonb_set`, and grant EXECUTE on it to the anon role.

**Security model:** anon can read/update `automation_settings` rows freely (toggles + timing), but can only touch `events.content_config` through the narrow, validated RPC.

**Step 1: Create migration file**

```sql
-- supabase/migrations/20260226100000_automation_rls_and_rpc.sql

-- ═══════════════════════════════════════════════════════════════════════
-- 1. RLS policies for automation_settings (anon read + update)
-- ═══════════════════════════════════════════════════════════════════════

CREATE POLICY "Allow anon select automation_settings"
  ON automation_settings FOR SELECT TO anon USING (true);

CREATE POLICY "Allow anon update automation_settings"
  ON automation_settings FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════════════
-- 2. Secure RPC: atomically patch ONE whatsapp_template stage
--    Uses jsonb_set — no full-row replacement, no race conditions.
--    Does NOT require anon UPDATE on events.
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION update_whatsapp_template(
  p_event_id   uuid,
  p_stage_name text,
  p_singular   text,
  p_plural     text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER          -- runs with table-owner privileges
SET search_path = public  -- prevent search_path hijacking
AS $$
DECLARE
  v_allowed_stages text[] := ARRAY[
    'icebreaker', 'nudge', 'ultimatum', 'logistics', 'hangover'
  ];
BEGIN
  -- Validate stage_name against the allowed whitelist
  IF p_stage_name != ALL(v_allowed_stages) THEN
    RAISE EXCEPTION 'Invalid stage_name: %', p_stage_name;
  END IF;

  -- Atomic JSONB patch: sets content_config -> 'whatsapp_templates' -> <stage> -> { singular, plural }
  -- If whatsapp_templates key doesn't exist yet, initialise it as an empty object first.
  UPDATE events
  SET content_config = jsonb_set(
    -- Ensure the whatsapp_templates parent key exists
    CASE
      WHEN content_config -> 'whatsapp_templates' IS NULL
      THEN jsonb_set(COALESCE(content_config, '{}'::jsonb), '{whatsapp_templates}', '{}'::jsonb)
      ELSE content_config
    END,
    -- Path: whatsapp_templates -> <stage_name>
    ARRAY['whatsapp_templates', p_stage_name],
    -- Value: { "singular": "...", "plural": "..." }
    jsonb_build_object('singular', p_singular, 'plural', p_plural),
    -- create_if_missing
    true
  )
  WHERE id = p_event_id;

  -- Verify the row was actually found
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event not found: %', p_event_id;
  END IF;
END;
$$;

-- Grant execute to anon so the frontend can call it via supabase.rpc()
GRANT EXECUTE ON FUNCTION update_whatsapp_template(uuid, text, text, text) TO anon;
```

**Step 2: Apply the migration**

Run via Supabase dashboard SQL editor (hosted) or `npx supabase db push` (local).

**Step 3: Verify**

Test from the browser console or Supabase dashboard:
```js
// 1. automation_settings policies
await supabase.from('automation_settings').select('*')  // → should return rows (empty until seeded)

// 2. RPC — should patch only the 'nudge' key without touching other content_config fields
await supabase.rpc('update_whatsapp_template', {
  p_event_id:   '<event-uuid>',
  p_stage_name: 'nudge',
  p_singular:   'test singular',
  p_plural:     'test plural',
})
// → should succeed

// 3. Verify: fetch event and confirm only nudge changed, other keys intact
await supabase.from('events').select('content_config').eq('id', '<event-uuid>').single()

// 4. Invalid stage_name should fail
await supabase.rpc('update_whatsapp_template', {
  p_event_id:   '<event-uuid>',
  p_stage_name: 'evil_injection',
  p_singular:   'x',
  p_plural:     'x',
})
// → should throw "Invalid stage_name: evil_injection"
```

**Step 4: Commit**

```bash
git add supabase/migrations/20260226100000_automation_rls_and_rpc.sql
git commit -m "feat(db): add automation_settings RLS + secure RPC for template editing"
```

---

### Task 3: Seed Default Automation Settings

**Files:**
- Create: `supabase/migrations/20260226100100_seed_automation_settings.sql`

**Why:** The `automation_settings` table is empty. The automation-engine needs rows to operate, and the Timeline UI needs rows to display. We seed the 5 canonical stages for the current event.

**Step 1: Create seed migration**

```sql
-- supabase/migrations/20260226100100_seed_automation_settings.sql
-- Seed the 5 funnel stages for the 'hagit-and-itai' event.
-- Uses a subselect to resolve the event_id from the slug.

INSERT INTO automation_settings (event_id, stage_name, days_before, target_status, is_active)
SELECT
  e.id,
  stage.stage_name,
  stage.days_before,
  stage.target_status,
  stage.is_active
FROM events e
CROSS JOIN (VALUES
  ('icebreaker', 14, 'pending',   true),
  ('nudge',       7, 'pending',   true),
  ('ultimatum',   3, 'pending',   true),
  ('logistics',   1, 'attending', true),
  ('hangover',   -1, 'attending', true)
) AS stage(stage_name, days_before, target_status, is_active)
WHERE e.slug = 'hagit-and-itai'
  AND NOT EXISTS (
    SELECT 1 FROM automation_settings a
    WHERE a.event_id = e.id AND a.stage_name = stage.stage_name
  );
```

**Step 2: Apply and verify**

Run: `npx supabase db push`
Verify: `SELECT * FROM automation_settings;` → 5 rows

**Step 3: Commit**

```bash
git add supabase/migrations/20260226100100_seed_automation_settings.sql
git commit -m "feat(db): seed default automation_settings for hagit-and-itai event"
```

---

### Task 4: Supabase Helper Functions

**Files:**
- Modify: `src/lib/supabase.js`

**Why:** The Timeline UI needs to fetch, update automation settings and update template text. Currently `supabase.js` only has `fetchEventBySlug` and `submitRsvp`. Add focused helpers following the same pattern.

**Step 1: Add the following exports to `src/lib/supabase.js`**

```js
/** Fetch all automation_settings rows for an event, ordered by days_before DESC */
export const fetchAutomationSettings = async (eventId) => {
  if (!supabase) throw new Error('Supabase is not configured');
  const { data, error } = await supabase
    .from('automation_settings')
    .select('id, event_id, stage_name, days_before, target_status, is_active, created_at')
    .eq('event_id', eventId)
    .order('days_before', { ascending: false });
  if (error) throw error;
  return data;
};

/** Update a single automation_settings row (toggle is_active, change days_before) */
export const updateAutomationSetting = async (settingId, updates) => {
  if (!supabase) throw new Error('Supabase is not configured');
  const { data, error } = await supabase
    .from('automation_settings')
    .update(updates)
    .eq('id', settingId)
    .select()
    .single();
  if (error) throw error;
  return data;
};

/**
 * Atomically patch a single whatsapp_template stage via Postgres RPC.
 * Uses jsonb_set server-side — no race conditions, no broad UPDATE on events.
 */
export const updateWhatsAppTemplate = async (eventId, stageName, singular, plural) => {
  if (!supabase) throw new Error('Supabase is not configured');
  const { error } = await supabase.rpc('update_whatsapp_template', {
    p_event_id:   eventId,
    p_stage_name: stageName,
    p_singular:   singular,
    p_plural:     plural,
  });
  if (error) throw error;
};

/**
 * Fetch aggregate message stats grouped by message_type for a given event.
 * Returns: { [message_type]: { sent: number, pending: number, failed: number } }
 */
export const fetchMessageStatsPerStage = async (eventId) => {
  if (!supabase) throw new Error('Supabase is not configured');
  const { data, error } = await supabase
    .from('message_logs')
    .select('message_type, status')
    .eq('event_id', eventId);
  if (error) throw error;

  const stats = {};
  for (const row of data ?? []) {
    if (!stats[row.message_type]) {
      stats[row.message_type] = { sent: 0, pending: 0, failed: 0 };
    }
    if (row.status === 'sent')        stats[row.message_type].sent++;
    else if (row.status === 'pending') stats[row.message_type].pending++;
    else if (row.status === 'failed')  stats[row.message_type].failed++;
  }
  return stats;
};
```

**Step 2: Commit**

```bash
git add src/lib/supabase.js
git commit -m "feat(supabase): add automation settings and message stats helpers"
```

---

### Task 5: Dashboard Tab Navigation

**Files:**
- Create: `src/components/dashboard/DashboardNav.tsx`
- Modify: `src/pages/Dashboard.tsx` (wrap content in nav)
- Modify: `src/App.jsx` (add `/dashboard/timeline` route)

**Why:** The Timeline lives at `/dashboard/timeline`. Both views share a tab bar at the top. This task adds the shared navigation without creating the Timeline page yet.

**Step 1: Create `DashboardNav.tsx`**

```tsx
// src/components/dashboard/DashboardNav.tsx
import { useLocation, useNavigate } from 'react-router-dom';

const TABS = [
  { path: '/dashboard',          label: 'אורחים' },
  { path: '/dashboard/timeline', label: 'ציר זמן' },
] as const;

export default function DashboardNav() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav dir="rtl" className="flex gap-1 bg-white/60 backdrop-blur-sm rounded-xl p-1 mb-6 w-fit font-brand">
      {TABS.map(tab => {
        const active = location.pathname === tab.path;
        return (
          <button
            key={tab.path}
            onClick={() => navigate(tab.path)}
            className={[
              'px-5 py-2 rounded-lg text-sm font-medium transition-all',
              active
                ? 'bg-violet-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-violet-600 hover:bg-white/80',
            ].join(' ')}
          >
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}
```

**Step 2: Integrate into Dashboard.tsx**

At the top of the Dashboard's return JSX (inside the outer container, before the KPI cards), add:

```tsx
import DashboardNav from '@/components/dashboard/DashboardNav';
// ...
return (
  <div className="min-h-screen bg-gradient-to-br from-slate-50 to-violet-50/30" dir="rtl">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <DashboardNav />
      {/* existing KPI cards, filters, table... */}
```

**Step 3: Register route in App.jsx**

Add a placeholder route for `/dashboard/timeline`:

```jsx
import AutomationTimeline from './pages/AutomationTimeline';
// In the Routes:
<Route path="/dashboard/timeline" element={<AutomationTimeline />} />
```

Create a minimal placeholder `src/pages/AutomationTimeline.tsx`:

```tsx
import DashboardNav from '@/components/dashboard/DashboardNav';

export default function AutomationTimeline() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-violet-50/30" dir="rtl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <DashboardNav />
        <p className="font-brand text-slate-500">ציר זמן — בקרוב</p>
      </div>
    </div>
  );
}
```

**Step 4: Commit**

```bash
git add src/components/dashboard/DashboardNav.tsx src/pages/Dashboard.tsx src/pages/AutomationTimeline.tsx src/App.jsx
git commit -m "feat(dashboard): add tab navigation between guests table and timeline"
```

---

### Task 6: AutomationTimeline Page — Data Layer

**Files:**
- Modify: `src/pages/AutomationTimeline.tsx`

**Why:** Wire up all data fetching before building the UI. The page needs: event data, automation settings, template text, and message stats.

**Step 1: Add state, types, and data fetching**

The component should:

1. Use `useEvent('hagit-and-itai')` to get the event (same pattern as Dashboard).
2. On `event.id` ready, fetch `automation_settings` via `fetchAutomationSettings(event.id)`.
3. Fetch message stats via `fetchMessageStatsPerStage(event.id)`.
4. Extract `whatsapp_templates` from `event.content_config`.
5. Compute `event_date` — **Note: `fetchEventBySlug` doesn't return `event_date`!** Either:
   - **Option A:** Add `event_date` to the `fetchEventBySlug` select list, or
   - **Option B:** Add a separate fetch for the Timeline page.

   **Decision: Option A** — add `event_date` to the existing query. It's a lightweight addition and the Dashboard might need it later too.

**Step 1a: Update `fetchEventBySlug` in `supabase.js`**

Change line 18 from:
```js
.select('id, slug, template_id, content_config')
```
to:
```js
.select('id, slug, template_id, content_config, event_date, automation_config')
```

**Step 1b: Define types and state in AutomationTimeline.tsx**

```tsx
import { useState, useEffect } from 'react';
import { useEvent } from '../hooks/useEvent';
import { fetchAutomationSettings, fetchMessageStatsPerStage } from '../lib/supabase';
import { STAGE_META, STAGE_NAMES, type StageName } from '@/components/dashboard/constants';
import DashboardNav from '@/components/dashboard/DashboardNav';

interface AutomationSettingRow {
  id: string;
  event_id: string;
  stage_name: StageName;
  days_before: number;
  target_status: string;
  is_active: boolean;
  created_at: string;
}

interface StageStats {
  sent: number;
  pending: number;
  failed: number;
}

type WhatsAppTemplates = Record<string, { singular: string; plural: string }>;

const SLUG = 'hagit-and-itai';
```

State:
```tsx
const { event, loading: eventLoading } = useEvent(SLUG);
const [settings, setSettings] = useState<AutomationSettingRow[]>([]);
const [stats, setStats] = useState<Record<string, StageStats>>({});
const [loading, setLoading] = useState(true);
```

Fetch effect (runs once `event.id` is available):
```tsx
useEffect(() => {
  if (!event?.id) return;
  setLoading(true);
  Promise.all([
    fetchAutomationSettings(event.id),
    fetchMessageStatsPerStage(event.id),
  ]).then(([settingsData, statsData]) => {
    setSettings(settingsData as AutomationSettingRow[]);
    setStats(statsData);
  }).finally(() => setLoading(false));
}, [event?.id]);
```

Derived data:
```tsx
const templates: WhatsAppTemplates =
  (event?.content_config as any)?.whatsapp_templates ?? {};
const eventDate = event?.event_date ? new Date(event.event_date) : null;
```

**Step 2: Commit**

```bash
git add src/pages/AutomationTimeline.tsx src/lib/supabase.js
git commit -m "feat(timeline): wire data layer — settings, stats, templates"
```

---

### Task 7: AutomationTimeline Page — Visual Pipeline UI

**Files:**
- Modify: `src/pages/AutomationTimeline.tsx`

**Why:** Build the actual timeline visualization. Each node is a card connected by a vertical line, showing stage info, stats, toggle, and an "edit text" button.

**Step 1: Build the timeline node layout**

Each node shows:
- **Left gutter:** Vertical line with a colored dot (emerald if active, slate if inactive)
- **Card body:**
  - Row 1: Stage icon + Hebrew label (from `STAGE_META`) + toggle switch (top-right)
  - Row 2: Timing badge (e.g., "14 ימים לפני") — clickable to edit
  - Row 3: Target audience pill (e.g., "ממתינים" / "מגיעים")
  - Row 4: Stats mini-bar (X נשלחו · Y בתור · Z נכשלו) — only if messages exist
  - Row 5: "ערוך טקסט" button

**Between the last "before" stage and the first "after" stage**, render a prominent **Event Day anchor** card with the date.

**Node ordering:** Sort by `days_before` descending (icebreaker first → hangover last). The Event Day anchor sits between `logistics` (days_before=1) and `hangover` (days_before=-1).

**Step 2: Implement the toggle handler**

```tsx
const handleToggle = async (settingId: string, currentValue: boolean) => {
  // Optimistic update
  setSettings(prev => prev.map(s =>
    s.id === settingId ? { ...s, is_active: !currentValue } : s
  ));
  try {
    await updateAutomationSetting(settingId, { is_active: !currentValue });
  } catch {
    // Revert on failure
    setSettings(prev => prev.map(s =>
      s.id === settingId ? { ...s, is_active: currentValue } : s
    ));
  }
};
```

**Step 3: Implement the days_before inline editor**

When the admin clicks the timing badge, it becomes an `<input type="number">` inline. On blur or Enter, save:

```tsx
const handleDaysChange = async (settingId: string, newDays: number) => {
  setSettings(prev => prev.map(s =>
    s.id === settingId ? { ...s, days_before: newDays } : s
  ));
  await updateAutomationSetting(settingId, { days_before: newDays });
};
```

**Step 4: Styling guidelines**

- Cards: `bg-white rounded-2xl shadow-sm border border-slate-100 p-5`
- Active nodes: `border-l-4 border-violet-500` (RTL: use `border-r-4`)
- Inactive nodes: `opacity-50` with a muted palette
- Vertical connector line: `w-0.5 bg-slate-200` centered in left gutter
- Event Day anchor: `bg-violet-600 text-white rounded-2xl` with `font-danidin` date display
- Stats: small colored dots + counts (emerald for sent, amber for pending, rose for failed)

**Step 5: Commit**

```bash
git add src/pages/AutomationTimeline.tsx
git commit -m "feat(timeline): visual pipeline UI with toggle, timing, and stats"
```

---

### Task 8: Template Editor Sheet

**Files:**
- Create: `src/components/dashboard/TemplateEditorSheet.tsx`
- Modify: `src/pages/AutomationTimeline.tsx` (integrate the sheet)

**Why:** When admin clicks "ערוך טקסט" on a timeline node, a left-side Sheet opens with the singular and plural template textareas. On save, it calls the `update_whatsapp_template` RPC — an atomic server-side `jsonb_set` that patches only the targeted stage key. No full `content_config` round-trip, no race conditions.

**Step 1: Create `TemplateEditorSheet.tsx`**

Props interface (note: **no `contentConfig` prop needed** — the RPC handles the merge server-side):
```tsx
interface TemplateEditorSheetProps {
  stageName: StageName | null;        // null = closed
  templates: WhatsAppTemplates;       // current templates (for initial textarea values)
  eventId: string;
  onClose: () => void;
  onSaved: (stageName: StageName, singular: string, plural: string) => void;
}
```

Component structure:
```tsx
<Sheet open={stageName !== null} onOpenChange={open => { if (!open) onClose(); }}>
  <SheetContent side="left" dir="rtl" className="font-brand flex flex-col w-[28rem]">
    <SheetHeader>
      <SheetTitle className="font-danidin text-lg">
        עריכת טקסט — {stageName ? STAGE_META[stageName].label : ''}
      </SheetTitle>
    </SheetHeader>

    {/* Variable hints */}
    <div className="px-6 py-2 bg-slate-50 rounded-lg text-xs text-slate-500">
      משתנים זמינים: <code>{'{{name}}'}</code> · <code>{'{{couple_names}}'}</code> · <code>{'{{link}}'}</code> · <code>{'{{waze_link}}'}</code>
    </div>

    {/* Singular textarea */}
    <SectionLabel>טקסט ליחיד (invited_pax = 1)</SectionLabel>
    <textarea value={singular} onChange={...} rows={5} className={INPUT_CLS} />

    {/* Plural textarea */}
    <SectionLabel>טקסט לרבים (invited_pax > 1)</SectionLabel>
    <textarea value={plural} onChange={...} rows={5} className={INPUT_CLS} />

    {/* Save button */}
    <div className="border-t px-6 py-4 mt-auto">
      <button onClick={handleSave} disabled={saving} className="w-full bg-violet-600 text-white rounded-xl py-2.5 font-brand">
        {saving ? 'שומר...' : 'שמור'}
      </button>
    </div>
  </SheetContent>
</Sheet>
```

**Step 2: Implement save handler (RPC-based — no client-side JSONB merge)**

```tsx
import { updateWhatsAppTemplate } from '@/lib/supabase';

const handleSave = async () => {
  if (!stageName) return;
  setSaving(true);
  try {
    // Atomic server-side patch via Postgres RPC (jsonb_set).
    // Only touches content_config -> whatsapp_templates -> <stageName>.
    // Other content_config keys (couple_names, waze_link, schedule, etc.) are untouched.
    await updateWhatsAppTemplate(eventId, stageName, singular, plural);

    // Notify parent to update local cache so the UI reflects the change immediately
    onSaved(stageName, singular, plural);
    onClose();
  } catch (err) {
    setError('שגיאה בשמירת הטקסט');
  } finally {
    setSaving(false);
  }
};
```

**Why this is better than the previous approach:**
- **No race condition:** `jsonb_set` runs atomically in Postgres. Even if the automation-engine or another admin tab modifies `content_config` concurrently, only the targeted stage key is written.
- **No broad UPDATE on events:** The RPC uses `SECURITY DEFINER` to bypass RLS with table-owner privileges. The anon role only has EXECUTE on this specific function.
- **Server-side validation:** The RPC whitelist-checks `stage_name` against the 5 allowed values before writing.

**Step 3: Integrate into AutomationTimeline.tsx**

Add state:
```tsx
const [editingStage, setEditingStage] = useState<StageName | null>(null);
```

In the timeline node's "ערוך טקסט" button:
```tsx
onClick={() => setEditingStage(setting.stage_name)}
```

Render the sheet:
```tsx
<TemplateEditorSheet
  stageName={editingStage}
  templates={templates}
  eventId={event.id}
  onClose={() => setEditingStage(null)}
  onSaved={(stage, singular, plural) => {
    // Update local template cache so UI reflects the change without refetch
    setLocalTemplates(prev => ({
      ...prev,
      [stage]: { singular, plural },
    }));
  }}
/>
```

**Step 4: Commit**

```bash
git add src/components/dashboard/TemplateEditorSheet.tsx src/pages/AutomationTimeline.tsx
git commit -m "feat(timeline): template editor sheet for singular/plural text editing"
```

---

### Task 9: Polish & Edge Cases

**Files:**
- Modify: `src/pages/AutomationTimeline.tsx`
- Modify: `src/components/dashboard/TemplateEditorSheet.tsx`

**Step 1: Loading & empty states**

- While `eventLoading || loading`: show a skeleton/spinner matching Dashboard's pattern
- If `settings` is empty after load: show a helpful "no stages configured" message with instructions

**Step 2: Toast feedback**

Reuse the toast pattern from Dashboard (positioned fixed bottom-center):
- "ההגדרה עודכנה" on toggle/timing save
- "הטקסט נשמר" on template save
- "שגיאה בשמירה" on any failure

**Step 3: Validate days_before input**

- Disallow non-integer values
- Disallow extreme values (e.g., > 365 or < -30)
- Show validation error inline

**Step 4: Auto-refresh stats**

Add a "רענן נתונים" button that re-fetches both `settings` and `stats`. Optionally set a 60s auto-refresh interval.

**Step 5: Commit**

```bash
git add src/pages/AutomationTimeline.tsx src/components/dashboard/TemplateEditorSheet.tsx
git commit -m "feat(timeline): loading states, toast feedback, validation, refresh"
```

---

### Task 10: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Update documentation**

Add under the Dashboard section:
- Document the `/dashboard/timeline` route
- Document the `DashboardNav` component
- Document the `AutomationTimeline` page and its data flow
- Document the `TemplateEditorSheet` component
- Update the File Structure section

Add to the Database Schema section:
- Note the new RLS policies on `automation_settings`
- Document the `update_whatsapp_template` RPC (params, security model, whitelist)
- Note the seed data

Update `src/lib/supabase.js` section:
- Add the new helper functions (`fetchAutomationSettings`, `updateAutomationSetting`, `updateWhatsAppTemplate`, `fetchMessageStatsPerStage`)

**Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md with timeline UI architecture and routes"
```

---

## Dependency Graph

```
Task 1 (constants)     ─┐
Task 2 (RLS migration) ─┤
Task 3 (seed data)     ─┤── Task 4 (supabase helpers)
                         │
                         └── Task 5 (nav) ── Task 6 (data layer) ── Task 7 (UI) ── Task 8 (editor) ── Task 9 (polish) ── Task 10 (docs)
```

Tasks 1, 2, 3 can run in parallel. Task 4 depends on 2+3 (need the migration applied). Tasks 5+ are sequential.

---

## Key Files Reference

| File | Purpose |
|---|---|
| `src/components/dashboard/constants.ts` | Shared stage names, labels, meta |
| `src/components/dashboard/DashboardNav.tsx` | Tab navigation (guests ↔ timeline) |
| `src/components/dashboard/TemplateEditorSheet.tsx` | Sheet for editing template text |
| `src/pages/AutomationTimeline.tsx` | Main Timeline page component |
| `src/pages/Dashboard.tsx` | Existing guest table (add nav import) |
| `src/lib/supabase.js` | New helper functions |
| `src/App.jsx` | New `/dashboard/timeline` route |
| `supabase/migrations/20260226100000_automation_rls_and_rpc.sql` | RLS policies + `update_whatsapp_template` RPC |
| `supabase/migrations/20260226100100_seed_automation_settings.sql` | Seed data |

---

## Out of Scope (Future Work)

- **Admin auth:** Currently no login — the dashboard is open. Authentication is a separate workstream.
- **Multi-event support:** The `SLUG` is hardcoded. Parameterizing it is Phase 1 cleanup work.
- **Drag-and-drop reordering:** Stage order is fixed by business logic (funnel progression).
- **Real-time subscriptions:** Could use Supabase Realtime for live stats updates, but manual refresh is sufficient for MVP.
- **Automation-engine trigger button:** A "run now" button that invokes the edge function. Useful for testing but not part of this plan.
