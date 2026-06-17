/**
 * SynesthesiaTemplate — "Synaesthetic spray-art zine poster"
 *
 * Smart Adaptation of a SIGHT+SOUND synesthesia art-event poster → wedding:
 *   • "SIGHT + SOUND" condensed-black top title  → couple_names (Danidin)
 *   • Electric-blue spray blob + eye-grid creature → hero focal illustration (decor)
 *   • Speaker + soundwave icons flanking blob     → flanking decor, aria-hidden
 *   • Wavy wave line below blob                  → Wave divider component
 *   • 3 bottom labels with wave-underline         → day_of_week · date_display · venue_name
 *   • "+" motif: recurring decorative separator   → section dividers, watermark, trio separators
 *   • Tiny catalog mark                           → date_hebrew corner
 *
 * HARDCODED (this template's aesthetic):
 *   • Palette: cream / electric-blue / ink — strictly three colours
 *   • Type: Danidin (Hebrew couple names), Futurism-Black (+ glyph/numerals),
 *           Polin (Hebrew body/labels), Manhattan (Latin micro-labels)
 *   • CSS-only decor (no image assets), GSAP entrances + ambient animations
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
import './SynesthesiaTemplate.scss';

import danceSVG from '../../timeline/dance.svg';
import marrySVG from '../../timeline/marry.svg';
import foodSVG from '../../timeline/food.svg';

const ICONS = { food: foodSVG, marry: marrySVG, dance: danceSVG };

// ── Wave divider — the zine's wavy horizontal rule. ────────────────────────
// Used between every section, replaces Constructivist's Rule.
function Wave({ className = '', invert = false }) {
  return (
    <div className={`sy__wave ${className}`} aria-hidden="true">
      <svg
        viewBox="0 0 400 28"
        preserveAspectRatio="none"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`sy__wave-svg${invert ? ' sy__wave-svg--invert' : ''}`}
      >
        <path
          d="M0 14 C20 4, 40 24, 60 14 S100 4, 120 14 S160 24, 180 14
             S220 4, 240 14 S280 24, 300 14 S340 4, 360 14 S380 24, 400 14"
          stroke="currentColor"
          strokeWidth="2.8"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

// ── RepeatWave — tiny repeating-wave underline beneath trio labels ──────────
function RepeatWave() {
  return (
    <svg
      viewBox="0 0 120 10"
      preserveAspectRatio="none"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="sy__trio-wave"
      aria-hidden="true"
    >
      <path
        d="M0 5 C8 1, 16 9, 24 5 S40 1, 48 5 S64 9, 72 5 S88 1, 96 5 S112 9, 120 5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ── Speaker SVG — inline, aria-hidden flanking decor ───────────────────────
function Speaker({ className = '' }) {
  return (
    <svg
      viewBox="0 0 56 72"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`sy__speaker ${className}`}
      aria-hidden="true"
    >
      {/* Speaker body */}
      <rect x="2" y="22" width="18" height="28" rx="2" stroke="currentColor" strokeWidth="3" fill="none" />
      {/* Speaker cone */}
      <path d="M20 26 L36 14 L36 58 L20 46 Z" stroke="currentColor" strokeWidth="3" fill="none" strokeLinejoin="round" />
      {/* Sound waves */}
      <path d="M40 28 C44 32, 44 40, 40 44" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <path d="M44 22 C51 30, 51 42, 44 50" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" fill="none" />
    </svg>
  );
}

// ── EyeGrid — 3×6 grid of cartoon line-art eyes inside the blob ────────────
function EyeGrid() {
  const eyes = [];
  const rows = 3;
  const cols = 5;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      const isBlinking = idx === 2 || idx === 9; // 2 eyes blink
      eyes.push(
        <svg
          key={idx}
          viewBox="0 0 40 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`sy__eye${isBlinking ? ' sy__eye--blink' : ''}`}
          aria-hidden="true"
        >
          {/* Outer eye shape */}
          <ellipse cx="20" cy="12" rx="18" ry="10" fill="white" stroke="#0e0e10" strokeWidth="2.5" />
          {/* Pupil */}
          <circle cx="20" cy="12" r="5" fill="#0e0e10" />
          {/* Highlight */}
          <circle cx="22" cy="10" r="1.5" fill="white" />
        </svg>
      );
    }
  }
  return (
    <div className="sy__eye-grid" aria-hidden="true">
      {eyes}
    </div>
  );
}

