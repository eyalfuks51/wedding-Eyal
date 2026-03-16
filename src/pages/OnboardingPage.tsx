import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createOnboardingEvent, generateSlug } from '@/lib/supabase';

const TEMPLATES = [
  { id: 'elegant',         label: 'Elegant',        desc: 'נייבי כהה + זהב, מינימליסטי' },
  { id: 'wedding-default', label: 'Wedding Default', desc: 'בורדו/קרם, פרחים דקורטיביים' },
];

interface FormState { partner1: string; partner2: string; date: string; venue: string }

export default function OnboardingPage() {
  const navigate                        = useNavigate();
  const [step, setStep]                 = useState<1 | 2 | 3 | 4>(1);
  const [templateId, setTemplateId]     = useState('elegant');
  const [form, setForm]                 = useState<FormState>({ partner1: '', partner2: '', date: '', venue: '' });
  const [saving, setSaving]             = useState(false);
  const [error, setError]               = useState('');
  const [createdSlug, setCreatedSlug]   = useState<string | null>(null);
  const [copied, setCopied]             = useState(false);

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }));

  const handleCopy = async () => {
    if (!createdSlug) return;
    await navigator.clipboard.writeText(`${window.location.origin}/${createdSlug}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFinish = async () => {
    setSaving(true);
    setError('');
    try {
      const slug = generateSlug(form.partner1, form.partner2);
      const event = await createOnboardingEvent({
        slug,
        templateId,
        contentConfig: {
          couple_names: `${form.partner1} & ${form.partner2}`,
          date_display: form.date,
          venue_name:   form.venue,
        },
        partner1Name: form.partner1,
        partner2Name: form.partner2,
        eventDate: form.date || null,
      });
      setCreatedSlug(event.slug);
      localStorage.setItem('currentEventId', event.id);
      setStep(4);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'שגיאה ביצירת האירוע');
      setSaving(false);
    }
  };

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 flex items-center justify-center font-brand p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-lg">

        {/* Progress bar — hidden on success screen */}
        {step < 4 && (
          <div className="flex gap-2 mb-8">
            {[1, 2, 3].map(n => (
              <div
                key={n}
                className={`h-1.5 flex-1 rounded-full transition-colors ${n <= step ? 'bg-violet-600' : 'bg-slate-200'}`}
              />
            ))}
          </div>
        )}

        {step === 1 && (
          <>
            <h2 className="font-danidin text-2xl text-slate-800 mb-1">בחרו עיצוב</h2>
            <p className="text-slate-500 text-sm mb-6">ניתן לשנות בהמשך בהגדרות</p>
            <div className="grid grid-cols-2 gap-3 mb-6">
              {TEMPLATES.map(t => (
                <button
                  key={t.id}
                  onClick={() => setTemplateId(t.id)}
                  className={`border-2 rounded-xl p-4 text-right transition-colors ${templateId === t.id ? 'border-violet-600 bg-violet-50' : 'border-slate-200 hover:border-slate-300'}`}
                >
                  <div className="font-medium text-slate-800 text-sm">{t.label}</div>
                  <div className="text-slate-500 text-xs mt-0.5">{t.desc}</div>
                </button>
              ))}
            </div>
            <button
              onClick={() => setStep(2)}
              className="w-full bg-violet-600 text-white rounded-xl py-3 text-sm font-medium hover:bg-violet-700 transition-colors"
            >
              הבא
            </button>
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="font-danidin text-2xl text-slate-800 mb-1">פרטי האירוע</h2>
            <p className="text-slate-500 text-sm mb-6">ניתן לערוך בהמשך בהגדרות</p>
            <div className="space-y-4 mb-6">
              {([
                ['partner1', 'שם בן/בת זוג 1', 'text'],
                ['partner2', 'שם בן/בת זוג 2', 'text'],
                ['date',     'תאריך האירוע',    'date'],
                ['venue',    'שם האולם',         'text'],
              ] as const).map(([key, label, type]) => (
                <div key={key}>
                  <label className="block text-sm text-slate-600 mb-1">{label}</label>
                  <input
                    type={type}
                    value={form[key]}
                    onChange={set(key)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="flex-1 border border-slate-200 text-slate-600 rounded-xl py-3 text-sm font-medium hover:bg-slate-50">חזרה</button>
              <button
                onClick={() => setStep(3)}
                disabled={!form.partner1 || !form.partner2}
                className="flex-1 bg-violet-600 text-white rounded-xl py-3 text-sm font-medium hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                הבא
              </button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h2 className="font-danidin text-2xl text-slate-800 mb-1">הכל מוכן!</h2>
            <p className="text-slate-500 text-sm mb-6">האירוע ייווצר במצב טיוטה — Preview ועריכה זמינים מיד</p>
            <div className="bg-slate-50 rounded-xl p-4 text-sm space-y-2 text-slate-600 mb-6">
              <div><span className="font-medium">עיצוב:</span> {TEMPLATES.find(t => t.id === templateId)?.label}</div>
              <div><span className="font-medium">בני הזוג:</span> {form.partner1} & {form.partner2}</div>
              {form.date  && <div><span className="font-medium">תאריך:</span> {form.date}</div>}
              {form.venue && <div><span className="font-medium">אולם:</span>   {form.venue}</div>}
            </div>
            {error && <p className="text-rose-600 text-sm mb-4">{error}</p>}
            <div className="flex gap-3">
              <button onClick={() => setStep(2)} className="flex-1 border border-slate-200 text-slate-600 rounded-xl py-3 text-sm font-medium hover:bg-slate-50">חזרה</button>
              <button
                onClick={handleFinish}
                disabled={saving}
                className="flex-1 bg-violet-600 text-white rounded-xl py-3 text-sm font-medium hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? 'יוצר...' : 'צור אירוע'}
              </button>
            </div>
          </>
        )}

        {step === 4 && createdSlug && (
          <>
            {/* Success checkmark */}
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
                <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            <h2 className="font-danidin text-2xl text-slate-800 mb-1 text-center">האירוע נוצר בהצלחה!</h2>
            <p className="text-slate-500 text-sm mb-6 text-center">הנה הקישור לעמוד האירוע שלכם</p>

            {/* Live link card */}
            <div className="bg-violet-50 rounded-xl p-4 flex items-center justify-between gap-3 mb-6">
              <a
                href={`/${createdSlug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-violet-600 font-medium text-sm truncate flex-1 text-left"
                dir="ltr"
              >
                {window.location.origin}/{createdSlug}
              </a>
              <button
                onClick={handleCopy}
                className="shrink-0 text-violet-600 hover:text-violet-700 p-2 rounded-lg hover:bg-violet-100 transition-colors"
                title="העתק קישור"
              >
                {copied ? (
                  <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                  </svg>
                )}
              </button>
            </div>

            {/* Continue button */}
            <button
              onClick={() => navigate('/dashboard/settings', { replace: true })}
              className="w-full bg-violet-600 text-white rounded-xl py-3 text-sm font-medium hover:bg-violet-700 transition-colors"
            >
              המשיכו להגדרות
            </button>
          </>
        )}
      </div>
    </div>
  );
}
