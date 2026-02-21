import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import './Map.scss';

function Map({ config = {} }) {
  gsap.registerPlugin(ScrollTrigger);
  const sectionRef = useRef(null);

  const embedUrl = config.venue_maps_query
    ? `https://maps.google.com/maps?q=${config.venue_maps_query}&output=embed`
    : null;

  const mapsUrl = config.venue_address_full
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(config.venue_address_full)}`
    : '#';

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        defaults: { ease: 'power2.out' },
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top top',
          once: true,
        },
      });

      tl.fromTo('.map__title',
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.8 }
      );
      tl.fromTo('.map__info > *',
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.8, stagger: 0.15 },
        '-=0.5'
      );

      gsap.utils.toArray('.map__decoration').forEach((flower) => {
        gsap.fromTo(flower,
          { y: -20 },
          {
            y: 20,
            ease: 'none',
            scrollTrigger: {
              trigger: sectionRef.current,
              start: 'top bottom',
              end: 'bottom top',
              scrub: true,
            },
          }
        );
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section className="map red-border" ref={sectionRef}>
      <img src="/frame.png" alt="" className="frame-border-top" />
      <img src="/frame.png" alt="" className="frame-border-bottom" />
      <img src="/whiteflower.png" alt="" className="map__decoration map__decoration--top-left" />
      <img src="/redbolbol.png" alt="" className="map__decoration map__decoration--bottom-right" />

      <div className="map__container">
        <h2 className="map__title">דרכי הגעה</h2>

        <div className="map__content">
          <div className="map__info">
            {config.venue_address && (
              <h3 className="map__venue-name">{config.venue_address}</h3>
            )}

            {(config.train_line || config.train_station) && (
              <div>
                <span className="bold">הגעה ברכבת:</span>
                <p>
                  ניתן להגיע ברכבת הקלה{config.train_line && ` ${config.train_line}`}
                  {config.train_station && ` ולרדת בתחנת ${config.train_station}`}
                  {config.train_walk_minutes != null && `, שנמצאת במרחק של כ-${config.train_walk_minutes} דקות הליכה מהמקום`}.
                </p>
              </div>
            )}

            {config.parking_lot && (
              <div>
                <span className="bold">הגעה ברכב:</span>
                <p>
                  אם בחרתם להגיע ברכב, עדכנו אותנו כדי שנוכל להיערך עם כרטיסי חניה עבורכם.
                  תוכלו גם לא לעדכן, ולהסתדר עם חניה באופן עצמאי.
                  {` החניה היא בחניון ״${config.parking_lot}״`}
                  {config.parking_walk_minutes != null && `, שנמצא במרחק של כ-${config.parking_walk_minutes} דקות הליכה מהמקום`}.
                </p>
              </div>
            )}

            <span className="bold">אתם מוזמנים לפנות אלינו בכל שאלה נוספת ונשמח לעזור!</span>

            {config.venue_address_full && (
              <p className="map__address">{config.venue_address_full}</p>
            )}

            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="map__navigate-btn"
            >
              פתח בניווט
            </a>
          </div>

          {embedUrl && (
            <div className="map__embed">
              <iframe
                src={embedUrl}
                width="100%"
                height="300"
                style={{ border: 0 }}
                allowFullScreen=""
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="מיקום האירוע"
              />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default Map;
