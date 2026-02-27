# Guest Upload Feature — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a bulk guest upload flow to the Dashboard — download Excel template, fill it, upload, validate, upsert into `invitations`.

**Architecture:** A new `GuestUploadModal` component handles the 3-step flow (instructions → upload → results). Excel generation/parsing happens client-side via `xlsx` library. Validation and upsert happen via a new Supabase Edge Function `bulk-upsert-invitations` that returns per-row results. The modal is triggered from a new "ייבוא" button in the Dashboard header.

**Tech Stack:** React, TypeScript, Tailwind CSS, `xlsx` (SheetJS), `file-saver`, Supabase Edge Function (Deno)

---

### Task 1: Install dependencies

**Files:**
- Modify: `package.json`

**What to do:**

Run:
```bash
npm install xlsx file-saver
npm install -D @types/file-saver
```

Note: `xlsx` has built-in types. `file-saver` needs `@types/file-saver`.

**Verify:** `npx tsc --noEmit` — no errors.

**Commit:** `chore: add xlsx and file-saver dependencies`

---

### Task 2: Create Excel template generator utility

**Files:**
- Create: `src/lib/guest-excel.ts`

**What to do:**

Create a utility module that generates the Excel template and parses uploaded files.

```typescript
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface GuestRow {
  group_name: string;
  phone1: string;
  phone2: string;
  invited_pax: number;
  side: string;
  guest_group: string;
  is_automated: string;
}

export interface ParsedGuest {
  row_number: number;
  group_name: string;
  phone_numbers: string[];
  invited_pax: number;
  side: string | null;
  guest_group: string | null;
  is_automated: boolean;
}

export interface ParseError {
  row_number: number;
  group_name: string;
  errors: string[];
}

export interface ParseResult {
  valid: ParsedGuest[];
  errors: ParseError[];
}

// ─── Column mapping ──────────────────────────────────────────────────────────

const COLUMNS = [
  'שם קבוצה',
  'טלפון 1',
  'טלפון 2',
  'כמות מוזמנים',
  'צד',
  'קבוצה',
  'שליחה אוטומטית',
];

const INSTRUCTIONS = [
  'שם המשפחה או הזוג (חובה)',
  'מספר ראשי, 05X... (חובה)',
  'מספר נוסף (אופציונלי)',
  'מספר שלם, לפחות 1 (חובה)',
  'חתן / כלה (אופציונלי)',
  'משפחה / חברים / עבודה (אופציונלי)',
  'כן / לא, ברירת מחדל: כן',
];

// ─── Phone normalization ─────────────────────────────────────────────────────

function normalizePhone(raw: string): string {
  const digits = String(raw).replace(/\D/g, '');
  if (digits.startsWith('972')) return digits;
  if (digits.startsWith('0')) return '972' + digits.slice(1);
  return digits;
}

function isValidPhone(raw: string): boolean {
  const digits = String(raw).replace(/\D/g, '');
  return digits.length >= 9 && digits.length <= 12;
}

// ─── Template download ───────────────────────────────────────────────────────

export function downloadTemplate(): void {
  const wb = XLSX.utils.book_new();
  const data = [COLUMNS, INSTRUCTIONS];
  const ws = XLSX.utils.aoa_to_sheet(data);

  // Column widths (approximate characters)
  ws['!cols'] = [
    { wch: 20 }, // שם קבוצה
    { wch: 15 }, // טלפון 1
    { wch: 15 }, // טלפון 2
    { wch: 14 }, // כמות מוזמנים
    { wch: 10 }, // צד
    { wch: 14 }, // קבוצה
    { wch: 16 }, // שליחה אוטומטית
  ];

  // Set RTL on the sheet
  ws['!sheetViews'] = [{ rightToLeft: true }];

  XLSX.utils.book_append_sheet(wb, ws, 'מוזמנים');
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, 'תבנית_מוזמנים.xlsx');
}

// ─── File parsing ────────────────────────────────────────────────────────────

export function parseGuestFile(file: File): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('שגיאה בקריאת הקובץ'));
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: Record<string, string>[] = XLSX.utils.sheet_to_json(ws, { header: COLUMNS, defval: '' });

        // Skip header row and instruction row
        const dataRows = rows.slice(2);

        const valid: ParsedGuest[] = [];
        const errors: ParseError[] = [];

        dataRows.forEach((row, idx) => {
          const rowNum = idx + 3; // 1-indexed, skip header + instructions
          const groupName = String(row['שם קבוצה'] ?? '').trim();
          const phone1Raw = String(row['טלפון 1'] ?? '').trim();
          const phone2Raw = String(row['טלפון 2'] ?? '').trim();
          const paxRaw = row['כמות מוזמנים'];
          const side = String(row['צד'] ?? '').trim() || null;
          const guestGroup = String(row['קבוצה'] ?? '').trim() || null;
          const autoRaw = String(row['שליחה אוטומטית'] ?? '').trim().toLowerCase();

          // Skip completely empty rows
          if (!groupName && !phone1Raw) return;

          const rowErrors: string[] = [];

          if (!groupName) rowErrors.push('שם קבוצה חסר');
          if (!phone1Raw) rowErrors.push('טלפון 1 חסר');
          else if (!isValidPhone(phone1Raw)) rowErrors.push('טלפון 1 לא תקין');
          if (phone2Raw && !isValidPhone(phone2Raw)) rowErrors.push('טלפון 2 לא תקין');

          const pax = Number(paxRaw);
          if (!paxRaw || isNaN(pax) || pax < 1 || !Number.isInteger(pax)) {
            rowErrors.push('כמות מוזמנים חייבת להיות מספר שלם >= 1');
          }

          if (rowErrors.length > 0) {
            errors.push({ row_number: rowNum, group_name: groupName || `שורה ${rowNum}`, errors: rowErrors });
            return;
          }

          const phoneNumbers = [normalizePhone(phone1Raw)];
          if (phone2Raw) phoneNumbers.push(normalizePhone(phone2Raw));

          const isAutomated = autoRaw === 'לא' || autoRaw === 'no' || autoRaw === 'false' ? false : true;

          valid.push({
            row_number: rowNum,
            group_name: groupName,
            phone_numbers: phoneNumbers,
            invited_pax: pax,
            side,
            guest_group: guestGroup,
            is_automated: isAutomated,
          });
        });

        resolve({ valid, errors });
      } catch (err) {
        reject(new Error('שגיאה בפענוח הקובץ — ודא שהפורמט xlsx'));
      }
    };
    reader.readAsArrayBuffer(file);
  });
}
```

