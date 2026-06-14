import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Save, Plus, X, ChevronDown, Eye, Search, Download,
  Heart, MapPin, Clock, Car, FileText,
  Check,
} from 'lucide-react';
import { useEventContext } from '@/contexts/EventContext';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { updateEventContentConfig } from '@/lib/supabase';
import DashboardNav from '@/components/dashboard/DashboardNav';
import LivePreview from '@/components/dashboard/LivePreview';

// ───── Types ─────

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
  { value: '',      label: 'ללא' },
  { value: 'food',  label: 'אוכל 🍽️' },
  { value: 'marry', label: 'טקס 💍' },
  { value: 'dance', label: 'ריקודים 💃' },
];

// ───── Section keys ─────

type SectionKey = 'couple' | 'venue' | 'schedule' | 'transport' | 'footer';

// ───── Inline scoped styles (mirrors settings.html prototype) ─────

const SETTINGS_STYLES = `
.gst-page * { box-sizing: border-box; }

.gst-page .page-shell {
  max-width: 1400px;
  margin: 0 auto;
  padding: 32px 48px 120px;
}

.gst-page .draft-banner {
  margin-bottom: 18px;
  padding: 12px 16px;
  border-radius: var(--r-md, 16px);
  background: var(--apricot-soft);
  color: var(--apricot);
  font-size: 13px;
  border: 1px solid rgba(201,123,74,0.18);
}
.gst-page .draft-banner b { font-weight: 700; }

.gst-page .page-header {
  position: relative;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 28px;
  flex-wrap: wrap;
  padding: 24px 28px;
  border-radius: var(--r-lg, 24px);
  border: 1px solid var(--glass-line);
  background: linear-gradient(135deg, oklch(100% 0.004 75 / 0.96), oklch(99.5% 0.008 76 / 0.88));
  backdrop-filter: var(--glass-card-blur);
  -webkit-backdrop-filter: var(--glass-card-blur);
  box-shadow: var(--shadow-soft), 0 1px 0 oklch(100% 0.005 75 / 0.78) inset;
  overflow: hidden;
}
.gst-page .page-header::before {
  content: '';
  position: absolute;
  inset: -80px auto auto -30px;
  width: 250px;
  height: 190px;
  background: radial-gradient(circle, var(--glow-rose), transparent 68%);
  filter: blur(18px);
  pointer-events: none;
}
.gst-page .page-header > * { position: relative; z-index: 1; }
.gst-page .page-header h1 {
  font-family: 'Danidin', 'Polin', 'Heebo', sans-serif;
  font-weight: 700;
  font-size: 40px;
  letter-spacing: 0.01em;
  color: var(--ink);
  line-height: 1.05;
  margin: 0;
}
.gst-page .page-header .sub {
  margin-top: 8px;
  color: var(--ink-soft);
  font-size: 14px;
}
.gst-page .page-header .sub b {
  color: var(--rose-gold);
  font-weight: 700;
}
.gst-page .header-actions { display: flex; gap: 10px; align-items: center; }

.gst-page .ghost-btn {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 9px 14px; border-radius: var(--r-sm, 10px);
  background: oklch(100% 0.006 75 / 0.48); border: 1px solid var(--glass-line);
  font-size: 13px; font-weight: 600; color: var(--ink-soft);
  font-family: inherit; cursor: pointer;
  transition: background 200ms, color 200ms, border-color 200ms, transform 200ms;
  box-shadow: 0 1px 0 oklch(100% 0.005 75 / 0.58) inset;
}
.gst-page .ghost-btn:hover {
  background: oklch(100% 0.006 75 / 0.72);
  color: var(--ink);
  border-color: var(--champagne);
  transform: translateY(-1px);
}

.gst-page .split {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 400px;
  gap: 32px;
  align-items: flex-start;
}

.gst-page .form-pane {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

/* Section card */
.gst-page .section {
  background: linear-gradient(135deg, oklch(100% 0.004 75 / 0.98), oklch(99.5% 0.008 76 / 0.9));
  backdrop-filter: var(--glass-card-blur);
  -webkit-backdrop-filter: var(--glass-card-blur);
  border: 1px solid var(--glass-line);
  border-radius: var(--r-lg, 24px);
  overflow: hidden;
  box-shadow: var(--shadow-soft), 0 1px 0 oklch(100% 0.005 75 / 0.78) inset;
  transition: border-color 220ms, box-shadow 220ms, transform 220ms;
}
.gst-page .section:hover { border-color: var(--champagne); box-shadow: var(--shadow-float), 0 1px 0 oklch(100% 0.005 75 / 0.82) inset; transform: translateY(-1px); }

.gst-page .section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 20px 24px;
  cursor: pointer;
  user-select: none;
  background: transparent;
  border: none;
  width: 100%;
  text-align: right;
  font-family: inherit;
  color: inherit;
}
.gst-page .section-head-left { display: flex; align-items: center; gap: 14px; min-width: 0; }
.gst-page .section-icon {
  width: 38px; height: 38px;
  border-radius: 14px;
  display: flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, var(--champagne-soft), oklch(97% 0.024 78 / 0.72));
  color: var(--rose-gold);
  flex-shrink: 0;
  box-shadow: 0 14px 28px -24px var(--rose-gold);
}
.gst-page .section-title-block { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.gst-page .section-title {
  font-family: 'Danidin', 'Polin', 'Heebo', sans-serif;
  font-weight: 700;
  font-size: 19px;
  letter-spacing: 0.02em;
  color: var(--ink);
  line-height: 1.1;
}
.gst-page .section-sub {
  font-size: 12.5px;
  color: var(--ink-soft);
  line-height: 1.3;
}
.gst-page .section-head-right { display: flex; align-items: center; gap: 12px; flex-shrink: 0; }
.gst-page .section-status {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  padding: 3px 9px;
  border-radius: var(--r-pill, 999px);
}
.gst-page .section-status.complete { color: var(--sage); background: var(--sage-soft); }
.gst-page .section-status.partial  { color: var(--apricot); background: var(--apricot-soft); }
.gst-page .section-chev {
  color: var(--ink-mute);
  transition: transform 220ms;
  display: inline-flex;
}
.gst-page .section.open .section-chev { transform: rotate(180deg); }

.gst-page .section-body {
  padding: 20px 24px 24px;
  border-top: 1px solid var(--glass-line);
  background: oklch(100% 0.004 75 / 0.72);
}

/* Field grid */
.gst-page .field-row {
  display: grid;
  gap: 16px;
  margin-bottom: 16px;
}
.gst-page .field-row.cols-2 { grid-template-columns: 1fr 1fr; }
.gst-page .field-row.cols-3 { grid-template-columns: 1fr 1fr 1fr; }
.gst-page .field-row:last-child { margin-bottom: 0; }

.gst-page .field { display: flex; flex-direction: column; gap: 6px; }
.gst-page .field label {
  font-size: 12.5px;
  font-weight: 700;
  color: var(--ink);
  letter-spacing: 0.01em;
  display: flex;
  align-items: center;
  gap: 6px;
}
.gst-page .field label .hint {
  font-size: 11px;
  color: var(--ink-mute);
  font-weight: 400;
  letter-spacing: 0;
}
.gst-page .field input,
.gst-page .field select,
.gst-page .field textarea {
  padding: 10px 12px;
  border: 1px solid var(--glass-line);
  border-radius: var(--r-sm, 10px);
  background: oklch(100% 0.006 75 / 0.62);
  font-size: 14px;
  color: var(--ink);
  font-family: inherit;
  transition: border-color 200ms, box-shadow 200ms, background 200ms;
  line-height: 1.4;
  width: 100%;
}
.gst-page .field input::placeholder,
.gst-page .field textarea::placeholder { color: var(--ink-mute); }
.gst-page .field input:focus,
.gst-page .field select:focus,
.gst-page .field textarea:focus {
  outline: none;
  border-color: var(--violet-600);
  box-shadow: 0 0 0 3px oklch(60% 0.17 296 / 0.12);
  background: oklch(100% 0.006 75 / 0.86);
}
.gst-page .field textarea { resize: vertical; min-height: 84px; line-height: 1.55; }
.gst-page .field-help { font-size: 11.5px; color: var(--ink-mute); margin-top: 2px; line-height: 1.4; }

/* Schedule list */
.gst-page .schedule-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; }
.gst-page .schedule-item {
  display: grid;
  grid-template-columns: 110px 1fr 120px auto;
  gap: 10px;
  align-items: center;
  padding: 8px 10px 8px 8px;
  background: oklch(100% 0.004 75 / 0.9);
  border: 1px solid var(--glass-line);
  border-radius: var(--r-sm, 10px);
}
.gst-page .schedule-item input,
.gst-page .schedule-item select {
  padding: 7px 9px;
  font-size: 13px;
  border: 1px solid var(--glass-line);
  border-radius: var(--r-xs, 6px);
  background: oklch(100% 0.006 75 / 0.64);
  color: var(--ink);
  font-family: inherit;
}
.gst-page .schedule-item .remove {
  width: 26px; height: 26px;
  border-radius: var(--r-xs, 6px);
  color: var(--ink-mute);
  background: transparent;
  border: none;
  cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  transition: background 200ms, color 200ms;
}
.gst-page .schedule-item .remove:hover { background: var(--clay-soft); color: var(--clay); }
.gst-page .schedule-empty {
  padding: 16px;
  text-align: center;
  color: var(--ink-mute);
  font-size: 13px;
}

.gst-page .add-row-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 9px 14px;
  border-radius: var(--r-sm, 10px);
  border: 1.5px dashed var(--champagne);
  background: oklch(94% 0.04 78 / 0.42);
  color: var(--rose-gold);
  font-size: 13px;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
  transition: background 200ms, border-color 200ms;
}
.gst-page .add-row-btn:hover {
  background: oklch(90% 0.055 78 / 0.46);
  border-color: var(--rose-gold);
}

/* Preview pane */
.gst-page .preview-pane {
  position: sticky;
  top: 96px;
  align-self: start;
  padding: 16px;
  border-radius: 28px;
  border: 1px solid var(--glass-line);
  background:
    radial-gradient(circle at 50% 12%, var(--glow-rose), transparent 36%),
    linear-gradient(135deg, oklch(100% 0.004 75 / 0.97), oklch(99.5% 0.008 76 / 0.88));
  backdrop-filter: var(--glass-card-blur);
  -webkit-backdrop-filter: var(--glass-card-blur);
  box-shadow: var(--shadow-float), 0 1px 0 oklch(100% 0.005 75 / 0.78) inset;
}

/* Save bar */
.gst-page .save-bar {
  position: fixed;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  width: calc(100% - 32px);
  max-width: 1304px;
  z-index: 40;
  background: var(--glass-card);
  backdrop-filter: var(--glass-card-blur);
  -webkit-backdrop-filter: var(--glass-card-blur);
  border: 1px solid var(--glass-line);
  border-radius: var(--r-md, 16px);
  padding: 12px 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  box-shadow: var(--shadow-float), 0 1px 0 oklch(100% 0.005 75 / 0.82) inset;
  transition: opacity 200ms, transform 200ms;
}
.gst-page .save-bar.hidden {
  opacity: 0;
  transform: translateX(-50%) translateY(40px);
  pointer-events: none;
}
.gst-page .save-bar-text {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  color: var(--ink-soft);
}
.gst-page .save-bar-text .changes-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  border-radius: var(--r-pill, 999px);
  background: var(--apricot-soft);
  color: var(--apricot);
  font-size: 11.5px;
  font-weight: 700;
  letter-spacing: 0.02em;
}
.gst-page .save-bar-text .changes-pill .dot {
  width: 6px; height: 6px; border-radius: 50%; background: currentColor;
}
.gst-page .save-bar-actions { display: flex; gap: 10px; }
.gst-page .btn-discard {
  padding: 9px 16px;
  border-radius: var(--r-sm, 10px);
  background: oklch(100% 0.006 75 / 0.52);
  border: 1px solid var(--glass-line);
  font-size: 13px;
  font-weight: 700;
  color: var(--ink-soft);
  font-family: inherit;
  cursor: pointer;
  transition: background 200ms, color 200ms;
}
.gst-page .btn-discard:hover { background: var(--paper-2); color: var(--ink); }
.gst-page .btn-discard:disabled { opacity: 0.5; cursor: not-allowed; }
.gst-page .btn-save {
  padding: 9px 18px;
  border-radius: var(--r-sm, 10px);
  background: var(--violet-700);
  color: oklch(99% 0.006 75);
  font-size: 13px;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
  border: none;
  box-shadow: 0 16px 30px -22px var(--violet-700);
  transition: background 200ms, transform 180ms ease-out;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.gst-page .btn-save:hover { background: var(--violet-600); transform: translateY(-1px); }
.gst-page .btn-save:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

/* Mobile */
@media (max-width: 920px) {
  .gst-page .page-shell { padding: 20px 16px 96px; }
  .gst-page .page-header { flex-direction: column; align-items: flex-start; gap: 12px; }
  .gst-page .page-header h1 { font-size: 28px; }
  .gst-page .split { grid-template-columns: 1fr; gap: 0; }
  .gst-page .preview-pane.desktop-only { display: none; }
  .gst-page .section-head { padding: 16px 18px; }
  .gst-page .section-icon { width: 32px; height: 32px; }
  .gst-page .section-title { font-size: 17px; }
  .gst-page .section-body { padding: 16px 18px 18px; }
  .gst-page .field-row.cols-2,
  .gst-page .field-row.cols-3 { grid-template-columns: 1fr; }
  .gst-page .schedule-item { grid-template-columns: 90px 1fr 110px auto; gap: 8px; }

  .gst-page .save-bar {
    width: 100%;
    max-width: none;
    left: 0;
    right: 0;
    bottom: 0;
    transform: none;
    border-radius: 0;
    border-left: none;
    border-right: none;
    border-bottom: none;
    padding: 10px 16px calc(10px + env(safe-area-inset-bottom, 0px));
    gap: 10px;
    box-shadow: 0 -8px 24px -12px rgba(42, 37, 32, 0.18);
  }
  .gst-page .save-bar.hidden { transform: translateY(40px); }
  .gst-page .save-bar-text { font-size: 12px; gap: 8px; flex: 1; min-width: 0; }
  .gst-page .save-bar-text .changes-caption { display: none; }
  .gst-page .btn-discard { padding: 8px 12px; font-size: 12px; }
  .gst-page .btn-save { padding: 8px 14px; font-size: 12px; }
}

/* Mobile preview overlay */
.gst-page .preview-overlay {
  position: fixed;
  inset: 0;
  z-index: 60;
  background: var(--paper);
  display: flex;
  flex-direction: column;
  padding: 56px 16px 24px;
  overflow-y: auto;
}
.gst-page .preview-overlay-close {
  position: fixed;
  top: 12px;
  right: 12px;
  z-index: 61;
  width: 40px; height: 40px;
  border-radius: 50%;
  background: var(--glass-card);
  backdrop-filter: var(--glass-card-blur);
  -webkit-backdrop-filter: var(--glass-card-blur);
  border: 1px solid var(--glass-card-border);
  color: var(--ink);
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 4px 14px -6px rgba(42, 37, 32, 0.18);
  cursor: pointer;
  transition: background 200ms;
}
.gst-page .preview-overlay-close:hover { background: oklch(100% 0.006 75 / 0.82); }
.gst-page .preview-overlay-inner {
  flex: 1;
  display: flex; flex-direction: column;
  align-items: center;
  width: 100%;
  max-width: 380px;
  margin: 0 auto;
}

/* Toast */
.gst-page .toast-stack {
  position: fixed;
  bottom: 96px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 70;
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: center;
  pointer-events: none;
}
.gst-page .toast {
  padding: 10px 18px;
  border-radius: var(--r-sm, 10px);
  font-size: 13px;
  font-weight: 600;
  color: oklch(99% 0.006 75);
  box-shadow: 0 8px 24px -10px rgba(42, 37, 32, 0.3);
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.gst-page .toast.success { background: var(--sage); }
.gst-page .toast.error   { background: var(--clay); }
`;

