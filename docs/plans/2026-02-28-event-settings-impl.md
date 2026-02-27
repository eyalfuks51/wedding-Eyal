# Event Settings Editor — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a 3rd dashboard tab ("הגדרות") where the couple can edit all `content_config` fields with a live mobile preview of their invitation page.

**Architecture:** New page `DashboardSettings.tsx` with split-pane layout: form sections on the right, phone-frame preview on the left. Form edits update local draft state; the actual template component re-renders live inside a scaled-down phone frame. Save writes the full `content_config` JSONB to Supabase. A `LivePreview.tsx` component wraps the existing template in a phone mockup with `transform: scale()`.

**Tech Stack:** React, TypeScript, Tailwind CSS, Supabase (direct update on `events` table)

---

### Task 1: Add route, tab, and Supabase helper

**Files:**
- Modify: `src/components/dashboard/DashboardNav.tsx`
- Modify: `src/App.jsx`
- Modify: `src/lib/supabase.js`
- Create: `src/pages/DashboardSettings.tsx` (minimal shell)

**What to do:**

1. In `src/components/dashboard/DashboardNav.tsx`, add the 3rd tab to the `TABS` array:

```typescript
const TABS = [
  { path: '/dashboard',          label: 'אורחים' },
  { path: '/dashboard/timeline', label: 'ציר זמן' },
  { path: '/dashboard/settings', label: 'הגדרות' },
] as const;
```

2. In `src/App.jsx`, import and register the new route. Add it **before** the `/:slug` route:

```jsx
import DashboardSettings from './pages/DashboardSettings';

// Inside <Routes>:
<Route path="/dashboard" element={<Dashboard />} />
<Route path="/dashboard/timeline" element={<AutomationTimeline />} />
<Route path="/dashboard/settings" element={<DashboardSettings />} />
<Route path="/:slug" element={<EventPage />} />
```

3. In `src/lib/supabase.js`, add `updateEventContentConfig` after the existing `updateWhatsAppTemplate` function (line ~63):

```javascript
/**
 * Update the full content_config JSONB for an event.
 * Merges the provided config with the existing one (shallow merge at top level).
 * whatsapp_templates are excluded — those are managed via the Timeline's StageEditModal.
 */
export const updateEventContentConfig = async (eventId, contentConfig) => {
  if (!supabase) throw new Error('Supabase is not configured');
  const { error } = await supabase
    .from('events')
    .update({ content_config: contentConfig })
    .eq('id', eventId);
  if (error) throw error;
};
```

4. Create `src/pages/DashboardSettings.tsx` with a minimal shell:

```tsx
import DashboardNav from '@/components/dashboard/DashboardNav';

const SLUG = 'hagit-and-itai';

export default function DashboardSettings() {
  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-br from-slate-50 to-violet-50/30 px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <DashboardNav />
        <h1 className="text-2xl font-danidin text-slate-800 mb-6">הגדרות האירוע</h1>
        <p className="text-slate-500 font-brand">בקרוב...</p>
      </div>
    </div>
  );
}
```

**Verify:** `npx tsc --noEmit` — no errors. Navigate to `/dashboard/settings` — tab bar shows 3 tabs, new page renders.

**Commit:** `feat(settings): add route, tab, supabase helper, and shell page`

---

### Task 2: Create the LivePreview component

**Files:**
- Create: `src/components/dashboard/LivePreview.tsx`

**What to do:**

Create a phone-frame wrapper that renders the actual template component inside a scaled-down container. The preview is non-interactive (`pointer-events-none`) to prevent form submissions.

```tsx
import { useMemo } from 'react';
import WeddingDefaultTemplate from '@/templates/WeddingDefaultTemplate/WeddingDefaultTemplate';
import ElegantTemplate from '@/templates/ElegantTemplate/ElegantTemplate';

const TEMPLATES: Record<string, React.ComponentType<{ event: any; config: any }>> = {
  'wedding-default': WeddingDefaultTemplate,
  'elegant':         ElegantTemplate,
};

// iPhone-like viewport dimensions
const PHONE_W = 375;
const PHONE_H = 812;

interface LivePreviewProps {
  templateId: string;
  event: { id: string; slug: string; template_id: string; event_date: string };
  config: Record<string, any>;
  /** Width of the container in pixels — scale is computed from this */
  width?: number;
}

export default function LivePreview({ templateId, event, config, width = 320 }: LivePreviewProps) {
  const scale = width / PHONE_W;
  const frameH = PHONE_H * scale;

  const Template = TEMPLATES[templateId] ?? WeddingDefaultTemplate;

  // Merge draft config with event for the template contract
  const previewEvent = useMemo(() => ({
    ...event,
    content_config: config,
  }), [event, config]);

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Phone frame */}
      <div
        className="relative rounded-[2.5rem] border-[6px] border-slate-800 bg-slate-800 shadow-2xl overflow-hidden"
        style={{ width: `${width + 12}px`, height: `${frameH + 12}px` }}
      >
        {/* Notch */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-5 bg-slate-800 rounded-b-xl z-10" />

        {/* Scaled template content */}
        <div
          className="origin-top-right overflow-y-auto overflow-x-hidden pointer-events-none bg-white"
          dir="rtl"
          style={{
            width: `${PHONE_W}px`,
            height: `${PHONE_H}px`,
            transform: `scale(${scale})`,
          }}
        >
          <Template event={previewEvent} config={config} />
        </div>
      </div>

      <p className="text-[11px] text-slate-400 font-brand">תצוגה מקדימה</p>
    </div>
  );
}
```

