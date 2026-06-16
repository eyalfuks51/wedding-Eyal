"use client";

import { motion, useReducedMotion } from "framer-motion";

export type PricingPlan = {
  title: string;
  /** Big amount, e.g. "₪0". Optional — omit for tiers without a live price yet. */
  price?: string;
  priceDescription?: string;
  description: string;
  features?: string[];
  buttonText: string;
  buttonHref?: string;
  /** Pill above the title, e.g. "Pro" or "זמין עכשיו". */
  badge?: string;
  /** Dark, emphasized treatment (the "advanced" tier). */
  highlighted?: boolean;
};

/**
 * Marketing pricing card. Plain-CSS adaptation (`.pc-*` in globals.css) of a
 * shadcn/Tailwind card — same approach as AnimatedTestimonials / FeatureCarousel.
 * framer-motion (already a dep) drives the hover lift; lucide is replaced by an
 * inline diamond SVG.
 */
export function PricingCard({
  title,
  price,
  priceDescription,
  description,
  features,
  buttonText,
  buttonHref = "#",
  badge,
  highlighted = false,
  className,
}: PricingPlan & { className?: string }) {
  const reduce = useReducedMotion();

  return (
    <motion.article
      className={`pc-card${highlighted ? " pc-card--highlight" : ""}${
        className ? ` ${className}` : ""
      }`}
      whileHover={
        reduce
          ? undefined
          : {
              y: -6,
              scale: 1.015,
              boxShadow: "0 24px 50px oklch(0.22 0.04 286 / 0.18)",
            }
      }
      transition={{ type: "spring", stiffness: 300, damping: 22 }}
    >
      <div className="pc-body">
        <div className="pc-head">
          {badge ? <span className="pc-badge">{badge}</span> : null}
          <h3 className="pc-title">{title}</h3>
          {price ? (
            <div className="pc-price">
              <span className="pc-price__amount">{price}</span>
              {priceDescription ? (
                <span className="pc-price__desc">{priceDescription}</span>
              ) : null}
            </div>
          ) : priceDescription ? (
            <p className="pc-price__desc pc-price__desc--solo">
              {priceDescription}
            </p>
          ) : null}
        </div>

        <p className="pc-desc">{description}</p>

        {features ? (
          <ul className="pc-features">
            {features.map((feature) => (
              <li className="pc-feature" key={feature}>
                <svg
                  className="pc-diamond"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M12 2 22 12 12 22 2 12Z" />
                </svg>
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="pc-foot">
        <a className="button button--primary pc-cta" href={buttonHref}>
          {buttonText}
        </a>
      </div>
    </motion.article>
  );
}

export default PricingCard;