// ───── Field primitive ─────

function Field({
  label, hint, help, children,
}: {
  label: string;
  hint?: string;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="field">
      <label>
        {label}
        {hint && <span className="hint">{hint}</span>}
      </label>
      {children}
      {help && <div className="field-help">{help}</div>}
    </div>
  );
}

// ───── Section card ─────

type IconCmp = React.ComponentType<{ width?: number; height?: number; strokeWidth?: number; className?: string }>;

function Section({
  open, onToggle, icon: Icon, title, sub, status, statusLabel, children,
}: {
  open:        boolean;
  onToggle:    () => void;
  icon:        IconCmp;
  title:       string;
  sub:         string;
  status:      'complete' | 'partial';
  statusLabel: string;
  children:    React.ReactNode;
}) {
  return (
    <section className={`section ${open ? 'open' : ''}`}>
      <button type="button" className="section-head" onClick={onToggle}>
        <div className="section-head-left">
          <span className="section-icon">
            <Icon width={18} height={18} strokeWidth={1.8} />
          </span>
          <div className="section-title-block">
            <div className="section-title">{title}</div>
            <div className="section-sub">{sub}</div>
          </div>
        </div>
        <div className="section-head-right">
          <span className={`section-status ${status}`}>{statusLabel}</span>
          <span className="section-chev">
            <ChevronDown width={16} height={16} />
          </span>
        </div>
      </button>
      {open && <div className="section-body">{children}</div>}
    </section>
  );
}

