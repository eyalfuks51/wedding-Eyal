# Add Guest Modal Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a "הוסף מוזמן" modal to `Dashboard.tsx` that inserts a new `pending` invitation row into Supabase and refreshes the table on success.

**Architecture:** All new state and the modal component live inside `Dashboard.tsx` — no new files. The modal is a controlled component rendered at the root of the Dashboard return, conditionally visible via `isModalOpen`. Form state is a single object reset to `EMPTY_FORM` on open/close. The event ID (already fetched) is promoted to component state so the INSERT can reference it.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v3, Supabase JS v2, Lucide React icons.

---

## State additions (all in `Dashboard`)

```ts
// Persist event ID alongside slug (promoted from local variable in load())
const [eventId, setEventId]       = useState<string>('');

// Modal open/close
const [isModalOpen, setIsModalOpen] = useState(false);

// Single form object — reset by spreading EMPTY_FORM
const EMPTY_FORM = { group_name: '', phone: '', side: '', group: '', invited_pax: 1 };
type FormFields  = typeof EMPTY_FORM;
const [form, setForm]             = useState<FormFields>({ ...EMPTY_FORM });

// Submission lifecycle
const [saving, setSaving]         = useState(false);
const [formError, setFormError]   = useState<string | null>(null);

// Success toast (auto-dismisses after 3 s)
const [toast, setToast]           = useState<string | null>(null);
```

---

### Task 1: Promote `eventId` to component state

**Files:**
- Modify: `src/pages/Dashboard.tsx` — `useState` declarations + `load()` function

**Step 1: Add state**
Inside the existing state block, after `eventSlug`:
```ts
const [eventId, setEventId] = useState<string>('');
```

**Step 2: Persist in `load()`**
After `setEventSlug(ev.slug)`, add:
```ts
setEventId(ev.id);
```

**Step 3: Verify TypeScript**
```bash
npx tsc --noEmit
```
Expected: no output (zero errors).

**Step 4: Commit**
```bash
git add src/pages/Dashboard.tsx
git commit -m "feat(dashboard): persist eventId in state for modal INSERT"
```

---

### Task 2: Add modal state + open/close helpers

**Files:**
- Modify: `src/pages/Dashboard.tsx`

**Step 1: Add state block**
After the existing `selected` state, insert:
```ts
// ── Add-guest modal ──────────────────────────────────────────────────────
const EMPTY_FORM = { group_name: '', phone: '', side: '', group: '', invited_pax: 1 } as const;
type FormFields  = { group_name: string; phone: string; side: string; group: string; invited_pax: number };

const [isModalOpen, setIsModalOpen] = useState(false);
const [form, setForm]               = useState<FormFields>({ ...EMPTY_FORM });
const [saving, setSaving]           = useState(false);
const [formError, setFormError]     = useState<string | null>(null);
const [toast, setToast]             = useState<string | null>(null);
```

**Step 2: Add helpers**
After the `toggleRow` function:
```ts
const openModal  = () => { setForm({ ...EMPTY_FORM }); setFormError(null); setIsModalOpen(true); };
const closeModal = () => { if (saving) return; setIsModalOpen(false); };
```

**Step 3: TypeScript check**
```bash
npx tsc --noEmit
```

**Step 4: Commit**
```bash
git add src/pages/Dashboard.tsx
git commit -m "feat(dashboard): add modal state and open/close helpers"
```

---

### Task 3: Add "הוסף מוזמן" button to the header

**Files:**
- Modify: `src/pages/Dashboard.tsx` — header JSX
- Add import: `UserPlus` from `lucide-react`

**Step 1: Import UserPlus**
Add `UserPlus` to the existing lucide-react import line.

**Step 2: Add button next to the existing ייצוא button**
```tsx
<button
  onClick={openModal}
  className="shrink-0 inline-flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 active:bg-violet-800 text-white text-sm font-medium font-brand rounded-xl transition-colors shadow-sm"
>
  <UserPlus className="w-4 h-4" />
  הוסף מוזמן
</button>
```
Place it to the **right** of the ייצוא button (in RTL the rightmost element is visually leftmost — use `flex-row-reverse` or just order in source so הוסף מוזמן renders first in RTL flow).

In RTL flex, source order = right-to-left visual order. So put "הוסף מוזמן" **after** "ייצוא" in source to render it to the **left** of ייצוא (i.e., primary action is more prominent on the right start side):

```tsx
{/* Action buttons — flex gap, RTL renders right-to-left */}
<div className="flex items-center gap-3 shrink-0">
  <button onClick={openModal} className="... bg-violet-600 ...">
    <UserPlus className="w-4 h-4" />
    הוסף מוזמן
  </button>
  <button className="... bg-slate-100 text-slate-600 hover:bg-slate-200 ...">
    <Download className="w-4 h-4" />
    ייצוא
  </button>
</div>
```

**Step 3: TypeScript check + visual check**
```bash
npx tsc --noEmit
```

**Step 4: Commit**
```bash
git add src/pages/Dashboard.tsx
git commit -m "feat(dashboard): add הוסף מוזמן trigger button to header"
```

---

### Task 4: Build the `AddGuestModal` component

**Files:**
- Modify: `src/pages/Dashboard.tsx` — add component above `Dashboard` export

