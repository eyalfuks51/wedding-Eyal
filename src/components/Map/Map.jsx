import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import './Map.scss';

function Map() {
  const sectionRef = useRef(null);

  // TODO: Update these with actual venue details
  const venueDetails = {
    subtitle: 'גלריה נור נמצאת במרכז השוק היווני ביפו, בין סמטאות העיר העתיקה.',
    address: 'פנחס בן יאיר 5, תל אביב',
    embedUrl: 'https://maps.google.com/maps?q=Pinkhas+Ben+Yair+5+Tel+Aviv&output=embed',
  };

  // Google Maps navigation URL
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venueDetails.address)}`;

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        defaults: { ease: 'power2.out' },
        scrollTrigger: {
          trigger: '.map',
          start: 'top 80%',
          once: true,
        },
      });

      // Title: fade-in + rise
      tl.fromTo('.map__title',
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.8 }
      );

      // Info blocks: stagger fade-in + rise
      tl.fromTo('.map__info > *',
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.8, stagger: 0.15 },
        '-=0.5'
      );

      // Map iframe: fade-in last
      tl.fromTo('.map__embed',
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 1 },
        '-=0.3'
      );

      // Decorative flowers: subtle parallax
      gsap.utils.toArray('.map__decoration').forEach((flower) => {
        gsap.fromTo(flower,
          { y: -20 },
          {
            y: 20,
            ease: 'none',
            scrollTrigger: {
              trigger: '.map',
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
            <h3 className="map__venue-name">{venueDetails.subtitle}</h3>
            <div>
              <span className="bold">הגעה ברכבת:</span>
              <p>ניתן להגיע ברכבת הקלה R1 ולרדת בתחנת שלמה, שנמצאת במרחק של כ-4 דקות הליכה מהמקום.</p>
            </div>

            <div>
              <span className="bold">הגעה ברכב:</span>
              <p>אם בחרתם להגיע ברכב, עדכנו אותנו כדי שנוכל להיערך עם כרטיסי חניה עבורכם. תוכלו גם לא לעדכן, ולהסתדר עם חניה באופן עצמאי.
              החניה היא בחניון ״חצרות יפו״, שנמצא במרחק של כ-5 דקות הליכה מהמקום.</p>
            </div>

            <span className="bold">אתם מוזמנים לפנות אלינו בכל שאלה נוספת ונשמח לעזור!</span>
            <p className="map__address">{venueDetails.address}</p>
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="map__navigate-btn"
            >
              פתח בניווט
            </a>
          </div>

          <div className="map__embed">
            <iframe
              src={venueDetails.embedUrl}
              width="100%"
              height="300"
              style={{ border: 0 }}
              allowFullScreen=""
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="מיקום האירוע"
            ></iframe>
          </div>
        </div>
      </div>
    </section>
  );
}

export default Map;
