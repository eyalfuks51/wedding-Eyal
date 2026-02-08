import Hero from './components/Hero/Hero';
import Details from './components/Details/Details';
import RsvpForm from './components/RsvpForm/RsvpForm';
import Map from './components/Map/Map';
import './App.scss';

function App() {
  return (
    <div className="app">
      <Hero />
      <RsvpForm />
      <Map />
      <footer className="app__footer">
        <p>בהתרגשות רבה, מחכים לראותכם!</p>
      </footer>
    </div>
  );
}

export default App;
