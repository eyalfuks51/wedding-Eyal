export interface OnboardingFormState {
  partner1: string;
  partner2: string;
  date: string;
  venue: string;
}

export interface OnboardingTemplateOption {
  id: 'wedding-modern' | 'elegant' | 'wedding-default';
  label: string;
  desc: string;
  tone: string;
  preview: {
    bg: string;
    accent: string;
    title: string;
  };
}

export const ONBOARDING_TEMPLATES: OnboardingTemplateOption[] = [
  {
    id: 'wedding-modern',
    label: 'Modern',
    desc: 'נקי, רך וממוקד מובייל',
    tone: 'הבחירה הכי קרובה לשפה החדשה של Guesto',
    preview: {
      bg: 'from-stone-100 to-violet-50',
      accent: 'bg-violet-500',
      title: 'Modern',
    },
  },
  {
    id: 'elegant',
    label: 'Elegant',
    desc: 'נייבי כהה + זהב, מינימליסטי',
    tone: 'מתאים לזוג שרוצה הזמנה דרמטית ושקטה',
    preview: {
      bg: 'from-slate-900 to-slate-700',
      accent: 'bg-amber-300',
      title: 'Elegant',
    },
  },
  {
    id: 'wedding-default',
    label: 'Classic',
    desc: 'בורדו/קרם, פרחים דקורטיביים',
    tone: 'תחושה חמה וקלאסית יותר',
    preview: {
      bg: 'from-rose-50 to-orange-50',
      accent: 'bg-rose-700',
      title: 'Classic',
    },
  },
];

export const ONBOARDING_STEPS = [
  { id: 1, label: 'עיצוב', title: 'בחרו את נקודת הפתיחה' },
  { id: 2, label: 'פרטים', title: 'הכניסו את פרטי האירוע' },
  { id: 3, label: 'יצירה', title: 'בדיקה אחרונה לפני יצירה' },
] as const;

export function buildOnboardingContentConfig(form: OnboardingFormState) {
  return {
    couple_names: `${form.partner1} & ${form.partner2}`,
    date_display: form.date,
    venue_name: form.venue,
  };
}

export function buildInviteUrl(origin: string, slug: string) {
  return `${origin.replace(/\/$/, '')}/${slug}`;
}

export function buildSlugPreview(partner1: string, partner2: string) {
  const base = `${partner1}-and-${partner2}`
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\u0590-\u05ff-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);

  return base || 'your-invite';
}

export function getTemplateById(templateId: OnboardingTemplateOption['id']) {
  return ONBOARDING_TEMPLATES.find(template => template.id === templateId) ?? ONBOARDING_TEMPLATES[0];
}
