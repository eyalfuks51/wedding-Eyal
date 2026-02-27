import { useState, useEffect, useCallback } from 'react';
import {
  Sparkles,
  Bell,
  AlertTriangle,
  MapPin,
  Heart,
  Trash2,
  X,
  Loader2,
} from 'lucide-react';
import {
  GlassCard,
  GlassCardHeader,
  GlassCardContent,
  GlassCardFooter,
} from '@/components/ui/glass-card';
import { STAGE_META, DYNAMIC_NUDGE_NAMES, type StageName } from '@/components/dashboard/constants';
import { updateAutomationSetting, updateWhatsAppTemplate } from '@/lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AutomationSettingRow {
  id: string;
  event_id: string;
  stage_name: StageName;
  days_before: number;
  target_status: string;
  is_active: boolean;
  created_at: string;
}

type WhatsAppTemplates = Record<string, { singular: string; plural: string }>;

interface StageEditModalProps {
  setting: AutomationSettingRow | null;
  templates: WhatsAppTemplates;
  eventId: string;
  eventDate: Date | null;
  isDynamicNudge: boolean;
  canDelete: boolean;
  onClose: () => void;
  onSaved: (updates: {
    is_active?: boolean;
    days_before?: number;
    singular?: string;
    plural?: string;
  }) => void;
  onDelete: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, React.ReactElement> = {
  Sparkles:      <Sparkles className="w-5 h-5" />,
  Bell:          <Bell className="w-5 h-5" />,
  AlertTriangle: <AlertTriangle className="w-5 h-5" />,
  MapPin:        <MapPin className="w-5 h-5" />,
  Heart:         <Heart className="w-5 h-5" />,
};

function computeStageDate(
  eventDate: Date | null,
  daysBefore: number,
): { dateStr: string; weekday: string } | null {
  if (!eventDate) return null;
  const d = new Date(eventDate);
  d.setDate(d.getDate() - daysBefore);
  return {
    dateStr: d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    weekday: d.toLocaleDateString('he-IL', { weekday: 'long' }),
  };
}

const INPUT_CLS = [
  'w-full rounded-xl border border-white/40 bg-white/30 px-3 py-2.5 text-sm font-brand',
  'text-slate-800 resize-none focus:outline-none focus:ring-2 focus:ring-violet-400',
  'focus:border-transparent transition-shadow placeholder:text-slate-400',
].join(' ');

// ─── Toggle ───────────────────────────────────────────────────────────────────

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

// ─── Main component ───────────────────────────────────────────────────────────

export default function StageEditModal({
  setting,
  templates,
  eventId,
  eventDate,
  isDynamicNudge,
  canDelete,
  onClose,
  onSaved,
  onDelete,
}: StageEditModalProps) {
  const [isActive, setIsActive]     = useState(true);
  const [daysBefore, setDaysBefore] = useState(7);
  const [singular, setSingular]     = useState('');
  const [plural, setPlural]         = useState('');
  const [saving, setSaving]         = useState(false);
  const [deleting, setDeleting]     = useState(false);
  const [error, setError]           = useState('');

  // Sync local state when modal opens
  useEffect(() => {
    if (!setting) return;
    setIsActive(setting.is_active);
    setDaysBefore(setting.days_before);
    const t = templates[setting.stage_name];
    setSingular(t?.singular ?? '');
    setPlural(t?.plural ?? '');
    setError('');
  }, [setting, templates]);

  // Close on Escape
  useEffect(() => {
    if (!setting) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [setting, onClose]);

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

      // Always report what changed to parent (parent handles DB for drafts)
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

  const handleDelete = useCallback(async () => {
    if (!setting || !canDelete) return;
    setDeleting(true);
    setError('');
    try {
      onDelete();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'שגיאה במחיקה');
    } finally {
      setDeleting(false);
    }
  }, [setting, canDelete, onDelete]);

  if (!setting) return null;

  const meta = STAGE_META[setting.stage_name];
  const icon = ICON_MAP[meta.icon];
  const dateInfo = computeStageDate(eventDate, daysBefore);
  const isDynamic = (DYNAMIC_NUDGE_NAMES as readonly string[]).includes(setting.stage_name);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-start justify-center pointer-events-none">
        <div
          className="pointer-events-auto mt-[12vh] w-full max-w-lg mx-4"
          onClick={e => e.stopPropagation()}
        >
          <GlassCard className="rounded-3xl shadow-2xl">
            {/* ── Header ── */}
            <GlassCardHeader className="pb-2">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <span className={[
                  'flex items-center justify-center w-10 h-10 rounded-xl',
                  isActive ? 'bg-violet-100 text-violet-600' : 'bg-slate-100 text-slate-400',
                ].join(' ')}>
                  {icon}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="font-danidin text-lg text-slate-800 leading-tight truncate">
                    {meta.label}
                  </h3>
                  {dateInfo && (
                    <p className="text-xs text-slate-500 font-brand mt-0.5">
                      {dateInfo.weekday} · {dateInfo.dateStr}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <Toggle checked={isActive} onChange={() => setIsActive(v => !v)} />
                <button
                  onClick={onClose}
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-white/40 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </GlassCardHeader>

            {/* ── Content ── */}
            <GlassCardContent className="space-y-5 pb-4">
              {/* Timing section */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700 font-brand">
                  תזמון
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    value={daysBefore}
                    onChange={e => setDaysBefore(parseInt(e.target.value, 10) || 0)}
                    min={-30}
                    max={365}
                    className="w-20 rounded-xl border border-white/40 bg-white/30 px-3 py-2 text-sm font-brand text-center focus:outline-none focus:ring-2 focus:ring-violet-400 transition-shadow"
                  />
                  <span className="text-sm text-slate-600 font-brand">
                    {daysBefore > 0 ? 'ימים לפני האירוע' : daysBefore === 0 ? 'ביום האירוע' : 'ימים אחרי האירוע'}
                  </span>
                </div>
                {dateInfo && (
                  <p className="text-xs text-slate-500 font-brand bg-white/20 rounded-lg px-3 py-1.5">
                    תאריך משוער: <span className="font-medium text-slate-700">{dateInfo.weekday} {dateInfo.dateStr}</span>
                  </p>
                )}
              </div>

              {/* Template text section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-slate-700 font-brand">
                    טקסט ההודעה
                  </label>
                </div>

                {/* Variable hints */}
                <div className="rounded-xl bg-white/20 border border-white/30 px-3 py-2 text-xs text-slate-500 font-brand leading-relaxed">
                  <span className="font-semibold text-slate-600">משתנים: </span>
                  <code className="font-mono">{'{{name}}'}</code>
                  {' · '}
                  <code className="font-mono">{'{{couple_names}}'}</code>
                  {' · '}
                  <code className="font-mono">{'{{link}}'}</code>
                  {' · '}
                  <code className="font-mono">{'{{waze_link}}'}</code>
                </div>

                {/* Singular */}
                <div className="space-y-1">
                  <label className="block text-xs text-slate-500 font-brand">
                    טקסט ליחיד <span className="text-slate-400">(invited_pax = 1)</span>
                  </label>
                  <textarea
                    value={singular}
                    onChange={e => setSingular(e.target.value)}
                    rows={4}
                    placeholder="הזן את הטקסט כאן..."
                    className={INPUT_CLS}
                  />
                  <p className="text-[10px] text-slate-400 font-brand text-left">{singular.length} תווים</p>
                </div>

                {/* Plural */}
                <div className="space-y-1">
                  <label className="block text-xs text-slate-500 font-brand">
                    טקסט לרבים <span className="text-slate-400">(invited_pax &gt; 1)</span>
                  </label>
                  <textarea
                    value={plural}
                    onChange={e => setPlural(e.target.value)}
                    rows={4}
                    placeholder="הזן את הטקסט כאן..."
                    className={INPUT_CLS}
                  />
                  <p className="text-[10px] text-slate-400 font-brand text-left">{plural.length} תווים</p>
                </div>
              </div>

              {/* Error */}
              {error && (
                <p className="text-sm text-rose-600 font-brand bg-rose-50/80 rounded-xl px-3 py-2 border border-rose-200/50">
                  {error}
                </p>
              )}
            </GlassCardContent>

            {/* ── Footer ── */}
            <GlassCardFooter className="justify-between py-4 border-t border-white/20">
              {/* Delete button — only for dynamic nudges */}
              <div>
                {isDynamic && isDynamicNudge && (
                  <button
                    onClick={handleDelete}
                    disabled={!canDelete || deleting || saving}
                    title={!canDelete ? 'לא ניתן למחוק — הודעות כבר בתור' : 'מחק תזכורת'}
                    className={[
                      'inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-brand transition-colors',
                      canDelete
                        ? 'text-rose-600 hover:bg-rose-50/50 hover:text-rose-700'
                        : 'text-slate-400 cursor-not-allowed opacity-50',
                    ].join(' ')}
                  >
                    {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    מחק
                  </button>
                )}
              </div>

              {/* Save / Cancel */}
              <div className="flex gap-2">
                <button
                  onClick={onClose}
                  disabled={saving}
                  className="px-4 py-2 rounded-xl text-sm font-brand text-slate-600 bg-white/30 hover:bg-white/50 transition-colors"
                >
                  ביטול
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-6 py-2 rounded-xl text-sm font-brand font-medium text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'שמור'}
                </button>
              </div>
            </GlassCardFooter>
          </GlassCard>
        </div>
      </div>
    </>
  );
}
