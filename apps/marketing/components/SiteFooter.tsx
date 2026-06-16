import Logo from "./Logo";

/**
 * Unified site footer — Guesto logo + "by Moriz Studio".
 * Rendered once in the root layout, so it sits on every marketing page.
 *
 * This IS the Guesto landing site, so the Guesto logo is plain (no self-link);
 * only the Moriz Studio maker credit links out. Baseline alignment + hover/
 * focus styling live in globals.css (`.site-footer*`).
 */
export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div dir="ltr" className="site-footer__lockup">
        <Logo height={16} />
        <span className="site-footer__by">by</span>
        <a
          className="site-footer__maker"
          href="https://moriz.studio"
          target="_blank"
          rel="noopener noreferrer"
        >
          Moriz Studio
        </a>
      </div>
    </footer>
  );
}