**Verify:** `npx tsc --noEmit` — no errors.

**Commit:** `feat(upload): add Excel template generator and parser utility`

---

### Task 3: Create bulk upsert function in supabase.js

**Files:**
- Modify: `src/lib/supabase.js`

**What to do:**

Add a new exported function after the existing `fetchAutomatedAudienceCounts`:

```javascript
/**
 * Bulk upsert invitations by primary phone number.
 * For each guest: if an invitation with the same phone_numbers[0] exists → update,
 * otherwise → insert. Returns { inserted, updated, errors[] }.
 */
export const bulkUpsertInvitations = async (eventId, guests) => {
  if (!supabase) throw new Error('Supabase is not configured');

  // Fetch existing invitations to find matches by primary phone
  const { data: existing, error: fetchErr } = await supabase
    .from('invitations')
    .select('id, phone_numbers')
    .eq('event_id', eventId);
  if (fetchErr) throw fetchErr;

  // Build a map: normalized primary phone → invitation id
  const phoneToId = new Map();
  for (const inv of existing ?? []) {
    const primary = inv.phone_numbers?.[0];
    if (primary) phoneToId.set(primary, inv.id);
  }

  let inserted = 0;
  let updated = 0;
  const errors = [];

  for (const guest of guests) {
    const primaryPhone = guest.phone_numbers[0];
    const existingId = phoneToId.get(primaryPhone);

    try {
      if (existingId) {
        // UPDATE — preserve rsvp_status, confirmed_pax, messages_sent_count
        const { error } = await supabase
          .from('invitations')
          .update({
            group_name: guest.group_name,
            phone_numbers: guest.phone_numbers,
            invited_pax: guest.invited_pax,
            side: guest.side,
            guest_group: guest.guest_group,
            is_automated: guest.is_automated,
          })
          .eq('id', existingId);
        if (error) throw error;
        updated++;
      } else {
        // INSERT
        const { error } = await supabase
          .from('invitations')
          .insert({
            event_id: eventId,
            group_name: guest.group_name,
            phone_numbers: guest.phone_numbers,
            invited_pax: guest.invited_pax,
            confirmed_pax: 0,
            rsvp_status: 'pending',
            is_automated: guest.is_automated,
            messages_sent_count: 0,
            side: guest.side,
            guest_group: guest.guest_group,
          });
        if (error) throw error;
        inserted++;
      }
    } catch (err) {
      errors.push({
        group_name: guest.group_name,
        phone: primaryPhone,
        error: err.message || 'שגיאה לא ידועה',
      });
    }
  }

  return { inserted, updated, errors };
};
```

