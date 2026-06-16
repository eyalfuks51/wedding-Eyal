import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { normalizePhone } from '@/lib/phone';
import {
  Search,
  Users,
  XCircle,
  ChevronDown,
  Send,
  Download,
  Phone,
  Upload,
  UserPlus,
  X,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useEventContext } from '@/contexts/EventContext';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import {
  GlassCard,
  GlassCardHeader,
  GlassCardTitle,
  GlassCardAction,
  GlassCardContent,
  GlassCardFooter,
} from '@/components/ui/glass-card';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetClose,
} from '@/components/ui/sheet';
import { type Invitation, type RsvpStatus, EditGuestSheet } from '@/components/dashboard/EditGuestSheet';
import { TEMPLATE_LABELS, MSG_STATUS_MAP } from '@/components/dashboard/constants';
import DashboardNav from '@/components/dashboard/DashboardNav';
import SiteFooter from '@/components/brand/SiteFooter';
import GuestUploadModal from '@/components/dashboard/GuestUploadModal';
import UnmatchedBanner from '@/components/dashboard/UnmatchedBanner';
import UnmatchedResolutionSheet from '@/components/dashboard/UnmatchedResolutionSheet';
import { exportGuests } from '../lib/guest-excel';
import UpgradeModal from '@/components/ui/UpgradeModal';

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

interface ColVis {
  side:       boolean;
  group:      boolean;
  pax_split:  boolean;
  automation: boolean;
}

const COL_OPTIONS: Array<{ key: keyof ColVis; label: string }> = [
  { key: 'side',       label: 'צד' },
  { key: 'group',      label: 'קבוצה' },
  { key: 'pax_split',  label: 'כמויות מפורטות' },
  { key: 'automation', label: 'אוטומציה' },
];

// ─── Constants ────────────────────────────────────────────────────────────────

// dot: Tailwind bg-* class for the coloured indicator dot inside the badge
const STATUS_MAP: Record<string, { label: string; classes: string; dot: string }> = {
  attending: { label: 'מגיע',    classes: 'bg-sage-soft   text-sage',    dot: 'bg-sage'    },
  pending:   { label: 'ממתין',   classes: 'bg-paper-3 text-ink-soft',     dot: 'bg-rose-gold' },
  declined:  { label: 'לא מגיע', classes: 'bg-paper-2 text-ink-soft',    dot: 'bg-ink-mute' },
};

// ─── Micro-components ─────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="min-h-screen flex items-center justify-center font-brand" style={{ background: 'var(--paper)' }} dir="rtl">
      <div className="text-center space-y-3">
        <div className="w-10 h-10 border-4 border-t-transparent rounded-full animate-spin mx-auto" style={{ borderColor: 'var(--violet-700)', borderTopColor: 'transparent' }} />
        <p className="text-sm font-brand" style={{ color: 'var(--ink-mute)' }}>טוען נתונים...</p>
      </div>
    </div>
  );
}

