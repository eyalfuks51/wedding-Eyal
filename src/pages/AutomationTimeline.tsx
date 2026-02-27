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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEvent } from '../hooks/useEvent';
import {
  fetchAutomationSettings,
  fetchMessageStatsPerStage,
  fetchAutomatedAudienceCounts,
  updateAutomationSetting,
  updateWhatsAppTemplate,
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
): { dateStr: string; weekday: string; shortDate: string; shortDay: string; isFridayOrShabbat: boolean; raw: Date } | null {
  if (!eventDate) return null;
  const d = new Date(eventDate);
  d.setDate(d.getDate() - daysBefore);
  const day = d.getDay(); // 0=Sun … 5=Fri, 6=Sat
  return {
    dateStr: d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    weekday: d.toLocaleDateString('he-IL', { weekday: 'short' }),
    shortDate: d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' }),
    shortDay: d.toLocaleDateString('he-IL', { weekday: 'short' }),
    isFridayOrShabbat: day === 5 || day === 6,
    raw: d,
  };
}

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
  const hasDraggedRef = useRef(false);
  const pointerIdRef = useRef<number | null>(null);
  const isDownRef = useRef(false);

  // Snap: find the cell whose center is closest to the container center, scroll it there
  const snapToNearest = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const cells = el.querySelectorAll<HTMLElement>('[data-pipeline-cell]');
    if (cells.length === 0) return;

    const containerRect = el.getBoundingClientRect();
    const containerCenter = containerRect.left + containerRect.width / 2;
    let bestCell: HTMLElement | null = null;
    let bestDist = Infinity;

    cells.forEach(cell => {
      const r = cell.getBoundingClientRect();
      const cellCenter = r.left + r.width / 2;
      const dist = Math.abs(cellCenter - containerCenter);
      if (dist < bestDist) { bestDist = dist; bestCell = cell; }
    });

    if (bestCell) {
      const r = (bestCell as HTMLElement).getBoundingClientRect();
      const cellCenter = r.left + r.width / 2;
      let delta = cellCenter - containerCenter;
      // Clamp: don't scroll past boundaries
      const maxScrollLeft = el.scrollWidth - el.clientWidth;
      const newScrollLeft = el.scrollLeft + delta;
      if (newScrollLeft < 0) delta = -el.scrollLeft;
      else if (newScrollLeft > maxScrollLeft) delta = maxScrollLeft - el.scrollLeft;
      if (Math.abs(delta) > 1) {
        el.scrollBy({ left: delta, behavior: 'smooth' });
      }
    }
  }, [ref]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (!ref.current) return;
    isDownRef.current = true;
    hasDraggedRef.current = false;
    pointerIdRef.current = e.pointerId;
    startState.current = { x: e.clientX, scrollLeft: ref.current.scrollLeft };
  }, [ref]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDownRef.current || !ref.current) return;
    const dx = e.clientX - startState.current.x;

    if (!hasDraggedRef.current) {
      if (Math.abs(dx) < 5) return;
      hasDraggedRef.current = true;
      setIsDragging(true);
      if (pointerIdRef.current !== null) {
        try { ref.current.setPointerCapture(pointerIdRef.current); } catch { /* ignore */ }
      }
    }

    ref.current.scrollLeft = startState.current.scrollLeft - dx;
  }, [ref]);

  const onPointerUp = useCallback(() => {
    const wasDrag = hasDraggedRef.current;
    isDownRef.current = false;
    setIsDragging(false);
    pointerIdRef.current = null;
    if (wasDrag) snapToNearest();
  }, [snapToNearest]);

  return { onPointerDown, onPointerMove, onPointerUp, isDragging, hasDragged: hasDraggedRef, snapToNearest };
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

