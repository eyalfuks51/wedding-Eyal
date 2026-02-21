import RsvpForm from '../../components/RsvpForm/RsvpForm';
import Logo from '../../white_logo.png';
import './ElegantTemplate.scss';

import danceSVG from '../../timeline/dance.svg';
import marrySVG from '../../timeline/marry.svg';
import foodSVG from '../../timeline/food.svg';

const ICONS = { food: foodSVG, marry: marrySVG, dance: danceSVG };

// Thin gold divider with a centred diamond ornament
function Divider() {
  return (
    <div className="elegant__divider" aria-hidden="true">
      <span className="elegant__divider-gem">◆</span>
    </div>
  );
}

function ElegantTemplate({ event, config = {} }) {
  const mapsUrl = config.venue_address_full
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(config.venue_address_full)}`
    : '#';

  const schedule = config.schedule ?? [];

  return (
    <div className="elegant">

      {/* ── Hero ─────────────────────────────── */}
      <section className="elegant__hero">
        <div className="elegant__hero-inner">

          {config.quote && (
            <p className="elegant__quote">{config.quote}</p>
          )}

          <Divider />

          {config.couple_names && (
            <h1 className="elegant__names">{config.couple_names}</h1>
          )}

          {config.invitation_text && (
            <p className="elegant__invitation">{config.invitation_text}</p>
          )}

          {config.date_display && (
            <div className="elegant__date-block">
              {config.day_of_week && (
                <span className="elegant__date-dow">{config.day_of_week}</span>
              )}
              <span className="elegant__date-number">{config.date_display}</span>
              {config.date_hebrew && (
                <span className="elegant__date-heb">{config.date_hebrew}</span>
              )}
            </div>
          )}

          {(config.venue_name || config.venue_address) && (
            <p className="elegant__venue">
              {config.venue_name}
              {config.venue_name && config.venue_address && (
                <span className="elegant__bullet"> · </span>
              )}
              {config.venue_address}
            </p>
          )}

          <Divider />

          {schedule.length > 0 && (
            <div className="elegant__schedule">
              {schedule.map((item, i) => (
                <div key={item.time ?? i} className="elegant__schedule-item">
                  {ICONS[item.icon] && (
                    <img
                      src={ICONS[item.icon]}
                      alt={item.label ?? ''}
                      className="elegant__schedule-icon"
                    />
                  )}
                  {item.time && (
                    <span className="elegant__schedule-time">{item.time}</span>
                  )}
                  {item.label && (
                    <span className="elegant__schedule-label">{item.label}</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {config.footer_note && (
            <p className="elegant__footer-note">{config.footer_note}</p>
          )}

          {config.closing_message && (
            <p className="elegant__closing">{config.closing_message}</p>
          )}

        </div>
      </section>

      {/* ── RSVP ─────────────────────────────── */}
      <div className="elegant__rsvp-wrapper">
        <RsvpForm eventId={event.id} />
      </div>

      {/* ── Directions ───────────────────────── */}
      <section className="elegant__directions">
        <div className="elegant__directions-inner">
          <h2 className="elegant__section-title">דרכי הגעה</h2>
          <Divider />

          {(config.train_line || config.train_station) && (
            <div className="elegant__transport-item">
              <span className="elegant__transport-label">רכבת קלה</span>
              <span className="elegant__transport-value">
                {config.train_line && `קו ${config.train_line}`}
                {config.train_station && ` · תחנת ${config.train_station}`}
                {config.train_walk_minutes != null && ` · ${config.train_walk_minutes} דקות הליכה`}
              </span>
            </div>
          )}

          {config.parking_lot && (
            <div className="elegant__transport-item">
              <span className="elegant__transport-label">חניה</span>
              <span className="elegant__transport-value">
                {`חניון ${config.parking_lot}`}
                {config.parking_walk_minutes != null && ` · ${config.parking_walk_minutes} דקות הליכה`}
              </span>
            </div>
          )}

          {config.venue_address_full && (
            <p className="elegant__address">{config.venue_address_full}</p>
          )}

          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="elegant__nav-btn"
          >
            פתח בניווט
          </a>
        </div>
      </section>

      {/* ── Footer ───────────────────────────── */}
      <footer className="elegant__footer">
        <p className="elegant__developed-by">
          ההזמנה פותחה באהבה על ידי
          <a
            href="https://www.moriz.studio/"
            target="_blank"
            rel="noopener noreferrer"
            className="elegant__footer-link"
          >
            <img src={Logo} alt="Moriz Studio" className="elegant__footer-logo" />
          </a>
        </p>
      </footer>

    </div>
  );
}

export default ElegantTemplate;