**Verify:** `npx tsc --noEmit` — no errors.

**Commit:** `feat(upload): add bulk upsert function for invitations`

---

### Task 4: Create GuestUploadModal component

**Files:**
- Create: `src/components/dashboard/GuestUploadModal.tsx`

**What to do:**

Create the 3-step upload modal. This is the main UI component.

```typescript
import { useState, useRef, useCallback } from 'react';
import { Upload, Download, FileSpreadsheet, CheckCircle2, AlertTriangle, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { downloadTemplate, parseGuestFile, type ParseResult } from '@/lib/guest-excel';
import { bulkUpsertInvitations } from '@/lib/supabase';

type Step = 'instructions' | 'uploading' | 'results';

interface UpsertResult {
  inserted: number;
  updated: number;
  errors: Array<{ group_name: string; phone: string; error: string }>;
}

interface Props {
  isOpen: boolean;
  eventId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function GuestUploadModal({ isOpen, eventId, onClose, onSuccess }: Props) {
  const [step, setStep] = useState<Step>('instructions');
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [upsertResult, setUpsertResult] = useState<UpsertResult | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setStep('instructions');
    setParseResult(null);
    setUpsertResult(null);
    setProcessing(false);
    setError(null);
  }, []);

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset file input so same file can be re-uploaded
    e.target.value = '';

    setProcessing(true);
    setError(null);
    setStep('uploading');

    try {
      const result = await parseGuestFile(file);
      setParseResult(result);

      if (result.valid.length === 0 && result.errors.length > 0) {
        // All rows failed validation — show results immediately
        setStep('results');
        setProcessing(false);
        return;
      }

      if (result.valid.length === 0) {
        setError('הקובץ ריק — לא נמצאו שורות עם נתונים');
        setStep('instructions');
        setProcessing(false);
        return;
      }

      // Upsert valid rows
      const upsert = await bulkUpsertInvitations(eventId, result.valid);
      setUpsertResult(upsert);
      setStep('results');

      // If any rows succeeded, notify parent to refresh
      if (upsert.inserted > 0 || upsert.updated > 0) {
        onSuccess();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'שגיאה בעיבוד הקובץ');
      setStep('instructions');
    } finally {
      setProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={handleClose} />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="pointer-events-auto bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
          dir="rtl"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-violet-100 rounded-xl flex items-center justify-center">
                <FileSpreadsheet className="w-5 h-5 text-violet-600" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-800 font-danidin">ייבוא מוזמנים</h2>
                <p className="text-xs text-slate-400 font-brand">העלאת רשימת אורחים מקובץ Excel</p>
              </div>
            </div>
            <button onClick={handleClose} className="text-slate-400 hover:text-slate-600 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="px-6 py-5">
            {/* ─── Step: Instructions ─── */}
            {step === 'instructions' && (
              <div className="space-y-4">
                <div className="bg-violet-50 rounded-xl p-4 text-sm text-slate-700 font-brand space-y-2">
                  <p className="font-medium text-violet-800">איך זה עובד?</p>
                  <ol className="list-decimal list-inside space-y-1 text-slate-600 leading-relaxed">
                    <li>הורידו את התבנית המוכנה (קובץ Excel)</li>
                    <li>מלאו את הנתונים לפי ההנחיות בשורה השנייה</li>
                    <li>העלו את הקובץ המלא חזרה לכאן</li>
                  </ol>
                  <p className="text-xs text-slate-500 mt-2">
                    <strong>שימו לב:</strong> מספר הטלפון הראשי הוא המזהה הייחודי. אם המספר כבר קיים — הנתונים יתעדכנו. אם חדש — ייווצר מוזמן חדש.
                  </p>
                </div>

                {error && (
                  <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 text-sm text-rose-700 font-brand flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => downloadTemplate()}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium font-brand rounded-xl transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    הורד תבנית Excel
                  </button>

                  <button
                    onClick={() => fileRef.current?.click()}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium font-brand rounded-xl transition-colors shadow-sm"
                  >
                    <Upload className="w-4 h-4" />
                    העלה קובץ מלא
                  </button>
                </div>

                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>
            )}

            {/* ─── Step: Uploading (processing) ─── */}
            {step === 'uploading' && processing && (
              <div className="flex flex-col items-center justify-center py-10 gap-4">
                <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
                <p className="text-sm text-slate-600 font-brand">מעבד את הקובץ...</p>
              </div>
            )}

            {/* ─── Step: Results ─── */}
            {step === 'results' && (
              <div className="space-y-4">
                {/* Success summary */}
                {upsertResult && (upsertResult.inserted > 0 || upsertResult.updated > 0) && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 font-brand">
                    <div className="flex items-center gap-2 text-emerald-700 mb-1">
                      <CheckCircle2 className="w-4 h-4" />
                      <span className="text-sm font-medium">העלאה הושלמה בהצלחה</span>
                    </div>
                    <div className="flex gap-4 text-xs text-emerald-600 mt-1">
                      {upsertResult.inserted > 0 && <span>{upsertResult.inserted} נוספו</span>}
                      {upsertResult.updated > 0 && <span>{upsertResult.updated} עודכנו</span>}
                    </div>
                  </div>
                )}

                {/* Validation errors from parsing */}
                {parseResult && parseResult.errors.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 font-brand">
                    <div className="flex items-center gap-2 text-amber-700 mb-2">
                      <AlertTriangle className="w-4 h-4" />
                      <span className="text-sm font-medium">{parseResult.errors.length} שורות לא עלו (ולידציה)</span>
                    </div>
                    <div className="max-h-40 overflow-y-auto space-y-1.5">
                      {parseResult.errors.map((err, i) => (
                        <div key={i} className="text-xs text-amber-800 bg-amber-100/60 rounded-lg px-3 py-1.5">
                          <span className="font-medium">{err.group_name}</span>
                          <span className="text-amber-600"> — {err.errors.join(', ')}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* DB errors from upsert */}
                {upsertResult && upsertResult.errors.length > 0 && (
                  <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 font-brand">
                    <div className="flex items-center gap-2 text-rose-700 mb-2">
                      <AlertTriangle className="w-4 h-4" />
                      <span className="text-sm font-medium">{upsertResult.errors.length} שגיאות שמירה</span>
                    </div>
                    <div className="max-h-40 overflow-y-auto space-y-1.5">
                      {upsertResult.errors.map((err, i) => (
                        <div key={i} className="text-xs text-rose-800 bg-rose-100/60 rounded-lg px-3 py-1.5">
                          <span className="font-medium">{err.group_name}</span>
                          <span className="text-rose-600"> — {err.error}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* All failed, no success */}
                {upsertResult && upsertResult.inserted === 0 && upsertResult.updated === 0 && upsertResult.errors.length > 0 && (
                  <div className="text-center text-sm text-slate-500 font-brand py-2">
                    לא הועלו מוזמנים. תקנו את השגיאות ונסו שוב.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/60">
            {step === 'results' ? (
              <div className="flex gap-3">
                <button
                  onClick={reset}
                  className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium font-brand rounded-xl transition-colors"
                >
                  העלה קובץ נוסף
                </button>
                <button
                  onClick={handleClose}
                  className="flex-1 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium font-brand rounded-xl transition-colors shadow-sm"
                >
                  סגור
                </button>
              </div>
            ) : (
              <p className="text-[11px] text-slate-400 font-brand text-center">
                פורמטים נתמכים: .xlsx, .xls, .csv · ניתן להוסיף טלפונים נוספים דרך מסך העריכה
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
```

