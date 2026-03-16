import { useState, useRef, useCallback } from 'react';
import { Upload, Download, FileSpreadsheet, CheckCircle2, AlertTriangle, XCircle, X, Loader2 } from 'lucide-react';
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

    // Step 1: Parse the file — if this fails, go back to instructions
    let result: ParseResult;
    try {
      result = await parseGuestFile(file);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'שגיאה בעיבוד הקובץ');
      setStep('instructions');
      setProcessing(false);
      return;
    }

    setParseResult(result);

    // Edge case: all rows failed validation
    if (result.valid.length === 0 && result.errors.length > 0) {
      setStep('results');
      setProcessing(false);
      return;
    }

    // Edge case: completely empty file
    if (result.valid.length === 0) {
      setError('הקובץ ריק — לא נמצאו שורות עם נתונים');
      setStep('instructions');
      setProcessing(false);
      return;
    }

    // Step 2: Upsert valid rows — errors are captured, never thrown
    let upsert: UpsertResult = { inserted: 0, updated: 0, errors: [] };
    try {
      upsert = await bulkUpsertInvitations(eventId, result.valid);
    } catch (upsertErr: unknown) {
      upsert.errors.push({
        group_name: 'שגיאת מערכת',
        phone: '',
        error: upsertErr instanceof Error ? upsertErr.message : 'שגיאה בשמירה לבסיס הנתונים',
      });
    }

    // Step 3: ALWAYS show results — no outer catch can override this
    setUpsertResult(upsert);
    setStep('results');
    setProcessing(false);

    // Step 4: Notify parent to refresh (isolated — cannot affect results display)
    if (upsert.inserted > 0 || upsert.updated > 0) {
      try { onSuccess(); } catch { /* never interfere with results */ }
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
                {/* Conditional header message */}
                {upsertResult && (upsertResult.inserted > 0 || upsertResult.updated > 0) && (
                  <p className="text-sm font-medium text-slate-700 font-brand text-center">
                    {(parseResult?.warnings?.length ?? 0) > 0 ||
                     (parseResult?.errors?.length ?? 0) > 0 ||
                     (upsertResult?.errors?.length ?? 0) > 0
                      ? 'הקובץ נקלט בהצלחה, אך שים לב לפרטים הבאים:'
                      : 'הקובץ נקלט בהצלחה'}
                  </p>
                )}

                {/* ✅ Success count banner */}
                {upsertResult && (upsertResult.inserted > 0 || upsertResult.updated > 0) && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 font-brand">
                    <div className="flex items-center gap-2 text-emerald-700 mb-1">
                      <CheckCircle2 className="w-4 h-4" />
                      <span className="text-sm font-medium">
                        נקלטו בהצלחה: {upsertResult.inserted + upsertResult.updated} רשומות
                      </span>
                    </div>
                    <div className="flex gap-4 text-xs text-emerald-600 mt-1">
                      {upsertResult.inserted > 0 && <span>{upsertResult.inserted} נוספו</span>}
                      {upsertResult.updated > 0 && <span>{upsertResult.updated} עודכנו</span>}
                    </div>
                  </div>
                )}

                {/* ⚠️ Warnings section (amber) */}
                {parseResult && (parseResult.warnings?.length ?? 0) > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 font-brand">
                    <div className="flex items-center gap-2 text-amber-700 mb-2">
                      <AlertTriangle className="w-4 h-4" />
                      <span className="text-sm font-medium">
                        אזהרות ({parseResult.warnings.length}) — נקלטו אך דורשות השלמה ידנית
                      </span>
                    </div>
                    <div className="max-h-40 overflow-y-auto space-y-1.5">
                      {parseResult.warnings.map((w, i) => (
                        <div key={i} className="text-xs text-amber-800 bg-amber-100/60 rounded-lg px-3 py-1.5">
                          {w.message}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ❌ Errors section (rose) — combined parse + upsert errors */}
                {((parseResult?.errors?.length ?? 0) > 0 || (upsertResult?.errors?.length ?? 0) > 0) && (
                  <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 font-brand">
                    <div className="flex items-center gap-2 text-rose-700 mb-2">
                      <XCircle className="w-4 h-4" />
                      <span className="text-sm font-medium">
                        לא נקלטו ({(parseResult?.errors?.length ?? 0) + (upsertResult?.errors?.length ?? 0)})
                      </span>
                    </div>
                    <div className="max-h-40 overflow-y-auto space-y-1.5">
                      {parseResult?.errors?.map((err, i) => (
                        <div key={`parse-${i}`} className="text-xs text-rose-800 bg-rose-100/60 rounded-lg px-3 py-1.5">
                          <span className="font-medium">שורה {err.row_number}</span>
                          <span className="text-rose-600"> — {err.errors.join(', ')}</span>
                        </div>
                      ))}
                      {upsertResult?.errors?.map((err, i) => (
                        <div key={`db-${i}`} className="text-xs text-rose-800 bg-rose-100/60 rounded-lg px-3 py-1.5">
                          <span className="font-medium">{err.group_name}</span>
                          <span className="text-rose-600"> — {err.error}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* All failed, no success */}
                {upsertResult && upsertResult.inserted === 0 && upsertResult.updated === 0 && (
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
