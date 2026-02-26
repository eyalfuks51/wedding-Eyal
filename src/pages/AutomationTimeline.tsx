import { useState, useEffect, useCallback, useRef, Fragment, useMemo } from 'react';
import {
  Sparkles,
  Bell,
  AlertTriangle,
  MapPin,
  Heart,
  Calendar,
  RefreshCw,
  Plus,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEvent } from '../hooks/useEvent';
import {
  fetchAutomationSettings,
  fetchMessageStatsPerStage,
  updateAutomationSetting,
  toggleAutoPilot,
  addDynamicNudge,
  deleteDynamicNudge,
} from '../lib/supabase';
import {
  STAGE_META,
  DYNAMIC_NUDGE_NAMES,
  type StageName,
} from '@/components/dashboard/constants';
import DashboardNav from '@/components/dashboard/DashboardNav';
import StageEditModal from '@/components/dashboard/StageEditModal';
import StageLogsSheet, { type StageLogsDrilldown, type DrilldownFilter } from '@/components/dashboard/StageLogsSheet';

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

interface StageStats {
  sent: number;
  pending: number;
  failed: number;
}

type WhatsAppTemplates = Record<string, { singular: string; plural: string }>;

type StageStatus = 'sent' | 'active' | 'scheduled' | 'disabled';

type PipelineNode =
  | { type: 'stage'; setting: AutomationSettingRow }
  | { type: 'event' }
  | { type: 'add-nudge' };

// ─── Icon map ─────────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, React.ReactElement> = {
  Sparkles:      <Sparkles className="w-4 h-4" />,
  Bell:          <Bell className="w-4 h-4" />,
  AlertTriangle: <AlertTriangle className="w-4 h-4" />,
  MapPin:        <MapPin className="w-4 h-4" />,
  Heart:         <Heart className="w-4 h-4" />,
};

const ICON_MAP_LG: Record<string, React.ReactElement> = {
  Sparkles:      <Sparkles className="w-5 h-5" />,
  Bell:          <Bell className="w-5 h-5" />,
  AlertTriangle: <AlertTriangle className="w-5 h-5" />,
  MapPin:        <MapPin className="w-5 h-5" />,
  Heart:         <Heart className="w-5 h-5" />,
};

function getStageIcon(stageName: StageName, size: 'sm' | 'lg' = 'sm'): React.ReactElement {
  const meta = STAGE_META[stageName];
  const map = size === 'lg' ? ICON_MAP_LG : ICON_MAP;
  return map[meta.icon] ?? <Bell className={size === 'lg' ? 'w-5 h-5' : 'w-4 h-4'} />;
}

const SLUG = 'hagit-and-itai';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeStageDate(
  eventDate: Date | null,
  daysBefore: number,
): { dateStr: string; weekday: string } | null {
  if (!eventDate) return null;
  const d = new Date(eventDate);
  d.setDate(d.getDate() - daysBefore);
  return {
    dateStr: d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    weekday: d.toLocaleDateString('he-IL', { weekday: 'short' }),
  };
}

function getStageStatus(setting: AutomationSettingRow, stats?: StageStats): StageStatus {
  if (!setting.is_active) return 'disabled';
  if (stats && stats.sent > 0 && stats.pending === 0) return 'sent';
  if (stats && stats.pending > 0) return 'active';
  return 'scheduled';
}

const STATUS_LABELS: Record<StageStatus, string> = {
  sent:      'נשלח',
  active:    'בתהליך',
  scheduled: 'מתוזמן',
  disabled:  'כבוי',
};

const STATUS_PILL_CLASSES: Record<StageStatus, string> = {
  sent:      'bg-emerald-100 text-emerald-700 border-emerald-200',
  active:    'bg-violet-100 text-violet-700 border-violet-200',
  scheduled: 'bg-amber-100 text-amber-700 border-amber-200',
  disabled:  'bg-slate-100 text-slate-500 border-slate-200',
};

const STATUS_CARD_CLASSES: Record<StageStatus, string> = {
  sent:      'bg-white border-emerald-200',
  active:    'bg-white border-violet-300 shadow-sm',
  scheduled: 'bg-white border-slate-200',
  disabled:  'bg-slate-50 border-slate-100 opacity-60',
};