function ErrorView({ message }: { message: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center font-brand" style={{ background: 'var(--paper)' }} dir="rtl">
      <div className="bg-white rounded-2xl p-8 max-w-xs w-full mx-4 text-center" style={{ border: '1px solid var(--clay-soft)' }}>
        <XCircle className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--clay)' }} />
        <p className="font-medium font-brand" style={{ color: 'var(--ink)' }}>שגיאה בטעינת הנתונים</p>
        <p className="text-sm font-brand mt-1.5" style={{ color: 'var(--ink-soft)' }}>{message}</p>
      </div>
    </div>
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

interface MsgStatusBadgeProps {
  log:     MessageLog | undefined;
  onClick: () => void;
}

function MsgStatusBadge({ log, onClick }: MsgStatusBadgeProps) {
  const key: keyof typeof MSG_STATUS_MAP =
    log?.status && log.status in MSG_STATUS_MAP ? log.status : 'none';
  const cfg = MSG_STATUS_MAP[key];
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
        className="appearance-none pr-3 pl-8 py-2 text-sm cursor-pointer transition-shadow font-brand"
        style={{
          background: 'var(--paper)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--r-sm)',
          color: 'var(--ink-soft)',
          outline: 'none',
        }}
      >
        <option value="">{placeholder}</option>
        {options.map(opt => (
          <option key={opt} value={opt}>{labels?.[opt] ?? opt}</option>
        ))}
      </select>
      <ChevronDown className="absolute inset-y-0 left-2.5 my-auto w-3.5 h-3.5 pointer-events-none" style={{ color: 'var(--ink-mute)' }} />
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
      .map(normalizePhone);

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

// ── Message History Sheet ─────────────────────────────────────────────────

interface MessageHistorySheetProps {
  invitation:  Invitation | null;
  logs:        MessageLog[];
  loading:     boolean;
  onClose:     () => void;
}

function MessageHistorySheet({ invitation, logs, loading, onClose }: MessageHistorySheetProps) {
  const open = invitation !== null;

  // Format ISO timestamp → DD/MM/YYYY HH:mm
  const formatTs = (iso: string) => {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const BORDER_COLOR: Record<string, string> = {
    pending: 'border-amber-400',
    sent:    'border-emerald-500',
    failed:  'border-rose-500',
  };

  return (
    <Sheet open={open} onOpenChange={isOpen => { if (!isOpen) onClose(); }}>
      <SheetContent side="left" dir="rtl" className="font-brand flex flex-col">

        {/* ── Header ───────────────────────────────────────────────────────── */}
        <SheetHeader className="flex-row items-start justify-between">
          <div>
            <SheetTitle>היסטוריית הודעות</SheetTitle>
            {invitation?.group_name && (
              <SheetDescription>{invitation.group_name}</SheetDescription>
            )}
          </div>
          <SheetClose
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            aria-label="סגור"
          >
            <X className="w-4 h-4" />
          </SheetClose>
        </SheetHeader>

        {/* ── Timeline ─────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">

          {loading && (
            <div role="status" aria-label="טוען היסטוריית הודעות" className="flex justify-center py-12">
              <div aria-hidden="true" className="w-8 h-8 border-4 border-violet-600 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {!loading && logs.length === 0 && (
            <p className="text-center text-sm text-slate-400 py-12">
              לא נמצאו הודעות עבור אורח זה
            </p>
          )}

          {!loading && logs.map(log => (
            <div
              key={log.id}
              className={`border-r-4 pr-3 py-2 space-y-1.5 ${BORDER_COLOR[log.status] ?? 'border-slate-300'}`}
            >
              {/* Top row: type chip + timestamp */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs font-medium bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                  {TEMPLATE_LABELS[log.message_type] ?? log.message_type}
                </span>
                <span className="text-xs text-slate-400 tabular-nums">
                  {formatTs(log.created_at)}
                </span>
              </div>

              {/* Message content */}
              <p className="text-sm text-slate-700 leading-relaxed line-clamp-4">
                {log.content}
              </p>

              {/* Error box — only for failed */}
              {log.status === 'failed' && log.error_log && (
                <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-2.5 py-1.5">
                  {log.error_log}
                </p>
              )}
            </div>
          ))}

        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [invitations, setInvitations] = useState<Invitation[]>([]);

  // ── Event data via context (resolved by ProtectedRoute) ──────────────────
  const { currentEvent, isLoading: eventLoading, isActive } = useEventContext();
  const { canImportGuests, canExportGuests, canSendMessages, maxFreeGuests } = useFeatureAccess();

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
  const [isUploadOpen, setIsUploadOpen]           = useState(false);
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen]             = useState(false);
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

  // ── Edit guest drawer ─────────────────────────────────────────────────────
  const [editGuest, setEditGuest] = useState<Invitation | null>(null);

  // ── Unmatched RSVP resolution ───────────────────────────────────────────
  const [unmatchedCount, setUnmatchedCount] = useState(0);
  const [resolutionOpen, setResolutionOpen] = useState(false);

  // ── Column visibility ─────────────────────────────────────────────────────
  const [colVis, setColVis]         = useState<ColVis>({ side: false, group: false, pax_split: false, automation: false });
  const [colVisOpen, setColVisOpen] = useState(false);
  const colVisRef                   = useRef<HTMLDivElement>(null);

  // ── Invitations fetch — runs once currentEvent.id is available ──────────────────

  useEffect(() => {
    // Clear previous event's data immediately to prevent stale flash
    setInvitations([]);
    setUnmatchedCount(0);
    setSelected(new Set());
    setInvError(null);
    setLatestMsgLogs(new Map());

    if (!currentEvent?.id || !supabase) return;
    const sb = supabase;
    const id = currentEvent.id;

    setInvLoading(true);

    sb.from('invitations')
      .select('*')
      .eq('event_id', id)
      .order('group_name', { ascending: true })
      .then(({ data, error: err }) => {
        if (err) setInvError(err.message);
        else setInvitations((data ?? []) as Invitation[]);
        setInvLoading(false);
      });

    // Fetch unmatched RSVP count for the banner
    sb.from('arrival_permits')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', id)
      .eq('match_status', 'unmatched')
      .then(({ count }) => setUnmatchedCount(count ?? 0));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentEvent?.id]);

  const reloadInvitations = useCallback(() => {
    if (!currentEvent?.id || !supabase) return;
    const sb = supabase;
    setInvLoading(true);
    sb.from('invitations').select('*').eq('event_id', currentEvent.id).order('group_name', { ascending: true })
      .then(({ data, error }) => {
        if (!error && data) setInvitations(data as Invitation[]);
        setInvLoading(false);
      });
    // Also refresh unmatched count
    sb.from('arrival_permits')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', currentEvent.id)
      .eq('match_status', 'unmatched')
      .then(({ count }) => setUnmatchedCount(count ?? 0));
  }, [currentEvent?.id]);

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

  // Lazy-fetch full history for the invitation currently open in the drawer.
  useEffect(() => {
    if (!supabase || !drawerInvitation) return;
    let ignored = false;
    setDrawerLoading(true);
    setDrawerLogs([]);
    supabase
      .from('message_logs')
      .select('id, invitation_id, phone, message_type, content, status, error_log, scheduled_for, sent_at, created_at')
      .eq('invitation_id', drawerInvitation.id)
      .order('created_at', { ascending: false })
      .then(({ data, error: err }) => {
        if (ignored) return;
        if (err) console.error('[Dashboard] drawer fetch failed:', err.message);
        setDrawerLogs((data ?? []) as MessageLog[]);
        setDrawerLoading(false);
      });
    return () => { ignored = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- supabase is a stable module-level singleton
  }, [drawerInvitation]);

  // Close colVis dropdown on outside click or Escape
  useEffect(() => {
    const onMouse = (e: MouseEvent) => {
      if (colVisRef.current && !colVisRef.current.contains(e.target as Node)) {
        setColVisOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setColVisOpen(false); };
    document.addEventListener('mousedown', onMouse);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onMouse);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

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

  // ── Paywall guard ─────────────────────────────────────────────────────────

  const isAtGuestLimit = !isActive && invitations.length >= maxFreeGuests;

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

  const handleGuestSave = (updated: Invitation) => {
    setInvitations(prev => prev.map(i => i.id === updated.id ? updated : i));
    setToast('השינויים נשמרו ✓');
    setTimeout(() => setToast(null), 3000);
  };

  // ── WhatsApp bulk message ─────────────────────────────────────────────────

  const handleSendBulkMessage = async (payload: BulkMessagePayload) => {
    if (!currentEvent || !supabase) return;
    const { guests, messageType, content } = payload;
    const { whatsapp_templates, couple_names, waze_link } = (currentEvent.content_config ?? {}) as Record<string, unknown>;

    // Safety: bail early if template mode is requested but no templates are configured
    if (messageType === 'template' && !whatsapp_templates) {
      console.error('handleSendBulkMessage: whatsapp_templates is missing from event.content_config. Aborting.');
      return;
    }

    // Real public invite link: configured public base URL if set, else the
    // current deployment origin (never a placeholder domain).
    const baseUrl = import.meta.env.VITE_PUBLIC_BASE_URL || window.location.origin;
    const eventLink = `${baseUrl}/${currentEvent.slug}`;

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
          event_id:      currentEvent.id,
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

  function handleExportAll() {
    const date = new Date().toISOString().slice(0, 10);
    exportGuests(filtered, `מוזמנים_${date}.xlsx`);
  }

  function handleExportSelected() {
    const date = new Date().toISOString().slice(0, 10);
    exportGuests(selectedGuestsArray, `מוזמנים_נבחרים_${date}.xlsx`);
  }

  // ── Derived loading / error ───────────────────────────────────────────────

  const error   = invError;

  // ── Render guards ─────────────────────────────────────────────────────────
  // Only the initial event load shows the full-page spinner.
  // Invitation reloads must NOT unmount the page (it kills open modals).
  if (eventLoading) return <Spinner />;
  if (error)        return <ErrorView message={error} />;
  // Draft users (canImportGuests=false) can still view the guest table.

  const colSpan = 6
    + (colVis.side       ? 1 : 0)
    + (colVis.group      ? 1 : 0)
    + (colVis.pax_split  ? 1 : 0)
    + (colVis.automation ? 1 : 0);

  // SVG ring constants for Hero KPI
  const RING_R    = 70;
  const RING_CIRC = 2 * Math.PI * RING_R;
  const paxConfirmRate = kpi.totalPaxInvited > 0 ? kpi.totalPaxConfirmed / kpi.totalPaxInvited : 0;
  const ringPct   = Math.min(1, Math.max(0, paxConfirmRate));
  const ringOffset = RING_CIRC * (1 - ringPct);

  return (
    <div
      className="dash-page dashboard-shell min-h-screen font-brand"
      style={{
        background: [
          'radial-gradient(circle at 82% 9%, var(--glow-rose) 0, transparent 30%)',
          'radial-gradient(circle at 14% 22%, var(--glow-violet) 0, transparent 28%)',
          'linear-gradient(180deg, var(--paper) 0%, oklch(96.5% 0.018 292) 52%, var(--paper-2) 100%)',
        ].join(', '),
        color: 'var(--ink)',
      }}
      dir="rtl"
    >

      {/* ══ MODALS + TOAST ══ */}
      <AddGuestModal
        isOpen={isModalOpen}
        onClose={closeModal}
        onSuccess={handleGuestAdded}
        eventId={currentEvent?.id ?? ''}
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
        eventConfig={currentEvent?.content_config ?? {}}
        onSend={handleSendBulkMessage}
      />

      <MessageHistorySheet
        invitation={drawerInvitation}
        logs={drawerLogs}
        loading={drawerLoading}
        onClose={() => setDrawerInvitation(null)}
      />

      <EditGuestSheet
        invitation={editGuest}
        sides={sides}
        onClose={() => setEditGuest(null)}
        onSave={handleGuestSave}
      />

      {currentEvent?.id && (
        <GuestUploadModal
          isOpen={isUploadOpen}
          eventId={currentEvent.id}
          onClose={() => setIsUploadOpen(false)}
          onSuccess={reloadInvitations}
        />
      )}

      {currentEvent?.id && (
        <UnmatchedResolutionSheet
          open={resolutionOpen}
          onOpenChange={setResolutionOpen}
          eventId={currentEvent.id}
          invitations={invitations}
          onResolved={reloadInvitations}
        />
      )}

      <UpgradeModal
        isOpen={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        onUpgradeClick={() => {
          setUpgradeOpen(false);
          setToast('Coming Soon — שילוב עם שער תשלום בקרוב');
          setTimeout(() => setToast(null), 3000);
        }}
      />

      {toast && (
        <div
          className="fixed bottom-6 right-6 z-[60] text-white text-sm font-medium font-brand px-4 py-2.5 rounded-xl shadow-lg"
          style={{ background: toastVariant === 'error' ? 'var(--clay)' : 'var(--sage)' }}
        >
          {toast}
        </div>
      )}

      {/* ══ TOPBAR ══ */}
      <DashboardNav />

      <style>{`
        @media (max-width: 920px) {
          .dashboard-shell {
            overflow-x: clip;
          }
          .dashboard-main {
            width: 100% !important;
            max-width: 100% !important;
            padding: 20px 14px 96px !important;
            overflow-x: clip;
          }
          .dashboard-page-header {
            padding: 20px 18px !important;
            margin-bottom: 20px !important;
            border-radius: 22px !important;
          }
          .dashboard-page-header h1 {
            font-size: 28px !important;
            line-height: 1.05 !important;
          }
          .dashboard-kpi-grid {
            grid-template-columns: 1fr !important;
            gap: 12px !important;
            margin-bottom: 14px !important;
          }
          .dashboard-kpi-grid article {
            min-width: 0 !important;
            padding: 18px !important;
            border-radius: 22px !important;
          }
          .dashboard-kpi-grid article:first-of-type {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 14px !important;
          }
          .dashboard-kpi-ring {
            width: 118px !important;
            height: 118px !important;
            align-self: center;
          }
          .dashboard-kpi-ring svg {
            width: 118px !important;
            height: 118px !important;
          }
          .dashboard-kpi-body {
            text-align: center;
          }
          .dashboard-kpi-number {
            justify-content: center;
            font-size: 52px !important;
            line-height: 0.95 !important;
            flex-wrap: wrap;
            row-gap: 2px;
          }
          .dashboard-kpi-number .dashboard-kpi-denominator {
            font-size: 22px !important;
          }
          .dashboard-kpi-chips {
            justify-content: center;
            gap: 7px !important;
          }
          .dashboard-kpi-attention-number {
            font-size: 56px !important;
          }
          .dashboard-kpi-cta {
            width: 100%;
            justify-content: center;
            padding-inline: 14px !important;
          }
          .dashboard-filter-bar {
            display: grid !important;
            grid-template-columns: 1fr !important;
            align-items: stretch !important;
            gap: 9px !important;
            padding: 12px !important;
            border-radius: 18px !important;
          }
          .dashboard-filter-bar > * {
            width: 100% !important;
            min-width: 0 !important;
            margin: 0 !important;
          }
          .dashboard-filter-bar select,
          .dashboard-filter-bar button,
          .dashboard-filter-bar input {
            width: 100%;
          }
          .dashboard-filter-count {
            text-align: center;
            padding-top: 2px;
          }
          .dashboard-table-shell {
            border-radius: 20px !important;
          }
          .dashboard-table-header {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 12px !important;
            padding: 14px !important;
          }
          .dashboard-table-summary {
            text-align: center;
          }
          .dashboard-table-actions {
            display: grid !important;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 7px !important;
          }
          .dashboard-table-actions button {
            min-width: 0;
            justify-content: center;
            padding-inline: 8px !important;
          }
          .dashboard-table-scroll {
            max-width: 100%;
          }
          .dashboard-table-scroll table {
            min-width: 620px !important;
          }
          .dashboard-bulk-bar {
            left: 14px !important;
            right: 14px !important;
            bottom: 14px !important;
            transform: none !important;
          }
          .dashboard-bulk-card {
            width: 100%;
            border-radius: 20px !important;
            justify-content: space-between;
            gap: 10px !important;
            padding: 10px 12px !important;
          }
          .dashboard-bulk-actions {
            flex: 1;
            display: grid !important;
            grid-template-columns: 1fr 0.74fr 32px;
            gap: 6px !important;
          }
          .dashboard-bulk-actions button {
            justify-content: center;
            min-width: 0;
            padding-inline: 10px !important;
            white-space: nowrap;
          }
        }

        @media (max-width: 380px) {
          .dashboard-main {
            padding-inline: 10px !important;
          }
          .dashboard-table-actions {
            grid-template-columns: 1fr !important;
          }
          .dashboard-bulk-card {
            align-items: stretch !important;
            flex-direction: column !important;
          }
          .dashboard-bulk-actions {
            grid-template-columns: 1fr 1fr 32px;
          }
        }
      `}</style>

      {/* ══ PAGE CONTENT ══ */}
      <main className="dashboard-main" style={{ maxWidth: '1376px', margin: '0 auto', padding: '32px 48px 120px' }}>

        {/* Page header */}
        <div
          className="dashboard-page-header"
          style={{
            marginBottom: '28px',
            position: 'relative',
            padding: '24px 28px',
            borderRadius: 'var(--r-lg)',
            border: '1px solid var(--glass-line)',
            background: 'linear-gradient(135deg, oklch(100% 0.004 292 / 0.96), oklch(99.5% 0.008 292 / 0.88))',
            backdropFilter: 'var(--glass-card-blur)',
            WebkitBackdropFilter: 'var(--glass-card-blur)',
            boxShadow: 'var(--shadow-soft), 0 1px 0 oklch(100% 0.005 292 / 0.78) inset',
            overflow: 'hidden',
          }}
        >
          <div aria-hidden style={{
            position: 'absolute',
            inset: '-80px auto auto -30px',
            width: 240,
            height: 180,
            background: 'radial-gradient(circle, var(--glow-rose), transparent 68%)',
            filter: 'blur(18px)',
            pointerEvents: 'none',
          }} />
          <h1 className="font-danidin font-bold" style={{ position: 'relative', fontSize: '40px', lineHeight: 1.05, letterSpacing: '0.01em', color: 'var(--ink)' }}>
            ניהול הזמנות
          </h1>
          <p className="text-sm mt-2" style={{ position: 'relative', color: 'var(--ink-soft)' }}>
            {currentEvent?.partner1_name && currentEvent?.partner2_name
              ? <>החתונה של <span style={{ color: 'var(--rose-gold)', fontWeight: 600 }}>{currentEvent.partner1_name} ו{currentEvent.partner2_name}</span></>
              : currentEvent?.slug}
          </p>
        </div>

        {/* ════ KPI ROW ════ */}
        <section
          className="dashboard-kpi-grid relative"
          style={{ display: 'grid', gridTemplateColumns: '1.32fr 0.95fr', gap: '22px', marginBottom: '20px' }}
        >
          {/* Ambient gradient blobs (glass needs something to blur) */}
          <div aria-hidden style={{ position: 'absolute', inset: '-40px -10% auto auto', width: 380, height: 220,
            background: 'radial-gradient(ellipse at 30% 50%, var(--glow-rose) 0%, transparent 65%), radial-gradient(ellipse at 80% 60%, var(--glow-violet) 0%, transparent 60%)',
            filter: 'blur(40px)', pointerEvents: 'none', zIndex: 0, borderRadius: '50%' }} />
          <div aria-hidden style={{ position: 'absolute', inset: 'auto auto -20px 10%', width: 280, height: 180,
            background: 'radial-gradient(ellipse, oklch(86.6% 0.055 292 / 0.38) 0%, transparent 70%)',
            filter: 'blur(32px)', pointerEvents: 'none', zIndex: 0, borderRadius: '50%' }} />

          {/* HERO KPI — confirmed pax with SVG ring */}
          <article
            className="relative"
            style={{
              zIndex: 1,
              background: 'linear-gradient(135deg, oklch(100% 0.004 292 / 0.98), oklch(99.5% 0.008 292 / 0.9))',
              backdropFilter: 'var(--glass-card-blur)',
              WebkitBackdropFilter: 'var(--glass-card-blur)',
              border: '1px solid var(--glass-line)',
              borderRadius: 'var(--r-lg)',
              padding: '24px 28px',
              boxShadow: 'var(--shadow-soft), 0 1px 0 oklch(100% 0.005 292 / 0.82) inset',
              display: 'flex',
              alignItems: 'center',
              gap: '28px',
            }}
          >
            {/* SVG ring */}
            <div className="dashboard-kpi-ring relative shrink-0">
              <svg width="160" height="160" viewBox="0 0 160 160">
                <circle cx="80" cy="80" r={RING_R} stroke="var(--champagne)" strokeWidth="6" fill="none" opacity="0.45" />
                <circle
                  cx="80" cy="80" r={RING_R}
                  stroke="var(--rose-gold)" strokeWidth="6" fill="none"
                  strokeDasharray={RING_CIRC}
                  strokeDashoffset={ringOffset}
                  strokeLinecap="round"
                  transform="rotate(-90 80 80)"
                  style={{ transition: 'stroke-dashoffset 700ms ease-out' }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="font-danidin font-bold" style={{ fontSize: '26px', color: 'var(--rose-gold)', lineHeight: 1, letterSpacing: '0.02em' }}>
                  {Math.round(ringPct * 100)}%
                </span>
                <span className="text-xs font-bold mt-1" style={{ color: 'var(--ink-mute)', letterSpacing: '0.12em' }}>קיבולת</span>
              </div>
            </div>

            {/* Body */}
            <div className="dashboard-kpi-body flex-1 min-w-0">
              <p className="text-xs font-bold" style={{ color: 'var(--rose-gold)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: '4px' }}>
                סך אורחים מאושרים
              </p>
              <div className="dashboard-kpi-number font-danidin font-bold flex items-baseline gap-2" style={{ fontSize: '76px', lineHeight: 0.95, color: 'var(--ink)', letterSpacing: '0.01em' }}>
                {kpi.totalPaxConfirmed}
                <span className="dashboard-kpi-denominator font-danidin font-bold" style={{ fontSize: '30px', color: 'var(--ink-mute)' }}>/ {kpi.totalPaxInvited}</span>
              </div>
              <p className="font-medium mt-1.5" style={{ fontSize: '15px', color: 'var(--ink)', lineHeight: 1.3 }}>
                מתוך יעד האולם · נותרו <span style={{ color: 'var(--rose-gold)' }}>{Math.max(0, kpi.totalPaxInvited - kpi.totalPaxConfirmed)}</span> מקומות
              </p>
              <div className="dashboard-kpi-chips flex flex-wrap gap-2 mt-3.5">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full" style={{ background: 'var(--sage-soft)', color: 'var(--sage)' }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-current" />{kpi.confirmedFamilies} אישרו
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full" style={{ background: 'var(--paper-3)', color: 'var(--ink-soft)' }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-current" />{kpi.pending} ממתינים
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full" style={{ background: 'var(--paper-2)', color: 'var(--ink-soft)' }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-current" />{kpi.declined} לא מגיעים
                </span>
              </div>
            </div>
          </article>

          {/* ACTION KPI — pending with CTA */}
          <article
            className="relative overflow-hidden cursor-pointer transition-all duration-200 hover:-translate-y-0.5"
            style={{
              zIndex: 1,
              background: 'linear-gradient(135deg, oklch(99% 0.014 292 / 0.96) 0%, oklch(99.8% 0.004 292 / 0.9) 100%)',
              backdropFilter: 'var(--glass-card-blur)',
              WebkitBackdropFilter: 'var(--glass-card-blur)',
              border: '1px solid oklch(83% 0.068 292 / 0.62)',
              borderRadius: 'var(--r-lg)',
              padding: '24px 28px',
              boxShadow: 'var(--shadow-soft), 0 1px 0 oklch(100% 0.005 292 / 0.82) inset',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
            }}
            onClick={() => setStatusFilter(statusFilter === 'pending' ? '' : 'pending')}
          >
            {/* Ambient blob */}
            <div aria-hidden style={{ position: 'absolute', top: '-30%', left: '-10%', width: 220, height: 220,
              background: 'radial-gradient(circle, var(--glow-violet) 0%, transparent 70%)',
              borderRadius: '50%', pointerEvents: 'none' }} />

            <div style={{ position: 'relative', zIndex: 1 }}>
              <div className="flex items-center gap-2 font-bold mb-1" style={{ fontSize: '11px', color: 'var(--violet-700)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                <span className="w-2 h-2 rounded-full" style={{ background: 'var(--violet-700)', animation: 'pulse 2s ease-in-out infinite' }} />
                דורש תשומת לב
              </div>
              <div className="dashboard-kpi-attention-number font-danidin font-bold" style={{ fontSize: '72px', lineHeight: 0.95, color: 'var(--ink)', letterSpacing: '0.01em' }}>
                {kpi.pending}
              </div>
              <div className="font-bold mt-1" style={{ fontSize: '17px', color: 'var(--ink)' }}>ממתינים לתשובה</div>
              {kpi.declined > 0 && (
                <p className="mt-2 text-xs leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
                  בנוסף <span style={{ color: 'var(--clay)', fontWeight: 700 }}>{kpi.declined} ביטולים</span> רשומים
                </p>
              )}
              <button
                className="dashboard-kpi-cta inline-flex items-center gap-2 font-bold mt-4 transition-all duration-200 hover:-translate-x-0.5"
                style={{ padding: '10px 18px', borderRadius: 'var(--r-pill)', background: 'var(--violet-700)', color: 'oklch(99% 0.006 292)', fontSize: '13px', letterSpacing: '0.01em', border: '1px solid oklch(63% 0.16 292 / 0.55)', boxShadow: '0 14px 26px -18px var(--violet-700)' }}
                onClick={e => { e.stopPropagation(); setStatusFilter('pending'); }}
              >
                צפייה ושליחת תזכורת
                <span style={{ fontSize: '16px' }}>←</span>
              </button>
            </div>
          </article>
        </section>

        {/* Pulse animation */}
        <style>{`@keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(1.5)} }`}</style>

        {/* ════ UNMATCHED BANNER ════ */}
        <UnmatchedBanner count={unmatchedCount} onResolve={() => setResolutionOpen(true)} />

        {/* ════ FILTER BAR ════ */}
        <section
          className="dashboard-filter-bar flex flex-wrap items-center gap-2.5 mb-4"
          style={{
            background: 'linear-gradient(135deg, oklch(100% 0.004 292 / 0.97), oklch(99.7% 0.006 292 / 0.88))',
            backdropFilter: 'var(--glass-card-blur)',
            WebkitBackdropFilter: 'var(--glass-card-blur)',
            border: '1px solid var(--glass-line)',
            borderRadius: 'var(--r-md)',
            padding: '14px 16px',
            boxShadow: 'var(--shadow-soft), 0 1px 0 oklch(100% 0.005 292 / 0.78) inset',
          }}
        >
          {/* Search */}
          <div className="relative flex-1 min-w-52">
            <Search className="absolute inset-y-0 right-3 my-auto w-4 h-4 pointer-events-none" style={{ color: 'var(--ink-mute)' }} />
            <input
              type="search"
              placeholder="חיפוש לפי שם, טלפון..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pr-9 pl-3 py-2.5 text-sm font-brand transition-shadow"
              style={{
                background: 'var(--paper)',
                border: '1px solid var(--line)',
                borderRadius: 'var(--r-sm)',
                color: 'var(--ink)',
                outline: 'none',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--violet-700)'; e.currentTarget.style.boxShadow = '0 0 0 3px var(--violet-50)'; e.currentTarget.style.background = 'white'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--line)'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.background = 'var(--paper)'; }}
            />
          </div>

          {sides.length > 0 && (
            <SelectFilter value={sideFilter} onChange={setSideFilter} placeholder="כל הצדדים" options={sides} />
          )}

          {groups.length > 0 && (
            <SelectFilter value={groupFilter} onChange={setGroupFilter} placeholder="כל הקבוצות" options={groups} />
          )}

          <SelectFilter
            value={statusFilter}
            onChange={setStatusFilter}
            placeholder="כל הסטטוסים"
            options={['attending', 'pending', 'declined']}
            labels={{ attending: 'מגיעים', pending: 'ממתינים', declined: 'לא מגיעים' }}
          />

          {/* Column visibility */}
          <div className="relative shrink-0" ref={colVisRef}>
            <button
              type="button"
              onClick={() => setColVisOpen(prev => !prev)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-brand transition-colors"
              style={{ background: 'var(--paper)', border: '1px solid var(--line)', borderRadius: 'var(--r-sm)', color: 'var(--ink-soft)' }}
            >
              תצוגה
              <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-150 ${colVisOpen ? 'rotate-180' : ''}`} style={{ color: 'var(--ink-mute)' }} />
            </button>
            {colVisOpen && (
              <div className="absolute top-full mt-1 right-0 z-30 p-2" style={{ background: 'white', border: '1px solid var(--line)', borderRadius: 'var(--r-md)', boxShadow: '0 8px 24px -8px rgba(42,37,32,0.15)', minWidth: '180px' }}>
                {COL_OPTIONS.map(opt => (
                  <label
                    key={opt.key}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-sm font-brand select-none"
                    style={{ color: 'var(--ink-soft)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--paper)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <input
                      type="checkbox"
                      checked={colVis[opt.key]}
                      onChange={() => setColVis(prev => ({ ...prev, [opt.key]: !prev[opt.key] }))}
                      className="w-4 h-4 rounded cursor-pointer"
                      style={{ accentColor: 'var(--violet-700)', borderColor: 'var(--ink-mute)' }}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            )}
          </div>

          <span className="dashboard-filter-count text-xs font-brand mr-auto" style={{ color: 'var(--ink-mute)' }}>
            {filtered.length === invitations.length
              ? `${invitations.length} הזמנות`
              : `${filtered.length} מתוך ${invitations.length}`}
          </span>
        </section>

        {/* ════ GUEST TABLE ════ */}
        <section
          className="dashboard-table-shell"
          style={{
            background: 'oklch(100% 0.004 292 / 0.98)',
            backdropFilter: 'var(--glass-card-blur)',
            WebkitBackdropFilter: 'var(--glass-card-blur)',
            border: '1px solid var(--glass-line)',
            borderRadius: 'var(--r-lg)',
            overflow: 'hidden',
            marginBottom: '24px',
            boxShadow: 'var(--shadow-soft), 0 1px 0 oklch(100% 0.005 292 / 0.78) inset',
          }}
        >

          {/* Table header strip */}
          <div
            className="dashboard-table-header flex items-center justify-between px-5 py-4"
            style={{
              borderBottom: '1px solid var(--glass-line)',
              background: 'linear-gradient(90deg, oklch(100% 0.004 292 / 0.96), oklch(99.5% 0.008 292 / 0.88))',
            }}
          >
            <span className="dashboard-table-summary text-sm font-brand" style={{ color: 'var(--ink-soft)' }}>
              {filtered.length < invitations.length
                ? <><span className="font-danidin font-bold text-base" style={{ color: 'var(--ink)' }}>{filtered.length}</span> מתוך <span className="font-danidin font-bold text-base" style={{ color: 'var(--ink)' }}>{invitations.length}</span> הזמנות מוצגות</>
                : <><span className="font-danidin font-bold text-base" style={{ color: 'var(--ink)' }}>{invitations.length}</span> הזמנות</>}
            </span>
            <div className="dashboard-table-actions flex items-center gap-2">
              <button
                onClick={() => canExportGuests ? handleExportAll() : setUpgradeOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium font-brand transition-colors"
                style={{ background: 'oklch(100% 0.006 292 / 0.45)', border: '1px solid var(--glass-line)', borderRadius: 'var(--r-sm)', color: 'var(--ink-soft)', boxShadow: '0 1px 0 oklch(100% 0.005 292 / 0.56) inset' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--paper-2)'; e.currentTarget.style.color = 'var(--ink)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'oklch(100% 0.006 292 / 0.45)'; e.currentTarget.style.color = 'var(--ink-soft)'; }}
              >
                <Download className="w-3.5 h-3.5" /> ייצוא
              </button>
              <button
                onClick={() => canImportGuests ? setIsUploadOpen(true) : setUpgradeOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium font-brand transition-colors"
                style={{ background: 'oklch(100% 0.006 292 / 0.45)', border: '1px solid var(--glass-line)', borderRadius: 'var(--r-sm)', color: 'var(--ink-soft)', boxShadow: '0 1px 0 oklch(100% 0.005 292 / 0.56) inset' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--paper-2)'; e.currentTarget.style.color = 'var(--ink)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'oklch(100% 0.006 292 / 0.45)'; e.currentTarget.style.color = 'var(--ink-soft)'; }}
              >
                <Upload className="w-3.5 h-3.5" /> ייבוא
              </button>
              <button
                onClick={() => isAtGuestLimit ? setUpgradeOpen(true) : openModal()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold font-brand transition-colors"
                style={{ background: 'var(--violet-700)', color: 'oklch(99% 0.006 292)', borderRadius: 'var(--r-sm)', border: '1px solid oklch(63% 0.16 292 / 0.55)', boxShadow: '0 14px 26px -20px var(--violet-700)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--violet-600)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'var(--violet-700)')}
              >
                <UserPlus className="w-3.5 h-3.5" /> הזמנה חדשה
              </button>
            </div>
          </div>

          <div className="dashboard-table-scroll overflow-x-auto">
            <table className="w-full min-w-[640px]" style={{ fontSize: '13.5px', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'linear-gradient(90deg, var(--paper) 0%, oklch(96.8% 0.018 292) 100%)', borderBottom: '1px solid var(--line)' }}>
                  <th className="w-10 px-4 py-3 text-right">
                    <input
                      ref={selectAllRef}
                      type="checkbox"
                      checked={allChecked}
                      onChange={toggleAll}
                      className="w-4 h-4 rounded cursor-pointer"
                      style={{ accentColor: 'var(--violet-700)', borderColor: 'var(--ink-mute)' }}
                    />
                  </th>
                  <th className="px-4 py-3 text-right font-bold text-xs tracking-wider whitespace-nowrap" style={{ color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>שם</th>
                  <th className="px-4 py-3 text-right font-bold text-xs tracking-wider whitespace-nowrap" style={{ color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>טלפון</th>
                  {colVis.side  && <th className="px-4 py-3 text-right font-bold text-xs tracking-wider whitespace-nowrap" style={{ color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>צד</th>}
                  {colVis.group && <th className="px-4 py-3 text-right font-bold text-xs tracking-wider whitespace-nowrap" style={{ color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>קבוצה</th>}
                  {colVis.pax_split ? (
                    <>
                      <th className="px-4 py-3 text-right font-bold text-xs tracking-wider whitespace-nowrap" style={{ color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>מוזמנים</th>
                      <th className="px-4 py-3 text-right font-bold text-xs tracking-wider whitespace-nowrap" style={{ color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>אישרו</th>
                    </>
                  ) : (
                    <th className="px-4 py-3 text-right font-bold text-xs tracking-wider whitespace-nowrap" style={{ color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>כמות</th>
                  )}
                  {colVis.automation && <th className="px-4 py-3 text-right font-bold text-xs tracking-wider whitespace-nowrap" style={{ color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>אוטומציה</th>}
                  <th className="px-4 py-3 text-right font-bold text-xs tracking-wider whitespace-nowrap" style={{ color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>סטטוס</th>
                  <th className="px-4 py-3 text-right font-bold text-xs tracking-wider whitespace-nowrap" style={{ color: 'var(--ink-mute)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>הודעה</th>
                </tr>
              </thead>

              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={colSpan} className="py-16 text-center">
                      <div
                        className="mx-auto"
                        style={{
                          maxWidth: 460,
                          padding: '30px 28px',
                          borderRadius: 'var(--r-lg)',
                          background: 'linear-gradient(135deg, oklch(100% 0.004 292 / 0.96), oklch(99.5% 0.008 292 / 0.86))',
                          border: '1px solid var(--glass-line)',
                          boxShadow: '0 1px 0 oklch(100% 0.005 292 / 0.82) inset',
                        }}
                      >
                        <div
                          className="mx-auto mb-3 flex items-center justify-center"
                          style={{
                            width: 54,
                            height: 54,
                            borderRadius: '18px',
                            color: 'var(--rose-gold)',
                            background: 'var(--champagne-soft)',
                            boxShadow: '0 14px 32px -24px var(--rose-gold)',
                          }}
                        >
                          <Users className="w-6 h-6" />
                        </div>
                        <p className="font-danidin font-bold" style={{ fontSize: 22, color: 'var(--ink)' }}>
                          {invitations.length === 0 ? 'מתחילים מרשימת המוזמנים' : 'לא נמצאו תוצאות'}
                        </p>
                        <p className="text-sm font-brand mt-1.5 leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
                          {invitations.length === 0
                            ? 'ייבאו קובץ אקסל או הוסיפו הזמנה ראשונה כדי לפתוח את חדר הבקרה של האירוע.'
                            : 'אפשר לשנות חיפוש או לנקות סינון כדי לראות שוב את כל ההזמנות.'}
                        </p>
                        {invitations.length === 0 && (
                          <div className="mt-5 flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => canImportGuests ? setIsUploadOpen(true) : setUpgradeOpen(true)}
                              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold font-brand transition-colors"
                              style={{ background: 'var(--violet-700)', color: 'oklch(99% 0.006 292)', borderRadius: 'var(--r-pill)', border: '1px solid oklch(63% 0.16 292 / 0.55)' }}
                            >
                              <Upload className="w-3.5 h-3.5" />
                              ייבוא מוזמנים
                            </button>
                            <button
                              type="button"
                              onClick={() => isAtGuestLimit ? setUpgradeOpen(true) : openModal()}
                              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold font-brand transition-colors"
                              style={{ background: 'oklch(100% 0.006 292 / 0.56)', color: 'var(--ink)', borderRadius: 'var(--r-pill)', border: '1px solid var(--glass-line)' }}
                            >
                              <UserPlus className="w-3.5 h-3.5" />
                              הזמנה ידנית
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map(inv => {
                    const isSelected = selected.has(inv.id);
                    return (
                      <tr
                        key={inv.id}
                        onClick={() => toggleRow(inv.id)}
                        className="cursor-pointer transition-colors duration-150"
                        style={{
                          background: isSelected ? 'var(--violet-50)' : 'white',
                          borderBottom: '1px solid var(--paper-2)',
                        }}
                        onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--paper)'; }}
                        onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'white'; }}
                      >
                        <td className="px-4 py-3.5" onClick={e => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleRow(inv.id)}
                            className="w-4 h-4 rounded cursor-pointer"
                            style={{ accentColor: 'var(--violet-700)' }}
                          />
                        </td>

                        <td className="px-4 py-3.5" onClick={e => { e.stopPropagation(); setEditGuest(inv); }}>
                          <span className="font-semibold font-brand cursor-pointer hover:underline" style={{ color: 'var(--ink)', fontSize: '14px' }}
                            onMouseEnter={e => (e.currentTarget.style.color = 'var(--violet-700)')}
                            onMouseLeave={e => (e.currentTarget.style.color = 'var(--ink)')}
                          >
                            {inv.group_name ?? '—'}
                          </span>
                        </td>

                        <td className="px-4 py-3.5">
                          <div className="flex flex-wrap gap-1">
                            {(inv.phone_numbers ?? []).length > 0
                              ? (inv.phone_numbers ?? []).map(phone => (
                                <a
                                  key={phone}
                                  href={`tel:${phone}`}
                                  onClick={e => e.stopPropagation()}
                                  className="inline-flex items-center gap-1 text-xs font-brand transition-colors"
                                  style={{ padding: '3px 8px', borderRadius: 'var(--r-pill)', background: 'var(--paper)', border: '1px solid var(--line)', color: 'var(--ink-soft)' }}
                                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--violet-50)'; e.currentTarget.style.color = 'var(--violet-700)'; e.currentTarget.style.borderColor = 'transparent'; }}
                                  onMouseLeave={e => { e.currentTarget.style.background = 'var(--paper)'; e.currentTarget.style.color = 'var(--ink-soft)'; e.currentTarget.style.borderColor = 'var(--line)'; }}
                                >
                                  <Phone className="w-3 h-3" />
                                  {phone}
                                </a>
                              ))
                              : <span className="text-xs" style={{ color: 'var(--line)' }}>—</span>
                            }
                          </div>
                        </td>

                        {colVis.side && (
                          <td className="px-4 py-3.5 text-sm font-brand whitespace-nowrap" style={{ color: 'var(--ink-soft)' }}>
                            {inv.side || '—'}
                          </td>
                        )}
                        {colVis.group && (
                          <td className="px-4 py-3.5 text-sm font-brand whitespace-nowrap" style={{ color: 'var(--ink-soft)' }}>
                            {inv.guest_group || '—'}
                          </td>
                        )}

                        {colVis.pax_split ? (
                          <>
                            <td className="px-4 py-3.5 whitespace-nowrap">
                              <span className="font-brand text-sm" style={{ color: 'var(--ink-soft)' }}>{inv.invited_pax ?? '—'}</span>
                            </td>
                            <td className="px-4 py-3.5 whitespace-nowrap">
                              <span className="font-danidin font-bold" style={{ fontSize: '16px', color: 'var(--ink)' }}>{inv.confirmed_pax ?? '—'}</span>
                            </td>
                          </>
                        ) : (
                          <td className="px-4 py-3.5 whitespace-nowrap">
                            <span className="font-danidin font-bold" style={{ fontSize: '16px', color: 'var(--ink)', letterSpacing: '0.02em' }}>
                              {inv.confirmed_pax ?? '?'}
                            </span>
                            {inv.invited_pax != null && (
                              <span className="font-brand" style={{ fontSize: '12px', color: 'var(--ink-mute)' }}> / {inv.invited_pax}</span>
                            )}
                          </td>
                        )}

                        {colVis.automation && (
                          <td className="px-4 py-3.5" onClick={e => e.stopPropagation()}>
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium font-brand" style={
                              inv.is_automated
                                ? { background: 'var(--violet-50)', color: 'var(--violet-700)' }
                                : { background: 'var(--paper-2)', color: 'var(--ink-mute)' }
                            }>
                              {inv.is_automated ? 'פעיל' : 'כבוי'}
                            </span>
                          </td>
                        )}

                        <td className="px-4 py-3.5">
                          <StatusBadge status={inv.rsvp_status} />
                        </td>

                        <td className="px-4 py-3.5" onClick={e => e.stopPropagation()}>
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

          {filtered.length > 0 && (
            <div className="px-5 py-3 flex items-center justify-between" style={{ borderTop: '1px solid var(--paper-2)', background: 'var(--paper)' }}>
              <span className="text-xs font-brand" style={{ color: 'var(--ink-mute)' }}>{filtered.length} שורות</span>
              {selected.size > 0 && (
                <span className="text-xs font-brand font-medium" style={{ color: 'var(--violet-700)' }}>{selected.size} נבחרו</span>
              )}
            </div>
          )}
        </section>

      </main>

      {/* ════ FLOATING BULK BAR ════ */}
      <div
        className={`dashboard-bulk-bar fixed bottom-6 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ease-out ${
          selected.size > 0 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
        aria-live="polite"
      >
        <div
          className="dashboard-bulk-card flex items-center gap-3.5"
          style={{
            background: 'var(--glass-bg)',
            backdropFilter: 'var(--glass-blur)',
            WebkitBackdropFilter: 'var(--glass-blur)',
            border: '1px solid var(--glass-line)',
            borderRadius: 'var(--r-pill)',
            padding: '10px 14px 10px 20px',
            boxShadow: '0 18px 48px -16px rgba(42,37,32,0.22)',
          }}
        >
          <div className="flex items-center gap-2 font-semibold" style={{ fontSize: '13px', color: 'var(--ink)' }}>
            <span className="font-danidin font-bold text-sm px-2.5 py-0.5" style={{ background: 'var(--violet-700)', color: 'white', borderRadius: 'var(--r-pill)' }}>
              {selected.size}
            </span>
            נבחרו
          </div>

          <div className="dashboard-bulk-actions flex items-center gap-1.5">
            <button
              onClick={() => canSendMessages ? setIsMessageModalOpen(true) : setUpgradeOpen(true)}
              className="inline-flex items-center gap-1.5 font-semibold font-brand transition-all"
              style={{ padding: '8px 14px', borderRadius: 'var(--r-pill)', background: 'var(--violet-700)', color: 'white', fontSize: '13px', border: '1px solid var(--violet-700)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--violet-600)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'var(--violet-700)')}
            >
              <Send className="w-3.5 h-3.5" /> שלח הודעה
            </button>

            <button
              onClick={() => canExportGuests ? handleExportSelected() : setUpgradeOpen(true)}
              className="inline-flex items-center gap-1.5 font-medium font-brand transition-colors"
              style={{ padding: '8px 14px', borderRadius: 'var(--r-pill)', background: 'white', color: 'var(--ink)', fontSize: '13px', border: '1px solid var(--line)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--paper)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'white')}
            >
              <Download className="w-3.5 h-3.5" /> ייצוא
            </button>

            <button
              onClick={() => setSelected(new Set())}
              className="flex items-center justify-center rounded-full transition-colors"
              style={{ width: '28px', height: '28px', background: 'rgba(0,0,0,0.04)', color: 'var(--ink-soft)', marginRight: '4px' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.08)'; e.currentTarget.style.color = 'var(--ink)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.04)'; e.currentTarget.style.color = 'var(--ink-soft)'; }}
              aria-label="בטל בחירה"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      <SiteFooter />
    </div>
  );
}