**Verify:** `npx tsc --noEmit` — no errors.

**Commit:** `feat(upload): create GuestUploadModal component with 3-step flow`

---

### Task 5: Wire up the upload button in Dashboard

**Files:**
- Modify: `src/pages/Dashboard.tsx`

**What to do:**

1. Add import at the top of Dashboard.tsx (near other dashboard component imports):

```typescript
import GuestUploadModal from '@/components/dashboard/GuestUploadModal';
```

Also add the `Upload` icon to the lucide-react import (add `Upload` to the existing destructured import list).

2. Add state for the upload modal. Near the existing `isModalOpen` state (line ~871), add:

```typescript
const [isUploadOpen, setIsUploadOpen] = useState(false);
```

3. Create a reload callback that the upload modal can call on success. After the invitations fetch `useEffect`, add:

```typescript
const reloadInvitations = useCallback(() => {
  if (!event?.id || !supabase) return;
  const sb = supabase;
  setInvLoading(true);
  sb.from('invitations').select('*').eq('event_id', event.id).order('group_name', { ascending: true })
    .then(({ data, error }) => {
      if (!error && data) setInvitations(data as Invitation[]);
    })
    .finally(() => setInvLoading(false));
}, [event?.id]);
```

4. In the header action buttons section (after the existing "ייצוא" button, around line 1263-1268), add a new "ייבוא" button between "הוסף מוזמן" and "ייצוא":

