import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Save, Plus, Trash2, ChevronDown, Eye,
  Heart, CalendarDays, Clock, Car, AlignLeft,
  GripVertical,
} from 'lucide-react';
import { useEventContext } from '@/contexts/EventContext';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { updateEventContentConfig } from '@/lib/supabase';
import DashboardNav from '@/components/dashboard/DashboardNav';
import LivePreview from '@/components/dashboard/LivePreview';

// ─── Constants ─────────────────────────────────────────────────────────────────

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

// ─── Form primitives ──────────────────────────────────────────────────────────

const INPUT_BASE = [
  'w-full px-3.5 py-2.5 text-sm font-brand text-slate-800',
  'bg-slate-50/70 border border-slate-200 rounded-xl',
  'placeholder:text-slate-300',
  'focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-400 focus:bg-white',
  'transition-all duration-150',
].join(' ');

function FieldLabel({ label }: { label: string }) {
  return (
    <p className="text-[11px] font-semibold tracking-widest uppercase text-slate-400 font-brand mb-1.5">
      {label}
    </p>
  );
}

function FieldHint({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-1 text-[11px] text-slate-400 font-brand leading-snug">
      {children}
    </p>
  );
}

function TextInput({ value, onChange, placeholder, dir }: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  dir?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      dir={dir}
      className={INPUT_BASE}
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
      className={`${INPUT_BASE} resize-none leading-relaxed`}
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
      className={INPUT_BASE}
    />
  );
}

// ─── Section card ──────────────────────────────────────────────────────────────

type SectionIcon = React.ComponentType<{ className?: string }>;

