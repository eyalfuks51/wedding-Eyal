import { useState, useEffect, useCallback } from 'react';
import {
  Sparkles,
  Bell,
  AlertTriangle,
  MapPin,
  Heart,
  Calendar,
  RefreshCw,
  Pencil,
  CheckCircle2,
  Clock,
  XCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useEvent } from '../hooks/useEvent';
import {
  fetchAutomationSettings,
  fetchMessageStatsPerStage,
  updateAutomationSetting,
} from '../lib/supabase';
import { STAGE_META, STAGE_NAMES, type StageName } from '@/components/dashboard/constants';
import DashboardNav from '@/components/dashboard/DashboardNav';
import TemplateEditorSheet from '@/components/dashboard/TemplateEditorSheet';

// ─── Types ───────────────────────────────────────────────────────────────────

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

// ─── Icon map ────────────────────────────────────────────────────────────────

const STAGE_ICONS: Record<StageName, React.ReactElement> = {
  icebreaker: <Sparkles className="w-4 h-4" />,
  nudge:      <Bell className="w-4 h-4" />,
  ultimatum:  <AlertTriangle className="w-4 h-4" />,
  logistics:  <MapPin className="w-4 h-4" />,
  hangover:   <Heart className="w-4 h-4" />,
};

const SLUG = 'hagit-and-itai';

// ─── Toggle switch ────────────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={e => { e.stopPropagation(); onChange(); }}
      className={[
        'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200',
        checked ? 'bg-violet-600' : 'bg-slate-200',
      ].join(' ')}
    >
      <span
        className={[
          'pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow ring-0 transition-transform duration-200',
          checked ? 'translate-x-4' : 'translate-x-0',
        ].join(' ')}
      />
    </button>
  );
}

// ─── Inline days editor ───────────────────────────────────────────────────────

