import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Search,
  Users,
  CheckCircle2,
  Clock,
  XCircle,
  ChevronDown,
  Send,
  Download,
  Phone,
  UserPlus,
  X,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useEvent } from '../hooks/useEvent';
import {
  GlassCard,
  GlassCardHeader,
  GlassCardTitle,
  GlassCardAction,
  GlassCardContent,
  GlassCardFooter,
} from '@/components/ui/glass-card';

// ─── Types ────────────────────────────────────────────────────────────────────

type RsvpStatus = 'pending' | 'attending' | 'declined';

interface Invitation {
  id: string;
  group_name: string | null;
  phone_numbers: string[] | null;
  rsvp_status: RsvpStatus | null;
  confirmed_pax: number | null;
  invited_pax: number | null;
  messages_sent_count: number | null;
  is_automated: boolean | null;
  side: string | null;
  guest_group: string | null;
}

interface MessageLog {
  id:            string;
  invitation_id: string;
  phone:         string;
  message_type:  string;
  content:       string;
  status:        'pending' | 'sent' | 'failed';
  error_log:     string | null;
  scheduled_for: string | null;
  sent_at:       string | null;
  created_at:    string;
}

interface Kpis {
  totalFamilies: number;
  confirmedFamilies: number;
  totalPaxInvited: number;
  totalPaxConfirmed: number;
  pending: number;
  declined: number;
}

// Modal form shape — declared at module level so AddGuestModal can reference it
const EMPTY_FORM = { group_name: '', phones: [''], side: '', guest_group: '', invited_pax: 1 };
type FormFields  = { group_name: string; phones: string[]; side: string; guest_group: string; invited_pax: number };

interface EventData {
  id: string;
  slug: string;
  content_config: Record<string, unknown> | null;
}

interface BulkMessageGuest {
  id: string;
  group_name: string | null;
  phone_numbers: string[] | null;
  invited_pax?: number | null;
}

interface BulkMessagePayload {
  guests: BulkMessageGuest[];
  messageType: 'template' | 'custom';
  content: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SLUG = 'hagit-and-itai';

// dot: Tailwind bg-* class for the coloured indicator dot inside the badge
const STATUS_MAP: Record<string, { label: string; classes: string; dot: string }> = {
  attending: { label: 'מגיע',    classes: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  pending:   { label: 'ממתין',   classes: 'bg-amber-100   text-amber-600',   dot: 'bg-amber-400'   },
  declined:  { label: 'לא מגיע', classes: 'bg-rose-100    text-rose-700',    dot: 'bg-rose-500'    },
};

// ─── Micro-components ─────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center" dir="rtl">
      <div className="text-center space-y-3">
        <div className="w-10 h-10 border-4 border-violet-600 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-slate-400 font-brand">טוען נתונים...</p>
      </div>
    </div>
  );
}

