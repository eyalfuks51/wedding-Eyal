import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Hero from './components/Hero/Hero';
import Details from './components/Details/Details';
import RsvpForm from './components/RsvpForm/RsvpForm';
import Map from './components/Map/Map';
import './App.scss';

gsap.registerPlugin(ScrollTrigger);

function App() {
  const footerRef = useRef(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(footerRef.current.querySelector('p'),
        { opacity: 0, y: 20 },
        {
          opacity: 1, y: 0,
          duration: 0.8,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: footerRef.current,
            start: 'top 90%',
            once: true,
          },
        }
      );
    }, footerRef);

    return () => ctx.revert();
  }, []);

  return (
    <div className="app">
      <Hero />
      <RsvpForm />
      <Map />
      <footer className="app__footer" ref={footerRef}>
        <p>בהתרגשות רבה, מחכים לראותכם!</p>
      </footer>
    </div>
  );
}

export default App;
