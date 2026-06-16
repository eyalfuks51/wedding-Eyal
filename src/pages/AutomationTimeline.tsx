import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles, Bell, AlertTriangle, MapPin, Heart,
  Calendar, RefreshCw, Plus, Settings, Box,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEventContext } from '@/contexts/EventContext';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import {
  fetchAutomationSettings,
  fetchMessageStatsPerStage,
  fetchAutomatedAudienceCounts,
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
import SiteFooter from '@/components/brand/SiteFooter';
import { GlassCard } from '@/components/ui/glass-card';
import UpgradeModal from '@/components/ui/UpgradeModal';
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
  | { type: 'add-nudge' };

// ─── Stage Icon ───────────────────────────────────────────────────────────────

function StageIcon({ stage, size = 20 }: { stage: StageName; size?: number }) {
  const meta = STAGE_META[stage];
  const Icon = (() => {
    switch (meta.icon) {
      case 'Sparkles':      return Sparkles;
      case 'Bell':          return Bell;
      case 'AlertTriangle': return AlertTriangle;
      case 'MapPin':        return MapPin;
      case 'Heart':         return Heart;
      default:              return Bell;
    }
  })();
  return <Icon size={size} strokeWidth={1.8} />;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeStageDate(eventDate: Date | null, daysBefore: number) {
  if (!eventDate) return null;
  const d = new Date(eventDate);
  d.setDate(d.getDate() - daysBefore);
  return {
    short: d.toLocaleDateString('he-IL', { day: '2-digit', month: 'short' }),
    weekday: d.toLocaleDateString('he-IL', { weekday: 'short' }),
    isFridayOrShabbat: d.getDay() === 5 || d.getDay() === 6,
    raw: d,
  };
}

function relativeWhen(daysBefore: number): string {
  if (daysBefore === 0)  return 'יום האירוע';
  if (daysBefore === -1) return 'יום אחרי';
  if (daysBefore < 0)    return `${Math.abs(daysBefore)} ימים אחרי`;
  if (daysBefore === 1)  return 'יום לפני';
  return `${daysBefore} ימים לפני`;
}

function getStageStatus(setting: AutomationSettingRow, stats?: StageStats): StageStatus {
  if (!setting.is_active) return 'disabled';
  if (stats && stats.sent > 0 && stats.pending === 0) return 'sent';
  if (stats && stats.pending > 0) return 'active';
  return 'scheduled';
}

const STATUS_LABELS: Record<StageStatus, string> = {
  sent:      'נשלח',
  active:    'פעיל עכשיו',
  scheduled: 'מתוזמן',
  disabled:  'מושבת',
};

function findFocusStage(
  sorted: AutomationSettingRow[],
  stats: Record<string, StageStats>,
): AutomationSettingRow | null {
  return sorted.find(s => {
    if (!s.is_active) return false;
    const st = stats[s.stage_name];
    if (!st) return true;
    return st.pending > 0;
  }) ?? null;
}

interface StatDisplay {
  num: string;
  of: string | null;
  label: string;
  progress: number;
}

function buildStat(
  setting: AutomationSettingRow,
  status: StageStatus,
  stats: StageStats | undefined,
  audience: { pending: number; attending: number },
): StatDisplay {
  const target = setting.target_status === 'attending' ? audience.attending : audience.pending;
  const sent = stats?.sent ?? 0;
  const pending = stats?.pending ?? 0;
  const total = sent + pending;

  if (status === 'disabled') {
    return { num: '—', of: null, label: 'השלב כבוי · להפעיל מההגדרות', progress: 0 };
  }
  if (status === 'sent') {
    return {
      num: String(sent),
      of: total > 0 ? `/${total}` : null,
      label: 'הודעות נשלחו ליעד',
      progress: 100,
    };
  }
  if (status === 'active') {
    return {
      num: String(sent),
      of: total > 0 ? `/${total}` : null,
      label: `נשלחות עכשיו · ${pending} בתור`,
      progress: total > 0 ? Math.round((sent / total) * 100) : 0,
    };
  }
  // scheduled
  return {
    num: target > 0 ? `~${target}` : '—',
    of: null,
    label: target > 0
      ? `צפויות להישלח ל${setting.target_status === 'attending' ? 'מאשרים' : 'ממתינים'}`
      : 'אין נמענים זמינים',
    progress: 0,
  };
}

// ─── Drag-to-Scroll Hook ──────────────────────────────────────────────────────

function useDragScroll(ref: React.RefObject<HTMLElement | null>) {
  const [isDragging, setIsDragging] = useState(false);
  const startState = useRef({ x: 0, scrollLeft: 0 });
  const hasDraggedRef = useRef(false);
  const pointerIdRef = useRef<number | null>(null);
  const isDownRef = useRef(false);

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
      const delta = cellCenter - containerCenter;
      el.scrollBy({ left: delta, behavior: 'smooth' });
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

  return { onPointerDown, onPointerMove, onPointerUp, isDragging, hasDragged: hasDraggedRef };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function AutoPilotBanner({
  active, onToggle, sentCount, pendingCount,
}: {
  active: boolean;
  onToggle: () => void;
  sentCount: number;
  pendingCount: number;
}) {
  return (
    <section className="auto-pilot">
      <div className="ap-icon">
        <Box size={18} strokeWidth={1.8} />
      </div>
      <div className="ap-body">
        <div className="ap-title">
          <span className={cn('ap-status-dot', !active && 'ap-status-dot-off')} />
          {active ? 'טייס אוטומטי פעיל' : 'טייס אוטומטי כבוי'}
        </div>
        <div className="ap-divider" />
        <div className="ap-caption">
          <b>{sentCount}</b> נשלחו · <b>{pendingCount}</b> בתור
        </div>
      </div>
      <button
        className={cn('toggle-large', !active && 'off')}
        type="button"
        aria-label={active ? 'כבה טייס אוטומטי' : 'הפעל טייס אוטומטי'}
        onClick={onToggle}
      />
    </section>
  );
}

function PipelineMeta({ counts }: { counts: { sent: number; active: number; scheduled: number; disabled: number } }) {
  return (
    <div className="pipeline-meta">
      <div className="item"><span className="swatch sent" /><b>נשלח</b> · {counts.sent} שלבים</div>
      <div className="item"><span className="swatch active" /><b>פעיל עכשיו</b> · {counts.active} שלב</div>
      <div className="item"><span className="swatch scheduled" /><b>מתוזמן</b> · {counts.scheduled} שלבים</div>
      <div className="item"><span className="swatch disabled" /><b>מושבת</b> · {counts.disabled} שלב</div>
    </div>
  );
}

function StageColumn({
  setting, stats, eventDate, audience, onEdit, onLogs, hasDragged,
}: {
  setting: AutomationSettingRow;
  stats?: StageStats;
  eventDate: Date | null;
  audience: { pending: number; attending: number };
  onEdit: (s: AutomationSettingRow) => void;
  onLogs: (stage: StageName) => void;
  hasDragged: React.RefObject<boolean>;
}) {
  const meta = STAGE_META[setting.stage_name];
  const status = getStageStatus(setting, stats);
  const dateInfo = computeStageDate(eventDate, setting.days_before);
  const stat = buildStat(setting, status, stats, audience);

  const whenText = (() => {
    const rel = relativeWhen(setting.days_before);
    if (!dateInfo) return rel;
    return `${rel} · ${dateInfo.short}`;
  })();

  const targetText = setting.target_status === 'attending'
    ? 'למאשרים בלבד'
    : (setting.stage_name === 'icebreaker' ? 'לכל ההזמנות' : 'לממתינים');

  return (
    <div
      className="stage"
      data-status={status}
      data-pipeline-cell
      id={`stage-${setting.stage_name}`}
    >
      <div className="stage-circle">
        <StageIcon stage={setting.stage_name} size={20} />
      </div>
      <div className="stage-label">{meta.label}</div>
      <div className="stage-when">{whenText}</div>
      <div
        className="stage-card"
        onClick={() => { if (!hasDragged.current) onEdit(setting); }}
      >
        <span className="stage-pill"><span className="dot" />{STATUS_LABELS[status]}</span>
        <div className="stage-stats">
          <div className="stage-stat-num">
            {stat.num}
            {stat.of && <span className="of">{stat.of}</span>}
          </div>
          <div className="stage-stat-label">{stat.label}</div>
        </div>
        {status !== 'disabled' && (
          <div className="stage-progress">
            <div style={{ width: `${stat.progress}%` }} />
          </div>
        )}
        <div className="stage-bottom">
          <span className="target">{targetText}</span>
          <div className="stage-actions">
            <button
              type="button"
              className="logs"
              onClick={(e) => {
                e.stopPropagation();
                if (!hasDragged.current) onLogs(setting.stage_name);
              }}
            >
              לוגים
            </button>
            <span className="edit">{status === 'disabled' ? 'הפעל ›' : 'ערוך ›'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function AddNudgeColumn({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
  return (
    <div className="stage add-nudge" data-pipeline-cell>
      <div className="stage-circle">
        <Plus size={18} strokeWidth={2} />
      </div>
      <div className="stage-label">תזכורת נוספת</div>
      <div className="stage-when">בין שלבים</div>
      <button
        type="button"
        className="stage-card add-nudge-btn"
        onClick={onClick}
        disabled={disabled}
      >
        <div className="stage-card-add-text">+ <b>הוסף תזכורת דינמית</b></div>
        <div className="stage-card-add-text-sub">עד 3 תזכורות מותאמות</div>
      </button>
    </div>
  );
}

function MobileStageItem({
  setting, stats, eventDate, audience, onEdit, onLogs,
}: {
  setting: AutomationSettingRow;
  stats?: StageStats;
  eventDate: Date | null;
  audience: { pending: number; attending: number };
  onEdit: (s: AutomationSettingRow) => void;
  onLogs: (stage: StageName) => void;
}) {
  const meta = STAGE_META[setting.stage_name];
  const status = getStageStatus(setting, stats);
  const dateInfo = computeStageDate(eventDate, setting.days_before);
  const stat = buildStat(setting, status, stats, audience);
  const whenText = dateInfo
    ? `${relativeWhen(setting.days_before)} · ${dateInfo.short}`
    : relativeWhen(setting.days_before);
  const targetText = setting.target_status === 'attending'
    ? 'למאשרים'
    : (setting.stage_name === 'icebreaker' ? 'לכל ההזמנות' : 'לממתינים');

  return (
    <div
      className="stage-mobile"
      data-status={status}
      onClick={() => onEdit(setting)}
    >
      <div className="stage-mobile-circle">
        <StageIcon stage={setting.stage_name} size={16} />
      </div>
      <div className="stage-mobile-body">
        <div className="stage-mobile-row">
          <span className="stage-mobile-name">{meta.label}</span>
          <span className="stage-mobile-pill">{STATUS_LABELS[status]}</span>
        </div>
        <div className="stage-mobile-when">{whenText}</div>
        <div className="stage-mobile-stats">
          <span><b>{stat.num}</b>{stat.of ?? ''} {status === 'scheduled' ? 'צפויות' : 'נשלחו'}</span>
          <span>{targetText}</span>
        </div>
        <button
          type="button"
          className="stage-mobile-logs"
          onClick={(e) => {
            e.stopPropagation();
            onLogs(setting.stage_name);
          }}
        >
          לוגים
        </button>
      </div>
    </div>
  );
}

function MobileAddNudgeItem({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
  return (
    <button
      type="button"
      className="stage-mobile add-nudge"
      onClick={onClick}
      disabled={disabled}
    >
      <div className="stage-mobile-body" style={{ textAlign: 'center' }}>
        <span className="stage-mobile-name" style={{ color: 'var(--rose-gold)' }}>+ הוסף תזכורת דינמית</span>
        <div className="stage-mobile-when">עד 3 תזכורות מותאמות</div>
      </div>
    </button>
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
            t.kind === 'success' ? 'bg-sage' : 'bg-clay',
          )}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}

// ─── Page CSS ─────────────────────────────────────────────────────────────────

const TIMELINE_STYLES = `
.gtl-page {
  min-height: 100vh;
  direction: rtl;
  color: var(--ink);
  background:
    radial-gradient(circle at 84% 10%, var(--glow-rose) 0, transparent 30%),
    radial-gradient(circle at 18% 20%, var(--glow-violet) 0, transparent 28%),
    linear-gradient(180deg, var(--paper) 0%, oklch(96.5% 0.018 292) 55%, var(--paper-2) 100%);
}
.gtl-page .page { max-width: 1376px; margin: 0 auto; padding: 32px 48px 120px; }

.gtl-page .page-header { position: relative; display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; margin-bottom: 24px; padding: 24px 28px; border-radius: var(--r-lg); border: 1px solid var(--glass-line); background: linear-gradient(135deg, oklch(100% 0.004 292 / 0.96), oklch(99.5% 0.008 292 / 0.88)); backdrop-filter: var(--glass-card-blur); -webkit-backdrop-filter: var(--glass-card-blur); box-shadow: var(--shadow-soft), 0 1px 0 oklch(100% 0.005 292 / 0.78) inset; overflow: hidden; }
.gtl-page .page-header::before { content: ''; position: absolute; inset: -80px auto auto -30px; width: 250px; height: 190px; background: radial-gradient(circle, var(--glow-rose), transparent 68%); filter: blur(18px); pointer-events: none; }
.gtl-page .page-header > * { position: relative; z-index: 1; }
.gtl-page .page-header h1 { font-family: 'Danidin','Polin',sans-serif; font-weight: 700; font-size: 40px; letter-spacing: 0.01em; color: var(--ink); line-height: 1.05; }
.gtl-page .page-header .sub { margin-top: 8px; color: var(--ink-soft); font-size: 14px; }
.gtl-page .page-header .sub b { color: var(--rose-gold); font-weight: 700; }
.gtl-page .header-actions { display: flex; gap: 10px; align-items: center; }
.gtl-page .ghost-btn { display: inline-flex; align-items: center; gap: 8px; padding: 9px 14px; border-radius: var(--r-sm); background: oklch(100% 0.006 292 / 0.48); border: 1px solid var(--glass-line); font-size: 13px; font-weight: 600; color: var(--ink-soft); transition: background 200ms, color 200ms, border-color 200ms, transform 200ms; cursor: pointer; box-shadow: 0 1px 0 oklch(100% 0.005 292 / 0.58) inset; }
.gtl-page .ghost-btn:hover:not(:disabled) { background: oklch(100% 0.006 292 / 0.72); color: var(--ink); border-color: var(--champagne); transform: translateY(-1px); }
.gtl-page .ghost-btn:disabled { opacity: 0.5; cursor: not-allowed; }

.gtl-page .auto-pilot { position: relative; background: linear-gradient(90deg, oklch(100% 0.004 292 / 0.97), oklch(99.5% 0.008 292 / 0.9)); backdrop-filter: var(--glass-card-blur); -webkit-backdrop-filter: var(--glass-card-blur); border: 1px solid var(--glass-line); border-radius: 20px; padding: 14px 18px; margin-bottom: 18px; display: flex; align-items: center; gap: 14px; box-shadow: var(--shadow-soft), 0 1px 0 oklch(100% 0.005 292 / 0.78) inset; overflow: hidden; }
.gtl-page .auto-pilot::before { content: ''; position: absolute; inset: -48px auto auto -8%; width: 340px; height: 170px; background: radial-gradient(ellipse at 60% 50%, oklch(58% 0.08 150 / 0.2) 0%, transparent 65%), radial-gradient(ellipse at 30% 60%, var(--glow-violet) 0%, transparent 60%); filter: blur(42px); pointer-events: none; border-radius: 50%; z-index: 0; }
.gtl-page .auto-pilot > * { position: relative; z-index: 1; }
.gtl-page .ap-icon { width: 38px; height: 38px; border-radius: 12px; background: linear-gradient(135deg, var(--sage), oklch(45% 0.058 150)); display: flex; align-items: center; justify-content: center; color: oklch(99% 0.006 292); flex-shrink: 0; box-shadow: 0 16px 28px -22px var(--sage); }
.gtl-page .ap-body { flex: 1; min-width: 0; display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; }
.gtl-page .ap-status-dot { display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: var(--sage); box-shadow: 0 0 0 3px oklch(52% 0.13 150 / 0.18); margin-left: 6px; vertical-align: middle; }
.gtl-page .ap-status-dot-off { background: var(--ink-mute); box-shadow: 0 0 0 3px rgba(168, 159, 148, 0.18); }
.gtl-page .ap-title { font-weight: 700; font-size: 14px; color: var(--ink); line-height: 1.3; }
.gtl-page .ap-caption { font-size: 12px; color: var(--ink-soft); line-height: 1.4; }
.gtl-page .ap-caption b { color: var(--ink); font-weight: 700; }
.gtl-page .ap-divider { width: 1px; height: 14px; background: var(--glass-line); align-self: center; flex-shrink: 0; }

.gtl-page .toggle-large { position: relative; width: 58px; height: 32px; border-radius: 999px; background: var(--sage); transition: background 220ms; flex-shrink: 0; box-shadow: inset 0 1px 2px oklch(24% 0.02 292 / 0.16), 0 12px 26px -22px var(--sage); cursor: pointer; border: 1px solid oklch(100% 0.005 292 / 0.34); padding: 0; }
.gtl-page .toggle-large::after { content: ''; position: absolute; top: 3px; left: 28px; width: 26px; height: 26px; border-radius: 50%; background: oklch(99% 0.006 292); box-shadow: 0 2px 8px oklch(24% 0.02 292 / 0.2); transition: left 220ms cubic-bezier(0.32, 0.72, 0.30, 1); }
.gtl-page .toggle-large.off { background: var(--ink-mute); }
.gtl-page .toggle-large.off::after { left: 3px; }

.gtl-page .pipeline-meta { display: flex; gap: 10px; margin-bottom: 18px; flex-wrap: wrap; font-size: 12.5px; color: var(--ink-soft); }
.gtl-page .pipeline-meta .item { display: flex; align-items: center; gap: 8px; padding: 6px 10px; border-radius: var(--r-pill); background: oklch(100% 0.006 292 / 0.82); border: 1px solid var(--glass-line); }
.gtl-page .pipeline-meta b { color: var(--ink); font-weight: 700; }
.gtl-page .pipeline-meta .swatch { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
.gtl-page .pipeline-meta .swatch.sent { background: var(--sage); }
.gtl-page .pipeline-meta .swatch.active { background: var(--violet-700); }
.gtl-page .pipeline-meta .swatch.scheduled { background: var(--apricot); }
.gtl-page .pipeline-meta .swatch.disabled { background: var(--ink-mute); opacity: 0.5; }

.gtl-page .pipeline-frame { background: linear-gradient(135deg, oklch(100% 0.004 292 / 0.98), oklch(99.5% 0.008 292 / 0.9)); backdrop-filter: var(--glass-card-blur); -webkit-backdrop-filter: var(--glass-card-blur); border: 1px solid var(--glass-line); border-radius: 28px; padding: 42px 0 30px; overflow: hidden; box-shadow: var(--shadow-float), 0 1px 0 oklch(100% 0.005 292 / 0.82) inset; position: relative; }
.gtl-page .pipeline-frame::before { content: ''; position: absolute; inset: -100px 8% auto 8%; height: 220px; background: radial-gradient(ellipse at 50% 50%, var(--glow-rose), transparent 68%); filter: blur(38px); pointer-events: none; opacity: 0.8; }
.gtl-page .pipeline-frame::after { content: ''; position: absolute; inset: 0; pointer-events: none; background: linear-gradient(90deg, var(--paper) 0%, transparent 9%, transparent 91%, var(--paper) 100%); opacity: 0.42; z-index: 3; }

.gtl-page .pipeline-scroll { position: relative; z-index: 2; overflow-x: auto; overflow-y: visible; scrollbar-width: thin; scrollbar-color: var(--champagne) transparent; padding: 0 38px 18px; cursor: grab; user-select: none; }
.gtl-page .pipeline-scroll.dragging { cursor: grabbing; }
.gtl-page .pipeline-scroll::-webkit-scrollbar { height: 6px; }
.gtl-page .pipeline-scroll::-webkit-scrollbar-track { background: transparent; }
.gtl-page .pipeline-scroll::-webkit-scrollbar-thumb { background: var(--champagne); border-radius: 3px; }

.gtl-page .pipeline-track { display: flex; flex-direction: row-reverse; gap: 0; align-items: stretch; min-width: max-content; position: relative; padding-top: 44px; }
.gtl-page .pipeline-track::before { content: ''; position: absolute; top: 38px; left: 0; right: 0; height: 3px; background: linear-gradient(to left, var(--violet-600) 0%, var(--rose-gold) 34%, var(--champagne) 70%, var(--ink-mute) 100%); opacity: 0.76; z-index: 0; border-radius: 999px; box-shadow: 0 0 18px var(--glow-rose); -webkit-mask-image: linear-gradient(to right, transparent 0, rgb(0 0 0) 112px, rgb(0 0 0) calc(100% - 112px), transparent 100%); mask-image: linear-gradient(to right, transparent 0, rgb(0 0 0) 112px, rgb(0 0 0) calc(100% - 112px), transparent 100%); }

.gtl-page .stage { width: 268px; flex-shrink: 0; display: flex; flex-direction: column; align-items: center; padding: 0 18px; position: relative; z-index: 1; overflow: visible; }
.gtl-page .stage-circle { position: absolute; top: -30px; left: 50%; transform: translateX(-50%); width: 48px; height: 48px; border-radius: 50%; background: oklch(99.5% 0.006 292); border: 1.5px solid var(--glass-line); display: flex; align-items: center; justify-content: center; color: var(--ink-mute); z-index: 2; transition: all 220ms cubic-bezier(0.32, 0.72, 0.30, 1); box-shadow: 0 14px 30px -24px oklch(36% 0.045 292 / 0.45), 0 0 0 6px oklch(100% 0.005 292 / 0.42); }
.gtl-page .stage[data-status="sent"] .stage-circle { background: var(--sage); border-color: var(--sage); color: oklch(99% 0.006 292); }
.gtl-page .stage[data-status="active"] .stage-circle { background: var(--violet-700); border-color: var(--violet-700); color: oklch(99% 0.006 292); box-shadow: 0 0 0 6px oklch(60% 0.17 292 / 0.14), 0 16px 30px -22px var(--violet-700); }
.gtl-page .stage[data-status="scheduled"] .stage-circle { background: oklch(99.5% 0.006 292); border-color: var(--apricot); color: var(--apricot); }
.gtl-page .stage[data-status="disabled"] .stage-circle { background: var(--paper-2); color: var(--ink-mute); opacity: 0.55; }

.gtl-page .stage-label { width: 100%; min-height: 38px; display: flex; align-items: center; justify-content: center; font-family: 'Danidin','Polin',sans-serif; font-weight: 700; font-size: 17px; color: var(--ink); margin-top: 12px; letter-spacing: 0.02em; line-height: 1.12; text-align: center; white-space: normal; overflow: visible; text-wrap: balance; }
.gtl-page .stage[data-status="disabled"] .stage-label { color: var(--ink-mute); }
.gtl-page .stage-when { width: 100%; min-height: 16px; font-size: 11px; color: var(--ink-soft); margin-top: 2px; text-align: center; white-space: normal; overflow: visible; text-wrap: balance; }

.gtl-page .stage-card { margin-top: 15px; width: 100%; background: oklch(100% 0.004 292 / 0.98); backdrop-filter: blur(16px) saturate(1.25); -webkit-backdrop-filter: blur(16px) saturate(1.25); border: 1px solid var(--glass-line); border-radius: 18px; padding: 15px 15px 13px; display: flex; flex-direction: column; gap: 10px; transition: transform 220ms, box-shadow 220ms, border-color 220ms, background 220ms; cursor: pointer; position: relative; text-align: right; font: inherit; color: inherit; box-shadow: 0 1px 0 oklch(100% 0.005 292 / 0.82) inset; }
.gtl-page .stage-card:hover:not(:disabled) { transform: translateY(-3px); box-shadow: 0 18px 40px -30px oklch(36% 0.045 292 / 0.5), 0 1px 0 oklch(100% 0.005 292 / 0.86) inset; border-color: var(--champagne); background: oklch(100% 0.006 292 / 0.98); }
.gtl-page .stage[data-status="active"] .stage-card { border-color: oklch(72% 0.12 292 / 0.42); background: linear-gradient(180deg, oklch(100% 0.004 292 / 0.98) 0%, oklch(99% 0.012 292 / 0.9) 100%); box-shadow: 0 1px 0 oklch(100% 0.005 292 / 0.86) inset, 0 18px 36px -28px var(--violet-700); }
.gtl-page .stage[data-status="disabled"] .stage-card { opacity: 0.68; background: oklch(98.2% 0.008 292 / 0.92); }

.gtl-page .stage-pill { align-self: flex-start; display: inline-flex; align-items: center; gap: 5px; padding: 3px 9px; border-radius: 999px; font-size: 10.5px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; }
.gtl-page .stage[data-status="sent"] .stage-pill { color: var(--sage); background: var(--sage-soft); }
.gtl-page .stage[data-status="active"] .stage-pill { color: oklch(99% 0.006 292); background: var(--violet-700); }
.gtl-page .stage[data-status="scheduled"] .stage-pill { color: var(--apricot); background: var(--apricot-soft); }
.gtl-page .stage[data-status="disabled"] .stage-pill { color: var(--ink-mute); background: var(--paper-3); }
.gtl-page .stage-pill .dot { width: 5px; height: 5px; border-radius: 50%; background: currentColor; }

.gtl-page .stage-stats { display: flex; flex-direction: column; gap: 3px; }
.gtl-page .stage-stat-num { font-family: 'Danidin','Polin',sans-serif; font-weight: 700; font-size: 28px; line-height: 1; color: var(--ink); letter-spacing: 0.01em; display: flex; align-items: baseline; gap: 4px; }
.gtl-page .stage-stat-num .of { font-size: 14px; color: var(--ink-mute); font-weight: 700; }
.gtl-page .stage-stat-label { font-size: 11.5px; color: var(--ink-soft); line-height: 1.3; }

.gtl-page .stage-progress { height: 4px; background: var(--paper-2); border-radius: 2px; overflow: hidden; position: relative; }
.gtl-page .stage-progress > div { height: 100%; border-radius: 2px; transition: width 600ms cubic-bezier(0.32, 0.72, 0.30, 1); }
.gtl-page .stage[data-status="sent"] .stage-progress > div { background: var(--sage); }
.gtl-page .stage[data-status="active"] .stage-progress > div { background: var(--violet-700); }
.gtl-page .stage[data-status="scheduled"] .stage-progress > div { background: var(--apricot); }

.gtl-page .stage-bottom { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding-top: 8px; border-top: 1px solid var(--line); font-size: 11px; color: var(--ink-mute); }
.gtl-page .stage-bottom .target { font-weight: 600; color: var(--ink-soft); }
.gtl-page .stage-actions { display: inline-flex; align-items: center; gap: 8px; flex-shrink: 0; }
.gtl-page .stage-bottom .logs { border: none; background: transparent; padding: 0; font: inherit; color: var(--rose-gold); font-weight: 700; cursor: pointer; }
.gtl-page .stage-bottom .logs:hover { color: var(--violet-700); text-decoration: underline; }
.gtl-page .stage-bottom .edit { color: var(--violet-700); font-weight: 600; }

.gtl-page .stage.add-nudge .stage-circle { background: oklch(99.5% 0.006 292); border: 1.5px dashed var(--champagne); color: var(--rose-gold); }
.gtl-page .stage.add-nudge .stage-card { background: oklch(99% 0.01 292 / 0.92); border: 1.5px dashed var(--champagne); align-items: center; justify-content: center; text-align: center; min-height: 118px; transition: background 220ms, border-color 220ms; }
.gtl-page .stage.add-nudge .stage-card:hover:not(:disabled) { background: oklch(98% 0.018 292 / 0.96); border-color: var(--rose-gold); transform: translateY(-2px); box-shadow: 0 14px 34px -28px var(--rose-gold); }
.gtl-page .stage.add-nudge .stage-card:disabled { opacity: 0.5; cursor: not-allowed; }
.gtl-page .stage.add-nudge .stage-card-add-text { font-size: 12px; color: var(--ink-soft); font-weight: 600; }
.gtl-page .stage.add-nudge .stage-card-add-text b { color: var(--rose-gold); font-weight: 700; }
.gtl-page .stage.add-nudge .stage-card-add-text-sub { font-size: 11px; color: var(--ink-mute); font-weight: 400; margin-top: 4px; }
.gtl-page .stage.add-nudge .stage-label { color: var(--rose-gold); }

.gtl-page .pipeline-stack { display: none; }
.gtl-page .pipeline-empty { margin: 0 auto; max-width: 520px; padding: 46px 28px; text-align: center; color: var(--ink-mute); border-radius: var(--r-lg); background: oklch(100% 0.004 292 / 0.94); border: 1px solid var(--glass-line); box-shadow: 0 1px 0 oklch(100% 0.005 292 / 0.78) inset; }
.gtl-page .pipeline-empty svg { opacity: 0.42; margin: 0 auto 14px; color: var(--rose-gold); }

.gtl-page .pipeline-skeleton { display: flex; gap: 0; padding: 36px 36px 28px; opacity: 0.6; }
.gtl-page .pipeline-skeleton .sk-stage { width: 268px; flex-shrink: 0; padding: 0 18px; }
.gtl-page .pipeline-skeleton .sk-circle { width: 44px; height: 44px; border-radius: 50%; background: var(--paper-2); margin: 0 auto; }
.gtl-page .pipeline-skeleton .sk-label { height: 14px; width: 80px; background: var(--paper-2); border-radius: 4px; margin: 12px auto; }
.gtl-page .pipeline-skeleton .sk-card { background: var(--paper-2); height: 140px; border-radius: 16px; margin-top: 14px; }

@media (max-width: 920px) {
  .gtl-page { overflow-x: clip; }
  .gtl-page .page { width: 100%; max-width: 100%; padding: 20px 14px 96px; overflow-x: clip; }
  .gtl-page .page-header { flex-direction: column; align-items: stretch; gap: 14px; padding: 20px 18px; border-radius: 22px; }
  .gtl-page .page-header h1 { font-size: 28px; }
  .gtl-page .page-header .sub { font-size: 13px; line-height: 1.55; }
  .gtl-page .header-actions { width: 100%; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
  .gtl-page .ghost-btn { min-width: 0; justify-content: center; padding: 9px 10px; white-space: nowrap; }
  .gtl-page .auto-pilot { padding: 12px 14px; gap: 12px; align-items: center; }
  .gtl-page .ap-icon { width: 32px; height: 32px; border-radius: 8px; }
  .gtl-page .ap-divider { display: none; }
  .gtl-page .ap-title { font-size: 13px; }
  .gtl-page .ap-caption { font-size: 11px; }
  .gtl-page .ap-body { gap: 4px 10px; }
  .gtl-page .toggle-large { width: 44px; height: 26px; }
  .gtl-page .toggle-large::after { width: 20px; height: 20px; top: 3px; left: 21px; }
  .gtl-page .toggle-large.off::after { left: 3px; }
  .gtl-page .pipeline-meta { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; font-size: 11.5px; }
  .gtl-page .pipeline-meta .item { min-width: 0; justify-content: center; padding-inline: 8px; }
  .gtl-page .pipeline-frame { padding: 0; border-radius: 20px; }
  .gtl-page .pipeline-scroll { display: none; }
  .gtl-page .pipeline-stack { display: flex; flex-direction: column; padding: 6px; gap: 0; }
  .gtl-page .stage-mobile { position: relative; display: flex; gap: 14px; align-items: flex-start; padding: 14px; border-bottom: 1px solid var(--glass-line); cursor: pointer; background: transparent; border-left: none; border-right: none; border-top: none; width: 100%; text-align: right; font: inherit; color: inherit; }
  .gtl-page .stage-mobile:last-child { border-bottom: none; }
  .gtl-page .stage-mobile::before { content: ''; position: absolute; top: 28px; bottom: -16px; right: 31px; width: 2px; background: var(--champagne); z-index: 0; }
  .gtl-page .stage-mobile:last-child::before { display: none; }
  .gtl-page .stage-mobile-circle { width: 36px; height: 36px; border-radius: 50%; flex-shrink: 0; background: oklch(99.5% 0.006 292); border: 1.5px solid var(--glass-line); display: flex; align-items: center; justify-content: center; color: var(--ink-mute); position: relative; z-index: 1; box-shadow: 0 12px 26px -22px oklch(36% 0.045 292 / 0.45); }
  .gtl-page .stage-mobile[data-status="sent"] .stage-mobile-circle { background: var(--sage); border-color: var(--sage); color: oklch(99% 0.006 292); }
  .gtl-page .stage-mobile[data-status="active"] .stage-mobile-circle { background: var(--violet-700); border-color: var(--violet-700); color: oklch(99% 0.006 292); box-shadow: 0 0 0 3px oklch(60% 0.17 292 / 0.15); }
  .gtl-page .stage-mobile[data-status="scheduled"] .stage-mobile-circle { border-color: var(--apricot); color: var(--apricot); }
  .gtl-page .stage-mobile[data-status="disabled"] .stage-mobile-circle { opacity: 0.5; }
  .gtl-page .stage-mobile-body { flex: 1; min-width: 0; }
  .gtl-page .stage-mobile-row { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; flex-wrap: wrap; }
  .gtl-page .stage-mobile-name { font-family: 'Danidin','Polin',sans-serif; font-weight: 700; font-size: 17px; letter-spacing: 0.02em; color: var(--ink); }
  .gtl-page .stage-mobile[data-status="disabled"] .stage-mobile-name { color: var(--ink-mute); }
  .gtl-page .stage-mobile-pill { font-size: 9.5px; padding: 2px 7px; border-radius: 999px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; }
  .gtl-page .stage-mobile[data-status="sent"] .stage-mobile-pill { color: var(--sage); background: var(--sage-soft); }
  .gtl-page .stage-mobile[data-status="active"] .stage-mobile-pill { color: oklch(99% 0.006 292); background: var(--violet-700); }
  .gtl-page .stage-mobile[data-status="scheduled"] .stage-mobile-pill { color: var(--apricot); background: var(--apricot-soft); }
  .gtl-page .stage-mobile[data-status="disabled"] .stage-mobile-pill { color: var(--ink-mute); background: var(--paper-3); }
  .gtl-page .stage-mobile-when { font-size: 11px; color: var(--ink-mute); margin-top: 1px; }
  .gtl-page .stage-mobile-stats { display: flex; gap: 14px; align-items: baseline; margin-top: 8px; font-size: 12px; color: var(--ink-soft); }
  .gtl-page .stage-mobile-stats b { font-family: 'Danidin','Polin',sans-serif; font-size: 18px; color: var(--ink); font-weight: 700; letter-spacing: 0.02em; }
  .gtl-page .stage-mobile-logs { margin-top: 8px; border: none; background: transparent; padding: 0; font: inherit; font-size: 12px; font-weight: 700; color: var(--rose-gold); cursor: pointer; }
  .gtl-page .stage-mobile-logs:hover { color: var(--violet-700); text-decoration: underline; }
  .gtl-page .stage-mobile.add-nudge { justify-content: center; background: oklch(99% 0.01 292 / 0.92); border: 1.5px dashed var(--champagne); border-radius: 16px; margin: 8px; cursor: pointer; }
  .gtl-page .stage-mobile.add-nudge::before { display: none; }
  .gtl-page .stage-mobile.add-nudge:disabled { opacity: 0.5; cursor: not-allowed; }
}

@media (max-width: 380px) {
  .gtl-page .page { padding-inline: 10px; }
  .gtl-page .header-actions { grid-template-columns: 1fr; }
  .gtl-page .pipeline-meta { grid-template-columns: 1fr; }
  .gtl-page .stage-mobile { gap: 10px; padding: 13px 12px; }
}
`;

// ─── Main page ───────────────────────────────────────────────────────────────

export default function AutomationTimeline() {
  const navigate = useNavigate();
  const { currentEvent, isLoading: eventLoading } = useEventContext();
  const { canAccessTimeline } = useFeatureAccess();

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
  const [draftNudge, setDraftNudge]   = useState<{ stage_name: string; days_before: number } | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

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

  useEffect(() => {
    if (!currentEvent?.id) return;
    setLoading(true);
    setTemplates(((currentEvent.content_config as Record<string, unknown>)?.whatsapp_templates ?? {}) as WhatsAppTemplates);
    setAutoPilot(((currentEvent.automation_config as Record<string, unknown> | null)?.auto_pilot ?? true) as boolean);
    loadData(currentEvent.id).finally(() => setLoading(false));
  }, [currentEvent?.id, loadData]);

  // ── Derived ──

  const sorted = useMemo(
    () => [...settings].sort((a, b) => b.days_before - a.days_before),
    [settings],
  );
  const beforeEvent = useMemo(() => sorted.filter(s => s.days_before > 0), [sorted]);
  const afterEvent  = useMemo(() => sorted.filter(s => s.days_before <= 0), [sorted]);
  const eventDate   = currentEvent?.event_date ? new Date(currentEvent.event_date) : null;
  const isEmpty     = !loading && !eventLoading && settings.length === 0;

  const dynamicNudgeCount = useMemo(
    () => settings.filter(s => (DYNAMIC_NUDGE_NAMES as readonly string[]).includes(s.stage_name)).length,
    [settings],
  );
  const canAddNudge = dynamicNudgeCount < 3;

  const focusStage = useMemo(() => findFocusStage(sorted, stats), [sorted, stats]);
  const focusId = focusStage ? `stage-${focusStage.stage_name}` : '';

  const pipelineNodes = useMemo<PipelineNode[]>(() => {
    const nodes: PipelineNode[] = [];
    for (let i = 0; i < beforeEvent.length; i++) {
      nodes.push({ type: 'stage', setting: beforeEvent[i] });
      const isNudgeType = beforeEvent[i].stage_name === 'nudge' || beforeEvent[i].stage_name.startsWith('nudge_');
      const nextIsUltimatum = i + 1 < beforeEvent.length && beforeEvent[i + 1].stage_name === 'ultimatum';
      if (isNudgeType && nextIsUltimatum) {
        nodes.push({ type: 'add-nudge' });
      }
    }
    for (const s of afterEvent) {
      nodes.push({ type: 'stage', setting: s });
    }
    return nodes;
  }, [beforeEvent, afterEvent]);

  const metaCounts = useMemo(() => {
    let sent = 0, active = 0, scheduled = 0, disabled = 0;
    for (const s of sorted) {
      const status = getStageStatus(s, stats[s.stage_name]);
      if      (status === 'sent')      sent++;
      else if (status === 'active')    active++;
      else if (status === 'scheduled') scheduled++;
      else                             disabled++;
    }
    return { sent, active, scheduled, disabled };
  }, [sorted, stats]);

  const totalSent = useMemo(
    () => Object.values(stats).reduce((acc, s) => acc + (s?.sent ?? 0), 0),
    [stats],
  );
  const totalPending = useMemo(
    () => Object.values(stats).reduce((acc, s) => acc + (s?.pending ?? 0), 0),
    [stats],
  );

  const eventDateLabel = eventDate
    ? eventDate.toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  // ── Smart Focus Snapping ──

  useEffect(() => {
    if (loading || !scrollRef.current || settings.length === 0 || !focusId) return;
    requestAnimationFrame(() => {
      const container = scrollRef.current;
      const focusEl = document.getElementById(focusId);
      if (!container || !focusEl) return;
      if (container.scrollWidth <= container.clientWidth) return;
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
    if (!currentEvent?.id) return;
    setRefreshing(true);
    try {
      await loadData(currentEvent.id);
      showToast('הנתונים עודכנו');
    } catch {
      showToast('שגיאה בטעינת הנתונים', 'error');
    } finally {
      setRefreshing(false);
    }
  };

  const handleAutoPilotToggle = async () => {
    if (!currentEvent?.id) return;
    const newValue = !autoPilot;
    setAutoPilot(newValue);
    try {
      await toggleAutoPilot(currentEvent.id, newValue);
      showToast(newValue ? 'טייס אוטומטי פעיל' : 'טייס אוטומטי מושבת');
    } catch {
      setAutoPilot(!newValue);
      showToast('שגיאה בעדכון הטייס האוטומטי', 'error');
    }
  };

  const handleEditSaved = (updates: { is_active?: boolean; days_before?: number; singular?: string; plural?: string }) => {
    if (!editSetting) return;
    if (updates.is_active !== undefined || updates.days_before !== undefined) {
      setSettings(prev => prev.map(s =>
        s.id === editSetting.id
          ? { ...s,
              ...(updates.is_active !== undefined && { is_active: updates.is_active }),
              ...(updates.days_before !== undefined && { days_before: updates.days_before }) }
          : s,
      ));
    }
    if (updates.singular !== undefined || updates.plural !== undefined) {
      setTemplates(prev => ({
        ...prev,
        [editSetting.stage_name]: {
          singular: updates.singular ?? prev[editSetting.stage_name]?.singular ?? '',
          plural:   updates.plural   ?? prev[editSetting.stage_name]?.plural   ?? '',
        },
      }));
    }
    showToast('ההגדרות נשמרו');
  };

  const handleDraftNudgeSaved = async (updates: { is_active?: boolean; days_before?: number; singular?: string; plural?: string }) => {
    if (!draftNudge || !currentEvent?.id) return;
    try {
      await addDynamicNudge(currentEvent.id, draftNudge.stage_name, updates.days_before ?? draftNudge.days_before);
      if (updates.singular !== undefined || updates.plural !== undefined) {
        await updateWhatsAppTemplate(currentEvent.id, draftNudge.stage_name, updates.singular ?? '', updates.plural ?? '');
      }
      await loadData(currentEvent.id);
      showToast('תזכורת חדשה נוספה');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'שגיאה בהוספת תזכורת', 'error');
    } finally {
      setDraftNudge(null);
    }
  };

  const handleDeleteNudge = async () => {
    if (!editSetting || !currentEvent?.id) return;
    try {
      await deleteDynamicNudge(editSetting.id);
      setEditSetting(null);
      await loadData(currentEvent.id);
      showToast('התזכורת נמחקה');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'שגיאה במחיקת התזכורת', 'error');
    }
  };

  const handleAddNudge = () => {
    if (!currentEvent?.id || !canAddNudge) return;
    const existing = settings.map(s => s.stage_name);
    const nextName = (['nudge_1', 'nudge_2', 'nudge_3'] as const).find(n => !existing.includes(n));
    if (!nextName) return;

    const nudges = sorted.filter(s => s.stage_name === 'nudge' || s.stage_name.startsWith('nudge_'));
    const ultimatum = sorted.find(s => s.stage_name === 'ultimatum');
    const lastNudgeDays = nudges.length > 0 ? Math.min(...nudges.map(n => n.days_before)) : 7;
    const ultimatumDays = ultimatum?.days_before ?? 3;
    const defaultDays = Math.round((lastNudgeDays + ultimatumDays) / 2);

    const draft: AutomationSettingRow = {
      id: `draft-${nextName}`,
      event_id: currentEvent.id,
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

  const editSettingHasLogs = editSetting
    ? (stats[editSetting.stage_name]?.sent ?? 0) + (stats[editSetting.stage_name]?.pending ?? 0) + (stats[editSetting.stage_name]?.failed ?? 0) > 0
    : false;
  const editIsDynamicNudge = editSetting
    ? (DYNAMIC_NUDGE_NAMES as readonly string[]).includes(editSetting.stage_name)
    : false;

  // ── Gate ──

  if (!canAccessTimeline) {
    return (
      <div className="gtl-page">
        <style>{TIMELINE_STYLES}</style>
        <DashboardNav />
        <main className="page">
          <div className="flex items-center justify-center py-20">
            <GlassCard className="max-w-md w-full rounded-3xl text-center p-8">
              <div className="mx-auto w-16 h-16 bg-violet-100 rounded-full flex items-center justify-center mb-4">
                <Calendar className="w-8 h-8 text-violet-600" />
              </div>
              <h2 className="font-danidin text-2xl mb-2" style={{ color: 'var(--ink)' }}>ציר הזמן</h2>
              <p className="mb-6 leading-relaxed font-brand" style={{ color: 'var(--ink-soft)' }}>
                נהלו את כל תהליך האוטומציה של ההודעות — תזכורות, ניגנובים, והודעות לוגיסטיקה — הכל ממקום אחד.
              </p>
              <button
                onClick={() => setUpgradeOpen(true)}
                className="bg-violet-600 hover:bg-violet-700 text-white rounded-xl px-6 py-3 w-full font-medium transition-colors"
              >
                שדרגו לגרסה המלאה
              </button>
            </GlassCard>
          </div>
        </main>
        <UpgradeModal
          isOpen={upgradeOpen}
          onClose={() => setUpgradeOpen(false)}
          onUpgradeClick={() => { setUpgradeOpen(false); showToast('בקרוב! נציג עם הפרטים.'); }}
        />
        <ToastContainer toasts={toasts} />
      </div>
    );
  }

  return (
    <div className="gtl-page font-brand">
      <style>{TIMELINE_STYLES}</style>
      <DashboardNav />

      <main className="page">
        {/* Page header */}
        <div className="page-header">
          <div>
            <h1>פייפליין הזמנות</h1>
            <div className="sub">
              מסע ההודעה האוטומטי מתחילת הקמפיין ועד יום אחרי החתונה
              {eventDateLabel && <> · <b>אירוע ב-{eventDateLabel}</b></>}
            </div>
          </div>
          <div className="header-actions">
            <button
              type="button"
              className="ghost-btn"
              onClick={handleRefresh}
              disabled={refreshing || loading}
            >
              <RefreshCw size={14} className={cn(refreshing && 'animate-spin')} />
              רענן נתונים
            </button>
            <button
              type="button"
              className="ghost-btn"
              onClick={() => navigate('/dashboard/settings')}
            >
              <Settings size={14} />
              הגדרות אוטומציה
            </button>
          </div>
        </div>

        {/* Auto-pilot banner */}
        <AutoPilotBanner
          active={autoPilot}
          onToggle={handleAutoPilotToggle}
          sentCount={totalSent}
          pendingCount={totalPending}
        />

        {/* Loading */}
        {(eventLoading || loading) && (
          <div className="pipeline-frame">
            <div className="pipeline-skeleton">
              {[1,2,3,4,5].map(i => (
                <div key={i} className="sk-stage">
                  <div className="sk-circle" />
                  <div className="sk-label" />
                  <div className="sk-card" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {isEmpty && (
          <div className="pipeline-frame">
            <div className="pipeline-empty">
              <Calendar size={40} />
              <p className="font-danidin font-bold" style={{ fontSize: '24px', color: 'var(--ink)' }}>מסע ההודעות עדיין לא נבנה</p>
              <p style={{ fontSize: '13px', marginTop: '6px', color: 'var(--ink-soft)', lineHeight: 1.55 }}>
                כאן יופיע רצף התזכורות, האישורים והודעות הלוגיסטיקה של האירוע.
              </p>
            </div>
          </div>
        )}

        {/* Pipeline */}
        {!loading && !eventLoading && settings.length > 0 && (
          <>
            <PipelineMeta counts={metaCounts} />
            <div className="pipeline-frame">
              {/* Desktop horizontal scroll */}
              <div
                ref={scrollRef}
                className={cn('pipeline-scroll', drag.isDragging && 'dragging')}
                onPointerDown={drag.onPointerDown}
                onPointerMove={drag.onPointerMove}
                onPointerUp={drag.onPointerUp}
              >
                <div className="pipeline-track">
                  {pipelineNodes.map((node) => {
                    if (node.type === 'add-nudge') {
                      return (
                        <AddNudgeColumn
                          key="add-nudge"
                          onClick={handleAddNudge}
                          disabled={!canAddNudge}
                        />
                      );
                    }
                    return (
                      <StageColumn
                        key={node.setting.id}
                        setting={node.setting}
                        stats={stats[node.setting.stage_name]}
                        eventDate={eventDate}
                        audience={audienceCounts}
                        onEdit={setEditSetting}
                        onLogs={(stageName) => handleDrilldown(stageName, 'all')}
                        hasDragged={drag.hasDragged}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Mobile vertical stack */}
              <div className="pipeline-stack">
                {pipelineNodes.map((node) => {
                  if (node.type === 'add-nudge') {
                    return (
                      <MobileAddNudgeItem
                        key="add-nudge-m"
                        onClick={handleAddNudge}
                        disabled={!canAddNudge}
                      />
                    );
                  }
                  return (
                    <MobileStageItem
                      key={node.setting.id}
                      setting={node.setting}
                      stats={stats[node.setting.stage_name]}
                      eventDate={eventDate}
                      audience={audienceCounts}
                      onEdit={setEditSetting}
                      onLogs={(stageName) => handleDrilldown(stageName, 'all')}
                    />
                  );
                })}
              </div>
            </div>
          </>
        )}
      </main>

      {/* Stage Edit Modal */}
      {currentEvent?.id && editSetting && (
        <StageEditModal
          setting={editSetting}
          templates={templates}
          eventId={currentEvent.id}
          eventDate={eventDate}
          isDynamicNudge={editIsDynamicNudge}
          canDelete={!draftNudge && editIsDynamicNudge && !editSettingHasLogs}
          onClose={() => { setEditSetting(null); setDraftNudge(null); }}
          onSaved={draftNudge ? handleDraftNudgeSaved : handleEditSaved}
          onDelete={handleDeleteNudge}
        />
      )}

      {/* Stage Logs Drilldown */}
      {currentEvent?.id && (
        <StageLogsSheet
          drilldown={drilldown}
          eventId={currentEvent.id}
          onClose={() => setDrilldown(null)}
        />
      )}

      <ToastContainer toasts={toasts} />

      <SiteFooter />
    </div>
  );
}
