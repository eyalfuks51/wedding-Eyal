/**
 * WeddingModernTemplate — "Zine / Retro Bold"
 *
 * Aesthetic: vivid green · mustard yellow · burnt orange · heavy black
 * Visual language: grid backgrounds, hard retro shadows, jagged ticket
 * edges, inline SVG stickers (daisies, clovers, stamp circles).
 *
 * Architecture (unchanged):
 *   • Accepts { event, config } — config fields are ALL optional
 *   • RsvpForm is a pure visual wrapper — zero logic touched
 *   • Layout: Hero → RSVP → Schedule → Directions → Footer
 */

import RsvpForm from '../../components/RsvpForm/RsvpForm';
import Logo from '../../white_logo.png';
import './WeddingModernTemplate.scss';

import danceSVG from '../../timeline/dance.svg';
import marrySVG from '../../timeline/marry.svg';
import foodSVG from '../../timeline/food.svg';

const ICONS = { food: foodSVG, marry: marrySVG, dance: danceSVG };

// ── Color constants (mirror SCSS tokens for inline SVG fills) ─────────────────
const C_GREEN   = '#35A853';
const C_MUSTARD = '#F5C518';
const C_ORANGE  = '#E05A2B';
const C_BLACK   = '#111111';
const C_WHITE   = '#FAFAFA';

// ── Decorative components ─────────────────────────────────────────────────────

/** Retro daisy flower — white petals with yellow centre, black stroke */
function DaisyFlower({ size = 90, className = '' }) {
  const angles = Array.from({ length: 12 }, (_, i) => i * 30);
  return (
    <svg
      width={size} height={size} viewBox="0 0 80 80"
      className={`wm__deco ${className}`} aria-hidden="true"
    >
      {angles.map((a) => (
        <ellipse
          key={a} cx="40" cy="40" rx="5.5" ry="17"
          fill={C_WHITE} stroke={C_BLACK} strokeWidth="1.5"
          transform={`rotate(${a} 40 40)`}
        />
      ))}
      <circle cx="40" cy="40" r="11" fill={C_MUSTARD} stroke={C_BLACK} strokeWidth="2" />
    </svg>
  );
}

/** Four-leaf clover blob — overlapping green circles */
function CloverBlob({ size = 64, className = '' }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 60 60"
      className={`wm__deco ${className}`} aria-hidden="true"
    >
      <circle cx="30" cy="13" r="14" fill={C_GREEN} stroke={C_BLACK} strokeWidth="2.5" />
      <circle cx="47" cy="30" r="14" fill={C_GREEN} stroke={C_BLACK} strokeWidth="2.5" />
      <circle cx="30" cy="47" r="14" fill={C_GREEN} stroke={C_BLACK} strokeWidth="2.5" />
      <circle cx="13" cy="30" r="14" fill={C_GREEN} stroke={C_BLACK} strokeWidth="2.5" />
      <circle cx="30" cy="30" r="10" fill={C_GREEN} />
    </svg>
  );
}

/** Circular stamp with curved text */
function StampCircle({ text = '✦ RSVP ✦ WEDDING ✦ 2026 ✦', size = 110, className = '' }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 110 110"
      className={`wm__deco wm__deco--stamp ${className}`} aria-hidden="true"
    >
      <defs>
        <path id="wm-stamp-arc" d="M 10,55 a 45,45 0 1,1 90,0 a 45,45 0 1,1 -90,0" />
      </defs>
      <circle cx="55" cy="55" r="50" fill="none" stroke={C_BLACK} strokeWidth="2.5" strokeDasharray="3 2" />
      <circle cx="55" cy="55" r="42" fill="none" stroke={C_BLACK} strokeWidth="1.5" />
      <text
        fontSize="8.5" fontFamily="'Polin', 'Heebo', sans-serif"
        fontWeight="700" fill={C_BLACK} letterSpacing="2.5"
      >
        <textPath href="#wm-stamp-arc">{text}</textPath>
      </text>
      <text
        x="55" y="64" textAnchor="middle"
        fontSize="26" fontFamily="'Danidin', serif" fontWeight="700" fill={C_BLACK}
      >
        ♥
      </text>
    </svg>
  );
}

/** Zigzag SVG divider between two coloured sections */
function JaggedEdge({ topColor, bottomColor }) {
  const teeth = 52;
  const W = 1200;
  const H = 30;
  const pts = [`0,${H}`];
  for (let i = 0; i < teeth; i++) {
    pts.push(`${((i + 0.5) * W / teeth).toFixed(1)},0`);
    pts.push(`${((i + 1) * W / teeth).toFixed(1)},${H}`);
  }
  pts.push(`${W},${H}`);
  return (
    <div style={{ background: topColor, lineHeight: 0, overflow: 'hidden' }}>
      <svg
        viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"
        style={{ display: 'block', width: '100%', height: `${H}px` }}
        aria-hidden="true"
      >
        <polygon points={pts.join(' ')} fill={bottomColor} />
      </svg>
    </div>
  );
}

// ── Main template ─────────────────────────────────────────────────────────────