**Verify:** `npx tsc --noEmit` — no errors.

**Commit:** `feat(settings): add LivePreview phone-frame component`

---

### Task 3: Build the full settings form with all sections

**Files:**
- Modify: `src/pages/DashboardSettings.tsx` (replace shell with full implementation)

**What to do:**

Replace the shell page with the full implementation. This is a large component, so follow the structure carefully.

**Key architectural decisions:**
- Local `draft` state (`useState`) initialized from `event.content_config`
- `isDirty` computed by comparing draft to original (JSON stringify)
- `handleField(key, value)` generic updater for flat fields
- `handleScheduleItem(index, field, value)` updater for schedule array
- Toast pattern copied from AutomationTimeline (inline state, auto-dismiss)
- No `beforeunload` listener (keep it simple — users rarely navigate away mid-edit)

Replace the entire content of `src/pages/DashboardSettings.tsx` with:

```tsx
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Save, Plus, Trash2, ChevronDown, Eye } from 'lucide-react';
import { useEvent } from '@/hooks/useEvent';
import { updateEventContentConfig } from '@/lib/supabase';
import DashboardNav from '@/components/dashboard/DashboardNav';
import LivePreview from '@/components/dashboard/LivePreview';

// ─── Constants ─────────────────────────────────────────────────────────────────

const SLUG = 'hagit-and-itai';

type ToastKind = 'success' | 'error';
interface Toast { id: number; message: string; kind: ToastKind }

interface ScheduleItem {
  time?: string;
  label?: string;
  icon?: string;
}

interface ContentConfig {
  couple_names?: string;
  quote?: string;
  invitation_text?: string;
  date_display?: string;
  date_hebrew?: string;
  day_of_week?: string;
  venue_name?: string;
  venue_address?: string;
  venue_address_full?: string;
  venue_maps_query?: string;
  schedule?: ScheduleItem[];
  footer_note?: string;
  closing_message?: string;
  waze_link?: string;
  train_line?: string;
  train_station?: string;
  train_walk_minutes?: number;
  parking_lot?: string;
  parking_walk_minutes?: number;
  whatsapp_templates?: Record<string, unknown>;
  [key: string]: unknown;
}

const ICON_OPTIONS = [
  { value: 'food',  label: 'אוכל 🍽️' },
  { value: 'marry', label: 'טקס 💍' },
  { value: 'dance', label: 'ריקודים 💃' },
];

// ─── Reusable form primitives ──────────────────────────────────────────────────

function FieldLabel({ label, hint }: { label: string; hint?: string }) {
  return (
    <label className="block text-sm font-medium text-slate-700 font-brand mb-1">
      {label}
      {hint && <span className="text-slate-400 font-normal mr-2 text-xs">({hint})</span>}
    </label>
  );
}

function TextInput({ value, onChange, placeholder, type = 'text', dir }: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  dir?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      dir={dir}
      className="w-full px-3 py-2 text-sm font-brand bg-white border border-slate-200 rounded-xl
                 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-400
                 focus:border-transparent transition-shadow"
    />
  );
}

function TextArea({ value, onChange, placeholder, rows = 3 }: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full px-3 py-2 text-sm font-brand bg-white border border-slate-200 rounded-xl
                 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-400
                 focus:border-transparent transition-shadow resize-none"
    />
  );
}

function NumberInput({ value, onChange, placeholder }: {
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="number"
      value={value ?? ''}
      onChange={e => onChange(e.target.value ? Number(e.target.value) : undefined)}
      placeholder={placeholder}
      className="w-full px-3 py-2 text-sm font-brand bg-white border border-slate-200 rounded-xl
                 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-400
                 focus:border-transparent transition-shadow"
    />
  );
}

// ─── Collapsible section ───────────────────────────────────────────────────────

function Section({ title, defaultOpen = true, children }: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-slate-200/60 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 text-right"
      >
        <span className="text-base font-medium font-brand text-slate-800">{title}</span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-5 pb-5 space-y-4 border-t border-slate-100 pt-4">
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Schedule row ──────────────────────────────────────────────────────────────

function ScheduleRow({ item, onChange, onDelete }: {
  item: ScheduleItem;
  onChange: (field: keyof ScheduleItem, value: string) => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="time"
        value={item.time ?? ''}
        onChange={e => onChange('time', e.target.value)}
        className="w-24 px-2 py-1.5 text-sm font-brand bg-white border border-slate-200 rounded-lg
                   focus:outline-none focus:ring-2 focus:ring-violet-400"
      />
      <input
        type="text"
        value={item.label ?? ''}
        onChange={e => onChange('label', e.target.value)}
        placeholder="תיאור"
        className="flex-1 px-3 py-1.5 text-sm font-brand bg-white border border-slate-200 rounded-lg
                   placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-400"
      />
      <select
        value={item.icon ?? ''}
        onChange={e => onChange('icon', e.target.value)}
        className="w-28 px-2 py-1.5 text-sm font-brand bg-white border border-slate-200 rounded-lg
                   focus:outline-none focus:ring-2 focus:ring-violet-400"
      >
        <option value="">ללא אייקון</option>
        {ICON_OPTIONS.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <button
        onClick={onDelete}
        className="p-1.5 text-slate-400 hover:text-rose-500 transition-colors"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function DashboardSettings() {
  const { event, loading: eventLoading } = useEvent(SLUG);
  const [draft, setDraft]     = useState<ContentConfig>({});
  const [original, setOriginal] = useState<ContentConfig>({});
  const [saving, setSaving]   = useState(false);
  const [toasts, setToasts]   = useState<Toast[]>([]);
  const [showMobilePreview, setShowMobilePreview] = useState(false);

  const showToast = useCallback((message: string, kind: ToastKind = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, kind }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  }, []);

  // Initialize draft from event data
  useEffect(() => {
    if (!event) return;
    const config = (event as any).content_config ?? {};
    setDraft({ ...config });
    setOriginal({ ...config });
  }, [event]);

  const isDirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(original),
    [draft, original],
  );

  // ── Field updaters ──

  const handleField = useCallback((key: string, value: unknown) => {
    setDraft(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleScheduleItem = useCallback((index: number, field: keyof ScheduleItem, value: string) => {
    setDraft(prev => {
      const schedule = [...(prev.schedule ?? [])];
      schedule[index] = { ...schedule[index], [field]: value };
      return { ...prev, schedule };
    });
  }, []);

  const addScheduleItem = useCallback(() => {
    setDraft(prev => ({
      ...prev,
      schedule: [...(prev.schedule ?? []), { time: '', label: '', icon: '' }],
    }));
  }, []);

  const removeScheduleItem = useCallback((index: number) => {
    setDraft(prev => ({
      ...prev,
      schedule: (prev.schedule ?? []).filter((_, i) => i !== index),
    }));
  }, []);

  // ── Save ──

  const handleSave = useCallback(async () => {
    if (!event || !isDirty) return;
    setSaving(true);
    try {
      // Preserve whatsapp_templates from original (managed by Timeline)
      const toSave = { ...draft };
      if (original.whatsapp_templates) {
        toSave.whatsapp_templates = original.whatsapp_templates;
      }
      await updateEventContentConfig((event as any).id, toSave);
      setOriginal({ ...toSave });
      showToast('ההגדרות נשמרו בהצלחה');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'שגיאה בשמירה', 'error');
    } finally {
      setSaving(false);
    }
  }, [event, draft, original, isDirty, showToast]);

  // ── Loading state ──

  if (eventLoading) {
    return (
      <div dir="rtl" className="min-h-screen bg-gradient-to-br from-slate-50 to-violet-50/30 px-4 py-8 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <DashboardNav />
          <div className="animate-pulse space-y-4 mt-8">
            <div className="h-8 bg-slate-200 rounded w-48" />
            <div className="h-64 bg-slate-200 rounded-2xl" />
            <div className="h-64 bg-slate-200 rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  const schedule = draft.schedule ?? [];

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-br from-slate-50 to-violet-50/30 px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <DashboardNav />

        {/* Header with save button */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-danidin text-slate-800">הגדרות האירוע</h1>
          <div className="flex items-center gap-3">
            {/* Mobile preview toggle */}
            <button
              onClick={() => setShowMobilePreview(true)}
              className="lg:hidden flex items-center gap-2 px-4 py-2 text-sm font-brand font-medium
                         text-violet-600 bg-violet-50 rounded-xl hover:bg-violet-100 transition-colors"
            >
              <Eye className="w-4 h-4" />
              תצוגה מקדימה
            </button>
            {/* Save button */}
            <button
              onClick={handleSave}
              disabled={!isDirty || saving}
              className="flex items-center gap-2 px-5 py-2 text-sm font-brand font-medium
                         text-white bg-violet-600 rounded-xl shadow-sm
                         hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <Save className="w-4 h-4" />
              {saving ? 'שומר...' : 'שמור'}
            </button>
          </div>
        </div>

        {/* Split layout: form + preview */}
        <div className="flex gap-8">
          {/* Form (right side in RTL) */}
          <div className="flex-1 space-y-4 min-w-0">

            {/* Section 1: Couple Details */}
            <Section title="פרטי הזוג">
              <div>
                <FieldLabel label="שמות הזוג" />
                <TextInput
                  value={draft.couple_names ?? ''}
                  onChange={v => handleField('couple_names', v)}
                  placeholder="חגית ואיתי"
                />
              </div>
              <div>
                <FieldLabel label="ציטוט" />
                <TextArea
                  value={draft.quote ?? ''}
                  onChange={v => handleField('quote', v)}
                  placeholder="ציטוט מיוחד..."
                  rows={2}
                />
              </div>
              <div>
                <FieldLabel label="טקסט הזמנה" />
                <TextArea
                  value={draft.invitation_text ?? ''}
                  onChange={v => handleField('invitation_text', v)}
                  placeholder="שמחים להזמינכם לחגוג איתנו..."
                />
              </div>
            </Section>

            {/* Section 2: Date & Venue */}
            <Section title="תאריך ומיקום">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <FieldLabel label="תאריך (תצוגה)" hint="ה-10.05" />
                  <TextInput
                    value={draft.date_display ?? ''}
                    onChange={v => handleField('date_display', v)}
                    placeholder="ה-10.05"
                  />
                </div>
                <div>
                  <FieldLabel label="תאריך עברי" hint="ה-10 במאי" />
                  <TextInput
                    value={draft.date_hebrew ?? ''}
                    onChange={v => handleField('date_hebrew', v)}
                    placeholder="ה-10 במאי"
                  />
                </div>
                <div>
                  <FieldLabel label="יום בשבוע" />
                  <TextInput
                    value={draft.day_of_week ?? ''}
                    onChange={v => handleField('day_of_week', v)}
                    placeholder="שלישי"
                  />
                </div>
              </div>
              <div>
                <FieldLabel label="שם מקום" />
                <TextInput
                  value={draft.venue_name ?? ''}
                  onChange={v => handleField('venue_name', v)}
                  placeholder="גן אירועים..."
                />
              </div>
              <div>
                <FieldLabel label="כתובת" hint="תצוגה באתר" />
                <TextArea
                  value={draft.venue_address ?? ''}
                  onChange={v => handleField('venue_address', v)}
                  placeholder="רחוב, עיר"
                  rows={2}
                />
              </div>
              <div>
                <FieldLabel label="כתובת מלאה" hint="לשאילתת מפות Google" />
                <TextInput
                  value={draft.venue_address_full ?? ''}
                  onChange={v => handleField('venue_address_full', v)}
                  placeholder="כתובת מלאה כולל עיר"
                />
              </div>
              <div>
                <FieldLabel label="שאילתת מפות" hint="Google Maps query" />
                <TextInput
                  value={draft.venue_maps_query ?? ''}
                  onChange={v => handleField('venue_maps_query', v)}
                  placeholder="שם המקום, עיר"
                />
              </div>
            </Section>

            {/* Section 3: Schedule */}
            <Section title="לוז האירוע">
              <div className="space-y-2">
                {schedule.map((item, i) => (
                  <ScheduleRow
                    key={i}
                    item={item}
                    onChange={(field, value) => handleScheduleItem(i, field, value)}
                    onDelete={() => removeScheduleItem(i)}
                  />
                ))}
              </div>
              <button
                onClick={addScheduleItem}
                className="flex items-center gap-1.5 text-sm font-brand text-violet-600
                           hover:text-violet-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                הוסף פריט
              </button>
            </Section>

            {/* Section 4: Transport */}
            <Section title="הגעה ותחבורה" defaultOpen={false}>
              <div>
                <FieldLabel label="קישור Waze" />
                <TextInput
                  value={draft.waze_link ?? ''}
                  onChange={v => handleField('waze_link', v)}
                  placeholder="https://waze.com/ul/..."
                  dir="ltr"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FieldLabel label="קו רכבת / רכבת קלה" />
                  <TextInput
                    value={draft.train_line ?? ''}
                    onChange={v => handleField('train_line', v)}
                    placeholder="קו אדום"
                  />
                </div>
                <div>
                  <FieldLabel label="תחנת רכבת" />
                  <TextInput
                    value={draft.train_station ?? ''}
                    onChange={v => handleField('train_station', v)}
                    placeholder="תחנה מרכזית"
                  />
                </div>
              </div>
              <div>
                <FieldLabel label="דקות הליכה מרכבת" />
                <NumberInput
                  value={draft.train_walk_minutes}
                  onChange={v => handleField('train_walk_minutes', v)}
                  placeholder="5"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FieldLabel label="חניון" />
                  <TextInput
                    value={draft.parking_lot ?? ''}
                    onChange={v => handleField('parking_lot', v)}
                    placeholder="חניון A"
                  />
                </div>
                <div>
                  <FieldLabel label="דקות הליכה מחניון" />
                  <NumberInput
                    value={draft.parking_walk_minutes}
                    onChange={v => handleField('parking_walk_minutes', v)}
                    placeholder="3"
                  />
                </div>
              </div>
            </Section>

            {/* Section 5: Footer */}
            <Section title="סיום" defaultOpen={false}>
              <div>
                <FieldLabel label="הערה תחתונה" />
                <TextArea
                  value={draft.footer_note ?? ''}
                  onChange={v => handleField('footer_note', v)}
                  placeholder="נא לאשר הגעה עד..."
                />
              </div>
              <div>
                <FieldLabel label="הודעת סיום" />
                <TextArea
                  value={draft.closing_message ?? ''}
                  onChange={v => handleField('closing_message', v)}
                  placeholder="נשמח לראותכם!"
                />
              </div>
            </Section>

            {/* Bottom spacing on mobile (preview hidden) */}
            <div className="h-8 lg:hidden" />
          </div>

          {/* Preview (left side in RTL — desktop only) */}
          <div className="hidden lg:block sticky top-8 self-start shrink-0">
            {event && (
              <LivePreview
                templateId={(event as any).template_id ?? 'wedding-default'}
                event={event as any}
                config={draft}
                width={320}
              />
            )}
          </div>
        </div>
      </div>

      {/* Mobile preview overlay */}
      {showMobilePreview && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 lg:hidden"
          onClick={() => setShowMobilePreview(false)}
        >
          <div onClick={e => e.stopPropagation()}>
            {event && (
              <LivePreview
                templateId={(event as any).template_id ?? 'wedding-default'}
                event={event as any}
                config={draft}
                width={300}
              />
            )}
          </div>
        </div>
      )}

      {/* Toast stack */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-60 flex flex-col gap-2 items-center">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`px-5 py-2.5 rounded-xl text-sm font-brand shadow-lg animate-in fade-in slide-in-from-bottom-2 ${
              t.kind === 'error'
                ? 'bg-rose-600 text-white'
                : 'bg-emerald-600 text-white'
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Verify:** `npx tsc --noEmit` — no errors. Navigate to `/dashboard/settings` — form renders with all 5 sections. Editing a field shows the save button as active (not disabled).

**Commit:** `feat(settings): full settings form with 5 sections, live preview, and save`

---

### Task 4: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

**What to do:**

1. In the **Admin Dashboard** section, add the new route:

```
- `/dashboard/settings` — event settings editor with live preview
```

2. Add a description under the existing Dashboard features:

```markdown
- **Event Settings (`/dashboard/settings`):** 3rd tab — edits `content_config` JSONB fields (couple details, date/venue, schedule, transport, footer). Split-pane: form on right + LivePreview phone-frame on left (desktop). Mobile: floating preview button opens full-screen overlay. Saves via direct `events` table UPDATE. WhatsApp templates excluded (managed via Timeline).
```

3. In the **File Structure** section, add the new files:

```
    DashboardSettings.tsx                    /dashboard/settings — event settings editor
```

Under `components/dashboard/`:
```
      LivePreview.tsx                        Phone-frame preview wrapper for template rendering
```

Under `lib/`:
```
                                              updateEventContentConfig()
```

**Verify:** Read CLAUDE.md to confirm changes are correct and no duplicate entries.

**Commit:** `docs: add event settings editor to CLAUDE.md`
