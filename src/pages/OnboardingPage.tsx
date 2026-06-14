import { ReactNode, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createOnboardingEvent, generateSlug } from '@/lib/supabase';
import {
  ONBOARDING_STEPS,
  ONBOARDING_TEMPLATES,
  OnboardingFormState,
  OnboardingTemplateOption,
  buildInviteUrl,
  buildOnboardingContentConfig,
  buildSlugPreview,
  getTemplateById,
} from './onboarding-model';

const initialForm: OnboardingFormState = {
  partner1: '',
  partner2: '',
  date: '',
  venue: '',
};

const cx = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ');

export default function OnboardingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [templateId, setTemplateId] = useState<OnboardingTemplateOption['id']>('wedding-modern');
  const [form, setForm] = useState<OnboardingFormState>(initialForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [createdSlug, setCreatedSlug] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const selectedTemplate = getTemplateById(templateId);
  const isDetailsReady = Boolean(form.partner1.trim() && form.partner2.trim());
  const inviteUrl = createdSlug ? buildInviteUrl(window.location.origin, createdSlug) : '';

  const draftSlug = useMemo(() => {
    if (!isDetailsReady) return 'your-invite';
    return buildSlugPreview(form.partner1, form.partner2);
  }, [form.partner1, form.partner2, isDetailsReady]);

  const set = (key: keyof OnboardingFormState) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(current => ({ ...current, [key]: e.target.value }));
  };

  const handleCopy = async () => {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
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
        contentConfig: buildOnboardingContentConfig(form),
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
    <div
      dir="rtl"
      className="min-h-screen font-brand text-[#2f251f]"
      style={{
        background:
          'radial-gradient(circle at 24% 15%, rgba(125, 58, 237, 0.16), transparent 26rem), radial-gradient(circle at 74% 8%, rgba(250, 203, 185, 0.55), transparent 24rem), linear-gradient(180deg, #fffaf2 0%, #f7efe4 54%, #f3eadc 100%)',
      }}
    >
      <TopBar />

      <main className="mx-auto w-full max-w-[1152px] px-4 py-7 sm:px-6 lg:px-8">
        <section className="mb-6 rounded-[18px] border border-[#e4d2bc] bg-[#fffdf8]/85 px-5 py-6 shadow-[0_18px_55px_rgba(80,47,22,0.08)] sm:px-8 lg:px-10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-bold text-[#b7646b]">פתיחת אירוע חדש</p>
              <h1 className="mt-1 font-danidin text-4xl leading-tight text-[#2f251f] sm:text-5xl">
                יצירת הזמנה חדשה
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#7f7064]">
                שלושה צעדים קצרים: בוחרים תבנית, מכניסים פרטים בסיסיים, וממשיכים לעריכת ההזמנה.
              </p>
            </div>
            <div className="w-fit rounded-full border border-[#e1ceb7] bg-[#fff9ef] px-4 py-2 text-sm font-bold text-[#7f7064]">
              חינם להתחלה
            </div>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="rounded-[18px] border border-[#e4d2bc] bg-[#fffdf8]/92 shadow-[0_16px_45px_rgba(80,47,22,0.07)]">
            <div className="border-b border-[#eadcca] px-4 py-4 sm:px-6">
              <div className="inline-flex flex-wrap gap-2 rounded-[16px] border border-[#e4d2bc] bg-[#fff9ef] p-1">
                {ONBOARDING_STEPS.map(item => {
                  const active = item.id === step;
                  const done = step > item.id || step === 4;
                  return (
                    <div
                      key={item.id}
                      className={cx(
                        'inline-flex items-center gap-2 rounded-[12px] px-3 py-2 text-sm font-bold transition-colors',
                        active && 'bg-[#7c3aed] text-white shadow-[0_8px_18px_rgba(124,58,237,0.24)]',
                        done && !active && 'bg-[#edf8ee] text-[#4e6b38]',
                        !active && !done && 'text-[#897869]',
                      )}
                    >
                      <span
                        className={cx(
                          'grid h-5 w-5 place-items-center rounded-full text-[11px]',
                          active && 'bg-white/18 text-white',
                          done && !active && 'bg-[#d7e7cd] text-[#4e6b38]',
                          !active && !done && 'bg-white text-[#897869]',
                        )}
                      >
                        {done ? '✓' : item.id}
                      </span>
                      {item.label}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="px-4 py-6 sm:px-6 lg:px-8">
              {step === 1 && (
                <div className="space-y-6">
                  <StepHeader
                    eyebrow="שלב 1 מתוך 3"
                    title="בחרו תבנית התחלתית"
                    description="הבחירה קובעת את נקודת הפתיחה של ההזמנה. את הטקסטים, התאריך והאולם אפשר לדייק בהגדרות מיד אחרי היצירה."
                  />

                  <div className="grid gap-3 md:grid-cols-3">
                    {ONBOARDING_TEMPLATES.map(template => {
                      const selected = template.id === templateId;
                      return (
                        <button
                          key={template.id}
                          type="button"
                          onClick={() => setTemplateId(template.id)}
                          aria-pressed={selected}
                          className={cx(
                            'rounded-[16px] border p-3 text-right transition focus:outline-none focus:ring-2 focus:ring-[#7c3aed] focus:ring-offset-2 focus:ring-offset-[#fffdf8]',
                            selected
                              ? 'border-[#7c3aed] bg-[#f4edff] shadow-[0_12px_28px_rgba(124,58,237,0.13)]'
                              : 'border-[#e4d2bc] bg-[#fffaf3] hover:border-[#cdb89d] hover:bg-white',
                          )}
                        >
                          <div
                            className={cx(
                              'mb-4 h-28 overflow-hidden rounded-[12px] bg-gradient-to-br p-3',
                              template.preview.bg,
                            )}
                          >
                            <div className="flex h-full flex-col justify-between rounded-[10px] border border-white/60 bg-[#fffdf8]/82 p-3 shadow-sm">
                              <div className={cx('h-2 w-12 rounded-full', template.preview.accent)} />
                              <div>
                                <div className="font-danidin text-2xl text-[#2f251f]">{template.preview.title}</div>
                                <div className="mt-1 h-1.5 w-20 rounded-full bg-[#e8d8c3]" />
                              </div>
                            </div>
                          </div>

                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-base font-bold text-[#2f251f]">{template.label}</div>
                              <div className="mt-1 text-sm text-[#7f7064]">{template.desc}</div>
                            </div>
                            <span
                              className={cx(
                                'mt-1 grid h-5 w-5 place-items-center rounded-full border text-xs',
                                selected ? 'border-[#7c3aed] bg-[#7c3aed] text-white' : 'border-[#d8c5ad] text-transparent',
                              )}
                            >
                              ✓
                            </span>
                          </div>
                          <p className="mt-3 text-xs leading-5 text-[#9a8a7a]">{template.tone}</p>
                        </button>
                      );
                    })}
                  </div>

                  <Actions>
                    <PrimaryButton onClick={() => setStep(2)}>המשך לפרטי האירוע</PrimaryButton>
                  </Actions>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-6">
                  <StepHeader
                    eyebrow="שלב 2 מתוך 3"
                    title="הפרטים שפותחים את הטיוטה"
                    description="שמות בני הזוג הם השדה היחיד שחובה למלא. תאריך ואולם יעזרו להזמנה להיראות מוכנה כבר במסך הבא."
                  />

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field
                      label="שם בן/בת זוג 1"
                      value={form.partner1}
                      onChange={set('partner1')}
                      placeholder="לדוגמה: אייל"
                      autoComplete="given-name"
                    />
                    <Field
                      label="שם בן/בת זוג 2"
                      value={form.partner2}
                      onChange={set('partner2')}
                      placeholder="לדוגמה: מור"
                      autoComplete="given-name"
                    />
                    <Field
                      label="תאריך האירוע"
                      type="date"
                      value={form.date}
                      onChange={set('date')}
                    />
                    <Field
                      label="שם האולם"
                      value={form.venue}
                      onChange={set('venue')}
                      placeholder="לדוגמה: בית על הים"
                    />
                  </div>

                  <p className="rounded-[14px] border border-[#ecdcc3] bg-[#fff8e6] px-4 py-3 text-sm leading-6 text-[#8a541c]">
                    אחרי היצירה עוברים להגדרות, עורכים את תוכן ההזמנה ומתחילים לנהל אישורי הגעה.
                  </p>

                  <Actions>
                    <SecondaryButton onClick={() => setStep(1)}>חזרה</SecondaryButton>
                    <PrimaryButton onClick={() => setStep(3)} disabled={!isDetailsReady}>
                      בדיקה אחרונה
                    </PrimaryButton>
                  </Actions>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-6">
                  <StepHeader
                    eyebrow="שלב 3 מתוך 3"
                    title="בדיקה אחרונה לפני יצירה"
                    description="הפעולה תיצור אירוע חדש ותפתח קישור להזמנה. שום דבר עדיין לא נשלח לאורחים."
                  />

                  <dl className="overflow-hidden rounded-[16px] border border-[#e4d2bc] bg-[#fffaf3]">
                    <ReviewRow label="עיצוב" value={selectedTemplate.label} />
                    <ReviewRow label="בני הזוג" value={`${form.partner1} & ${form.partner2}`} />
                    <ReviewRow label="תאריך" value={form.date || 'אפשר להוסיף אחר כך'} muted={!form.date} />
                    <ReviewRow label="אולם" value={form.venue || 'אפשר להוסיף אחר כך'} muted={!form.venue} />
                    <ReviewRow label="תבנית קישור" value={`${window.location.origin}/${draftSlug}-xxxxxx`} ltr />
                  </dl>

                  {error && (
                    <div className="rounded-[14px] border border-[#efc7c0] bg-[#fff0ee] px-4 py-3 text-sm text-[#a84737]">
                      {error}
                    </div>
                  )}

                  <Actions>
                    <SecondaryButton onClick={() => setStep(2)} disabled={saving}>חזרה</SecondaryButton>
                    <PrimaryButton onClick={handleFinish} disabled={saving}>
                      {saving ? 'יוצר אירוע...' : 'צור אירוע'}
                    </PrimaryButton>
                  </Actions>
                </div>
              )}

              {step === 4 && createdSlug && (
                <div className="mx-auto max-w-xl space-y-6 text-center">
                  <div className="mx-auto grid h-16 w-16 place-items-center rounded-[18px] bg-[#e7f5df] text-2xl font-bold text-[#2f8b64]">
                    ✓
                  </div>
                  <StepHeader
                    title="האירוע נוצר בהצלחה"
                    description="זה הקישור להזמנה. אפשר לפתוח אותו עכשיו או להמשיך להגדרות כדי לדייק את התוכן לפני שליחה."
                    centered
                  />

                  <div className="flex items-center gap-2 rounded-[16px] border border-[#ddc8af] bg-[#fff8ef] p-2">
                    <a
                      href={`/${createdSlug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-w-0 flex-1 truncate rounded-[12px] bg-white px-3 py-3 text-left text-sm font-bold text-[#7c3aed] hover:no-underline"
                      dir="ltr"
                    >
                      {inviteUrl}
                    </a>
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="shrink-0 rounded-[12px] px-3 py-3 text-sm font-bold text-[#7c3aed] transition hover:bg-[#f4edff] focus:outline-none focus:ring-2 focus:ring-[#7c3aed]"
                      title="העתק קישור"
                    >
                      {copied ? 'הועתק' : 'העתק'}
                    </button>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <SecondaryButton onClick={() => window.open(`/${createdSlug}`, '_blank', 'noopener,noreferrer')}>
                      פתחו את ההזמנה
                    </SecondaryButton>
                    <PrimaryButton onClick={() => navigate('/dashboard/settings', { replace: true })}>
                      המשיכו להגדרות
                    </PrimaryButton>
                  </div>
                </div>
              )}
            </div>
          </section>

          <aside className="rounded-[18px] border border-[#e4d2bc] bg-[#fffdf8]/88 p-4 shadow-[0_16px_45px_rgba(80,47,22,0.07)]">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-[#b7646b]">תצוגה מקדימה</p>
                <h2 className="font-danidin text-3xl text-[#2f251f]">מה ייווצר עכשיו</h2>
              </div>
              <span className="rounded-full border border-[#e4d2bc] bg-[#fff9ef] px-3 py-1 text-xs font-bold text-[#8d7867]">
                טיוטה
              </span>
            </div>

            <div className="rounded-[18px] border border-[#ddc8af] bg-[#fff8ef] p-3">
              <div className={cx('rounded-[14px] bg-gradient-to-br p-4', selectedTemplate.preview.bg)}>
                <div className="rounded-[16px] border border-white/60 bg-[#fffdf8]/86 p-5 text-center shadow-[0_18px_35px_rgba(60,37,20,0.12)]">
                  <div className={cx('mx-auto mb-5 h-2 w-16 rounded-full', selectedTemplate.preview.accent)} />
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#9a8a7a]">Wedding invite</p>
                  <div className="mt-3 font-danidin text-4xl leading-none text-[#2f251f]">
                    {form.partner1 || 'שם'} & {form.partner2 || 'שם'}
                  </div>
                  <div className="mx-auto mt-5 h-px w-20 bg-[#ddc8af]" />
                  <div className="mt-5 space-y-2 text-sm text-[#7f7064]">
                    <p>{form.date || 'תאריך האירוע'}</p>
                    <p>{form.venue || 'שם האולם'}</p>
                  </div>
                </div>
              </div>
            </div>

            <dl className="mt-5 space-y-3 text-sm">
              <SummaryItem label="עיצוב" value={selectedTemplate.label} />
              <SummaryItem label="קישור" value={`${window.location.origin}/${createdSlug ?? draftSlug}`} ltr />
              <SummaryItem label="אחרי היצירה" value="הגדרות, עריכת תוכן, שיתוף בווטסאפ" />
            </dl>
          </aside>
        </div>
      </main>
    </div>
  );
}

function TopBar() {
  return (
    <header className="sticky top-0 z-30 border-b border-[#e5d4bf] bg-[#fff9ef]/88 backdrop-blur-md">
      <div className="mx-auto flex h-[60px] w-full max-w-[1880px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="grid h-9 w-9 place-items-center rounded-[10px] border border-[#ddc8af] bg-[#fffdf8] text-[#2f251f] shadow-sm"
            aria-label="התראות"
          >
            <span className="text-base leading-none">⌂</span>
          </button>
          <button
            type="button"
            className="rounded-[12px] border border-[#ddc8af] bg-[#fffdf8] px-4 py-2 text-sm font-bold text-[#7f7064] shadow-sm"
          >
            יצירה חדשה
          </button>
        </div>

        <div className="flex items-center gap-3">
          <nav className="hidden rounded-[16px] border border-[#ddc8af] bg-[#fffdf8] p-1 sm:flex">
            <span className="rounded-[12px] bg-[#7c3aed] px-4 py-2 text-sm font-bold text-white">יצירה</span>
            <span className="px-4 py-2 text-sm font-bold text-[#7f7064]">הגדרות</span>
            <span className="px-4 py-2 text-sm font-bold text-[#7f7064]">אורחים</span>
          </nav>
          <div className="flex items-center gap-1 text-xl font-bold text-[#2f251f]">
            <span>Guesto</span>
            <span className="h-2 w-2 rounded-full bg-[#b7646b]" />
          </div>
        </div>
      </div>
    </header>
  );
}

function StepHeader({
  eyebrow,
  title,
  description,
  centered = false,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  centered?: boolean;
}) {
  return (
    <div className={cx('max-w-2xl', centered && 'mx-auto text-center')}>
      {eyebrow && <p className="mb-2 text-sm font-bold text-[#b7646b]">{eyebrow}</p>}
      <h2 className="font-danidin text-3xl leading-tight text-[#2f251f] sm:text-4xl">{title}</h2>
      <p className="mt-3 text-base leading-7 text-[#7f7064]">{description}</p>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-[#5f5146]">{label}</span>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="w-full rounded-[14px] border border-[#ddc8af] bg-[#fffaf3] px-3 py-3 text-base text-[#2f251f] transition placeholder:text-[#a89887] focus:border-[#7c3aed] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#eadfff]"
      />
    </label>
  );
}

function Actions({ children }: { children: ReactNode }) {
  return <div className="flex flex-col-reverse gap-3 border-t border-[#eadcca] pt-5 sm:flex-row">{children}</div>;
}

function PrimaryButton({
  children,
  onClick,
  disabled = false,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex-1 rounded-[14px] bg-[#7c3aed] px-5 py-3 text-sm font-bold text-white shadow-[0_10px_24px_rgba(124,58,237,0.22)] transition hover:bg-[#6d28d9] focus:outline-none focus:ring-2 focus:ring-[#7c3aed] focus:ring-offset-2 focus:ring-offset-[#fffdf8] disabled:cursor-not-allowed disabled:bg-[#d5c7b6] disabled:shadow-none"
    >
      {children}
    </button>
  );
}

function SecondaryButton({
  children,
  onClick,
  disabled = false,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex-1 rounded-[14px] border border-[#2f251f] bg-[#fffdf8] px-5 py-3 text-sm font-bold text-[#2f251f] transition hover:bg-[#fff7ea] focus:outline-none focus:ring-2 focus:ring-[#7c3aed] focus:ring-offset-2 focus:ring-offset-[#fffdf8] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function ReviewRow({ label, value, muted = false, ltr = false }: { label: string; value: string; muted?: boolean; ltr?: boolean }) {
  return (
    <div className="grid gap-1 border-b border-[#eadcca] px-4 py-3 last:border-b-0 sm:grid-cols-[140px_1fr]">
      <dt className="text-sm font-bold text-[#8c7b6b]">{label}</dt>
      <dd className={cx('text-sm font-bold text-[#2f251f]', muted && 'font-medium text-[#9a8a7a]', ltr && 'text-left')} dir={ltr ? 'ltr' : 'rtl'}>
        {value}
      </dd>
    </div>
  );
}

function SummaryItem({ label, value, ltr = false }: { label: string; value: string; ltr?: boolean }) {
  return (
    <div className="rounded-[14px] border border-[#e4d2bc] bg-[#fff9ef] px-3 py-3">
      <dt className="text-xs font-bold text-[#9a8a7a]">{label}</dt>
      <dd className="mt-1 truncate text-sm font-bold text-[#2f251f]" dir={ltr ? 'ltr' : 'rtl'}>
        {value}
      </dd>
    </div>
  );
}
