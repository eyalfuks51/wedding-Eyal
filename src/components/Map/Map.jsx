import './Map.scss';

function Map() {
  // TODO: Update these with actual venue details
  const venueDetails = {
    subtitle: 'גלריה נור נמצאת במרכז השוק היווני ביפו, בין סמטאות העיר העתיקה.',
    address: 'פנחס בן יאיר 5, תל אביב',
    embedUrl: 'https://maps.google.com/maps?q=Pinkhas+Ben+Yair+5+Tel+Aviv&output=embed',
  };

  // Google Maps navigation URL
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venueDetails.address)}`;

  return (
    <section className="map red-border">
      <img src="/frame.png" alt="" className="frame-border-top" />
      <img src="/frame.png" alt="" className="frame-border-bottom" />
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
