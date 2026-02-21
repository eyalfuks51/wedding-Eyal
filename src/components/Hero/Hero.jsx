import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import './Hero.scss';

import danceSVG from '../../timeline/dance.svg';
import marrySVG from '../../timeline/marry.svg';
import foodSVG from '../../timeline/food.svg';

const ICONS = { food: foodSVG, marry: marrySVG, dance: danceSVG };

function TimelineItem({ icon, time, label }) {
  return (
    <div className="hero__timeline-item">
      <div className="hero__timeline-icon">
        <img src={icon} alt={label ?? ''} />
      </div>
      {time  && <span className="hero__timeline-time">{time}</span>}
      {label && <span className="hero__timeline-label">{label}</span>}
    </div>
  );
}

function Hero({ config = {} }) {
  const sectionRef = useRef(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power2.out' } });

      tl.fromTo('.hero__quote',
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 1 }
      );
      tl.fromTo('.hero__names',
        { opacity: 0, scale: 0.95 },
        { opacity: 1, scale: 1, duration: 0.8 },
        '-=0.7'
      );
      tl.fromTo('.hero__invitation',
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.8 },
        '-=0.5'
      );
      tl.fromTo('.hero__date',
        { opacity: 0, scale: 0.9 },
        { opacity: 1, scale: 1, duration: 0.8 },
        '-=0.5'
      );
      tl.fromTo('.hero__venue',
        { opacity: 0, y: 0 },
        { opacity: 1, y: 0, duration: 0.4 },
        '-=0.5'
      );

      const icons = sectionRef.current.querySelectorAll('.hero__timeline-icon img');
      gsap.fromTo(icons,
        { opacity: 0, scale: 0.3, y: 30 },
        {
          opacity: 1, scale: 1, y: 0,
          duration: 0.8,
          stagger: { each: 0.2, from: 'end' },
          ease: 'back.out(1.7)',
          scrollTrigger: {
            trigger: '.hero__timeline',
            start: 'top 85%',
            once: true,
          },
        }
      );

      gsap.fromTo('.hero__footer-text',
        { opacity: 0, y: 20 },
        {
          opacity: 1, y: 0,
          duration: 0.8,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: '.hero__footer-text',
            start: 'top 85%',
            once: true,
          },
        }
      );
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  const schedule = config.schedule ?? [];
  const hasDateLine = config.day_of_week || config.date_hebrew;

  return (
    <section className="hero" ref={sectionRef}>
      <div className="hero__frame">
        <img src="/frame.png" alt="" className="hero__frame-border-top" />
        <img src="/frame.png" alt="" className="hero__frame-border-bottom" />
        <img src="/discoflower.png" alt="" className="hero__decoration hero__decoration--top-left" />
        <img src="/whiteflower.png" alt="" className="hero__decoration hero__decoration--bottom-right" />

        {config.quote && (
          <p className="hero__quote" style={{ whiteSpace: 'pre-line' }}>
            {config.quote}
          </p>
        )}

        {config.couple_names && (
          <h1 className="hero__names">{config.couple_names}</h1>
        )}

        {(config.invitation_text || hasDateLine) && (
          <p className="hero__invitation">
            {config.invitation_text}
            {hasDateLine && (
              <>
                <br />
                {'שתתקיים '}
                {config.day_of_week}
                {config.day_of_week && config.date_hebrew && ', '}
                {config.date_hebrew}
              </>
            )}
          </p>
        )}

        {config.date_display && (
          <div className="hero__date">{config.date_display}</div>
        )}

        {(config.venue_name || config.venue_address) && (
          <div className="hero__venue">
            {config.venue_name && (
              <h2 className="hero__venue-name">{config.venue_name}</h2>
            )}
            {config.venue_address && (
              <p className="hero__venue-address">{config.venue_address}</p>
            )}
          </div>
        )}

        {schedule.length > 0 && (
          <div className="hero__timeline">
            {[...schedule].reverse().map((item) => (
              <TimelineItem
                key={item.time ?? item.label}
                icon={ICONS[item.icon]}
                time={item.time}
                label={item.label}
              />
            ))}
          </div>
        )}

        {(config.footer_note || config.closing_message) && (
          <div className="hero__footer-text">
            {config.footer_note && (
              <p style={{ whiteSpace: 'pre-line' }}>{config.footer_note}</p>
            )}
            {config.closing_message && (
              <p style={{ whiteSpace: 'pre-line' }} className="bold waiting">
                {config.closing_message}
              </p>
            )}
          </div>
        )}

      </div>
    </section>
  );
}

export default Hero;
