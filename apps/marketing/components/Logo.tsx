/**
 * Guesto wordmark (top-hat + GUESTO) — single source of truth for the marketing app.
 * Assets live in `public/brand/`.
 *
 * - `variant="onLight"` → ink wordmark, for light surfaces (default)
 * - `variant="onDark"`  → white wordmark, for dark surfaces
 */
type Variant = 'onLight' | 'onDark';

const SRC: Record<Variant, string> = {
  onLight: '/brand/guesto-logo.png',
  onDark: '/brand/guesto-logo-white.png',
};

interface LogoProps {
  variant?: Variant;
  height?: number;
  className?: string;
  alt?: string;
}

export default function Logo({
  variant = 'onLight',
  height = 30,
  className,
  alt = 'Guesto',
}: LogoProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- fixed-size logo, next/image adds no value here
    <img
      src={SRC[variant]}
      alt={alt}
      className={className}
      draggable={false}
      style={{ height: `${height}px`, width: 'auto', display: 'block' }}
    />
  );
}
