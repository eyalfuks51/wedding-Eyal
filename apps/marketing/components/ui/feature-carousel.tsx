"use client";

import { useEffect, useRef, useState } from "react";

export type TemplateSlide = {
  id: string;
  name: string;
  tone: string;
  description: string;
  /** Screenshot path, e.g. "/templates/elegant.png". Falls back to a branded
   *  placeholder while the file is missing (or if it fails to load). */
  src?: string;
  alt?: string;
  /** Live event page URL. When this card is centered it renders as a scaled
   *  iframe so the real invite animates in-frame (mirrors dashboard LivePreview).
   *  Side cards stay on `src` — only the focused card pays a page load. */
  previewUrl?: string;
};

const AUTOPLAY_MS = 4500;
// Design width the live page is scaled down from — same trick as the dashboard
// LivePreview (render at a real phone width, transform-scale into the frame).
const PHONE_W = 375;

/**
 * Coverflow showcase for the real product templates.
 *
 * Adapted to the marketing app's hand-written CSS system (see `.fc-*` in
 * globals.css) instead of Tailwind/shadcn — same approach as AnimatedTestimonials.
 * Dynamic per-card transforms stay inline (they depend on the active index);
 * all static chrome lives in CSS.
 */
export function FeatureCarousel({
  items,
  autoplay = false,
  className,
}: {
  items: TemplateSlide[];
  autoplay?: boolean;
  className?: string;
}) {
  const total = items.length;
  const [active, setActive] = useState(Math.floor(total / 2));
  const [paused, setPaused] = useState(false);
  const [failed, setFailed] = useState<Set<string>>(new Set());

  // All cards share one screen layout box (the per-card transform is visual
  // only), so measuring any one gives the scale for every live iframe.
  const screenRef = useRef<HTMLDivElement>(null);
  const [screen, setScreen] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = screenRef.current;
    if (!el) return;
    const measure = () => setScreen({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const scale = screen.w ? screen.w / PHONE_W : 0;

  // Mount the live iframes once the carousel nears the viewport, then keep them
  // mounted forever. Deferring keeps them off the initial-load path; never
  // unmounting means switching cards never reloads — no flash, no re-animation.
  const rootRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = rootRef.current;
    if (!el || inView) return;
    const io = new IntersectionObserver(
      (entries) => entries.some((e) => e.isIntersecting) && setInView(true),
      { rootMargin: "300px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [inView]);

  const goTo = (index: number) => setActive(((index % total) + total) % total);
  const next = () => setActive((prev) => (prev + 1) % total);
  const prev = () => setActive((prev) => (prev - 1 + total) % total);

  useEffect(() => {
    if (!autoplay || paused || total <= 1) return;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const timer = setInterval(
      () => setActive((p) => (p + 1) % total),
      AUTOPLAY_MS,
    );
    return () => clearInterval(timer);
  }, [autoplay, paused, total]);

  if (total === 0) return null;

  const activeItem = items[active];

  return (
    <div
      ref={rootRef}
      className={className ? `fc-root ${className}` : "fc-root"}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-roledescription="קרוסלת עיצובים"
    >
      <div className="fc-stage">
        <div className="fc-track">
          {items.map((item, index) => {
            let pos = (index - active + total) % total;
            if (pos > Math.floor(total / 2)) pos -= total;

            const isCenter = pos === 0;
            const isAdjacent = Math.abs(pos) === 1;
            const showImage = Boolean(item.src) && !failed.has(item.id);
            // Every card with a previewUrl goes live once the section is in
            // view. Iframes never unmount, so navigating between them never
            // reloads. Screenshot stays as the backdrop until the iframe paints.
            const showLive = inView && Boolean(item.previewUrl) && scale > 0;

            return (
              <article
                key={item.id}
                className={`fc-card fc-card--${item.id}${isCenter ? " is-active" : ""}`}
                aria-hidden={!isCenter}
                style={{
                  transform: `translateX(${pos * 52}%) scale(${
                    isCenter ? 1 : isAdjacent ? 0.84 : 0.7
                  }) rotateY(${pos * -12}deg)`,
                  zIndex: isCenter ? 30 : isAdjacent ? 20 : 10,
                  opacity: isCenter ? 1 : isAdjacent ? 0.5 : 0,
                  filter: isCenter ? "none" : "blur(3px)",
                  visibility: Math.abs(pos) > 1 ? "hidden" : "visible",
                  pointerEvents: isCenter ? "auto" : "none",
                }}
              >
                <span className="fc-notch" aria-hidden="true" />
                <div
                  className="fc-screen"
                  ref={index === 0 ? screenRef : undefined}
                >
                  {showImage ? (
                    // Instant backdrop. The live iframe paints over it, so the
                    // load never shows a blank gradient.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.src}
                      alt={item.alt ?? `עיצוב ${item.name}`}
                      className="fc-shot"
                      loading="lazy"
                      draggable={false}
                      onError={() =>
                        setFailed((s) => new Set(s).add(item.id))
                      }
                    />
                  ) : !showLive ? (
                    <div className="fc-placeholder" aria-hidden="true">
                      <span className="fc-placeholder__stamp">RSVP</span>
                      <span className="fc-placeholder__tone">{item.tone}</span>
                      <strong className="fc-placeholder__name">{item.name}</strong>
                    </div>
                  ) : null}
                  {showLive && (
                    <iframe
                      src={item.previewUrl}
                      title={`עיצוב ${item.name}`}
                      loading="lazy"
                      tabIndex={-1}
                      scrolling="no"
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: `${PHONE_W}px`,
                        height: `${Math.round(screen.h / scale)}px`,
                        border: "none",
                        transform: `scale(${scale})`,
                        transformOrigin: "top left",
                        // Showcase only: animation plays on its own, so block
                        // interaction to avoid scroll-jacking / stray RSVP taps.
                        pointerEvents: "none",
                      }}
                    />
                  )}
                </div>
              </article>
            );
          })}
        </div>

        <button
          type="button"
          className="fc-btn fc-btn--prev"
          onClick={prev}
          aria-label="העיצוב הקודם"
        >
          <svg
            className="fc-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m9 6 6 6-6 6" />
          </svg>
        </button>
        <button
          type="button"
          className="fc-btn fc-btn--next"
          onClick={next}
          aria-label="העיצוב הבא"
        >
          <svg
            className="fc-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m15 6-6 6 6 6" />
          </svg>
        </button>
      </div>

      <div className="fc-caption" key={active} aria-live="polite">
        <p className="fc-caption__tone">{activeItem.tone}</p>
        <h3 className="fc-caption__name">{activeItem.name}</h3>
        <p className="fc-caption__desc">{activeItem.description}</p>
      </div>

      <div className="fc-dots" role="group" aria-label="בחירת עיצוב">
        {items.map((item, index) => (
          <button
            key={item.id}
            type="button"
            className={`fc-dot${index === active ? " is-active" : ""}`}
            aria-label={item.name}
            aria-current={index === active ? "true" : undefined}
            onClick={() => goTo(index)}
          />
        ))}
      </div>
    </div>
  );
}

export default FeatureCarousel;
