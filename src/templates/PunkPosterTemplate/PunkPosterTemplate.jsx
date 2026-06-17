/**
 * PunkPosterTemplate — "Punk indie-rock gig poster"
 *
 * Smart Adaptation of a DIY screen-print gig poster (B&W grainy guitarist +
 * hot-pink chevrons + chunky stacked hand-lettering) → Hebrew wedding:
 *   • B&W performer photo (center focal)        → couple_names as the chevron-framed
 *                                                  "headliner" (CSS-only, no photo)
 *   • "BEA BA DOO BEE!" chunky stacked lettering → couple_names: huge stacked Danidin,
 *                                                  per-line wobble + screen-print sticker shadow
 *   • Hot-pink angular chevron arrows flanking   → flank the names (clip-path shapes, decor)
 *   • 4-point sparkle stars in corners           → corner accents (decor)
 *   • Concert "tour date" text                   → date_display / day_of_week / venue
 *   • Tiny catalog/SKU corner mark               → date_hebrew tiny corner (Manhattan)
 *
 * HARDCODED (this template's aesthetic):
 *   • Palette: ink / hot-pink / warm-white — strictly three colours (OKLCH-tuned)
 *   • Screen-print grain overlay (inline SVG turbulence, CSS-only)
 *   • Type: Danidin (Hebrew headliner + labels), Futurism-Black (numerals),
 *           Polin (Hebrew body), Manhattan (Latin micro-labels)
 *   • CSS-only decor (no image assets), GSAP stamp/slide entrances + ambient twinkle
 *   • Directions = the one pink-drenched inverse block (poster's lower lettering band)
 *
 * FROM content_config (text/data only — IDENTICAL keys to every other template):
 *   • couple_names, quote, invitation_text
 *   • date_display, date_hebrew, day_of_week
 *   • venue_name, venue_address, venue_address_full, venue_maps_query
 *   • schedule[].time, .label, .icon  →  maps to hardcoded SVG imports below
 *   • footer_note, closing_message
 *   • train_line, train_station, train_walk_minutes, parking_lot, parking_walk_minutes
 */

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import RsvpForm from '../../components/RsvpForm/RsvpForm';
import Logo from '../../white_logo.png';
import PoweredByGuesto from '../../components/brand/PoweredByGuesto';
import './PunkPosterTemplate.scss';

import danceSVG from '../../timeline/dance.svg';
import marrySVG from '../../timeline/marry.svg';
import foodSVG from '../../timeline/food.svg';

const ICONS = { food: foodSVG, marry: marrySVG, dance: danceSVG };

// ── Chevron — hot-pink angular arrow, the poster's framing device. ──────────
// clip-path polygon (NOT a border) so it stays a real shape on any size.
// `bars` controls the stack height — hero runs a fat 4-stack like the print
// reference; setlist rows stay the default thin 3.
function Chevron({ className = '', bars = 3 }) {
  return (
    <span className={`pk__chev ${className}`} aria-hidden="true">
      {Array.from({ length: bars }, (_, i) => (
        <span key={i} className="pk__chev-bar" />
      ))}
    </span>
  );
}

// ── Star — 4-point punk sparkle, inline SVG, decor only. ────────────────────
function Star({ className = '' }) {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`pk__star ${className}`}
      aria-hidden="true"
    >
      <path
        d="M20 0 C21.5 12.5 27.5 18.5 40 20 C27.5 21.5 21.5 27.5 20 40 C18.5 27.5 12.5 21.5 0 20 C12.5 18.5 18.5 12.5 20 0 Z"
        fill="currentColor"
      />
    </svg>
  );
}

// ── Guitar — Flying-V electric, line-art screen-print. The gig poster's
// performer focal, recast as decor: sits BEHIND the headliner, never competes
// with names/date/venue/CTA. Angular body echoes the chevron language. ───────
function Guitar() {
  return (
    <span className="pk__guitar" aria-hidden="true">
      <svg
        className="pk__guitar-svg"
        viewBox="0 0 140 240"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <g fill="currentColor" stroke="none">
          <polygon points="52,6 86,12 84,40 54,34" />
          <circle cx="49" cy="15" r="2.6" />
          <circle cx="47" cy="25" r="2.6" />
          <circle cx="45" cy="35" r="2.6" />
          <rect x="61" y="158" width="18" height="9" />
          <rect x="60" y="173" width="20" height="9" />
        </g>
        <g
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        >
          <path d="M60 38 L60 150 M78 38 L78 150" />
          <path d="M58 150 L12 230 L70 198 L128 230 L80 150 Z" />
          <path d="M60 56 H78 M60 74 H78 M60 92 H78 M60 110 H78 M60 128 H78 M60 146 H78" />
          <path d="M63 40 V162 M67 40 V164 M71 40 V164 M75 40 V162" />
        </g>
      </svg>
    </span>
  );
}