```tsx
<button
  onClick={() => setIsUploadOpen(true)}
  className="shrink-0 inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-medium font-brand rounded-xl transition-colors"
>
  <Upload className="w-4 h-4" />
  ייבוא
</button>
```

5. At the end of the component JSX (before the closing `</div>` of the main wrapper, near the toast and other modals), add:

```tsx
{event?.id && (
  <GuestUploadModal
    isOpen={isUploadOpen}
    eventId={event.id}
    onClose={() => setIsUploadOpen(false)}
    onSuccess={reloadInvitations}
  />
)}
```

**Verify:** `npx tsc --noEmit` — no errors. Visual check: new "ייבוא" button visible in dashboard header.

**Commit:** `feat(upload): wire GuestUploadModal into Dashboard header`

---

### Task 6: Update CLAUDE.md with new file paths and feature docs

**Files:**
- Modify: `CLAUDE.md`

**What to do:**

1. In the File Structure section, add entries for the new files:

Under `lib/`:
```
    guest-excel.ts                              Excel template download + upload parser
```

Under `components/dashboard/`:
```
      GuestUploadModal.tsx                      3-step guest upload modal (instructions → upload → results)
```

2. In the Dashboard features section, add:

```
- **Guest Upload (ייבוא):** A header button opens `GuestUploadModal` — 3-step flow: download Excel template → fill → upload. Client-side parsing via `xlsx` library, validation returns per-row errors with group names. Upsert by primary phone: existing guests updated (preserving RSVP data), new guests inserted. Results screen shows success/error counts.
```

**Verify:** The CLAUDE.md changes are documentation-only — no code verification needed.

**Commit:** `docs: add guest upload feature to CLAUDE.md`
