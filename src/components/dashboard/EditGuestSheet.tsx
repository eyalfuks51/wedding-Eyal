import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

// ─── Types (exported so Dashboard.tsx can import instead of re-defining) ──────

export type RsvpStatus = 'pending' | 'attending' | 'declined';

export interface Invitation {
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

interface EditForm {
  group_name:    string;
  phones:        string[];
  side:          string;
  guest_group:   string;
  rsvp_status:   RsvpStatus;
  invited_pax:   number;
  confirmed_pax: number;
  is_automated:  boolean;
}

export interface EditGuestSheetProps {
  invitation: Invitation | null;   // null = sheet closed
  sides:      string[];            // for the צד select options
  onClose:    () => void;
  onSave:     (updated: Invitation) => void;
}

// ─── Small helpers ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 font-brand mb-2 mt-5 first:mt-0">
      {children}
    </h3>
  );
}

function FieldLabel({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-600 font-brand mb-1">
      {children}
    </label>
  );
}

const INPUT_CLS =
  'w-full px-3 py-2 text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded-xl ' +
  'focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent font-brand';

const SELECT_CLS = `${INPUT_CLS} appearance-none cursor-pointer`;

// ─── Component ────────────────────────────────────────────────────────────────

export function EditGuestSheet({ invitation, sides, onClose, onSave }: EditGuestSheetProps) {
  const [form, setForm] = useState<EditForm>({
    group_name: '', phones: [''], side: '', guest_group: '',
    rsvp_status: 'pending', invited_pax: 1, confirmed_pax: 0, is_automated: false,
  });
  const [saving, setSaving]       = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Sync local form whenever the target invitation changes
  useEffect(() => {
    if (!invitation) return;
    setForm({
      group_name:    invitation.group_name    ?? '',
      phones:        invitation.phone_numbers?.length ? [...invitation.phone_numbers] : [''],
      side:          invitation.side          ?? '',
      guest_group:   invitation.guest_group   ?? '',
      rsvp_status:   invitation.rsvp_status   ?? 'pending',
      invited_pax:   invitation.invited_pax   ?? 1,
      confirmed_pax: invitation.confirmed_pax ?? 0,
      is_automated:  invitation.is_automated  ?? false,
    });
    setFormError(null);
  }, [invitation]);

  // Helpers for concise setForm calls
  const set = <K extends keyof EditForm>(key: K, value: EditForm[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const setPhone = (idx: number, value: string) =>
    setForm(prev => {
      const phones = [...prev.phones];
      phones[idx] = value;
      return { ...prev, phones };
    });

  const addPhone    = () => setForm(prev => ({ ...prev, phones: [...prev.phones, ''] }));
  const removePhone = (idx: number) =>
    setForm(prev => ({ ...prev, phones: prev.phones.filter((_, i) => i !== idx) }));

  const handleSave = async () => {
    if (!invitation || !supabase) return;
    setFormError(null);

    if (!form.group_name.trim()) {
      setFormError('שם הקבוצה הוא שדה חובה');
      return;
    }
    const phone_numbers = form.phones.map(p => p.trim()).filter(Boolean);
    if (phone_numbers.length === 0) {
      setFormError('יש להזין לפחות מספר טלפון אחד');
      return;
    }

    setSaving(true);

    const updates = {
      group_name:    form.group_name.trim(),
      phone_numbers,
      side:          form.side.trim()        || null,
      guest_group:   form.guest_group.trim() || null,
      rsvp_status:   form.rsvp_status,
      invited_pax:   form.invited_pax,
      confirmed_pax: form.confirmed_pax,
      is_automated:  form.is_automated,
    };

    const { error } = await supabase
      .from('invitations')
      .update(updates)
      .eq('id', invitation.id);

    setSaving(false);

    if (error) {
      setFormError(`שגיאה בשמירה: ${error.message}`);
      return;
    }

    onSave({ ...invitation, ...updates });
  };

  return (
    <Sheet open={invitation !== null} onOpenChange={open => { if (!open) onClose(); }}>
      <SheetContent side="left" dir="rtl" className="font-brand flex flex-col p-0">

        {/* Header */}
        <SheetHeader className="flex-row items-start justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <SheetTitle>עריכת אורח</SheetTitle>
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

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">

          {/* ── Identity ───────────────────────────────────────────────── */}
          <SectionLabel>זהות</SectionLabel>

          <div className="mb-3">
            <FieldLabel htmlFor="edit-group-name">שם הקבוצה</FieldLabel>
            <input
              id="edit-group-name"
              type="text"
              value={form.group_name}
              onChange={e => set('group_name', e.target.value)}
              className={INPUT_CLS}
              placeholder="לדוגמה: משפחת כהן"
            />
          </div>

          <div className="mb-3">
            <FieldLabel>טלפונים</FieldLabel>
            <div className="space-y-2">
              {form.phones.map((phone, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(idx, e.target.value)}
                    className={`${INPUT_CLS} flex-1`}
                    placeholder="050-000-0000"
                    dir="ltr"
                  />
                  {form.phones.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removePhone(idx)}
                      className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      aria-label="הסר טלפון"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={addPhone}
                className="text-xs text-violet-600 hover:text-violet-800 font-medium transition-colors"
              >
                + הוסף מספר
              </button>
            </div>
          </div>

          {/* ── Classification ─────────────────────────────────────────── */}
          <SectionLabel>סיווג</SectionLabel>

          <div className="mb-3">
            <FieldLabel htmlFor="edit-side">צד</FieldLabel>
            <select
              id="edit-side"
              value={form.side}
              onChange={e => set('side', e.target.value)}
              className={SELECT_CLS}
            >
              <option value="">— ללא —</option>
              {sides.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="mb-3">
            <FieldLabel htmlFor="edit-group">קבוצה</FieldLabel>
            <input
              id="edit-group"
              type="text"
              value={form.guest_group}
              onChange={e => set('guest_group', e.target.value)}
              className={INPUT_CLS}
              placeholder="לדוגמה: חברים מהצבא"
            />
          </div>

          {/* ── RSVP ───────────────────────────────────────────────────── */}
          <SectionLabel>RSVP</SectionLabel>

          <div className="mb-3">
            <FieldLabel htmlFor="edit-rsvp-status">סטטוס</FieldLabel>
            <select
              id="edit-rsvp-status"
              value={form.rsvp_status}
              onChange={e => set('rsvp_status', e.target.value as RsvpStatus)}
              className={SELECT_CLS}
            >
              <option value="pending">ממתין</option>
              <option value="attending">מגיע</option>
              <option value="declined">לא מגיע</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <FieldLabel htmlFor="edit-invited-pax">מוזמנים</FieldLabel>
              <input
                id="edit-invited-pax"
                type="number"
                min={0}
                value={form.invited_pax}
                onChange={e => set('invited_pax', Number(e.target.value))}
                className={INPUT_CLS}
              />
            </div>
            <div>
              <FieldLabel htmlFor="edit-confirmed-pax">אישרו</FieldLabel>
              <input
                id="edit-confirmed-pax"
                type="number"
                min={0}
                value={form.confirmed_pax}
                onChange={e => set('confirmed_pax', Number(e.target.value))}
                className={INPUT_CLS}
              />
            </div>
          </div>

          {/* ── Settings ───────────────────────────────────────────────── */}
          <SectionLabel>הגדרות</SectionLabel>

          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-slate-700 font-brand">שלח הודעות אוטומטיות</span>
            <button
              type="button"
              role="switch"
              aria-checked={form.is_automated}
              onClick={() => set('is_automated', !form.is_automated)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-1 ${
                form.is_automated ? 'bg-violet-600' : 'bg-slate-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                  form.is_automated ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Inline error */}
          {formError && (
            <p className="mt-3 text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2 font-brand">
              {formError}
            </p>
          )}

        </div>

        {/* Sticky footer */}
        <div className="border-t border-slate-100 px-6 py-4 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex-1 py-2.5 px-4 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors font-brand disabled:opacity-50"
          >
            ביטול
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 px-4 text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-xl transition-colors font-brand disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving && (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            שמור שינויים
          </button>
        </div>

      </SheetContent>
    </Sheet>
  );
}
