import Hero from '../../components/Hero/Hero';
import RsvpForm from '../../components/RsvpForm/RsvpForm';
import Map from '../../components/Map/Map';
import Logo from '../../white_logo.png';
import '../../App.scss';

function WeddingTemplate({ event, config }) {
  return (
    <div className="app">
      <Hero config={config} />
      <RsvpForm eventId={event.id} />
      <Map config={config} />
      <footer className="app__footer">
        <p className="developed-by">ההזמנה פותחה באהבה על ידי
          <a href="https://www.moriz.studio/" target="_blank" rel="noopener noreferrer" className="developed-by__link">
            <img src={Logo} alt="logo" className="app__footer-logo" />
          </a>
        </p>
      </footer>
    </div>
  );
}

export default WeddingTemplate;
