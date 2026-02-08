import './Map.scss';

function Map() {
  // TODO: Update these with actual venue details
  const venueDetails = {
    name: 'נור יפו',
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
        <h2 className="map__title">איך מגיעים?</h2>

        <div className="map__content">
          <div className="map__info">
            <h3 className="map__venue-name">{venueDetails.name}</h3>
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