function Section({
  title,
  icon: Icon,
  defaultOpen = true,
  children,
}: {
  title: string;
  icon: SectionIcon;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div
      className={[
        'rounded-2xl border bg-white overflow-hidden',
        'transition-shadow duration-200',
        open
          ? 'border-violet-100 shadow-[0_2px_16px_-4px_rgba(124,58,237,0.10)]'
          : 'border-slate-100 shadow-sm',
      ].join(' ')}
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-slate-50/60 transition-colors"
      >
        <span
          className={[
            'p-2 rounded-xl transition-colors duration-200',
            open ? 'bg-violet-100 text-violet-600' : 'bg-slate-100 text-slate-400',
          ].join(' ')}
        >
          <Icon className="w-4 h-4" />
        </span>
        <span className="flex-1 text-sm font-semibold font-brand text-slate-800 text-right">
          {title}
        </span>
        <ChevronDown
          className={[
            'w-4 h-4 text-slate-400 transition-transform duration-200',
            open ? 'rotate-180' : '',
          ].join(' ')}
        />
      </button>

      {open && (
        <div className="px-5 pb-6 pt-1 space-y-5 border-t border-slate-50">
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Field group (subtle inset background for related fields) ─────────────────

function FieldGroup({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-slate-50/50 rounded-xl p-4 space-y-4 border border-slate-100/80">
      {children}
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
    <div className="flex items-center gap-2 group bg-white rounded-xl px-3 py-2.5 border border-slate-100 shadow-sm">
      <GripVertical className="w-3.5 h-3.5 text-slate-300 shrink-0" />
      <input
        type="time"
        value={item.time ?? ''}
        onChange={e => onChange('time', e.target.value)}
        className="w-24 px-2 py-1 text-sm font-brand text-slate-700 bg-transparent border-none
                   focus:outline-none focus:ring-0 tabular-nums"
      />
      <div className="w-px h-5 bg-slate-200 shrink-0" />
      <input
        type="text"
        value={item.label ?? ''}
        onChange={e => onChange('label', e.target.value)}
        placeholder="תיאור"
        className="flex-1 px-2 py-1 text-sm font-brand text-slate-700 bg-transparent border-none
                   placeholder:text-slate-300 focus:outline-none focus:ring-0"
      />
      <select
        value={item.icon ?? ''}
        onChange={e => onChange('icon', e.target.value)}
        className="w-28 px-2 py-1 text-sm font-brand text-slate-600 bg-transparent border-none
                   focus:outline-none focus:ring-0 cursor-pointer"
      >
        <option value="">ללא</option>
        {ICON_OPTIONS.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <button
        onClick={onDelete}
        className="p-1 text-slate-300 hover:text-rose-400 opacity-0 group-hover:opacity-100
                   transition-all duration-150 shrink-0"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ─── Loading skeleton ──────────────────────────────────────────────────────────

function SettingsSkeleton() {
  return (
    <div className="animate-pulse space-y-4 mt-2">
      {[200, 280, 160].map((h, i) => (
        <div key={i} className="rounded-2xl bg-white border border-slate-100 overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4">
            <div className="w-8 h-8 bg-slate-100 rounded-xl" />
            <div className="h-4 bg-slate-100 rounded w-28" />
          </div>
          <div className="border-t border-slate-50 px-5 py-5 space-y-4"
               style={{ height: `${h}px` }} />
        </div>
      ))}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function DashboardSettings() {
  const { currentEvent, isLoading: eventLoading } = useEventContext();
  const { canAccessTimeline } = useFeatureAccess();
  const [draft, setDraft]       = useState<ContentConfig>({});
  const [original, setOriginal] = useState<ContentConfig>({});
  const [saving, setSaving]     = useState(false);
  const [toasts, setToasts]     = useState<Toast[]>([]);
  const [showMobilePreview, setShowMobilePreview] = useState(false);

  const showToast = useCallback((message: string, kind: ToastKind = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, kind }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  }, []);

  useEffect(() => {
    if (!currentEvent) return;
    const config = (currentEvent as any).content_config ?? {};
    setDraft({ ...config });
    setOriginal({ ...config });
  }, [currentEvent]);

  const isDirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(original),
    [draft, original],
  );

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

  const handleSave = useCallback(async () => {
    if (!currentEvent || !isDirty) return;
    setSaving(true);
    try {
      const toSave = { ...draft };
      if (original.whatsapp_templates) {
        toSave.whatsapp_templates = original.whatsapp_templates;
      }
      await updateEventContentConfig((currentEvent as any).id, toSave);
      setOriginal({ ...toSave });
      showToast('ההגדרות נשמרו בהצלחה');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'שגיאה בשמירה', 'error');
    } finally {
      setSaving(false);
    }
  }, [currentEvent, draft, original, isDirty, showToast]);

  // ── Loading ──

  if (eventLoading) {
    return (
      <div dir="rtl" className="min-h-screen bg-gradient-to-br from-slate-50 to-violet-50/30 px-4 py-8 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <DashboardNav />
          <SettingsSkeleton />
        </div>
      </div>
    );
  }

  const schedule = draft.schedule ?? [];

  return (
    <div dir="rtl" className="min-h-screen bg-gradient-to-br from-slate-50 to-violet-50/30 px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <DashboardNav />

        {!canAccessTimeline && (
          <div
            dir="rtl"
            className="mb-6 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800 font-brand"
          >
            <span className="font-semibold">האירוע שלכם במצב טיוטה</span>
            {' — '}Preview ועריכת עיצוב פעילים. גישה לניהול אורחים ו-WhatsApp תיפתח לאחר אישור.
          </div>
        )}

        {/* Page header */}
        <div className="flex items-center justify-between mb-7">
          <div>
            <h1 className="text-2xl font-danidin text-slate-800 leading-none">הגדרות האירוע</h1>
            <p className="text-xs text-slate-400 font-brand mt-1">
              {isDirty ? 'יש שינויים שלא נשמרו' : 'כל השינויים נשמרו'}
            </p>
          </div>
          {/* Mobile preview toggle */}
          <button
            onClick={() => setShowMobilePreview(true)}
            className="lg:hidden flex items-center gap-1.5 px-4 py-2 text-sm font-brand font-medium
                       text-violet-600 bg-violet-50 rounded-xl hover:bg-violet-100 transition-colors"
          >
            <Eye className="w-4 h-4" />
            תצוגה
          </button>
        </div>

        {/* Split: form (right in RTL) + preview (left in RTL) */}
        <div className="flex gap-8 items-start">

          {/* ── Form ── */}
          <div className="flex-1 min-w-0 space-y-3">

            {/* Section 1: Couple details */}
            <Section title="פרטי הזוג" icon={Heart}>
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
                  placeholder="Love is composed of a single soul inhabiting two bodies..."
                  rows={2}
                />
                <FieldHint>מוצג מעל שמות הזוג</FieldHint>
              </div>
              <div>
                <FieldLabel label="טקסט הזמנה" />
                <TextArea
                  value={draft.invitation_text ?? ''}
                  onChange={v => handleField('invitation_text', v)}
                  placeholder="שמחים לראותכם ביום חתונתנו..."
                />
              </div>
            </Section>

            {/* Section 2: Date & Venue */}
            <Section title="תאריך ומיקום" icon={CalendarDays}>
              {/* Date row — grouped */}
              <FieldGroup>
                <p className="text-[11px] font-semibold tracking-widest uppercase text-slate-400 font-brand">
                  תאריך
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <FieldLabel label="תצוגה" />
                    <TextInput
                      value={draft.date_display ?? ''}
                      onChange={v => handleField('date_display', v)}
                      placeholder="10.10.2025"
                    />
                    <FieldHint>כפי שיוצג גדול בהזמנה</FieldHint>
                  </div>
                  <div>
                    <FieldLabel label="עברי" />
                    <TextInput
                      value={draft.date_hebrew ?? ''}
                      onChange={v => handleField('date_hebrew', v)}
                      placeholder="ט' בתשרי"
                    />
                  </div>
                  <div>
                    <FieldLabel label="יום" />
                    <TextInput
                      value={draft.day_of_week ?? ''}
                      onChange={v => handleField('day_of_week', v)}
                      placeholder="שישי"
                    />
                  </div>
                </div>
              </FieldGroup>

              {/* Venue */}
              <div>
                <FieldLabel label="שם מקום האירוע" />
                <TextInput
                  value={draft.venue_name ?? ''}
                  onChange={v => handleField('venue_name', v)}
                  placeholder="גן האירועים..."
                />
              </div>
              <div>
                <FieldLabel label="כתובת (תצוגה)" />
                <TextArea
                  value={draft.venue_address ?? ''}
                  onChange={v => handleField('venue_address', v)}
                  placeholder="רחוב הפרחים 1, תל אביב"
                  rows={2}
                />
                <FieldHint>הטקסט המוצג על ההזמנה — קצר ונקי</FieldHint>
              </div>
              <div>
                <FieldLabel label="כתובת מלאה" />
                <TextInput
                  value={draft.venue_address_full ?? ''}
                  onChange={v => handleField('venue_address_full', v)}
                  placeholder="רחוב הפרחים 1, תל אביב 68000"
                />
                <FieldHint>משמשת לחיפוש במפות Google</FieldHint>
              </div>
              <div>
                <FieldLabel label="שאילתת מפות" />
                <TextInput
                  value={draft.venue_maps_query ?? ''}
                  onChange={v => handleField('venue_maps_query', v)}
                  placeholder="גן האירועים תל אביב"
                  dir="ltr"
                />
                <FieldHint>הטקסט שמוקלד ב-Google Maps Embed</FieldHint>
              </div>
            </Section>

            {/* Section 3: Schedule */}
            <Section title="לוז הערב" icon={Clock}>
              <div className="space-y-2">
                {schedule.map((item, i) => (
                  <ScheduleRow
                    key={i}
                    item={item}
                    onChange={(field, value) => handleScheduleItem(i, field, value)}
                    onDelete={() => removeScheduleItem(i)}
                  />
                ))}
                {schedule.length === 0 && (
                  <div className="text-center py-6 text-slate-400 font-brand text-sm">
                    עדיין אין פריטים בלוז
                  </div>
                )}
              </div>
              <button
                onClick={addScheduleItem}
                className="flex items-center gap-1.5 text-sm font-brand font-medium
                           text-violet-500 hover:text-violet-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                הוסף פריט
              </button>
            </Section>

            {/* Section 4: Transport */}
            <Section title="הגעה ותחבורה" icon={Car} defaultOpen={false}>
              <div>
                <FieldLabel label="קישור Waze" />
                <TextInput
                  value={draft.waze_link ?? ''}
                  onChange={v => handleField('waze_link', v)}
                  placeholder="https://waze.com/ul/..."
                  dir="ltr"
                />
                <FieldHint>ישלח לאורחים בהודעת לוגיסטיקה</FieldHint>
              </div>
              <FieldGroup>
                <p className="text-[11px] font-semibold tracking-widest uppercase text-slate-400 font-brand">
                  רכבת קלה
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <FieldLabel label="קו" />
                    <TextInput
                      value={draft.train_line ?? ''}
                      onChange={v => handleField('train_line', v)}
                      placeholder="אדום"
                    />
                  </div>
                  <div>
                    <FieldLabel label="תחנה" />
                    <TextInput
                      value={draft.train_station ?? ''}
                      onChange={v => handleField('train_station', v)}
                      placeholder="גן עיר"
                    />
                  </div>
                </div>
                <div>
                  <FieldLabel label="דקות הליכה" />
                  <NumberInput
                    value={draft.train_walk_minutes}
                    onChange={v => handleField('train_walk_minutes', v)}
                    placeholder="5"
                  />
                </div>
              </FieldGroup>
              <FieldGroup>
                <p className="text-[11px] font-semibold tracking-widest uppercase text-slate-400 font-brand">
                  חניה
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <FieldLabel label="שם חניון" />
                    <TextInput
                      value={draft.parking_lot ?? ''}
                      onChange={v => handleField('parking_lot', v)}
                      placeholder="חניון A"
                    />
                  </div>
                  <div>
                    <FieldLabel label="דקות הליכה" />
                    <NumberInput
                      value={draft.parking_walk_minutes}
                      onChange={v => handleField('parking_walk_minutes', v)}
                      placeholder="3"
                    />
                  </div>
                </div>
              </FieldGroup>
            </Section>

            {/* Section 5: Footer */}
            <Section title="טקסט סיום" icon={AlignLeft} defaultOpen={false}>
              <div>
                <FieldLabel label="הערה תחתונה" />
                <TextArea
                  value={draft.footer_note ?? ''}
                  onChange={v => handleField('footer_note', v)}
                  placeholder="נא לאשר הגעה עד ה-1 בספטמבר..."
                />
                <FieldHint>מוצג מעל כפתור האישור</FieldHint>
              </div>
              <div>
                <FieldLabel label="הודעת סיום" />
                <TextArea
                  value={draft.closing_message ?? ''}
                  onChange={v => handleField('closing_message', v)}
                  placeholder="מחכים לראותכם! 💛"
                />
                <FieldHint>מוצג בגדול מתחת לציטוט הסיום</FieldHint>
              </div>
            </Section>

            {/* ── Sticky save bar — lives inside form column so it respects form width ── */}
            <div
              className={[
                'sticky bottom-0 z-30 -mx-1 px-1 pt-3 pb-4 transition-all duration-300',
                isDirty
                  ? 'translate-y-0 opacity-100'
                  : 'translate-y-4 opacity-0 pointer-events-none',
              ].join(' ')}
            >
              <div className="bg-white/90 backdrop-blur-md border border-slate-100 rounded-2xl shadow-lg px-4 py-3">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className={[
                    'w-full flex items-center justify-center gap-2 py-3 lg:py-2.5',
                    'text-sm font-brand font-semibold rounded-xl',
                    'active:scale-[0.98]',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                    'transition-all duration-150',
                    isDirty && !saving
                      ? 'text-white bg-violet-600 hover:bg-violet-700 shadow-md shadow-violet-200'
                      : 'text-white bg-violet-600 hover:bg-violet-700',
                  ].join(' ')}
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'שומר...' : 'שמור שינויים'}
                </button>
              </div>
            </div>

          </div>

          {/* ── Preview (desktop only, sticky) ── */}
          <div className="hidden lg:block sticky top-8 self-start shrink-0">
            {currentEvent && (
              <LivePreview
                event={currentEvent as any}
                config={draft}
                width={320}
              />
            )}
          </div>

        </div>
      </div>

      {/* ── Mobile preview overlay ── */}
      {showMobilePreview && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-6 lg:hidden"
          onClick={() => setShowMobilePreview(false)}
        >
          <div onClick={e => e.stopPropagation()}>
            {currentEvent && (
              <LivePreview
                event={currentEvent as any}
                config={draft}
                width={300}
              />
            )}
          </div>
          <button
            onClick={() => setShowMobilePreview(false)}
            className="absolute top-5 left-5 p-2 text-white/70 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>
      )}


      {/* ── Toast stack ── */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-60 flex flex-col gap-2 items-center pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className={[
              'px-5 py-2.5 rounded-xl text-sm font-brand font-medium shadow-lg',
              'animate-in fade-in slide-in-from-bottom-2',
              t.kind === 'error'
                ? 'bg-rose-600 text-white'
                : 'bg-slate-800 text-white',
            ].join(' ')}
          >
            {t.kind === 'success' && <span className="ml-1.5">✓</span>}
            {t.message}
          </div>
        ))}
      </div>
    </div>
  );
}
