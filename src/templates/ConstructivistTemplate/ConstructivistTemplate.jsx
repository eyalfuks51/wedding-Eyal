/**
 * ConstructivistTemplate — "Japanese Constructivist / Bauhaus poster"
 *
 * Smart Adaptation of a mid-century spirits poster → wedding, role-preserving:
 *   • 酒 dominant kanji      → giant "&" focal glyph (two, joined) — Futurism-Black
 *   • product photo (hero)   → couple_names type lockup overlapping the red forms
 *   • vertical katakana rail  → venue_name rotated rail, left edge
 *   • "D4-2" catalog SKU       → date_hebrew tiny corner mark
 *   • red circle + rectangle + black semicircle, cream/red/ink palette,
 *     hard zero-blur shadows → kept verbatim (aesthetic DNA)
 *
 * HARDCODED (this template's aesthetic):
 *   • Palette: cream / constructivist red / warm ink — strictly three colours
 *   • Type: Futurism-Black (display/&/numerals), Danidin (Hebrew names),
 *           Polin (Hebrew body), Manhattan (Latin labels)
 *   • CSS-only geometric decor (no image assets), GSAP geometric entrances
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
import './ConstructivistTemplate.scss';

import danceSVG from '../../timeline/dance.svg';
import marrySVG from '../../timeline/marry.svg';
import foodSVG from '../../timeline/food.svg';

const ICONS = { food: foodSVG, marry: marrySVG, dance: danceSVG };

// Constructivist divider: red bar bisected by an ink square — the poster's
// geometry in miniature. Replaces Elegant's champagne ornament.
function Rule() {
  return (
    <div className="ct__rule" aria-hidden="true">
      <span className="ct__rule-bar" />
      <span className="ct__rule-square" />
      <span className="ct__rule-bar" />
    </div>
  );
}

// Hanko (印) — a red seal stamp. On a Japanese document the seal is the mark of
// commitment/authenticity; here it's the wedding's. Pure CSS form, no data dep.
function Hanko({ className = '' }) {
  return (
    <span className={`ct__hanko ${className}`} aria-hidden="true">
      <span className="ct__hanko-mark" />
    </span>
  );
}

function ConstructivistTemplate({ event, config = {} }) {
  const wrapperRef = useRef(null);

  const schedule = config.schedule ?? [];
  const mapsUrl  = config.venue_address_full
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(config.venue_address_full)}`
    : '#';

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const ctx = gsap.context(() => {

      // ── Geometry assembles: shapes scale/rotate into place ──
      gsap.fromTo('.ct__shape',
        { scale: 0.4, opacity: 0, transformOrigin: '50% 50%' },
        { scale: 1, opacity: 1, duration: 1.1, ease: 'expo.out', stagger: 0.12, delay: 0.1 }
      );

      // ── Focal "&": fades up with a slight counter-rotate ──
      gsap.fromTo('.ct__amp',
        { y: 40, rotate: -8, opacity: 0 },
        { y: 0, rotate: 0, opacity: 1, duration: 1.2, ease: 'expo.out', delay: 0.25 }
      );

      // ── Hanko seals: stamp in (scale down + settle to resting tilt) ──
      gsap.fromTo('.ct__hanko',
        { scale: 1.7, opacity: 0, rotate: -26 },
        { scale: 1, opacity: 1, rotate: -7, duration: 0.5, ease: 'power4.out', delay: 1.0, stagger: 0.15 }
      );

      // ── Ambient drift on the focal "&" (skip when reduced-motion) ──
      const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      if (!reduce) {
        gsap.to('.ct__amp', { y: 14, duration: 3.4, ease: 'sine.inOut', yoyo: true, repeat: -1, delay: 1.8 });
      }

      // ── Vertical rail: wipes up ──
      gsap.fromTo('.ct__rail',
        { y: 60, opacity: 0 },
        { y: 0, opacity: 1, duration: 1, ease: 'power4.out', delay: 0.4 }
      );

      // ── Hero text: staggered fade-up ──
      gsap.fromTo('.ct__hero-content > *',
        { y: 28, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.9, ease: 'power3.out', stagger: 0.1, delay: 0.3 }
      );

      // ── Shapes parallax out of hero ──
      gsap.to('.ct__hero-decor', {
        y: -50,
        ease: 'none',
        scrollTrigger: { trigger: '.ct__hero', start: 'top top', end: 'bottom top', scrub: 1.4 },
      });

      // ── Schedule items stagger on scroll ──
      gsap.fromTo('.ct__schedule-item',
        { y: 32, opacity: 0 },
        {
          y: 0, opacity: 1, duration: 0.7, ease: 'power3.out', stagger: 0.14,
          scrollTrigger: { trigger: '.ct__schedule', start: 'top 80%', once: true },
        }
      );

      // ── Generic scroll-reveal ──
      gsap.utils.toArray('.ct__reveal').forEach((el) => {
        gsap.fromTo(el,
          { y: 22, opacity: 0 },
          {
            y: 0, opacity: 1, duration: 0.8, ease: 'power3.out',
            scrollTrigger: { trigger: el, start: 'top 88%', once: true },
          }
        );
      });

    }, wrapperRef);

    return () => ctx.revert();
  }, []);

  return (
    <div className="ct" ref={wrapperRef}>

      {/* ════════════════════════════════════════
          HERO
      ════════════════════════════════════════ */}
      <section className="ct__hero">

        {/* Constructivist geometry — circle over rectangle, bisecting semicircle */}
        <div className="ct__hero-decor" aria-hidden="true">
          <span className="ct__rays ct__rays--hero" />
          <span className="ct__shape ct__shape--rect" />
          <span className="ct__shape ct__shape--circle" />
          <span className="ct__shape ct__shape--semi" />
        </div>

        {/* Focal glyph: the join (re-mapped dominant kanji) */}
        <span className="ct__amp" aria-hidden="true">&amp;</span>

        {/* Vertical rail (re-mapped katakana column) */}
        {config.venue_name && (
          <span className="ct__rail" aria-hidden="true">{config.venue_name}</span>
        )}

        <div className="ct__hero-content">

          {config.quote && (
            <p className="ct__quote">{config.quote}</p>
          )}

          {config.couple_names && (
            <h1 className="ct__names">{config.couple_names}</h1>
          )}

          {config.invitation_text && (
            <p className="ct__invitation">{config.invitation_text}</p>
          )}

          {config.date_display && (
            <div className="ct__date-block">
              {config.day_of_week && (
                <span className="ct__date-dow">{config.day_of_week}</span>
              )}
              <span className="ct__date-number">{config.date_display}</span>
            </div>
          )}

          {(config.venue_name || config.venue_address) && (
            <div className="ct__venue">
              {config.venue_name && (
                <p className="ct__venue-name">{config.venue_name}</p>
              )}
              {config.venue_address && (
                <p className="ct__venue-address">{config.venue_address}</p>
              )}
            </div>
          )}

        </div>

        {/* Tiny catalog identifier (re-mapped "D4-2") */}
        {config.date_hebrew && (
          <span className="ct__catalog">{config.date_hebrew}</span>
        )}

        {/* Seal of commitment, lower-right (balances the catalog mark) */}
        <Hanko className="ct__hanko--hero" />
      </section>

      {/* ════════════════════════════════════════
          SCHEDULE + CLOSING
      ════════════════════════════════════════ */}
      {(schedule.length > 0 || config.footer_note || config.closing_message) && (
        <section className="ct__schedule-section">
          <div className="ct__schedule-inner">

            {schedule.length > 0 && (
              <>
                <p className="ct__section-label ct__reveal">לוח הערב</p>
                <Rule />
                <div className="ct__schedule">
                  {schedule.map((item, i) => (
                    <div key={item.time ?? i} className="ct__schedule-item">
                      {ICONS[item.icon] && (
                        <img
                          src={ICONS[item.icon]}
                          alt={item.label ?? ''}
                          className="ct__schedule-icon"
                        />
                      )}
                      {item.time  && <span className="ct__schedule-time">{item.time}</span>}
                      {item.label && <span className="ct__schedule-label">{item.label}</span>}
                    </div>
                  ))}
                </div>
              </>
            )}

            {(config.footer_note || config.closing_message) && (
              <div className="ct__closing-block ct__reveal">
                <Rule />
                {config.footer_note && (
                  <p className="ct__footer-note">{config.footer_note}</p>
                )}
                {config.closing_message && (
                  <p className="ct__closing">{config.closing_message}</p>
                )}
              </div>
            )}

          </div>
        </section>
      )}

      {/* ════════════════════════════════════════
          RSVP
      ════════════════════════════════════════ */}
      <div className="ct__rsvp-wrapper">
        <RsvpForm eventId={event.id} />
      </div>

      {/* ════════════════════════════════════════
          DIRECTIONS  (red-drenched section)
      ════════════════════════════════════════ */}
      <section className="ct__directions">
        <span className="ct__rays ct__rays--dir" aria-hidden="true" />
        <div className="ct__directions-inner">
          <h2 className="ct__directions-title ct__reveal">דרכי הגעה</h2>
          <Rule />

          {(config.train_line || config.train_station) && (
            <div className="ct__transport-item ct__reveal">
              <span className="ct__transport-label">רכבת קלה</span>
              <span className="ct__transport-value">
                {config.train_line    && `קו ${config.train_line}`}
                {config.train_station && ` · תחנת ${config.train_station}`}
                {config.train_walk_minutes != null && ` · ${config.train_walk_minutes} דקות הליכה`}
              </span>
            </div>
          )}

          {config.parking_lot && (
            <div className="ct__transport-item ct__reveal">
              <span className="ct__transport-label">חניה</span>
              <span className="ct__transport-value">
                {`חניון ${config.parking_lot}`}
                {config.parking_walk_minutes != null && ` · ${config.parking_walk_minutes} דקות הליכה`}
              </span>
            </div>
          )}

          {config.venue_address_full && (
            <p className="ct__address ct__reveal">{config.venue_address_full}</p>
          )}

          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ct__nav-btn ct__reveal"
          >
            פתח בניווט
          </a>
        </div>
      </section>

      {/* ════════════════════════════════════════
          FOOTER  (ink-drenched)
      ════════════════════════════════════════ */}
      <footer className="ct__footer">
        <Hanko className="ct__hanko--footer" />
        <div className="ct__footer-inner">
          <p className="ct__developed-by">
            ההזמנה פותחה באהבה על ידי
            <a
              href="https://www.moriz.studio/"
              target="_blank"
              rel="noopener noreferrer"
              className="ct__footer-link"
            >
              <img src={Logo} alt="Moriz Studio" className="ct__footer-logo" />
            </a>
          </p>
          <PoweredByGuesto />
        </div>
      </footer>

    </div>
  );
}

export default ConstructivistTemplate;