**The complete component:**
```tsx
interface AddGuestModalProps {
  isOpen:     boolean;
  onClose:    () => void;
  onSuccess:  (newInvitation: Invitation) => void;
  eventId:    string;
  saving:     boolean;
  setSaving:  (v: boolean) => void;
  formError:  string | null;
  setFormError: (v: string | null) => void;
  form:       FormFields;
  setForm:    (v: FormFields) => void;
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

  const handleField = (field: keyof FormFields, value: string | number) =>
    setForm({ ...form, [field]: value });

  const validate = (): string | null => {
    if (!form.group_name.trim()) return 'נא להזין שם';
    const digits = form.phone.replace(/\D/g, '');
    if (digits.length < 9 || digits.length > 10) return 'נא להזין מספר טלפון תקין (9–10 ספרות)';
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

    const digits = form.phone.replace(/\D/g, '');
    const normalised = digits.startsWith('0') ? '972' + digits.slice(1) : digits;

    const { data, error } = await supabase
      .from('invitations')
      .insert({
        event_id:            eventId,
        group_name:          form.group_name.trim(),
        phone_numbers:       [normalised],
        side:                form.side  || null,
        group:               form.group.trim() || null,
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
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md font-brand" dir="rtl">

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <h2 id="modal-title" className="text-lg font-bold text-slate-800 font-danidin">
              הוספת מוזמן
            </h2>
            <button
              onClick={onClose}
              disabled={saving}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              aria-label="סגור"
            >
              <XCircle className="w-5 h-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} noValidate>
            <div className="px-6 py-5 space-y-4">

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
                  className="w-full px-3 py-2.5 text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent placeholder:text-slate-400"
                  disabled={saving}
                  autoFocus
                />
              </div>

              {/* phone */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  טלפון <span className="text-rose-500">*</span>
                </label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={e => handleField('phone', e.target.value)}
                  placeholder="050-000-0000"
                  className="w-full px-3 py-2.5 text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent placeholder:text-slate-400"
                  disabled={saving}
                  dir="ltr"
                />
              </div>

              {/* side + group — 2-column row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">צד</label>
                  <div className="relative">
                    <select
                      value={form.side}
                      onChange={e => handleField('side', e.target.value)}
                      className="w-full appearance-none pr-3 pl-7 py-2.5 text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent cursor-pointer"
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
                    value={form.group}
                    onChange={e => handleField('group', e.target.value)}
                    placeholder="עבודה, צבא..."
                    className="w-full px-3 py-2.5 text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent placeholder:text-slate-400"
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
                  className="w-24 px-3 py-2.5 text-sm text-slate-800 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent text-center"
                  disabled={saving}
                />
              </div>

              {/* Inline error */}
              {formError && (
                <p className="text-sm text-rose-600 font-brand bg-rose-50 px-3 py-2 rounded-xl">
                  {formError}
                </p>
              )}

            </div>

            {/* Footer actions */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/50 rounded-b-2xl">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
              >
                ביטול
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 px-5 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl transition-colors shadow-sm"
              >
                {saving ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    שומר...
                  </>
                ) : 'שמור'}
              </button>
            </div>
          </form>

        </div>
      </div>
    </>
  );
}
```

**Step 1: TypeScript check**
```bash
npx tsc --noEmit
```

**Step 2: Commit**
```bash
git add src/pages/Dashboard.tsx
git commit -m "feat(dashboard): add AddGuestModal component"
```

---

### Task 5: Wire modal into Dashboard + add success handler + toast

**Files:**
- Modify: `src/pages/Dashboard.tsx` — `Dashboard` return JSX

**Step 1: Add `onSuccess` handler**
```ts
const handleGuestAdded = (newInv: Invitation) => {
  // Optimistic prepend keeps existing sort order at top
  setInvitations(prev => [newInv, ...prev].sort((a, b) =>
    (a.group_name ?? '').localeCompare(b.group_name ?? '', 'he')
  ));
  setIsModalOpen(false);
  setToast('המוזמן נוסף בהצלחה ✓');
  setTimeout(() => setToast(null), 3000);
};
```

**Step 2: Render modal + toast at root of Dashboard return**
```tsx
{/* Modal */}
<AddGuestModal
  isOpen={isModalOpen}
  onClose={closeModal}
  onSuccess={handleGuestAdded}
  eventId={eventId}
  saving={saving}
  setSaving={setSaving}
  formError={formError}
  setFormError={setFormError}
  form={form}
  setForm={setForm}
/>

{/* Success toast */}
{toast && (
  <div className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-white text-sm font-medium font-brand px-4 py-2.5 rounded-xl shadow-lg transition-all">
    {toast}
  </div>
)}
```

Note: toast is positioned `right-6` (visual left in RTL layout — the trailing side). The floating bulk-action bar is centered, so there's no conflict.

**Step 3: TypeScript check**
```bash
npx tsc --noEmit
```
Expected: zero output.

**Step 4: Build check**
```bash
npm run build 2>&1 | grep -E "(error|Error|✓|built in)"
```
Expected: `✓ built in X.XXs`

**Step 5: Final commit**
```bash
git add src/pages/Dashboard.tsx docs/plans/2026-02-23-add-guest-modal.md
git commit -m "feat(dashboard): add guest modal — full implementation"
```

---

## Notes for future sessions

- **Dynamic event routing via Auth** — `SLUG` is currently hardcoded as `'hagit-and-itai'`. When authentication is added, replace with the event ID/slug derived from the authenticated user's session.
- **Phone normalisation** — The INSERT stores the number in international format (`972XXXXXXXXX`). The `formatIsraeliPhone` function in `whatsapp-scheduler` uses the same convention.
- **`confirmed_pax` defaults to 0** on insert (guest hasn't replied yet). `invited_pax` is the human-entered invite count.
- **Creatable group select** — currently a plain text input. When unique groups grow, upgrade to a combobox (e.g., `react-select` with `isCreatable`) without touching the DB schema.