function ErrorView({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center" dir="rtl">
      <div className="bg-white rounded-2xl border border-red-200 shadow-sm p-8 max-w-xs w-full mx-4 text-center">
        <XCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
        <p className="font-medium text-slate-700 font-brand">שגיאה בטעינת הנתונים</p>
        <p className="text-sm text-slate-400 font-brand mt-1.5">{message}</p>
      </div>
    </div>
  );
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

interface KpiCardProps {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  value: string | number;
  sub: string;
  /** 0–1 ratio. When provided, renders a thin animated progress bar. */
  progress?: number;
  /** Tailwind bg-* class for the progress fill. Defaults to bg-violet-500. */
  progressColor?: string;
}

function KpiCard({
  icon,
  iconBg,
  title,
  value,
  sub,
  progress,
  progressColor = 'bg-violet-500',
}: KpiCardProps) {
  // Clamp to [0, 100] to guard against bad ratios (e.g. pax-confirmed > pax-invited)
  const pct: number | null =
    progress !== undefined
      ? Math.min(100, Math.max(0, Math.round(progress * 100)))
      : null;

  return (
    <article className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex items-start gap-4 hover:shadow-md transition-shadow duration-200">
      <div className={`shrink-0 rounded-xl p-2.5 ${iconBg}`}>{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-slate-500 font-brand leading-none mb-2">{title}</p>
        <p className="text-[1.6rem] font-bold text-slate-800 font-danidin leading-none tracking-tight">
          {value}
        </p>
        <p className="text-xs text-slate-400 font-brand mt-2 truncate">{sub}</p>

        {/* Progress bar — only rendered when a ratio is supplied */}
        {pct !== null && (
          <div className="mt-3 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ease-out ${progressColor}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
      </div>
    </article>
  );
}

// ── Status Badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string | null }) {
  const cfg = STATUS_MAP[status ?? ''] ?? {
    label: 'לא ידוע',
    classes: 'bg-slate-100 text-slate-500',
    dot: 'bg-slate-400',
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium font-brand whitespace-nowrap ${cfg.classes}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

// ── Msg Status Badge ──────────────────────────────────────────────────────

const MSG_STATUS_MAP = {
  pending: { label: 'ממתין בתור', classes: 'bg-amber-100 text-amber-700 border-amber-200' },
  sent:    { label: 'נשלח',       classes: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  failed:  { label: 'נכשל',       classes: 'bg-rose-100 text-rose-700 border-rose-200' },
  none:    { label: 'טרם נשלח',   classes: 'bg-slate-100 text-slate-500 border-slate-200' },
} as const;

interface MsgStatusBadgeProps {
  log:     MessageLog | undefined;
  onClick: () => void;
}

function MsgStatusBadge({ log, onClick }: MsgStatusBadgeProps) {
  const key = (log?.status ?? 'none') as keyof typeof MSG_STATUS_MAP;
  const cfg = MSG_STATUS_MAP[key] ?? MSG_STATUS_MAP.none;
  return (
    <button
      type="button"
      onClick={e => { e.stopPropagation(); onClick(); }}
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium font-brand border whitespace-nowrap hover:opacity-80 transition-opacity ${cfg.classes}`}
    >
      {cfg.label}
    </button>
  );
}

// ── Select Filter ─────────────────────────────────────────────────────────────

interface SelectFilterProps {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: string[];
  labels?: Record<string, string>;
}

function SelectFilter({ value, onChange, placeholder, options, labels }: SelectFilterProps) {
  return (
    <div className="relative shrink-0">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="appearance-none pr-3 pl-8 py-2.5 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent cursor-pointer transition-shadow font-brand"
      >
        <option value="">{placeholder}</option>
        {options.map(opt => (
          <option key={opt} value={opt}>{labels?.[opt] ?? opt}</option>
        ))}
      </select>
      <ChevronDown className="absolute inset-y-0 left-2.5 my-auto w-3.5 h-3.5 text-slate-400 pointer-events-none" />
    </div>
  );
}

// ── Add Guest Modal ───────────────────────────────────────────────────────────

interface AddGuestModalProps {
  isOpen:       boolean;
  onClose:      () => void;
  onSuccess:    (newInvitation: Invitation) => void;
  eventId:      string;
  saving:       boolean;
  setSaving:    (v: boolean) => void;
  formError:    string | null;
  setFormError: (v: string | null) => void;
  form:         FormFields;
  setForm:      (v: FormFields) => void;
}

function AddGuestModal({
  isOpen, onClose, onSuccess, eventId,
  saving, setSaving, formError, setFormError, form, setForm,
}: AddGuestModalProps) {
  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Scalar field helper (everything except the phones array)
  const handleField = (
    field: Exclude<keyof FormFields, 'phones'>,
    value: string | number
  ) => setForm({ ...form, [field]: value } as FormFields);

  // Phone array helpers
  const setPhone    = (idx: number, value: string) => {
    const phones = [...form.phones];
    phones[idx]  = value;
    setForm({ ...form, phones });
  };
  const addPhone    = () => setForm({ ...form, phones: [...form.phones, ''] });
  const removePhone = (idx: number) =>
    setForm({ ...form, phones: form.phones.filter((_, i) => i !== idx) });

  // Normalise a single raw phone string to international format
  const normalisePhone = (raw: string): string => {
    const digits = raw.replace(/\D/g, '');
    return digits.startsWith('0') ? '972' + digits.slice(1) : digits;
  };

  const validate = (): string | null => {
    if (!form.group_name.trim()) return 'נא להזין שם';
    // First phone is mandatory
    const firstDigits = form.phones[0].replace(/\D/g, '');
    if (firstDigits.length < 9 || firstDigits.length > 10)
      return 'נא להזין מספר טלפון תקין (9–10 ספרות)';
    // Validate any additional non-empty phones
    for (let i = 1; i < form.phones.length; i++) {
      const raw = form.phones[i].trim();
      if (!raw) continue; // empty additional fields are filtered out
      const d = raw.replace(/\D/g, '');
      if (d.length < 9 || d.length > 10)
        return `טלפון ${i + 1}: נא להזין מספר תקין (9–10 ספרות)`;
    }
    if (form.invited_pax < 1) return 'מספר המוזמנים חייב להיות לפחות 1';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate();
    if (err) { setFormError(err); return; }
    if (!supabase) { setFormError('Supabase is not configured'); return; }

    setSaving(true);
    setFormError(null);

    // Filter out blank additional entries, then normalise all
    const phone_numbers = form.phones
      .filter(p => p.trim().length > 0)
      .map(normalisePhone);

    const { data, error } = await supabase
      .from('invitations')
      .insert({
        event_id:            eventId,
        group_name:          form.group_name.trim(),
        phone_numbers,
        side:                form.side  || null,
        guest_group:         form.guest_group.trim() || null,
        invited_pax:         form.invited_pax,
        confirmed_pax:       0,
        rsvp_status:         'pending',
        is_automated:        false,
        messages_sent_count: 0,
      })
      .select()
      .single();

    setSaving(false);

    if (error) {
      setFormError(`שגיאה בשמירה: ${error.message}`);
      return;
    }
    onSuccess(data as Invitation);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      {/* GlassCard — stop click from closing */}
      <GlassCard className="w-full max-w-md font-brand" dir="rtl" onClick={e => e.stopPropagation()}>

          {/* ── Header ─────────────────────────────────────────────── */}
          <GlassCardHeader className="border-b border-white/40">
            <GlassCardTitle
              id="modal-title"
              className="text-lg font-bold text-slate-800 font-danidin"
            >
              הוספת מוזמן
            </GlassCardTitle>
            <GlassCardAction>
              <button
                onClick={onClose}
                disabled={saving}
                className="p-2 rounded-xl bg-white/20 hover:bg-white/40 text-slate-600 border border-white/40 transition-all shadow-sm outline-none"
                aria-label="סגור"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </GlassCardAction>
          </GlassCardHeader>

          {/* ── Form ───────────────────────────────────────────────── */}
          <form onSubmit={handleSubmit} noValidate style={{ background: 'transparent' }}>
            <GlassCardContent className="py-5 space-y-4">

              {/* group_name */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  שם הרשומה / משפחה <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.group_name}
                  onChange={e => handleField('group_name', e.target.value)}
                  placeholder="משפחת כהן"
                  className="w-full px-3 py-2.5 text-sm text-slate-800 bg-white border border-slate-200/70 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent placeholder:text-slate-400"
                  disabled={saving}
                  autoFocus
                />
              </div>

              {/* phone numbers — dynamic list */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  טלפון <span className="text-rose-500">*</span>
                </label>
                <div className="space-y-2">
                  {form.phones.map((phone, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="tel"
                        value={phone}
                        onChange={e => setPhone(idx, e.target.value)}
                        placeholder="050-000-0000"
                        className="flex-1 px-3 py-2.5 text-sm text-slate-800 bg-white border border-white/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent placeholder:text-slate-400 shadow-sm"
                        disabled={saving}
                        dir="ltr"
                        autoFocus={idx === 0}
                      />
                      {idx > 0 ? (
                        <button
                          type="button"
                          onClick={() => removePhone(idx)}
                          disabled={saving}
                          className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 border border-rose-500/20 transition-all shadow-sm outline-none"
                          aria-label="הסר טלפון"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      ) : (
                        /* Invisible spacer — matches X button size for perfect alignment */
                        <div className="w-10 h-10 flex-shrink-0" />
                      )}
                    </div>
                  ))}
                </div>
                {/* Add phone button — hidden when 5 phones already entered */}
                {form.phones.length < 5 && (
                  <button
                    type="button"
                    onClick={addPhone}
                    disabled={saving}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-xl bg-violet-500/10 hover:bg-violet-500/20 text-violet-700 border border-violet-500/20 transition-all shadow-sm mt-1 outline-none disabled:opacity-40 font-brand"
                  >
                    <span className="text-sm leading-none font-bold">+</span>
                    טלפון נוסף
                  </button>
                )}
              </div>

              {/* side + group — 2-column row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">צד</label>
                  <div className="relative">
                    <select
                      value={form.side}
                      onChange={e => handleField('side', e.target.value)}
                      className="w-full appearance-none pr-3 pl-7 py-2.5 text-sm text-slate-800 bg-white border border-slate-200/70 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent cursor-pointer"
                      disabled={saving}
                    >
                      <option value="">ללא</option>
                      <option value="חתן">חתן</option>
                      <option value="כלה">כלה</option>
                      <option value="משותף">משותף</option>
                    </select>
                    <ChevronDown className="absolute inset-y-0 left-2 my-auto w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">קבוצה</label>
                  <input
                    type="text"
                    value={form.guest_group}
                    onChange={e => handleField('guest_group', e.target.value)}
                    placeholder="עבודה, צבא..."
                    className="w-full px-3 py-2.5 text-sm text-slate-800 bg-white border border-slate-200/70 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent placeholder:text-slate-400"
                    disabled={saving}
                  />
                </div>
              </div>

              {/* invited_pax */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  הוזמנו <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={form.invited_pax}
                  onChange={e => handleField('invited_pax', Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-24 px-3 py-2.5 text-sm text-slate-800 bg-white border border-slate-200/70 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent text-center"
                  disabled={saving}
                />
              </div>

              {/* Inline error */}
              {formError && (
                <p className="text-sm text-rose-600 font-brand bg-rose-50/90 px-3 py-2 rounded-xl">
                  {formError}
                </p>
              )}

            </GlassCardContent>

            {/* ── Footer ─────────────────────────────────────────── */}
            <GlassCardFooter className="justify-between py-4 border-t border-white/40 rounded-b-2xl">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="px-6 py-2.5 rounded-xl bg-slate-500/10 hover:bg-slate-500/20 text-slate-700 border border-slate-500/20 font-medium transition-all shadow-sm outline-none disabled:opacity-40"
              >
                ביטול
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-medium shadow-md transition-all border-none outline-none disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    שומר...
                  </>
                ) : 'שמור'}
              </button>
            </GlassCardFooter>
          </form>

        </GlassCard>
    </div>
  );
}

// ── Send WhatsApp Modal ───────────────────────────────────────────────────────

const TEMPLATE_LABELS: Record<string, string> = {
  icebreaker: 'פתיחה ראשונית',
  nudge:      'תזכורת עדינה',
  ultimatum:  'תזכורת אחרונה',
  logistics:  'מידע לוגיסטי',
  hangover:   'תודה לאחר האירוע',
};

interface SendWhatsAppModalProps {
  isOpen:          boolean;
  onClose:         () => void;
  selectedGuests:  BulkMessageGuest[];
  eventConfig:     Record<string, unknown>;
  onSend:          (payload: BulkMessagePayload) => void;
}

function SendWhatsAppModal({
  isOpen, onClose, selectedGuests, eventConfig, onSend,
}: SendWhatsAppModalProps) {
  const [messageType,       setMessageType]       = useState<'template' | 'custom'>('template');
  const [selectedTemplate,  setSelectedTemplate]  = useState('');
  const [customText,        setCustomText]         = useState('');

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) { setSelectedTemplate(''); setCustomText(''); setMessageType('template'); }
  }, [isOpen]);

  if (!isOpen) return null;

  const templates = (eventConfig.whatsapp_templates as Record<string, { singular?: string; plural?: string }>) ?? {};
  const templateKeys = Object.keys(templates);
  const coupleNames  = (eventConfig.couple_names as string) || 'אנחנו';

  // Live preview — first selected guest, respects singular/plural
  const previewGuest = selectedGuests[0];
  const isPlural     = (previewGuest?.invited_pax ?? 1) > 1;
  const rawPreview   = messageType === 'template' && selectedTemplate
    ? ((isPlural ? templates[selectedTemplate]?.plural : templates[selectedTemplate]?.singular) ?? '')
    : customText;
  const preview = rawPreview
    .replace(/{{name}}/g,         previewGuest?.group_name || 'אורח')
    .replace(/{{couple_names}}/g, coupleNames)
    .replace(/{{link}}/g,         '[קישור לאירוע]')
    .replace(/{{waze_link}}/g,    '[קישור לוויז]');

  const canSend = messageType === 'custom' ? customText.trim().length > 0 : selectedTemplate !== '';

  const handleSend = () => {
    if (!canSend) return;
    onSend({
      guests:      selectedGuests,
      messageType,
      content:     messageType === 'template' ? selectedTemplate : customText,
    });
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="whatsapp-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <GlassCard className="w-full max-w-lg font-brand" dir="rtl" onClick={e => e.stopPropagation()}>

        <GlassCardHeader className="border-b border-white/40">
          <div>
            <GlassCardTitle id="whatsapp-modal-title" className="text-lg font-bold text-slate-800 font-danidin">
              שליחת הודעת WhatsApp
            </GlassCardTitle>
            <p className="text-xs text-slate-500 font-brand mt-0.5">
              {selectedGuests.length} נמענים נבחרו
            </p>
          </div>
          <GlassCardAction>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-white/20 hover:bg-white/40 text-slate-600 border border-white/40 transition-all shadow-sm outline-none"
              aria-label="סגור"
            >
              <XCircle className="w-5 h-5" />
            </button>
          </GlassCardAction>
        </GlassCardHeader>

        <GlassCardContent className="py-5 space-y-4">

          {/* ── Mode toggle ──────────────────────────────────────── */}
          <div className="flex gap-2">
            {(['template', 'custom'] as const).map(mode => (
              <button
                key={mode}
                type="button"
                onClick={() => setMessageType(mode)}
                className={`flex-1 py-2 px-3 rounded-xl text-sm font-medium border transition-all ${
                  messageType === mode
                    ? 'bg-violet-600 text-white border-violet-600 shadow-sm'
                    : 'bg-white/50 text-slate-600 border-white/60 hover:bg-white/70'
                }`}
              >
                {mode === 'template' ? 'תבנית מוגדרת' : 'הודעה חופשית'}
              </button>
            ))}
          </div>

          {/* ── Template selector ────────────────────────────────── */}
          {messageType === 'template' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">בחר תבנית</label>
              {templateKeys.length === 0 ? (
                <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                  לא הוגדרו תבניות ב-<code className="font-mono text-xs">content_config.whatsapp_templates</code>
                </p>
              ) : (
                <div className="relative">
                  <select
                    value={selectedTemplate}
                    onChange={e => setSelectedTemplate(e.target.value)}
                    className="w-full appearance-none pr-3 pl-8 py-2.5 text-sm text-slate-800 bg-white border border-slate-200/70 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent cursor-pointer"
                  >
                    <option value="">— בחר תבנית —</option>
                    {templateKeys.map(key => (
                      <option key={key} value={key}>
                        {TEMPLATE_LABELS[key] ?? key}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute inset-y-0 left-2.5 my-auto w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                </div>
              )}
            </div>
          )}

          {/* ── Custom textarea ──────────────────────────────────── */}
          {messageType === 'custom' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                הודעה חופשית
                <span className="text-slate-400 font-normal mr-2 text-xs">
                  — ניתן להשתמש ב-&#123;&#123;name&#125;&#125;, &#123;&#123;link&#125;&#125;
                </span>
              </label>
              <textarea
                value={customText}
                onChange={e => setCustomText(e.target.value)}
                rows={4}
                placeholder="כתוב כאן את ההודעה שלך..."
                className="w-full px-3 py-2.5 text-sm text-slate-800 bg-white border border-slate-200/70 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent placeholder:text-slate-400 resize-none"
                dir="rtl"
              />
            </div>
          )}

          {/* ── Live preview ─────────────────────────────────────── */}
          {preview && previewGuest && (
            <div>
              <p className="text-xs font-medium text-slate-500 mb-1.5">
                תצוגה מקדימה — {previewGuest.group_name}
                {selectedGuests.length > 1 && (
                  <span className="text-slate-400 font-normal"> (+{selectedGuests.length - 1} נוספים)</span>
                )}
              </p>
              <div className="bg-emerald-50 border border-emerald-200/70 rounded-xl px-3 py-2.5 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                {preview}
              </div>
            </div>
          )}

        </GlassCardContent>

        <GlassCardFooter className="justify-between py-4 border-t border-white/40 rounded-b-2xl">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-slate-500/10 hover:bg-slate-500/20 text-slate-700 border border-slate-500/20 font-medium transition-all shadow-sm outline-none"
          >
            ביטול
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={!canSend}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-md transition-all border-none outline-none disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
            שלח ל-{selectedGuests.length} נמענים
          </button>
        </GlassCardFooter>

      </GlassCard>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [invitations, setInvitations] = useState<Invitation[]>([]);

  // ── Event data via hook (consistent with app architecture) ────────────────
  const { event: rawEvent, loading: eventLoading, notFound } =
    useEvent(SLUG) as { event: EventData | null; loading: boolean; notFound: boolean };
  const event = rawEvent;

  // ── Invitations loading/error (separate from event loading) ───────────────
  const [invLoading, setInvLoading] = useState(false);
  const [invError,   setInvError]   = useState<string | null>(null);

  // Filters
  const [search, setSearch]             = useState('');
  const [sideFilter, setSideFilter]     = useState('');
  const [groupFilter, setGroupFilter]   = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Row selection
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const selectAllRef = useRef<HTMLInputElement>(null);

  // ── Add-guest modal ───────────────────────────────────────────────────────
  const [isModalOpen, setIsModalOpen]             = useState(false);
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
  const [form, setForm]               = useState<FormFields>({ ...EMPTY_FORM });
  const [saving, setSaving]           = useState(false);
  const [formError, setFormError]     = useState<string | null>(null);
  const [toast, setToast]             = useState<string | null>(null);
  const [toastVariant, setToastVariant] = useState<'success' | 'error'>('success');

  // ── Message history drawer ────────────────────────────────────────────────
  const [latestMsgLogs,    setLatestMsgLogs]    = useState<Map<string, MessageLog>>(new Map());
  const [drawerInvitation, setDrawerInvitation] = useState<Invitation | null>(null);
  const [drawerLogs,       setDrawerLogs]       = useState<MessageLog[]>([]);
  const [drawerLoading,    setDrawerLoading]    = useState(false);

  // ── Invitations fetch — runs once event.id is available ──────────────────

  useEffect(() => {
    if (!event?.id || !supabase) return;
    const sb = supabase;
    const id = event.id;

    setInvLoading(true);
    setInvError(null);

    sb.from('invitations')
      .select('*')
      .eq('event_id', id)
      .order('group_name', { ascending: true })
      .then(({ data, error: err }) => {
        if (err) setInvError(err.message);
        else setInvitations((data ?? []) as Invitation[]);
        setInvLoading(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event?.id]);

  // Batch-fetch the most-recent message_log for every invitation in one query.
  // Reduces client-side to Map<invitation_id, MessageLog> for O(1) badge lookup.
  useEffect(() => {
    if (!supabase || invitations.length === 0) {
      setLatestMsgLogs(new Map());
      return;
    }
    let ignored = false;
    const ids = invitations.map(i => i.id);
    supabase
      .from('message_logs')
      .select('id, invitation_id, phone, message_type, content, status, error_log, scheduled_for, sent_at, created_at')
      .in('invitation_id', ids)
      .order('created_at', { ascending: false })
      .then(({ data, error: err }) => {
        if (ignored) return;
        if (err) {
          console.error('[Dashboard] batch message_logs fetch failed:', err.message);
          setLatestMsgLogs(new Map());
          return;
        }
        const map = new Map<string, MessageLog>();
        (data ?? []).forEach(log => {
          // Keep only the first (newest) log encountered per invitation
          if (!map.has(log.invitation_id)) map.set(log.invitation_id, log as MessageLog);
        });
        setLatestMsgLogs(map);
      });
    return () => { ignored = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- supabase is a stable module-level singleton
  }, [invitations]);

  // ── Derived data ──────────────────────────────────────────────────────────

  const sides = useMemo(() => {
    const s = new Set<string>();
    invitations.forEach(i => { if (i.side) s.add(i.side); });
    return [...s].sort();
  }, [invitations]);

  const groups = useMemo(() => {
    const g = new Set<string>();
    invitations.forEach(i => { if (i.guest_group) g.add(i.guest_group); });
    return [...g].sort();
  }, [invitations]);

  const filtered = useMemo(() => {
    return invitations.filter(inv => {
      if (search) {
        const q = search.toLowerCase();
        const nameOk  = inv.group_name?.toLowerCase().includes(q) ?? false;
        const phoneOk = inv.phone_numbers?.some(p => p.includes(q)) ?? false;
        if (!nameOk && !phoneOk) return false;
      }
      if (sideFilter   && inv.side        !== sideFilter)   return false;
      if (groupFilter  && inv.guest_group  !== groupFilter)  return false;
      if (statusFilter && inv.rsvp_status !== statusFilter) return false;
      return true;
    });
  }, [invitations, search, sideFilter, groupFilter, statusFilter]);

  const kpi: Kpis = useMemo(() => ({
    totalFamilies:     invitations.length,
    confirmedFamilies: invitations.filter(i => i.rsvp_status === 'attending').length,
    totalPaxInvited:   invitations.reduce((s, i) => s + (i.invited_pax  ?? 0), 0),
    totalPaxConfirmed: invitations.reduce((s, i) => s + (i.confirmed_pax ?? 0), 0),
    pending:           invitations.filter(i => i.rsvp_status === 'pending').length,
    declined:          invitations.filter(i => i.rsvp_status === 'declined').length,
  }), [invitations]);

  // ── Selection ─────────────────────────────────────────────────────────────

  const filteredIds         = useMemo(() => filtered.map(i => i.id), [filtered]);
  const selectedGuestsArray = useMemo(
    () => filtered.filter(inv => selected.has(inv.id)),
    [filtered, selected]
  );
  const allChecked  = filteredIds.length > 0 && filteredIds.every(id => selected.has(id));
  const someChecked = filteredIds.some(id => selected.has(id));

  useEffect(() => {
    if (!selectAllRef.current) return;
    selectAllRef.current.indeterminate = someChecked && !allChecked;
  }, [someChecked, allChecked]);

  const toggleAll = () => {
    setSelected(prev => {
      const next = new Set(prev);
      if (allChecked) filteredIds.forEach(id => next.delete(id));
      else            filteredIds.forEach(id => next.add(id));
      return next;
    });
  };

  const toggleRow = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // ── Modal helpers ─────────────────────────────────────────────────────────

  const openModal  = () => { setForm({ ...EMPTY_FORM }); setFormError(null); setIsModalOpen(true); };
  const closeModal = () => { if (saving) return; setIsModalOpen(false); };

  const handleGuestAdded = (newInv: Invitation) => {
    setInvitations(prev =>
      [newInv, ...prev].sort((a, b) =>
        (a.group_name ?? '').localeCompare(b.group_name ?? '', 'he')
      )
    );
    setIsModalOpen(false);
    setToast('המוזמן נוסף בהצלחה ✓');
    setTimeout(() => setToast(null), 3000);
  };

  // ── Column visibility ─────────────────────────────────────────────────────

  const hasSideOrGroup = invitations.some(i => i.side || i.guest_group);
  const hasInvitedPax  = invitations.some(i => i.invited_pax != null && i.invited_pax > 0);

  // ── WhatsApp bulk message ─────────────────────────────────────────────────

  const handleSendBulkMessage = async (payload: BulkMessagePayload) => {
    if (!event || !supabase) return;
    const { guests, messageType, content } = payload;
    const { whatsapp_templates, couple_names, waze_link } = (event.content_config ?? {}) as Record<string, unknown>;

    // Safety: bail early if template mode is requested but no templates are configured
    if (messageType === 'template' && !whatsapp_templates) {
      console.error('handleSendBulkMessage: whatsapp_templates is missing from event.content_config. Aborting.');
      return;
    }

    const eventLink = `https://yourdomain.com/${event.slug}`;

    // message_type value: the template key (e.g. 'icebreaker') for template sends, 'custom' otherwise
    const messageTypeValue = messageType === 'template' ? content : 'custom';

    const messageLogs: Array<{
      event_id:      string;
      invitation_id: string;
      phone:         string;
      message_type:  string;
      content:       string;
      status:        string;
    }> = [];

    guests.forEach(guest => {
      const isPlural = (guest.invited_pax ?? 1) > 1;
      let rawMessage = '';

      // 1. שליפת טקסט הבסיס (לפי יחיד/רבים או טקסט חופשי)
      if (messageType === 'template') {
        const templates = whatsapp_templates as Record<string, { singular?: string; plural?: string }> | undefined;
        const templateObj = templates?.[content];
        rawMessage = (isPlural ? templateObj?.plural : templateObj?.singular) ?? '';

        if (!rawMessage) {
          console.error(`Template "${content}" not found for guest ${guest.group_name}`);
          return; // מדלגים על האורח אם אין תבנית תקינה
        }
      } else {
        rawMessage = content;
      }

      // 2. אינטרפולציה - החלפת המשתנים הדינמיים
      const personalizedMessage = rawMessage
        .replace(/{{name}}/g,         guest.group_name || 'אורח')
        .replace(/{{couple_names}}/g, (couple_names as string) || 'אנחנו')
        .replace(/{{link}}/g,         eventLink)
        .replace(/{{waze_link}}/g,    (waze_link as string) || '');

      // 3. phone_numbers is already a string[] in the DB — one row per phone
      (guest.phone_numbers ?? []).filter(Boolean).forEach((phone: string) => {
        messageLogs.push({
          event_id:      event.id,
          invitation_id: guest.id,
          phone,
          message_type:  messageTypeValue,
          content:       personalizedMessage,
          status:        'pending',
        });
      });
    });

    if (messageLogs.length === 0) return;

    // 4. Bulk insert into message_logs — the scheduler picks up 'pending' rows
    const { error: insertError } = await supabase
      .from('message_logs')
      .insert(messageLogs);

    if (insertError) {
      console.error('Error inserting into message_logs:', insertError);
      setToastVariant('error');
      setToast(`שגיאה בהוספה לתור: ${insertError.message}`);
      setTimeout(() => setToast(null), 4000);
      return;
    }

    setToastVariant('success');
    setToast(`ההודעות נוספו לתור בהצלחה ✓`);
    setTimeout(() => setToast(null), 3000);
    setSelected(new Set());
    setIsMessageModalOpen(false);
  };

  // ── Derived loading / error ───────────────────────────────────────────────

  const loading = eventLoading || invLoading;
  const error   = notFound ? 'אירוע לא נמצא' : invError;

  // ── Render guards ─────────────────────────────────────────────────────────

  if (loading) return <Spinner />;
  if (error)   return <ErrorView message={error} />;

  const colSpan = hasSideOrGroup ? 7 : 6;

  // Safe ratios — avoid division by zero
  const familyConfirmRate = kpi.totalFamilies > 0 ? kpi.confirmedFamilies / kpi.totalFamilies : 0;
  const paxConfirmRate    = kpi.totalPaxInvited  > 0 ? kpi.totalPaxConfirmed / kpi.totalPaxInvited : undefined;
  const pendingRate       = kpi.totalFamilies > 0 ? kpi.pending  / kpi.totalFamilies : 0;
  const declinedRate      = kpi.totalFamilies > 0 ? kpi.declined / kpi.totalFamilies : 0;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-brand" dir="rtl">

      {/* ══════════════════════════════════════════════════════════════════
          MODAL + TOAST (rendered at root so they layer above everything)
      ══════════════════════════════════════════════════════════════════ */}
      <AddGuestModal
        isOpen={isModalOpen}
        onClose={closeModal}
        onSuccess={handleGuestAdded}
        eventId={event?.id ?? ''}
        saving={saving}
        setSaving={setSaving}
        formError={formError}
        setFormError={setFormError}
        form={form}
        setForm={setForm}
      />

      <SendWhatsAppModal
        isOpen={isMessageModalOpen}
        onClose={() => setIsMessageModalOpen(false)}
        selectedGuests={selectedGuestsArray}
        eventConfig={event?.content_config ?? {}}
        onSend={handleSendBulkMessage}
      />

      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 text-white text-sm font-medium font-brand px-4 py-2.5 rounded-xl shadow-lg ${
          toastVariant === 'error' ? 'bg-rose-600' : 'bg-emerald-600'
        }`}>
          {toast}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          HEADER
      ══════════════════════════════════════════════════════════════════ */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">

          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 bg-violet-600 rounded-lg flex items-center justify-center shrink-0">
              <Users className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-bold text-slate-800 font-danidin leading-none">
                ניהול הזמנות
              </h1>
              <p className="text-xs text-slate-400 font-brand mt-0.5 truncate">
                {event?.slug || SLUG}
              </p>
            </div>
          </div>

          {/* Action buttons — RTL renders right-to-left, so הוסף מוזמן appears first (right) */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={openModal}
              className="shrink-0 inline-flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 active:bg-violet-800 text-white text-sm font-medium font-brand rounded-xl transition-colors shadow-sm"
            >
              <UserPlus className="w-4 h-4" />
              הוסף מוזמן
            </button>
            <button
              className="shrink-0 inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-medium font-brand rounded-xl transition-colors"
            >
              <Download className="w-4 h-4" />
              ייצוא
            </button>
          </div>

        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* ════════════════════════════════════════════════════════════════
            KPI CARDS — with animated progress bars
        ════════════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">

          <KpiCard
            icon={<Users className="w-5 h-5 text-violet-600" />}
            iconBg="bg-violet-50"
            title="הזמנות"
            value={`${kpi.confirmedFamilies} / ${kpi.totalFamilies}`}
            sub="משפחות אישרו הגעה"
            progress={familyConfirmRate}
            progressColor="bg-violet-500"
          />

          <KpiCard
            icon={<CheckCircle2 className="w-5 h-5 text-emerald-600" />}
            iconBg="bg-emerald-50"
            title='סה"כ אורחים'
            value={kpi.totalPaxConfirmed}
            sub={
              kpi.totalPaxInvited > 0
                ? `מתוך ${kpi.totalPaxInvited} מוזמנים`
                : 'אורחים מאושרים'
            }
            progress={paxConfirmRate}
            progressColor="bg-emerald-500"
          />

          <KpiCard
            icon={<Clock className="w-5 h-5 text-amber-500" />}
            iconBg="bg-amber-50"
            title="ממתינים לתשובה"
            value={kpi.pending}
            sub="הזמנות שטרם נענו"
            progress={pendingRate}
            progressColor="bg-amber-400"
          />

          <KpiCard
            icon={<XCircle className="w-5 h-5 text-rose-500" />}
            iconBg="bg-rose-50"
            title="שגיאות / ביטולים"
            value={kpi.declined}
            sub="לא מגיעים"
            progress={declinedRate}
            progressColor="bg-rose-500"
          />

        </div>

        {/* ════════════════════════════════════════════════════════════════
            FILTER / ACTION BAR
        ════════════════════════════════════════════════════════════════ */}
        <section className="bg-white rounded-lg border border-slate-200 shadow-sm px-4 py-3.5 mb-6">
          <div className="flex flex-wrap items-center gap-3">

            {/* Search */}
            <div className="relative flex-1 min-w-52">
              <Search className="absolute inset-y-0 right-3 my-auto w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="search"
                placeholder="חפש שם או טלפון..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pr-9 pl-3 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-shadow font-brand"
              />
            </div>

            {sides.length > 0 && (
              <SelectFilter
                value={sideFilter}
                onChange={setSideFilter}
                placeholder="כל הצדדים"
                options={sides}
              />
            )}

            {groups.length > 0 && (
              <SelectFilter
                value={groupFilter}
                onChange={setGroupFilter}
                placeholder="כל הקבוצות"
                options={groups}
              />
            )}

            <SelectFilter
              value={statusFilter}
              onChange={setStatusFilter}
              placeholder="כל הסטטוסים"
              options={['attending', 'pending', 'declined']}
              labels={{ attending: 'מגיעים', pending: 'ממתינים', declined: 'לא מגיעים' }}
            />

            <span className="text-xs text-slate-400 font-brand mr-auto">
              {filtered.length === invitations.length
                ? `${invitations.length} הזמנות`
                : `${filtered.length} מתוך ${invitations.length}`}
            </span>

          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════════
            GUEST TABLE
        ════════════════════════════════════════════════════════════════ */}
        <section className="bg-white shadow-sm rounded-lg border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">

              {/* ── Table header ────────────────────────────────────────── */}
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">

                  <th className="w-12 px-4 py-3.5 text-right">
                    <input
                      ref={selectAllRef}
                      type="checkbox"
                      checked={allChecked}
                      onChange={toggleAll}
                      className="w-4 h-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500 cursor-pointer"
                    />
                  </th>

                  <th className="px-4 py-3.5 text-right font-semibold text-slate-400 text-xs tracking-wider whitespace-nowrap">
                    שם
                  </th>
                  <th className="px-4 py-3.5 text-right font-semibold text-slate-400 text-xs tracking-wider whitespace-nowrap">
                    טלפונים
                  </th>

                  {hasSideOrGroup && (
                    <th className="px-4 py-3.5 text-right font-semibold text-slate-400 text-xs tracking-wider whitespace-nowrap">
                      צד / קבוצה
                    </th>
                  )}

                  <th className="px-4 py-3.5 text-right font-semibold text-slate-400 text-xs tracking-wider whitespace-nowrap">
                    כמות
                  </th>
                  <th className="px-4 py-3.5 text-right font-semibold text-slate-400 text-xs tracking-wider whitespace-nowrap">
                    סטטוס
                  </th>
                  <th className="px-4 py-3.5 text-right font-semibold text-slate-400 text-xs tracking-wider whitespace-nowrap">
                    סטטוס הודעה
                  </th>

                </tr>
              </thead>

              {/* ── Table body ──────────────────────────────────────────── */}
              <tbody className="divide-y divide-slate-100">

                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={colSpan} className="py-20 text-center">
                      <Users className="w-8 h-8 text-slate-200 mx-auto mb-2.5" />
                      <p className="text-slate-400 text-sm font-brand">
                        {invitations.length === 0 ? 'אין הזמנות עדיין' : 'לא נמצאו תוצאות'}
                      </p>
                    </td>
                  </tr>
                ) : (
                  filtered.map(inv => {
                    const isSelected = selected.has(inv.id);
                    const sideGroup  = [inv.side, inv.guest_group].filter(Boolean).join(' / ');

                    return (
                      <tr
                        key={inv.id}
                        onClick={() => toggleRow(inv.id)}
                        className={`cursor-pointer transition-colors duration-100 ${
                          isSelected ? 'bg-violet-50' : 'hover:bg-slate-50'
                        }`}
                      >

                        {/* Checkbox */}
                        <td className="px-4 py-4" onClick={e => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleRow(inv.id)}
                            className="w-4 h-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500 cursor-pointer"
                          />
                        </td>

                        {/* Name — semibold for strong visual anchor */}
                        <td className="px-4 py-4">
                          <span className="font-semibold text-slate-800 font-brand">
                            {inv.group_name ?? '—'}
                          </span>
                        </td>

                        {/* Phone chips */}
                        <td className="px-4 py-4">
                          <div className="flex flex-wrap gap-1.5">
                            {(inv.phone_numbers ?? []).length > 0
                              ? (inv.phone_numbers ?? []).map(phone => (
                                <a
                                  key={phone}
                                  href={`tel:${phone}`}
                                  onClick={e => e.stopPropagation()}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-brand transition-colors"
                                >
                                  <Phone className="w-3 h-3" />
                                  {phone}
                                </a>
                              ))
                              : <span className="text-slate-300 text-xs">—</span>
                            }
                          </div>
                        </td>

                        {/* Side / Group */}
                        {hasSideOrGroup && (
                          <td className="px-4 py-4 text-slate-500 text-sm font-brand whitespace-nowrap">
                            {sideGroup || '—'}
                          </td>
                        )}

                        {/* Pax count */}
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span className="font-semibold text-slate-800 font-brand">
                            {inv.confirmed_pax ?? '?'}
                          </span>
                          {hasInvitedPax && inv.invited_pax != null && (
                            <span className="text-slate-400 text-xs font-brand">
                              {' '}/ {inv.invited_pax}
                            </span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="px-4 py-4">
                          <StatusBadge status={inv.rsvp_status} />
                        </td>

                        {/* Msg Status */}
                        <td className="px-4 py-4" onClick={e => e.stopPropagation()}>
                          <MsgStatusBadge
                            log={latestMsgLogs.get(inv.id)}
                            onClick={() => setDrawerInvitation(inv)}
                          />
                        </td>

                      </tr>
                    );
                  })
                )}

              </tbody>

            </table>
          </div>

          {/* Table footer */}
          {filtered.length > 0 && (
            <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <span className="text-xs text-slate-400 font-brand">
                {filtered.length} שורות
              </span>
              {selected.size > 0 && (
                <span className="text-xs text-violet-600 font-brand font-medium">
                  {selected.size} נבחרו
                </span>
              )}
            </div>
          )}

        </section>

      </main>

      {/* ════════════════════════════════════════════════════════════════════
          FLOATING BULK ACTION BAR
      ════════════════════════════════════════════════════════════════════ */}
      <div
        className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ease-out ${
          selected.size > 0
            ? 'opacity-100 translate-y-0'
            : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
        aria-live="polite"
      >
        <div className="bg-slate-900 text-white rounded-2xl shadow-2xl border border-white/10 px-5 py-3 flex items-center gap-4 backdrop-blur-sm">

          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-6 h-6 bg-violet-500 rounded-lg flex items-center justify-center">
              <span className="text-xs font-bold font-danidin leading-none">
                {selected.size}
              </span>
            </div>
            <span className="text-sm font-medium font-brand whitespace-nowrap">
              פעולות על הבחירה
            </span>
          </div>

          <div className="w-px h-5 bg-white/15 shrink-0" />

          <div className="flex items-center gap-2">

            <button
              onClick={() => setIsMessageModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 active:bg-violet-700 rounded-xl text-xs font-medium font-brand transition-colors whitespace-nowrap"
            >
              <Send className="w-3.5 h-3.5" />
              שלח הודעה
            </button>

            <button className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-medium font-brand transition-colors whitespace-nowrap">
              <Download className="w-3.5 h-3.5" />
              ייצוא
            </button>

            <button
              onClick={() => setSelected(new Set())}
              className="p-1.5 text-white/40 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              aria-label="בטל בחירה"
            >
              <XCircle className="w-4 h-4" />
            </button>

          </div>
        </div>
      </div>

    </div>
  );
}
