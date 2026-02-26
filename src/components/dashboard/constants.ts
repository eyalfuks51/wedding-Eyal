// Shared constants for all dashboard views (guest table + automation timeline)

export const CANONICAL_STAGES = [
  'icebreaker',
  'nudge',
  'ultimatum',
  'logistics',
  'hangover',
] as const;

export const DYNAMIC_NUDGE_NAMES = ['nudge_1', 'nudge_2', 'nudge_3'] as const;

export const ALL_STAGE_NAMES = [...CANONICAL_STAGES, ...DYNAMIC_NUDGE_NAMES] as const;

export type StageName = (typeof ALL_STAGE_NAMES)[number];

/** @deprecated Use CANONICAL_STAGES or ALL_STAGE_NAMES instead */
export const STAGE_NAMES = CANONICAL_STAGES;

export const STAGE_META: Record<StageName, {
  label: string;
  targetStatus: string;
  defaultDaysBefore: number;
  icon: string; // Lucide icon name hint
}> = {
  icebreaker: { label: 'שליחת ההזמנה',      targetStatus: 'pending',   defaultDaysBefore: 14, icon: 'Sparkles'      },
  nudge:      { label: 'תזכורת ראשונה',     targetStatus: 'pending',   defaultDaysBefore: 7,  icon: 'Bell'          },
  nudge_1:    { label: 'תזכורת עדינה 2',    targetStatus: 'pending',   defaultDaysBefore: 5,  icon: 'Bell'          },
  nudge_2:    { label: 'תזכורת עדינה 3',    targetStatus: 'pending',   defaultDaysBefore: 4,  icon: 'Bell'          },
  nudge_3:    { label: 'תזכורת עדינה 4',    targetStatus: 'pending',   defaultDaysBefore: 3,  icon: 'Bell'          },
  ultimatum:  { label: 'בקשת אישור סופית',  targetStatus: 'pending',   defaultDaysBefore: 3,  icon: 'AlertTriangle' },
  logistics:  { label: 'הודעת "מחכים לכם"', targetStatus: 'attending', defaultDaysBefore: 1,  icon: 'MapPin'        },
  hangover:   { label: 'תודה לאחר האירוע',  targetStatus: 'attending', defaultDaysBefore: -1, icon: 'Heart'         },
};

/** Human-readable labels for template types — used in SendModal and Timeline */
export const TEMPLATE_LABELS: Record<string, string> = Object.fromEntries(
  ALL_STAGE_NAMES.map(s => [s, STAGE_META[s].label])
);

export const MSG_STATUS_MAP = {
  pending: { label: 'ממתין בתור', classes: 'bg-amber-100 text-amber-700 border-amber-200' },
  sent:    { label: 'נשלח',       classes: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  failed:  { label: 'נכשל',       classes: 'bg-rose-100 text-rose-700 border-rose-200' },
  none:    { label: 'טרם נשלח',   classes: 'bg-slate-100 text-slate-500 border-slate-200' },
} as const;