function WeddingModernTemplate({ event, config = {} }) {
  const schedule = config.schedule ?? [];
  const mapsUrl  = config.venue_address_full
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(config.venue_address_full)}`
    : '#';

  const hasScheduleSection =
    schedule.length > 0 || config.footer_note || config.closing_message;

  return (
    <div className="wm" dir="rtl">

      {/* ════════════════════════════════════════════════════════════════
          HERO  — vivid green grid, mustard names, black content box
      ════════════════════════════════════════════════════════════════ */}
      <section className="wm__hero">
        <DaisyFlower size={96}  className="wm__deco--hero-tl" />
        <CloverBlob  size={72}  className="wm__deco--hero-tr" />
        <DaisyFlower size={58}  className="wm__deco--hero-br" />
        <StampCircle size={104} className="wm__deco--hero-bl" />

        <div className="wm__hero-box">
          {config.quote && (
            <p className="wm__quote">{config.quote}</p>
          )}

          {config.couple_names && (
            <h1 className="wm__names">{config.couple_names}</h1>
          )}

          {config.invitation_text && (
            <p className="wm__invitation">{config.invitation_text}</p>
          )}

          {config.date_display && (
            <div className="wm__date-block">
              {config.day_of_week && (
                <span className="wm__date-dow">{config.day_of_week}</span>
              )}
              <span className="wm__date-number" dir="ltr">{config.date_display}</span>
              {config.date_hebrew && (
                <span className="wm__date-heb">{config.date_hebrew}</span>
              )}
            </div>
          )}

          {(config.venue_name || config.venue_address) && (
            <div className="wm__venue-tag">
              {config.venue_name    && <span className="wm__venue-name">{config.venue_name}</span>}
              {config.venue_address && <span className="wm__venue-address">{config.venue_address}</span>}
            </div>
          )}
        </div>
      </section>

      {/* green → mustard */}
      <JaggedEdge topColor={C_GREEN} bottomColor={C_MUSTARD} />

      {/* ════════════════════════════════════════════════════════════════
          RSVP  — mustard grid, white ticket card with jagged edges
      ════════════════════════════════════════════════════════════════ */}
      <section className="wm__rsvp-section">
        <DaisyFlower size={52} className="wm__deco--rsvp-tr" />
        <CloverBlob  size={44} className="wm__deco--rsvp-bl" />

        {/* drop-shadow wrapper preserves shadow through clip-path */}
        <div className="wm__rsvp-shadow">
          <div className="wm__rsvp-card">
            <RsvpForm eventId={event.id} />
          </div>
        </div>
      </section>

      {/* mustard → green */}
      <JaggedEdge topColor={C_MUSTARD} bottomColor={C_GREEN} />

      {/* ════════════════════════════════════════════════════════════════
          SCHEDULE  — green grid, mustard label badge, white item cards
      ════════════════════════════════════════════════════════════════ */}
      {hasScheduleSection && (
        <section className="wm__schedule-section">
          <CloverBlob size={58} className="wm__deco--sched-tl" />
          <DaisyFlower size={50} className="wm__deco--sched-br" />

          <div className="wm__schedule-inner">
            {schedule.length > 0 && (
              <>
                <p className="wm__section-label">לוח הערב</p>
                <div className="wm__schedule">
                  {schedule.map((item, i) => (
                    <div key={item.time ?? i} className="wm__schedule-item">
                      {ICONS[item.icon] && (
                        <div className="wm__schedule-icon-wrap">
                          <img
                            src={ICONS[item.icon]}
                            alt={item.label ?? ''}
                            className="wm__schedule-icon"
                          />
                        </div>
                      )}
                      {item.time  && <span className="wm__schedule-time">{item.time}</span>}
                      {item.label && <span className="wm__schedule-label">{item.label}</span>}
                    </div>
                  ))}
                </div>
              </>
            )}

            {(config.footer_note || config.closing_message) && (
              <div className="wm__closing-block">
                {config.footer_note     && <p className="wm__footer-note">{config.footer_note}</p>}
                {config.closing_message && <p className="wm__closing">{config.closing_message}</p>}
              </div>
            )}
          </div>
        </section>
      )}

      {/* green → orange */}
      <JaggedEdge topColor={C_GREEN} bottomColor={C_ORANGE} />

      {/* ════════════════════════════════════════════════════════════════
          DIRECTIONS  — orange grid, black title badge, mustard CTA
      ════════════════════════════════════════════════════════════════ */}
      <section className="wm__directions">
        <DaisyFlower size={72} className="wm__deco--dir-tr" />

        <div className="wm__directions-inner">
          <h2 className="wm__directions-title">דרכי הגעה</h2>

          {(config.train_line || config.train_station) && (
            <div className="wm__transport-item">
              <span className="wm__transport-label">רכבת קלה</span>
              <span className="wm__transport-value">
                {config.train_line    && `קו ${config.train_line}`}
                {config.train_station && ` · תחנת ${config.train_station}`}
                {config.train_walk_minutes != null && ` · ${config.train_walk_minutes} דקות הליכה`}
              </span>
            </div>
          )}

          {config.parking_lot && (
            <div className="wm__transport-item">
              <span className="wm__transport-label">חניה</span>
              <span className="wm__transport-value">
                {`חניון ${config.parking_lot}`}
                {config.parking_walk_minutes != null && ` · ${config.parking_walk_minutes} דקות הליכה`}
              </span>
            </div>
          )}

          {config.venue_address_full && (
            <p className="wm__address">{config.venue_address_full}</p>
          )}

          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="wm__nav-btn"
          >
            פתח בניווט
          </a>
        </div>
      </section>

      {/* orange → black */}
      <JaggedEdge topColor={C_ORANGE} bottomColor={C_BLACK} />

      {/* ════════════════════════════════════════════════════════════════
          FOOTER
      ════════════════════════════════════════════════════════════════ */}
      <footer className="wm__footer">
        <p className="wm__developed-by">
          ההזמנה פותחה באהבה על ידי
          <a
            href="https://www.moriz.studio/"
            target="_blank"
            rel="noopener noreferrer"
            className="wm__footer-link"
          >
            <img src={Logo} alt="Moriz Studio" className="wm__footer-logo" />
          </a>
        </p>
      </footer>

    </div>
  );
}

export default WeddingModernTemplate;