function findFocusStage(
  sorted: AutomationSettingRow[],
  stats: Record<string, StageStats>,
): AutomationSettingRow | null {
  return sorted.find(s => {
    if (!s.is_active) return false;
    const st = stats[s.stage_name];
    if (!st) return true; // no messages yet → upcoming
    return st.pending > 0; // still has pending messages
  }) ?? null;
}

// ─── Drag-to-Scroll Hook ─────────────────────────────────────────────────────

function useDragScroll(ref: React.RefObject<HTMLElement | null>) {
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

// ─── Toggle switch ────────────────────────────────────────────────────────────

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

// ─── Status Pill ──────────────────────────────────────────────────────────────

function StatusPill({ status }: { status: StageStatus }) {
  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium font-brand border',
      STATUS_PILL_CLASSES[status],
    )}>
      {STATUS_LABELS[status]}
    </span>
  );
}

// ─── Stats Mini-bar (clickable) ──────────────────────────────────────────────

function StatsMini({
  stats,
  onDrilldown,
  compact = false,
}: {
  stats?: StageStats;
  onDrilldown?: (filter: DrilldownFilter) => void;
  compact?: boolean;
}) {
  if (!stats || (stats.sent === 0 && stats.pending === 0 && stats.failed === 0)) return null;

  const ALL_ENTRIES = [
    { filter: 'sent'    as const, count: stats.sent,    dot: 'bg-emerald-500', label: 'נשלחו' },
    { filter: 'pending' as const, count: stats.pending, dot: 'bg-amber-400',   label: 'בתור'  },
    { filter: 'failed'  as const, count: stats.failed,  dot: 'bg-rose-500',    label: 'נכשלו' },
  ];
  const entries = ALL_ENTRIES.filter(e => e.count > 0);

  return (
    <div className={cn('flex items-center flex-wrap', compact ? 'gap-2 mt-1.5' : 'gap-3 mt-1')}>
      {entries.map(({ filter, count, dot, label }) => (
        <button
          key={filter}
          type="button"
          onClick={e => { e.stopPropagation(); onDrilldown?.(filter); }}
          className={cn(
            'inline-flex items-center gap-1 text-slate-500 hover:text-slate-800 transition-colors group',
            compact ? 'text-[10px]' : 'text-xs',
          )}
          title="לחץ לפירוט"
        >
          <span className={cn('inline-block rounded-full', dot, compact ? 'w-1 h-1' : 'w-1.5 h-1.5')} />
          <span className="group-hover:underline underline-offset-2">
            {count} {label}
          </span>
        </button>
      ))}
      {entries.length > 1 && (
        <button
          type="button"
          onClick={e => { e.stopPropagation(); onDrilldown?.('all'); }}
          className={cn(
            'text-violet-500 hover:text-violet-700 hover:underline underline-offset-2 transition-colors',
            compact ? 'text-[10px]' : 'text-xs',
          )}
        >
          הצג הכל
        </button>
      )}
    </div>
  );
}

// ─── Horizontal Connector ────────────────────────────────────────────────────

function HorizontalConnector() {
  return <div className="w-12 h-px bg-slate-200 shrink-0 self-center" style={{ marginTop: '-28px' }} />;
}

// ─── Desktop: Stage Column ───────────────────────────────────────────────────

