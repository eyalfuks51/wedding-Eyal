// Shared constants for all dashboard views (guest table + automation timeline)

export const STAGE_NAMES = [
  'icebreaker',
  'nudge',
  'ultimatum',
  'logistics',
  'hangover',
] as const;

export type StageName = (typeof STAGE_NAMES)[number];

export const STAGE_META: Record<StageName, {
  label: string;
  targetStatus: string;
  defaultDaysBefore: number;
  icon: string; // Lucide icon name hint
}> = {
  icebreaker: { label: 'פתיחה ראשונית',     targetStatus: 'pending',   defaultDaysBefore: 14, icon: 'Sparkles'      },
  nudge:      { label: 'תזכורת עדינה',       targetStatus: 'pending',   defaultDaysBefore: 7,  icon: 'Bell'          },
  ultimatum:  { label: 'תזכורת אחרונה',      targetStatus: 'pending',   defaultDaysBefore: 3,  icon: 'AlertTriangle' },
  logistics:  { label: 'מידע לוגיסטי',       targetStatus: 'attending', defaultDaysBefore: 1,  icon: 'MapPin'        },
  hangover:   { label: 'תודה לאחר האירוע',   targetStatus: 'attending', defaultDaysBefore: -1, icon: 'Heart'         },
};

/** Human-readable labels for template types — used in SendModal and Timeline */
export const TEMPLATE_LABELS: Record<string, string> = Object.fromEntries(
  STAGE_NAMES.map(s => [s, STAGE_META[s].label])
);

export const MSG_STATUS_MAP = {
  pending: { label: 'ממתין בתור', classes: 'bg-amber-100 text-amber-700 border-amber-200' },
  sent:    { label: 'נשלח',       classes: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  failed:  { label: 'נכשל',       classes: 'bg-rose-100 text-rose-700 border-rose-200' },
  none:    { label: 'טרם נשלח',   classes: 'bg-slate-100 text-slate-500 border-slate-200' },
} as const;