function DaysBadge({
  value,
  settingId,
  onSave,
}: {
  value: number;
  settingId: string;
  onSave: (id: string, days: number) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState(String(value));
  const [error, setError]     = useState('');

  const commit = async () => {
    const parsed = parseInt(draft, 10);
    if (isNaN(parsed))              { setError('ערך לא תקין'); return; }
    if (parsed > 365 || parsed < -30) { setError('בין -30 ל-365'); return; }
    setError('');
    setEditing(false);
    await onSave(settingId, parsed);
  };

  if (editing) {
    return (
      <span className="inline-flex flex-col gap-0.5">
        <input
          autoFocus
          type="number"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
          className="w-20 text-xs border border-violet-400 rounded px-1.5 py-0.5 text-center focus:outline-none focus:ring-1 focus:ring-violet-500"
        />
        {error && <span className="text-xs text-rose-500">{error}</span>}
      </span>
    );
  }

  const label = value === -1 ? 'יום לאחר' : value === 0 ? 'ביום האירוע' : `${value} ימים לפני`;

  return (
    <button
      type="button"
      onClick={() => { setDraft(String(value)); setEditing(true); }}
      title="לחץ לעריכה"
      className="inline-flex items-center gap-1 text-xs bg-slate-100 hover:bg-violet-50 hover:text-violet-700 text-slate-600 rounded-full px-2.5 py-0.5 transition-colors border border-slate-200 hover:border-violet-300"
    >
      <Clock className="w-3 h-3" />
      {label}
      <Pencil className="w-2.5 h-2.5 opacity-40" />
    </button>
  );
}

// ─── Stats mini-bar ───────────────────────────────────────────────────────────

function StatsMini({ stats }: { stats?: StageStats }) {
  if (!stats || (stats.sent === 0 && stats.pending === 0 && stats.failed === 0)) return null;
  return (
    <div className="flex items-center gap-3 text-xs text-slate-500 font-brand mt-1">
      {stats.sent > 0 && (
        <span className="flex items-center gap-1">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
          {stats.sent} נשלחו
        </span>
      )}
      {stats.pending > 0 && (
        <span className="flex items-center gap-1">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400" />
          {stats.pending} בתור
        </span>
      )}
      {stats.failed > 0 && (
        <span className="flex items-center gap-1">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-rose-500" />
          {stats.failed} נכשלו
        </span>
      )}
    </div>
  );
}

// ─── Stage node card ──────────────────────────────────────────────────────────

function StageNode({
  setting,
  stats,
  onToggle,
  onDaysSave,
  onEditText,
}: {
  setting: AutomationSettingRow;
  stats?: StageStats;
  onToggle: (id: string, current: boolean) => void;
  onDaysSave: (id: string, days: number) => Promise<void>;
  onEditText: (stage: StageName) => void;
}) {
  const meta   = STAGE_META[setting.stage_name];
  const active = setting.is_active;

  const targetLabel = setting.target_status === 'attending' ? 'מגיעים' : 'ממתינים';

  return (
    <div
      className={[
        'bg-white rounded-2xl shadow-sm border border-slate-100 p-5 transition-opacity',
        'border-r-4',
        active ? 'border-r-violet-500' : 'border-r-slate-200 opacity-60',
      ].join(' ')}
    >
      {/* Row 1: icon + label + toggle */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className={[
            'flex items-center justify-center w-7 h-7 rounded-full',
            active ? 'bg-violet-100 text-violet-600' : 'bg-slate-100 text-slate-400',
          ].join(' ')}>
            {STAGE_ICONS[setting.stage_name]}
          </span>
          <span className="font-semibold text-sm text-slate-800 font-brand">{meta.label}</span>
        </div>
        <Toggle checked={active} onChange={() => onToggle(setting.id, active)} />
      </div>

      {/* Row 2: timing badge + target audience */}
      <div className="flex items-center gap-2 mt-3 flex-wrap">
        <DaysBadge value={setting.days_before} settingId={setting.id} onSave={onDaysSave} />
        <span className={[
          'inline-flex items-center text-xs rounded-full px-2.5 py-0.5 border font-brand',
          setting.target_status === 'attending'
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
            : 'bg-amber-50 text-amber-700 border-amber-200',
        ].join(' ')}>
          {targetLabel}
        </span>
      </div>

      {/* Row 3: stats */}
      <StatsMini stats={stats} />

      {/* Row 4: edit text button */}
      <button
        type="button"
        onClick={() => onEditText(setting.stage_name)}
        className="mt-3 inline-flex items-center gap-1.5 text-xs text-violet-600 hover:text-violet-800 font-brand transition-colors"
      >
        <Pencil className="w-3 h-3" />
        ערוך טקסט
      </button>
    </div>
  );
}

// ─── Event Day anchor ─────────────────────────────────────────────────────────

function EventDayAnchor({ date }: { date: Date | null }) {
  const label = date
    ? date.toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' })
    : 'יום האירוע';
  return (
    <div className="bg-violet-600 text-white rounded-2xl px-5 py-4 flex items-center gap-3 shadow-md">
      <Calendar className="w-5 h-5 opacity-80" />
      <div>
        <div className="font-danidin text-lg leading-none">יום האירוע</div>
        <div className="text-sm opacity-80 mt-0.5 font-brand">{label}</div>
      </div>
    </div>
  );
}

// ─── Vertical connector ───────────────────────────────────────────────────────

function Connector() {
  return <div className="w-0.5 h-6 bg-slate-200 mx-auto" />;
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i}>
          <div className="bg-white rounded-2xl border border-slate-100 p-5 animate-pulse">
            <div className="flex justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-slate-200 rounded-full" />
                <div className="w-28 h-4 bg-slate-200 rounded" />
              </div>
              <div className="w-9 h-5 bg-slate-200 rounded-full" />
            </div>
            <div className="flex gap-2 mt-3">
              <div className="w-24 h-5 bg-slate-100 rounded-full" />
              <div className="w-16 h-5 bg-slate-100 rounded-full" />
            </div>
          </div>
          {i < 5 && <Connector />}
        </div>
      ))}
    </div>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────

type ToastKind = 'success' | 'error';
interface Toast { id: number; message: string; kind: ToastKind }