function StageColumn({
  setting,
  stats,
  isFocus,
  eventDate,
  onToggle,
  onEdit,
  onDrilldown,
}: {
  setting: AutomationSettingRow;
  stats?: StageStats;
  isFocus: boolean;
  eventDate: Date | null;
  onToggle: (id: string, current: boolean) => void;
  onEdit: (setting: AutomationSettingRow) => void;
  onDrilldown: (stage: StageName, filter: DrilldownFilter) => void;
}) {
  const meta = STAGE_META[setting.stage_name];
  const status = getStageStatus(setting, stats);
  const dateInfo = computeStageDate(eventDate, setting.days_before);

  return (
    <div
      id={`stage-${setting.stage_name}`}
      className="flex flex-col items-center w-48 shrink-0"
    >
      {/* Card */}
      <div
        className={cn(
          'w-full rounded-2xl border p-4 transition-all cursor-pointer',
          'hover:shadow-md hover:border-violet-200',
          isFocus && 'ring-2 ring-violet-400 ring-offset-2 scale-[1.03]',
          STATUS_CARD_CLASSES[status],
        )}
        onClick={() => onEdit(setting)}
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
        {/* Stats */}
        <StatsMini
          stats={stats}
          onDrilldown={(filter) => onDrilldown(setting.stage_name, filter)}
          compact
        />
      </div>

      {/* Connector: vertical → icon circle → vertical */}
      <div className="w-px h-4 bg-slate-200" />
      <div className={cn(
        'w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors',
        setting.is_active
          ? 'bg-violet-600 border-violet-600 text-white'
          : 'bg-white border-slate-300 text-slate-400',
      )}>
        {getStageIcon(setting.stage_name, 'lg')}
      </div>
      <div className="w-px h-3 bg-slate-200" />

      {/* Label + date */}
      <p className="text-xs font-medium text-slate-700 font-brand text-center mt-1 leading-tight">
        {meta.label}
      </p>
      {dateInfo && (
        <p className="text-[11px] text-slate-400 font-brand text-center mt-0.5">
          {dateInfo.weekday} {dateInfo.dateStr}
        </p>
      )}
    </div>
  );
}

// ─── Desktop: Event Day Column ───────────────────────────────────────────────

