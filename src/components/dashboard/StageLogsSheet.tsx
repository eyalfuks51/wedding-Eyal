import { useState, useEffect, useMemo } from 'react';
import { Search, Loader2 } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { STAGE_META, MSG_STATUS_MAP, type StageName } from '@/components/dashboard/constants';
import { fetchStageMessageLogs } from '@/lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

interface StageLog {
  id: string;
  invitation_id: string;
  phone: string;
  status: 'pending' | 'sent' | 'failed';
  error_log: string | null;
  sent_at: string | null;
  scheduled_for: string | null;
  created_at: string;
  // Supabase returns FK joins as an array even for 1:1 relationships
  invitations: { group_name: string | null }[] | null;
}

export type DrilldownFilter = 'all' | 'sent' | 'pending' | 'failed';

export interface StageLogsDrilldown {
  stageName: StageName;
  filter: DrilldownFilter;
}

interface StageLogsSheetProps {
  drilldown: StageLogsDrilldown | null;
  eventId: string;
  onClose: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTimestamp(log: StageLog): string {
  const raw =
    log.status === 'sent'    ? log.sent_at :
    log.status === 'pending' ? log.scheduled_for :
    log.created_at;
  if (!raw) return '';
  const d = new Date(raw);
  return d.toLocaleString('he-IL', {
    day:    'numeric',
    month:  'short',
    hour:   '2-digit',
    minute: '2-digit',
  });
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusPill({ status }: { status: StageLog['status'] }) {
  const cfg = MSG_STATUS_MAP[status] ?? MSG_STATUS_MAP.none;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium font-brand border ${cfg.classes}`}>
      {cfg.label}
    </span>
  );
}

// ─── Filter tabs ──────────────────────────────────────────────────────────────

const TAB_DEFS: Array<{ key: DrilldownFilter; label: string }> = [
  { key: 'all',     label: 'הכל'    },
  { key: 'sent',    label: 'נשלח'   },
  { key: 'pending', label: 'בתור'   },
  { key: 'failed',  label: 'נכשל'   },
];

// Badge colors per-tab (when active). 'all' uses violet, rest use MSG_STATUS_MAP.
const TAB_ACTIVE_BADGE: Record<DrilldownFilter, string> = {
  all:     'bg-violet-100 text-violet-700',
  sent:    MSG_STATUS_MAP.sent.classes,
  pending: MSG_STATUS_MAP.pending.classes,
  failed:  MSG_STATUS_MAP.failed.classes,
};

interface FilterTabsProps {
  filter: DrilldownFilter;
  counts: Record<DrilldownFilter, number>;
  onChange: (f: DrilldownFilter) => void;
}

function FilterTabs({ filter, counts, onChange }: FilterTabsProps) {
  return (
    <div
      role="tablist"
      className="flex gap-0.5 bg-slate-100 rounded-xl p-1"
    >
      {TAB_DEFS.map(({ key, label }) => {
        const active  = filter === key;
        const count   = counts[key];
        return (
          <button
            key={key}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(key)}
            className={[
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium font-brand',
              'transition-all duration-150',
              active
                ? 'bg-white shadow-sm text-slate-800'
                : 'text-slate-500 hover:text-slate-700',
            ].join(' ')}
          >
            {label}
            <span className={[
              'inline-flex items-center justify-center rounded-full min-w-[18px] h-[18px] px-1',
              'text-[10px] font-medium transition-colors',
              active ? TAB_ACTIVE_BADGE[key] : 'bg-slate-200 text-slate-500',
            ].join(' ')}>
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Log row ──────────────────────────────────────────────────────────────────

function LogRow({ log }: { log: StageLog }) {
  const name = log.invitations?.[0]?.group_name;
  const ts   = formatTimestamp(log);

  return (
    <div className="px-1 group">
      <div className="rounded-xl px-4 py-3 transition-colors duration-100 group-hover:bg-slate-50">
        <div className="flex items-start justify-between gap-3">
          {/* Left: name + phone */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-800 font-brand truncate leading-snug">
              {name ?? '—'}
            </p>
            <p className="text-[11px] text-slate-400 font-brand mt-0.5 tabular-nums">
              {log.phone}
            </p>
          </div>

          {/* Right: status pill + timestamp */}
          <div className="flex flex-col items-end gap-1 shrink-0 pt-0.5">
            <StatusPill status={log.status} />
            {ts && (
              <span className="text-[10px] text-slate-400 font-brand tabular-nums">
                {ts}
              </span>
            )}
          </div>
        </div>

        {/* Error log — only for failed rows */}
        {log.status === 'failed' && log.error_log && (
          <div className="mt-2 flex items-start gap-1.5 text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2 font-brand leading-snug">
            <span className="shrink-0 mt-px">⚠</span>
            <span>{log.error_log}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Loading skeleton rows ────────────────────────────────────────────────────

function LogSkeleton() {
  return (
    <div className="px-1 space-y-1">
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="rounded-xl px-4 py-3 animate-pulse">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 space-y-2">
              <div className="h-3.5 bg-slate-200 rounded w-32" />
              <div className="h-2.5 bg-slate-100 rounded w-24" />
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <div className="h-5 bg-slate-200 rounded-full w-14" />
              <div className="h-2.5 bg-slate-100 rounded w-16" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function StageLogsSheet({ drilldown, eventId, onClose }: StageLogsSheetProps) {
  const [logs, setLogs]       = useState<StageLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter]   = useState<DrilldownFilter>('all');
  const [search, setSearch]   = useState('');

  // Sync filter when drilldown opens with a pre-selected status
  useEffect(() => {
    if (drilldown) setFilter(drilldown.filter);
  }, [drilldown?.stageName, drilldown?.filter]);

  // Fetch logs when sheet opens — always fresh, never cached
  useEffect(() => {
    if (!drilldown) return;
    let ignored = false;
    setLoading(true);
    setLogs([]);
    setSearch('');

    fetchStageMessageLogs(eventId, drilldown.stageName)
      .then(data => {
        if (ignored) return;
        setLogs(data as unknown as StageLog[]);
      })
      .catch(err => console.error('[StageLogsSheet] fetch failed:', err))
      .finally(() => { if (!ignored) setLoading(false); });

    return () => { ignored = true; };
  }, [eventId, drilldown?.stageName]);

  // Aggregate counts (over full dataset, not filtered view)
  const counts = useMemo<Record<DrilldownFilter, number>>(() => {
    const c = { all: logs.length, sent: 0, pending: 0, failed: 0 };
    for (const log of logs) {
      if (log.status === 'sent')         c.sent++;
      else if (log.status === 'pending') c.pending++;
      else if (log.status === 'failed')  c.failed++;
    }
    return c;
  }, [logs]);

  // Client-side filter + search (debounce not needed at this scale)
  const visible = useMemo(() => {
    let result = filter === 'all' ? logs : logs.filter(l => l.status === filter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(l =>
        (l.invitations?.[0]?.group_name ?? '').toLowerCase().includes(q) ||
        l.phone.includes(q)
      );
    }
    return result;
  }, [logs, filter, search]);

  const stageLabel = drilldown ? STAGE_META[drilldown.stageName].label : '';

  return (
    <Sheet open={drilldown !== null} onOpenChange={open => { if (!open) onClose(); }}>
      <SheetContent
        side="left"
        dir="rtl"
        className="flex flex-col w-[32rem] sm:w-[32rem] p-0 overflow-hidden"
      >
        {/* ── Header ── */}
        <SheetHeader className="shrink-0">
          <SheetTitle>הודעות — {stageLabel}</SheetTitle>
          <SheetDescription>
            {loading ? 'טוען...' : `${counts.all} הודעות בסה"כ`}
          </SheetDescription>
        </SheetHeader>

        {/* ── Filters + search ── */}
        <div className="shrink-0 px-6 pt-4 pb-3 space-y-3 border-b border-slate-100">
          <FilterTabs filter={filter} counts={counts} onChange={setFilter} />

          {/* Search */}
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="חיפוש לפי שם או טלפון..."
              className={[
                'w-full pr-9 pl-3 py-2 text-sm font-brand',
                'bg-slate-50 border border-slate-200 rounded-xl',
                'placeholder:text-slate-400',
                'focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent',
                'transition-shadow duration-150',
              ].join(' ')}
            />
          </div>
        </div>

        {/* ── List ── */}
        <div className="flex-1 overflow-y-auto py-2">
          {loading && <LogSkeleton />}

          {!loading && visible.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400 font-brand">
              <Search className="w-8 h-8 opacity-30 mb-3" />
              <p className="text-sm">
                {search ? 'לא נמצאו תוצאות' : 'אין הודעות בקטגוריה זו'}
              </p>
            </div>
          )}

          {!loading && visible.map(log => (
            <LogRow key={log.id} log={log} />
          ))}
        </div>

        {/* ── Footer ── */}
        {!loading && visible.length > 0 && (
          <div className="shrink-0 px-6 py-3 border-t border-slate-100 bg-slate-50/60">
            <p className="text-[11px] text-slate-400 font-brand text-center">
              {search
                ? `מציג ${visible.length} מתוך ${counts[filter === 'all' ? 'all' : filter]}`
                : `${visible.length} הודעות`
              }
            </p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