// ─── Desktop: Stage Column ───────────────────────────────────────────────────

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
  const meta = STAGE_META[setting.stage_name];
  const status = getStageStatus(setting, stats);
  const dateInfo = computeStageDate(eventDate, setting.days_before);
  const relativeTime = computeRelativeTime(eventDate, setting.days_before);

  const msgStatLine = (() => {
    if (!stats || (stats.sent === 0 && stats.pending === 0 && stats.failed === 0)) {
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

  return (
    <div className="flex flex-col items-center w-full">
      {/* Fixed-height card wrapper — keeps connector at same Y across all columns */}
      <div className="h-[10rem] flex items-start justify-center">
        <div
          className={cn(
            'rounded-2xl border p-4 transition-all cursor-pointer',
            'hover:shadow-md hover:border-violet-200',
            isFocus
              ? 'w-52 border-2 border-violet-500 shadow-xl shadow-violet-200/40 ring-4 ring-violet-200 bg-violet-50/50'
              : 'w-44',
            !isFocus && STATUS_CARD_CLASSES[status],
            !isFocus && status === 'disabled' && 'bg-slate-50 opacity-60',
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
          {/* Message stat line — clickable → opens stage logs */}
          {msgStatLine && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onDrilldown(setting.stage_name, 'all'); }}
              className={cn(
                'text-xs font-brand font-medium mt-1.5 hover:underline cursor-pointer',
                status === 'sent' ? 'text-emerald-600' :
                status === 'active' ? 'text-violet-600' :
                'text-slate-500',
              )}
            >
              {msgStatLine}
            </button>
          )}
          {/* Time indicators */}
          <div className="mt-2 pt-2 border-t border-slate-100">
            {relativeTime && (
              <p className="text-[11px] text-slate-600 font-brand font-medium leading-snug">
                {relativeTime}
              </p>
            )}
            {dateInfo && (
              <p className="text-[10px] text-slate-400 font-brand mt-0.5">
                {dateInfo.shortDay} {dateInfo.shortDate}
              </p>
            )}
            {dateInfo?.isFridayOrShabbat && status === 'scheduled' && (
              <p className="text-[10px] text-amber-500 font-brand mt-0.5">
                ישלח לאחר שבת
              </p>
            )}
          </div>
        </div>
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
    </div>
  );
}

// ─── Desktop: Event Day Column ───────────────────────────────────────────────

function EventDayColumn({ date, isFirst, isLast }: { date: Date | null; isFirst: boolean; isLast: boolean }) {
  const dateLabel = date
    ? date.toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;
  const shortLabel = date
    ? `${date.toLocaleDateString('he-IL', { weekday: 'short' })} ${date.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' })}`
    : null;

  return (
    <div className="flex flex-col items-center w-full">
      {/* Fixed-height card wrapper — matches StageColumn height */}
      <div className="h-[10rem] flex items-start justify-center">
        <div className="w-44 rounded-2xl bg-violet-600 text-white p-4 shadow-md flex flex-col justify-center">
          <div className="flex items-center gap-2 mb-1">
            <Calendar className="w-4 h-4 opacity-80" />
            <span className="font-danidin text-base leading-none">יום האירוע</span>
          </div>
          <p className="text-xs opacity-80 font-brand">{dateLabel ?? '—'}</p>
          {shortLabel && (
            <p className="text-[11px] opacity-60 font-brand mt-1">{shortLabel}</p>
          )}
        </div>
      </div>

      {/* Diamond icon row with horizontal connectors */}
      <div className="w-px h-4 bg-slate-200" />
      <div className="w-full flex items-center">
        <div className={cn('flex-1 h-px', !isFirst ? 'bg-slate-200' : '')} />
        <div className="w-10 h-10 flex items-center justify-center shrink-0">
          <div className="w-6 h-6 bg-violet-600 rotate-45 rounded-[4px] shadow-sm shadow-violet-300/60" />
        </div>
        <div className={cn('flex-1 h-px', !isLast ? 'bg-slate-200' : '')} />
      </div>
    </div>
  );
}

// ─── Desktop: Add Nudge Overlay Button ──────────────────────────────────────
// Rendered between two 20%-cells; absolutely positioned on the connector line.
// The parent cell uses `relative` + zero width so it doesn't consume pipeline space.

function AddNudgeOverlay({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
  return (
    <div className="relative w-0 shrink-0 flex items-start" style={{ zIndex: 10 }}>
      {/* Position the button centered on the icon-row:
          card wrapper h-[10rem] (160px) + vertical line h-4 (16px) + half icon (20px) = 196px.
          Subtract half button height (16px) = 180px from top. */}
      <button
        onClick={e => { e.stopPropagation(); onClick(); }}
        disabled={disabled}
        className={cn(
          'absolute -translate-x-1/2 left-0',
          'w-8 h-8 rounded-full flex items-center justify-center',
          'bg-violet-600 text-white shadow-md',
          'hover:bg-violet-700 hover:scale-110 transition-all',
          'disabled:opacity-30 disabled:cursor-not-allowed',
        )}
        style={{ top: '180px' }}
        title="הוסף תזכורת"
      >
        <Plus className="w-4 h-4" />
      </button>
    </div>
  );
}

// ─── Mobile: Stage Card ──────────────────────────────────────────────────────

function MobileStageCard({
  setting,
  stats,
  eventDate,
  audienceCounts,
  onToggle,
  onEdit,
  onDrilldown,
}: {
  setting: AutomationSettingRow;
  stats?: StageStats;
  eventDate: Date | null;
  audienceCounts: { pending: number; attending: number };
  onToggle: (id: string, current: boolean) => void;
  onEdit: (setting: AutomationSettingRow) => void;
  onDrilldown: (stage: StageName, filter: DrilldownFilter) => void;
}) {
  const meta = STAGE_META[setting.stage_name];
  const status = getStageStatus(setting, stats);
  const dateInfo = computeStageDate(eventDate, setting.days_before);
  const relativeTime = computeRelativeTime(eventDate, setting.days_before);

  const msgStatLine = (() => {
    if (!stats || (stats.sent === 0 && stats.pending === 0 && stats.failed === 0)) {
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
        {dateInfo?.isFridayOrShabbat && status === 'scheduled' && (
          <span className="inline-flex items-center text-[10px] text-amber-500 font-brand">
            ישלח לאחר שבת
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

      {/* Row 3: message stat line */}
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
    <div className="hidden lg:flex items-start py-6 animate-pulse" dir="rtl">
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="w-[20%] shrink-0 flex flex-col items-center">
          <div className="h-[10rem] flex items-start justify-center">
            <div className="w-44 rounded-2xl border border-slate-100 p-4">
              <div className="flex justify-between mb-2">
                <div className="h-5 w-14 bg-slate-200 rounded-full" />
                <div className="h-5 w-9 bg-slate-200 rounded-full" />
              </div>
              <div className="h-3 w-28 bg-slate-100 rounded mt-2" />
              <div className="h-3 w-20 bg-slate-100 rounded mt-3" />
              <div className="h-2 w-16 bg-slate-50 rounded mt-1" />
            </div>
          </div>
          <div className="w-px h-4 bg-slate-100" />
          <div className="w-full flex items-center">
            <div className={cn('flex-1 h-px', i > 1 ? 'bg-slate-100' : '')} />
            <div className="w-10 h-10 bg-slate-200 rounded-full shrink-0" />
            <div className={cn('flex-1 h-px', i < 5 ? 'bg-slate-100' : '')} />
          </div>
          <div className="w-px h-3 bg-slate-100" />
          <div className="h-3 w-16 bg-slate-100 rounded mt-1" />
        </div>
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
  const [audienceCounts, setAudienceCounts] = useState<{ pending: number; attending: number }>({ pending: 0, attending: 0 });
  const [templates, setTemplates]     = useState<WhatsAppTemplates>({});
  const [loading, setLoading]         = useState(true);
  const [refreshing, setRefreshing]   = useState(false);
  const [autoPilot, setAutoPilot]     = useState(true);
  const [editSetting, setEditSetting] = useState<AutomationSettingRow | null>(null);
  const [drilldown, setDrilldown]     = useState<StageLogsDrilldown | null>(null);
  const [toasts, setToasts]           = useState<Toast[]>([]);
  const [draftNudge, setDraftNudge] = useState<{ stage_name: string; days_before: number } | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const drag = useDragScroll(scrollRef);

  const showToast = useCallback((message: string, kind: ToastKind = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, kind }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  }, []);

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

  const handleDraftNudgeSaved = async (updates: { is_active?: boolean; days_before?: number; singular?: string; plural?: string }) => {
    if (!draftNudge || !event?.id) return;
    try {
      await addDynamicNudge(event.id, draftNudge.stage_name, updates.days_before ?? draftNudge.days_before);
      if (updates.singular !== undefined || updates.plural !== undefined) {
        await updateWhatsAppTemplate(event.id, draftNudge.stage_name, updates.singular ?? '', updates.plural ?? '');
      }
      await loadData(event.id);
      showToast('תזכורת חדשה נוספה');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'שגיאה בהוספת תזכורת', 'error');
    } finally {
      setDraftNudge(null);
    }
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

  const handleAddNudge = () => {
    if (!event?.id || !canAddNudge) return;
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

    // Create a local draft (not in DB yet) and open the modal
    const draft: AutomationSettingRow = {
      id: `draft-${nextName}`,
      event_id: event.id,
      stage_name: nextName as AutomationSettingRow['stage_name'],
      days_before: defaultDays,
      target_status: 'pending',
      is_active: true,
      created_at: new Date().toISOString(),
    };
    setDraftNudge({ stage_name: nextName, days_before: defaultDays });
    setEditSetting(draft);
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
                'flex items-start overflow-x-auto overflow-y-hidden scrollbar-hide py-6',
                drag.isDragging ? 'cursor-grabbing' : 'cursor-grab',
              )}
              dir="rtl"
              onPointerDown={drag.onPointerDown}
              onPointerMove={drag.onPointerMove}
              onPointerUp={drag.onPointerUp}
            >
              {/* Leading spacer (right edge in RTL) */}
              <div className="w-16 shrink-0" aria-hidden="true" />

              {(() => {
                const realNodes = pipelineNodes.filter(n => n.type !== 'add-nudge');

                return pipelineNodes.map((node) => {
                  if (node.type === 'add-nudge') {
                    return (
                      <AddNudgeOverlay
                        key="add-nudge"
                        onClick={handleAddNudge}
                        disabled={!canAddNudge}
                      />
                    );
                  }

                  const realIdx = realNodes.indexOf(node);
                  const isFirst = realIdx === 0;
                  const isLast = realIdx === realNodes.length - 1;
                  const key = node.type === 'stage' ? node.setting.id : 'event';
                  const cellId = node.type === 'stage'
                    ? `stage-${node.setting.stage_name}`
                    : 'event-day';

                  return (
                    <div
                      key={key}
                      id={cellId}
                      data-pipeline-cell
                      className="w-[20%] shrink-0 flex flex-col items-center"
                    >
                      {node.type === 'event' && (
                        <EventDayColumn date={eventDate} isFirst={isFirst} isLast={isLast} />
                      )}
                      {node.type === 'stage' && (
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
                      )}
                    </div>
                  );
                });
              })()}

              {/* Trailing spacer (left edge in RTL) */}
              <div className="w-16 shrink-0" aria-hidden="true" />
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
                    audienceCounts={audienceCounts}
                    onToggle={handleToggle}
                    onEdit={setEditSetting}
                    onDrilldown={handleDrilldown}
                  />
                  {/* Add nudge button after last nudge, before ultimatum */}
                  {isNudgeType && nextIsUltimatum && (
                    <>
                      <VerticalConnector />
                      <MobileAddNudge onClick={handleAddNudge} disabled={!canAddNudge} />
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
                  audienceCounts={audienceCounts}
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
          canDelete={!draftNudge && editIsDynamicNudge && !editSettingHasLogs}
          onClose={() => { setEditSetting(null); setDraftNudge(null); }}
          onSaved={draftNudge ? handleDraftNudgeSaved : handleEditSaved}
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

      <ToastContainer toasts={toasts} />
    </div>
  );
}