function EventDayColumn({ date }: { date: Date | null }) {
  const dateLabel = date
    ? date.toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  return (
    <div id="event-day" className="flex flex-col items-center w-48 shrink-0">
      {/* Card */}
      <div className="w-full rounded-2xl bg-violet-600 text-white p-4 shadow-md">
        <div className="flex items-center gap-2 mb-1">
          <Calendar className="w-4 h-4 opacity-80" />
          <span className="font-danidin text-base leading-none">יום האירוע</span>
        </div>
        <p className="text-xs opacity-80 font-brand">{dateLabel ?? '—'}</p>
      </div>

      {/* Diamond icon on the line */}
      <div className="w-px h-4 bg-slate-200" />
      <div className="w-10 h-10 flex items-center justify-center">
        <div className="w-6 h-6 bg-violet-600 rotate-45 rounded-[4px] shadow-sm shadow-violet-300/60" />
      </div>
      <div className="w-px h-3 bg-slate-200" />

      <p className="text-xs font-semibold text-violet-700 font-brand text-center mt-1">יום האירוע</p>
      {date && (
        <p className="text-[11px] text-slate-400 font-brand text-center mt-0.5">
          {date.toLocaleDateString('he-IL', { weekday: 'short' })}{' '}
          {date.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' })}
        </p>
      )}
    </div>
  );
}

// ─── Desktop: Add Nudge Button ───────────────────────────────────────────────

function AddNudgeColumn({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
  return (
    <div className="flex flex-col items-center w-20 shrink-0">
      {/* Spacer to align with card area */}
      <div className="h-[88px]" />

      {/* Button on the line */}
      <div className="w-px h-4 bg-slate-200" />
      <button
        onClick={onClick}
        disabled={disabled}
        className={cn(
          'w-10 h-10 rounded-full flex flex-col items-center justify-center',
          'border-2 border-dashed border-slate-300 text-slate-400',
          'hover:border-violet-400 hover:text-violet-500 transition-colors',
          'disabled:opacity-30 disabled:cursor-not-allowed',
        )}
        title="הוסף תזכורת"
      >
        <Plus className="w-4 h-4" />
      </button>
      <div className="w-px h-3 bg-slate-200" />

      <p className="text-[10px] text-slate-400 font-brand text-center mt-1">+ תזכורת</p>
    </div>
  );
}

// ─── Mobile: Stage Card ──────────────────────────────────────────────────────

function MobileStageCard({
  setting,
  stats,
  eventDate,
  onToggle,
  onEdit,
  onDrilldown,
}: {
  setting: AutomationSettingRow;
  stats?: StageStats;
  eventDate: Date | null;
  onToggle: (id: string, current: boolean) => void;
  onEdit: (setting: AutomationSettingRow) => void;
  onDrilldown: (stage: StageName, filter: DrilldownFilter) => void;
}) {
  const meta = STAGE_META[setting.stage_name];
  const status = getStageStatus(setting, stats);
  const dateInfo = computeStageDate(eventDate, setting.days_before);

  return (
    <div
      className={cn(
        'rounded-2xl border p-4 transition-all cursor-pointer',
        'border-r-4',
        setting.is_active ? 'border-r-violet-500' : 'border-r-slate-200',
        STATUS_CARD_CLASSES[status],
      )}
      onClick={() => onEdit(setting)}
    >
      {/* Row 1: icon + label + status pill + toggle */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className={cn(
            'flex items-center justify-center w-7 h-7 rounded-full shrink-0',
            setting.is_active ? 'bg-violet-100 text-violet-600' : 'bg-slate-100 text-slate-400',
          )}>
            {getStageIcon(setting.stage_name)}
          </span>
          <span className="font-semibold text-sm text-slate-800 font-brand truncate">{meta.label}</span>
          <StatusPill status={status} />
        </div>
        <Toggle checked={setting.is_active} onChange={() => onToggle(setting.id, setting.is_active)} />
      </div>

      {/* Row 2: date + target */}
      <div className="flex items-center gap-2 mt-2.5 flex-wrap">
        {dateInfo && (
          <span className="inline-flex items-center text-xs text-slate-500 font-brand">
            {dateInfo.weekday} {dateInfo.dateStr}
          </span>
        )}
        <span className={cn(
          'inline-flex items-center text-[11px] rounded-full px-2 py-0.5 border font-brand',
          setting.target_status === 'attending'
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
            : 'bg-amber-50 text-amber-700 border-amber-200',
        )}>
          {setting.target_status === 'attending' ? 'מגיעים' : 'ממתינים'}
        </span>
      </div>

      {/* Row 3: clickable stats */}
      <StatsMini
        stats={stats}
        onDrilldown={(filter) => onDrilldown(setting.stage_name, filter)}
      />
    </div>
  );
}

// ─── Mobile: Event Day ───────────────────────────────────────────────────────

function MobileEventDay({ date }: { date: Date | null }) {
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

// ─── Mobile: Add Nudge Button ────────────────────────────────────────────────

function MobileAddNudge({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'w-full rounded-2xl border-2 border-dashed border-slate-300 py-3',
        'flex items-center justify-center gap-2',
        'text-sm text-slate-400 font-brand',
        'hover:border-violet-400 hover:text-violet-500 transition-colors',
        'disabled:opacity-30 disabled:cursor-not-allowed',
      )}
    >
      <Plus className="w-4 h-4" />
      הוסף תזכורת
    </button>
  );
}

// ─── Mobile: Vertical connector ──────────────────────────────────────────────

function VerticalConnector() {
  return <div className="w-0.5 h-5 bg-slate-200 mx-auto" />;
}

// ─── Loading Skeletons ───────────────────────────────────────────────────────

function DesktopSkeleton() {
  return (
    <div className="hidden lg:flex items-start gap-0 py-6 px-8 animate-pulse">
      {[1, 2, 3, 4, 5, 6].map(i => (
        <Fragment key={i}>
          {i > 1 && <div className="w-12 h-px bg-slate-200 shrink-0 self-center mt-10" />}
          <div className="flex flex-col items-center w-48 shrink-0">
            <div className="w-full rounded-2xl border border-slate-100 p-4">
              <div className="flex justify-between mb-2">
                <div className="h-5 w-14 bg-slate-200 rounded-full" />
                <div className="h-5 w-9 bg-slate-200 rounded-full" />
              </div>
              <div className="h-3 w-28 bg-slate-100 rounded mt-2" />
            </div>
            <div className="w-px h-4 bg-slate-100" />
            <div className="w-10 h-10 bg-slate-200 rounded-full" />
            <div className="w-px h-3 bg-slate-100" />
            <div className="h-3 w-16 bg-slate-100 rounded mt-1" />
          </div>
        </Fragment>
      ))}
    </div>
  );
}

function MobileSkeleton() {
  return (
    <div className="lg:hidden space-y-3 animate-pulse">
      {[1, 2, 3].map(i => (
        <div key={i} className="rounded-2xl border border-slate-100 p-4 bg-white">
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
      ))}
    </div>
  );
}

// ─── Toast ───────────────────────────────────────────────────────────────────

type ToastKind = 'success' | 'error';
interface Toast { id: number; message: string; kind: ToastKind }

function ToastContainer({ toasts }: { toasts: Toast[] }) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] flex flex-col gap-2 items-center pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          className={cn(
            'px-4 py-2.5 rounded-xl shadow-lg text-sm font-brand text-white',
            t.kind === 'success' ? 'bg-emerald-600' : 'bg-rose-600',
          )}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function AutomationTimeline() {
  const { event, loading: eventLoading } = useEvent(SLUG);

  const [settings, setSettings]       = useState<AutomationSettingRow[]>([]);
  const [stats, setStats]             = useState<Record<string, StageStats>>({});
  const [templates, setTemplates]     = useState<WhatsAppTemplates>({});
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [autoPilot, setAutoPilot]     = useState(true);
  const [editSetting, setEditSetting] = useState<AutomationSettingRow | null>(null);
  const [drilldown, setDrilldown]     = useState<StageLogsDrilldown | null>(null);
  const [toasts, setToasts]           = useState<Toast[]>([]);
  const [addingNudge, setAddingNudge] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const drag = useDragScroll(scrollRef);

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
    setTemplates(((event as any).content_config?.whatsapp_templates ?? {}) as WhatsAppTemplates);
    setAutoPilot((event as any).automation_config?.auto_pilot ?? true);
    loadData(event.id).finally(() => setLoading(false));
  }, [event?.id, loadData]);

  // ── Derived data ──

  const sorted = useMemo(
    () => [...settings].sort((a, b) => b.days_before - a.days_before),
    [settings],
  );

  const beforeEvent = useMemo(() => sorted.filter(s => s.days_before > 0), [sorted]);
  const afterEvent  = useMemo(() => sorted.filter(s => s.days_before <= 0), [sorted]);
  const eventDate   = (event as any)?.event_date ? new Date((event as any).event_date) : null;
  const isEmpty     = !loading && !eventLoading && settings.length === 0;

  const dynamicNudgeCount = useMemo(
    () => settings.filter(s => (DYNAMIC_NUDGE_NAMES as readonly string[]).includes(s.stage_name)).length,
    [settings],
  );
  const canAddNudge = dynamicNudgeCount < 3;

  const focusStage = useMemo(() => findFocusStage(sorted, stats), [sorted, stats]);
  const focusId = focusStage ? `stage-${focusStage.stage_name}` : 'event-day';

  // Build the pipeline node array (RTL: rightmost = first chronologically)
  const pipelineNodes = useMemo<PipelineNode[]>(() => {
    const nodes: PipelineNode[] = [];

    // Before-event stages (highest days_before first = rightmost in RTL)
    for (let i = 0; i < beforeEvent.length; i++) {
      nodes.push({ type: 'stage', setting: beforeEvent[i] });

      // Insert "add nudge" button after the last nudge-type and before ultimatum
      const isNudgeType = beforeEvent[i].stage_name === 'nudge' || beforeEvent[i].stage_name.startsWith('nudge_');
      const nextIsUltimatum = i + 1 < beforeEvent.length && beforeEvent[i + 1].stage_name === 'ultimatum';
      if (isNudgeType && nextIsUltimatum) {
        nodes.push({ type: 'add-nudge' });
      }
    }

    // Event day
    nodes.push({ type: 'event' });

    // After-event stages
    for (const s of afterEvent) {
      nodes.push({ type: 'stage', setting: s });
    }

    return nodes;
  }, [beforeEvent, afterEvent]);

  // ── Smart Focus Snapping ──

  useEffect(() => {
    if (loading || !scrollRef.current || settings.length === 0) return;

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
  }, [loading, focusId, settings.length]);

  // ── Handlers ──

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

  const handleAutoPilotToggle = async () => {
    if (!event?.id) return;
    const newValue = !autoPilot;
    setAutoPilot(newValue); // optimistic
    try {
      await toggleAutoPilot(event.id, newValue);
      showToast(newValue ? 'טייס אוטומטי פעיל' : 'טייס אוטומטי מושבת');
    } catch {
      setAutoPilot(!newValue); // revert
      showToast('שגיאה בעדכון הטייס האוטומטי', 'error');
    }
  };

  const handleToggle = async (settingId: string, currentValue: boolean) => {
    setSettings(prev => prev.map(s =>
      s.id === settingId ? { ...s, is_active: !currentValue } : s
    ));
    try {
      await updateAutomationSetting(settingId, { is_active: !currentValue });
      showToast('ההגדרה עודכנה');
    } catch {
      setSettings(prev => prev.map(s =>
        s.id === settingId ? { ...s, is_active: currentValue } : s
      ));
      showToast('שגיאה בשמירה', 'error');
    }
  };

  const handleEditSaved = (updates: { is_active?: boolean; days_before?: number; singular?: string; plural?: string }) => {
    if (!editSetting) return;
    // Update settings state
    if (updates.is_active !== undefined || updates.days_before !== undefined) {
      setSettings(prev => prev.map(s =>
        s.id === editSetting.id
          ? { ...s, ...(updates.is_active !== undefined && { is_active: updates.is_active }), ...(updates.days_before !== undefined && { days_before: updates.days_before }) }
          : s
      ));
    }
    // Update templates state
    if (updates.singular !== undefined || updates.plural !== undefined) {
      setTemplates(prev => ({
        ...prev,
        [editSetting.stage_name]: {
          singular: updates.singular ?? prev[editSetting.stage_name]?.singular ?? '',
          plural: updates.plural ?? prev[editSetting.stage_name]?.plural ?? '',
        },
      }));
    }
    showToast('ההגדרות נשמרו');
  };

  const handleDeleteNudge = async () => {
    if (!editSetting || !event?.id) return;
    try {
      await deleteDynamicNudge(editSetting.id);
      setEditSetting(null);
      await loadData(event.id);
      showToast('התזכורת נמחקה');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'שגיאה במחיקת התזכורת', 'error');
    }
  };

  const handleAddNudge = async () => {
    if (!event?.id || !canAddNudge) return;
    setAddingNudge(true);
    try {
      // Find next available dynamic nudge name
      const existing = settings.map(s => s.stage_name);
      const nextName = (['nudge_1', 'nudge_2', 'nudge_3'] as const).find(n => !existing.includes(n));
      if (!nextName) return;

      // Compute default days_before: midpoint between last nudge and ultimatum
      const nudges = sorted.filter(s => s.stage_name === 'nudge' || s.stage_name.startsWith('nudge_'));
      const ultimatum = sorted.find(s => s.stage_name === 'ultimatum');
      const lastNudgeDays = nudges.length > 0 ? Math.min(...nudges.map(n => n.days_before)) : 7;
      const ultimatumDays = ultimatum?.days_before ?? 3;
      const defaultDays = Math.round((lastNudgeDays + ultimatumDays) / 2);

      const newSetting = await addDynamicNudge(event.id, nextName, defaultDays);
      await loadData(event.id);
      // Open the edit modal immediately
      setEditSetting(newSetting as AutomationSettingRow);
      showToast('תזכורת חדשה נוספה');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'שגיאה בהוספת תזכורת', 'error');
    } finally {
      setAddingNudge(false);
    }
  };

  const handleDrilldown = (stageName: StageName, filter: DrilldownFilter) => {
    setDrilldown({ stageName, filter });
  };

  // Check if editing setting has message_logs (for delete permission)
  const editSettingHasLogs = editSetting
    ? (stats[editSetting.stage_name]?.sent ?? 0) + (stats[editSetting.stage_name]?.pending ?? 0) + (stats[editSetting.stage_name]?.failed ?? 0) > 0
    : false;

  const editIsDynamicNudge = editSetting
    ? (DYNAMIC_NUDGE_NAMES as readonly string[]).includes(editSetting.stage_name)
    : false;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-brand" dir="rtl">
      {/* ── Header ── */}
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
            <RefreshCw className={cn('w-3.5 h-3.5', refreshing && 'animate-spin')} />
            רענן
          </button>
        </div>
      </header>

      {/* ── Main content ── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <DashboardNav />

        {/* ── Auto-Pilot Header ── */}
        <div className="flex items-center justify-between gap-4 mb-5">
          <div>
            <h2 className="font-danidin text-xl text-slate-800">טייס אוטומטי</h2>
            <p className="text-sm text-slate-500 font-brand">
              מסע ההודעות האוטומטי לאורחים שלך עד יום החתונה
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className={cn(
              'text-xs font-brand font-medium px-2.5 py-1 rounded-full transition-colors',
              autoPilot ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500',
            )}>
              {autoPilot ? 'פעיל' : 'מושבת'}
            </span>
            <Toggle checked={autoPilot} onChange={handleAutoPilotToggle} size="lg" />
          </div>
        </div>

        {/* Loading */}
        {(eventLoading || loading) && (
          <>
            <DesktopSkeleton />
            <MobileSkeleton />
          </>
        )}

        {/* Empty state */}
        {isEmpty && (
          <div className="text-center py-16 text-slate-400 font-brand">
            <Calendar className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">לא נמצאו שלבי אוטומציה</p>
            <p className="text-xs mt-1 opacity-70">יש להריץ את מיגרציית ה-seed במסד הנתונים</p>
          </div>
        )}

        {/* ── Desktop: Horizontal Pipeline ── */}
        {!loading && !eventLoading && settings.length > 0 && (
          <div className="hidden lg:block">
            <div
              ref={scrollRef}
              className={cn(
                'overflow-x-auto overflow-y-hidden scrollbar-hide',
                drag.isDragging ? 'cursor-grabbing' : 'cursor-grab',
              )}
              style={{ scrollBehavior: 'auto' }}
              dir="rtl"
              onPointerDown={drag.onPointerDown}
              onPointerMove={drag.onPointerMove}
              onPointerUp={drag.onPointerUp}
            >
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
            </div>
          </div>
        )}

        {/* ── Mobile: Vertical Layout ── */}
        {!loading && !eventLoading && settings.length > 0 && (
          <div className="lg:hidden flex flex-col gap-3">
            {beforeEvent.map((setting, idx) => {
              const isNudgeType = setting.stage_name === 'nudge' || setting.stage_name.startsWith('nudge_');
              const nextIsUltimatum = idx + 1 < beforeEvent.length && beforeEvent[idx + 1].stage_name === 'ultimatum';

              return (
                <Fragment key={setting.id}>
                  <MobileStageCard
                    setting={setting}
                    stats={stats[setting.stage_name]}
                    eventDate={eventDate}
                    onToggle={handleToggle}
                    onEdit={setEditSetting}
                    onDrilldown={handleDrilldown}
                  />
                  {/* Add nudge button after last nudge, before ultimatum */}
                  {isNudgeType && nextIsUltimatum && (
                    <>
                      <VerticalConnector />
                      <MobileAddNudge onClick={handleAddNudge} disabled={!canAddNudge || addingNudge} />
                    </>
                  )}
                  {idx < beforeEvent.length - 1 && <VerticalConnector />}
                </Fragment>
              );
            })}

            {beforeEvent.length > 0 && <VerticalConnector />}
            <MobileEventDay date={eventDate} />
            {afterEvent.length > 0 && <VerticalConnector />}

            {afterEvent.map((setting, idx) => (
              <Fragment key={setting.id}>
                <MobileStageCard
                  setting={setting}
                  stats={stats[setting.stage_name]}
                  eventDate={eventDate}
                  onToggle={handleToggle}
                  onEdit={setEditSetting}
                  onDrilldown={handleDrilldown}
                />
                {idx < afterEvent.length - 1 && <VerticalConnector />}
              </Fragment>
            ))}
          </div>
        )}
      </main>

      {/* ── Stage Edit Modal ── */}
      {event?.id && editSetting && (
        <StageEditModal
          setting={editSetting}
          templates={templates}
          eventId={event.id}
          eventDate={eventDate}
          isDynamicNudge={editIsDynamicNudge}
          canDelete={editIsDynamicNudge && !editSettingHasLogs}
          onClose={() => setEditSetting(null)}
          onSaved={handleEditSaved}
          onDelete={handleDeleteNudge}
        />
      )}

      {/* ── Stage Logs Drilldown ── */}
      {event?.id && (
        <StageLogsSheet
          drilldown={drilldown}
          eventId={event.id}
          onClose={() => setDrilldown(null)}
        />
      )}

      {/* Adding nudge indicator */}
      {addingNudge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
          <div className="bg-white rounded-2xl px-6 py-4 shadow-xl flex items-center gap-3 font-brand">
            <Loader2 className="w-5 h-5 animate-spin text-violet-600" />
            <span className="text-sm text-slate-700">מוסיף תזכורת...</span>
          </div>
        </div>
      )}

      <ToastContainer toasts={toasts} />
    </div>
  );
}