function SynesthesiaTemplate({ event, config = {} }) {
  const wrapperRef = useRef(null);

  const schedule = config.schedule ?? [];
  const mapsUrl  = config.venue_address_full
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(config.venue_address_full)}`
    : '#';

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const ctx = gsap.context(() => {

      // ── Hero text: staggered fade-up ──
      gsap.fromTo('.sy__hero-content > *',
        { y: 28, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.9, ease: 'power3.out', stagger: 0.11, delay: 0.2 }
      );

      // ── Blob assembles: scales in from smaller ──
      gsap.fromTo('.sy__blob-wrap',
        { scale: 0.7, opacity: 0 },
        { scale: 1, opacity: 1, duration: 1.3, ease: 'expo.out', delay: 0.15 }
      );

      // ── Speakers fade+slide in from sides ──
      gsap.fromTo('.sy__speaker--left',
        { x: -40, opacity: 0 },
        { x: 0, opacity: 1, duration: 1, ease: 'power3.out', delay: 0.5 }
      );
      gsap.fromTo('.sy__speaker--right',
        { x: 40, opacity: 0 },
        { x: 0, opacity: 1, duration: 1, ease: 'power3.out', delay: 0.5 }
      );

      // ── Wavy wave draws in (scaleX from 0) ──
      gsap.fromTo('.sy__wave-hero',
        { scaleX: 0, opacity: 0, transformOrigin: 'center center' },
        { scaleX: 1, opacity: 1, duration: 1, ease: 'power4.out', delay: 0.7 }
      );

      // ── Trio labels stagger in ──
      gsap.fromTo('.sy__trio-item',
        { y: 18, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.7, ease: 'power3.out', stagger: 0.12, delay: 0.8 }
      );

      // ── Watermark "+" fades in ──
      gsap.fromTo('.sy__plus-watermark',
        { scale: 1.2, opacity: 0 },
        { scale: 1, opacity: 1, duration: 1.4, ease: 'expo.out', delay: 0.1 }
      );

      const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

      if (!reduce) {
        // ── Blob subtle breathe (scale yoyo) ──
        gsap.to('.sy__blob', {
          scale: 1.04,
          duration: 4.2,
          ease: 'sine.inOut',
          yoyo: true,
          repeat: -1,
          delay: 1.5,
        });

        // ── Eyes blink: scaleY to 0 and back ──
        gsap.to('.sy__eye--blink ellipse, .sy__eye--blink circle',
          {
            scaleY: 0.08,
            transformOrigin: '50% 50%',
            duration: 0.08,
            ease: 'power2.in',
            yoyo: true,
            repeat: -1,
            repeatDelay: 3.5,
            stagger: 1.8,
            delay: 2,
          }
        );

        // ── Speaker pulse ──
        gsap.to('.sy__speaker',
          {
            opacity: 0.6,
            duration: 0.9,
            ease: 'sine.inOut',
            yoyo: true,
            repeat: -1,
            stagger: 0.45,
            delay: 1.2,
          }
        );
      }

      // ── Hero decor parallax out ──
      gsap.to('.sy__hero-decor', {
        y: -40,
        ease: 'none',
        scrollTrigger: { trigger: '.sy__hero', start: 'top top', end: 'bottom top', scrub: 1.4 },
      });

      // ── Schedule items stagger on scroll ──
      gsap.fromTo('.sy__schedule-item',
        { y: 32, opacity: 0 },
        {
          y: 0, opacity: 1, duration: 0.7, ease: 'power3.out', stagger: 0.14,
          scrollTrigger: { trigger: '.sy__schedule', start: 'top 80%', once: true },
        }
      );

      // ── Generic scroll-reveal ──
      gsap.utils.toArray('.sy__reveal').forEach((el) => {
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
    <div className="sy" ref={wrapperRef}>

      {/* ════════════════════════════════════════
          HERO
      ════════════════════════════════════════ */}
      <section className="sy__hero">

        {/* Hebrew date tiny corner mark (re-mapped catalog) */}
        {config.date_hebrew && (
          <span className="sy__catalog">{config.date_hebrew}</span>
        )}

        {/* Big decorative "+" watermark — recurring focal motif */}
        <span className="sy__plus-watermark" aria-hidden="true">+</span>

        <div className="sy__hero-content">

          {/* couple_names: condensed-black top lockup (Danidin) */}
          {config.couple_names && (
            <h1 className="sy__names">{config.couple_names}</h1>
          )}

          {/* Illustration: blob + speakers (all decor, aria-hidden) */}
          <div className="sy__hero-decor" aria-hidden="true">
            <Speaker className="sy__speaker--left" />
            <div className="sy__blob-wrap">
              <div className="sy__blob">
                <EyeGrid />
              </div>
            </div>
            <Speaker className="sy__speaker--right" />
          </div>

          {/* Wavy wave line below blob */}
          <Wave className="sy__wave-hero" />

          {/* Trio: day_of_week · date_display · venue_name */}
          {(config.day_of_week || config.date_display || config.venue_name) && (
            <div className="sy__trio">
              {config.day_of_week && (
                <>
                  <div className="sy__trio-item">
                    <span className="sy__trio-label">{config.day_of_week}</span>
                    <RepeatWave />
                  </div>
                  {config.date_display && (
                    <span className="sy__trio-sep" aria-hidden="true">+</span>
                  )}
                </>
              )}
              {config.date_display && (
                <>
                  <div className="sy__trio-item">
                    <span className="sy__trio-label sy__trio-label--date">{config.date_display}</span>
                    <RepeatWave />
                  </div>
                  {config.venue_name && (
                    <span className="sy__trio-sep" aria-hidden="true">+</span>
                  )}
                </>
              )}
              {config.venue_name && (
                <div className="sy__trio-item">
                  <span className="sy__trio-label">{config.venue_name}</span>
                  <RepeatWave />
                </div>
              )}
            </div>
          )}

          {config.quote && (
            <p className="sy__quote">{config.quote}</p>
          )}

          {config.invitation_text && (
            <p className="sy__invitation">{config.invitation_text}</p>
          )}

          {config.venue_address && (
            <p className="sy__venue-address">{config.venue_address}</p>
          )}

        </div>
      </section>

      {/* ════════════════════════════════════════
          SCHEDULE + CLOSING
      ════════════════════════════════════════ */}
      {(schedule.length > 0 || config.footer_note || config.closing_message) && (
        <section className="sy__schedule-section">
          <Wave />
          <div className="sy__schedule-inner">

            {schedule.length > 0 && (
              <>
                <p className="sy__section-label sy__reveal">לוח הערב</p>
                <div className="sy__schedule">
                  {schedule.map((item, i) => (
                    <div key={item.time ?? i} className="sy__schedule-item">
                      {ICONS[item.icon] && (
                        <img
                          src={ICONS[item.icon]}
                          alt={item.label ?? ''}
                          className="sy__schedule-icon"
                        />
                      )}
                      {item.time  && <span className="sy__schedule-time">{item.time}</span>}
                      {item.label && (
                        <span className="sy__schedule-label">
                          {item.label}
                          <RepeatWave />
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}

            {(config.footer_note || config.closing_message) && (
              <div className="sy__closing-block sy__reveal">
                <Wave />
                {config.footer_note && (
                  <p className="sy__footer-note">{config.footer_note}</p>
                )}
                {config.closing_message && (
                  <p className="sy__closing">{config.closing_message}</p>
                )}
              </div>
            )}

          </div>
          <Wave />
        </section>
      )}

      {/* ════════════════════════════════════════
          RSVP
      ════════════════════════════════════════ */}
      <div className="sy__rsvp-wrapper">
        <RsvpForm eventId={event.id} />
      </div>

      {/* ════════════════════════════════════════
          DIRECTIONS  (electric-blue-drenched)
      ════════════════════════════════════════ */}
      <section className="sy__directions">
        <div className="sy__directions-inner">
          <h2 className="sy__directions-title sy__reveal">דרכי הגעה</h2>
          <Wave invert />

          {(config.train_line || config.train_station) && (
            <div className="sy__transport-item sy__reveal">
              <span className="sy__transport-label">רכבת קלה</span>
              <span className="sy__transport-value">
                {config.train_line    && `קו ${config.train_line}`}
                {config.train_station && ` · תחנת ${config.train_station}`}
                {config.train_walk_minutes != null && ` · ${config.train_walk_minutes} דקות הליכה`}
              </span>
            </div>
          )}

          {config.parking_lot && (
            <div className="sy__transport-item sy__reveal">
              <span className="sy__transport-label">חניה</span>
              <span className="sy__transport-value">
                {`חניון ${config.parking_lot}`}
                {config.parking_walk_minutes != null && ` · ${config.parking_walk_minutes} דקות הליכה`}
              </span>
            </div>
          )}

          {config.venue_address_full && (
            <p className="sy__address sy__reveal">{config.venue_address_full}</p>
          )}

          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="sy__nav-btn sy__reveal"
          >
            פתח בניווט
          </a>
        </div>
      </section>

      {/* ════════════════════════════════════════
          FOOTER  (ink-drenched)
      ════════════════════════════════════════ */}
      <footer className="sy__footer">
        <div className="sy__footer-inner">
          <p className="sy__developed-by">
            ההזמנה פותחה באהבה על ידי
            <a
              href="https://www.moriz.studio/"
              target="_blank"
              rel="noopener noreferrer"
              className="sy__footer-link"
            >
              <img src={Logo} alt="Moriz Studio" className="sy__footer-logo" />
            </a>
          </p>
          <PoweredByGuesto />
        </div>
      </footer>

    </div>
  );
}

export default SynesthesiaTemplate;
