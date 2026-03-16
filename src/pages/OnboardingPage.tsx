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
  const [step, setStep]                 = useState<1 | 2 | 3>(1);
  const [templateId, setTemplateId]     = useState('elegant');
  const [form, setForm]                 = useState<FormState>({ partner1: '', partner2: '', date: '', venue: '' });
  const [saving, setSaving]             = useState(false);
  const [error, setError]               = useState('');

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }));

  const handleFinish = async () => {
    setSaving(true);
    setError('');
    try {
      const slug = generateSlug(form.partner1, form.partner2);
      await createOnboardingEvent({
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
      navigate('/dashboard/settings', { replace: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'שגיאה ביצירת האירוע');
      setSaving(false);
    }
  };

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 flex items-center justify-center font-brand p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-lg">

        {/* Progress bar */}
        <div className="flex gap-2 mb-8">
          {[1, 2, 3].map(n => (
            <div
              key={n}
              className={`h-1.5 flex-1 rounded-full transition-colors ${n <= step ? 'bg-violet-600' : 'bg-slate-200'}`}
            />
          ))}
        </div>

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
      </div>
    </div>
  );
}
