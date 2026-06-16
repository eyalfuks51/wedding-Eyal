import logoDark from '@/assets/brand/guesto-logo.png';
import logoWhite from '@/assets/brand/guesto-logo-white.png';

/**
 * Guesto wordmark (top-hat + GUESTO) — single source of truth for the product app.
 *
 * - `variant="onLight"` → ink wordmark, for light surfaces (default)
 * - `variant="onDark"`  → white wordmark, for dark surfaces
 *
 * Size with either `height` (inline px) or `className` (e.g. responsive
 * Tailwind `h-[30px] md:h-[34px]`). Width is always auto to keep aspect (~2.45:1).
 */
type Variant = 'onLight' | 'onDark';

const SRC: Record<Variant, string> = {
  onLight: logoDark,
  onDark: logoWhite,
};

interface LogoProps {
  variant?: Variant;
  height?: number;
  className?: string;
  alt?: string;
}

export default function Logo({
  variant = 'onLight',
  height,
  className,
  alt = 'Guesto',
}: LogoProps) {
  return (
    <img
      src={SRC[variant]}
      alt={alt}
      className={className}
      draggable={false}
      style={{
        width: 'auto',
        display: 'block',
        // Force the wordmark onto its own GPU layer, rasterized at full device
        // resolution. The topbars (mobile + desktop) sit on HEADER_GLASS, whose
        // `backdrop-filter` makes the header a compositing layer; on mobile GPUs
        // that layer's texture can be allocated below devicePixelRatio, which
        // upscales the logo painted into it → blocky/"pixelized". Promoting the
        // img to a separate layer gives it its own device-res texture instead.
        transform: 'translateZ(0)',
        backfaceVisibility: 'hidden',
        ...(height != null ? { height: `${height}px` } : null),
      }}
    />
  );
}