function PunkPosterTemplate({ event, config = {} }) {
  const wrapperRef = useRef(null);

  const schedule = config.schedule ?? [];
  const mapsUrl  = config.venue_address_full
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(config.venue_address_full)}`
    : '#';

  // Split couple_names on explicit separators only (& / + / Hebrew " ו ")
  // into stacked "headliner" lines. Never split on bare spaces — Hebrew names
  // contain them. Falls back to a single line.
  const nameLines = (config.couple_names ?? '')
    .split(/\s*[&+]\s*|\s+ו\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const ctx = gsap.context(() => {
      const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

      // ── Names: screen-print "stamp" in — scale down + fade, line stagger ──
      gsap.fromTo('.pk__name-line',
        { scale: 1.08, opacity: 0, y: 18 },
        { scale: 1, opacity: 1, y: 0, duration: 0.85, ease: 'expo.out', stagger: 0.12, delay: 0.15 }
      );

      // ── Chevrons slam in from the sides ──
      gsap.fromTo('.pk__chev--left',
        { x: -50, opacity: 0 },
        { x: 0, opacity: 1, duration: 0.7, ease: 'power4.out', delay: 0.45 }
      );
      gsap.fromTo('.pk__chev--right',
        { x: 50, opacity: 0 },
        { x: 0, opacity: 1, duration: 0.7, ease: 'power4.out', delay: 0.45 }
      );

      // ── Guitar: stamp in, rotated, settles at its resting tilt ──
      gsap.set('.pk__guitar-svg', { transformOrigin: '50% 85%' });
      gsap.fromTo('.pk__guitar-svg',
        { opacity: 0, scale: 0.82, rotate: -30 },
        { opacity: 1, scale: 1, rotate: -16, duration: 1.1, ease: 'expo.out', delay: 0.55 }
      );

      // ── Hero meta (date / venue / cta) fade-up ──
      gsap.fromTo('.pk__hero-meta > *',
        { y: 22, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.7, ease: 'power3.out', stagger: 0.1, delay: 0.7 }
      );

      // ── Stars pop in ──
      gsap.fromTo('.pk__star',
        { scale: 0, opacity: 0, rotate: -45 },
        { scale: 1, opacity: 1, rotate: 0, duration: 0.6, ease: 'back.out(2)', stagger: 0.08, delay: 0.9 }
      );

      if (!reduce) {
        // ── Ambient star twinkle ──
        gsap.to('.pk__star', {
          opacity: 0.45,
          duration: 1.1,
          ease: 'sine.inOut',
          yoyo: true,
          repeat: -1,
          stagger: { each: 0.5, from: 'random' },
          delay: 1.6,
        });

        // ── Ambient guitar sway — rocks around its resting tilt ──
        gsap.to('.pk__guitar-svg', {
          rotate: -11,
          duration: 2.6,
          ease: 'sine.inOut',
          yoyo: true,
          repeat: -1,
          delay: 1.7,
        });
      }

      // ── Hero decor parallax out ──
      gsap.to('.pk__hero-decor', {
        y: -40,
        ease: 'none',
        scrollTrigger: { trigger: '.pk__hero', start: 'top top', end: 'bottom top', scrub: 1.4 },
      });

      // ── Schedule (setlist) rows stagger on scroll ──
      gsap.fromTo('.pk__set-row',
        { x: -28, opacity: 0 },
        {
          x: 0, opacity: 1, duration: 0.6, ease: 'power3.out', stagger: 0.12,
          scrollTrigger: { trigger: '.pk__setlist', start: 'top 80%', once: true },
        }
      );

      // ── Generic scroll-reveal ──
      gsap.utils.toArray('.pk__reveal').forEach((el) => {
        gsap.fromTo(el,
          { y: 24, opacity: 0 },
          {
            y: 0, opacity: 1, duration: 0.7, ease: 'power3.out',
            scrollTrigger: { trigger: el, start: 'top 88%', once: true },
          }
        );
      });

    }, wrapperRef);

    return () => ctx.revert();
  }, []);

  return (
    <div className="pk" ref={wrapperRef}>

      {/* Screen-print grain — fixed full-page overlay, CSS-only, decor */}
      <div className="pk__grain" aria-hidden="true" />

      {/* ════════════════════════════════════════
          HERO  (names · date · venue · RSVP entry — all first screenful)
      ════════════════════════════════════════ */}
      <section className="pk__hero">

        {/* Torn aged-paper poster border (CSS-only, displacement-chewed edge) */}
        <div className="pk__poster-frame" aria-hidden="true" />
        <span className="pk__tape pk__tape--tl" aria-hidden="true" />
        <span className="pk__tape pk__tape--tr" aria-hidden="true" />

        {/* Corner sparkle stars */}
        <Star className="pk__star--tl" />
        <Star className="pk__star--tr" />
        <Star className="pk__star--bl" />

        {/* Tiny Latin catalog mark (re-mapped SKU corner) */}
        {config.date_hebrew && (
          <span className="pk__catalog">{config.date_hebrew}</span>
        )}

        {/* Flying-V guitar — decorative focal behind the headliner */}
        <Guitar />

        <div className="pk__hero-decor">
          {/* Pink chevron arrows flank the headliner */}
          <Chevron className="pk__chev--left" bars={4} />

          {nameLines.length > 0 && (
            <h1 className="pk__names">
              {nameLines.map((line, i) => (
                <span
                  key={i}
                  className={`pk__name-line pk__name-line--${i % 2 === 0 ? 'a' : 'b'}`}
                >
                  {line}
                </span>
              ))}
            </h1>
          )}

          <Chevron className="pk__chev--right" bars={4} />
        </div>

        <div className="pk__hero-meta">
          {(config.day_of_week || config.date_display) && (
            <p className="pk__tourdate">
              {config.day_of_week && <span className="pk__dow">{config.day_of_week}</span>}
              {config.date_display && <span className="pk__date">{config.date_display}</span>}
            </p>
          )}

          {config.venue_name && (
            <p className="pk__venue">
              {config.venue_name}
              {config.venue_address && <span className="pk__venue-city">{config.venue_address}</span>}
            </p>
          )}

          <a href="#pk-rsvp" className="pk__cta">אישור הגעה</a>
        </div>
      </section>

      {/* ════════════════════════════════════════
          QUOTE / INVITATION  (liner-notes band)
      ════════════════════════════════════════ */}
      {(config.quote || config.invitation_text) && (
        <section className="pk__liner">
          {config.quote && (
            <p className="pk__quote pk__reveal">
              <span className="pk__quote-mark" aria-hidden="true">“</span>
              {config.quote}
            </p>
          )}
          {config.invitation_text && (
            <p className="pk__invitation pk__reveal">{config.invitation_text}</p>
          )}
        </section>
      )}

      {/* ════════════════════════════════════════
          SCHEDULE (setlist) + CLOSING
      ════════════════════════════════════════ */}
      {(schedule.length > 0 || config.footer_note || config.closing_message) && (
        <section className="pk__setlist-section">
          <div className="pk__setlist-inner">

            {schedule.length > 0 && (
              <>
                <h2 className="pk__section-label pk__reveal">לוח הערב</h2>
                <ol className="pk__setlist">
                  {schedule.map((item, i) => (
                    <li key={item.time ?? i} className="pk__set-row">
                      <Chevron className="pk__set-chev" />
                      {item.time && <span className="pk__set-time">{item.time}</span>}
                      {ICONS[item.icon] && (
                        <img src={ICONS[item.icon]} alt="" className="pk__set-icon" />
                      )}
                      {item.label && <span className="pk__set-label">{item.label}</span>}
                    </li>
                  ))}
                </ol>
              </>
            )}

            {(config.footer_note || config.closing_message) && (
              <div className="pk__closing-block pk__reveal">
                <Star className="pk__closing-star" />
                {config.footer_note && (
                  <p className="pk__footer-note">{config.footer_note}</p>
                )}
                {config.closing_message && (
                  <p className="pk__closing">{config.closing_message}</p>
                )}
              </div>
            )}

          </div>
        </section>
      )}

      {/* ════════════════════════════════════════
          RSVP  (ticket-stub frame)
      ════════════════════════════════════════ */}
      <div className="pk__rsvp-wrapper" id="pk-rsvp">
        <div className="pk__ticket">
          <span className="pk__ticket-kicker">ADMIT TWO</span>
          <RsvpForm eventId={event.id} />
        </div>
      </div>

      {/* ════════════════════════════════════════
          DIRECTIONS  (pink-drenched inverse block)
      ════════════════════════════════════════ */}
      <section className="pk__directions">
        <div className="pk__directions-inner">
          <h2 className="pk__directions-title pk__reveal">דרכי הגעה</h2>

          {(config.train_line || config.train_station) && (
            <div className="pk__transport-item pk__reveal">
              <span className="pk__transport-label">רכבת קלה</span>
              <span className="pk__transport-value">
                {config.train_line    && `קו ${config.train_line}`}
                {config.train_station && ` · תחנת ${config.train_station}`}
                {config.train_walk_minutes != null && ` · ${config.train_walk_minutes} דקות הליכה`}
              </span>
            </div>
          )}

          {config.parking_lot && (
            <div className="pk__transport-item pk__reveal">
              <span className="pk__transport-label">חניה</span>
              <span className="pk__transport-value">
                {`חניון ${config.parking_lot}`}
                {config.parking_walk_minutes != null && ` · ${config.parking_walk_minutes} דקות הליכה`}
              </span>
            </div>
          )}

          {config.venue_address_full && (
            <p className="pk__address pk__reveal">{config.venue_address_full}</p>
          )}

          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="pk__nav-btn pk__reveal"
          >
            פתח בניווט
          </a>
        </div>
      </section>

      {/* ════════════════════════════════════════
          FOOTER
      ════════════════════════════════════════ */}
      <footer className="pk__footer">
        <div className="pk__footer-inner">
          <p className="pk__developed-by">
            ההזמנה פותחה באהבה על ידי
            <a
              href="https://www.moriz.studio/"
              target="_blank"
              rel="noopener noreferrer"
              className="pk__footer-link"
            >
              <img src={Logo} alt="Moriz Studio" className="pk__footer-logo" />
            </a>
          </p>
          <PoweredByGuesto />
        </div>
      </footer>

    </div>
  );
}

export default PunkPosterTemplate;
