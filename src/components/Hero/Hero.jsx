import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import './Hero.scss';

import danceSVG from'../../timeline/dance.svg'
import marrySVG from '../../timeline/marry.svg';
import foodSVG from '../../timeline/food.svg';

function TimelineItem({ icon, time, label }) {
  return (
    <div className="hero__timeline-item">
      <div className="hero__timeline-icon">
        <img src={icon} alt={label} />
      </div>
      <span className="hero__timeline-time">{time}</span>
      <span className="hero__timeline-label">{label}</span>
    </div>
  );
}

function Hero() {
  const timelineRef = useRef(null);

  useEffect(() => {
    const icons = timelineRef.current.querySelectorAll('.hero__timeline-icon img');
    gsap.fromTo(icons,
      { opacity: 0, scale: 0.3, y: 30 },
      {
        opacity: 1, scale: 1, y: 0,
        duration: 0.8,
        stagger:  {
          each: 0.2,
          from: 'end',
        },
        ease: 'back.out(1.7)',
      }
    );
  }, []);

  return (
    <section className="hero">
      <div className="hero__frame">
        <img src="/frame.png" alt="" className="hero__frame-border-top" />
        <img src="/frame.png" alt="" className="hero__frame-border-bottom" />
        <img src="/discoflower.png" alt="" className="hero__decoration hero__decoration--top-left" />
        <img src="/whiteflower.png" alt="" className="hero__decoration hero__decoration--bottom-right" />

        <p className="hero__quote">
          You are the sunshine of my life,
          That&rsquo;s why I&rsquo;ll always be around...
          <br />
          {/* <p className="hero__quote-subtext"> STEVE WONDER</p> */}
        </p>

        <h1 className="hero__names">הדר וניר</h1>

        <p className="hero__invitation">
          מתרגשים להזמין אתכם לחגוג את החתונה שלנו
          <br />
          שתתקיים ביום רביעי, כ&quot;ב באדר תשפ&quot;ו
        </p>

        <div className="hero__date">11 03 2026</div>

        <div className="hero__venue">
          <h2 className="hero__venue-name">Noor Jaffa</h2>
          <p className="hero__venue-address">גלריה נור, תל אביב יפו</p>
        </div>

        <div className="hero__timeline" ref={timelineRef}>
          <TimelineItem
            icon={danceSVG}
            time="22:00"
            label="!רוקדים"
          />
          <TimelineItem
            icon={marrySVG}
            time="21:30"
            label="מתחתנים"
          />
          <TimelineItem
            icon={foodSVG}
            time="19:30"
            label="אוכלים"
          />
        </div>
        <div className="hero__footer-text">

        <p>
        החתונה היא חתונה הפוכה,
        <br />
        קודם אוכלים ואחר כך מתחתנים. מומלץ להגיע בזמן

        </p>
        ♥
        <p className="bold waiting">
          מחכים לראותכם ולשמוח ביחד
          <br />
          ניר, הדר והמשפחות המאושרות
        </p>
        </div>

      </div>
    </section>
  );
}

export default Hero;