function ToastContainer({ toasts }: { toasts: Toast[] }) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 items-center pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          className={[
            'px-4 py-2.5 rounded-xl shadow-lg text-sm font-brand text-white transition-all',
            t.kind === 'success' ? 'bg-emerald-600' : 'bg-rose-600',
          ].join(' ')}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AutomationTimeline() {
  const { event, loading: eventLoading } = useEvent(SLUG);

  const [settings, setSettings]         = useState<AutomationSettingRow[]>([]);
  const [stats, setStats]               = useState<Record<string, StageStats>>({});
  const [templates, setTemplates]       = useState<WhatsAppTemplates>({});
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [editingStage, setEditingStage] = useState<StageName | null>(null);
  const [toasts, setToasts]             = useState<Toast[]>([]);

  const showToast = useCallback((message: string, kind: ToastKind = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, kind }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  }, []);

  const loadData = useCallback(async (eventId: string) => {
    const [settingsData, statsData] = await Promise.all([
      fetchAutomationSettings(eventId),
      fetchMessageStatsPerStage(eventId),
    ]);
    setSettings(settingsData as AutomationSettingRow[]);
    setStats(statsData as Record<string, StageStats>);
  }, []);

  // Initial load
  useEffect(() => {
    if (!event?.id) return;
    setLoading(true);
    // Sync templates from event
    setTemplates(((event as any).content_config?.whatsapp_templates ?? {}) as WhatsAppTemplates);
    loadData(event.id).finally(() => setLoading(false));
  }, [event?.id, loadData]);

  const handleRefresh = async () => {
    if (!event?.id) return;
    setRefreshing(true);
    try {
      await loadData(event.id);
      showToast('הנתונים עודכנו');
    } catch {
      showToast('שגיאה בטעינת הנתונים', 'error');
    } finally {
      setRefreshing(false);
    }
  };

  const handleToggle = async (settingId: string, currentValue: boolean) => {
    // Optimistic update
    setSettings(prev => prev.map(s =>
      s.id === settingId ? { ...s, is_active: !currentValue } : s
    ));
    try {
      await updateAutomationSetting(settingId, { is_active: !currentValue });
      showToast('ההגדרה עודכנה');
    } catch {
      // Revert
      setSettings(prev => prev.map(s =>
        s.id === settingId ? { ...s, is_active: currentValue } : s
      ));
      showToast('שגיאה בשמירה', 'error');
    }
  };

  const handleDaysSave = async (settingId: string, newDays: number) => {
    setSettings(prev => prev.map(s =>
      s.id === settingId ? { ...s, days_before: newDays } : s
    ));
    try {
      await updateAutomationSetting(settingId, { days_before: newDays });
      showToast('הגדרת הזמן עודכנה');
    } catch {
      showToast('שגיאה בשמירת הזמן', 'error');
      // Refresh to restore correct value
      if (event?.id) await loadData(event.id);
    }
  };

  const handleTemplateSaved = (stage: StageName, singular: string, plural: string) => {
    setTemplates(prev => ({ ...prev, [stage]: { singular, plural } }));
    showToast('הטקסט נשמר');
  };

  // Sort by days_before descending (icebreaker first)
  const sorted = [...settings].sort((a, b) => b.days_before - a.days_before);

  // Split: nodes with days_before > 0 are "before the event", <= 0 are "after"
  const beforeEvent = sorted.filter(s => s.days_before > 0);
  const afterEvent  = sorted.filter(s => s.days_before <= 0);

  const eventDate = (event as any)?.event_date ? new Date((event as any).event_date) : null;

  const isEmpty = !loading && !eventLoading && settings.length === 0;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-brand" dir="rtl">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 bg-violet-600 rounded-lg flex items-center justify-center shrink-0">
              <Calendar className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-bold text-slate-800 font-danidin leading-none">
                ציר זמן אוטומציה
              </h1>
              <p className="text-xs text-slate-400 font-brand mt-0.5">{SLUG}</p>
            </div>
          </div>

          <button
            onClick={handleRefresh}
            disabled={refreshing || loading}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-brand text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50"
          >
            <RefreshCw className={['w-3.5 h-3.5', refreshing ? 'animate-spin' : ''].join(' ')} />
            רענן
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <DashboardNav />

        {/* Loading */}
        {(eventLoading || loading) && <Skeleton />}

        {/* Empty state */}
        {isEmpty && (
          <div className="text-center py-16 text-slate-400 font-brand">
            <Calendar className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">לא נמצאו שלבי אוטומציה</p>
            <p className="text-xs mt-1 opacity-70">יש להריץ את מיגרציית ה-seed במסד הנתונים</p>
          </div>
        )}

        {/* Timeline */}
        {!loading && !eventLoading && settings.length > 0 && (
          <div className="flex flex-col">
            {/* Before-event stages */}
            {beforeEvent.map((setting, idx) => (
              <div key={setting.id}>
                <StageNode
                  setting={setting}
                  stats={stats[setting.stage_name]}
                  onToggle={handleToggle}
                  onDaysSave={handleDaysSave}
                  onEditText={setEditingStage}
                />
                {idx < beforeEvent.length - 1 && <Connector />}
              </div>
            ))}

            {/* Event Day anchor */}
            {beforeEvent.length > 0 && <Connector />}
            <EventDayAnchor date={eventDate} />
            {afterEvent.length > 0 && <Connector />}

            {/* After-event stages */}
            {afterEvent.map((setting, idx) => (
              <div key={setting.id}>
                <StageNode
                  setting={setting}
                  stats={stats[setting.stage_name]}
                  onToggle={handleToggle}
                  onDaysSave={handleDaysSave}
                  onEditText={setEditingStage}
                />
                {idx < afterEvent.length - 1 && <Connector />}
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Template editor sheet */}
      {event?.id && (
        <TemplateEditorSheet
          stageName={editingStage}
          templates={templates}
          eventId={event.id}
          onClose={() => setEditingStage(null)}
          onSaved={handleTemplateSaved}
        />
      )}

      <ToastContainer toasts={toasts} />
    </div>
  );
}
