/**
 * ElegantTemplate — "Boho-Luxe / Tropical Elegant"
 *
 * HARDCODED (specific to this template's assets & aesthetic):
 *   • monstrea.png      — hero top-right corner (pushed far into margin, text-safe)
 *   • necklace.png      — footer bottom-right corner
 *   • Wine explotion.png — full-width divider between schedule and RSVP
 *   • Color palette: warm cream + deep forest green + champagne gold
 *   • Typography: same fonts as WeddingDefaultTemplate
 *     (Danidin for names, Gravitas One for dates/titles, Dancing Script for quote, Polin/Heebo body)
 *   • GSAP: slide-from-corner on mount (monstera), ScrollTrigger reveals (everything else)
 *
 * FROM content_config (text/data only):
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
import './ElegantTemplate.scss';

import danceSVG from '../../timeline/dance.svg';
import marrySVG from '../../timeline/marry.svg';
import foodSVG from '../../timeline/food.svg';

const ICONS = { food: foodSVG, marry: marrySVG, dance: danceSVG };

function Ornament() {
  return (
    <div className="el__ornament" aria-hidden="true">
      <span className="el__ornament-line" />
      <span className="el__ornament-gem">✦</span>
      <span className="el__ornament-line" />
    </div>
  );
}

function ElegantTemplate({ event, config = {} }) {
  const wrapperRef = useRef(null);

  const schedule = config.schedule ?? [];
  const mapsUrl  = config.venue_address_full
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(config.venue_address_full)}`
    : '#';

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const ctx = gsap.context(() => {

      // ── Monstera: slides in from top-right corner on page load ──
      gsap.fromTo('.el__asset--monstera',
        { x: 60, y: -35, opacity: 0 },
        { x: 0, y: 0, opacity: 1, duration: 1.6, ease: 'power3.out', delay: 0.15 }
      );

      // ── Monstera: subtle parallax while scrolling out of hero ──
      gsap.to('.el__asset--monstera', {
        y: -60,
        ease: 'none',
        scrollTrigger: {
          trigger: '.el__hero',
          start: 'top top',
          end: 'bottom top',
          scrub: 1.5,
        },
      });

      // ── Hero text: staggered fade-up on mount ──
      gsap.fromTo('.el__hero-content > *',
        { y: 26, opacity: 0 },
        { y: 0, opacity: 1, duration: 1, ease: 'power2.out', stagger: 0.12, delay: 0.2 }
      );

      // ── Schedule items: stagger up on scroll ──
      gsap.fromTo('.el__schedule-item',
        { y: 30, opacity: 0 },
        {
          y: 0, opacity: 1, duration: 0.7, ease: 'power2.out', stagger: 0.14,
          scrollTrigger: { trigger: '.el__schedule', start: 'top 80%', once: true },
        }
      );

      // ── Closing block: fade up ──
      gsap.fromTo('.el__closing-block',
        { y: 22, opacity: 0 },
        {
          y: 0, opacity: 1, duration: 0.85, ease: 'power2.out',
          scrollTrigger: { trigger: '.el__closing-block', start: 'top 85%', once: true },
        }
      );

      // ── Wine divider: cinematic fade + subtle de-scale ──
      gsap.fromTo('.el__wine-divider',
        { opacity: 0, scale: 1.04 },
        {
          opacity: 1, scale: 1, duration: 1.3, ease: 'power2.out',
          scrollTrigger: { trigger: '.el__wine-divider', start: 'top 88%', once: true },
        }
      );

      // ── Necklace in footer: slides in from bottom-right on scroll ──
      gsap.fromTo('.el__asset--necklace',
        { x: 40, y: 30, opacity: 0 },
        {
          x: 0, y: 0, opacity: 1, duration: 1.2, ease: 'power2.out',
          scrollTrigger: { trigger: '.el__footer', start: 'top 90%', once: true },
        }
      );

      // ── Generic scroll-reveal ──
      gsap.utils.toArray('.el__reveal').forEach((el) => {
        gsap.fromTo(el,
          { y: 20, opacity: 0 },
          {
            y: 0, opacity: 1, duration: 0.8, ease: 'power2.out',
            scrollTrigger: { trigger: el, start: 'top 88%', once: true },
          }
        );
      });

    }, wrapperRef);

    return () => ctx.revert();
  }, []);

  return (
    <div className="el" ref={wrapperRef}>

      {/* ════════════════════════════════════════
          HERO
      ════════════════════════════════════════ */}
      <section className="el__hero">

        {/* Monstera: pushed into top-right margin, text stays clear */}
        <div className="el__asset el__asset--monstera" aria-hidden="true">
          <img src="/assets/templates/elegant/monstrea.png" alt="" />
        </div>

        <div className="el__hero-content">

          {config.quote && (
            <p className="el__quote">{config.quote}</p>
          )}

          <Ornament />

          {config.couple_names && (
            <h1 className="el__names">{config.couple_names}</h1>
          )}

          {config.invitation_text && (
            <p className="el__invitation">{config.invitation_text}</p>
          )}

          {config.date_display && (
            <div className="el__date-block">
              {config.day_of_week && (
                <span className="el__date-dow">{config.day_of_week}</span>
              )}
              <span className="el__date-number">{config.date_display}</span>
              {config.date_hebrew && (
                <span className="el__date-heb">{config.date_hebrew}</span>
              )}
            </div>
          )}

          {(config.venue_name || config.venue_address) && (
            <div className="el__venue">
              {config.venue_name && (
                <p className="el__venue-name">{config.venue_name}</p>
              )}
              {config.venue_address && (
                <p className="el__venue-address">{config.venue_address}</p>
              )}
            </div>
          )}

        </div>
      </section>

      {/* ════════════════════════════════════════
          SCHEDULE + CLOSING
      ════════════════════════════════════════ */}
      {(schedule.length > 0 || config.footer_note || config.closing_message) && (
        <section className="el__schedule-section">
          <div className="el__schedule-inner">

            {schedule.length > 0 && (
              <>
                <p className="el__section-label el__reveal">לוח הערב</p>
                <Ornament />
                <div className="el__schedule">
                  {schedule.map((item, i) => (
                    <div key={item.time ?? i} className="el__schedule-item">
                      {ICONS[item.icon] && (
                        <img
                          src={ICONS[item.icon]}
                          alt={item.label ?? ''}
                          className="el__schedule-icon"
                        />
                      )}
                      {item.time  && <span className="el__schedule-time">{item.time}</span>}
                      {item.label && <span className="el__schedule-label">{item.label}</span>}
                    </div>
                  ))}
                </div>
              </>
            )}

            {(config.footer_note || config.closing_message) && (
              <div className="el__closing-block">
                <Ornament />
                {config.footer_note && (
                  <p className="el__footer-note">{config.footer_note}</p>
                )}
                {config.closing_message && (
                  <p className="el__closing">{config.closing_message}</p>
                )}
              </div>
            )}

          </div>
        </section>
      )}

      {/* ════════════════════════════════════════
          WINE EXPLOSION — full-width section divider
      ════════════════════════════════════════ */}
      <div className="el__wine-divider" aria-hidden="true">
        <img
          src="/assets/templates/elegant/Wine explotion.png"
          alt=""
        />
      </div>

      {/* ════════════════════════════════════════
          RSVP
      ════════════════════════════════════════ */}
      <div className="el__rsvp-wrapper">
        <RsvpForm eventId={event.id} />
      </div>

      {/* ════════════════════════════════════════
          DIRECTIONS
      ════════════════════════════════════════ */}
      <section className="el__directions">
        <div className="el__directions-inner">
          <h2 className="el__directions-title el__reveal">דרכי הגעה</h2>
          <Ornament />

          {(config.train_line || config.train_station) && (
            <div className="el__transport-item el__reveal">
              <span className="el__transport-label">רכבת קלה</span>
              <span className="el__transport-value">
                {config.train_line    && `קו ${config.train_line}`}
                {config.train_station && ` · תחנת ${config.train_station}`}
                {config.train_walk_minutes != null && ` · ${config.train_walk_minutes} דקות הליכה`}
              </span>
            </div>
          )}

          {config.parking_lot && (
            <div className="el__transport-item el__reveal">
              <span className="el__transport-label">חניה</span>
              <span className="el__transport-value">
                {`חניון ${config.parking_lot}`}
                {config.parking_walk_minutes != null && ` · ${config.parking_walk_minutes} דקות הליכה`}
              </span>
            </div>
          )}

          {config.venue_address_full && (
            <p className="el__address el__reveal">{config.venue_address_full}</p>
          )}

          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="el__nav-btn el__reveal"
          >
            פתח בניווט
          </a>
        </div>
      </section>

      {/* ════════════════════════════════════════
          FOOTER — necklace anchored bottom-right
      ════════════════════════════════════════ */}
      <footer className="el__footer">

        {/* Necklace: drifts in from bottom-right corner */}
        <div className="el__asset el__asset--necklace" aria-hidden="true">
          <img src="/assets/templates/elegant/necklace.png" alt="" />
        </div>

        <div className="el__footer-inner">
          <p className="el__developed-by">
            ההזמנה פותחה באהבה על ידי
            <a
              href="https://www.moriz.studio/"
              target="_blank"
              rel="noopener noreferrer"
              className="el__footer-link"
            >
              <img src={Logo} alt="Moriz Studio" className="el__footer-logo" />
            </a>
          </p>
        </div>

      </footer>

    </div>
  );
}

export default ElegantTemplate;
