import Logo from './Logo';

/**
 * Subtle "powered by Guesto" footer attribution for the public invite
 * templates. Links to the marketing landing page. Deliberately kept smaller
 * and dimmer than the studio credit it sits beneath — branded attribution,
 * not an ad. Assumes a dark footer (uses the white wordmark).
 */
export default function PoweredByGuesto({ className }: { className?: string }) {
  return (
    <a
      href="https://guesto.co.il"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Guesto — הזמנות לאירועים"
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.4rem',
        marginTop: '0.85rem',
        fontFamily: "'Polin', 'Heebo', sans-serif",
        fontSize: '0.68rem',
        letterSpacing: '0.02em',
        color: 'rgba(255, 255, 255, 0.42)',
        textDecoration: 'none',
      }}
    >
      <span>מופעל על ידי</span>
      <Logo variant="onDark" height={14} className="opacity-50" alt="Guesto" />
    </a>
  );
}