// ───── Main component ─────

export default function DashboardSettings() {
  const { currentEvent, isLoading: eventLoading } = useEventContext();
  const { canAccessTimeline } = useFeatureAccess();

  const [draft, setDraft]       = useState<ContentConfig>({});
  const [original, setOriginal] = useState<ContentConfig>({});
  const [saving, setSaving]     = useState(false);
  const [toasts, setToasts]     = useState<Toast[]>([]);
  const [showMobilePreview, setShowMobilePreview] = useState(false);
  const [openMap, setOpenMap]   = useState<Record<SectionKey, boolean>>({
    couple:    true,
    venue:     true,
    schedule:  false,
    transport: false,
    footer:    false,
  });

  const showToast = useCallback((message: string, kind: ToastKind = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, kind }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  }, []);

  useEffect(() => {
    if (!currentEvent) return;
    const config = (currentEvent.content_config ?? {}) as ContentConfig;
    setDraft({ ...config });
    setOriginal({ ...config });
  }, [currentEvent]);

  // ── Diff tracking ──

  const isDirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(original),
    [draft, original],
  );

  const changedCount = useMemo(() => {
    const keys = new Set<string>([...Object.keys(draft), ...Object.keys(original)]);
    keys.delete('whatsapp_templates'); // managed via Timeline
    let n = 0;
    for (const k of keys) {
      if (JSON.stringify(draft[k]) !== JSON.stringify(original[k])) n++;
    }
    return n;
  }, [draft, original]);

  // ── Field handlers ──

  const handleField = useCallback((key: string, value: unknown) => {
    setDraft(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleScheduleItem = useCallback(
    (index: number, field: keyof ScheduleItem, value: string) => {
      setDraft(prev => {
        const schedule = [...(prev.schedule ?? [])];
        schedule[index] = { ...schedule[index], [field]: value };
        return { ...prev, schedule };
      });
    },
    [],
  );

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

  const handleDiscard = useCallback(() => {
    setDraft({ ...original });
  }, [original]);

  const handleSave = useCallback(async () => {
    if (!currentEvent || !isDirty) return;
    setSaving(true);
    try {
      const toSave = { ...draft };
      if (original.whatsapp_templates) {
        toSave.whatsapp_templates = original.whatsapp_templates;
      }
      await updateEventContentConfig(currentEvent.id, toSave);
      setOriginal({ ...toSave });
      showToast('ההגדרות נשמרו בהצלחה');
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'שגיאה בשמירה', 'error');
    } finally {
      setSaving(false);
    }
  }, [currentEvent, draft, original, isDirty, showToast]);

  const toggleSection = useCallback((key: SectionKey) => {
    setOpenMap(prev => ({ ...prev, [key]: !prev[key] }));
  }, []);

  // ── Section status ──

  const status = useMemo(() => {
    const isFilled = (v: unknown) => v != null && String(v).trim() !== '';
    const couple   = isFilled(draft.couple_names) && isFilled(draft.invitation_text);
    const venue    = isFilled(draft.date_display) && isFilled(draft.venue_name) && isFilled(draft.venue_address_full);
    const sched    = (draft.schedule ?? []).length;
    const trans    = isFilled(draft.waze_link) || isFilled(draft.train_line) || isFilled(draft.parking_lot);
    const transFull = isFilled(draft.waze_link) && (isFilled(draft.train_line) || isFilled(draft.parking_lot));
    const footer   = isFilled(draft.footer_note) && isFilled(draft.closing_message);
    return {
      couple:    { ok: couple,    label: couple ? 'מלא' : 'חלקי' },
      venue:     { ok: venue,     label: venue ? 'מלא' : 'חלקי' },
      schedule:  { ok: sched > 0, label: sched > 0 ? `${sched} פריטים` : 'ריק' },
      transport: { ok: transFull, label: trans ? (transFull ? 'מלא' : 'חלקי') : 'ריק' },
      footer:    { ok: footer,    label: footer ? 'מלא' : 'חלקי' },
    } as const;
  }, [draft]);

  // ── Loading ──

  if (eventLoading) {
    return (
      <div
        dir="rtl"
        className="gst-page font-brand min-h-screen"
        style={{
          background: [
            'radial-gradient(circle at 84% 10%, var(--glow-rose) 0, transparent 30%)',
            'radial-gradient(circle at 18% 20%, var(--glow-violet) 0, transparent 28%)',
            'linear-gradient(180deg, var(--paper) 0%, oklch(96.5% 0.018 78) 55%, var(--paper-2) 100%)',
          ].join(', '),
        }}
      >
        <style>{SETTINGS_STYLES}</style>
        <DashboardNav />
        <main className="page-shell">
          <div style={{ height: 200 }} />
        </main>
      </div>
    );
  }

  const slug     = currentEvent?.slug ?? '';
  const schedule = draft.schedule ?? [];

  return (
    <div
      dir="rtl"
      className="gst-page font-brand min-h-screen"
      style={{
        background: [
          'radial-gradient(circle at 84% 10%, var(--glow-rose) 0, transparent 30%)',
          'radial-gradient(circle at 18% 20%, var(--glow-violet) 0, transparent 28%)',
          'linear-gradient(180deg, var(--paper) 0%, oklch(96.5% 0.018 78) 55%, var(--paper-2) 100%)',
        ].join(', '),
      }}
    >
      <style>{SETTINGS_STYLES}</style>
      <DashboardNav />

      <main className="page-shell">

        {!canAccessTimeline && (
          <div className="draft-banner">
            <b>האירוע שלכם במצב טיוטה</b> — Preview ועריכת עיצוב פעילים. גישה לניהול אורחים ו-WhatsApp תיפתח לאחר אישור.
          </div>
        )}

        {/* Page header */}
        <div className="page-header">
          <div>
            <h1>הגדרות אירוע</h1>
            <div className="sub">
              תוכן ההזמנה הדיגיטלית · התצוגה מתעדכנת בזמן אמת בצד · <b>קישור: guesto.app/{slug}</b>
            </div>
          </div>
          <div className="header-actions">
            <button
              className="ghost-btn"
              type="button"
              onClick={() => slug && window.open(`/${slug}`, '_blank')}
            >
              <Search width={14} height={14} strokeWidth={2} />
              תצוגה מקדימה מלאה
            </button>
            <button className="ghost-btn" type="button">
              <Download width={14} height={14} strokeWidth={2} />
              ייצוא
            </button>
            {/* Mobile preview FAB lives in topbar on mobile only — render here as mobile-visible */}
            <button
              className="ghost-btn"
              type="button"
              onClick={() => setShowMobilePreview(true)}
              style={{ }}
            >
              <Eye width={14} height={14} strokeWidth={2} />
              תצוגה
            </button>
          </div>
        </div>

        {/* Split */}
        <div className="split">

          {/* Form pane */}
          <div className="form-pane">

            {/* 1. COUPLE */}
            <Section
              open={openMap.couple}
              onToggle={() => toggleSection('couple')}
              icon={Heart}
              title="פרטי הזוג"
              sub="השמות, הציטוט והברכה שמופיעים בכותרת ההזמנה"
              status={status.couple.ok ? 'complete' : 'partial'}
              statusLabel={status.couple.label}
            >
              <div className="field-row">
                <Field label="שמות הזוג" hint="· מופיע בכותרת">
                  <input
                    type="text"
                    value={draft.couple_names ?? ''}
                    onChange={e => handleField('couple_names', e.target.value)}
                    placeholder="חגית & איתי"
                  />
                </Field>
              </div>
              <div className="field-row">
                <Field label="ציטוט פתיחה" hint="· אופציונלי, עד 120 תווים" help="ניתן להשתמש בגרשיים עבריים — מתורגם אוטומטית.">
                  <textarea
                    value={draft.quote ?? ''}
                    onChange={e => handleField('quote', e.target.value)}
                    placeholder="«ושוב מבטיחים זה לזו אהבה ואחווה ושלום ורעות»"
                    rows={2}
                  />
                </Field>
              </div>
              <div className="field-row">
                <Field label="טקסט הזמנה">
                  <textarea
                    value={draft.invitation_text ?? ''}
                    onChange={e => handleField('invitation_text', e.target.value)}
                    placeholder="שמחים לראותכם ביום חתונתנו..."
                  />
                </Field>
              </div>
            </Section>

            {/* 2. DATE & VENUE */}
            <Section
              open={openMap.venue}
              onToggle={() => toggleSection('venue')}
              icon={MapPin}
              title="תאריך ומקום"
              sub="פרטי האירוע, האולם, וכתובת לניווט"
              status={status.venue.ok ? 'complete' : 'partial'}
              statusLabel={status.venue.label}
            >
              <div className="field-row cols-3">
                <Field label="תאריך תצוגה" help="כפי שיוצג גדול בהזמנה">
                  <input
                    type="text"
                    value={draft.date_display ?? ''}
                    onChange={e => handleField('date_display', e.target.value)}
                    placeholder="10.10.2025"
                  />
                </Field>
                <Field label="עברי">
                  <input
                    type="text"
                    value={draft.date_hebrew ?? ''}
                    onChange={e => handleField('date_hebrew', e.target.value)}
                    placeholder="ט' בתשרי"
                  />
                </Field>
                <Field label="יום בשבוע">
                  <input
                    type="text"
                    value={draft.day_of_week ?? ''}
                    onChange={e => handleField('day_of_week', e.target.value)}
                    placeholder="שישי"
                  />
                </Field>
              </div>
              <div className="field-row">
                <Field label="שם האולם">
                  <input
                    type="text"
                    value={draft.venue_name ?? ''}
                    onChange={e => handleField('venue_name', e.target.value)}
                    placeholder="גן האירועים..."
                  />
                </Field>
              </div>
              <div className="field-row">
                <Field label="כתובת תצוגה" help="הטקסט המוצג על ההזמנה — קצר ונקי">
                  <textarea
                    value={draft.venue_address ?? ''}
                    onChange={e => handleField('venue_address', e.target.value)}
                    placeholder="רחוב הפרחים 1, תל אביב"
                    rows={2}
                  />
                </Field>
              </div>
              <div className="field-row">
                <Field label="כתובת מלאה" help="הכתובת תיפתח ב-Waze ובגוגל מפות בלחיצה.">
                  <input
                    type="text"
                    value={draft.venue_address_full ?? ''}
                    onChange={e => handleField('venue_address_full', e.target.value)}
                    placeholder="רחוב הפרחים 1, תל אביב 68000"
                  />
                </Field>
              </div>
              <div className="field-row">
                <Field label="שאילתת מפות" hint="· אופציונלי" help="הטקסט שמוקלד ב-Google Maps Embed">
                  <input
                    type="text"
                    value={draft.venue_maps_query ?? ''}
                    onChange={e => handleField('venue_maps_query', e.target.value)}
                    placeholder="גן האירועים תל אביב"
                    dir="ltr"
                  />
                </Field>
              </div>
            </Section>

            {/* 3. SCHEDULE */}
            <Section
              open={openMap.schedule}
              onToggle={() => toggleSection('schedule')}
              icon={Clock}
              title="לוח זמנים של הערב"
              sub="סדר היום מקבלת הפנים ועד הסיום"
              status={status.schedule.ok ? 'complete' : 'partial'}
              statusLabel={status.schedule.label}
            >
              <div className="schedule-list">
                {schedule.length === 0 && (
                  <div className="schedule-empty">עדיין אין פריטים בלוח הזמנים</div>
                )}
                {schedule.map((item, i) => (
                  <div className="schedule-item" key={i}>
                    <input
                      type="time"
                      value={item.time ?? ''}
                      onChange={e => handleScheduleItem(i, 'time', e.target.value)}
                    />
                    <input
                      type="text"
                      value={item.label ?? ''}
                      onChange={e => handleScheduleItem(i, 'label', e.target.value)}
                      placeholder="תיאור השלב"
                    />
                    <select
                      value={item.icon ?? ''}
                      onChange={e => handleScheduleItem(i, 'icon', e.target.value)}
                    >
                      {ICON_OPTIONS.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="remove"
                      onClick={() => removeScheduleItem(i)}
                      aria-label="הסר"
                    >
                      <X width={14} height={14} strokeWidth={2} />
                    </button>
                  </div>
                ))}
              </div>
              <button type="button" className="add-row-btn" onClick={addScheduleItem}>
                <Plus width={14} height={14} strokeWidth={2.4} />
                הוסף שלב לערב
              </button>
            </Section>

            {/* 4. TRANSPORT */}
            <Section
              open={openMap.transport}
              onToggle={() => toggleSection('transport')}
              icon={Car}
              title="הגעה והסעות"
              sub="קישור Waze, רכבת קלה, חניה"
              status={status.transport.ok ? 'complete' : 'partial'}
              statusLabel={status.transport.label}
            >
              <div className="field-row">
                <Field label="קישור Waze" help="ישלח לאורחים בהודעת לוגיסטיקה">
                  <input
                    type="text"
                    value={draft.waze_link ?? ''}
                    onChange={e => handleField('waze_link', e.target.value)}
                    placeholder="https://waze.com/ul/..."
                    dir="ltr"
                  />
                </Field>
              </div>

              <div className="field-row cols-2">
                <Field label="קו רכבת קלה">
                  <input
                    type="text"
                    value={draft.train_line ?? ''}
                    onChange={e => handleField('train_line', e.target.value)}
                    placeholder="אדום"
                  />
                </Field>
                <Field label="תחנה">
                  <input
                    type="text"
                    value={draft.train_station ?? ''}
                    onChange={e => handleField('train_station', e.target.value)}
                    placeholder="גן עיר"
                  />
                </Field>
              </div>
              <div className="field-row">
                <Field label="דקות הליכה מהרכבת">
                  <input
                    type="number"
                    value={draft.train_walk_minutes ?? ''}
                    onChange={e => handleField('train_walk_minutes', e.target.value ? Number(e.target.value) : undefined)}
                    placeholder="5"
                  />
                </Field>
              </div>

              <div className="field-row cols-2">
                <Field label="שם החניון">
                  <input
                    type="text"
                    value={draft.parking_lot ?? ''}
                    onChange={e => handleField('parking_lot', e.target.value)}
                    placeholder="חניון A"
                  />
                </Field>
                <Field label="דקות הליכה מהחניון">
                  <input
                    type="number"
                    value={draft.parking_walk_minutes ?? ''}
                    onChange={e => handleField('parking_walk_minutes', e.target.value ? Number(e.target.value) : undefined)}
                    placeholder="3"
                  />
                </Field>
              </div>
            </Section>

            {/* 5. FOOTER */}
            <Section
              open={openMap.footer}
              onToggle={() => toggleSection('footer')}
              icon={FileText}
              title="פתיח, סיום ופרטיות"
              sub="טקסט המעטפת והכרת תודה אחרונה"
              status={status.footer.ok ? 'complete' : 'partial'}
              statusLabel={status.footer.label}
            >
              <div className="field-row">
                <Field label="הערה תחתונה" help="מוצג מעל כפתור האישור">
                  <textarea
                    value={draft.footer_note ?? ''}
                    onChange={e => handleField('footer_note', e.target.value)}
                    placeholder="נא לאשר הגעה עד ה-1 בספטמבר..."
                  />
                </Field>
              </div>
              <div className="field-row">
                <Field label="הודעת סיום" help="מוצג בגדול מתחת לציטוט הסיום">
                  <textarea
                    value={draft.closing_message ?? ''}
                    onChange={e => handleField('closing_message', e.target.value)}
                    placeholder="מחכים לראותכם! 💛"
                  />
                </Field>
              </div>
            </Section>

          </div>

          {/* Preview pane (desktop only) */}
          <aside className="preview-pane desktop-only">
            {currentEvent && (
              <LivePreview
                event={currentEvent}
                config={draft}
                width={320}
                showChrome
              />
            )}
          </aside>

        </div>
      </main>

      {/* Save bar (always rendered, hides via class) */}
      <div className={`save-bar ${isDirty ? '' : 'hidden'}`}>
        <div className="save-bar-text">
          <span className="changes-pill">
            <span className="dot" />
            {changedCount} {changedCount === 1 ? 'שינוי לא שמור' : 'שינויים לא שמורים'}
          </span>
          <span className="changes-caption">השינויים יחולו על העמוד הציבורי לאחר השמירה.</span>
        </div>
        <div className="save-bar-actions">
          <button
            type="button"
            className="btn-discard"
            onClick={handleDiscard}
            disabled={saving || !isDirty}
          >
            בטל שינויים
          </button>
          <button
            type="button"
            className="btn-save"
            onClick={handleSave}
            disabled={saving || !isDirty}
          >
            {saving
              ? <Save     width={14} height={14} strokeWidth={2.2} />
              : <Check    width={14} height={14} strokeWidth={2.4} />}
            {saving ? 'שומר...' : 'שמור הכל'}
          </button>
        </div>
      </div>

      {/* Mobile preview overlay */}
      {showMobilePreview && (
        <div
          className="preview-overlay"
          onClick={e => { if (e.target === e.currentTarget) setShowMobilePreview(false); }}
        >
          <button
            type="button"
            className="preview-overlay-close"
            onClick={() => setShowMobilePreview(false)}
            aria-label="סגור תצוגה מקדימה"
          >
            <X width={18} height={18} strokeWidth={2} />
          </button>
          <div className="preview-overlay-inner">
            {currentEvent && (
              <LivePreview
                event={currentEvent}
                config={draft}
                width={320}
                showChrome
              />
            )}
          </div>
        </div>
      )}

      {/* Toasts */}
      <div className="toast-stack">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.kind}`}>
            {t.kind === 'success' && <Check width={14} height={14} strokeWidth={2.4} />}
            {t.message}
          </div>
        ))}
      </div>
    </div>
  );
}
