import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Hero from './components/Hero/Hero';
import RsvpForm from './components/RsvpForm/RsvpForm';
import Map from './components/Map/Map';
import Logo from '../src/white_logo.png';
import './App.scss';


function App() {

  return (
    <div className="app">
      <Hero />
      <RsvpForm />
      <Map />
      <footer className="app__footer" >
        <p className="greeting">בהתרגשות רבה, מחכים לראותכם!</p>
        <p className="developed-by">ההזמנה פותחה באהבה על ידי  
          <a href="https://www.moriz.studio/" target="_blank" rel="noopener noreferrer" className="developed-by__link">
          <img src={Logo} alt="logo" className="app__footer-logo" />
        </a>
        </p>
       
      </footer>
    </div>
  );
}

export default App;
