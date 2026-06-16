import Logo from './Logo';

/**
 * Unified site footer — Guesto logo + "by Moriz Studio".
 *
 * Shown on the product chrome screens (login, onboarding, dashboard). The
 * Guesto wordmark (logo image) links to the marketing site; the Moriz Studio
 * credit links to the studio. Guest-facing invite templates keep their own
 * warmer footer.
 *
 * Baseline alignment: the logo's GUESTO letters sit on the "by Moriz Studio"
 * text baseline (the hat floats above), so the lockup reads level. Hover:
 * subtle lift + focus-visible violet ring.
 */
export default function SiteFooter({
  variant = 'onLight',
  className = '',
}: {
  variant?: 'onLight' | 'onDark';
  className?: string;
}) {
  const isDark = variant === 'onDark';

  // Violet focus ring via arbitrary oklch — the `rose-gold` token has no
  // <alpha-value> slot, so `/45` opacity modifiers won't resolve.
  const ring =
    'rounded-sm focus-visible:outline-none focus-visible:ring-2 ' +
    'focus-visible:ring-[oklch(0.52_0.22_292_/_0.45)]';

  return (
    <footer
      className={`border-t border-solid border-line py-6 text-center font-brand ${className}`}
    >
      <div
        dir="ltr"
        className={`flex items-baseline justify-center gap-2 text-xs ${
          isDark ? 'text-white/55' : 'text-ink-mute'
        }`}
      >
        <a
          href="https://guesto.co.il"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Guesto"
          className={`relative top-[1px] inline-flex transition-transform duration-200 hover:-translate-y-px ${ring}`}
        >
          <Logo variant={variant} height={16} />
        </a>
        <span className={`text-[11px] ${isDark ? 'text-white/45' : 'text-ink-mute'}`}>by</span>
        <a
          href="https://moriz.studio"
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-block font-semibold transition-all duration-200 hover:-translate-y-px hover:underline hover:underline-offset-4 ${ring} ${
            isDark ? 'text-white/75 hover:text-white' : 'text-ink-soft hover:text-ink'
          }`}
        >
          Moriz Studio
        </a>
      </div>
    </footer>
  );
}
